"use client";

import { useEffect, useState, useCallback } from "react";
import { api, type Line, type Favourite, type ArrivalPrediction } from "@/lib/api";
import { LineRow, severityRank } from "@/components/LineRow";

export default function FavouritesPage() {
  const [lines, setLines] = useState<Line[] | null>(null);
  const [favourites, setFavourites] = useState<Favourite[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [linesData, favouritesData] = await Promise.all([api.getLines(), api.getFavourites()]);
      setLines(linesData);
      setFavourites(favouritesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load favourites");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFavourite(line: Line) {
    const existing = favourites?.find((f) => f.favouriteType === "LINE" && f.refId === line.id);
    if (existing) {
      await api.removeFavourite(existing.id);
    } else {
      await api.addFavourite({ favouriteType: "LINE", refId: line.id, refLabel: line.name });
    }
    load();
  }

  async function removeStationFavourite(id: string) {
    await api.removeFavourite(id);
    load();
  }

  if (error) {
    return <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>;
  }

  if (!lines || !favourites) {
    return <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)", fontSize: 13 }}>Loading…</p>;
  }

  const favouriteLineIds = new Set(favourites.filter((f) => f.favouriteType === "LINE").map((f) => f.refId));
  const favouriteLines = lines
    .filter((line) => favouriteLineIds.has(line.id))
    .sort((a, b) => severityRank(a) - severityRank(b));
  const favouriteStations = favourites.filter((f) => f.favouriteType === "STATION");

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 16 }}>
        FAVOURITES
      </h1>

      {favouriteLines.length === 0 && favouriteStations.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {favouriteStations.length > 0 && (
            <div style={{ marginBottom: favouriteLines.length > 0 ? 24 : 0 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--text-dim)", fontWeight: 500, marginBottom: 8 }}>
                STATIONS
              </h2>
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                {favouriteStations.map((fav) => (
                  <StationFavouriteRow key={fav.id} favourite={fav} onRemove={() => removeStationFavourite(fav.id)} />
                ))}
              </div>
            </div>
          )}

          {favouriteLines.length > 0 && (
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
              {favouriteLines.map((line) => (
                <LineRow key={line.id} line={line} isFavourite={true} onToggleFavourite={() => toggleFavourite(line)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StationFavouriteRow({ favourite, onRemove }: { favourite: Favourite; onRemove: () => void }) {
  const [arrivals, setArrivals] = useState<ArrivalPrediction[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .getArrivals(favourite.refId)
      .then((data) => setArrivals(data.sort((a, b) => a.secondsAway - b.secondsAway).slice(0, 3)))
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
      {!error && !arrivals && (
        <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0, fontFamily: "var(--font-display)" }}>Loading…</p>
      )}
      {arrivals && arrivals.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>No live predictions right now.</p>
      )}
      {arrivals && arrivals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {arrivals.map((train, i) => (
            <div key={i} style={{ fontSize: 12, display: "flex", gap: 8 }}>
              <span style={{ color: train.minutesAway <= 1 ? "var(--warning)" : "var(--text-dim)", minWidth: 32 }}>
                {train.minutesAway <= 0 ? "Due" : `${train.minutesAway}m`}
              </span>
              <span>
                {train.line} to {train.destination}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ border: "1px dashed var(--border)", borderRadius: "var(--radius)", padding: 20, textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>
        No favourites yet. Star a line on the status board to get alerted when it&apos;s disrupted.
      </p>
    </div>
  );
}
