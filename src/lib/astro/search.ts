/**
 * Time searches over the ephemeris: exact aspect perfections (every pass,
 * including retrograde re-hits), periods within orb, sign ingresses and
 * stations. Each event is bracketed by sampling and refined by bisection to
 * well under a second of time.
 */
import type { PointId } from "./constants";
import { lonSpeed, SWE_BODY } from "./ephemeris";
import { arc, norm360 } from "./math";

export type Sampler = (jd: number) => [lon: number, speed: number];

const SOUTH: Partial<Record<PointId, PointId>> = { trueSouthNode: "trueNode", meanSouthNode: "meanNode" };

export function bodySampler(id: PointId): Sampler {
  const north = SOUTH[id];
  const body = SWE_BODY[north ?? id];
  if (body === undefined) throw new Error(`No ephemeris body for ${id}`);
  if (north) return (jd) => {
    const [l, s] = lonSpeed(jd, body);
    return [norm360(l + 180), s];
  };
  return (jd) => lonSpeed(jd, body);
}

/** Sampling step (days): small enough that no event can hide between samples. */
export function stepFor(id: PointId): number {
  if (id === "moon") return 0.125;
  if (id === "trueNode" || id === "trueSouthNode") return 0.5;
  return 1;
}

const TOL = 1e-6; // days ≈ 0.09 s

export function bisect(f: (jd: number) => number, a: number, b: number, fa: number): number {
  let lo = a, hi = b, flo = fa;
  for (let i = 0; i < 80 && hi - lo > TOL; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (fm === 0) return mid;
    if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Golden-section minimisation of |f| on [a, b]. */
export function minimise(f: (jd: number) => number, a: number, b: number): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a), d = a + g * (b - a);
  for (let i = 0; i < 80 && b - a > TOL; i++) {
    if (Math.abs(f(c)) < Math.abs(f(d))) b = d; else a = c;
    c = b - g * (b - a);
    d = a + g * (b - a);
  }
  return (a + b) / 2;
}

export interface ExactHit {
  jd: number;
  lon: number;
  speed: number;
  /** true when the moving body perfected the aspect while retrograde */
  retrograde: boolean;
}

export interface NearMiss {
  jd: number;
  /** closest approach to exact, degrees */
  orb: number;
  lon: number;
}

export interface OrbPeriod {
  /** null = already within orb at the start of the search window */
  enters: number | null;
  /** null = still within orb at the end of the search window */
  leaves: number | null;
  hits: ExactHit[];
  /** a station that came close to exact without crossing it */
  nearMisses: NearMiss[];
}

/**
 * Every time the moving body crosses `exactPoint` (absolute ecliptic longitude),
 * plus near-misses where it stations within `orb` of it without crossing.
 */
export function crossings(sample: Sampler, exactPoint: number, startJd: number, endJd: number, step: number, orb = 0) {
  const hits: ExactHit[] = [];
  const misses: NearMiss[] = [];
  const f = (jd: number) => arc(exactPoint, sample(jd)[0]);
  let jd0 = startJd, f0 = f(jd0);
  let fPrev = NaN;
  for (let jd = startJd + step; jd <= endJd + 1e-9; jd += step) {
    const jd1 = Math.min(jd, endJd);
    const f1 = f(jd1);
    if (f0 === 0) {
      const [lon, speed] = sample(jd0);
      hits.push({ jd: jd0, lon, speed, retrograde: speed < 0 });
    } else if (Math.sign(f1) !== Math.sign(f0) && Math.abs(f1 - f0) < 90) {
      const t = bisect(f, jd0, jd1, f0);
      const [lon, speed] = sample(t);
      hits.push({ jd: t, lon, speed, retrograde: speed < 0 });
    } else if (orb > 0 && !Number.isNaN(fPrev) && Math.sign(fPrev) === Math.sign(f0) && Math.sign(f0) === Math.sign(f1)
      && Math.abs(f0) < Math.abs(fPrev) && Math.abs(f0) <= Math.abs(f1) && Math.abs(f0) < orb) {
      // |f| has a local minimum near jd0 without changing sign: a station grazing the point
      const t = minimise(f, jd0 - step, jd1);
      const m = Math.abs(f(t));
      if (m > 1e-4) misses.push({ jd: t, orb: m, lon: sample(t)[0] });
    }
    fPrev = f0;
    jd0 = jd1;
    f0 = f1;
    if (jd1 >= endJd) break;
  }
  return { hits, misses };
}

