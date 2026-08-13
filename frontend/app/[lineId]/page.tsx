"use client";

import { useEffect, useState, use } from "react";
import { api, type Line, type LineStation, type Favourite } from "@/lib/api";
import { StatusDot } from "@/components/StatusDot";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

export default function LinePage({ params }: { params: Promise<{ lineId: string }> }) {
  const { lineId } = use(params);
  const { session } = useAuth();
  const router = useRouter();

  const [line, setLine] = useState<Line | null>(null);
  const [stations, setStations] = useState<LineStation[] | null>(null);
  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api
      .getLine(lineId)
      .then(setLine)
      .catch(() => setNotFound(true));

    api.getLineStations(lineId).then(setStations).catch(() => setStations([]));

    if (session) {
      api
        .getFavourites()
        .then(setFavourites)
        .catch(() => {});
    }
  }, [lineId, session]);

  async function toggleFavourite() {
    if (!line) return;
    if (!session) {
      router.push("/login");
      return;
    }
    const existing = favourites.find((f) => f.favouriteType === "LINE" && f.refId === line.id);
    if (existing) {
      await api.removeFavourite(existing.id);
    } else {
      await api.addFavourite({ favouriteType: "LINE", refId: line.id, refLabel: line.name });
    }
    api.getFavourites().then(setFavourites);
  }

  if (notFound) {
    return (
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>No line found with that name.</p>
      </div>
    );
  }

  if (!line) {
    return <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)", fontSize: 13 }}>Loading…</p>;
  }

  const isFavourite = favourites.some((f) => f.favouriteType === "LINE" && f.refId === line.id);
  const activeEvents = line.statusEvents.filter((e) => e.isActive);
  const worst =
    activeEvents.length > 0 ? activeEvents.reduce((a, b) => (a.statusSeverity < b.statusSeverity ? a : b)) : null;

  return (
    <div>
      {/* Themed header block using the line's own colour as an accent,
          not the site's default blue — the whole point of a dedicated
          per-line page is that it feels branded to that line. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 18px",
          borderRadius: "var(--radius)",
          background: "var(--bg-raised)",
          borderLeft: `5px solid ${line.colourHex}`,
          marginBottom: 20,
        }}
      >
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{line.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontFamily: "var(--font-display)", fontSize: 12 }}>
            <StatusDot severity={worst?.statusSeverity ?? 10} />
            <span style={{ color: "var(--text-dim)", textTransform: "uppercase" }}>
              {worst?.statusDescription ?? "Good Service"}
            </span>
          </div>
        </div>
        <button
          onClick={toggleFavourite}
          aria-label={isFavourite ? `Remove ${line.name} from favourites` : `Favourite ${line.name}`}
          aria-pressed={isFavourite}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 22,
            color: isFavourite ? line.colourHex : "var(--border)",
            padding: 4,
          }}
        >
          ★
        </button>
      </div>

      {activeEvents.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--text-dim)", fontWeight: 500, marginBottom: 8 }}>
            CURRENT DISRUPTIONS
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeEvents.map((event) => (
              <div
                key={event.id}
                style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 12, background: "var(--bg-raised)" }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{event.statusDescription}</div>
                {event.reason && <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{event.reason}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--text-dim)", fontWeight: 500, marginBottom: 8 }}>
          STATIONS {stations && `(${stations.length})`}
        </h2>
        {!stations && <p style={{ fontSize: 13, color: "var(--text-dim)" }}>Loading stations…</p>}
        {stations && stations.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-dim)" }}>Couldn&apos;t load stations for this line.</p>
        )}
        {stations && stations.length > 0 && (
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            {stations.map((station, i) => (
              <div
                key={station.id}
                style={{
                  padding: "10px 14px",
                  borderBottom: i < stations.length - 1 ? "1px solid var(--border)" : "none",
                  background: "var(--bg-raised)",
                  fontSize: 13,
                }}
              >
                {station.commonName}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
