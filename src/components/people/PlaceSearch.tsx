"use client";
import { useEffect, useRef, useState } from "react";

export interface PlaceValue {
  label: string;
  lat: number;
  lon: number;
  tz: string;
}

interface Place extends PlaceValue {
  displayName: string;
  type: string;
  source: "nominatim" | "cache" | "saved";
}

/**
 * Birth-place picker. Typing shows instant suggestions from the LOCAL cache and
 * saved people only; OpenStreetMap Nominatim is queried when you press Enter or
 * click "Search" (their usage policy forbids per-keystroke autocomplete).
 */
export function PlaceSearch({ value, onChange, initialQuery }: { value: PlaceValue | null; onChange: (p: PlaceValue | null) => void; initialQuery?: string }) {
  const [query, setQuery] = useState(value?.label ?? initialQuery ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [navigated, setNavigated] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Local suggestions as you type (no network beyond our own server/SQLite)
  useEffect(() => {
    if ((value && query === value.label) || query.trim().length < 2) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/geocode?mode=suggest&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.places ?? []);
      setHighlight(0);
      setOpen(true);
    }, 150);
    return () => clearTimeout(t);
  }, [query, value]);

  const search = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/geocode?mode=search&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      setResults(data.places ?? []);
      setSearched(true);
      setHighlight(0);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const pick = (p: Place) => {
    const v = { label: p.label || p.displayName, lat: p.lat, lon: p.lon, tz: p.tz };
    onChange(v);
    setQuery(v.label);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex gap-2">
        <input
          className="field"
          placeholder="City, region, country — then press Enter"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearched(false);
            setNavigated(false);
            if (e.target.value.trim().length < 2) setResults([]);
            if (value) onChange(null);
          }}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setNavigated(true); setHighlight((h) => Math.min(h + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setNavigated(true); setHighlight((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter") {
              e.preventDefault();
              // Enter picks a result once you've searched or arrowed to one; otherwise it searches OSM.
              if (open && results[highlight] && (searched || navigated)) pick(results[highlight]);
              else search();
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
        <button type="button" className="btn shrink-0" onClick={search} disabled={loading || query.trim().length < 2}>
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
      {value && (
        <p className="num mt-1 text-xs text-muted">
          {Math.abs(value.lat).toFixed(4)}°{value.lat >= 0 ? "N" : "S"} · {Math.abs(value.lon).toFixed(4)}°{value.lon >= 0 ? "E" : "W"} · {value.tz}
        </p>
      )}
      {open && (results.length > 0 || searched || error) && (
        <div className="panel absolute z-30 mt-1 max-h-80 w-full overflow-auto !bg-surface-strong p-1 shadow-[var(--shadow-card)]">
          {error && <p className="px-3 py-2 text-sm text-danger">{error}</p>}
          {searched && results.length === 0 && !error && <p className="px-3 py-2 text-sm italic text-muted">No places found. Try adding the country.</p>}
          {results.map((p, i) => (
            <button
              type="button"
              key={`${p.lat},${p.lon},${i}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(p)}
              className={`block w-full px-3 py-2 text-left text-sm ${i === highlight ? "bg-[rgb(204_168_116/0.12)]" : ""}`}
            >
              <span className="text-text">{p.label || p.displayName}</span>
              <span className="ml-2 text-[0.7rem] text-faint">
                {p.source === "saved" ? "saved" : p.source === "cache" ? "recent" : p.type}
              </span>
              {p.displayName !== p.label && <span className="block truncate text-xs text-faint">{p.displayName}</span>}
            </button>
          ))}
          {!searched && query.trim().length >= 2 && (
            <button type="button" onClick={search} className="block w-full border-t border-rule px-3 py-2 text-left text-sm text-accent-bright">
              Search OpenStreetMap for “{query.trim()}” ↵
            </button>
          )}
          <p className="px-3 pb-1 pt-1 text-right text-[0.65rem] text-faint">© OpenStreetMap contributors</p>
        </div>
      )}
    </div>
  );
}
