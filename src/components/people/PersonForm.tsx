"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlaceSearch, type PlaceValue } from "./PlaceSearch";
import { setActivePersonCookie } from "../layout/PersonSwitcher";

const HOUSE_SYSTEMS: Record<string, string> = {
  P: "Placidus", W: "Whole Sign", K: "Koch", E: "Equal", O: "Porphyry", R: "Regiomontanus", C: "Campanus",
};

export interface PersonFormValues {
  id?: number;
  name: string;
  fullBirthName: string;
  birthDate: string;
  birthTime: string;
  timeUnknown: boolean;
  place: PlaceValue | null;
  tzOverride: string;
  offsetOverride: string;
  houseSystem: string;
  notes: string;
}

interface MomentPreview {
  tz: string;
  offsetLabel: string;
  abbreviation: string;
  isDst: boolean;
  utcIso: string;
  offsetSource: "iana" | "lmt" | "override";
  ambiguity: "none" | "gap" | "overlap";
  warnings: string[];
  tzdbVersion: string;
  error?: string;
}

/** "+05:30" | "-4" | "-300" (minutes) → minutes east of UTC */
function parseOffset(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const hm = /^([+\-−])?(\d{1,2}):(\d{2})$/.exec(t);
  if (hm) return (hm[1] === "-" || hm[1] === "−" ? -1 : 1) * (Number(hm[2]) * 60 + Number(hm[3]));
  const n = Number(t.replace("−", "-"));
  if (!Number.isFinite(n)) return null;
  return Math.abs(n) <= 16 ? n * 60 : n; // small numbers are hours
}

