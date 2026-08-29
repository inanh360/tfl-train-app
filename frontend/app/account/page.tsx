"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabaseClient";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// Push subscriptions need the VAPID public key as raw bytes, not the
// base64url string it's normally shared as, this is the standard
// conversion for that, not anything TfL or app specific.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export default function AccountPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setPushSupported(true);

    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setPushEnabled(!!existing);
    });
  }, []);

  async function enablePush() {
    if (!VAPID_PUBLIC_KEY) {
      setPushError("Push isn't configured on this deployment yet.");
      return;
    }
    setPushBusy(true);
    setPushError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushError("Notification permission was not granted.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await api.subscribePush(subscription.toJSON());
      setPushEnabled(true);
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Failed to enable push notifications");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    setPushError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api.unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setPushEnabled(false);
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Failed to disable push notifications");
    } finally {
      setPushBusy(false);
    }
  }

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

      {pushSupported && (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>Push notifications</h2>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "0 0 12px" }}>
            {pushEnabled
              ? "You'll get a notification on this device the moment something you've favourited is disrupted."
              : "Get notified on this device the moment something you've favourited is disrupted, even with the site closed."}
          </p>
          {pushError && <p style={{ color: "var(--red)", fontSize: 12, margin: "0 0 12px" }}>{pushError}</p>}
          <button
            onClick={pushEnabled ? disablePush : enablePush}
            disabled={pushBusy}
            style={{
              padding: "8px 14px",
              background: pushEnabled ? "var(--bg-raised)" : "var(--primary)",
              color: pushEnabled ? "var(--text)" : "#fff",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 13,
              fontWeight: 600,
              cursor: pushBusy ? "not-allowed" : "pointer",
            }}
          >
            {pushBusy ? "Working…" : pushEnabled ? "Turn off" : "Turn on"}
          </button>
        </div>
      )}

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
