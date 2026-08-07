"use client";

import { useEffect, useRef, useState } from "react";
import { api, type StationMatch } from "@/lib/api";

export function StationAutocomplete({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: StationMatch | null;
  onSelect: (station: StationMatch) => void;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<StationMatch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2 || query === value?.name) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const matches = await api.searchStations(query.trim());
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
        {label.toUpperCase()}
      </label>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Station name…"
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
          {results.map((station) => (
            <li key={station.id}>
              <button
                onMouseDown={(e) => e.preventDefault()} // keep input focus so onBlur doesn't fire before click registers
                onClick={() => {
                  onSelect(station);
                  setQuery(station.name);
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
                {station.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
