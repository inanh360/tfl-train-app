import type {
  TflLine,
  NormalisedLineStatus,
  TflStopPointSearchResponse,
  TflStopPointMatch,
  TflJourneyResult,
  TflDisambiguationResult,
  TflDisambiguationSide,
  TflNearbyStopPointResponse,
  TflNearbyStopPoint,
  TflArrivalPrediction,
  TflStopPointDetail,
  TflLineStopPoint,
  TflAdditionalProperty,
} from "../types/tfl";

const TFL_BASE_URL = "https://api.tfl.gov.uk";

// Modes covered by "TfL train only" per the project scope — deliberately
// excludes bus and river, per the product decision to keep journeys
// single-mode.
const TRAIN_MODES = ["tube", "dlr", "overground", "elizabeth-line"] as const;

function buildStatusUrl(): string {
  const modes = TRAIN_MODES.join(",");
  const url = new URL(`${TFL_BASE_URL}/Line/Mode/${modes}/Status`);
  url.searchParams.set("detail", "true");

  const appKey = process.env.TFL_APP_KEY;
  if (appKey) {
    url.searchParams.set("app_key", appKey);
  }
  return url.toString();
}

function appendAppKey(url: URL): void {
  const appKey = process.env.TFL_APP_KEY;
  if (appKey) {
    url.searchParams.set("app_key", appKey);
  }
}