/** Periods during which the moving body is within `orb` of `exactPoint`. */
export function orbPeriods(sample: Sampler, exactPoint: number, startJd: number, endJd: number, step: number, orb: number): OrbPeriod[] {
  const g = (jd: number) => Math.abs(arc(exactPoint, sample(jd)[0])) - orb;
  const { hits, misses } = crossings(sample, exactPoint, startJd, endJd, step, orb);
  const bounds: { jd: number; entering: boolean }[] = [];
  let jd0 = startJd, g0 = g(jd0);
  const startsInside = g0 <= 0;
  for (let jd = startJd + step; jd <= endJd + 1e-9; jd += step) {
    const jd1 = Math.min(jd, endJd);
    const g1 = g(jd1);
    if (Math.sign(g1) !== Math.sign(g0) && g0 !== 0) {
      const t = bisect(g, jd0, jd1, g0);
      bounds.push({ jd: t, entering: g1 < 0 });
    }
    jd0 = jd1;
    g0 = g1;
    if (jd1 >= endJd) break;
  }
  const periods: OrbPeriod[] = [];
  let open: OrbPeriod | null = startsInside ? { enters: null, leaves: null, hits: [], nearMisses: [] } : null;
  for (const b of bounds) {
    if (b.entering) open = { enters: b.jd, leaves: null, hits: [], nearMisses: [] };
    else if (open) { open.leaves = b.jd; periods.push(open); open = null; }
  }
  if (open) periods.push(open);
  const within = (p: OrbPeriod, jd: number) => (p.enters === null || jd >= p.enters - 1e-6) && (p.leaves === null || jd <= p.leaves + 1e-6);
  for (const h of hits) periods.find((p) => within(p, h.jd))?.hits.push(h);
  for (const m of misses) periods.find((p) => within(p, m.jd))?.nearMisses.push(m);
  return periods;
}

/** The exact points (absolute longitudes) at which `angle` to `targetLon` perfects. */
export function exactPoints(targetLon: number, angle: number): { lon: number; side: "+" | "-" | null }[] {
  if (angle === 0 || angle === 180) return [{ lon: norm360(targetLon + angle), side: null }];
  return [
    { lon: norm360(targetLon + angle), side: "+" },
    { lon: norm360(targetLon - angle), side: "-" },
  ];
}

export interface Ingress {
  jd: number;
  fromSign: number;
  toSign: number;
  retrograde: boolean;
}

export function findIngresses(sample: Sampler, startJd: number, endJd: number, step: number): Ingress[] {
  const out: Ingress[] = [];
  let jd0 = startJd;
  let [l0] = sample(jd0);
  for (let jd = startJd + step; jd <= endJd + 1e-9; jd += step) {
    const jd1 = Math.min(jd, endJd);
    const [l1] = sample(jd1);
    const s0 = Math.floor(norm360(l0) / 30), s1 = Math.floor(norm360(l1) / 30);
    if (s0 !== s1) {
      const forward = arc(l0, l1) > 0;
      const boundary = forward ? s1 * 30 : s0 * 30;
      const f = (t: number) => arc(boundary, sample(t)[0]);
      const t = bisect(f, jd0, jd1, f(jd0));
      out.push({ jd: t, fromSign: s0, toSign: s1, retrograde: !forward });
    }
    jd0 = jd1;
    l0 = l1;
    if (jd1 >= endJd) break;
  }
  return out;
}

export interface Station {
  jd: number;
  /** "retrograde" = turning retrograde (SR), "direct" = turning direct (SD) */
  type: "retrograde" | "direct";
  lon: number;
}

export function findStations(sample: Sampler, startJd: number, endJd: number, step: number): Station[] {
  const out: Station[] = [];
  const v = (t: number) => sample(t)[1];
  let jd0 = startJd, v0 = v(jd0);
  for (let jd = startJd + step; jd <= endJd + 1e-9; jd += step) {
    const jd1 = Math.min(jd, endJd);
    const v1 = v(jd1);
    if (v0 !== 0 && Math.sign(v1) !== Math.sign(v0)) {
      const t = bisect(v, jd0, jd1, v0);
      out.push({ jd: t, type: v0 > 0 ? "retrograde" : "direct", lon: sample(t)[0] });
    }
    jd0 = jd1;
    v0 = v1;
    if (jd1 >= endJd) break;
  }
  return out;
}
