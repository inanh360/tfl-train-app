"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Account created. Check your email to confirm, then sign in.");
        setMode("signIn");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 320, margin: "40px auto" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 20 }}>
        {mode === "signIn" ? "SIGN IN" : "CREATE ACCOUNT"}
      </h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && <p style={{ color: "var(--red)", fontSize: 12, margin: 0 }}>{error}</p>}
        {info && <p style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>{info}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 14px",
            background: "var(--primary)",
            color: "#06170c",
            border: "none",
            borderRadius: "var(--radius)",
            fontWeight: 600,
            fontSize: 13,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "…" : mode === "signIn" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "signIn" ? "signUp" : "signIn");
          setError(null);
          setInfo(null);
        }}
        style={{
          marginTop: 16,
          background: "none",
          border: "none",
          color: "var(--text-dim)",
          fontSize: 12,
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        {mode === "signIn" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text)",
  fontSize: 14,
};
