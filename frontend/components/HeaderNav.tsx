"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function HeaderNav() {
  const { session, signOut } = useAuth();

  return (
    <header
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 28,
        paddingBottom: 16,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 15,
          letterSpacing: "0.06em",
          textDecoration: "none",
          color: "var(--primary)",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
          ◉
        </span>
        TFL STATUS BOARD
      </Link>
      <nav style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 13 }}>
        {session && (
          <>
            <Link href="/journey" style={{ textDecoration: "none", color: "var(--text-dim)" }}>
              Plan journey
            </Link>
            <Link href="/favourites" style={{ textDecoration: "none", color: "var(--text-dim)" }}>
              Favourites
            </Link>
            <Link href="/notifications" style={{ textDecoration: "none", color: "var(--text-dim)" }}>
              Alerts
            </Link>
            <button
              onClick={signOut}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "4px 10px",
                color: "var(--text-dim)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
