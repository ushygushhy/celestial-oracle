/**
 * Annual profections (Hellenistic time-lord technique): the Ascendant advances
 * one whole sign per year of life. The ruler of the profected sign is the
 * Lord of the Year.
 */
import { SIGNS, TRADITIONAL_RULER, type PlanetId, type SignId } from "./constants";
import type { ChartPoint, NatalChart } from "./chart";

export interface Profection {
  /** completed years of life on the reference date */
  age: number;
  /** 1–12, counted from the Ascendant (whole sign) */
  house: number;
  sign: SignId;
  lord: PlanetId;
  lordNatal: ChartPoint | null;
  /** birthday that opened this profection year (YYYY-MM-DD) */
  yearStart: string;
  /** next birthday (YYYY-MM-DD) */
  yearEnd: string;
  /** "ascendant" normally; "sun" (solar profection) when birth time is unknown */
  from: "ascendant" | "sun";
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function annualProfection(natal: NatalChart, on: Date): Profection | null {
  const [by, bm, bd] = natal.input.date.split("-").map(Number);
  const y = on.getUTCFullYear();
  const hadBirthday = on.getUTCMonth() + 1 > bm || (on.getUTCMonth() + 1 === bm && on.getUTCDate() >= bd);
  const age = y - by - (hadBirthday ? 0 : 1);
  if (age < 0) return null;
  const base = natal.points.asc ?? natal.points.sun;
  if (!base) return null;
  const offset = age % 12;
  const signIndex = (base.signIndex + offset) % 12;
  const sign = SIGNS[signIndex].id;
  const lord = TRADITIONAL_RULER[sign];
  const startYear = by + age;
  const birthday = (yr: number) => {
    const d = new Date(0);
    d.setUTCFullYear(yr, bm - 1, bd);
    return ymd(d);
  };
  return {
    age,
    house: offset + 1,
    sign,
    lord,
    lordNatal: natal.points[lord] ?? null,
    yearStart: birthday(startYear),
    yearEnd: birthday(startYear + 1),
    from: natal.points.asc ? "ascendant" : "sun",
  };
}
