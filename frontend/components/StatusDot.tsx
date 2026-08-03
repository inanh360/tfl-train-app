"use client";

function statusColor(severity: number): string {
  if (severity >= 20) return "var(--text-dim)"; // Service Closed (not a disruption)
  if (severity >= 10) return "var(--green)"; // Good Service
  if (severity <= 3) return "var(--red)"; // Suspended / Part Suspended
  return "var(--warning)"; // Delays of various kinds
}

export function StatusDot({ severity }: { severity: number }) {
  const color = statusColor(severity);
  const isLive = severity < 10; // anything other than Good Service is worth drawing the eye to

  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        color,
        flexShrink: 0,
        animation: isLive ? "pulse 2s ease-in-out infinite" : undefined,
      }}
    />
  );
}
