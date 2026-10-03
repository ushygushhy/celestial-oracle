/**
 * Natal chart computation. Pure function of (birth data, settings).
 */
import {
  MODERN_RULER, PLANET_IDS, POINTS, SIGNS, TRADITIONAL_PLANETS, TRADITIONAL_RULER,
  chaldeanFaceRuler,
  type Element, type Modality, type PlanetId, type PointId, type PointKind, type SignId,
} from "./constants";
import { calcBody, calcHouses, lonSpeed, obliquity, SWE_BODY, HOUSE_SYSTEMS, EphemerisError, type HouseSystem } from "./ephemeris";
import { resolveMoment, type BirthMoment, type ResolvedMoment } from "./time";
import { norm360, zodiacPosition, formatLon } from "./math";
import { dignityOf, type DignityReport } from "./dignities";
import { findAspects, DEFAULT_ASPECT_SETTINGS, type Aspect, type AspectBody, type AspectSettings } from "./aspects";
import { findPatterns, type AspectPattern } from "./patterns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChartSettings {
  houseSystem: HouseSystem;
  aspects: AspectSettings;
  /** "sect": day = Asc + Moon − Sun, night = Asc + Sun − Moon. "day": always day formula. */
  fortuneFormula: "sect" | "day";
  /** Which lunar node participates in aspects and patterns. */
  nodeType: "true" | "mean";
  /** Include Vertex and Part of Fortune in the aspect grid. */
  aspectsToMinorPoints: boolean;
}

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  houseSystem: "P",
  aspects: DEFAULT_ASPECT_SETTINGS,
  fortuneFormula: "sect",
  nodeType: "true",
  aspectsToMinorPoints: false,
};

export interface ChartInput extends BirthMoment {
  name?: string;
  placeName?: string;
}

export interface ChartPoint {
  id: PointId;
  name: string;
  glyph: string;
  kind: PointKind;
  lon: number;
  lat: number;
  /** deg/day (angles & derived points: 0) */
  speed: number;
  decl: number | null;
  retrograde: boolean;
  /** Within a few days of a station: "retrograde" = turning retrograde, "direct" = turning direct */
  station: "retrograde" | "direct" | null;
  /** Declination beyond the Sun's maximum (the obliquity) */
  outOfBounds: boolean;
  sign: SignId;
  signIndex: number;
  degInSign: number;
  /** "14°27' Scorpio" */
  formatted: string;
  /** "14°27'05\" Scorpio" */
  formattedPrecise: string;
  house: number | null;
  decan: { number: 1 | 2 | 3; ruler: PlanetId; modernRuler: PlanetId; faceRuler: PlanetId };
  dignity: DignityReport | null;
  /** Position unreliable (e.g. Moon with unknown birth time) */
  uncertain: boolean;
}

export interface HouseCusp {
  house: number;
  lon: number;
  sign: SignId;
  formatted: string;
  ruler: PlanetId;
  modernRuler: PlanetId;
}

export interface ElementBalance {
  planets: Record<Element, PointId[]>;
  weighted: Record<Element, number>;
  dominant: Element;
  lacking: Element[];
}
export interface ModalityBalance {
  planets: Record<Modality, PointId[]>;
  weighted: Record<Modality, number>;
  dominant: Modality;
  lacking: Modality[];
}

export interface Balance {
  elements: ElementBalance;
  modalities: ModalityBalance;
  polarity: { yang: PointId[]; yin: PointId[] };
  /** null when birth time is unknown */
  hemispheres: { north: PointId[]; south: PointId[]; east: PointId[]; west: PointId[] } | null;
  quadrants: [PointId[], PointId[], PointId[], PointId[]] | null;
}

export interface ChartRuler {
  ascSign: SignId;
  traditional: PlanetId;
  modern: PlanetId | null;
}

export interface Dispositors {
  /** Planet that disposes of every planet (rules its own sign); null if the chain loops */
  final: PlanetId | null;
  mutualReceptions: [PlanetId, PlanetId][];
  chain: Partial<Record<PlanetId, PlanetId>>;
}

export interface NatalChart {
  name: string;
  placeName: string;
  input: ChartInput;
  moment: ResolvedMoment;
  settings: ChartSettings;
  points: Partial<Record<PointId, ChartPoint>>;
  houses: {
    system: HouseSystem;
    effectiveSystem: HouseSystem;
    systemName: string;
    cusps: HouseCusp[];
    /** Sidereal time as an angle (used for progressed angles) */
    armc: number;
  } | null;
  aspects: Aspect[];
  patterns: AspectPattern[];
  balance: Balance;
  chartRuler: ChartRuler | null;
  dispositors: Dispositors;
  sect: "day" | "night" | null;
  /** With unknown birth time: the Moon's range over the birth date */
  moonRange: { from: number; to: number; signs: SignId[] } | null;
  warnings: string[];
  engine: { ephemeris: "swiss" | "moshier"; obliquity: number };
}

