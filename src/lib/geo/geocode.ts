/**
 * Birth-place geocoding via OpenStreetMap Nominatim.
 *
 * Usage-policy compliance (https://operations.osmfoundation.org/policies/nominatim/):
 *  - identifying User-Agent (stock library agents are not allowed)
 *  - absolute maximum of 1 request per second (enforced by a global queue)
 *  - results cached permanently in SQLite; repeated searches never hit the API
 *  - no per-keystroke autocomplete against the API (the policy forbids it):
 *    the UI only calls the API on an explicit search, while as-you-type
 *    suggestions come from the local cache and saved people
 *  - "© OpenStreetMap contributors" attribution is shown next to results
 */
import { db } from "../db";
import { lookupTimezone } from "../astro/time";

export interface Place {
  displayName: string;
  /** Short label, e.g. "Ulm, Baden-Württemberg, Germany" */
  label: string;
  lat: number;
  lon: number;
  type: string;
  tz: string;
  source: "nominatim" | "cache" | "saved";
}

const ENDPOINT = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const USER_AGENT = `CelestialOracle/0.1 (personal astrology workstation${process.env.NOMINATIM_CONTACT ? `; ${process.env.NOMINATIM_CONTACT}` : ""})`;

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  addresstype?: string;
  address?: Record<string, string>;
}

function shortLabel(r: NominatimResult): string {
  const a = r.address ?? {};
  const locality = a.city || a.town || a.village || a.hamlet || a.municipality || a.suburb || a.county || r.display_name.split(",")[0];
  const region = a.state || a.region || a.province || a.county;
  return [locality, region !== locality ? region : null, a.country].filter(Boolean).join(", ");
}

const normalize = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");

export async function searchPlaces(query: string): Promise<Place[]> {
  const key = normalize(query);
  if (key.length < 2) return [];
  const cached = db().prepare("SELECT json FROM geocode_cache WHERE query = ?").get(key) as { json: string } | undefined;
  if (cached) return (JSON.parse(cached.json) as Place[]).map((p) => ({ ...p, source: "cache" as const }));

  const url = `${ENDPOINT}/search?${new URLSearchParams({
    q: query.trim(),
    format: "jsonv2",
    addressdetails: "1",
    limit: "8",
    "accept-language": "en",
  })}`;
  const results = await throttled(async () => {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
    return (await res.json()) as NominatimResult[];
  });

  const places: Place[] = results.map((r) => {
    const lat = Number(r.lat), lon = Number(r.lon);
    return { displayName: r.display_name, label: shortLabel(r), lat, lon, type: r.addresstype || r.type, tz: lookupTimezone(lat, lon), source: "nominatim" };
  });
  db().prepare("INSERT OR REPLACE INTO geocode_cache (query, json) VALUES (?, ?)").run(key, JSON.stringify(places));
  return places;
}

/** Instant local suggestions (no network): cached search results + saved birth places. */
export function suggestPlaces(prefix: string, limit = 8): Place[] {
  const key = normalize(prefix);
  if (key.length < 2) return [];
  const out = new Map<string, Place>();
  const saved = db()
    .prepare("SELECT DISTINCT place_name, lat, lon, tz FROM people WHERE lower(place_name) LIKE ? LIMIT ?")
    .all(`%${key}%`, limit) as { place_name: string; lat: number; lon: number; tz: string }[];
  for (const s of saved) {
    out.set(`${s.lat.toFixed(4)},${s.lon.toFixed(4)}`, { displayName: s.place_name, label: s.place_name, lat: s.lat, lon: s.lon, type: "saved", tz: s.tz, source: "saved" });
  }
  const rows = db().prepare("SELECT json FROM geocode_cache WHERE query LIKE ? LIMIT 20").all(`${key}%`) as { json: string }[];
  for (const r of rows) {
    for (const p of JSON.parse(r.json) as Place[]) {
      const k = `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
      if (!out.has(k) && (normalize(p.displayName).includes(key) || normalize(p.label).includes(key))) out.set(k, { ...p, source: "cache" });
    }
  }
  return [...out.values()].slice(0, limit);
}
