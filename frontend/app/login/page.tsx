"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Where Supabase sends the user after they click the link in
          // their email. This exact URL also needs to be added to the
          // Redirect URLs allowlist in Supabase's Auth settings, or the
          // link will fail.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div style={{ maxWidth: 320, margin: "40px auto", textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 16 }}>
          CHECK YOUR EMAIL
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
          A sign-in link has been sent to <strong style={{ color: "var(--text)" }}>{email}</strong>. Click it to
          finish signing in.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 320, margin: "40px auto" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 8 }}>
        SIGN IN
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 20 }}>
        No password needed. We&apos;ll email you a link to sign in.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: "10px 12px",
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--text)",
            fontSize: 14,
          }}
        />

        {error && <p style={{ color: "var(--red)", fontSize: 12, margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 14px",
            background: "var(--primary)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius)",
            fontWeight: 600,
            fontSize: 13,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending…" : "Send sign-in link"}
        </button>
      </form>
    </div>
  );
}
