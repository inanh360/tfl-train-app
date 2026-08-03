"use client";

import { useEffect, useState } from "react";
import { api, type Favourite } from "@/lib/api";

export default function FavouritesPage() {
  const [favourites, setFavourites] = useState<Favourite[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getFavourites()
      .then(setFavourites)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load favourites"));
  }, []);

  async function remove(id: string) {
    await api.removeFavourite(id);
    setFavourites((prev) => prev?.filter((f) => f.id !== id) ?? null);
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
        FAVOURITES
      </h1>

      {favourites.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          {favourites.map((fav) => (
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
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{fav.refLabel}</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-display)", textTransform: "uppercase" }}>
                  {fav.favouriteType}
                </div>
              </div>
              <button
                onClick={() => remove(fav.id)}
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
