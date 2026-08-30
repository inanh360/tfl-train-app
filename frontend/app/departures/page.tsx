"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, type ArrivalPrediction, type StationMatch, type Favourite } from "@/lib/api";
import { StationAutocomplete } from "@/components/StationAutocomplete";
import { useAuth } from "@/lib/auth-context";

const REFRESH_MS = 20_000; // live predictions shift quickly, refresh often

export default function DeparturesPage() {
  const { session } = useAuth();
  const [station, setStation] = useState<StationMatch | null>(null);
  const [arrivals, setArrivals] = useState<ArrivalPrediction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [favourites, setFavourites] = useState<Favourite[]>([]);

  const loadFavourites = useCallback(async () => {
    if (!session) return;
    try {
      const data = await api.getFavourites();
      setFavourites(data.filter((f) => f.favouriteType === "STATION"));
    } catch {
      // Quietly ignore, favourites are a convenience here, not essential
      // to the page working.
    }
  }, [session]);

  useEffect(() => {
    loadFavourites();
  }, [loadFavourites]);

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

  const currentFavourite = favourites.find((f) => f.refId === station?.id);

  async function toggleFavourite() {
    if (!station || !session) return;
    if (currentFavourite) {
      await api.removeFavourite(currentFavourite.id);
    } else {
      await api.addFavourite({ favouriteType: "STATION", refId: station.id, refLabel: station.name });
    }
    loadFavourites();
  }

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 16 }}>
        LIVE DEPARTURES
      </h1>

      {favourites.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", marginBottom: 6, fontFamily: "var(--font-display)" }}>
            QUICK PICK
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {favourites.map((fav) => (
              <button
                key={fav.id}
                onClick={() => {
                  setStation({ id: fav.refId, name: fav.refLabel, modes: [] });
                  setArrivals(null);
                }}
                style={{
                  padding: "6px 12px",
                  background: station?.id === fav.refId ? "var(--primary)" : "var(--bg-raised)",
                  color: station?.id === fav.refId ? "#fff" : "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {fav.refLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <StationAutocomplete
          label="Or search a station"
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link
                href={`/station/${encodeURIComponent(station.id)}`}
                style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", textDecoration: "none" }}
              >
                {station.name}
              </Link>
              {session && (
                <button
                  onClick={toggleFavourite}
                  aria-label={currentFavourite ? `Remove ${station.name} from favourites` : `Favourite ${station.name}`}
                  aria-pressed={!!currentFavourite}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 16,
                    color: currentFavourite ? "var(--primary)" : "var(--border)",
                    padding: 10,
                    minWidth: 44,
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ★
                </button>
              )}
            </div>
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
