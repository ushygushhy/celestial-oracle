import { ASPECTS, ASPECT_IDS, POINTS, type AspectId, type PointId } from "./constants";
import { arc, norm360, separation } from "./math";

export interface AspectSettings {
  enabled: AspectId[];
  orbs: Record<AspectId, number>;
  /** Extra orb for aspects involving the Sun or Moon (major aspects only). */
  luminaryBonus: number;
  /** Orb multiplier for sensitive points (nodes, Lilith, Vertex, Part of Fortune). */
  pointOrbFactor: number;
}

export const DEFAULT_ASPECT_SETTINGS: AspectSettings = {
  enabled: [...ASPECT_IDS],
  orbs: Object.fromEntries(ASPECT_IDS.map((id) => [id, ASPECTS[id].defaultOrb])) as Record<AspectId, number>,
  luminaryBonus: 2,
  pointOrbFactor: 0.5,
};

/** Tighter defaults for transits (timeline readability). */
export const DEFAULT_TRANSIT_ORBS: Record<AspectId, number> = {
  conjunction: 2, opposition: 2, square: 2, trine: 2, sextile: 1.5,
  quincunx: 1, semisextile: 1, semisquare: 1, sesquiquadrate: 1,
};

/** Minimal shape needed to compute aspects. */
export interface AspectBody {
  id: PointId;
  lon: number;
  /** deg/day; 0 for angles/derived points (treated as stationary) */
  speed: number;
  signIndex: number;
}

export interface Aspect {
  a: PointId;
  b: PointId;
  type: AspectId;
  /** Exact aspect angle, e.g. 90 */
  angle: number;
  /** Actual separation in degrees */
  separation: number;
  /** |separation − angle| */
  orb: number;
  /** Maximum orb permitted for this pair */
  allowedOrb: number;
  /** 0..1, 1 = exact */
  strength: number;
  applying: boolean | null;
  /** Aspect formed across sign boundaries ("dissociate"), e.g. 29° Aries □ 1° Leo */
  outOfSign: boolean;
  major: boolean;
}

const SENSITIVE: PointId[] = ["trueNode", "meanNode", "trueSouthNode", "meanSouthNode", "lilith", "vertex", "fortune"];
const LUMINARIES: PointId[] = ["sun", "moon"];
const ANGLES: PointId[] = ["asc", "mc", "ic", "dsc", "vertex", "fortune"];

export function allowedOrb(type: AspectId, a: PointId, b: PointId, s: AspectSettings): number {
  let orb = s.orbs[type];
  if (ASPECTS[type].major && (LUMINARIES.includes(a) || LUMINARIES.includes(b))) orb += s.luminaryBonus;
  if (SENSITIVE.includes(a) || SENSITIVE.includes(b)) orb *= s.pointOrbFactor;
  return Math.max(orb, 0.25);
}

/** True if the orb is shrinking — computed from instantaneous speeds. */
export function applyingState(a: AspectBody, b: AspectBody, angle: number): boolean | null {
  const va = ANGLES.includes(a.id) ? 0 : a.speed;
  const vb = ANGLES.includes(b.id) ? 0 : b.speed;
  if (va === 0 && vb === 0) return null;
  const dt = 0.01; // days; positions are linear over this span
  const now = Math.abs(separation(a.lon, b.lon) - angle);
  const next = Math.abs(separation(a.lon + va * dt, b.lon + vb * dt) - angle);
  if (Math.abs(next - now) < 1e-12) return null;
  return next < now;
}

function isOutOfSign(type: AspectId, a: AspectBody, b: AspectBody): boolean {
  const expected = ASPECTS[type].signDistance;
  if (!expected) return false;
  const d = (((b.signIndex - a.signIndex) % 12) + 12) % 12;
  return !expected.includes(d);
}

/** Never aspect a point with its own axis partner, and never angle-to-angle (structural, not an aspect). */
const TRIVIAL_PAIRS = new Set([
  "asc|dsc", "mc|ic", "asc|mc", "asc|ic", "dsc|mc", "dsc|ic",
  "trueNode|trueSouthNode", "meanNode|meanSouthNode",
  "trueNode|meanNode", "trueSouthNode|meanSouthNode", "trueNode|meanSouthNode", "meanNode|trueSouthNode",
]);
const pairKey = (a: PointId, b: PointId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function aspectBetween(a: AspectBody, b: AspectBody, s: AspectSettings): Aspect | null {
  if (a.id === b.id || TRIVIAL_PAIRS.has(pairKey(a.id, b.id))) return null;
  const sep = separation(a.lon, b.lon);
  let best: Aspect | null = null;
  for (const type of s.enabled) {
    const info = ASPECTS[type];
    const orb = Math.abs(sep - info.angle);
    const allowed = allowedOrb(type, a.id, b.id, s);
    if (orb <= allowed && (!best || orb < best.orb)) {
      best = {
        a: a.id, b: b.id, type, angle: info.angle, separation: sep, orb, allowedOrb: allowed,
        strength: 1 - orb / allowed,
        applying: applyingState(a, b, info.angle),
        outOfSign: isOutOfSign(type, a, b),
        major: info.major,
      };
    }
  }
  return best;
}

/** All aspects within a single chart. */
export function findAspects(bodies: AspectBody[], s: AspectSettings): Aspect[] {
  const out: Aspect[] = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const asp = aspectBetween(bodies[i], bodies[j], s);
      if (asp) out.push(asp);
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}

/** Aspects from one set of bodies (transits, progressions, partner) to another (natal). */
export function findCrossAspects(from: AspectBody[], to: AspectBody[], s: AspectSettings): Aspect[] {
  const out: Aspect[] = [];
  for (const a of from) {
    for (const b of to) {
      if (TRIVIAL_PAIRS.has(pairKey(a.id, b.id))) continue;
      const sep = separation(a.lon, b.lon);
      let best: Aspect | null = null;
      for (const type of s.enabled) {
        const info = ASPECTS[type];
        const orb = Math.abs(sep - info.angle);
        const allowed = allowedOrb(type, a.id, b.id, s);
        if (orb <= allowed && (!best || orb < best.orb)) {
          // natal side is fixed in time: only the "from" body moves
          best = {
            a: a.id, b: b.id, type, angle: info.angle, separation: sep, orb, allowedOrb: allowed,
            strength: 1 - orb / allowed,
            applying: applyingState(a, { ...b, speed: 0 }, info.angle),
            outOfSign: isOutOfSign(type, a, b),
            major: info.major,
          };
        }
      }
      if (best) out.push(best);
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}

/**
 * Signed distance (degrees) of a moving body from the nearest exact aspect
 * point of a fixed target: negative = behind the exact point in zodiacal order.
 */
export function signedOrb(moverLon: number, targetLon: number, angle: number): number {
  const exactPoints = angle === 0 || angle === 180 ? [angle] : [angle, -angle];
  let best = Infinity;
  for (const offset of exactPoints) {
    const diff = arc(norm360(targetLon + offset), moverLon);
    if (Math.abs(diff) < Math.abs(best)) best = diff;
  }
  return best;
}

export const pointLabel = (id: PointId) => POINTS[id].name;
