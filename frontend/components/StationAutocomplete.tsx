"use client";

import { useEffect, useRef, useState } from "react";
import { api, type StationMatch } from "@/lib/api";

export function StationAutocomplete({
  label,
  value,
  onSelect,
  browsable = false,
}: {
  label: string;
  value: StationMatch | null;
  onSelect: (station: StationMatch) => void;
  // When true, focusing the empty input shows the full station list to
  // scroll through, not just search results once you start typing. Opt-in
  // per usage rather than a global default, since it means fetching (and
  // caching) the entire station list the first time it's used.
  browsable?: boolean;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<StationMatch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allStationsRef = useRef<StationMatch[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Typing always searches, exactly as before — this branch is
    // unaffected by the browsable option.
    if (query.trim().length >= 2 && query !== value?.name) {
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
    }

    // Empty query: only show something automatically if browsable mode is
    // on — otherwise this matches the original behaviour of showing
    // nothing until the person types.
    if (!browsable) {
      setResults([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function handleFocus() {
    if (results.length > 0) {
      setIsOpen(true);
      return;
    }

    if (browsable && query.trim().length < 2) {
      if (allStationsRef.current) {
        setResults(allStationsRef.current);
        setIsOpen(true);
        return;
      }
      setLoadingAll(true);
      try {
        const all = await api.getAllStations();
        allStationsRef.current = all;
        setResults(all);
        setIsOpen(true);
      } catch {
        // Quietly fall back to normal typing-based search if the full
        // list fails to load — not a hard error for the page.
      } finally {
        setLoadingAll(false);
      }
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", marginBottom: 4, fontFamily: "var(--font-display)" }}>
        {label.toUpperCase()}
      </label>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder={browsable ? "Type or scroll to browse…" : "Station name…"}
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
      {isOpen && loadingAll && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            padding: "10px 12px",
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
            color: "var(--text-dim)",
          }}
        >
          Loading stations…
        </div>
      )}
      {isOpen && !loadingAll && results.length > 0 && (
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
            maxHeight: 260,
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
