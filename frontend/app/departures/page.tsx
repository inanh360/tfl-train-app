"use client";

import { useEffect, useState, useCallback } from "react";
import { api, type ArrivalPrediction, type StationMatch } from "@/lib/api";
import { StationAutocomplete } from "@/components/StationAutocomplete";

const REFRESH_MS = 20_000; // live predictions shift quickly, refresh often

export default function DeparturesPage() {
  const [station, setStation] = useState<StationMatch | null>(null);
  const [arrivals, setArrivals] = useState<ArrivalPrediction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (s: StationMatch) => {
    try {
      const data = await api.getArrivals(s.id);
      setArrivals(data.sort((a, b) => a.secondsAway - b.secondsAway));
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load live arrivals");
    }
  }, []);

  useEffect(() => {
    if (!station) return;
    load(station);
    const interval = setInterval(() => load(station), REFRESH_MS);
    return () => clearInterval(interval);
  }, [station, load]);

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 16 }}>
        LIVE DEPARTURES
      </h1>

      <div style={{ marginBottom: 20 }}>
        <StationAutocomplete
          label="Station"
          value={station}
          onSelect={(s) => {
            setStation(s);
            setArrivals(null);
          }}
        />
      </div>

      {!station && (
        <p style={{ fontSize: 13, color: "var(--text-dim)" }}>Search for a station to see live next-train times.</p>
      )}

      {station && error && (
        <div style={{ border: "1px solid var(--red)", borderRadius: "var(--radius)", padding: 16 }}>
          <p style={{ margin: 0, color: "var(--red)", fontSize: 13 }}>{error}</p>
        </div>
      )}

      {station && !error && !arrivals && (
        <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)", fontSize: 13 }}>Loading…</p>
      )}

      {station && arrivals && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{station.name}</span>
            {lastUpdated && (
              <span style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--text-dim)" }}>
                updated {lastUpdated.toLocaleTimeString("en-GB")}
              </span>
            )}
          </div>

          {arrivals.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-dim)" }}>No live predictions right now.</p>
          ) : (
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
              {arrivals.map((train, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--bg-raised)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 18,
                      fontWeight: 600,
                      color: train.minutesAway <= 1 ? "var(--warning)" : "var(--text)",
                      minWidth: 44,
                    }}
                  >
                    {train.minutesAway <= 0 ? "Due" : `${train.minutesAway}m`}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{train.line}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      to {train.destination}
                      {train.platform && ` · Platform ${train.platform}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
