"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, type Line, type Favourite } from "@/lib/api";
import { StatusDot } from "@/components/StatusDot";
import { QuickNav } from "@/components/QuickNav";
import { useAuth } from "@/lib/auth-context";

const POLL_MS = 30_000; // frontend refetches more often than the backend polls TfL, so status changes show up promptly

export default function DashboardPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [lines, setLines] = useState<Line[] | null>(null);
  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      // Favourites are personal — only fetch them if actually signed in, so
      // a logged-out visitor can still see live status without a 401.
      const [linesData, favouritesData] = await Promise.all([
        api.getLines(),
        session ? api.getFavourites() : Promise.resolve([]),
      ]);
      setLines(linesData);
      setFavourites(favouritesData);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status board");
    }
  }, [session]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const favouriteLineIds = new Set(favourites.filter((f) => f.favouriteType === "LINE").map((f) => f.refId));

  async function toggleFavourite(line: Line) {
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
    load();
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  if (!lines) {
    return <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)", fontSize: 13 }}>Loading status board…</p>;
  }

  // Order: anything actively disrupted first, then Good Service, then
  // Service Closed last — the most useful information belongs at the top.
  const sorted = [...lines].sort((a, b) => severityRank(a) - severityRank(b));

  return (
    <div>
      <QuickNav />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, margin: 0 }}>
          LIVE LINE STATUS
        </h1>
        {lastUpdated && (
          <span style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--text-dim)" }}>
            updated {lastUpdated.toLocaleTimeString("en-GB")}
          </span>
        )}
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        {sorted.map((line) => (
          <LineRow
            key={line.id}
            line={line}
            isFavourite={favouriteLineIds.has(line.id)}
            onToggleFavourite={() => toggleFavourite(line)}
          />
        ))}
      </div>
    </div>
  );
}

function severityRank(line: Line): number {
  const active = line.statusEvents.filter((e) => e.isActive);
  if (active.length === 0) return 10; // treat as Good Service if nothing active
  const worst = Math.min(...active.map((e) => e.statusSeverity));
  if (worst >= 20) return 100; // Service Closed sinks to the bottom
  return worst;
}

function LineRow({
  line,
  isFavourite,
  onToggleFavourite,
}: {
  line: Line;
  isFavourite: boolean;
  onToggleFavourite: () => void;
}) {
  const active = line.statusEvents.filter((e) => e.isActive);
  const worst = active.length > 0 ? active.reduce((a, b) => (a.statusSeverity < b.statusSeverity ? a : b)) : null;

  return (
    <div
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
        aria-hidden="true"
        style={{ width: 4, height: 20, borderRadius: 2, background: line.colourHex, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{line.name}</div>
        {active.length > 0 && (
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
            {active.length > 1 ? `${active.length} disruptions active` : worst?.reason ?? worst?.statusDescription}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-display)", fontSize: 12 }}>
        <StatusDot severity={worst?.statusSeverity ?? 10} />
        <span style={{ color: "var(--text-dim)", textTransform: "uppercase" }}>
          {worst?.statusDescription ?? "Good Service"}
        </span>
      </div>
      <button
        onClick={onToggleFavourite}
        aria-label={isFavourite ? `Remove ${line.name} from favourites` : `Favourite ${line.name}`}
        aria-pressed={isFavourite}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 16,
          color: isFavourite ? "var(--primary)" : "var(--border)",
          padding: 4,
        }}
      >
        ★
      </button>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ border: "1px solid var(--red)", borderRadius: "var(--radius)", padding: 16 }}>
      <p style={{ margin: 0, color: "var(--red)", fontSize: 13 }}>Couldn&apos;t load the status board: {message}</p>
      <button
        onClick={onRetry}
        style={{
          marginTop: 10,
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
  );
}
