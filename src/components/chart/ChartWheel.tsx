"use client";
import { useMemo } from "react";
import type { MouseEvent } from "react";
import type { NatalChart, ChartPoint } from "@/lib/astro/chart";
import type { Aspect } from "@/lib/astro/aspects";
import { ASPECTS, SIGNS, type AspectId, type PointId } from "@/lib/astro/constants";
import { zodiacPosition } from "@/lib/astro/math";
import { aspectColor, elementColor, elementFill, wheel as W, TEXT_VS } from "@/lib/design/tokens";
import { polar, ringSegment, spreadLongitudes, norm } from "./wheel-geometry";

export type WheelTarget =
  | { kind: "point"; id: PointId; ring: "natal" | "outer" }
  | { kind: "house"; house: number }
  | { kind: "aspect"; a: PointId; b: PointId; type: AspectId; cross: boolean };

export interface WheelOuter {
  label: string;
  points: ChartPoint[];
  /** CSS color for the outer ring's glyphs */
  color: string;
}

interface Props {
  chart: NatalChart;
  points: ChartPoint[];
  /** Lines to draw in the centre; `cross` = a is an outer-ring point, b natal */
  aspects: Aspect[];
  cross?: boolean;
  outer?: WheelOuter | null;
  focus?: { id: PointId; ring: "natal" | "outer" } | null;
  onHover?: (t: WheelTarget | null, e?: MouseEvent) => void;
  onSelect?: (t: WheelTarget) => void;
}

