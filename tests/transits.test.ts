import { describe, expect, it } from "vitest";
import { computeChart } from "@/lib/astro/chart";
import { computeTransitEvents, seriesPeriods, sampleSeries, houseTransits, eclipsesBetween, lunations, voidOfCourse } from "@/lib/astro/transits";
import { bodySampler, orbPeriods } from "@/lib/astro/search";
import { jdFromDate, dateFromJd } from "@/lib/astro/time";
import { arc, separation, formatLon } from "@/lib/astro/math";
import { ASPECTS } from "@/lib/astro/constants";

const jd = (iso: string) => jdFromDate(new Date(iso));
const day = (j: number) => dateFromJd(j).toISOString().slice(0, 10);
const jobs = computeChart({ date: "1955-02-24", time: "19:15", lat: 37 + 47 / 60, lon: -(122 + 25 / 60) });

describe("transit events", () => {
  it("finds Jobs's first Saturn return and flags it as a heavy hitter", () => {
    const ev = computeTransitEvents(jobs, { startJd: jd("1983-01-01T00:00:00Z"), endJd: jd("1986-12-31T00:00:00Z"), bodies: ["saturn"], natalPoints: ["saturn"], aspects: ["conjunction"] });
    expect(ev.length).toBeGreaterThan(0);
    const hits = ev.flatMap((e) => e.hits);
    expect(hits.length === 1 || hits.length === 3).toBe(true);
    for (const h of hits) expect(separation(h.lon, jobs.points.saturn!.lon)).toBeLessThan(1e-4);
    expect(ev[0].heavy).toBe(true);
    expect(ev[0].heavyReason).toBe("Saturn return");
  });

  it("array search agrees with the reference sampler search", () => {
    const start = jd("2026-01-01T00:00:00Z"), end = jd("2029-01-01T00:00:00Z");
    const target = 15; // 15° Aries
    const a = seriesPeriods(sampleSeries("saturn", start, end, 1), target, 2);
    const b = orbPeriods(bodySampler("saturn"), target, start, end, 1, 2);
    expect(a.length).toBe(b.length);
    a.forEach((p, i) => {
      expect(p.hits.length).toBe(b[i].hits.length);
      p.hits.forEach((h, k) => expect(Math.abs(h.jd - b[i].hits[k].jd)).toBeLessThan(1e-4));
      if (p.enters && b[i].enters) expect(Math.abs(p.enters - b[i].enters!)).toBeLessThan(1e-4);
    });
  });

  it("a full year of transits computes quickly", () => {
    const t0 = performance.now();
    const ev = computeTransitEvents(jobs, { startJd: jd("2026-01-01T00:00:00Z"), endJd: jd("2027-01-01T00:00:00Z"), bodies: ["sun", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "trueNode"] });
    expect(ev.length).toBeGreaterThan(20);
    expect(performance.now() - t0).toBeLessThan(3000);
    for (const e of ev.slice(0, 40)) for (const h of e.hits) expect(Math.abs(arc(e.exactPoint, h.lon))).toBeLessThan(1e-4);
  });

  it("house ingresses land exactly on a natal cusp", () => {
    const ht = houseTransits(jobs, ["sun", "mars", "saturn"], jd("2026-10-02T00:00:00Z"));
    const cusps = jobs.houses!.cusps.map((c) => c.lon);
    for (const h of ht) {
      expect(h.next).not.toBeNull();
      const lon = bodySampler(h.body)(h.next!.jd)[0];
      expect(Math.min(...cusps.map((c) => separation(c, lon)))).toBeLessThan(1e-4);
    }
  });
});

describe("eclipses, lunations, void of course", () => {
  it("lists the 2026 eclipses with correct dates, types and degrees", () => {
    const ec = eclipsesBetween(jd("2026-01-01T00:00:00Z"), jd("2027-01-01T00:00:00Z"));
    const summary = ec.map((e) => `${day(e.jd)} ${e.kind} ${e.type} ${formatLon(e.lon).split("'")[0]}`);
    expect(summary).toEqual([
      expect.stringMatching(/^2026-02-17 solar annular 28°\d+ Aquarius|^2026-02-17 solar annular 28°\d+$/),
      expect.stringMatching(/^2026-03-03 lunar total 12°\d+/),
      expect.stringMatching(/^2026-08-12 solar total 20°\d+/),
      expect.stringMatching(/^2026-08-28 lunar partial 4°\d+/),
    ]);
  });

  it("lunations are exact Sun–Moon angles", () => {
    const lu = lunations(jd("2026-10-01T00:00:00Z"), jd("2026-11-15T00:00:00Z"));
    expect(lu.filter((l) => l.phase === "new").length).toBeGreaterThanOrEqual(1);
    for (const l of lu) {
      const s = bodySampler("sun")(l.jd)[0], m = bodySampler("moon")(l.jd)[0];
      const want = { new: 0, "first quarter": 90, full: 180, "last quarter": 270 }[l.phase];
      expect(Math.abs(arc(want, ((m - s) % 360 + 360) % 360))).toBeLessThan(1e-3);
    }
  });

  it("void-of-course periods begin at the Moon's last exact Ptolemaic aspect", () => {
    const vocs = voidOfCourse(jd("2026-10-02T00:00:00Z"), jd("2026-10-06T00:00:00Z"));
    expect(vocs.length).toBeGreaterThan(0);
    for (const v of vocs) {
      expect(v.lastAspect).not.toBeNull();
      const { jd: t, planet, aspect } = v.lastAspect!;
      const ang = ((bodySampler("moon")(t)[0] - bodySampler(planet)(t)[0]) % 360 + 360) % 360;
      const a = ASPECTS[aspect].angle;
      expect(Math.min(Math.abs(arc(a, ang)), Math.abs(arc(360 - a, ang)))).toBeLessThan(1e-3);
      expect(v.start!).toBeLessThan(v.ingress);
    }
  });
});
