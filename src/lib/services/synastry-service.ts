/**
 * Synastry (two charts compared) and the midpoint composite chart.
 */
import { MODERN_RULER, PLANET_IDS, POINTS, SIGNS, TRADITIONAL_RULER, ASPECTS, type PointId } from "../astro/constants";
import { buildPoint, DEFAULT_CHART_SETTINGS, type ChartPoint, type NatalChart } from "../astro/chart";
import { calcHousesArmc } from "../astro/ephemeris";
import { findAspects, type Aspect } from "../astro/aspects";
import { findPatterns } from "../astro/patterns";
import { formatArc, formatLon, midpoint, norm360 } from "../astro/math";
import { buildOverlay, type Overlay } from "./overlay-service";
import { chartContext } from "../ai/context";

const COMPOSITE_IDS: PointId[] = [...PLANET_IDS, "chiron", "trueNode", "lilith"];

/**
 * Midpoint composite: each planet at the nearer midpoint of the two natal
 * positions; houses derived from the midpoint of the two ARMCs at the mean
 * latitude (so the composite Ascendant agrees with the composite MC).
 */
export function compositeChart(a: NatalChart, b: NatalChart): NatalChart {
  const eps = (a.engine.obliquity + b.engine.obliquity) / 2;
  let cusps: number[] | null = null;
  let angles: { asc: number; mc: number; vertex: number } | null = null;
  if (a.houses && b.houses) {
    const armc = midpoint(a.houses.armc, b.houses.armc);
    const lat = (a.input.lat + b.input.lat) / 2;
    const h = calcHousesArmc(armc, lat, eps, a.houses.effectiveSystem);
    cusps = h.cusps;
    angles = { asc: h.asc, mc: h.mc, vertex: h.vertex };
  }
  const points: Partial<Record<PointId, ChartPoint>> = {};
  for (const id of COMPOSITE_IDS) {
    const pa = a.points[id], pb = b.points[id];
    if (!pa || !pb) continue;
    points[id] = buildPoint(id, { lon: midpoint(pa.lon, pb.lon), speed: (pa.speed + pb.speed) / 2, decl: null }, { cusps, sect: null, eps });
  }
  if (points.trueNode) points.trueSouthNode = buildPoint("trueSouthNode", { lon: norm360(points.trueNode.lon + 180), speed: points.trueNode.speed }, { cusps, sect: null, eps });
  if (angles) {
    points.asc = buildPoint("asc", { lon: angles.asc }, { cusps, sect: null, eps });
    points.mc = buildPoint("mc", { lon: angles.mc }, { cusps, sect: null, eps });
    points.dsc = buildPoint("dsc", { lon: norm360(angles.asc + 180) }, { cusps, sect: null, eps });
    points.ic = buildPoint("ic", { lon: norm360(angles.mc + 180) }, { cusps, sect: null, eps });
  }
  const participants = ([...PLANET_IDS, "chiron", "trueNode", "lilith", "asc", "mc"] as PointId[]).map((id) => points[id]).filter((p): p is ChartPoint => !!p);
  const aspects = findAspects(participants.map((p) => ({ id: p.id, lon: p.lon, speed: 0, signIndex: p.signIndex })), DEFAULT_CHART_SETTINGS.aspects);
  const eligible = ([...PLANET_IDS, "chiron", "asc", "mc"] as PointId[]).filter((id) => points[id]);
  return {
    ...a,
    name: `${a.name} & ${b.name} — composite`,
    placeName: "Composite (midpoints)",
    points,
    houses: cusps ? {
      system: a.houses!.system, effectiveSystem: a.houses!.effectiveSystem, systemName: a.houses!.systemName, armc: midpoint(a.houses!.armc, b.houses!.armc),
      cusps: cusps.map((lon, i) => { const sign = SIGNS[Math.floor(norm360(lon) / 30)]; return { house: i + 1, lon, sign: sign.id, formatted: formatLon(lon), ruler: TRADITIONAL_RULER[sign.id], modernRuler: MODERN_RULER[sign.id] }; }),
    } : null,
    aspects,
    patterns: findPatterns({ aspects, eligible, signOf: (p) => points[p]!.signIndex, houseOf: (p) => points[p]!.house, elementOf: (p) => SIGNS[points[p]!.signIndex].element }),
    chartRuler: points.asc ? { ascSign: points.asc.sign, traditional: TRADITIONAL_RULER[points.asc.sign], modern: MODERN_RULER[points.asc.sign] !== TRADITIONAL_RULER[points.asc.sign] ? MODERN_RULER[points.asc.sign] : null } : null,
    sect: null,
    moonRange: null,
    warnings: [!cusps ? "Composite houses need both birth times." : "Composite houses derived from the midpoint of the two ARMCs at the mean latitude."],
  };
}

