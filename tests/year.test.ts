import { describe, expect, it } from "vitest";
import os from "node:os"; import path from "node:path"; import fs from "node:fs";
process.env.DATABASE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "year-")), "t.db");
import { createPerson } from "@/lib/db/people";
import { chartForPerson } from "@/lib/services/chart-service";
import { yearReport, yearFacts } from "@/lib/services/year-service";
import { separation } from "@/lib/astro/math";
import { jdFromDate } from "@/lib/astro/time";
import { lonSpeed, SWE_BODY } from "@/lib/astro/ephemeris";
import { progressedJd } from "@/lib/astro/progressions";

describe("Your Year", () => {
  const person = createPerson({ name: "Steve Jobs", fullBirthName: "Steven Paul Jobs", birthDate: "1955-02-24", birthTime: "19:15", placeName: "San Francisco", lat: 37.7833, lon: -122.4167, houseSystem: "P" });
  const natal = chartForPerson(person);
  const r = yearReport(person, natal, new Date("2026-10-02T12:00:00Z"), null, "America/Los_Angeles");

  it("solar return Sun is exactly on the natal Sun", () => {
    expect(r.solarReturn).not.toBeNull();
    expect(separation(r.solarReturn!.chart.points.sun!.lon, natal.points.sun!.lon)).toBeLessThan(1 / 3600);
    expect(r.solarReturn!.iso.slice(0, 10)).toMatch(/^2026-02-2[345]/);
  });

  it("twelve monthly profections advancing one sign per month, current month flagged", () => {
    expect(r.months).toHaveLength(12);
    expect(r.months[0].sign).toBe("Leo");
    expect(r.months[1].sign).toBe("Virgo");
    expect(r.months.filter((m) => m.current)).toHaveLength(1);
    expect(r.months.find((m) => m.current)!.index).toBe(8);
  });

  it("progressed Moon's next sign change is exact", () => {
    const ns = r.progressions.moon.nextSign!;
    const jd = jdFromDate(new Date(ns.iso));
    const lon = lonSpeed(progressedJd(natal.moment.jdUt, jd), SWE_BODY.moon!)[0];
    expect(Math.min(lon % 30, 30 - (lon % 30))).toBeLessThan(1e-4);
  });

  it("numerology cycles and a synthesis digest are produced", () => {
    expect(r.numerology.year.value).toBe(9);
    const f = yearFacts(r);
    expect(f).toContain("Lord of the Year Sun");
    expect(f).toContain("Solar return");
  });
});
