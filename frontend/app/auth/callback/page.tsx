"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// Supabase's client library automatically picks up the auth token from the
// URL when this page loads (this works regardless of whether the token
// arrives as a URL hash or a query param, both are handled internally) and
// fires the onAuthStateChange listener already set up in AuthProvider. This
// page just waits for that to happen and then moves the user on.
export default function AuthCallbackPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      router.replace("/");
    }
  }, [loading, session, router]);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (timedOut && !session) {
    return (
      <div style={{ maxWidth: 320, margin: "40px auto", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--red)" }}>
          Something went wrong signing you in. The link may have expired.
        </p>
        <a href="/login" style={{ fontSize: 13, color: "var(--primary)" }}>
          Try again
        </a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 320, margin: "40px auto", textAlign: "center" }}>
      <p style={{ fontSize: 13, color: "var(--text-dim)", fontFamily: "var(--font-display)" }}>Signing you in…</p>
    </div>
  );
}