export async function fetchLineStatuses(): Promise<TflLine[]> {
  const res = await fetch(buildStatusUrl());
  if (!res.ok) {
    throw new Error(`TfL status request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as TflLine[];
}

// Searches TfL's StopPoint index by free text (station name). TfL's
// modesFilter param doesn't reliably exclude non-train results (bus stops
// sharing a hub id still show up), so we post-filter client-side to only
// matches that include at least one of our train modes.
export async function searchStations(query: string): Promise<TflStopPointMatch[]> {
  const url = new URL(`${TFL_BASE_URL}/StopPoint/Search/${encodeURIComponent(query)}`);
  url.searchParams.set("modesFilter", TRAIN_MODES.join(","));
  url.searchParams.set("maxResults", "10");
  appendAppKey(url);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`TfL station search failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as TflStopPointSearchResponse;

  return data.matches.filter((m) => m.modes.some((mode) => (TRAIN_MODES as readonly string[]).includes(mode)));
}

// encodeURIComponent turns commas into %2C, but TfL's own disambiguation
// responses return lat,lon ids with the comma left literal in their URIs —
// encoding it changes what TfL receives and can turn a valid retry into a
// 404. This keeps normal encoding for everything except commas.
function encodeStopId(id: string): string {
  return encodeURIComponent(id).replace(/%2C/g, ",");
}

// TfL's StopPoint Search legitimately returns "hub" ids (e.g. "HUBBAN" for
// Bank/Monument, combining multiple physical platforms/lines under one
// interchange id) — but the Journey Planner endpoint doesn't reliably
// accept those same hub ids as a location parameter, instead falling back
// to fuzzy text-matching against unrelated place names. Resolving to the
// hub's coordinates first sidesteps this: TfL's own disambiguation
// responses confirm lat,lon pairs are accepted reliably.
async function resolveJourneyParam(id: string): Promise<string> {
  if (!id.startsWith("HUB")) {
    return id;
  }

  const url = new URL(`${TFL_BASE_URL}/StopPoint/${encodeURIComponent(id)}`);
  appendAppKey(url);

  const res = await fetch(url.toString());
  if (!res.ok) {
    // If the hub lookup itself fails, fall back to the original id rather
    // than blocking the whole request — worst case we're back to the
    // original 300/fuzzy-match behaviour, not a hard failure.
    return id;
  }

  const stopPoint = (await res.json()) as { lat?: number; lon?: number };
  if (typeof stopPoint.lat !== "number" || typeof stopPoint.lon !== "number") {
    return id;
  }

  return `${stopPoint.lat},${stopPoint.lon}`;
}

async function fetchJourney(fromId: string, toId: string): Promise<{ status: number; body: TflDisambiguationResult }> {
  const url = new URL(`${TFL_BASE_URL}/Journey/JourneyResults/${encodeStopId(fromId)}/to/${encodeStopId(toId)}`);
  url.searchParams.set("mode", TRAIN_MODES.join(","));
  appendAppKey(url);

  const res = await fetch(url.toString());
  // TfL uses 300 as a real, parseable response (disambiguation options),
  // not a failure — only treat genuine error statuses as fatal here.
  if (!res.ok && res.status !== 300) {
    throw new Error(`TfL journey planner request failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as TflDisambiguationResult;
  return { status: res.status, body };
}

// Reads the first candidate id out of whichever shape TfL actually sent
// back — the array key (matches vs disambiguationOptions) and the id
// field name (id vs parameterValue) both vary in practice.
function firstDisambiguationId(side: TflDisambiguationSide | undefined): string | undefined {
  const options = side?.matches ?? side?.disambiguationOptions ?? [];
  const first = options[0];
  return first?.id ?? first?.parameterValue;
}

// Plans a journey between two StopPoint ids, restricted to train modes only
// (per the product decision to keep journeys single-mode rather than
// mixing in bus legs).
//
// TfL sometimes responds with HTTP 300 even for a specific, valid id —
// notably hub ids like "HUBBAN" (Bank/Monument) that cover more than one
// physical station — along with a real body listing disambiguation
// options instead of journeys. Rather than surface that as an error, this
// picks the top-ranked match TfL offers for whichever side is ambiguous
// and retries once with the resolved id.
export async function planJourney(fromId: string, toId: string): Promise<TflJourneyResult> {
  const [resolvedFromId, resolvedToId] = await Promise.all([resolveJourneyParam(fromId), resolveJourneyParam(toId)]);
  const first = await fetchJourney(resolvedFromId, resolvedToId);

  if (first.status !== 300) {
    return { journeys: first.body.journeys };
  }

  console.log("[journey] TfL returned 300, raw disambiguation body:", JSON.stringify(first.body));

  const resolvedFrom = firstDisambiguationId(first.body.fromLocationDisambiguation) ?? resolvedFromId;
  const resolvedTo = firstDisambiguationId(first.body.toLocationDisambiguation) ?? resolvedToId;

  if (resolvedFrom === resolvedFromId && resolvedTo === resolvedToId) {
    // TfL gave us a 300 but no usable disambiguation options to resolve it
    // with — nothing more we can do automatically.
    throw new Error("TfL journey planner returned an ambiguous location with no resolvable match");
  }

  const retry = await fetchJourney(resolvedFrom, resolvedTo);
  return { journeys: retry.body.journeys };
}

// Flattens TfL's nested shape into one row per (line, status).
// A line can carry more than one simultaneous lineStatuses entry (seen in
// practice on Metropolitan — Part Suspended + Special Service at once), so
// this returns an array per line, not a single object.
export function normaliseLineStatuses(lines: TflLine[]): NormalisedLineStatus[] {
  const normalised: NormalisedLineStatus[] = [];

  for (const line of lines) {
    for (const status of line.lineStatuses) {
      const affectedRoutes = status.disruption?.affectedRoutes ?? [];
      const branchLabel = affectedRoutes.find((r) => r.name)?.name ?? null;

      normalised.push({
        lineId: line.id,
        lineName: line.name,
        modeName: line.modeName,
        statusSeverity: status.statusSeverity,
        statusDescription: status.statusSeverityDescription,
        reason: status.reason ?? null,
        branchLabel,
        affectedStations: (status.disruption?.affectedStops ?? [])
          .filter((s) => s.name)
          .map((s) => ({ name: s.name as string, naptanId: s.naptanId ?? null })),
      });
    }
  }

  return normalised;
}

// Finds train stations within a radius (metres) of a coordinate, filtered
// to train modes and sorted nearest-first. Coded defensively against the
// response either being a bare array or wrapped in { stopPoints: [...] },
// since this specific endpoint's exact shape wasn't verifiable against a
// live response while building this.
// Great-circle distance between two points, in metres. /Place doesn't
// document a distance field in its response (unlike /StopPoint's
// includeDistances flag), so this computes it ourselves rather than
// assuming TfL supplies one.
function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// TfL retired the /Place endpoint entirely (confirmed via a live 403
// response reading "This API is retired") after this was originally
// built against it, breaking both this and the bus equivalent below at
// once. Rather than depend on TfL having any dedicated "nearby" endpoint
// at all, both now fetch and cache the full stop list once via
// /StopPoint/Mode/{modes} — an endpoint already confirmed working
// elsewhere in this codebase — and compute distance ourselves. Station
// and stop locations essentially never change, so a long cache is
// reasonable here in a way it wouldn't be for live status or arrivals.
const STOP_CACHE_MS = 24 * 60 * 60 * 1000;
let trainStopCache: { data: TflNearbyStopPoint[]; fetchedAt: number } | null = null;
let busStopCache: { data: TflNearbyStopPoint[]; fetchedAt: number } | null = null;

const STATION_STOP_TYPES = new Set(["NaptanMetroStation", "NaptanRailStation", "NaptanDlrStation"]);

async function fetchAllStopsForModes(modes: string, page?: number): Promise<TflNearbyStopPoint[]> {
  const url = new URL(`${TFL_BASE_URL}/StopPoint/Mode/${modes}`);
  if (page != null) url.searchParams.set("page", String(page));
  appendAppKey(url);

  // This is a genuinely large payload (thousands of bus stops
  // especially), and none of the fetch calls in this file have ever had
  // an explicit timeout — meaning a slow or hanging TfL response here
  // would leave the request stuck indefinitely with no error at all,
  // rather than failing visibly. 20 seconds is generous for a one-time,
  // long-cached fetch like this one.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`TfL stop list request failed for mode(s) ${modes}: ${res.status} ${res.statusText} — ${body}`);
    }
    const parsed = await res.json();
    if (Array.isArray(parsed)) return parsed as TflNearbyStopPoint[];

    // Not a bare array as assumed — try the common wrapper shapes seen
    // elsewhere in this codebase before giving up and logging the real
    // shape so this can be fixed against actual evidence rather than
    // another guess.
    const wrapped = (parsed as { stopPoints?: TflNearbyStopPoint[]; places?: TflNearbyStopPoint[] })?.stopPoints
      ?? (parsed as { stopPoints?: TflNearbyStopPoint[]; places?: TflNearbyStopPoint[] })?.places;
    if (Array.isArray(wrapped)) return wrapped;

    console.log(`[nearby] unexpected /StopPoint/Mode response shape for ${modes}:`, JSON.stringify(parsed).slice(0, 500));
    return [];
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`TfL stop list request for mode(s) ${modes} timed out after 20s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function getAllTrainStops(): Promise<TflNearbyStopPoint[]> {
  if (trainStopCache && Date.now() - trainStopCache.fetchedAt < STOP_CACHE_MS) return trainStopCache.data;

  const raw = (await fetchAllStopsForModes(TRAIN_MODES.join(","))) as (TflNearbyStopPoint & { stopType?: string })[];
  // This endpoint returns platform-level entries alongside real stations
  // for a mode like tube — filtered here to station-level ones, same
  // filtering used elsewhere in this file for the same reason.
  const stations = raw.filter((s) => s.stopType && STATION_STOP_TYPES.has(s.stopType));
  trainStopCache = { data: stations, fetchedAt: Date.now() };
  console.log(`[nearby] cached ${stations.length} train stations`);
  return stations;
}

async function getAllBusStops(): Promise<TflNearbyStopPoint[]> {
  if (busStopCache && Date.now() - busStopCache.fetchedAt < STOP_CACHE_MS) return busStopCache.data;

  // Confirmed via a live 400 response ("Bus mode must be paginated as
  // data set is too large") and TfL's own generated API client docs:
  // page 1 is stops 1-1000, page 2 is 1001-2000, and so on. There's no
  // documented way to know the total page count up front. Fetching one
  // page at a time sequentially took long enough on a live request that
  // Cloudflare's own proxy timed out waiting for a response (a 524),
  // even though the server was still working — so this fetches several
  // pages in parallel per round instead, only stopping once a round
  // contains a short page (the real signal that pagination has ended).
  // Capped at 30 pages (30,000 stops) as a sanity limit — London has
  // roughly 19,000 bus stops, so this leaves real headroom.
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 30;
  const BATCH_SIZE = 6;
  const all: TflNearbyStopPoint[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const batchPages = Array.from({ length: Math.min(BATCH_SIZE, MAX_PAGES - page + 1) }, (_, i) => page + i);
    const results = await Promise.all(batchPages.map((p) => fetchAllStopsForModes("bus", p)));

    let hitShortPage = false;
    for (let i = 0; i < results.length; i++) {
      const batch = results[i];
      all.push(...batch);
      console.log(`[nearby-bus] page ${batchPages[i]} returned ${batch.length} stops (running total ${all.length})`);
      if (batch.length < PAGE_SIZE) {
        hitShortPage = true;
        break; // any pages after a short one don't need fetching — that was the last page of real data
      }
    }

    if (hitShortPage) break;
    page += BATCH_SIZE;
  }

  busStopCache = { data: all, fetchedAt: Date.now() };
  console.log(`[nearby-bus] cached ${all.length} bus stops`);
  return all;
}

// Called once when the server starts, so the (slow, multi-request) first
// fetch of each stop list happens in the background well before any real
// visitor's request depends on it, rather than a live page load risking
// a proxy-level timeout while it happens synchronously.
export async function warmNearbyStopCaches(): Promise<void> {
  try {
    await Promise.all([getAllTrainStops(), getAllBusStops()]);
    console.log("[nearby] stop caches warmed on startup");
  } catch (err) {
    // Not fatal — the caches will just populate lazily on first real
    // request instead, same as before this existed.
    console.error("[nearby] failed to warm stop caches on startup", err);
  }
}

export async function findNearbyStations(lat: number, lon: number, radiusMetres = 1000): Promise<TflNearbyStopPoint[]> {
  const allStops = await getAllTrainStops();

  return allStops
    .filter((s) => s.lat != null && s.lon != null)
    .map((s) => ({ ...s, distance: haversineMetres(lat, lon, s.lat as number, s.lon as number) }))
    .filter((s) => (s.distance ?? Infinity) <= radiusMetres)
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

export async function findNearbyBusStops(lat: number, lon: number, radiusMetres = 500): Promise<TflNearbyStopPoint[]> {
  const allStops = await getAllBusStops();

  return allStops
    .filter((s) => s.lat != null && s.lon != null)
    .map((s) => ({ ...s, distance: haversineMetres(lat, lon, s.lat as number, s.lon as number) }))
    .filter((s) => (s.distance ?? Infinity) <= radiusMetres)
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}


// Some large interchange stations (Stratford, Bank/Monument, others) are
// split across several separate StopPoint ids in TfL's data, each
// covering only some of the lines at that station, with a shared
// hubNaptanCode linking them together. This resolves to that hub id when
// one exists, so arrivals cover the whole station rather than whichever
// single fragment happened to be selected. Falls back to the original id
// if the lookup fails or there's no hub — never worse than before.
async function fetchStopPointDetail(id: string): Promise<TflStopPointDetail | null> {
  const url = new URL(`${TFL_BASE_URL}/StopPoint/${encodeURIComponent(id)}`);
  appendAppKey(url);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    return (await res.json()) as TflStopPointDetail;
  } catch {
    return null;
  }
}

async function fetchArrivalsForId(id: string): Promise<TflArrivalPrediction[]> {
  const url = new URL(`${TFL_BASE_URL}/StopPoint/${encodeURIComponent(id)}/Arrivals`);
  appendAppKey(url);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`TfL arrivals request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as TflArrivalPrediction[];
}

// Live "next train" predictions for a specific station, ordered soonest
// first.
//
// Large multi-line interchanges (Stratford, Bank, etc.) are often split
// across several separate StopPoint ids in TfL's data, each covering only
// some of the lines. Querying the shared hub id directly returns nothing
// — a hub is a grouping concept, not a real place trains arrive at — so
// this instead fetches the hub's child stations and merges arrivals
// across all of them, which is where the actual per-line data lives.
export async function getArrivals(stationId: string): Promise<TflArrivalPrediction[]> {
  const detail = await fetchStopPointDetail(stationId);
  const hubId = detail?.hubNaptanCode;

  if (!hubId) {
    console.log(`[arrivals] ${stationId} has no hub, querying directly`);
    return (await fetchArrivalsForId(stationId)).sort((a, b) => a.timeToStation - b.timeToStation);
  }

  const hubDetail = await fetchStopPointDetail(hubId);
  const children = hubDetail?.children ?? [];
  console.log(`[arrivals] ${stationId} -> hub ${hubId} -> ${children.length} children`);

  if (children.length === 0) {
    // No children found — fall back to the original id rather than
    // returning nothing.
    console.log(`[arrivals] no children found for hub ${hubId}, falling back to ${stationId}`);
    return (await fetchArrivalsForId(stationId)).sort((a, b) => a.timeToStation - b.timeToStation);
  }

  const results = await Promise.allSettled(children.map((c) => fetchArrivalsForId(c.id)));
  const merged: TflArrivalPrediction[] = [];
  const seenIds = new Set<string>();

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const prediction of result.value) {
      // Different children can report the same physical train (shared
      // platforms), so dedupe by prediction id rather than trusting each
      // child's list to be independent.
      if (seenIds.has(prediction.id)) continue;
      seenIds.add(prediction.id);
      merged.push(prediction);
    }
  }

  console.log(`[arrivals] merged ${merged.length} predictions across ${children.length} children for hub ${hubId}`);
  return merged.sort((a, b) => a.timeToStation - b.timeToStation);
}

// Full ordered list of stations served by a line, e.g. for building a
// dedicated per-line page. TfL's own forum threads note the ordering
// from this endpoint isn't always perfectly reliable for branching lines,
// so treat the order as a reasonable guide rather than guaranteed exact.
export async function getLineStopPoints(lineId: string): Promise<TflLineStopPoint[]> {
  const url = new URL(`${TFL_BASE_URL}/Line/${encodeURIComponent(lineId)}/StopPoints`);
  appendAppKey(url);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`TfL line stop points request failed: ${res.status} ${res.statusText}`);
  }

  const stopPoints = (await res.json()) as TflLineStopPoint[];
  return stopPoints.map((s) => ({ id: s.id, commonName: s.commonName, lat: s.lat, lon: s.lon }));
}

export interface LineBranch {
  name: string;
  stations: { id: string; name: string }[];
}

// Full branch structure for a line, e.g. Central line's "Ealing Broadway
// <-> Epping" and "West Ruislip <-> Hainault" branches, each with its
// stations in real physical order start to finish. Confirmed against
// several independent real examples: the endpoint is
// /Line/{id}/Route/Sequence/{direction}, and the reliable part of its
// response is orderedLineRoutes (a name plus an ordered list of station
// ids per branch). A different part of the same response,
// stopPointSequences, has been reported on TfL's own forum as not
// reliably lining up by index with orderedLineRoutes — so rather than
// trust that part for station names, this looks names up from
// getLineStopPoints above instead, which is already proven reliable
// elsewhere in this app.
export async function getLineBranches(lineId: string): Promise<LineBranch[]> {
  const url = new URL(`${TFL_BASE_URL}/Line/${encodeURIComponent(lineId)}/Route/Sequence/outbound`);
  appendAppKey(url);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`TfL line route sequence request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { orderedLineRoutes?: { name: string; naptanIds: string[] }[] };
  const routes = data.orderedLineRoutes ?? [];

  const allStops = await getLineStopPoints(lineId);
  const nameById = new Map(allStops.map((s) => [s.id, s.commonName]));

  return routes.map((route) => ({
    name: route.name,
    stations: route.naptanIds.map((id) => ({ id, name: nameById.get(id) ?? id })),
  }));
}

// Searches for bus stops by name, kept entirely separate from
// searchStations (train modes) since the two are deliberately different
// sections of the app. Arrivals themselves reuse the existing
// getArrivals function unchanged, since that endpoint isn't mode specific
// — it returns whatever's predicted for the given stop id regardless of
// whether it's a train station or a bus stop.
export async function searchBusStops(query: string): Promise<TflStopPointMatch[]> {
  const url = new URL(`${TFL_BASE_URL}/StopPoint/Search/${encodeURIComponent(query)}`);
  url.searchParams.set("modesFilter", "bus");
  appendAppKey(url);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`TfL bus stop search failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as TflStopPointSearchResponse;
  // Confirmed against a live response: combined interchange hubs (e.g.
  // covering tube, bus, and national rail together at one location) also
  // include "bus" in their modes list, but aren't an actual individual
  // bus stop and have no direction info. Genuine bus stops only ever have
  // "bus" as their sole mode, so filtering on that excludes the hub
  // entries that were causing missing "towards" data.
  return data.matches.filter((m) => m.modes.length === 1 && m.modes[0] === "bus");
}

// Enriches a bus stop search result with its stop letter — only available
// on the full StopPoint detail, not the lightweight search response, so
// this is a second call per result. Confirmed against a live response:
// the field is genuinely called "stopLetter" on the full detail.
function extractTowards(props?: TflAdditionalProperty[]): string | undefined {
  return props?.find((p) => p.category === "Direction" && p.key === "Towards")?.value;
}

export interface ResolvedBusStop {
  id: string;
  name: string;
  stopLetter?: string;
  towards?: string;
}

// Resolves one bus stop search result into one or more real, individually
// selectable stops. Confirmed against a live response: TfL's search
// sometimes returns a grouped parent id covering several real physical
// stops (e.g. both directions of a stop pair), and the stop letter and
// direction only exist on the children underneath that parent, never on
// the parent itself — asking the parent directly for this data silently
// returns nothing, which is what an earlier, narrower version of this
// function was doing wrong. If the id turns out to already be an
// individual stop with no children, this just returns that one stop's own
// details instead.
export async function resolveBusStopDetails(id: string): Promise<ResolvedBusStop[]> {
  const url = new URL(`${TFL_BASE_URL}/StopPoint/${encodeURIComponent(id)}`);
  appendAppKey(url);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.log(`[bus] detail lookup for ${id} failed: ${res.status}`);
      return [];
    }

    const detail = (await res.json()) as TflStopPointDetail;

    if (detail.children && detail.children.length > 0) {
      console.log(`[bus] ${id} is a grouped parent with ${detail.children.length} children`);
      return detail.children.map((child) => ({
        id: child.id,
        name: child.commonName ?? detail.commonName ?? id,
        stopLetter: child.stopLetter,
        towards: extractTowards(child.additionalProperties),
      }));
    }

    return [
      {
        id: detail.id,
        name: detail.commonName ?? id,
        stopLetter: detail.stopLetter,
        towards: extractTowards(detail.additionalProperties),
      },
    ];
  } catch (err) {
    console.log(`[bus] detail lookup for ${id} threw`, err);
    return [];
  }
}
