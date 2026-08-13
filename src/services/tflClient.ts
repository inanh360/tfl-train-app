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

export async function findNearbyStations(lat: number, lon: number, radiusMetres = 1000): Promise<TflNearbyStopPoint[]> {
  // The correct endpoint for this turned out to be /Place (Place_GetByGeo),
  // not /StopPoint — an earlier attempt on /StopPoint with several
  // different parameter name variants (lat/lon, location.lat/location.lon)
  // all 404d. TfL's own current OpenAPI spec documents /Place for this,
  // and a direct answer on TfL's forum to someone hitting the exact same
  // 404 confirmed the working parameter names are plain "lat"/"lon", not
  // the "placeGeo.lat"/"placeGeo.lon" the same spec's schema names
  // suggest — the spec's path was right, its exact param naming here
  // was stale.
  const url = new URL(`${TFL_BASE_URL}/Place`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("radius", String(radiusMetres));
  // "NaptanDlrStation" was explicitly rejected by this endpoint with a 400
  // ("place types are not recognised"), even though it's a valid stopType
  // elsewhere in the API — /Place evidently uses a narrower type
  // vocabulary than /StopPoint does. DLR stations may or may not still
  // appear here under NaptanMetroStation depending on how TfL classifies
  // them internally — worth confirming against real results before
  // assuming DLR is fully covered.
  url.searchParams.set("type", "NaptanMetroStation,NaptanRailStation");
  appendAppKey(url);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TfL nearby stations request failed: ${res.status} ${res.statusText} — ${body}`);
  }

  const data = await res.json();
  // Confirmed against a live response: /Place wraps results as
  // { places: [...] }, not { stopPoints: [...] } as originally guessed
  // and not a bare array as the OpenAPI spec's schema implied either.
  const stopPoints: TflNearbyStopPoint[] = (data as { places?: TflNearbyStopPoint[] })?.places ?? [];
  console.log(`[nearby] TfL returned ${stopPoints.length} raw places before filtering`);

  return stopPoints
    .filter((s) => s.modes.some((mode) => (TRAIN_MODES as readonly string[]).includes(mode)))
    .map((s) => ({
      ...s,
      distance: s.lat != null && s.lon != null ? haversineMetres(lat, lon, s.lat, s.lon) : s.distance,
    }))
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

// Bus equivalent of findNearbyStations above, kept as its own separate
// function rather than sharing one with a mode parameter, matching how
// the rest of the bus section is deliberately kept apart from the train
// code throughout this app. "NaptanPublicBusCoachTram" is confirmed as a
// real value against a live TfL response elsewhere in this codebase (the
// bus stop letter lookup), but that was confirmed as a stopType on
// /StopPoint, not specifically as a type value on /Place — /Place has
// already been found to use a narrower, different type vocabulary than
// /StopPoint once (it rejected "NaptanDlrStation"), so this specific
// value is a reasonable extension of what's confirmed, not a fully
// verified one. If it's rejected the same way, the error TfL sends back
// names exactly which value it doesn't recognise, same as it did last
// time.
export async function findNearbyBusStops(lat: number, lon: number, radiusMetres = 500): Promise<TflNearbyStopPoint[]> {
  const url = new URL(`${TFL_BASE_URL}/Place`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("radius", String(radiusMetres));
  url.searchParams.set("type", "NaptanPublicBusCoachTram");
  appendAppKey(url);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TfL nearby bus stops request failed: ${res.status} ${res.statusText} — ${body}`);
  }

  const data = await res.json();
  const stopPoints: TflNearbyStopPoint[] = (data as { places?: TflNearbyStopPoint[] })?.places ?? [];
  console.log(`[nearby-bus] TfL returned ${stopPoints.length} raw places before filtering`);

  return stopPoints
    .filter((s) => s.modes.includes("bus"))
    .map((s) => ({
      ...s,
      distance: s.lat != null && s.lon != null ? haversineMetres(lat, lon, s.lat, s.lon) : s.distance,
    }))
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
