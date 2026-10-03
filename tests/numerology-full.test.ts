import { describe, expect, it } from "vitest";
import { fullProfile, CHALDEAN } from "@/lib/numerology/full";

describe("full numerology profile", () => {
  const p = fullProfile("Steven Paul Jobs", "1955-02-24", { y: 2026, m: 10, d: 2 });

  it("core numbers match the Pythagorean core module", () => {
    expect(p.lifePath.value).toBe(1);
    expect(p.expression.value).toBe(1);
    expect(p.soulUrge.value).toBe(11);
    expect(p.karmicDebts).toContain(14);
  });

  it("pinnacles: first ends at 36 − Life Path, then 9-year spans", () => {
    // month 2, day 24→6, year 1955→20→2; LP 1 → first pinnacle to age 35
    expect(p.pinnacles.map((x) => x.number)).toEqual([8, 8, 7, 4]);
    expect(p.pinnacles.map((x) => [x.fromAge, x.toAge])).toEqual([[0, 35], [35, 44], [44, 53], [53, null]]);
  });

  it("challenges are absolute differences", () => {
    expect(p.challenges.map((x) => x.number)).toEqual([4, 4, 0, 0]);
  });

  it("Chaldean uses 1–8 values and a single compound total", () => {
    expect(Object.values(CHALDEAN).every((v) => v >= 1 && v <= 8)).toBe(true);
    const c = fullProfile("Steven Paul Jobs", "1955-02-24", { y: 2026, m: 10, d: 2 }, "chaldean");
    // STEVEN 3+4+5+6+5+5=28, PAUL 8+1+6+3=18, JOBS 1+7+2+3=13 → 59 → 14 → 5
    expect(c.expression.compound).toBe(59);
    expect(c.expression.value).toBe(5);
    expect(c.karmicLessons.every((n) => n <= 8)).toBe(true);
  });

  it("karmic lessons are the numbers missing from the name", () => {
    const q = fullProfile("Ann", "2000-01-01", { y: 2026, m: 1, d: 1 });
    // A=1, N=5 → missing 2,3,4,6,7,8,9
    expect(q.karmicLessons).toEqual([2, 3, 4, 6, 7, 8, 9]);
    expect(q.hiddenPassion).toEqual([5]);
  });
});
