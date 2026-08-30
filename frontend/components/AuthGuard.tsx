"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

const PUBLIC_PATHS = ["/login", "/", "/journey", "/privacy", "/auth/callback", "/nearby", "/departures", "/bus", "/bus/times", "/bus/nearby"];
// Station pages are all dynamic (/station/{id}), so they're matched by
// prefix rather than listed individually.
const PUBLIC_PATH_PREFIXES = ["/station/"];
// Dynamic line pages (/central, /district, etc) were never actually
// added to PUBLIC_PATHS above, despite clearly being meant to be public,
// each one has its own logic that only asks for login when someone tries
// to favourite it, implying the page itself should be viewable without
// an account. Rather than list all ~19 line ids by hand (fragile, easy
// to forget one), any single-segment path is treated as public unless
// it's explicitly one of the few that should genuinely require login.
const PRIVATE_SINGLE_SEGMENT_PATHS = new Set(["favourites", "notifications", "account"]);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split("/").filter(Boolean);
  const isPublicPath =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    (segments.length === 1 && !PRIVATE_SINGLE_SEGMENT_PATHS.has(segments[0]));

  useEffect(() => {
    if (!loading && !session && !isPublicPath) {
      router.replace("/login");
    }
  }, [loading, session, isPublicPath, router]);

  // Public pages render immediately regardless of auth-loading state, they
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
