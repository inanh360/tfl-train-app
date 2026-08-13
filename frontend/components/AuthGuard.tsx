"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

const PUBLIC_PATHS = ["/login", "/", "/journey", "/privacy", "/auth/callback", "/nearby", "/departures", "/bus", "/bus/times"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!loading && !session && !isPublicPath) {
      router.replace("/login");
    }
  }, [loading, session, isPublicPath, router]);

  // Public pages render immediately regardless of auth-loading state — they
  // don't need to know whether you're signed in to show useful content.
  if (isPublicPath) {
    return <>{children}</>;
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)", fontSize: 13 }}>Loading…</p>;
  }

  if (!session) {
    return null; // redirect effect above is already firing
  }

  return <>{children}</>;
}
