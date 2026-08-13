import Link from "next/link";

export default function BusPage() {
  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 16 }}>
        BUSES
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 20 }}>
        A separate section for live London bus times, kept apart from the train pages.
      </p>

      <Link
        href="/bus/times"
        style={{
          display: "block",
          padding: "14px 16px",
          background: "var(--bg-raised)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          textDecoration: "none",
          color: "var(--text)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--primary)" }}>Live bus times</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Search a stop, see the next buses</div>
      </Link>
    </div>
  );
}
