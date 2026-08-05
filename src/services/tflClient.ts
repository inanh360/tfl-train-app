import type {
  TflLine,
  NormalisedLineStatus,
  TflStopPointSearchResponse,
  TflStopPointMatch,
  TflJourneyResult,
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

// Plans a journey between two StopPoint ids, restricted to train modes only
// (per the product decision to keep journeys single-mode rather than
// mixing in bus legs).
export async function planJourney(fromId: string, toId: string): Promise<TflJourneyResult> {
  const url = new URL(`${TFL_BASE_URL}/Journey/JourneyResults/${encodeURIComponent(fromId)}/to/${encodeURIComponent(toId)}`);
  url.searchParams.set("mode", TRAIN_MODES.join(","));
  appendAppKey(url);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`TfL journey planner request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as TflJourneyResult;
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
