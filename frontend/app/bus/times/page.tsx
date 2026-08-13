"use client";

import { useEffect, useState, useCallback } from "react";
import { api, type BusTime, type BusStopMatch, type Favourite } from "@/lib/api";
import { BusStopAutocomplete, busStopDisplayName } from "@/components/BusStopAutocomplete";
import { useAuth } from "@/lib/auth-context";

const REFRESH_MS = 20_000;

export default function BusTimesPage() {
  const { session } = useAuth();
  const [stop, setStop] = useState<BusStopMatch | null>(null);
  const [times, setTimes] = useState<BusTime[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [favourites, setFavourites] = useState<Favourite[]>([]);

  const loadFavourites = useCallback(async () => {
    if (!session) return;
    try {
      const data = await api.getFavourites();
      setFavourites(data.filter((f) => f.favouriteType === "BUS_STOP"));
    } catch {
      // Quietly ignore — favourites are a convenience here, not essential
      // to the page working.
    }
  }, [session]);

  useEffect(() => {
    loadFavourites();
  }, [loadFavourites]);

  const load = useCallback(async (s: BusStopMatch) => {
    try {
      const data = await api.getBusTimes(s.id);
      setTimes(data.sort((a, b) => a.secondsAway - b.secondsAway));
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load live bus times");
    }
  }, []);

  useEffect(() => {
    if (!stop) return;
    load(stop);
    const interval = setInterval(() => load(stop), REFRESH_MS);
    return () => clearInterval(interval);
  }, [stop, load]);

  const currentFavourite = favourites.find((f) => f.refId === stop?.id);

  async function toggleFavourite() {
    if (!stop || !session) return;
    if (currentFavourite) {
      await api.removeFavourite(currentFavourite.id);
    } else {
      await api.addFavourite({ favouriteType: "BUS_STOP", refId: stop.id, refLabel: busStopDisplayName(stop) });
    }
    loadFavourites();
  }

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 16 }}>
        LIVE BUS TIMES
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
                  setStop({ id: fav.refId, name: fav.refLabel });
                  setTimes(null);
                }}
                style={{
                  padding: "6px 12px",
                  background: stop?.id === fav.refId ? "var(--primary)" : "var(--bg-raised)",
                  color: stop?.id === fav.refId ? "#fff" : "var(--text)",
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
        <BusStopAutocomplete
          value={stop}
          onSelect={(s) => {
            setStop(s);
            setTimes(null);
          }}
        />
      </div>

      {!stop && <p style={{ fontSize: 13, color: "var(--text-dim)" }}>Search for a bus stop to see live next-bus times.</p>}

      {stop && error && (
        <div style={{ border: "1px solid var(--red)", borderRadius: "var(--radius)", padding: 16 }}>
          <p style={{ margin: 0, color: "var(--red)", fontSize: 13 }}>{error}</p>
        </div>
      )}

      {stop && !error && !times && (
        <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)", fontSize: 13 }}>Loading…</p>
      )}

      {stop && times && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{stop.name}</span>
              {session && (
                <button
                  onClick={toggleFavourite}
                  aria-label={currentFavourite ? `Remove ${stop.name} from favourites` : `Favourite ${stop.name}`}
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

          {times.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-dim)" }}>No live predictions right now.</p>
          ) : (
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
              {times.map((bus, i) => (
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
                      color: bus.minutesAway <= 1 ? "var(--warning)" : "var(--text)",
                      minWidth: 44,
                    }}
                  >
                    {bus.minutesAway <= 0 ? "Due" : `${bus.minutesAway}m`}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Route {bus.route}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>to {bus.destination}</div>
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
