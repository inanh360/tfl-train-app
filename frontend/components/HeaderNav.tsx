"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";

// One open dropdown at a time, opening one closes the other, rather than
// tracking two independent booleans that could both end up open together.
type OpenDropdown = "travel" | "myline" | null;

function NavDropdown({
  label,
  isOpen,
  onToggle,
  onClose,
  links,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  links: { href: string; text: string }[];
}) {
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={onToggle}
        onBlur={() => setTimeout(onClose, 150)} // delay so a click on a link inside registers before the panel closes
        aria-expanded={isOpen}
        aria-haspopup="true"
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: "var(--text-dim)",
          fontSize: 13,
          fontFamily: "inherit",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {label}
        <span style={{ fontSize: 10, marginTop: 1 }}>{isOpen ? "▴" : "▾"}</span>
      </button>
      <div className={`nav-dropdown-panel${isOpen ? " nav-dropdown-open" : ""}`}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} style={{ textDecoration: "none", color: "var(--text-dim)", fontSize: 13 }}>
            {link.text}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function HeaderNav() {
  const { session, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const pathname = usePathname();
  const isBusSection = pathname.startsWith("/bus");

  function toggleDropdown(which: OpenDropdown) {
    setOpenDropdown((current) => (current === which ? null : which));
  }

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
        href={isBusSection ? "/bus" : "/"}
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
        <Image src={isBusSection ? "/logo-bus.png" : "/logo.png"} alt="" width={18} height={18} style={{ display: "block" }} />
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

      {/* Mobile: same flat hamburger list as before, entirely unchanged. */}
      <nav className={`nav-links${menuOpen ? " nav-links-open" : ""}`} style={{ fontSize: 13 }}>
        {isBusSection ? (
          <>
            <Link href="/bus/times" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--text-dim)" }}>
              Departures
            </Link>
            <Link href="/bus/nearby" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--text-dim)" }}>
              Near me
            </Link>
            <Link href="/" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--text-dim)" }}>
              Train
            </Link>
            {session && (
              <Link href="/bus/favourites" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--text-dim)" }}>
                Favourites
              </Link>
            )}
            {session ? (
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
            ) : (
              <Link href="/login" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--primary)" }}>
                Sign in
              </Link>
            )}
          </>
        ) : (
          <>
            <Link href="/journey" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--text-dim)" }}>
              Plan journey
            </Link>
            <Link href="/departures" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--text-dim)" }}>
              Departures
            </Link>
            <Link href="/nearby" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--text-dim)" }}>
              Near me
            </Link>
            <Link href="/bus" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", color: "var(--text-dim)" }}>
              Bus
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
          </>
        )}
      </nav>

      {/* Desktop: grouped dropdowns instead of one long flat row, for
          both sections, each with its own grouping since the bus
          section's links don't map onto the train section's groups. */}
      {isBusSection ? (
        <nav className="nav-desktop-groups">
          <NavDropdown
            label="Travel"
            isOpen={openDropdown === "travel"}
            onToggle={() => toggleDropdown("travel")}
            onClose={() => setOpenDropdown((current) => (current === "travel" ? null : current))}
            links={[
              { href: "/bus/times", text: "Departures" },
              { href: "/bus/nearby", text: "Near me" },
            ]}
          />
          {session && (
            <NavDropdown
              label="My Bus"
              isOpen={openDropdown === "myline"}
              onToggle={() => toggleDropdown("myline")}
              onClose={() => setOpenDropdown((current) => (current === "myline" ? null : current))}
              links={[{ href: "/bus/favourites", text: "Favourites" }]}
            />
          )}
          <Link href="/" style={{ textDecoration: "none", color: "var(--text-dim)", fontSize: 13 }}>
            Train
          </Link>
          {session ? (
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
          ) : (
            <Link href="/login" style={{ textDecoration: "none", color: "var(--primary)", fontSize: 13 }}>
              Sign in
            </Link>
          )}
        </nav>
      ) : (
        <nav className="nav-desktop-groups">
          <NavDropdown
            label="Travel"
            isOpen={openDropdown === "travel"}
            onToggle={() => toggleDropdown("travel")}
            onClose={() => setOpenDropdown((current) => (current === "travel" ? null : current))}
            links={[
              { href: "/departures", text: "Departures" },
              { href: "/journey", text: "Plan journey" },
              { href: "/nearby", text: "Near me" },
            ]}
          />
          {session && (
            <NavDropdown
              label="My Line"
              isOpen={openDropdown === "myline"}
              onToggle={() => toggleDropdown("myline")}
              onClose={() => setOpenDropdown((current) => (current === "myline" ? null : current))}
              links={[
                { href: "/favourites", text: "Favourites" },
                { href: "/notifications", text: "Alerts" },
                { href: "/account", text: "Account" },
              ]}
            />
          )}
          <Link href="/bus" style={{ textDecoration: "none", color: "var(--text-dim)", fontSize: 13 }}>
            Bus
          </Link>
          {session ? (
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
          ) : (
            <Link href="/login" style={{ textDecoration: "none", color: "var(--primary)", fontSize: 13 }}>
              Sign in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
