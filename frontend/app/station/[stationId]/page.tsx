"use client";

import { useEffect, useState, use } from "react";
import { api, type StationDetail, type ArrivalPrediction, type Line } from "@/lib/api";

export default function StationPage({ params }: { params: Promise<{ stationId: string }> }) {
  const { stationId } = use(params);

  const [station, setStation] = useState<StationDetail | null>(null);
  const [arrivals, setArrivals] = useState<ArrivalPrediction[] | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api
      .getStationDetail(stationId)
      .then(setStation)
      .catch(() => setNotFound(true));

    api.getArrivals(stationId).then(setArrivals).catch(() => setArrivals([]));

    // Fetched once for a lineId -> colourHex lookup, so each departure
    // below can be coloured by its own actual line rather than one
    // colour for the whole page.
    api.getLines().then(setLines).catch(() => {});
  }, [stationId]);

  if (notFound) {
    return (
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>No station found with that id.</p>
      </div>
    );
  }

  if (!station) {
    return <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)", fontSize: 13 }}>Loading…</p>;
  }

  const colourByLineId = new Map(lines.map((l) => [l.id, l.colourHex]));

  // Grouped by platform, each platform's own list sorted soonest first.
  const byPlatform = new Map<string, ArrivalPrediction[]>();
  for (const arrival of arrivals ?? []) {
    const key = arrival.platform || "Platform not specified";
    if (!byPlatform.has(key)) byPlatform.set(key, []);
    byPlatform.get(key)!.push(arrival);
  }
  for (const list of byPlatform.values()) {
    list.sort((a, b) => a.secondsAway - b.secondsAway);
  }

  return (
    <div>
      <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700 }}>{station.name}</h1>

      {station.lines.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {station.lines.map((line) => (
            <span
              key={line.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                background: "var(--bg-raised)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: colourByLineId.get(line.id) ?? "var(--text-dim)",
                  flexShrink: 0,
                }}
              />
              {line.name}
            </span>
          ))}
        </div>
      )}

      {!arrivals && <p style={{ fontSize: 13, color: "var(--text-dim)" }}>Loading departures…</p>}

      {arrivals && arrivals.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-dim)" }}>No live predictions right now.</p>
      )}

      {arrivals && arrivals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[...byPlatform.entries()].map(([platform, predictions]) => (
            <div key={platform}>
              <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>{platform}</h2>
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                {predictions.map((arrival, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderBottom: i < predictions.length - 1 ? "1px solid var(--border)" : "none",
                      background: "var(--bg-raised)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 4,
                        height: 20,
                        borderRadius: 2,
                        background: colourByLineId.get(arrival.lineId) ?? "var(--text-dim)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 15,
                        fontWeight: 600,
                        minWidth: 40,
                        color: arrival.minutesAway <= 1 ? "var(--warning)" : "var(--text)",
                      }}
                    >
                      {arrival.minutesAway <= 0 ? "Due" : `${arrival.minutesAway}m`}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{arrival.line}</div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>to {arrival.destination}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
