// Minimal typing for TfL's /Line/Mode/{modes}/Status response.
// We only type the fields we actually read — the real payload has more
// ($type, routeSections, serviceTypes, crowding, etc.) that we ignore.

export interface TflAffectedStop {
  name?: string;
  naptanId?: string;
}

// TfL populates this with branch/route sections for some disruptions (e.g.
// "Hainault via Newbury Park" on the Central line) but leaves it empty for
// most — there's no guarantee it's populated, so treat it as a bonus field.
export interface TflAffectedRoute {
  name?: string;
  routeCode?: string;
}

export interface TflDisruption {
  category: string;
  categoryDescription: string;
  description: string;
  affectedRoutes: TflAffectedRoute[];
  affectedStops: TflAffectedStop[];
  closureText: string;
}

export interface TflValidityPeriod {
  fromDate: string;
  toDate: string;
  isNow: boolean;
}

export interface TflLineStatus {
  id: number;
  statusSeverity: number;
  statusSeverityDescription: string;
  reason?: string;
  validityPeriods: TflValidityPeriod[];
  disruption?: TflDisruption;
}

export interface TflLine {
  id: string;
  name: string;
  modeName: string;
  lineStatuses: TflLineStatus[];
}

// --- StopPoint search ---

export interface TflStopPointMatch {
  id: string;
  name: string;
  modes: string[];
  lat?: number;
  lon?: number;
}

export interface TflStopPointSearchResponse {
  query: string;
  total: number;
  matches: TflStopPointMatch[];
}

// --- Journey planner (minimal slice we actually use) ---

export interface TflJourneyStopPoint {
  naptanId: string;
  commonName: string;
}

export interface TflJourneyLine {
  id: string;
  name: string;
}

export interface TflJourneyLeg {
  duration: number; // minutes
  instruction: { summary: string };
  departureTime: string;
  arrivalTime: string;
  departurePoint: TflJourneyStopPoint;
  arrivalPoint: TflJourneyStopPoint;
  mode: { id: string; name: string };
  isDisrupted: boolean;
  routeOptions: { lineIdentifier?: TflJourneyLine }[];
}

export interface TflJourney {
  startDateTime: string;
  arrivalDateTime: string;
  duration: number; // minutes
  legs: TflJourneyLeg[];
}

export interface TflJourneyResult {
  journeys: TflJourney[];
}

// Normalised shape we actually work with internally, one row per
// (line, status) pair — flattens the array-of-statuses-per-line quirk
// mentioned in the TfL forum thread into something easy to diff against DB rows.
export interface NormalisedLineStatus {
  lineId: string;
  lineName: string;
  modeName: string;
  statusSeverity: number;
  statusDescription: string;
  reason: string | null;
  // Best-effort branch identifier, e.g. "Hainault via Newbury Park".
  // Populated from TfL's affectedRoutes when present; null otherwise —
  // TfL doesn't guarantee this field is filled in for every disruption.
  branchLabel: string | null;
  affectedStations: { name: string; naptanId: string | null }[];
}
