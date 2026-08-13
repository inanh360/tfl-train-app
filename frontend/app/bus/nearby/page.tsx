"use client";

import { useState } from "react";
import { api, type NearbyBusResult } from "@/lib/api";

type LoadState = "idle" | "locating" | "loading" | "done" | "error";

export default function BusNearbyPage() {
  const [state, setState] = useState<LoadState>("idle");
  const [result, setResult] = useState<NearbyBusResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function findNearby() {
    if (!navigator.geolocation) {
      setState("error");
      setError("Your browser doesn't support location access.");
      return;
    }

    setState("locating");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setState("loading");
        try {
          const data = await api.getNearbyBusStops(position.coords.latitude, position.coords.longitude);
          setResult(data);
          setState("done");
        } catch (err) {
          setState("error");
          setError(err instanceof Error ? err.message : "Failed to load nearby bus stops");
        }
      },
      (geoError) => {
        setState("error");
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location access was denied. Allow location access in your browser to use this."
            : "Couldn't get your location. Try again."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 16 }}>
        NEAREST BUS STOPS
      </h1>

      {state === "idle" && (
        <div style={{ border: "1px dashed var(--border)", borderRadius: "var(--radius)", padding: 20, textAlign: "center" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-dim)" }}>
            Find the nearest bus stops and the best one to head to right now.
          </p>
          <button
            onClick={findNearby}
            style={{
              padding: "10px 16px",
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Use my location
          </button>
        </div>
      )}

      {(state === "locating" || state === "loading") && (
        <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)", fontSize: 13 }}>
          {state === "locating" ? "Getting your location…" : "Finding nearby bus stops…"}
        </p>
      )}

      {state === "error" && (
        <div style={{ border: "1px solid var(--red)", borderRadius: "var(--radius)", padding: 16 }}>
          <p style={{ margin: "0 0 10px", color: "var(--red)", fontSize: 13 }}>{error}</p>
          <button
            onClick={findNearby}
            style={{
              background: "var(--bg-raised)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "6px 12px",
              color: "var(--text)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {state === "done" && result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {result.stops.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-dim)" }}>No bus stops found nearby.</p>
          )}
          {result.stops.map((stop) => (
            <StopCard key={stop.id} stop={stop} isBest={stop.id === result.bestStopId} />
          ))}
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
            Distances and walk times are estimates based on straight-line distance, not an actual walking route.
          </p>
        </div>
      )}
    </div>
  );
}

function StopCard({
  stop,
  isBest,
}: {
  stop: NearbyBusResult["stops"][number];
  isBest: boolean;
}) {
  return (
    <div
      style={{
        border: isBest ? "1px solid var(--primary)" : "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 14,
        background: "var(--bg-raised)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{stop.name}</span>
        {isBest && (
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-display)",
              color: "var(--primary)",
              border: "1px solid var(--primary)",
              borderRadius: 4,
              padding: "2px 6px",
            }}
          >
            BEST OPTION
          </span>
        )}
      </div>

      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>
        {stop.distanceMetres != null ? `${Math.round(stop.distanceMetres)}m` : "Distance unknown"} · ~
        {stop.walkMinutes} min walk
        {stop.bestReachableMinutes !== null && <> · catchable bus in {stop.bestReachableMinutes} min total</>}
      </div>

      {stop.lat != null && stop.lon != null && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lon}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            fontSize: 12,
            color: "var(--primary)",
            textDecoration: "none",
            marginBottom: 10,
          }}
        >
          Directions on Google Maps →
        </a>
      )}

      {stop.nextBuses.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>No live predictions right now.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {stop.nextBuses.map((bus, i) => (
            <div key={i} style={{ fontSize: 12, display: "flex", gap: 8 }}>
              <span style={{ color: "var(--text-dim)", minWidth: 32 }}>{bus.minutesAway}m</span>
              <span>
                Route {bus.route} to {bus.destination}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