// ---------------------------------------------------------------------------

const COMPUTED: PointId[] = [...PLANET_IDS, "chiron", "trueNode", "meanNode", "lilith"];

/** Days either side used to decide that a planet is "stationary". */
const STATION_WINDOW: Partial<Record<PointId, number>> = {
  mercury: 2, venus: 3, mars: 4, jupiter: 6, saturn: 7, uranus: 8, neptune: 8, pluto: 8, chiron: 7,
};

const WEIGHT: Partial<Record<PointId, number>> = {
  sun: 2, moon: 2, asc: 2, mercury: 1.5, venus: 1.5, mars: 1.5, jupiter: 1, saturn: 1, uranus: 0.5, neptune: 0.5, pluto: 0.5,
};

export function houseOf(lon: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const span = norm360(cusps[(i + 1) % 12] - start);
    if (norm360(lon - start) < span) return i + 1;
  }
  return 12;
}

export function stationState(jdUt: number, id: PointId): ChartPoint["station"] {
  const window = STATION_WINDOW[id];
  const body = SWE_BODY[id];
  if (!window || body === undefined) return null;
  const before = lonSpeed(jdUt - window, body)[1];
  const after = lonSpeed(jdUt + window, body)[1];
  if (before > 0 && after < 0) return "retrograde";
  if (before < 0 && after > 0) return "direct";
  return null;
}

export function buildPoint(
  id: PointId,
  raw: { lon: number; lat?: number; speed?: number; decl?: number | null },
  opts: { cusps: number[] | null; sect: "day" | "night" | null; eps: number; station?: ChartPoint["station"]; uncertain?: boolean },
): ChartPoint {
  const z = zodiacPosition(raw.lon);
  const decanNumber = (Math.floor(z.degInSign / 10) + 1) as 1 | 2 | 3;
  const decanSign = SIGNS[(z.sign.index + (decanNumber - 1) * 4) % 12];
  const info = POINTS[id];
  const speed = raw.speed ?? 0;
  const decl = raw.decl ?? null;
  return {
    id,
    name: info.name,
    glyph: info.glyph,
    kind: info.kind,
    lon: norm360(raw.lon),
    lat: raw.lat ?? 0,
    speed,
    decl,
    retrograde: speed < 0,
    station: opts.station ?? null,
    outOfBounds: decl !== null && Number.isFinite(decl) && Math.abs(decl) > opts.eps && info.kind !== "node" && info.kind !== "angle",
    sign: z.sign.id,
    signIndex: z.sign.index,
    degInSign: z.degInSign,
    formatted: formatLon(raw.lon),
    formattedPrecise: formatLon(raw.lon, "name", true),
    house: opts.cusps ? houseOf(raw.lon, opts.cusps) : null,
    decan: {
      number: decanNumber,
      ruler: TRADITIONAL_RULER[decanSign.id],
      modernRuler: MODERN_RULER[decanSign.id],
      faceRuler: chaldeanFaceRuler(raw.lon),
    },
    dignity: (PLANET_IDS as readonly string[]).includes(id) ? dignityOf(id, raw.lon, opts.sect) : null,
    uncertain: opts.uncertain ?? false,
  };
}

