"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabaseClient";

export default function AccountPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = session?.user.email;
  const canDelete = confirmText === "DELETE";

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteAccount();
      await supabase.auth.signOut();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 16 }}>
        ACCOUNT
      </h1>

      <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 24 }}>Signed in as {email}</p>

      <div style={{ border: "1px solid var(--red)", borderRadius: "var(--radius)", padding: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--red)", margin: "0 0 8px" }}>Delete account</h2>
        <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "0 0 12px" }}>
          This permanently deletes your account, favourites, and notification history. This cannot be undone.
        </p>

        <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>
          Type DELETE to confirm
        </label>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 10px",
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--text)",
            fontSize: 14,
            marginBottom: 12,
          }}
        />

        {error && <p style={{ color: "var(--red)", fontSize: 12, margin: "0 0 12px" }}>{error}</p>}

        <button
          onClick={handleDelete}
          disabled={!canDelete || deleting}
          style={{
            padding: "8px 14px",
            background: canDelete ? "var(--red)" : "var(--bg-raised)",
            color: canDelete ? "#fff" : "var(--text-dim)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: 13,
            fontWeight: 600,
            cursor: canDelete ? "pointer" : "not-allowed",
          }}
        >
          {deleting ? "Deleting…" : "Delete my account"}
        </button>
      </div>
    </div>
  );
}
