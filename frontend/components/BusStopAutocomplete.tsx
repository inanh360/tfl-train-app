"use client";

import { useEffect, useRef, useState } from "react";
import { api, type BusStopMatch } from "@/lib/api";

export function busStopDisplayName(stop: BusStopMatch): string {
  const parts: string[] = [];
  if (stop.stopLetter) parts.push(`Stop ${stop.stopLetter}`);
  if (stop.towards) parts.push(`towards ${stop.towards}`);
  return parts.length > 0 ? `${stop.name} (${parts.join(", ")})` : stop.name;
}

export function BusStopAutocomplete({
  value,
  onSelect,
}: {
  value: BusStopMatch | null;
  onSelect: (stop: BusStopMatch) => void;
}) {
  const [query, setQuery] = useState(value ? busStopDisplayName(value) : "");
  const [results, setResults] = useState<BusStopMatch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keeps the visible text in sync when the selected stop changes from
  // outside this component — e.g. clicking a favourited quick-pick button
  // on the parent page, which sets a new value without going through this
  // component's own onSelect at all.
  useEffect(() => {
    setQuery(value ? busStopDisplayName(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.id]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2 || (value && query === busStopDisplayName(value))) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const matches = await api.searchBusStops(query.trim());
        setResults(matches);
        setIsOpen(true);
      } catch {
        setResults([]);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", marginBottom: 4, fontFamily: "var(--font-display)" }}>
        BUS STOP
      </label>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Bus stop name…"
        style={{
          width: "100%",
          padding: "10px 12px",
          background: "var(--bg-raised)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          color: "var(--text)",
          fontSize: 14,
        }}
      />
      {isOpen && results.length > 0 && (
        <ul
          style={{
            position: "absolute",
            zIndex: 10,
            top: "100%",
            left: 0,
            right: 0,
            margin: "4px 0 0",
            padding: 0,
            listStyle: "none",
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {results.map((stop) => (
            <li key={stop.id}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(stop);
                  setQuery(busStopDisplayName(stop));
                  setIsOpen(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {stop.name}
                {(stop.stopLetter || stop.towards) && (
                  <span style={{ color: "var(--text-dim)" }}>
                    {" "}
                    ({[stop.stopLetter && `Stop ${stop.stopLetter}`, stop.towards && `towards ${stop.towards}`]
                      .filter(Boolean)
                      .join(", ")}
                    )
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
