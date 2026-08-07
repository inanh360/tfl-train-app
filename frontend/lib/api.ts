import { supabase } from "./supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${body}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

// --- Types matching the backend's response shapes ---

export interface AffectedStation {
  id: string;
  stationName: string;
  naptanId: string | null;
}

export interface LineStatusEvent {
  id: string;
  statusSeverity: number;
  statusDescription: string;
  reason: string | null;
  branchLabel: string | null;
  isActive: boolean;
  startedAt: string;
  affectedStations: AffectedStation[];
}

export interface Line {
  id: string;
  name: string;
  modeName: string;
  colourHex: string;
  statusEvents: LineStatusEvent[];
}

export interface Favourite {
  id: string;
  favouriteType: "LINE" | "STATION";
  refId: string;
  refLabel: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  message: string;
  colourHex: string;
  read: boolean;
  createdAt: string;
}

export interface StationMatch {
  id: string;
  name: string;
  modes: string[];
}

export interface NearbyTrain {
  line: string;
  destination: string;
  minutesAway: number;
}

export interface NearbyStation {
  id: string;
  name: string;
  distanceMetres: number | null;
  walkMinutes: number;
  nextTrains: NearbyTrain[];
  bestReachableMinutes: number | null;
}

export interface NearbyResult {
  stations: NearbyStation[];
  bestStationId: string | null;
}

export interface JourneyLeg {
  mode: string;
  line: string;
  summary: string;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  isDisrupted: boolean;
}

export interface Journey {
  startTime: string;
  arrivalTime: string;
  durationMinutes: number;
  legs: JourneyLeg[];
}

// --- API calls ---

export const api = {
  getLines: () => request<Line[]>("/lines"),

  getFavourites: () => request<Favourite[]>("/favourites"),
  addFavourite: (body: { favouriteType: "LINE" | "STATION"; refId: string; refLabel: string }) =>
    request<Favourite>("/favourites", { method: "POST", body: JSON.stringify(body) }),
  removeFavourite: (id: string) => request<void>(`/favourites/${id}`, { method: "DELETE" }),

  deleteAccount: () => request<void>("/account", { method: "DELETE" }),

  getNotifications: () => request<Notification[]>("/notifications"),
  markNotificationRead: (id: string) => request<void>(`/notifications/${id}/read`, { method: "POST" }),

  searchStations: (query: string) => request<StationMatch[]>(`/stations/search?q=${encodeURIComponent(query)}`),
  planJourney: (from: string, to: string) =>
    request<{ journeys: Journey[] }>(`/journey?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),

  getNearbyStations: (lat: number, lon: number) =>
    request<NearbyResult>(`/nearby?lat=${lat}&lon=${lon}`),
};