export function computeChart(input: ChartInput, settings: ChartSettings = DEFAULT_CHART_SETTINGS): NatalChart {
  const moment = resolveMoment(input);
  const jd = moment.jdUt;
  const warnings = [...moment.warnings];
  const eps = obliquity(jd);
  let ephemeris: "swiss" | "moshier" = "swiss";

  // 1. Raw ephemeris positions
  const raw: Partial<Record<PointId, { lon: number; lat: number; speed: number; decl: number }>> = {};
  for (const id of COMPUTED) {
    try {
      const p = calcBody(jd, SWE_BODY[id]!);
      if (p.source === "moshier") ephemeris = "moshier";
      raw[id] = p;
    } catch (e) {
      if (id === "chiron" && e instanceof EphemerisError) {
        warnings.push("Chiron is not available for this date (outside the asteroid ephemeris range).");
      } else {
        throw e;
      }
    }
  }
  if (ephemeris === "moshier") {
    warnings.push("Swiss Ephemeris data files not found for this date; using the Moshier model (accurate to about 1 arcsecond for planets).");
  }
  for (const [north, south] of [["trueNode", "trueSouthNode"], ["meanNode", "meanSouthNode"]] as const) {
    const n = raw[north]!;
    raw[south] = { lon: norm360(n.lon + 180), lat: -n.lat, speed: n.speed, decl: -n.decl };
  }

  // 2. Houses & angles (only with a known birth time)
  let houses: NatalChart["houses"] = null;
  let cusps: number[] | null = null;
  let sect: NatalChart["sect"] = null;
  if (!moment.timeUnknown) {
    const h = calcHouses(jd, input.lat, input.lon, settings.houseSystem);
    if (h.warning) warnings.push(h.warning);
    cusps = h.cusps;
    raw.asc = { lon: h.asc, lat: 0, speed: 0, decl: NaN };
    raw.mc = { lon: h.mc, lat: 0, speed: 0, decl: NaN };
    raw.dsc = { lon: norm360(h.asc + 180), lat: 0, speed: 0, decl: NaN };
    raw.ic = { lon: norm360(h.mc + 180), lat: 0, speed: 0, decl: NaN };
    raw.vertex = { lon: h.vertex, lat: 0, speed: 0, decl: NaN };

    // Sect: Sun above the horizon (between Descendant and Ascendant via the MC) = day chart
    sect = norm360(raw.sun!.lon - h.asc) >= 180 ? "day" : "night";
    const { sun, moon } = raw;
    const fortune = settings.fortuneFormula === "sect" && sect === "night"
      ? h.asc + sun!.lon - moon!.lon
      : h.asc + moon!.lon - sun!.lon;
    raw.fortune = { lon: norm360(fortune), lat: 0, speed: 0, decl: NaN };

    houses = {
      system: settings.houseSystem,
      effectiveSystem: h.effectiveSystem,
      systemName: HOUSE_SYSTEMS[h.effectiveSystem],
      armc: h.armc,
      cusps: h.cusps.map((lon, i) => {
        const sign = SIGNS[Math.floor(norm360(lon) / 30)];
        return { house: i + 1, lon, sign: sign.id, formatted: formatLon(lon), ruler: TRADITIONAL_RULER[sign.id], modernRuler: MODERN_RULER[sign.id] };
      }),
    };
  }

  // 3. Chart points
  const points: Partial<Record<PointId, ChartPoint>> = {};
  for (const [id, r] of Object.entries(raw) as [PointId, (typeof raw)[PointId]][]) {
    if (!r) continue;
    points[id] = buildPoint(id, { ...r, decl: Number.isFinite(r.decl) ? r.decl : null }, {
      cusps, sect, eps,
      station: stationState(jd, id),
      uncertain: moment.timeUnknown && id === "moon",
    });
  }

  // 4. Aspects
  const node: PointId = settings.nodeType === "true" ? "trueNode" : "meanNode";
  const participants: PointId[] = [...PLANET_IDS, "chiron", node, "lilith"];
  if (!moment.timeUnknown) {
    participants.push("asc", "mc");
    if (settings.aspectsToMinorPoints) participants.push("vertex", "fortune");
  }
  const bodies: AspectBody[] = participants
    .map((id) => points[id])
    .filter((p): p is ChartPoint => !!p)
    .map((p) => ({ id: p.id, lon: p.lon, speed: p.speed, signIndex: p.signIndex }));
  const aspects = findAspects(bodies, settings.aspects);

  // 5. Patterns
  const eligible: PointId[] = [...PLANET_IDS, "chiron"];
  if (!moment.timeUnknown) eligible.push("asc", "mc");
  const patterns = findPatterns({
    aspects,
    eligible: eligible.filter((id) => points[id]),
    signOf: (p) => points[p]!.signIndex,
    houseOf: (p) => points[p]!.house,
    elementOf: (p) => SIGNS[points[p]!.signIndex].element,
  });

  // 6. Balance, ruler, dispositors
  const balance = computeBalance(points, moment.timeUnknown);
  const chartRuler: ChartRuler | null = points.asc
    ? {
        ascSign: points.asc.sign,
        traditional: TRADITIONAL_RULER[points.asc.sign],
        modern: MODERN_RULER[points.asc.sign] !== TRADITIONAL_RULER[points.asc.sign] ? MODERN_RULER[points.asc.sign] : null,
      }
    : null;
  const dispositors = computeDispositors(points);

  // 7. Moon range when time is unknown (local midnight to midnight)
  let moonRange: NatalChart["moonRange"] = null;
  if (moment.timeUnknown) {
    const from = calcBody(jd - 0.5, SWE_BODY.moon!, false).lon;
    const to = calcBody(jd + 0.5, SWE_BODY.moon!, false).lon;
    const signs = [...new Set([Math.floor(from / 30), Math.floor(to / 30)])].map((i) => SIGNS[i].id);
    moonRange = { from, to, signs };
    if (signs.length > 1) {
      warnings.push(`The Moon changed sign on this date: it was in ${SIGNS[Math.floor(from / 30)].name} or ${SIGNS[Math.floor(to / 30)].name} depending on the birth time.`);
    }
  }

  return {
    name: input.name ?? "",
    placeName: input.placeName ?? "",
    input,
    moment,
    settings,
    points,
    houses,
    aspects,
    patterns,
    balance,
    chartRuler,
    dispositors,
    sect,
    moonRange,
    warnings,
    engine: { ephemeris, obliquity: eps },
  };
}

