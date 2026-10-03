import { describe, expect, it } from "vitest";
import { bodySampler, crossings, findIngresses, findStations, orbPeriods, exactPoints } from "@/lib/astro/search";
import { swe, C } from "@/lib/astro/ephemeris";
import { jdFromDate } from "@/lib/astro/time";
import { arc, separation } from "@/lib/astro/math";
import { computeChart } from "@/lib/astro/chart";
import { annualProfection } from "@/lib/astro/profections";
import { lifePath, expression, soulUrge, personality, personalCycles, reduce } from "@/lib/numerology/core";

const jd = (iso: string) => jdFromDate(new Date(iso));
const SEC = 1 / 86400;

describe("event search", () => {
  it("finds the 2026 March equinox exactly where Swiss Ephemeris solcross does", () => {
    const sun = bodySampler("sun");
    const start = jd("2026-01-01T00:00:00Z");
    const ing = findIngresses(sun, start, jd("2026-12-31T00:00:00Z"), 1).find((i) => i.toSign === 0)!;
    const ref = swe().solcross_ut(0, start, C.SEFLG_SWIEPH).date;
    expect(Math.abs(ing.jd - ref)).toBeLessThan(2 * SEC);
    expect(ing.retrograde).toBe(false);
    expect(findIngresses(sun, start, jd("2026-12-31T00:00:00Z"), 1)).toHaveLength(12);
  });

  it("finds Moon ingresses matching Swiss Ephemeris mooncross", () => {
    const moon = bodySampler("moon");
    const start = jd("2026-10-01T00:00:00Z");
    const ings = findIngresses(moon, start, start + 30, 0.125);
    expect(ings.length).toBeGreaterThanOrEqual(12);
    for (const i of ings.slice(0, 4)) {
      const ref = swe().mooncross_ut(i.toSign * 30, i.jd - 1, C.SEFLG_SWIEPH).date;
      expect(Math.abs(i.jd - ref)).toBeLessThan(2 * SEC);
    }
  });

  it("finds Mercury's stations with zero speed at the station moment", () => {
    const mer = bodySampler("mercury");
    const st = findStations(mer, jd("2026-01-01T00:00:00Z"), jd("2027-01-01T00:00:00Z"), 1);
    expect(st.length).toBeGreaterThanOrEqual(6);
    for (const s of st) {
      expect(Math.abs(mer(s.jd)[1])).toBeLessThan(1e-4);
      expect(Math.sign(mer(s.jd - 1)[1])).toBe(s.type === "retrograde" ? 1 : -1);
    }
  });

  it("finds all three passes of a retrograde transit, the middle one retrograde", () => {
    const sat = bodySampler("saturn");
    const start = jd("2026-01-01T00:00:00Z"), end = jd("2028-01-01T00:00:00Z");
    const sr = findStations(sat, start, end, 1).find((s) => s.type === "retrograde")!;
    const target = sr.lon - 2; // Saturn passes this point direct, retrograde, then direct again
    const { hits } = crossings(sat, target, start, end, 1);
    expect(hits).toHaveLength(3);
    expect(hits.map((h) => h.retrograde)).toEqual([false, true, false]);
    for (const h of hits) expect(Math.abs(arc(target, h.lon))).toBeLessThan(1e-4);
  });

  it("reports a near-miss when a planet stations short of the exact point", () => {
    const sat = bodySampler("saturn");
    const start = jd("2026-01-01T00:00:00Z"), end = jd("2028-01-01T00:00:00Z");
    const sr = findStations(sat, start, end, 1).find((s) => s.type === "retrograde")!;
    const target = sr.lon + 0.3; // beyond the retrograde station: approached, never reached (that cycle)
    const periods = orbPeriods(sat, target, sr.jd - 120, sr.jd + 60, 1, 1);
    const miss = periods.flatMap((p) => p.nearMisses)[0];
    expect(miss).toBeDefined();
    expect(miss.orb).toBeCloseTo(0.3, 2);
    expect(periods.flatMap((p) => p.hits)).toHaveLength(0);
  });

  it("orb windows begin and end exactly at the orb", () => {
    const mars = bodySampler("mars");
    const start = jd("2026-01-01T00:00:00Z");
    const [pt] = exactPoints(100, 90);
    const periods = orbPeriods(mars, pt.lon, start, start + 800, 1, 2);
    expect(periods.length).toBeGreaterThan(0);
    for (const p of periods) {
      if (p.enters) expect(separation(mars(p.enters)[0], pt.lon)).toBeCloseTo(2, 4);
      if (p.leaves) expect(separation(mars(p.leaves)[0], pt.lon)).toBeCloseTo(2, 4);
      expect(p.hits.length + p.nearMisses.length).toBeGreaterThan(0);
    }
  });
});

describe("annual profections", () => {
  it("Steve Jobs (Virgo rising) at 71 is in a 12th-house Leo year, Lord of the Year the Sun", () => {
    const c = computeChart({ date: "1955-02-24", time: "19:15", lat: 37.7833, lon: -122.4167 });
    const p = annualProfection(c, new Date("2026-10-02T12:00:00Z"))!;
    expect(p.age).toBe(71);
    expect(p.house).toBe(12);
    expect(p.sign).toBe("leo");
    expect(p.lord).toBe("sun");
    expect(p.yearStart).toBe("2026-02-24");
    expect(p.yearEnd).toBe("2027-02-24");
  });
  it("the year turns over on the birthday", () => {
    const c = computeChart({ date: "1955-02-24", time: "19:15", lat: 37.7833, lon: -122.4167 });
    expect(annualProfection(c, new Date("2026-02-23T12:00:00Z"))!.age).toBe(70);
    expect(annualProfection(c, new Date("2026-02-24T12:00:00Z"))!.age).toBe(71);
  });
});

describe("numerology core", () => {
  it("reduces while keeping master numbers", () => {
    expect(reduce(1997).value).toBe(8);
    expect(reduce(29).value).toBe(11);
    expect(reduce(29, false).value).toBe(2);
  });
  it("Life Path reduces month, day and year separately", () => {
    expect(lifePath("1997-11-20").value).toBe(3); // 11 + 2 + 8 = 21 → 3
    expect(lifePath("1984-11-29").value).toBe(8); // 11 + 11 + 22 = 44 → 8
  });
  it("flags karmic debt numbers on the way down", () => {
    const lp = lifePath("1990-04-13"); // day 13, year 1990 → 19 → 10 → 1
    expect(lp.value).toBe(9);
    expect(lp.karmicDebt.sort()).toEqual([13, 19]);
  });
  it("name numbers (John Smith)", () => {
    expect(expression("John Smith").value).toBe(8);
    expect(soulUrge("John Smith").value).toBe(6);
    const p = personality("John Smith");
    expect(p.value).toBe(11);
    expect(p.master).toBe(true);
  });
  it("Y is a vowel only when it sounds like one", () => {
    expect(soulUrge("Mary").value).toBe(8); // A1 + Y7
    expect(soulUrge("Maya").value).toBe(2); // A1 + A1, Y consonant
  });
  it("personal year, month and day", () => {
    const c = personalCycles("1997-11-20", { y: 2026, m: 10, d: 2 });
    expect(c.year.value).toBe(5);
    expect(c.month.value).toBe(6);
    expect(c.day.value).toBe(8);
  });
});
