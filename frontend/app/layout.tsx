import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { AuthGuard } from "@/components/AuthGuard";
import { HeaderNav } from "@/components/HeaderNav";

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
          <AuthProvider>
            <HeaderNav />
            <AuthGuard>{children}</AuthGuard>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
