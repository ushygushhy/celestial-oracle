/**
 * Transit engine: transit-to-natal events with entry, every exact perfection
 * (including retrograde re-hits) and exit; heavy-hitter classification;
 * house ingresses; eclipses; lunations; void-of-course Moon.
 *
 * Each moving body is sampled once into an array and every target is searched
 * against that array; full-precision ephemeris calls are made only to refine
 * the brackets around events.
 */
import { ASPECTS, PLANET_IDS, type AspectId, type PointId } from "./constants";
import { swe, C, lonSpeed, SWE_BODY } from "./ephemeris";
import { arc, norm360, separation } from "./math";
import { bodySampler, bisect, minimise, exactPoints, type ExactHit, type NearMiss, type Sampler } from "./search";
import type { NatalChart } from "./chart";

// ---------------------------------------------------------------------------
// Sampled series
// ---------------------------------------------------------------------------

export interface Series {
  id: PointId;
  jd0: number;
  step: number;
  lon: number[];
  speed: number[];
  sample: Sampler;
}

export function sampleSeries(id: PointId, startJd: number, endJd: number, step: number, sample: Sampler = bodySampler(id)): Series {
  const n = Math.max(2, Math.ceil((endJd - startJd) / step) + 1);
  const lon = new Array<number>(n), speed = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const [l, s] = sample(startJd + i * step);
    lon[i] = l;
    speed[i] = s;
  }
  return { id, jd0: startJd, step, lon, speed, sample };
}

const jdAt = (s: Series, i: number) => s.jd0 + i * s.step;

export interface Period {
  enters: number | null;
  leaves: number | null;
  hits: ExactHit[];
  nearMisses: NearMiss[];
  minOrb: number;
}

/** Periods within `orb` of an exact point, from a sampled series. */
export function seriesPeriods(s: Series, exactPoint: number, orb: number): Period[] {
  const n = s.lon.length;
  const f = s.lon.map((l) => arc(exactPoint, l));
  const fx = (jd: number) => arc(exactPoint, s.sample(jd)[0]);
  const gx = (jd: number) => Math.abs(fx(jd)) - orb;

  // quick reject: never within orb (+ margin for motion between samples)
  let anyNear = false;
  for (let i = 0; i < n; i++) if (Math.abs(f[i]) < orb + Math.abs(s.speed[i]) * s.step + 0.5) { anyNear = true; break; }
  if (!anyNear) return [];

  const hits: ExactHit[] = [];
  const misses: NearMiss[] = [];
  const bounds: { jd: number; entering: boolean }[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = f[i], b = f[i + 1];
    if (Math.sign(a) !== Math.sign(b) && Math.abs(b - a) < 90) {
      const t = bisect(fx, jdAt(s, i), jdAt(s, i + 1), a);
      const [lon, speed] = s.sample(t);
      hits.push({ jd: t, lon, speed, retrograde: speed < 0 });
    } else if (i > 0 && Math.sign(f[i - 1]) === Math.sign(a) && Math.sign(a) === Math.sign(b) && Math.abs(a) < Math.abs(f[i - 1]) && Math.abs(a) <= Math.abs(b) && Math.abs(a) < orb) {
      const t = minimise(fx, jdAt(s, i - 1), jdAt(s, i + 1));
      const m = Math.abs(fx(t));
      if (m > 1e-4) misses.push({ jd: t, orb: m, lon: s.sample(t)[0] });
    }
    const ga = Math.abs(a) - orb, gb = Math.abs(b) - orb;
    if (ga !== 0 && Math.sign(ga) !== Math.sign(gb)) bounds.push({ jd: bisect(gx, jdAt(s, i), jdAt(s, i + 1), ga), entering: gb < 0 });
  }

  const periods: Period[] = [];
  let open: Period | null = Math.abs(f[0]) <= orb ? { enters: null, leaves: null, hits: [], nearMisses: [], minOrb: Infinity } : null;
  for (const b of bounds) {
    if (b.entering) open = { enters: b.jd, leaves: null, hits: [], nearMisses: [], minOrb: Infinity };
    else if (open) { open.leaves = b.jd; periods.push(open); open = null; }
  }
  if (open) periods.push(open);
  const inside = (p: Period, jd: number) => (p.enters === null || jd >= p.enters - 1e-6) && (p.leaves === null || jd <= p.leaves + 1e-6);
  for (const h of hits) periods.find((p) => inside(p, h.jd))?.hits.push(h);
  for (const m of misses) periods.find((p) => inside(p, m.jd))?.nearMisses.push(m);
  for (const p of periods) {
    p.minOrb = p.hits.length ? 0 : p.nearMisses.length ? Math.min(...p.nearMisses.map((m) => m.orb)) : orb;
    if (!p.hits.length && !p.nearMisses.length) {
      // entered and left orb without perfecting or stationing: find closest approach
      const a = p.enters ?? s.jd0, b = p.leaves ?? jdAt(s, n - 1);
      const t = minimise(fx, a, b);
      p.minOrb = Math.abs(fx(t));
    }
  }
  return periods;
}

