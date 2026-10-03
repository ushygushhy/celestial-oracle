import { describe, expect, it } from "vitest";
import { computeChart, DEFAULT_CHART_SETTINGS } from "@/lib/astro/chart";
import { calcHouses, type HouseSystem } from "@/lib/astro/ephemeris";
import { separation, formatLon } from "@/lib/astro/math";
import type { PointId } from "@/lib/astro/constants";
import { REFERENCE_CHARTS } from "./fixtures/reference-charts";

const ARCMIN = 1 / 60;
const ARCSEC = 1 / 3600;
const fmt = (d: number) => `${(d * 3600).toFixed(3)}"`;

describe.each(REFERENCE_CHARTS)("reference chart: $label ($rating)", (ref) => {
  const chart = computeChart({ ...ref.local, name: ref.label });

  it("resolves the historical timezone and UTC instant exactly", () => {
    expect(chart.moment.tz).toBe(ref.expect.tz);
    expect(chart.moment.offsetSource).toBe(ref.expect.offsetSource);
    expect(chart.moment.abbreviation).toBe(ref.expect.abbreviation);
    expect(chart.moment.offsetMinutes).toBeCloseTo(ref.expect.offsetMinutes, 6);
    expect(chart.moment.utcIso).toBe(ref.expect.utcIso);
    expect(chart.moment.ambiguity).toBe("none");
  });

  it("uses the Swiss Ephemeris data files (not the Moshier fallback)", () => {
    expect(chart.engine.ephemeris).toBe("swiss");
  });

  it("matches astro.com planetary longitudes within 1 arcminute", () => {
    const deviations: string[] = [];
    for (const [id, expected] of Object.entries(ref.positions)) {
      const p = chart.points[id as PointId];
      expect(p, `${id} computed`).toBeDefined();
      const dev = separation(p!.lon, expected);
      deviations.push(`${id}=${fmt(dev)}`);
      expect(dev, `${id}: got ${p!.lon}, expected ${expected}`).toBeLessThan(ARCMIN);
    }
    console.log(`[${ref.id}] deviations: ${deviations.join(" ")}`);
  });

  it("is at parity with astro.com's Swiss Ephemeris (≤ 1 arcsecond)", () => {
    for (const [id, expected] of Object.entries(ref.positions)) {
      expect(separation(chart.points[id as PointId]!.lon, expected), id).toBeLessThan(ARCSEC);
    }
  });

  it("matches Ascendant, Midheaven and Vertex within 1 arcminute", () => {
    expect(separation(chart.points.asc!.lon, ref.asc)).toBeLessThan(ARCMIN);
    expect(separation(chart.points.mc!.lon, ref.mc)).toBeLessThan(ARCMIN);
    expect(separation(chart.points.vertex!.lon, ref.vertex)).toBeLessThan(ARCMIN);
    expect(separation(chart.points.dsc!.lon, ref.asc + 180)).toBeLessThan(ARCMIN);
    expect(separation(chart.points.ic!.lon, ref.mc + 180)).toBeLessThan(ARCMIN);
  });

  it.each(Object.keys(ref.cusps) as HouseSystem[])("matches %s house cusps within 1 arcminute", (system) => {
    const c = system === "P" ? chart : computeChart(ref.local, { ...DEFAULT_CHART_SETTINGS, houseSystem: system });
    const cusps = c.houses!.cusps.map((h) => h.lon);
    ref.cusps[system]!.forEach((expected, i) => {
      expect(separation(cusps[i], expected), `${system} cusp ${i + 1}`).toBeLessThan(ARCMIN);
    });
  });

  it("formats Sun, Moon and Ascendant exactly as Astro-Databank does", () => {
    expect(chart.points.sun!.formatted).toBe(ref.databank.sun);
    expect(chart.points.moon!.formatted).toBe(ref.databank.moon);
    expect(chart.points.asc!.formatted).toBe(ref.databank.asc);
  });

  it("flags retrograde motion consistent with astro.com speeds", () => {
    for (const [id, speed] of Object.entries(ref.speeds ?? {})) {
      expect(chart.points[id as PointId]!.retrograde, id).toBe(speed < 0);
    }
  });
});

