import { describe, expect, it } from "vitest";
import { spreadLongitudes, polar } from "@/components/chart/wheel-geometry";
import { separation } from "@/lib/astro/math";

const minGap = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  let m = Infinity;
  for (let i = 0; i < s.length; i++) m = Math.min(m, separation(s[i], s[(i + 1) % s.length]));
  return m;
};

describe("wheel glyph collision avoidance", () => {
  it("fans a cluster symmetrically around its mean and leaves loners alone", () => {
    const out = spreadLongitudes([10, 11, 12, 200], 5);
    expect(out[0]).toBeCloseTo(6);
    expect(out[1]).toBeCloseTo(11);
    expect(out[2]).toBeCloseTo(16);
    expect(out[3]).toBeCloseTo(200);
  });

  it("handles clusters straddling 0° Aries", () => {
    const out = spreadLongitudes([358, 359, 1], 5);
    expect(minGap(out)).toBeGreaterThanOrEqual(5 - 1e-9);
    expect(separation(out[1], 359.333)).toBeLessThan(0.01);
  });

  it("keeps a minimum separation even for a dense stellium", () => {
    const lons = [100, 101, 101.5, 102, 103, 103.2, 104, 160, 162];
    expect(minGap(spreadLongitudes(lons, 6))).toBeGreaterThanOrEqual(6 - 1e-9);
  });

  it("places the Ascendant at 9 o'clock with the zodiac counter-clockwise", () => {
    const asc = polar(500, 500, 100, 172, 172);
    expect(asc).toEqual({ x: 400, y: 500 });
    const ic = polar(500, 500, 100, 262, 172); // 90° later in the zodiac → bottom
    expect(ic.x).toBeCloseTo(500);
    expect(ic.y).toBeCloseTo(600);
  });
});