export interface Synastry {
  a: NatalChart;
  b: NatalChart;
  /** B's planets in A's houses + aspects B → A */
  bOnA: Overlay;
  /** A's planets in B's houses + aspects A → B */
  aOnB: Overlay;
  composite: NatalChart;
}

export function synastry(a: NatalChart, b: NatalChart): Synastry {
  return { a, b, bOnA: buildOverlay(a, "synastry", { partner: b }), aOnB: buildOverlay(b, "synastry", { partner: a }), composite: compositeChart(a, b) };
}

const KEY: PointId[] = ["sun", "moon", "venus", "mars", "asc", "mc"];

/** Weight of an inter-aspect, for ranking the strongest contacts. */
export function contactWeight(asp: Aspect) {
  let w = asp.strength * (ASPECTS[asp.type].major ? 1 : 0.4);
  if (KEY.includes(asp.a)) w += 0.5;
  if (KEY.includes(asp.b)) w += 0.5;
  if (asp.type === "conjunction" || asp.type === "opposition") w += 0.2;
  return w;
}

export function synastryFacts(s: Synastry, focus?: { a: PointId; b: PointId; type: string } | null): string {
  const n = (id: PointId) => POINTS[id].name;
  const L: string[] = [];
  L.push(`SYNASTRY between ${s.a.name} (A) and ${s.b.name} (B). Inter-aspects use synastry orbs (7° conj/opp, 6° square/trine, 4° sextile, luminaries +1°).`);
  if (focus) {
    const asp = s.bOnA.aspects.find((x) => x.a === focus.a && x.b === focus.b && x.type === focus.type);
    if (asp) L.push(`FOCUS CONTACT: ${s.b.name}'s ${n(asp.a)} ${asp.type} ${s.a.name}'s ${n(asp.b)} (orb ${formatArc(asp.orb)}).`);
  }
  L.push("", `Inter-aspects (B's point → A's point), strongest first:`);
  for (const asp of [...s.bOnA.aspects].sort((x, y) => contactWeight(y) - contactWeight(x)).slice(0, 40)) {
    L.push(`- B ${n(asp.a)} ${asp.type} A ${n(asp.b)} (orb ${formatArc(asp.orb)})`);
  }
  if (s.a.houses) L.push("", `${s.b.name}'s planets in ${s.a.name}'s houses: ${s.bOnA.points.filter((p) => p.house).map((p) => `${n(p.id)} → ${p.house}`).join(", ")}`);
  if (s.b.houses) L.push(`${s.a.name}'s planets in ${s.b.name}'s houses: ${s.aOnB.points.filter((p) => p.house).map((p) => `${n(p.id)} → ${p.house}`).join(", ")}`);
  const c = s.composite;
  L.push("", `Composite (midpoints): ${(["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "asc", "mc"] as PointId[]).filter((id) => c.points[id]).map((id) => `${n(id)} ${c.points[id]!.formatted}${c.points[id]!.house ? ` (h${c.points[id]!.house})` : ""}`).join("; ")}`);
  L.push(`Composite aspects: ${c.aspects.filter((x) => x.major).slice(0, 15).map((x) => `${n(x.a)} ${x.type} ${n(x.b)} (${formatArc(x.orb)})`).join("; ")}`);
  L.push("", "<chart_A>", chartContext(s.a), "</chart_A>", "<chart_B>", chartContext(s.b), "</chart_B>");
  return L.join("\n");
}
