"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

const PUBLIC_PATHS = ["/login"];

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

  if (loading) {
    return <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)", fontSize: 13 }}>Loading…</p>;
  }

  if (!session && !isPublicPath) {
    return null; // redirect effect above is already firing
  }

  return <>{children}</>;
}
