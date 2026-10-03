/**
 * Secondary progressions ("a day for a year").
 * Progressed angles use the solar arc in right ascension applied to the
 * natal ARMC (the method astro.com and most software use by default).
 */
import { PLANET_IDS, type PointId } from "./constants";
import { calcBody, calcHousesArmc, obliquity, SWE_BODY } from "./ephemeris";
import { buildPoint, type ChartPoint, type NatalChart } from "./chart";
import { jdFromDate, dateFromJd } from "./time";
import { norm360 } from "./math";

export const TROPICAL_YEAR_DAYS = 365.242199;

export const progressedJd = (natalJd: number, targetJd: number) => natalJd + (targetJd - natalJd) / TROPICAL_YEAR_DAYS;

/** Real-world date at which the progressed chart reaches ephemeris moment `pJd`. */
export const realJdForProgressed = (natalJd: number, pJd: number) => natalJd + (pJd - natalJd) * TROPICAL_YEAR_DAYS;

export interface ProgressedChart {
  targetIso: string;
  progressedJd: number;
  /** The ephemeris day being read (birth + age-in-years days) */
  ephemerisIso: string;
  ageYears: number;
  /** Progressed planets, placed in NATAL houses */
  points: ChartPoint[];
  /** Progressed Ascendant & Midheaven (null without a birth time) */
  angles: ChartPoint[];
  /** Progressed house cusps (same system as natal) */
  cusps: number[] | null;
  solarArcRa: number | null;
}

const PROGRESSED_POINTS: PointId[] = [...PLANET_IDS, "chiron", "trueNode"];

export function computeProgressions(natal: NatalChart, target: Date): ProgressedChart {
  const natalJd = natal.moment.jdUt;
  const targetJd = jdFromDate(target);
  const pJd = progressedJd(natalJd, targetJd);
  const eps = obliquity(pJd);
  const natalCusps = natal.houses?.cusps.map((c) => c.lon) ?? null;

  const points: ChartPoint[] = [];
  for (const id of PROGRESSED_POINTS) {
    try {
      const p = calcBody(pJd, SWE_BODY[id]!);
      points.push(buildPoint(id, { lon: p.lon, lat: p.lat, speed: p.speed, decl: p.decl }, { cusps: natalCusps, sect: natal.sect, eps }));
    } catch {
      /* body unavailable for this date */
    }
  }

  let angles: ChartPoint[] = [];
  let cusps: number[] | null = null;
  let solarArcRa: number | null = null;
  if (natal.houses) {
    const sunNatal = calcBody(natalJd, SWE_BODY.sun!);
    const sunProg = calcBody(pJd, SWE_BODY.sun!);
    solarArcRa = norm360(sunProg.ra - sunNatal.ra);
    const armc = norm360(natal.houses.armc + solarArcRa);
    const h = calcHousesArmc(armc, natal.input.lat, eps, natal.houses.effectiveSystem);
    cusps = h.cusps;
    angles = [
      buildPoint("asc", { lon: h.asc }, { cusps: natalCusps, sect: natal.sect, eps }),
      buildPoint("mc", { lon: h.mc }, { cusps: natalCusps, sect: natal.sect, eps }),
    ];
  }

  return {
    targetIso: target.toISOString(),
    progressedJd: pJd,
    ephemerisIso: dateFromJd(pJd).toISOString(),
    ageYears: (targetJd - natalJd) / TROPICAL_YEAR_DAYS,
    points,
    angles,
    cusps,
    solarArcRa,
  };
}
