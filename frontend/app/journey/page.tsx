"use client";

import { useState } from "react";
import { api, type Journey, type StationMatch } from "@/lib/api";
import { StationAutocomplete } from "@/components/StationAutocomplete";

export default function JourneyPage() {
  const [from, setFrom] = useState<StationMatch | null>(null);
  const [to, setTo] = useState<StationMatch | null>(null);
  const [journeys, setJourneys] = useState<Journey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function plan() {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.planJourney(from.id, to.id);
      setJourneys(result.journeys);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to plan journey");
      setJourneys(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 16 }}>
        PLAN A JOURNEY
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <StationAutocomplete label="From" value={from} onSelect={setFrom} />
        <StationAutocomplete label="To" value={to} onSelect={setTo} />
        <button
          onClick={plan}
          disabled={!from || !to || loading}
          style={{
            padding: "10px 14px",
            background: from && to ? "var(--primary)" : "var(--bg-raised)",
            color: from && to ? "#1a1200" : "var(--text-dim)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontWeight: 600,
            fontSize: 13,
            cursor: from && to ? "pointer" : "not-allowed",
          }}
        >
          {loading ? "Planning…" : "Plan journey"}
        </button>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}

      {journeys && journeys.length === 0 && (
        <p style={{ color: "var(--text-dim)", fontSize: 13 }}>No train-only route found between these stations right now.</p>
      )}

      {journeys && journeys.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {journeys.map((journey, i) => (
            <JourneyCard key={i} journey={journey} />
          ))}
        </div>
      )}
    </div>
  );
}

function JourneyCard({ journey }: { journey: Journey }) {
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const hasDisruption = journey.legs.some((l) => l.isDisrupted);

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14, background: "var(--bg-raised)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>
          {time(journey.startTime)} → {time(journey.arrivalTime)}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{journey.durationMinutes} min</span>
      </div>

      {hasDisruption && (
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--warning)" }}>⚠ This route is affected by a current disruption</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {journey.legs.map((leg, i) => (
          <div key={i} style={{ fontSize: 13, display: "flex", gap: 8 }}>
            <span style={{ color: leg.isDisrupted ? "var(--red)" : "var(--text-dim)", flexShrink: 0 }}>
              {time(leg.departureTime)}
            </span>
            <span>
              {leg.summary}
              <span style={{ color: "var(--text-dim)" }}> · {leg.durationMinutes} min</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
