import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const displayFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "TfL Status Board",
  description: "Live TfL train line status, journey planning, and disruption alerts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 80px" }}>
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
            <nav style={{ display: "flex", gap: 18, fontSize: 13 }}>
              <Link href="/journey" style={{ textDecoration: "none", color: "var(--text-dim)" }}>
                Plan journey
              </Link>
              <Link href="/favourites" style={{ textDecoration: "none", color: "var(--text-dim)" }}>
                Favourites
              </Link>
              <Link href="/notifications" style={{ textDecoration: "none", color: "var(--text-dim)" }}>
                Alerts
              </Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