function computeBalance(points: Partial<Record<PointId, ChartPoint>>, timeUnknown: boolean): Balance {
  const els: Element[] = ["fire", "earth", "air", "water"];
  const mods: Modality[] = ["cardinal", "fixed", "mutable"];
  const elements = { planets: Object.fromEntries(els.map((e) => [e, []])) as unknown as Record<Element, PointId[]>, weighted: Object.fromEntries(els.map((e) => [e, 0])) as Record<Element, number> };
  const modalities = { planets: Object.fromEntries(mods.map((m) => [m, []])) as unknown as Record<Modality, PointId[]>, weighted: Object.fromEntries(mods.map((m) => [m, 0])) as Record<Modality, number> };
  const polarity = { yang: [] as PointId[], yin: [] as PointId[] };

  const counted: PointId[] = [...PLANET_IDS, ...(timeUnknown ? [] : (["asc"] as PointId[]))];
  for (const id of counted) {
    const p = points[id];
    if (!p) continue;
    const sign = SIGNS[p.signIndex];
    const w = WEIGHT[id] ?? 1;
    if (id !== "asc") {
      elements.planets[sign.element].push(id);
      modalities.planets[sign.modality].push(id);
      polarity[sign.polarity].push(id);
    }
    elements.weighted[sign.element] += w;
    modalities.weighted[sign.modality] += w;
  }
  const top = <K extends string>(rec: Record<K, number>) => (Object.entries(rec) as [K, number][]).sort((a, b) => b[1] - a[1])[0][0];
  const lackE = els.filter((e) => elements.planets[e].length === 0);
  const lackM = mods.filter((m) => modalities.planets[m].length === 0);

  let hemispheres: Balance["hemispheres"] = null;
  let quadrants: Balance["quadrants"] = null;
  if (!timeUnknown && points.asc && points.mc) {
    const asc = points.asc.lon, mc = points.mc.lon, ic = norm360(mc + 180), dsc = norm360(asc + 180);
    hemispheres = { north: [], south: [], east: [], west: [] };
    quadrants = [[], [], [], []];
    const within = (x: number, from: number, to: number) => norm360(x - from) < norm360(to - from);
    for (const id of PLANET_IDS) {
      const p = points[id];
      if (!p) continue;
      // Below the horizon = Asc → IC → Dsc (houses 1–6): "northern" hemisphere
      (within(p.lon, asc, dsc) ? hemispheres.north : hemispheres.south).push(id);
      // Eastern = MC → Asc → IC (houses 10–3)
      (within(p.lon, mc, ic) ? hemispheres.east : hemispheres.west).push(id);
      if (within(p.lon, asc, ic)) quadrants[0].push(id);
      else if (within(p.lon, ic, dsc)) quadrants[1].push(id);
      else if (within(p.lon, dsc, mc)) quadrants[2].push(id);
      else quadrants[3].push(id);
    }
  }

  return {
    elements: { ...elements, dominant: top(elements.weighted), lacking: lackE },
    modalities: { ...modalities, dominant: top(modalities.weighted), lacking: lackM },
    polarity,
    hemispheres,
    quadrants,
  };
}

function computeDispositors(points: Partial<Record<PointId, ChartPoint>>): Dispositors {
  const chain: Partial<Record<PlanetId, PlanetId>> = {};
  for (const id of TRADITIONAL_PLANETS) {
    const p = points[id];
    if (p) chain[id] = TRADITIONAL_RULER[p.sign];
  }
  const mutual: [PlanetId, PlanetId][] = [];
  for (const a of TRADITIONAL_PLANETS) {
    for (const b of TRADITIONAL_PLANETS) {
      if (a < b && chain[a] === b && chain[b] === a) mutual.push([a, b]);
    }
  }
  // Final dispositor: every chain terminates at one planet in its own sign
  const terminals = new Set<PlanetId>();
  let looped = false;
  for (const start of TRADITIONAL_PLANETS) {
    let cur: PlanetId = start;
    const visited = new Set<PlanetId>();
    while (chain[cur] && chain[cur] !== cur) {
      if (visited.has(cur)) { looped = true; break; }
      visited.add(cur);
      cur = chain[cur]!;
    }
    if (chain[cur] === cur) terminals.add(cur);
  }
  return { final: !looped && terminals.size === 1 ? [...terminals][0] : null, mutualReceptions: mutual, chain };
}
