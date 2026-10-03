import { describe, expect, it } from "vitest";
import { computeChart } from "@/lib/astro/chart";
import { compositeChart, synastry, synastryFacts } from "@/lib/services/synastry-service";
import { midpoint, separation } from "@/lib/astro/math";
import { REFERENCE_CHARTS } from "./fixtures/reference-charts";

const A = computeChart({ ...REFERENCE_CHARTS[0].local, name: "Jobs" });
const B = computeChart({ ...REFERENCE_CHARTS[1].local, name: "Obama" });

describe("composite & synastry", () => {
  it("composite planets sit on the nearer midpoint", () => {
    const c = compositeChart(A, B);
    for (const id of ["sun", "moon", "venus", "pluto"] as const) {
      expect(separation(c.points[id]!.lon, midpoint(A.points[id]!.lon, B.points[id]!.lon))).toBeLessThan(1e-9);
    }
    expect(c.houses?.cusps).toHaveLength(12);
    // MC derived from the midpoint ARMC lies in the 10th-cusp position
    expect(separation(c.points.mc!.lon, c.houses!.cusps[9].lon)).toBeLessThan(1e-6);
  });

  it("produces inter-aspects in both directions and a digest", () => {
    const s = synastry(A, B);
    expect(s.bOnA.aspects.length).toBeGreaterThan(5);
    expect(s.aOnB.aspects.length).toBeGreaterThan(5);
    expect(s.bOnA.points.every((p) => p.house !== null)).toBe(true);
    expect(synastryFacts(s)).toContain("SYNASTRY between Jobs (A) and Obama (B)");
  });
});
