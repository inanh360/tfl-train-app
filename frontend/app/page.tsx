"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, type Line, type Favourite } from "@/lib/api";
import { QuickNav } from "@/components/QuickNav";
import { LineRow, severityRank } from "@/components/LineRow";
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

  // Lets someone glance at an open tab and see there's a problem without
  // switching to it. Counts lines actually disrupted, not raw event rows,
  // since one line can carry several simultaneous events for different
  // branches — that would inflate the number in a way that doesn't match
  // what a person actually cares about ("how many lines are affected").
  useEffect(() => {
    if (!lines) return;
    const disruptedCount = lines.filter((line) => severityRank(line) < 10).length;
    document.title = disruptedCount > 0 ? `${disruptedCount} disruption${disruptedCount === 1 ? "" : "s"} - Line Status` : "Line Status";
    return () => {
      document.title = "Line Status";
    };
  }, [lines]);

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