describe("historical timezone edge cases", () => {
  it("uses Amsterdam Mean Time (+0:19:32), not Brussels time, for a 1930 Amsterdam birth", () => {
    const c = computeChart({ date: "1930-01-15", time: "12:00", lat: 52.3676, lon: 4.9041 });
    expect(c.moment.tz).toBe("Europe/Amsterdam");
    expect(c.moment.abbreviation).toBe("AMT");
    expect(c.moment.offsetSource).toBe("iana");
    expect(c.moment.offsetMinutes * 60).toBeCloseTo(1172, 6); // 19 min 32 s
    expect(c.moment.utcIso).toBe("1930-01-15T11:40:28.000Z");
  });

  it("uses Dutch summer time (+1:19:32) in July 1930", () => {
    const c = computeChart({ date: "1930-07-15", time: "12:00", lat: 52.3676, lon: 4.9041 });
    expect(c.moment.abbreviation).toBe("NST");
    expect(c.moment.isDst).toBe(true);
    expect(c.moment.offsetMinutes * 60).toBeCloseTo(4772, 6);
  });

  it("uses the birthplace's own Local Mean Time before standard time", () => {
    // Rotterdam, 1830: Europe/Amsterdam is in its LMT era → birthplace LMT 4.4792°E = +0:17:55
    const c = computeChart({ date: "1830-05-01", time: "12:00", lat: 51.9225, lon: 4.4792 });
    expect(c.moment.offsetSource).toBe("lmt");
    expect(c.moment.offsetMinutes).toBeCloseTo(4.4792 * 4, 6);
  });

  it("detects a non-existent local time (spring-forward gap)", () => {
    const c = computeChart({ date: "2021-03-14", time: "02:30", lat: 40.7128, lon: -74.006 });
    expect(c.moment.ambiguity).toBe("gap");
    expect(c.moment.offsetMinutes).toBe(-300);
    expect(c.warnings.some((w) => /did not exist/.test(w))).toBe(true);
  });

  it("detects a repeated local time (fall-back overlap)", () => {
    const c = computeChart({ date: "2021-11-07", time: "01:30", lat: 40.7128, lon: -74.006 });
    expect(c.moment.ambiguity).toBe("overlap");
    expect(c.moment.offsetMinutes).toBe(-240); // first occurrence, EDT
    expect(c.moment.utcIso).toBe("2021-11-07T05:30:00.000Z");
  });

  it("honours a manual UTC offset override", () => {
    const c = computeChart({ date: "2021-11-07", time: "01:30", lat: 40.7128, lon: -74.006, utcOffsetMinutes: -300 });
    expect(c.moment.offsetSource).toBe("override");
    expect(c.moment.utcIso).toBe("2021-11-07T06:30:00.000Z");
  });

  it("uses India's WWII war time (+6:30) in 1943", () => {
    const c = computeChart({ date: "1943-01-15", time: "12:00", lat: 28.6139, lon: 77.209 });
    expect(c.moment.tz).toBe("Asia/Kolkata");
    expect(c.moment.offsetMinutes).toBe(390);
  });
});

describe("unknown birth time", () => {
  const c = computeChart({ date: "1961-08-04", time: null, lat: 21.3, lon: -157.8667 });

  it("casts a noon chart", () => {
    expect(c.moment.timeUnknown).toBe(true);
    expect(c.moment.utcIso).toBe("1961-08-04T22:00:00.000Z");
  });

  it("hides houses and angles", () => {
    expect(c.houses).toBeNull();
    expect(c.points.asc).toBeUndefined();
    expect(c.points.mc).toBeUndefined();
    expect(c.points.fortune).toBeUndefined();
    expect(c.points.sun!.house).toBeNull();
    expect(c.balance.hemispheres).toBeNull();
  });

  it("flags the Moon as uncertain and reports its range for the day", () => {
    expect(c.points.moon!.uncertain).toBe(true);
    expect(c.moonRange).not.toBeNull();
    expect(separation(c.moonRange!.from, c.moonRange!.to)).toBeGreaterThan(10);
    expect(c.warnings.some((w) => /Birth time unknown/.test(w))).toBe(true);
  });
});

describe("polar latitudes", () => {
  it("falls back to Porphyry when Placidus is undefined and says so", () => {
    const c = computeChart({ date: "2000-01-01", time: "12:00", lat: 78.22, lon: 15.65, tz: "Arctic/Longyearbyen" });
    expect(c.houses!.system).toBe("P");
    expect(c.houses!.effectiveSystem).toBe("O");
    expect(c.warnings.some((w) => /Porphyry/.test(w))).toBe(true);
  });
});

describe("houses helper parity", () => {
  it("Regiomontanus and Campanus cusps are produced for every house", () => {
    for (const sys of ["R", "C"] as HouseSystem[]) {
      const h = calcHouses(2435163.635416667, 37.783333, -122.416667, sys);
      expect(h.cusps).toHaveLength(12);
      expect(formatLon(h.asc)).toBe("22°18' Virgo");
    }
  });
});
