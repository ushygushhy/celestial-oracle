/** Build a chart object from placements read off an uploaded image. */
import { SIGNS, TRADITIONAL_RULER, MODERN_RULER, PLANET_IDS, type PointId } from "../astro/constants";
import { buildPoint, houseOf, DEFAULT_CHART_SETTINGS, type ChartPoint, type NatalChart } from "../astro/chart";
import { findAspects } from "../astro/aspects";
import { findPatterns } from "../astro/patterns";
import { formatLon, norm360, separation } from "../astro/math";
import type { Extraction } from "./schema";

export const BODY_MAP: Record<string, PointId | null> = {
  sun: "sun", moon: "moon", mercury: "mercury", venus: "venus", mars: "mars", jupiter: "jupiter", saturn: "saturn",
  uranus: "uranus", neptune: "neptune", pluto: "pluto", chiron: "chiron", north_node: "trueNode", south_node: "trueSouthNode",
  lilith: "lilith", part_of_fortune: "fortune", ascendant: "asc", midheaven: "mc", descendant: "dsc", ic: "ic", vertex: "vertex", other: null,
};

export const lonOf = (sign: string, degree: number, minute: number) => SIGNS.findIndex((s) => s.id === sign) * 30 + degree + minute / 60;

export function chartFromExtraction(ex: Extraction, label: string): NatalChart {
  const sorted = [...ex.cusps].sort((a, b) => a.house - b.house);
  const cusps = sorted.length === 12 && sorted.every((c, i) => c.house === i + 1) ? sorted.map((c) => lonOf(c.sign, c.degree, c.minute)) : null;
  const points: Partial<Record<PointId, ChartPoint>> = {};
  for (const p of ex.placements) {
    const id = BODY_MAP[p.body];
    if (!id || points[id]) continue;
    const pt = buildPoint(id, { lon: lonOf(p.sign, p.degree, p.minute), speed: p.retrograde ? -0.01 : 0.01, decl: null }, { cusps, sect: null, eps: 23.44 });
    if (!cusps && p.house) pt.house = p.house;
    points[id] = pt;
  }
  if (points.asc && !points.dsc) points.dsc = buildPoint("dsc", { lon: norm360(points.asc.lon + 180) }, { cusps, sect: null, eps: 23.44 });
  if (points.mc && !points.ic) points.ic = buildPoint("ic", { lon: norm360(points.mc.lon + 180) }, { cusps, sect: null, eps: 23.44 });
  if (points.trueNode && !points.trueSouthNode) points.trueSouthNode = buildPoint("trueSouthNode", { lon: norm360(points.trueNode.lon + 180), speed: points.trueNode.speed }, { cusps, sect: null, eps: 23.44 });

  const participants = ([...PLANET_IDS, "chiron", "trueNode", "lilith", "asc", "mc"] as PointId[]).map((id) => points[id]).filter((p): p is ChartPoint => !!p);
  const aspects = findAspects(participants.map((p) => ({ id: p.id, lon: p.lon, speed: 0, signIndex: p.signIndex })), DEFAULT_CHART_SETTINGS.aspects);
  const eligible = ([...PLANET_IDS, "chiron", "asc", "mc"] as PointId[]).filter((id) => points[id]);
  const patterns = findPatterns({ aspects, eligible, signOf: (p) => points[p]!.signIndex, houseOf: (p) => points[p]!.house, elementOf: (p) => SIGNS[points[p]!.signIndex].element });

  return {
    name: label,
    placeName: ex.birthData.place ?? "",
    input: { date: ex.birthData.date ?? "", time: ex.birthData.time ?? null, lat: 0, lon: 0 },
    moment: { tz: ex.birthData.timezone ?? "", offsetMinutes: 0, offsetSource: "override", offsetLabel: ex.birthData.utcOffset ?? "", abbreviation: "", isDst: false, tzdbVersion: "", utcIso: "", jdUt: 0, jdEt: 0, timeUnknown: !points.asc, ambiguity: "none", warnings: [] },
    settings: DEFAULT_CHART_SETTINGS,
    points,
    houses: cusps ? {
      system: "P", effectiveSystem: "P", systemName: ex.houseSystem ?? "as printed", armc: 0,
      cusps: cusps.map((lon, i) => { const sign = SIGNS[Math.floor(norm360(lon) / 30)]; return { house: i + 1, lon, sign: sign.id, formatted: formatLon(lon), ruler: TRADITIONAL_RULER[sign.id], modernRuler: MODERN_RULER[sign.id] }; }),
    } : null,
    aspects,
    patterns,
    balance: { elements: { planets: { fire: [], earth: [], air: [], water: [] }, weighted: { fire: 0, earth: 0, air: 0, water: 0 }, dominant: "fire", lacking: [] }, modalities: { planets: { cardinal: [], fixed: [], mutable: [] }, weighted: { cardinal: 0, fixed: 0, mutable: 0 }, dominant: "cardinal", lacking: [] }, polarity: { yang: [], yin: [] }, hemispheres: null, quadrants: null },
    chartRuler: points.asc ? { ascSign: points.asc.sign, traditional: TRADITIONAL_RULER[points.asc.sign], modern: MODERN_RULER[points.asc.sign] !== TRADITIONAL_RULER[points.asc.sign] ? MODERN_RULER[points.asc.sign] : null } : null,
    dispositors: { final: null, mutualReceptions: [], chain: {} },
    sect: null,
    moonRange: null,
    warnings: ["Placements were read from an uploaded image and may contain reading errors."],
    engine: { ephemeris: "swiss", obliquity: 23.44 },
  };
}

export interface ComparisonRow {
  id: PointId;
  extracted: number;
  calculated: number | null;
  /** arcminutes */
  delta: number | null;
  signMatch: boolean | null;
  houseExtracted: number | null;
  houseCalculated: number | null;
}

export function compareCharts(uploaded: NatalChart, calculated: NatalChart): ComparisonRow[] {
  return (Object.values(uploaded.points).filter((p): p is ChartPoint => !!p)).map((p) => {
    const c = calculated.points[p.id] ?? (p.id === "trueNode" ? calculated.points.meanNode : undefined);
    return {
      id: p.id,
      extracted: p.lon,
      calculated: c?.lon ?? null,
      delta: c ? separation(p.lon, c.lon) * 60 : null,
      signMatch: c ? c.sign === p.sign : null,
      houseExtracted: p.house,
      houseCalculated: c?.house ?? (c && calculated.houses ? houseOf(c.lon, calculated.houses.cusps.map((x) => x.lon)) : null),
    };
  });
}
