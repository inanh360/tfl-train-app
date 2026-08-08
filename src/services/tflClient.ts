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
export async function findNearbyStations(lat: number, lon: number, radiusMetres = 1000): Promise<TflNearbyStopPoint[]> {
  const url = new URL(`${TFL_BASE_URL}/StopPoint`);
  // TfL's actual operation for this is StopPoint_GetByGeoPoint, which per
  // its generated API client uses dotted param names (location.lat /
  // location.lon) rather than the plain lat/lon that appears in several
  // older community examples — those plain names repeatedly 404d against
  // the live API while building this.
  url.searchParams.set("location.lat", String(lat));
  url.searchParams.set("location.lon", String(lon));
  url.searchParams.set("radius", String(radiusMetres));
  url.searchParams.set("stopTypes", "NaptanMetroStation,NaptanRailStation,NaptanDlrStation");
  url.searchParams.set("includeDistances", "true");
  url.searchParams.set("useStopPointHierarchy", "true");
  appendAppKey(url);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TfL nearby stations request failed: ${res.status} ${res.statusText} — ${body}`);
  }

  const data = (await res.json()) as TflNearbyStopPointResponse;
  const stopPoints = Array.isArray(data) ? data : data.stopPoints;

  return stopPoints
    .filter((s) => s.modes.some((mode) => (TRAIN_MODES as readonly string[]).includes(mode)))
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

// Some large interchange stations (Stratford, Bank/Monument, others) are
// split across several separate StopPoint ids in TfL's data, each
// covering only some of the lines at that station, with a shared
// hubNaptanCode linking them together. This resolves to that hub id when
// one exists, so arrivals cover the whole station rather than whichever
// single fragment happened to be selected. Falls back to the original id
// if the lookup fails or there's no hub — never worse than before.
async function resolveToHubId(stationId: string): Promise<string> {
  const url = new URL(`${TFL_BASE_URL}/StopPoint/${encodeURIComponent(stationId)}`);
  appendAppKey(url);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return stationId;
    const detail = (await res.json()) as TflStopPointDetail;
    return detail.hubNaptanCode ?? stationId;
  } catch {
    return stationId;
  }
}

// Live "next train" predictions for a specific station, ordered soonest
// first.
export async function getArrivals(stationId: string): Promise<TflArrivalPrediction[]> {
  const resolvedId = await resolveToHubId(stationId);

  const url = new URL(`${TFL_BASE_URL}/StopPoint/${encodeURIComponent(resolvedId)}/Arrivals`);
  appendAppKey(url);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`TfL arrivals request failed: ${res.status} ${res.statusText}`);
  }

  const predictions = (await res.json()) as TflArrivalPrediction[];
  return predictions.sort((a, b) => a.timeToStation - b.timeToStation);
}
