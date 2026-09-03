"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Note: this doesn't set an emailRedirectTo, unlike a click-through
      // magic link would. The person types the code directly on this
      // page instead of following a link, so there's no redirect step
      // for Supabase to need a URL for.
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw error;
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work, check it and try again");
    } finally {
      setLoading(false);
    }
  }

  if (step === "code") {
    return (
      <div style={{ maxWidth: 320, margin: "40px auto" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 8 }}>
          ENTER CODE
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 20 }}>
          A 6 digit code has been sent to <strong style={{ color: "var(--text)" }}>{email}</strong>.
        </p>

        <form onSubmit={handleVerifyCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            required
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            style={{
              padding: "10px 12px",
              background: "var(--bg-raised)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--text)",
              fontSize: 20,
              fontFamily: "var(--font-display)",
              letterSpacing: "0.3em",
              textAlign: "center",
            }}
          />

          {error && <p style={{ color: "var(--red)", fontSize: 12, margin: 0 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            style={{
              padding: "10px 14px",
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius)",
              fontWeight: 600,
              fontSize: 13,
              cursor: loading || code.length !== 6 ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Verifying…" : "Verify and sign in"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              fontSize: 12,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Use a different email
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 320, margin: "40px auto" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 8 }}>
        SIGN IN
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 20 }}>
        No password needed. We&apos;ll email you a 6 digit code to sign in.
      </p>

      <form onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
          {loading ? "Sending…" : "Send code"}
        </button>
      </form>
    </div>
  );
}
