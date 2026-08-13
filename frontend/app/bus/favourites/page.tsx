"use client";

import { useEffect, useState, useCallback } from "react";
import { api, type Favourite, type BusTime } from "@/lib/api";

export default function BusFavouritesPage() {
  const [favourites, setFavourites] = useState<Favourite[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getFavourites();
      setFavourites(data.filter((f) => f.favouriteType === "BUS_STOP"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load favourites");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function removeFavourite(id: string) {
    await api.removeFavourite(id);
    load();
  }

  if (error) {
    return <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>;
  }

  if (!favourites) {
    return <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)", fontSize: 13 }}>Loading…</p>;
  }

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 16 }}>
        BUS FAVOURITES
      </h1>

      {favourites.length === 0 ? (
        <div style={{ border: "1px dashed var(--border)", borderRadius: "var(--radius)", padding: 20, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>
            No favourite bus stops yet. Star a stop on the live bus times page to save it here.
          </p>
        </div>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          {favourites.map((fav) => (
            <BusStopFavouriteRow key={fav.id} favourite={fav} onRemove={() => removeFavourite(fav.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function BusStopFavouriteRow({ favourite, onRemove }: { favourite: Favourite; onRemove: () => void }) {
  const [times, setTimes] = useState<BusTime[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .getBusTimes(favourite.refId)
      .then((data) => setTimes(data.sort((a, b) => a.secondsAway - b.secondsAway).slice(0, 3)))
      .catch(() => setError(true));
  }, [favourite.refId]);

  return (
    <div
      style={{
        padding: "12px 14px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-raised)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{favourite.refLabel}</div>
        <button
          onClick={onRemove}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "5px 10px",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Remove
        </button>
      </div>

      {error && <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>Couldn&apos;t load live times.</p>}
      {!error && !times && (
        <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0, fontFamily: "var(--font-display)" }}>Loading…</p>
      )}
      {times && times.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>No live predictions right now.</p>
      )}
      {times && times.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {times.map((bus, i) => (
            <div key={i} style={{ fontSize: 12, display: "flex", gap: 8 }}>
              <span style={{ color: bus.minutesAway <= 1 ? "var(--warning)" : "var(--text-dim)", minWidth: 32 }}>
                {bus.minutesAway <= 0 ? "Due" : `${bus.minutesAway}m`}
              </span>
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