const C = 500;
const ANGLE_IDS: PointId[] = ["asc", "mc", "dsc", "ic"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const degLabel = (lon: number) => {
  const z = zodiacPosition(lon);
  return `${z.displayDeg}°${pad2(z.displayMin)}'`;
};
const isLuminary = (id: PointId) => id === "sun" || id === "moon";
const isMinorPoint = (id: PointId) => ["trueNode", "trueSouthNode", "meanNode", "meanSouthNode", "lilith", "fortune", "vertex", "chiron"].includes(id);

export function ChartWheel({ chart, points, aspects, cross = false, outer = null, focus = null, onHover, onSelect }: Props) {
  const hasOuter = !!outer;
  const R = hasOuter
    ? { edge: 478, oGlyph: 452, oLabel: 424, zo: 398, zi: 340, numeral: 357, sign: 381, glyph: 306, label: 282, min: 268, retro: 254, hOut: 240, hIn: 214, asp: 214, glyphSize: 22, signSize: 22, numSize: 8.5, labelSize: 10.5 }
    : { edge: 470, oGlyph: 0, oLabel: 0, zo: 470, zi: 400, numeral: 421, sign: 447, glyph: 362, label: 335, min: 318, retro: 300, hOut: 284, hIn: 254, asp: 254, glyphSize: 26, signSize: 28, numSize: 10, labelSize: 12.5 };

  const asc = chart.points.asc?.lon;
  const rotation = asc ?? 0; // Ascendant at 9 o'clock; 0° Aries there when time is unknown
  const P = (r: number, lon: number) => polar(C, C, r, lon, rotation);

  const ringPoints = useMemo(() => points.filter((p) => !ANGLE_IDS.includes(p.id)), [points]);
  const display = useMemo(
    () => spreadLongitudes(ringPoints.map((p) => p.lon), (R.glyphSize * 1.3 / R.glyph) * (180 / Math.PI)),
    [ringPoints, R.glyph, R.glyphSize],
  );
  const outerDisplay = useMemo(
    () => (outer ? spreadLongitudes(outer.points.map((p) => p.lon), (R.glyphSize * 1.25 / R.oGlyph) * (180 / Math.PI)) : []),
    [outer, R.glyphSize, R.oGlyph],
  );

  const natalLon = (id: PointId) => chart.points[id]?.lon;
  const outerLon = (id: PointId) => outer?.points.find((p) => p.id === id)?.lon;

  const cusps = chart.houses?.cusps ?? null;
  const quadrant = chart.houses ? !["W", "E"].includes(chart.houses.effectiveSystem) : false;

  const involves = (a: Aspect) => {
    if (!focus) return true;
    if (cross) return focus.ring === "outer" ? a.a === focus.id : a.b === focus.id;
    return a.a === focus.id || a.b === focus.id;
  };

  const hover = (t: WheelTarget | null) => (e: MouseEvent) => onHover?.(t, e);

  return (
    <svg viewBox="-75 -75 1150 1150" className="h-auto w-full select-none" role="img" aria-label={`Natal chart wheel for ${chart.name}`}>
      <defs>
        <radialGradient id="wheel-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-gold-400)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--color-gold-400)" stopOpacity="0" />
        </radialGradient>
        <pattern id="stipple" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="0.7" fill="var(--wheel-line-faint)" />
        </pattern>
        <marker id="axis-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 1 L10 5 L0 9 z" fill={W.angle} />
        </marker>
      </defs>

      {/* Backdrop */}
      <circle cx={C} cy={C} r={R.edge + 6} fill="url(#wheel-glow)" />
      <circle cx={C} cy={C} r={R.edge} fill={W.bg} stroke={W.line} strokeWidth={1.4} />
      {hasOuter && <circle cx={C} cy={C} r={R.edge - 4} fill="none" stroke={W.lineFaint} strokeWidth={0.6} />}

      {/* Zodiac band */}
      {SIGNS.map((s) => (
        <g key={s.id}>
          <path d={ringSegment(C, C, R.zo, R.zi, s.index * 30, s.index * 30 + 30, rotation)} fill={elementFill[s.element]} stroke={W.line} strokeWidth={0.9} />
          {(() => {
            const g = P(R.sign, s.index * 30 + 15);
            return (
              <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize={R.signSize} fill={elementColor[s.element]} style={{ fontFamily: "var(--font-glyph)" }}>
                {s.glyph + TEXT_VS}
              </text>
            );
          })()}
        </g>
      ))}

      {/* Degree scale: every degree ticked, labelled every 5° */}
      {Array.from({ length: 360 }, (_, d) => {
        const len = d % 10 === 0 ? 12 : d % 5 === 0 ? 8 : 4;
        const a = P(R.zi, d), b = P(R.zi + len * (hasOuter ? 0.85 : 1), d);
        return <line key={d} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={d % 5 === 0 ? W.line : W.lineFaint} strokeWidth={d % 10 === 0 ? 1 : 0.6} />;
      })}
      {Array.from({ length: 72 }, (_, k) => {
        const d = k * 5;
        const inSign = d % 30;
        if (inSign === 0) return null;
        const p = P(R.numeral, d);
        return (
          <text key={d} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={R.numSize} fill={inSign % 10 === 0 ? W.line : W.lineFaint} className="num" style={{ fontFamily: "var(--font-serif)" }}>
            {inSign}
          </text>
        );
      })}
      <circle cx={C} cy={C} r={R.zi} fill="none" stroke={W.line} strokeWidth={1} />

      {/* Planet ring + house ring */}
      <circle cx={C} cy={C} r={R.hOut} fill="none" stroke={W.lineFaint} strokeWidth={0.8} />
      <circle cx={C} cy={C} r={R.asp} fill={W.center} stroke={W.line} strokeWidth={1} />
      <circle cx={C} cy={C} r={R.asp - 2} fill="url(#stipple)" opacity={0.6} />

      {/* House cusps */}
      {cusps?.map((c, i) => {
        const isAngle = quadrant && (i === 0 || i === 3 || i === 6 || i === 9);
        const a = P(R.zi, c.lon), b = P(R.hIn, c.lon);
        const next = cusps[(i + 1) % 12].lon;
        const mid = c.lon + norm(next - c.lon) / 2;
        const n = P((R.hOut + R.hIn) / 2, mid);
        return (
          <g key={c.house}>
            {!isAngle && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={W.line} strokeWidth={0.8} strokeDasharray={quadrant ? undefined : "3 3"} opacity={0.7} />}
            <g className="cursor-pointer" onMouseEnter={hover({ kind: "house", house: c.house })} onMouseLeave={hover(null)} onClick={() => onSelect?.({ kind: "house", house: c.house })}>
              <circle cx={n.x} cy={n.y} r={13} fill="transparent" />
              <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontSize={hasOuter ? 11 : 13} fill={W.line} className="num" style={{ fontFamily: "var(--font-display)" }}>
                {c.house}
              </text>
            </g>
            {!hasOuter && !(quadrant && (i === 0 || i === 9 || i === 3 || i === 6)) && (() => {
              const t = P(R.zo + 16, c.lon);
              const anchor = t.x < C - 20 ? "end" : t.x > C + 20 ? "start" : "middle";
              const z = zodiacPosition(c.lon);
              return (
                <text x={t.x} y={t.y} textAnchor={anchor} dominantBaseline="central" fontSize={13} fill="var(--text-muted)" className="num" style={{ fontFamily: "var(--font-serif)" }}>
                  {z.displayDeg}°<tspan style={{ fontFamily: "var(--font-glyph)" }} fill={elementColor[z.sign.element]}>{z.sign.glyph + TEXT_VS}</tspan>{pad2(z.displayMin)}&apos;
                </text>
              );
            })()}
          </g>
        );
      })}

      {/* Angles: ASC–DSC and MC–IC axes */}
      {chart.points.asc && chart.points.mc && (["asc", "mc", "dsc", "ic"] as PointId[]).map((id) => {
        const p = chart.points[id]!;
        const a = P(R.asp, p.lon), b = P(R.edge + (hasOuter ? 4 : 14), p.lon);
        const label = P(R.edge + (hasOuter ? 26 : 38), p.lon);
        const z = zodiacPosition(p.lon);
        const anchor = label.x < C - 20 ? "end" : label.x > C + 20 ? "start" : "middle";
        const main = id === "asc" || id === "mc";
        return (
          <g key={id} className="cursor-pointer" onMouseEnter={hover({ kind: "point", id, ring: "natal" })} onMouseLeave={hover(null)} onClick={() => onSelect?.({ kind: "point", id, ring: "natal" })}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={W.angle} strokeWidth={main ? 2.2 : 1.3} markerEnd={main ? "url(#axis-arrow)" : undefined} />
            <text x={label.x} y={label.y - 8} textAnchor={anchor} dominantBaseline="central" fontSize={15} fill={W.angle} style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
              {p.glyph}
            </text>
            <text x={label.x} y={label.y + 9} textAnchor={anchor} dominantBaseline="central" fontSize={12} fill="var(--text-muted)" className="num">
              {z.displayDeg}°<tspan style={{ fontFamily: "var(--font-glyph)" }}>{z.sign.glyph + TEXT_VS}</tspan>{pad2(z.displayMin)}&apos;
            </text>
          </g>
        );
      })}

      {/* Aspect lines */}
      <g>
        {aspects.map((asp) => {
          const la = cross ? outerLon(asp.a) : natalLon(asp.a);
          const lb = natalLon(asp.b);
          if (la === undefined || lb === undefined) return null;
          const a = P(R.asp - 3, la), b = P(R.asp - 3, lb);
          const on = involves(asp);
          const minor = !ASPECTS[asp.type].major;
          const target: WheelTarget = { kind: "aspect", a: asp.a, b: asp.b, type: asp.type, cross };
          return (
            <g key={`${asp.a}-${asp.b}-${asp.type}`} className="cursor-pointer" onMouseEnter={hover(target)} onMouseLeave={hover(null)} onClick={() => onSelect?.(target)}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={10} />
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={aspectColor[asp.type]}
                strokeWidth={(minor ? 0.9 : 1.1) + asp.strength * 1.4}
                strokeDasharray={minor ? "5 4" : cross ? "9 3" : undefined}
                opacity={on ? 0.35 + asp.strength * 0.6 : 0.08}
              />
            </g>
          );
        })}
      </g>

      {/* Natal glyphs */}
      {ringPoints.map((p, i) => {
        const shown = display[i];
        const tick1 = P(R.zi, p.lon), tick2 = P(R.zi - 9, p.lon);
        const lead = P(R.glyph + R.glyphSize * 0.7, shown);
        const g = P(R.glyph, shown), r = P(R.retro, shown);
        // Degrees read before minutes: on the right/bottom of the wheel the inward
        // direction runs right-to-left / bottom-to-top, so swap the two radii there.
        const inX = C - g.x, inY = C - g.y;
        const swap = Math.abs(inX) >= Math.abs(inY) ? inX < 0 : inY < 0;
        const l = P(swap ? R.min : R.label, shown), mm = P(swap ? R.label : R.min, shown);
        const z = zodiacPosition(p.lon);
        const dot = P(R.asp - 3, p.lon);
        const focused = focus?.ring === "natal" && focus.id === p.id;
        const dim = focus && !focused && focus.ring === "natal";
        const fill = isLuminary(p.id) ? "var(--accent-bright)" : isMinorPoint(p.id) ? "var(--text-muted)" : W.glyph;
        const target: WheelTarget = { kind: "point", id: p.id, ring: "natal" };
        return (
          <g key={p.id} className="cursor-pointer" opacity={dim ? 0.55 : 1} onMouseEnter={hover(target)} onMouseLeave={hover(null)} onClick={() => onSelect?.(target)}>
            <line x1={tick1.x} y1={tick1.y} x2={tick2.x} y2={tick2.y} stroke="var(--accent-bright)" strokeWidth={1.6} />
            <line x1={tick2.x} y1={tick2.y} x2={lead.x} y2={lead.y} stroke={W.lineFaint} strokeWidth={0.8} />
            <circle cx={dot.x} cy={dot.y} r={2.6} fill="var(--accent)" />
            <circle cx={g.x} cy={g.y} r={R.glyphSize * 0.75} fill={focused ? "rgb(204 168 116 / 0.18)" : "transparent"} stroke={focused ? "var(--accent-bright)" : "none"} />
            <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize={p.glyph.length > 1 ? R.glyphSize * 0.62 : R.glyphSize} fill={fill} style={{ fontFamily: p.glyph.length > 1 ? "var(--font-display)" : "var(--font-glyph)" }}>
              {p.glyph}
            </text>
            {/* degree and minutes stacked radially, so clustered labels stay narrow */}
            <text x={l.x} y={l.y} textAnchor="middle" dominantBaseline="central" fontSize={R.labelSize} fill={p.uncertain ? "var(--danger)" : "var(--text)"} className="num" style={{ fontFamily: "var(--font-serif)" }}>
              {z.displayDeg}°
            </text>
            <text x={mm.x} y={mm.y} textAnchor="middle" dominantBaseline="central" fontSize={R.labelSize * 0.88} fill={p.uncertain ? "var(--danger)" : "var(--text-muted)"} className="num" style={{ fontFamily: "var(--font-serif)" }}>
              {pad2(z.displayMin)}&apos;{p.uncertain ? "?" : ""}
            </text>
            {(p.retrograde && p.kind !== "node") || p.station ? (
              <text x={r.x} y={r.y} textAnchor="middle" dominantBaseline="central" fontSize={hasOuter ? 10 : 12} fill="var(--danger)" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
                {p.station ? (p.station === "retrograde" ? "SR" : "SD") : "℞"}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Outer ring (transits / progressions / partner) */}
      {outer && (
        <g>
          <circle cx={C} cy={C} r={R.zo} fill="none" stroke={W.line} strokeWidth={1.2} />
          <g transform="translate(-62 -50)">
            <circle cx={6} cy={-4} r={5} fill={outer.color} />
            <text x={18} y={0} fontSize={14} fill={outer.color} style={{ fontFamily: "var(--font-display)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Outer ring · {outer.label}
            </text>
          </g>
          {outer.points.map((p, i) => {
            const shown = outerDisplay[i];
            const t1 = P(R.zo, p.lon), t2 = P(R.zo + 8, p.lon);
            const lead = P(R.oGlyph - R.glyphSize * 0.7, shown);
            const g = P(R.oGlyph, shown), l = P(R.oLabel, shown);
            const focused = focus?.ring === "outer" && focus.id === p.id;
            const target: WheelTarget = { kind: "point", id: p.id, ring: "outer" };
            return (
              <g key={`o-${p.id}`} className="cursor-pointer" onMouseEnter={hover(target)} onMouseLeave={hover(null)} onClick={() => onSelect?.(target)}>
                <line x1={t1.x} y1={t1.y} x2={t2.x} y2={t2.y} stroke={outer.color} strokeWidth={1.6} />
                <line x1={t2.x} y1={t2.y} x2={lead.x} y2={lead.y} stroke={W.lineFaint} strokeWidth={0.7} />
                <circle cx={g.x} cy={g.y} r={R.glyphSize * 0.72} fill={focused ? "rgb(204 168 116 / 0.18)" : "transparent"} />
                <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize={p.glyph.length > 1 ? R.glyphSize * 0.6 : R.glyphSize * 0.95} fill={outer.color} style={{ fontFamily: p.glyph.length > 1 ? "var(--font-display)" : "var(--font-glyph)" }}>
                  {p.glyph}
                </text>
                <text x={l.x} y={l.y} textAnchor="middle" dominantBaseline="central" fontSize={10} fill="var(--text-muted)" className="num">
                  {degLabel(p.lon)}{p.retrograde && p.kind !== "node" ? "℞" : ""}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
