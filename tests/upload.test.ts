import { describe, expect, it } from "vitest";
import { computeChart } from "@/lib/astro/chart";
import { chartFromExtraction, compareCharts } from "@/lib/upload/manual-chart";
import { ExtractionSchema, type Extraction } from "@/lib/upload/schema";
import { zodiacPosition } from "@/lib/astro/math";
import { REFERENCE_CHARTS } from "./fixtures/reference-charts";

const jobs = REFERENCE_CHARTS.find((r) => r.id === "jobs")!;
const toPlacement = (body: string, lon: number) => {
  const z = zodiacPosition(lon);
  return { body, label: body, sign: z.sign.id, degree: z.displayDeg, minute: z.displayMin, house: null, retrograde: false, confidence: "high" } as Extraction["placements"][number];
};

const extraction: Extraction = ExtractionSchema.parse({
  source: "astro.com", zodiac: "tropical", houseSystem: "Placidus",
  birthData: { name: "Steve Jobs", date: "1955-02-24", time: "19:15", place: "San Francisco", timezone: "PST", utcOffset: "-08:00", latitude: null, longitude: null },
  placements: [
    ...["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "lilith"].map((b) => toPlacement(b, jobs.positions[b])),
    toPlacement("north_node", jobs.positions.trueNode),
    toPlacement("ascendant", jobs.asc),
    toPlacement("midheaven", jobs.mc),
  ],
  cusps: jobs.cusps.P!.map((lon, i) => { const z = zodiacPosition(lon); return { house: i + 1, sign: z.sign.id, degree: z.displayDeg, minute: z.displayMin }; }),
  notes: "",
});

describe("uploaded chart pipeline", () => {
  const uploaded = chartFromExtraction(extraction, "Jobs (upload)");
  const calculated = computeChart(jobs.local);

  it("builds a chart with houses, aspects and a chart ruler", () => {
    expect(uploaded.houses?.cusps).toHaveLength(12);
    expect(uploaded.points.sun!.house).toBe(6);
    expect(uploaded.aspects.length).toBeGreaterThan(5);
    expect(uploaded.chartRuler?.traditional).toBe("mercury");
  });

  it("an accurate upload agrees with the calculation to within rounding (<0.6′)", () => {
    const rows = compareCharts(uploaded, calculated);
    expect(rows.length).toBeGreaterThan(10);
    for (const r of rows) expect(r.delta!, r.id).toBeLessThan(0.6);
  });

  it("a misread glyph shows up as a large difference", () => {
    const bad = structuredClone(extraction);
    bad.placements[0].sign = "aquarius"; // Sun misread
    const rows = compareCharts(chartFromExtraction(bad, "bad"), calculated);
    const sun = rows.find((r) => r.id === "sun")!;
    expect(sun.delta!).toBeGreaterThan(60 * 25);
    expect(sun.signMatch).toBe(false);
  });
});
