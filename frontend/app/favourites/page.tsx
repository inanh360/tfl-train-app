"use client";

import { useEffect, useState, useCallback } from "react";
import { api, type Line, type Favourite } from "@/lib/api";
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
          {favouriteLines.length > 0 && (
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", marginBottom: favouriteStations.length > 0 ? 24 : 0 }}>
              {favouriteLines.map((line) => (
                <LineRow key={line.id} line={line} isFavourite={true} onToggleFavourite={() => toggleFavourite(line)} />
              ))}
            </div>
          )}

          {favouriteStations.length > 0 && (
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--text-dim)", fontWeight: 500, marginBottom: 8 }}>
                STATIONS
              </h2>
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                {favouriteStations.map((fav) => (
                  <div
                    key={fav.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderBottom: "1px solid var(--border)",
                      background: "var(--bg-raised)",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{fav.refLabel}</div>
                    <button
                      onClick={() => removeStationFavourite(fav.id)}
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
                ))}
              </div>
            </div>
          )}
        </>
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
