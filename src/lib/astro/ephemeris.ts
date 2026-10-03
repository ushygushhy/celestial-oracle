/**
 * Thin, typed wrapper around the Swiss Ephemeris (sweph).
 * All astronomical positions in the app come through here.
 *
 * Swiss Ephemeris is AGPL-licensed; fine for personal use.
 */
import sweph from "sweph";
import path from "node:path";
import fs from "node:fs";
import type { PointId } from "./constants";

export const C = sweph.constants;

let initialized = false;
let ephePath = "";

export function swe(): typeof sweph {
  if (!initialized) {
    ephePath = process.env.SE_EPHE_PATH || path.join(process.cwd(), "ephe");
    if (!fs.existsSync(path.join(ephePath, "sepl_18.se1"))) {
      console.warn(`[ephemeris] sepl_18.se1 not found in ${ephePath}; Swiss Ephemeris will fall back to the Moshier model.`);
    }
    sweph.set_ephe_path(ephePath);
    initialized = true;
  }
  return sweph;
}

export const EPHEMERIS_FLAGS = C.SEFLG_SWIEPH | C.SEFLG_SPEED;

/** Swiss Ephemeris body numbers for every computed (non-derived) point. */
export const SWE_BODY: Partial<Record<PointId | "trueLilith", number>> = {
  sun: C.SE_SUN,
  moon: C.SE_MOON,
  mercury: C.SE_MERCURY,
  venus: C.SE_VENUS,
  mars: C.SE_MARS,
  jupiter: C.SE_JUPITER,
  saturn: C.SE_SATURN,
  uranus: C.SE_URANUS,
  neptune: C.SE_NEPTUNE,
  pluto: C.SE_PLUTO,
  chiron: C.SE_CHIRON,
  trueNode: C.SE_TRUE_NODE,
  meanNode: C.SE_MEAN_NODE,
  lilith: C.SE_MEAN_APOG, // Black Moon Lilith, mean lunar apogee (astro.com default)
  trueLilith: C.SE_OSCU_APOG,
};

export interface BodyPosition {
  lon: number;
  lat: number;
  dist: number;
  /** degrees / day in longitude */
  speed: number;
  /** equatorial declination, degrees */
  decl: number;
  /** right ascension, degrees */
  ra: number;
  /** "swiss" = compressed JPL DE441 files; "moshier" = analytical fallback */
  source: "swiss" | "moshier";
}

export class EphemerisError extends Error {}

export function calcBody(jdUt: number, body: number, withDeclination = true): BodyPosition {
  const s = swe();
  const r = s.calc_ut(jdUt, body, EPHEMERIS_FLAGS);
  if (r.flag < 0) throw new EphemerisError(r.error || `calc_ut failed for body ${body}`);
  let decl = NaN;
  let ra = NaN;
  if (withDeclination) {
    const eq = s.calc_ut(jdUt, body, EPHEMERIS_FLAGS | C.SEFLG_EQUATORIAL);
    if (eq.flag >= 0) {
      ra = eq.data[0];
      decl = eq.data[1];
    }
  }
  return {
    lon: r.data[0],
    lat: r.data[1],
    dist: r.data[2],
    speed: r.data[3],
    decl,
    ra,
    source: (r.flag & C.SEFLG_SWIEPH) !== 0 ? "swiss" : "moshier",
  };
}

/** Fast longitude + speed only (used by the transit / station search loops). */
export function lonSpeed(jdUt: number, body: number): [number, number] {
  const r = swe().calc_ut(jdUt, body, EPHEMERIS_FLAGS);
  if (r.flag < 0) throw new EphemerisError(r.error);
  return [r.data[0], r.data[3]];
}

/** True obliquity of the ecliptic at jdUt. */
export function obliquity(jdUt: number): number {
  const r = swe().calc_ut(jdUt, C.SE_ECL_NUT, 0);
  return r.data[0];
}

export const HOUSE_SYSTEMS = {
  P: "Placidus",
  W: "Whole Sign",
  K: "Koch",
  E: "Equal",
  O: "Porphyry",
  R: "Regiomontanus",
  C: "Campanus",
} as const;
export type HouseSystem = keyof typeof HOUSE_SYSTEMS;

export interface HouseResult {
  system: HouseSystem;
  /** Requested system may be replaced (Placidus/Koch fail inside polar circles) */
  effectiveSystem: HouseSystem;
  cusps: number[]; // 12 cusps, index 0 = 1st house
  asc: number;
  mc: number;
  armc: number;
  vertex: number;
  warning?: string;
}

export function calcHouses(jdUt: number, lat: number, lon: number, system: HouseSystem): HouseResult {
  const r = swe().houses_ex2(jdUt, 0, lat, lon, system);
  const { houses, points } = r.data;
  let effectiveSystem = system;
  let warning: string | undefined;
  if (r.flag < 0) {
    if (/porphyry/i.test(r.error)) {
      effectiveSystem = "O";
      warning = `${HOUSE_SYSTEMS[system]} cannot be calculated at this latitude (${r.error}). Showing Porphyry cusps.`;
    } else {
      throw new EphemerisError(r.error || "House calculation failed");
    }
  }
  return {
    system,
    effectiveSystem,
    cusps: houses.slice(0, 12),
    asc: points[0],
    mc: points[1],
    armc: points[2],
    vertex: points[3],
    warning,
  };
}

/** Houses from a given ARMC (used for progressed angles). */
export function calcHousesArmc(armc: number, lat: number, eps: number, system: HouseSystem) {
  const r = swe().houses_armc(armc, lat, eps, system);
  return { cusps: r.data.houses.slice(0, 12), asc: r.data.points[0], mc: r.data.points[1], vertex: r.data.points[3] };
}

export function ephemerisInfo() {
  swe();
  return { path: ephePath, version: sweph.version() };
}
