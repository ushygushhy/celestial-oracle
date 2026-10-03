"use client";
import type { NatalChart } from "@/lib/astro/chart";
import { POINTS, SIGNS, type Element, type Modality, type PointId } from "@/lib/astro/constants";
import { elementColor } from "@/lib/design/tokens";
import { ordinal } from "@/lib/astro/patterns";
import { formatArc } from "@/lib/astro/math";
import { PointGlyph, SignGlyph } from "./Glyph";
import { Position } from "./ChartTables";
import { Panel } from "../ui/Frame";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function BirthDataCard({ chart }: { chart: NatalChart }) {
  const m = chart.moment;
  const rows: [string, React.ReactNode][] = [
    ["Local time", <span key="t" className="num">{chart.input.date} {m.timeUnknown ? <em className="text-danger">time unknown (noon)</em> : chart.input.time}</span>],
    ["Place", <span key="p">{chart.placeName} <span className="num text-xs text-faint">{Math.abs(chart.input.lat).toFixed(4)}°{chart.input.lat >= 0 ? "N" : "S"} {Math.abs(chart.input.lon).toFixed(4)}°{chart.input.lon >= 0 ? "E" : "W"}</span></span>],
    ["Zone", <span key="z" className="num">{m.tz} · <b className="text-accent-bright">{m.abbreviation || "—"}</b> {m.offsetLabel}{m.isDst ? " (DST)" : ""}{m.offsetSource === "override" ? " (manual)" : ""}</span>],
    ["Universal time", <span key="u" className="num">{m.utcIso.replace("T", " ").replace(/\.000Z$/, " UT")}</span>],
    ["Julian day (UT)", <span key="j" className="num">{m.jdUt.toFixed(6)}</span>],
    ["Houses", <span key="h">{chart.houses ? `${chart.houses.systemName}${chart.houses.effectiveSystem !== chart.houses.system ? " (fallback)" : ""}` : "—"} · {chart.sect ? `${cap(chart.sect)} chart` : "sect unknown"}</span>],
    ["Engine", <span key="e" className="text-xs text-faint">Swiss Ephemeris {chart.engine.ephemeris === "swiss" ? "(DE441 files)" : "(Moshier)"} · tzdb {m.tzdbVersion}</span>],
  ];
  return (
    <Panel title="Birth Data">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="engraved pt-0.5 text-[0.6rem] text-faint">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {chart.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-rule pt-2 text-xs italic text-muted">
          {chart.warnings.map((w) => <li key={w}>✦ {w}</li>)}
        </ul>
      )}
    </Panel>
  );
}

function RulerRow({ chart, id, label, onSelect }: { chart: NatalChart; id: PointId; label: string; onSelect: (id: PointId) => void }) {
  const p = chart.points[id]!;
  const asp = chart.aspects.filter((a) => a.a === id || a.b === id).slice(0, 4);
  return (
    <button onClick={() => onSelect(id)} className="block w-full rounded-sm px-2 py-2 text-left hover:bg-[rgb(204_168_116/0.08)]">
      <div className="flex items-baseline justify-between gap-2">
        <span><span className="engraved text-[0.6rem] text-faint">{label}</span> <PointGlyph id={id} className="text-accent-bright" /> {POINTS[id].name}</span>
        <span className="text-sm text-muted">{ordinal(p.house ?? 0)} house{p.retrograde ? " · ℞" : ""}</span>
      </div>
      <div className="mt-0.5 text-sm"><Position lon={p.lon} seconds /></div>
      <div className="mt-0.5 text-xs text-faint">
        {p.dignity?.label && p.dignity.label !== "—" ? `${p.dignity.label} · ` : ""}
        {asp.map((a) => `${a.type} ${POINTS[a.a === id ? a.b : a.a].name} ${formatArc(a.orb)}`).join(" · ") || "no aspects"}
      </div>
    </button>
  );
}

export function ChartRulerCard({ chart, onSelect }: { chart: NatalChart; onSelect: (id: PointId) => void }) {
  if (!chart.chartRuler) return null;
  const { ascSign, traditional, modern } = chart.chartRuler;
  const sign = SIGNS.find((s) => s.id === ascSign)!;
  return (
    <Panel title="Chart Ruler">
      <p className="mb-1 text-sm text-muted">
        Ascendant in <SignGlyph sign={ascSign} /> {sign.name} → ruled by
      </p>
      <RulerRow chart={chart} id={traditional} label="Traditional" onSelect={onSelect} />
      {modern && <RulerRow chart={chart} id={modern} label="Modern" onSelect={onSelect} />}
    </Panel>
  );
}

