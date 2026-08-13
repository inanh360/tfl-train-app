import type { Metadata } from "next";
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
