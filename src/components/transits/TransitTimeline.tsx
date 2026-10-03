"use client";
import { useMemo, useState } from "react";
import type { ReportEvent } from "@/lib/services/transit-service";
import { ASPECTS, POINTS } from "@/lib/astro/constants";
import { aspectColor } from "@/lib/design/tokens";

interface Row {
  key: string;
  events: ReportEvent[];
  heavy: boolean;
  first: number;
}

const W = 1000, LABEL = 150, ROW = 24, HEAD = 34;

/** Gantt-style transit timeline: one row per transit, bars while in orb, diamonds at exact dates. */
export function TransitTimeline({ events, startIso, endIso, onSelect }: { events: ReportEvent[]; startIso: string; endIso: string; onSelect: (e: ReportEvent) => void }) {
  const [hover, setHover] = useState<{ e: ReportEvent; x: number; y: number } | null>(null);
  const t0 = new Date(startIso).getTime(), t1 = new Date(endIso).getTime();
  const x = (iso: string | null, fallback: number) => {
    const t = iso ? new Date(iso).getTime() : fallback;
    return LABEL + ((Math.min(Math.max(t, t0), t1) - t0) / (t1 - t0)) * (W - LABEL - 8);
  };

  const rows = useMemo(() => {
    const map = new Map<string, Row>();
    const seen = new Set<string>();
    for (const e of events) {
      if (seen.has(e.key)) continue;
      seen.add(e.key);
      const key = `${e.transiting}|${e.aspect}|${e.natal}`;
      const r = map.get(key) ?? { key, events: [], heavy: false, first: Infinity };
      r.events.push(e);
      r.heavy ||= e.heavy;
      r.first = Math.min(r.first, e.entersIso ? new Date(e.entersIso).getTime() : t0);
      map.set(key, r);
    }
    return [...map.values()].sort((a, b) => Number(b.heavy) - Number(a.heavy) || a.first - b.first);
  }, [events, t0]);

  const months = useMemo(() => {
    const out: { t: number; label: string }[] = [];
    const d = new Date(t0);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + 1);
    while (d.getTime() < t1) {
      out.push({ t: d.getTime(), label: d.toLocaleDateString(undefined, { month: "short", ...(d.getMonth() === 0 ? { year: "2-digit" } : {}) }) });
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  }, [t0, t1]);

  const H = HEAD + rows.length * ROW + 8;
  if (!rows.length) return <p className="text-sm italic text-muted">No transits in this window with the current settings.</p>;

  return (
    <div className="relative overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[720px]" style={{ height: "auto" }}>
        {months.map((m) => {
          const mx = LABEL + ((m.t - t0) / (t1 - t0)) * (W - LABEL - 8);
          return (
            <g key={m.t}>
              <line x1={mx} y1={HEAD - 8} x2={mx} y2={H} stroke="var(--rule)" strokeWidth={0.6} />
              <text x={mx + 3} y={HEAD - 14} fontSize={10} fill="var(--text-muted)" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>{m.label}</text>
            </g>
          );
        })}
        <line x1={LABEL} y1={HEAD - 10} x2={LABEL} y2={H} stroke="var(--accent-bright)" strokeWidth={1.2} />
        <text x={LABEL + 3} y={10} fontSize={9} fill="var(--accent-bright)" style={{ fontFamily: "var(--font-display)" }}>NOW</text>

        {rows.map((r, i) => {
          const y = HEAD + i * ROW;
          const sample = r.events[0];
          return (
            <g key={r.key}>
              {i % 2 === 0 && <rect x={0} y={y} width={W} height={ROW} fill="rgb(204 168 116 / 0.035)" />}
              {r.heavy && <rect x={0} y={y + 3} width={3} height={ROW - 6} fill="var(--accent-bright)" />}
              <text x={8} y={y + ROW / 2} dominantBaseline="central" fontSize={14} fill="var(--text)">
                <tspan style={{ fontFamily: "var(--font-glyph)" }} fill="var(--accent-bright)">{POINTS[sample.transiting].glyph}</tspan>
                <tspan dx={4} style={{ fontFamily: "var(--font-glyph)" }} fill={aspectColor[sample.aspect]}>{ASPECTS[sample.aspect].glyph}</tspan>
                <tspan dx={4} style={{ fontFamily: POINTS[sample.natal].glyph.length > 1 ? "var(--font-display)" : "var(--font-glyph)" }} fontSize={POINTS[sample.natal].glyph.length > 1 ? 10 : 14}>{POINTS[sample.natal].glyph}</tspan>
                <tspan dx={6} fontSize={10} fill="var(--text-faint)" style={{ fontFamily: "var(--font-serif)" }}>{POINTS[sample.transiting].short} {sample.aspect.slice(0, 4)} {POINTS[sample.natal].short}</tspan>
              </text>
              {r.events.map((e) => {
                const xa = x(e.entersIso, t0), xb = x(e.leavesIso, t1);
                return (
                  <g
                    key={e.key}
                    className="cursor-pointer"
                    onClick={() => onSelect(e)}
                    onMouseMove={(ev) => setHover({ e, x: ev.clientX, y: ev.clientY })}
                    onMouseLeave={() => setHover(null)}
                  >
                    <rect x={xa} y={y + 6} width={Math.max(xb - xa, 2)} height={ROW - 12} rx={3} fill={aspectColor[e.aspect]} opacity={e.heavy ? 0.55 : 0.32} stroke={aspectColor[e.aspect]} strokeWidth={0.8} />
                    {e.hits.map((h) => {
                      const hx = x(h.iso, t0);
                      return <path key={h.iso} d={`M ${hx} ${y + 4} l 5 ${ROW / 2 - 4} l -5 ${ROW / 2 - 4} l -5 ${-(ROW / 2 - 4)} z`} fill={h.retrograde ? "var(--danger)" : "var(--accent-bright)"} stroke="var(--bg)" strokeWidth={0.8} />;
                    })}
                    {e.nearMisses.map((m) => {
                      const hx = x(m.iso, t0);
                      return <path key={m.iso} d={`M ${hx} ${y + 5} l 4 ${ROW / 2 - 5} l -4 ${ROW / 2 - 5} l -4 ${-(ROW / 2 - 5)} z`} fill="none" stroke="var(--accent-bright)" strokeWidth={1} />;
                    })}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div className="pointer-events-none fixed z-30" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <div className="panel !bg-surface-strong px-3 py-2 text-xs shadow-[var(--shadow-card)]">
            <p className="engraved text-[0.7rem] text-accent-bright">{POINTS[hover.e.transiting].name} {hover.e.aspect} natal {POINTS[hover.e.natal].name}</p>
            <p className="text-muted">
              {hover.e.entersIso ? new Date(hover.e.entersIso).toLocaleDateString() : "before"} → {hover.e.leavesIso ? new Date(hover.e.leavesIso).toLocaleDateString() : "after"}
            </p>
            {hover.e.hits.map((h) => <p key={h.iso}>◆ exact {new Date(h.iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}{h.retrograde ? " (℞)" : ""}</p>)}
            {hover.e.nearMisses.map((m) => <p key={m.iso}>◇ station within {m.orb.toFixed(2)}° on {new Date(m.iso).toLocaleDateString()}</p>)}
            {hover.e.heavyReason && <p className="text-accent-bright">✦ {hover.e.heavyReason}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