// ---------------------------------------------------------------------------
// Transit events
// ---------------------------------------------------------------------------

export const TRANSITING_DEFAULT: PointId[] = ["mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "trueNode"];
export const TRANSITING_FAST: PointId[] = ["sun", "mercury", "venus"];
export const NATAL_TARGETS: PointId[] = [...PLANET_IDS, "chiron", "trueNode", "asc", "mc"];
const PERSONAL: PointId[] = ["sun", "moon", "mercury", "venus", "mars", "asc", "mc"];
const OUTER: PointId[] = ["uranus", "neptune", "pluto"];
const HARD: AspectId[] = ["conjunction", "opposition", "square"];

/** Padding (days) sampled beyond the window so that entry/exit dates are real, not clipped. */
const PAD: Partial<Record<PointId, number>> = {
  sun: 20, mercury: 40, venus: 40, mars: 120, jupiter: 400, saturn: 500, chiron: 600,
  uranus: 800, neptune: 900, pluto: 900, trueNode: 120, moon: 3,
};

export interface TransitEvent {
  key: string;
  transiting: PointId;
  natal: PointId;
  aspect: AspectId;
  side: "+" | "-" | null;
  exactPoint: number;
  orb: number;
  enters: number | null;
  leaves: number | null;
  hits: ExactHit[];
  nearMisses: NearMiss[];
  minOrb: number;
  heavy: boolean;
  heavyReason: string | null;
}

export interface TransitOptions {
  startJd: number;
  endJd: number;
  bodies?: PointId[];
  natalPoints?: PointId[];
  aspects?: AspectId[];
  /** orb in degrees for a body/aspect pair */
  orbFor?: (body: PointId, aspect: AspectId) => number;
}

export function defaultTransitOrb(body: PointId, aspect: AspectId): number {
  const major = ASPECTS[aspect].major;
  if (!major) return 1;
  if (body === "sun" || body === "mercury" || body === "venus" || body === "mars") return aspect === "sextile" ? 1 : 1.5;
  return aspect === "sextile" ? 1.5 : 2;
}

export function classifyHeavy(transiting: PointId, natal: PointId, aspect: AspectId): string | null {
  if (aspect === "conjunction" && transiting === natal) {
    if (transiting === "saturn") return "Saturn return";
    if (transiting === "jupiter") return "Jupiter return";
    if (transiting === "chiron") return "Chiron return";
    if (transiting === "trueNode") return "Nodal return";
  }
  if (transiting === "trueNode" && natal === "trueNode" && aspect === "opposition") return "Nodal reversal";
  if (transiting === "saturn" && natal === "saturn" && aspect === "opposition") return "Saturn opposition";
  if (OUTER.includes(transiting) && PERSONAL.includes(natal) && ASPECTS[aspect].major) {
    return `${transiting[0].toUpperCase() + transiting.slice(1)} to a personal ${natal === "asc" || natal === "mc" ? "angle" : "planet"}`;
  }
  if (transiting === "saturn" && ["sun", "moon", "asc", "mc"].includes(natal) && HARD.includes(aspect)) return "Saturn hard aspect to a luminary or angle";
  return null;
}

export function computeTransitEvents(natal: NatalChart, opts: TransitOptions): TransitEvent[] {
  const bodies = opts.bodies ?? TRANSITING_DEFAULT;
  const aspects = opts.aspects ?? (["conjunction", "opposition", "square", "trine", "sextile"] as AspectId[]);
  const targets = (opts.natalPoints ?? NATAL_TARGETS).map((id) => natal.points[id]).filter((p): p is NonNullable<typeof p> => !!p);
  const orbFor = opts.orbFor ?? defaultTransitOrb;
  const out: TransitEvent[] = [];

  for (const body of bodies) {
    const pad = PAD[body] ?? 200;
    const step = body === "moon" ? 0.125 : body === "trueNode" ? 0.5 : 1;
    const series = sampleSeries(body, opts.startJd - pad, opts.endJd + pad, step);
    for (const target of targets) {
      for (const aspect of aspects) {
        const orb = orbFor(body, aspect);
        for (const ep of exactPoints(target.lon, ASPECTS[aspect].angle)) {
          for (const p of seriesPeriods(series, ep.lon, orb)) {
            const enters = p.enters ?? -Infinity, leaves = p.leaves ?? Infinity;
            if (leaves < opts.startJd || enters > opts.endJd) continue;
            const reason = classifyHeavy(body, target.id, aspect);
            out.push({
              key: `${body}|${aspect}|${target.id}|${ep.side ?? "0"}|${Math.round(p.enters ?? p.hits[0]?.jd ?? 0)}`,
              transiting: body,
              natal: target.id,
              aspect,
              side: ep.side,
              exactPoint: ep.lon,
              orb,
              enters: p.enters,
              leaves: p.leaves,
              hits: p.hits,
              nearMisses: p.nearMisses,
              minOrb: p.minOrb,
              heavy: reason !== null,
              heavyReason: reason,
            });
          }
        }
      }
    }
  }
  return out.sort((a, b) => (a.enters ?? -Infinity) - (b.enters ?? -Infinity));
}

/** Current orb and applying/separating state of an event at `jd`. */
export function eventStateAt(e: TransitEvent, jd: number) {
  const [lon, speed] = bodySampler(e.transiting)(jd);
  const d = arc(e.exactPoint, lon);
  const applying = (d < 0 && speed > 0) || (d > 0 && speed < 0);
  return { orb: Math.abs(d), applying, lon, retrograde: speed < 0 };
}

// ---------------------------------------------------------------------------
// House ingresses
// ---------------------------------------------------------------------------

export interface HouseTransit {
  body: PointId;
  house: number;
  next: { jd: number; house: number; retrograde: boolean } | null;
}

const HORIZON: Partial<Record<PointId, [days: number, step: number]>> = {
  moon: [3, 0.0625], sun: [40, 0.5], mercury: [200, 0.5], venus: [250, 0.5], mars: [500, 1],
  jupiter: [1500, 2], saturn: [3500, 3], chiron: [6000, 4], uranus: [8000, 5], neptune: [12000, 6], pluto: [16000, 8], trueNode: [600, 1],
};

/** First crossing of any house cusp by a sampled body after `fromJd`. */
export function nextCuspCrossing(sample: Sampler, cusps: number[], fromJd: number, days: number, step: number): { jd: number; house: number; retrograde: boolean } | null {
  const s = sampleSeries("sun", fromJd, fromJd + days, step, sample);
  for (let i = 0; i < s.lon.length - 1; i++) {
    for (let k = 0; k < 12; k++) {
      const a = arc(cusps[k], s.lon[i]), b = arc(cusps[k], s.lon[i + 1]);
      if (Math.sign(a) !== Math.sign(b) && Math.abs(b - a) < 90) {
        const t = bisect((jd) => arc(cusps[k], sample(jd)[0]), jdAt(s, i), jdAt(s, i + 1), a);
        const retro = b < a;
        return { jd: t, house: retro ? (k === 0 ? 12 : k) : k + 1, retrograde: retro };
      }
    }
  }
  return null;
}

export function houseTransits(natal: NatalChart, bodies: PointId[], fromJd: number): HouseTransit[] {
  const cusps = natal.houses?.cusps.map((c) => c.lon);
  if (!cusps) return [];
  return bodies.map((body) => {
    const [days, step] = HORIZON[body] ?? [2000, 2];
    const sample = bodySampler(body);
    const lon = sample(fromJd)[0];
    let house = 12;
    for (let i = 0; i < 12; i++) if (norm360(lon - cusps[i]) < norm360(cusps[(i + 1) % 12] - cusps[i])) { house = i + 1; break; }
    return { body, house, next: nextCuspCrossing(sample, cusps, fromJd, days, step) };
  });
}

// ---------------------------------------------------------------------------
// Eclipses
// ---------------------------------------------------------------------------

export interface Eclipse {
  kind: "solar" | "lunar";
  type: string;
  jd: number;
  /** ecliptic degree of the eclipse (Sun for solar, Moon for lunar) */
  lon: number;
  contacts: { point: PointId; aspect: "conjunction" | "opposition"; orb: number }[];
}

function solarType(flag: number) {
  if (flag & C.SE_ECL_TOTAL) return "total";
  if (flag & C.SE_ECL_ANNULAR_TOTAL) return "hybrid";
  if (flag & C.SE_ECL_ANNULAR) return "annular";
  return "partial";
}
function lunarType(flag: number) {
  if (flag & C.SE_ECL_TOTAL) return "total";
  if (flag & C.SE_ECL_PARTIAL) return "partial";
  return "penumbral";
}

export function eclipsesBetween(startJd: number, endJd: number, natal?: NatalChart | null, orb = 3): Eclipse[] {
  const s = swe();
  const out: Eclipse[] = [];
  for (const kind of ["solar", "lunar"] as const) {
    let jd = startJd;
    for (let guard = 0; guard < 40; guard++) {
      const r = kind === "solar" ? s.sol_eclipse_when_glob(jd, C.SEFLG_SWIEPH, 0, false) : s.lun_eclipse_when(jd, C.SEFLG_SWIEPH, 0, false);
      if (r.flag < 0) break;
      const t = r.data[0];
      if (t > endJd) break;
      const lon = lonSpeed(t, kind === "solar" ? SWE_BODY.sun! : SWE_BODY.moon!)[0];
      const contacts: Eclipse["contacts"] = [];
      if (natal) {
        for (const p of Object.values(natal.points)) {
          if (!p || ["dsc", "ic", "meanNode", "meanSouthNode", "vertex", "fortune"].includes(p.id)) continue;
          const sep = separation(lon, p.lon);
          if (sep <= orb) contacts.push({ point: p.id, aspect: "conjunction", orb: sep });
          else if (180 - sep <= orb) contacts.push({ point: p.id, aspect: "opposition", orb: 180 - sep });
        }
      }
      out.push({ kind, type: kind === "solar" ? solarType(r.flag) : lunarType(r.flag), jd: t, lon, contacts });
      jd = t + 1;
    }
  }
  return out.sort((a, b) => a.jd - b.jd);
}

// ---------------------------------------------------------------------------
// Lunations & void-of-course Moon
// ---------------------------------------------------------------------------

/** Sun–Moon elongation as a "longitude" so lunations become crossings. */
const elongation: Sampler = (jd) => {
  const [m, ms] = lonSpeed(jd, SWE_BODY.moon!);
  const [s, ss] = lonSpeed(jd, SWE_BODY.sun!);
  return [norm360(m - s), ms - ss];
};

export interface Lunation {
  jd: number;
  phase: "new" | "first quarter" | "full" | "last quarter";
  /** Moon's ecliptic longitude at the lunation */
  lon: number;
}

export function lunations(startJd: number, endJd: number): Lunation[] {
  const series = sampleSeries("moon", startJd, endJd, 0.25, elongation);
  const names: [number, Lunation["phase"]][] = [[0, "new"], [90, "first quarter"], [180, "full"], [270, "last quarter"]];
  const out: Lunation[] = [];
  for (const [angle, phase] of names) {
    for (let i = 0; i < series.lon.length - 1; i++) {
      const a = arc(angle, series.lon[i]), b = arc(angle, series.lon[i + 1]);
      if (Math.sign(a) !== Math.sign(b) && Math.abs(b - a) < 90) {
        const t = bisect((jd) => arc(angle, elongation(jd)[0]), jdAt(series, i), jdAt(series, i + 1), a);
        out.push({ jd: t, phase, lon: lonSpeed(t, SWE_BODY.moon!)[0] });
      }
    }
  }
  return out.sort((a, b) => a.jd - b.jd);
}

export interface VoidOfCourse {
  /** sign the Moon is in during this period (index) */
  sign: number;
  /** last exact Ptolemaic aspect before the Moon leaves the sign */
  lastAspect: { jd: number; planet: PointId; aspect: AspectId } | null;
  /** VoC begins (= lastAspect.jd), ends at the ingress */
  start: number | null;
  ingress: number;
  nextSign: number;
}

const VOC_PLANETS: PointId[] = ["sun", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const PTOLEMAIC: AspectId[] = ["conjunction", "sextile", "square", "trine", "opposition"];

/** Void-of-course periods overlapping [fromJd, toJd] (modern: aspects to Sun–Pluto). */
export function voidOfCourse(fromJd: number, toJd: number): VoidOfCourse[] {
  const moon = bodySampler("moon");
  // Moon ingresses bracketing the range
  const ms = sampleSeries("moon", fromJd - 3, toJd + 3, 0.125, moon);
  const ingresses: { jd: number; to: number; from: number }[] = [];
  for (let i = 0; i < ms.lon.length - 1; i++) {
    const s0 = Math.floor(ms.lon[i] / 30), s1 = Math.floor(ms.lon[i + 1] / 30);
    if (s0 !== s1) {
      const boundary = s1 * 30;
      const t = bisect((jd) => arc(boundary, moon(jd)[0]), jdAt(ms, i), jdAt(ms, i + 1), arc(boundary, ms.lon[i]));
      ingresses.push({ jd: t, to: s1, from: s0 });
    }
  }
  const out: VoidOfCourse[] = [];
  for (let k = 1; k < ingresses.length; k++) {
    const signStart = ingresses[k - 1].jd, ingress = ingresses[k].jd;
    if (ingress < fromJd || signStart > toJd) continue;
    let last: VoidOfCourse["lastAspect"] = null;
    for (const planet of VOC_PLANETS) {
      const p = bodySampler(planet);
      const rel: Sampler = (jd) => [norm360(moon(jd)[0] - p(jd)[0]), 0];
      const series = sampleSeries("moon", signStart, ingress, 0.0625, rel);
      for (const aspect of PTOLEMAIC) {
        const angles = ASPECTS[aspect].angle === 0 || ASPECTS[aspect].angle === 180 ? [ASPECTS[aspect].angle] : [ASPECTS[aspect].angle, 360 - ASPECTS[aspect].angle];
        for (const angle of angles) {
          for (let i = 0; i < series.lon.length - 1; i++) {
            const a = arc(angle, series.lon[i]), b = arc(angle, series.lon[i + 1]);
            if (Math.sign(a) !== Math.sign(b) && Math.abs(b - a) < 90) {
              const t = bisect((jd) => arc(angle, rel(jd)[0]), jdAt(series, i), Math.min(jdAt(series, i + 1), ingress), a);
              if (t <= ingress && (!last || t > last.jd)) last = { jd: t, planet, aspect };
            }
          }
        }
      }
    }
    out.push({ sign: ingresses[k - 1].to, lastAspect: last, start: last?.jd ?? signStart, ingress, nextSign: ingresses[k].to });
  }
  return out;
}
