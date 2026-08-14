"use client";

import { useEffect, useState } from "react";
import { api, type Notification } from "@/lib/api";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getNotifications()
      .then(setNotifications)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load alerts"));
  }, []);

  async function markRead(id: string) {
    await api.markNotificationRead(id);
    setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? null);
  }

  async function markAllRead() {
    await api.markAllNotificationsRead();
    setNotifications((prev) => prev?.map((n) => ({ ...n, read: true })) ?? null);
  }

  if (error) {
    return <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>;
  }

  if (!notifications) {
    return <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)", fontSize: 13 }}>Loading…</p>;
  }

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, margin: 0 }}>
          ALERTS
        </h1>
        {hasUnread && (
          <button
            onClick={markAllRead}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "5px 10px",
              color: "var(--text-dim)",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                border: "1px solid var(--border)",
                borderLeft: `3px solid ${n.colourHex}`,
                borderRadius: "var(--radius)",
                background: n.read ? "var(--bg-raised)" : "var(--bg-raised-hover)",
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.message}</p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-display)" }}>
                  {new Date(n.createdAt).toLocaleString("en-GB")}
                </p>
              </div>
              {!n.read && (
                <button
                  onClick={() => markRead(n.id)}
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "4px 8px",
                    color: "var(--text-dim)",
                    cursor: "pointer",
                    fontSize: 11,
                    whiteSpace: "nowrap",
                  }}
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ border: "1px dashed var(--border)", borderRadius: "var(--radius)", padding: 20, textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>
        No alerts yet. You&apos;ll see one here when a favourited line or station is disrupted.
      </p>
    </div>
  );
}
