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
  // For bus stops specifically — confirmed against a live TfL response,
  // this is what actually disambiguates multiple stops sharing one
  // station name, e.g. "Angel Or Kings Cross" vs "Blackfriars Or
  // Waterloo" for two different "Farringdon Station" bus stops. An
  // earlier attempt guessed a field called "indicator" here, which
  // turned out not to exist in the real response at all.
  towards?: string;
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

// TfL returns HTTP 300 (not a real error) when a location — often a hub id
// like Bank/Monument's "HUBBAN" — is ambiguous, along with a real JSON body
// listing candidate matches instead of journeys. TfL's own field naming
// isn't fully consistent across API versions, so this covers both known
// shapes (matches vs disambiguationOptions, id vs parameterValue).
export interface TflDisambiguationOption {
  id?: string;
  parameterValue?: string;
  name: string;
}

export interface TflDisambiguationSide {
  matches?: TflDisambiguationOption[];
  disambiguationOptions?: TflDisambiguationOption[];
}

export interface TflDisambiguationResult {
  journeys: TflJourney[];
  fromLocationDisambiguation?: TflDisambiguationSide;
  toLocationDisambiguation?: TflDisambiguationSide;
}

// --- Nearby stations ---

export interface TflNearbyStopPoint {
  id: string;
  commonName: string;
  lat: number;
  lon: number;
  modes: string[];
  // Only present when includeDistances=true is passed. Documented as
  // metres from the query point, but TfL's own forum threads note the
  // input lat/lon gets truncated to 3 decimal places internally, so
  // treat this as an approximation, not survey-accurate.
  distance?: number;
}

// TfL's wrapper shape for this endpoint isn't confirmed against a live
// response (repeated attempts to verify returned errors unrelated to the
// app itself) — coded to accept either a bare array or a { stopPoints:
// [...] } wrapper, since other TfL endpoints use both patterns depending
// on the resource.
export type TflNearbyStopPointResponse = TflNearbyStopPoint[] | { stopPoints: TflNearbyStopPoint[] };

// --- Live arrivals ---

export interface TflArrivalPrediction {
  id: string;
  lineId: string;
  lineName: string;
  stationName: string;
  platformName: string;
  direction: string;
  destinationName: string;
  timeToStation: number; // seconds
  timestamp: string;
}

export interface TflAdditionalProperty {
  category: string;
  key: string;
  value: string;
}

// A StopPoint's own details. For a hub-type StopPoint specifically, this
// should include its constituent child stations — each a real, separately
// queryable StopPoint that arrivals data actually attaches to, unlike the
// hub id itself. The same "parent groups several real children" shape
// also applies to bus stop pairs specifically — confirmed against a live
// response, the stop letter and direction only exist on the children,
// never on the parent grouping.
export interface TflStopPointDetail {
  id: string;
  commonName?: string;
  hubNaptanCode?: string;
  indicator?: string;
  stopLetter?: string;
  additionalProperties?: TflAdditionalProperty[];
  children?: TflStopPointDetail[];
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

export interface TflLineStopPoint {
  id: string;
  commonName: string;
  lat?: number;
  lon?: number;
}