export function PatternsCard({ chart, onSelect }: { chart: NatalChart; onSelect: (index: number) => void }) {
  return (
    <Panel title="Aspect Patterns">
      {chart.patterns.length === 0 ? (
        <p className="text-sm italic text-muted">No major configurations with current orbs.</p>
      ) : (
        <ul className="space-y-1">
          {chart.patterns.map((p, i) => (
            <li key={i}>
              <button onClick={() => onSelect(i)} className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-[rgb(204_168_116/0.08)]">
                <span className="engraved text-[0.72rem] text-accent-bright">{p.name}</span>
                <span className="ml-2 text-base tracking-wider">
                  {p.points.map((id) => <span key={id} title={POINTS[id].name} className={`mr-1 ${p.apex === id ? "text-accent-bright underline decoration-dotted underline-offset-4" : ""}`}><PointGlyph id={id} /></span>)}
                </span>
                {(p.detail || p.tightness !== undefined) && (
                  <span className="block text-xs text-faint">{[p.detail, p.apex ? `apex ${POINTS[p.apex].name}` : null, p.tightness !== undefined ? `avg orb ${formatArc(p.tightness)}` : null].filter(Boolean).join(" · ")}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Bar({ label, value, max, color, names }: { label: string; value: number; max: number; color: string; names: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2 text-sm" title={names}>
      <span className="engraved text-[0.62rem] text-muted">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-surface-sunken">
        <span className="block h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
      <span className="num text-right text-xs text-faint">{value}</span>
    </div>
  );
}

export function BalanceCard({ chart }: { chart: NatalChart }) {
  const b = chart.balance;
  const els: Element[] = ["fire", "earth", "air", "water"];
  const mods: Modality[] = ["cardinal", "fixed", "mutable"];
  const maxE = Math.max(...els.map((e) => b.elements.weighted[e]), 1);
  const maxM = Math.max(...mods.map((m) => b.modalities.weighted[m]), 1);
  const names = (ids: PointId[]) => ids.map((i) => POINTS[i].name).join(", ") || "none";
  return (
    <Panel title="Balance">
      <div className="space-y-1.5">
        {els.map((e) => <Bar key={e} label={e} value={b.elements.weighted[e]} max={maxE} color={elementColor[e]} names={`${b.elements.planets[e].length} planets: ${names(b.elements.planets[e])}`} />)}
      </div>
      <div className="my-3 rule-hair" />
      <div className="space-y-1.5">
        {mods.map((m) => <Bar key={m} label={m} value={b.modalities.weighted[m]} max={maxM} color="var(--accent)" names={`${b.modalities.planets[m].length} planets: ${names(b.modalities.planets[m])}`} />)}
      </div>
      <p className="mt-3 text-xs text-faint">
        Weighted: luminaries &amp; Ascendant ×2, personal planets ×1.5, social ×1, outer ×0.5. Dominant {b.elements.dominant} / {b.modalities.dominant}
        {b.elements.lacking.length ? `; no planets in ${b.elements.lacking.join(", ")}` : ""}.
      </p>
      {b.hemispheres && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
          {([
            ["Above horizon", b.hemispheres.south],
            ["Below horizon", b.hemispheres.north],
            ["Eastern (self)", b.hemispheres.east],
            ["Western (others)", b.hemispheres.west],
          ] as [string, PointId[]][]).map(([k, v]) => (
            <div key={k} className="panel px-2 py-1.5" title={names(v)}>
              <div className="engraved text-[0.55rem] text-faint">{k}</div>
              <div className="num text-lg text-accent-bright">{v.length}</div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        Final dispositor: <span className="text-text">{chart.dispositors.final ? cap(chart.dispositors.final) : "none (loop or several)"}</span>
        {chart.dispositors.mutualReceptions.length > 0 && <> · Mutual reception: {chart.dispositors.mutualReceptions.map(([a, b2]) => `${cap(a)}–${cap(b2)}`).join(", ")}</>}
      </p>
    </Panel>
  );
}