export function PersonForm({ initial, initialPlaceQuery }: { initial?: PersonFormValues; initialPlaceQuery?: string }) {
  const router = useRouter();
  const [v, setV] = useState<PersonFormValues>(
    initial ?? {
      name: "", fullBirthName: "", birthDate: "", birthTime: "", timeUnknown: false, place: null,
      tzOverride: "", offsetOverride: "", houseSystem: "P", notes: "",
    },
  );
  const [preview, setPreview] = useState<MomentPreview | null>(null);
  const [advanced, setAdvanced] = useState(Boolean(initial?.tzOverride || initial?.offsetOverride));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof PersonFormValues>(k: K, val: PersonFormValues[K]) => setV((s) => ({ ...s, [k]: val }));

  // Live preview of the timezone → UTC conversion
  useEffect(() => {
    if (!v.place || !/^\d{4}-\d{2}-\d{2}$/.test(v.birthDate)) return;
    const q = new URLSearchParams({ lat: String(v.place.lat), lon: String(v.place.lon), date: v.birthDate });
    if (!v.timeUnknown && v.birthTime) q.set("time", v.birthTime);
    if (v.tzOverride.trim()) q.set("tz", v.tzOverride.trim());
    const off = parseOffset(v.offsetOverride);
    if (off !== null) q.set("offset", String(off));
    const t = setTimeout(async () => {
      const res = await fetch(`/api/timezone?${q}`);
      setPreview(await res.json());
    }, 200);
    return () => clearTimeout(t);
  }, [v.place, v.birthDate, v.birthTime, v.timeUnknown, v.tzOverride, v.offsetOverride]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!v.place) return setError("Choose a birth place from the search results.");
    if (!v.timeUnknown && !v.birthTime) return setError("Enter the birth time, or tick “time unknown”.");
    setSaving(true);
    const body = {
      name: v.name,
      fullBirthName: v.fullBirthName || null,
      birthDate: v.birthDate,
      birthTime: v.timeUnknown ? null : v.birthTime,
      placeName: v.place.label,
      lat: v.place.lat,
      lon: v.place.lon,
      tz: v.tzOverride.trim() || v.place.tz,
      utcOffsetOverride: parseOffset(v.offsetOverride),
      houseSystem: v.houseSystem,
      notes: v.notes || null,
    };
    try {
      const res = await fetch(v.id ? `/api/people/${v.id}` : "/api/people", {
        method: v.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setActivePersonCookie(data.person.id);
      router.push(`/chart/${data.person.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const previewReady = !!v.place && /^\d{4}-\d{2}-\d{2}$/.test(v.birthDate);
  const utcText = preview && !preview.error
    ? new Date(preview.utcIso).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UT")
    : null;

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">Name</span>
          <input className="field" required value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="How you'll refer to this chart" />
        </label>
        <label>
          <span className="label">Full birth name <span className="normal-case tracking-normal text-faint">(for numerology)</span></span>
          <input className="field" value={v.fullBirthName} onChange={(e) => set("fullBirthName", e.target.value)} placeholder="As on the birth certificate" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label>
          <span className="label">Birth date</span>
          <input type="date" className="field num" required min="1800-01-01" max="2399-12-31" value={v.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
        </label>
        <label>
          <span className="label">Local clock time</span>
          <input type="time" step={60} className="field num" disabled={v.timeUnknown} value={v.timeUnknown ? "" : v.birthTime} onChange={(e) => set("birthTime", e.target.value)} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-muted">
          <input type="checkbox" checked={v.timeUnknown} onChange={(e) => set("timeUnknown", e.target.checked)} className="accent-[var(--accent)]" />
          Time unknown
        </label>
      </div>

      <div>
        <span className="label">Birth place</span>
        <PlaceSearch value={v.place} onChange={(p) => set("place", p)} initialQuery={initialPlaceQuery} />
      </div>

      {previewReady && preview && (
        <div className={`panel px-4 py-3 text-sm ${preview.error ? "border-danger" : ""}`}>
          {preview.error ? (
            <p className="text-danger">{preview.error}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <span><span className="label inline">Zone </span>{preview.tz}</span>
                <span className="num"><span className="label inline">In force </span>{preview.abbreviation && <b className="text-accent-bright">{preview.abbreviation}</b>} {preview.offsetLabel}{preview.isDst ? " · daylight/summer time" : ""}</span>
                {utcText && <span className="num"><span className="label inline">Universal time </span>{utcText}</span>}
              </div>
              {preview.warnings.map((w) => (
                <p key={w} className="mt-1.5 text-xs italic text-muted">✦ {w}</p>
              ))}
              <p className="mt-1.5 text-[0.65rem] text-faint">IANA tz database {preview.tzdbVersion} (with pre-1970 backzone history)</p>
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">House system</span>
          <select className="field" value={v.houseSystem} onChange={(e) => set("houseSystem", e.target.value)}>
            {Object.entries(HOUSE_SYSTEMS).map(([k, n]) => (
              <option key={k} value={k}>{n}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="button" className="text-sm text-muted underline decoration-dotted underline-offset-4 hover:text-accent-bright" onClick={() => setAdvanced((a) => !a)}>
            {advanced ? "Hide" : "Show"} timezone overrides
          </button>
        </div>
      </div>

      {advanced && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">IANA zone override</span>
            <input className="field" value={v.tzOverride} onChange={(e) => set("tzOverride", e.target.value)} placeholder={v.place?.tz ?? "e.g. America/Chicago"} />
          </label>
          <label>
            <span className="label">Manual UTC offset <span className="normal-case tracking-normal text-faint">(skips all tz rules)</span></span>
            <input className="field num" value={v.offsetOverride} onChange={(e) => set("offsetOverride", e.target.value)} placeholder="e.g. -05:00 or +5:30" />
          </label>
        </div>
      )}

      <label>
        <span className="label">Notes</span>
        <textarea className="field min-h-20" value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Source of birth time, rectification notes…" />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" className="btn btn-gilt" disabled={saving}>
          {saving ? "Casting…" : v.id ? "Save & recast chart" : "Cast chart"}
        </button>
        <button type="button" className="btn" onClick={() => router.back()}>Cancel</button>
      </div>
    </form>
  );
}
