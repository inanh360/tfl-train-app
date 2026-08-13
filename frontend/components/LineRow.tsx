import Link from "next/link";
import type { Line } from "@/lib/api";
import { StatusDot } from "@/components/StatusDot";
import { cleanBranchLabel } from "@/lib/format";

// Orders lines worst-status-first, so the most useful information sits at
// the top. Good Service ranks after any real disruption, and a closed
// service (e.g. overnight) sinks to the very bottom, since that's the
// least actionable state for someone checking the board.
export function severityRank(line: Line): number {
  const active = line.statusEvents.filter((e) => e.isActive);
  if (active.length === 0) return 10;
  const worst = Math.min(...active.map((e) => e.statusSeverity));
  if (worst >= 20) return 100;
  return worst;
}

export function LineRow({
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
        <Link
          href={`/${line.id}`}
          style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", textDecoration: "none" }}
        >
          {line.name}
        </Link>
        {active.length === 1 && (
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
            {active[0].branchLabel && (
              <span style={{ color: "var(--text)", fontWeight: 500 }}>{cleanBranchLabel(active[0].branchLabel)}: </span>
            )}
            {active[0].reason ?? active[0].statusDescription}
          </div>
        )}
        {active.length > 1 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>
              {active.length} disruptions active
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 6 }}>
              {active.map((event) => (
                <div key={event.id} style={{ fontSize: 12, color: "var(--text)" }}>
                  {event.branchLabel ? cleanBranchLabel(event.branchLabel) : event.statusDescription}
                </div>
              ))}
            </div>
            {/* Reasons are often identical across branches for the same
                underlying incident — dedupe so it's not repeated once per
                branch. */}
            {[...new Set(active.map((e) => e.reason).filter((r): r is string => Boolean(r)))].map((reason) => (
              <div key={reason} style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                {reason}
              </div>
            ))}
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
