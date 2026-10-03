"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Extraction, ExtractedPlacement } from "@/lib/upload/schema";
import { SIGN_NAMES, EXTRACT_BODIES } from "@/lib/upload/schema";
import { Frame, Panel } from "../ui/Frame";
import { Sunburst, Sparkle } from "../ui/Ornaments";
import { LocalTime } from "../ui/LocalTime";

const cap = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

interface UploadSummary { id: number; label: string; source: string | null; createdAt: string; count: number }

export function UploadView({ uploads }: { uploads: UploadSummary[] }) {
  const router = useRouter();
  const [file, setFile] = useState<{ name: string; mediaType: string; data: string; preview?: string } | null>(null);
  const [ex, setEx] = useState<Extraction | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const pick = async (f: File) => {
    setError(null);
    setEx(null);
    if (!["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"].includes(f.type)) return setError("Use a PNG, JPEG, WebP, GIF or PDF.");
    if (f.size > 20 * 1024 * 1024) return setError("That file is larger than 20 MB.");
    const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
    setFile({ name: f.name, mediaType: f.type, data: url.split(",")[1], preview: f.type.startsWith("image/") ? url : undefined });
    setLabel(f.name.replace(/\.[^.]+$/, ""));
  };

  const extract = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/upload/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaType: file.mediaType, data: file.data }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Extraction failed");
      setEx(d.extraction);
      if (d.extraction.birthData?.name) setLabel(d.extraction.birthData.name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setPlacement = (i: number, patch: Partial<ExtractedPlacement>) => setEx((e) => e && { ...e, placements: e.placements.map((p, k) => (k === i ? { ...p, ...patch } : p)) });
  const setCusp = (i: number, patch: Partial<Extraction["cusps"][number]>) => setEx((e) => e && { ...e, cusps: e.cusps.map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  const setBirth = (k: keyof Extraction["birthData"], v: string) => setEx((e) => e && { ...e, birthData: { ...e.birthData, [k]: v || null } });

  const save = async () => {
    if (!ex) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/upload/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, data: ex }) });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setError(d.error ?? "Could not save");
    router.push(`/upload/${d.id}`);
  };

  const recalc = () => {
    if (!ex) return;
    const q = new URLSearchParams();
    if (ex.birthData.name || label) q.set("name", ex.birthData.name || label);
    if (ex.birthData.date) q.set("date", ex.birthData.date);
    if (ex.birthData.time) q.set("time", ex.birthData.time);
    if (ex.birthData.place) q.set("place", ex.birthData.place);
    router.push(`/people/new?${q}`);
  };

  const canRecalc = !!(ex?.birthData.date && ex.birthData.place);

  return (
    <div className="space-y-6">
      <div>
        <p className="engraved text-[0.65rem] text-faint">Upload</p>
        <h1 className="font-masthead text-3xl font-bold tracking-wide">Read a Chart</h1>
        <p className="headline-italic mt-1 text-sm font-normal text-muted">Drop a screenshot or PDF from astro.com, Co-Star, TimePassages or any other software.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Frame title="1 · The file">
          <label
            className={`flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed p-6 text-center ${dragging ? "border-[color:var(--rule-strong)] bg-[rgb(204_168_116/0.08)]" : "border-rule"}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) pick(f); }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file */}
            {file?.preview ? <img src={file.preview} alt="Chart to read" className="max-h-80 rounded-sm border border-rule" /> : file ? <p className="text-sm">📄 {file.name}</p> : (
              <>
                <Sunburst size={48} className="text-accent" />
                <span className="text-sm text-muted">Drop a chart image or PDF here, or click to choose</span>
              </>
            )}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
          </label>
          <button className="btn btn-gilt mt-4 w-full" disabled={!file || busy} onClick={extract}>
            {busy && !ex ? "Reading the chart…" : <><Sparkle size={10} /> Extract placements</>}
          </button>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <p className="mt-3 text-xs text-faint">Claude reads the glyphs and degrees into an editable table. Image recognition can misread glyphs, so check every row — low-confidence readings are highlighted.</p>
        </Frame>

        <Panel title="Saved uploads">
          {uploads.length === 0 ? <p className="text-sm italic text-muted">None yet.</p> : (
            <ul className="space-y-1 text-sm">
              {uploads.map((u) => (
                <li key={u.id} className="flex justify-between gap-2 border-b border-rule py-1.5">
                  <Link href={`/upload/${u.id}`} className="hover:text-accent-bright">{u.label} <span className="text-xs text-faint">· {u.source ?? "unknown source"} · {u.count} placements</span></Link>
                  <LocalTime iso={u.createdAt.replace(" ", "T") + "Z"} mode="date" className="text-xs text-faint" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {ex && (
        <>
          <Frame title="2 · Check what was read" subtitle={`Source: ${ex.source} · zodiac: ${ex.zodiac}${ex.houseSystem ? ` · houses: ${ex.houseSystem}` : ""}`}>
            {ex.zodiac === "sidereal" && <p className="mb-3 text-sm text-danger">This chart appears to be sidereal; the app calculates tropical positions, so comparisons will differ by the ayanamsa.</p>}
            {ex.notes && <p className="mb-3 text-sm italic text-muted">Reader&apos;s notes: {ex.notes}</p>}
            <div className="overflow-x-auto">
              <table className="table-almanac text-sm">
                <thead><tr><th>Point</th><th>As printed</th><th>Sign</th><th>Deg</th><th>Min</th><th>House</th><th>℞</th><th>Confidence</th><th /></tr></thead>
                <tbody>
                  {ex.placements.map((p, i) => (
                    <tr key={i} className={p.confidence === "low" ? "bg-[rgb(200_85_93/0.12)]" : p.confidence === "medium" ? "bg-[rgb(204_168_116/0.06)]" : ""}>
                      <td><select className="field py-0.5 text-sm" value={p.body} onChange={(e) => setPlacement(i, { body: e.target.value as ExtractedPlacement["body"] })}>{EXTRACT_BODIES.map((b) => <option key={b} value={b}>{cap(b)}</option>)}</select></td>
                      <td className="text-xs text-faint">{p.label}</td>
                      <td><select className="field py-0.5 text-sm" value={p.sign} onChange={(e) => setPlacement(i, { sign: e.target.value as ExtractedPlacement["sign"] })}>{SIGN_NAMES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}</select></td>
                      <td><input type="number" min={0} max={29} className="field num w-16 py-0.5 text-sm" value={p.degree} onChange={(e) => setPlacement(i, { degree: Number(e.target.value) })} /></td>
                      <td><input type="number" min={0} max={59} className="field num w-16 py-0.5 text-sm" value={p.minute} onChange={(e) => setPlacement(i, { minute: Number(e.target.value) })} /></td>
                      <td><input type="number" min={1} max={12} className="field num w-14 py-0.5 text-sm" value={p.house ?? ""} onChange={(e) => setPlacement(i, { house: e.target.value ? Number(e.target.value) : null })} /></td>
                      <td><input type="checkbox" checked={p.retrograde} onChange={(e) => setPlacement(i, { retrograde: e.target.checked })} className="accent-[var(--accent)]" /></td>
                      <td className={p.confidence === "low" ? "text-danger" : "text-muted"}>{p.confidence}</td>
                      <td><button className="text-xs text-faint hover:text-danger" onClick={() => setEx((e) => e && { ...e, placements: e.placements.filter((_, k) => k !== i) })}>remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn mt-3 px-3 py-1 text-[0.65rem]" onClick={() => setEx((e) => e && { ...e, placements: [...e.placements, { body: "other", label: "added by hand", sign: "aries", degree: 0, minute: 0, house: null, retrograde: false, confidence: "high" }] })}>+ Add a row</button>
          </Frame>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="House cusps">
              {ex.cusps.length === 0 ? <p className="text-sm italic text-muted">No cusps were visible.</p> : (
                <table className="table-almanac text-sm">
                  <thead><tr><th>House</th><th>Sign</th><th>Deg</th><th>Min</th></tr></thead>
                  <tbody>
                    {ex.cusps.map((c, i) => (
                      <tr key={i}>
                        <td className="num">{c.house}</td>
                        <td><select className="field py-0.5 text-sm" value={c.sign} onChange={(e) => setCusp(i, { sign: e.target.value as typeof c.sign })}>{SIGN_NAMES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}</select></td>
                        <td><input type="number" className="field num w-16 py-0.5 text-sm" value={c.degree} onChange={(e) => setCusp(i, { degree: Number(e.target.value) })} /></td>
                        <td><input type="number" className="field num w-16 py-0.5 text-sm" value={c.minute} onChange={(e) => setCusp(i, { minute: Number(e.target.value) })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
            <Panel title="Birth data found">
              <div className="grid gap-2 sm:grid-cols-2">
                {(["name", "date", "time", "place", "timezone", "utcOffset", "latitude", "longitude"] as const).map((k) => (
                  <label key={k}><span className="label">{cap(k)}</span><input className="field py-1 text-sm" value={ex.birthData[k] ?? ""} onChange={(e) => setBirth(k, e.target.value)} placeholder={k === "date" ? "YYYY-MM-DD" : k === "time" ? "HH:mm" : ""} /></label>
                ))}
              </div>
            </Panel>
          </div>

          <Frame title="3 · Keep it">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-64 flex-1"><span className="label">Label</span><input className="field" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
              <button className="btn btn-gilt" disabled={busy || !label.trim()} onClick={save}>Save this chart</button>
              <button className="btn" disabled={!canRecalc} onClick={recalc} title={canRecalc ? "Cast the chart from the birth data with the Swiss Ephemeris" : "Needs at least a birth date and place"}>Recalculate from birth data</button>
            </div>
            <p className="mt-2 text-xs text-faint">Recalculating casts the chart from scratch with the Swiss Ephemeris — more accurate than any screenshot. You can then compare it with the saved upload to catch reading errors.</p>
          </Frame>
        </>
      )}
    </div>
  );
}
