"use client";

import Link from "next/link";

const TILES = [
  { href: "/nearby", title: "Near me", description: "Find the best nearby station right now" },
  { href: "/journey", title: "Plan a journey", description: "Train-only routes, live disruption-aware" },
  { href: "/favourites", title: "Favourites", description: "Lines and stations you're tracking" },
  { href: "/notifications", title: "Alerts", description: "Notifications for your favourites" },
] as const;

export function QuickNav() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 10,
        marginBottom: 24,
      }}
    >
      {TILES.map((tile) => (
        <Link
          key={tile.href}
          href={tile.href}
          style={{
            display: "block",
            padding: "14px 16px",
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            textDecoration: "none",
            color: "var(--text)",
            transition: "border-color 120ms ease",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--primary)" }}>{tile.title}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{tile.description}</div>
        </Link>
      ))}
    </div>
  );
}
