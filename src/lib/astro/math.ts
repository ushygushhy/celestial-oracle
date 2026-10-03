import { SIGNS, type SignInfo } from "./constants";

/** Normalize an angle to [0, 360). */
export const norm360 = (x: number): number => ((x % 360) + 360) % 360;

/** Signed shortest arc from a to b, in (-180, 180]. */
export const arc = (a: number, b: number): number => {
  let d = norm360(b - a);
  if (d > 180) d -= 360;
  return d;
};

/** Unsigned angular separation between two longitudes, in [0, 180]. */
export const separation = (a: number, b: number): number => Math.abs(arc(a, b));

/** Midpoint along the shorter arc. */
export const midpoint = (a: number, b: number): number => norm360(a + arc(a, b) / 2);

export interface ZodiacPosition {
  sign: SignInfo;
  /** Exact degrees within the sign, 0 ≤ x < 30 */
  degInSign: number;
  /** Whole degree (floor) — used for degree symbolism and decans */
  degree: number;
  /** Rounded display minutes, clamped so rounding never changes the sign */
  displayDeg: number;
  displayMin: number;
  /** Truncated components for second-level display */
  min: number;
  sec: number;
}

export function zodiacPosition(lon: number): ZodiacPosition {
  const l = norm360(lon);
  const signIndex = Math.floor(l / 30);
  const degInSign = l - signIndex * 30;
  // Display rounding to the nearest arcminute (as astro.com does), but never
  // round 29°59.6' up to 30°00' — that would print the wrong sign.
  let totalMin = Math.round(degInSign * 60);
  if (totalMin >= 1800) totalMin = 1799;
  const totalSec = Math.floor(degInSign * 3600 + 1e-7);
  return {
    sign: SIGNS[signIndex],
    degInSign,
    degree: Math.floor(degInSign),
    displayDeg: Math.floor(totalMin / 60),
    displayMin: totalMin % 60,
    min: Math.floor((totalSec % 3600) / 60),
    sec: totalSec % 60,
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export type LonStyle = "name" | "abbr" | "glyph";

/** "14°27' Scorpio" (style name), "14°27' Sco", or "14°♏27'" (glyph). */
export function formatLon(lon: number, style: LonStyle = "name", withSeconds = false): string {
  const z = zodiacPosition(lon);
  if (withSeconds) {
    const body = `${z.degree}°${pad2(z.min)}'${pad2(z.sec)}"`;
    if (style === "glyph") return `${z.degree}°${z.sign.glyph}︎${pad2(z.min)}'${pad2(z.sec)}"`;
    return `${body} ${style === "abbr" ? z.sign.abbr : z.sign.name}`;
  }
  if (style === "glyph") return `${z.displayDeg}°${z.sign.glyph}︎${pad2(z.displayMin)}'`;
  return `${z.displayDeg}°${pad2(z.displayMin)}' ${style === "abbr" ? z.sign.abbr : z.sign.name}`;
}

/** Degrees as d°mm' (no sign), e.g. orbs: 2.4667 → "2°28'". */
export function formatArc(deg: number): string {
  const sign = deg < 0 ? "-" : "";
  const a = Math.abs(deg);
  let d = Math.floor(a);
  let m = Math.round((a - d) * 60);
  if (m === 60) { d += 1; m = 0; }
  return `${sign}${d}°${pad2(m)}'`;
}

/** Absolute zodiacal degree 0–360 with minutes: "235°12'". */
export function formatAbsolute(lon: number): string {
  return formatArc(norm360(lon));
}
