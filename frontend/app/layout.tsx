import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { AuthGuard } from "@/components/AuthGuard";
import { HeaderNav } from "@/components/HeaderNav";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

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
  title: "Line Status",
  description:
    "Check live London Underground line statuses, delays, disruptions and departures. Plan your journey and see the latest information for every Tube line.",
  // iOS specifically looks for these to give a proper full-screen,
  // installed-app feel rather than treating it as just a bookmarked
  // website — the manifest file alone doesn't cover iOS Safari fully.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Line Status",
  },
};

export const viewport: Viewport = {
  // Tints the browser's own UI (address bar on Android, status bar
  // context on iOS) to match the app, so it feels like one continuous
  // surface rather than a webpage with a different-coloured browser
  // chrome around it. Kept as its own export rather than inside
  // metadata, since Next.js moved theme-color here in newer versions.
  themeColor: "#4d5ec2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <ThemeSwitcher />
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 80px" }}>
          <AuthProvider>
            <HeaderNav />
            <AuthGuard>{children}</AuthGuard>
            <footer style={{ marginTop: 48, paddingTop: 16, borderTop: "1px solid var(--border)", fontSize: 12 }}>
              <Link href="/privacy" style={{ color: "var(--text-dim)", textDecoration: "none" }}>
                Privacy policy
              </Link>
            </footer>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
