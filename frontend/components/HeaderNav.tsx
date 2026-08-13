"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";

export function HeaderNav() {
  const { session, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      style={{
        position: "relative",
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
        <Image src="/logo.png" alt="" width={18} height={18} style={{ display: "block" }} />
        LINE STATUS
      </Link>

      <button
        className="nav-toggle"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        style={{
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "6px 10px",
          color: "var(--text)",
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        {menuOpen ? "✕" : "☰"}
      </button>

      <nav className={`nav-links${menuOpen ? " nav-links-open" : ""}`} style={{ fontSize: 13 }}>
        <Link href="/journey" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--text-dim)" }}>
          Plan journey
        </Link>
        <Link href="/departures" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--text-dim)" }}>
          Departures
        </Link>
        {session ? (
          <>
            <Link href="/favourites" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--text-dim)" }}>
              Favourites
            </Link>
            <Link href="/notifications" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--text-dim)" }}>
              Alerts
            </Link>
            <Link href="/account" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--text-dim)" }}>
              Account
            </Link>
            <button
              onClick={() => {
                setMenuOpen(false);
                signOut();
              }}
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
        ) : (
          <Link href="/login" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--primary)" }}>
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
