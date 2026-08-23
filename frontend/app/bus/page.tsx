"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

function BusTile({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
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
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--primary)" }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{description}</div>
    </Link>
  );
}

export default function BusPage() {
  const { session } = useAuth();

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 16 }}>
        BUSES
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 20 }}>
        A separate section for live London bus times, kept apart from the train pages.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        <BusTile href="/bus/times" title="Live bus times" description="Search a stop, see the next buses" />
        <BusTile href="/bus/nearby" title="Near me" description="Find the best nearby bus stop right now" />
        {session && (
          <BusTile href="/bus/favourites" title="Favourites" description="Bus stops you're tracking" />
        )}
      </div>
    </div>
  );
}
