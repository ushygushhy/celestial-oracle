import { describe, expect, it } from "vitest";
import { dignityOf, termRuler } from "@/lib/astro/dignities";
import { chaldeanFaceRuler, type PointId } from "@/lib/astro/constants";
import { aspectBetween, findAspects, DEFAULT_ASPECT_SETTINGS, signedOrb, type AspectBody } from "@/lib/astro/aspects";
import { findPatterns } from "@/lib/astro/patterns";
import { formatLon, zodiacPosition, arc } from "@/lib/astro/math";
import { houseOf } from "@/lib/astro/chart";

const body = (id: PointId, lon: number, speed = 1): AspectBody => ({ id, lon, speed, signIndex: Math.floor(lon / 30) });

describe("formatting", () => {
  it("rounds to the nearest arcminute", () => {
    expect(formatLon(224.45)).toBe("14°27' Scorpio");
    expect(formatLon(335.748135)).toBe("5°45' Pisces");
  });
  it("never rounds into the next sign", () => {
    expect(formatLon(29.9999)).toBe("29°59' Aries");
    expect(zodiacPosition(29.9999).sign.id).toBe("aries");
  });
  it("shows seconds when asked", () => {
    expect(formatLon(335.748135, "name", true)).toBe(`5°44'53" Pisces`);
  });
  it("computes signed arcs across 0° Aries", () => {
    expect(arc(359, 1)).toBeCloseTo(2);
    expect(arc(1, 359)).toBeCloseTo(-2);
  });
});

describe("essential dignities", () => {
  it("domicile / exaltation / detriment / fall", () => {
    expect(dignityOf("sun", 130, "day").major).toEqual(["domicile"]);
    expect(dignityOf("sun", 18, "day").major).toEqual(["exaltation"]);
    expect(dignityOf("sun", 310, "day").major).toEqual(["detriment"]);
    expect(dignityOf("sun", 190, "day").major).toEqual(["fall"]);
    expect(dignityOf("mercury", 165, "day").major).toEqual(["domicile", "exaltation"]);
    expect(dignityOf("mercury", 345, "day").major).toEqual(["detriment", "fall"]);
    expect(dignityOf("saturn", 280, "day").major).toEqual(["domicile"]);
    expect(dignityOf("saturn", 100, "day").major).toEqual(["detriment"]);
  });

  it("Egyptian terms and Chaldean faces", () => {
    expect(termRuler(10)).toBe("venus"); // Aries 6–12 Venus
    expect(termRuler(29.5)).toBe("saturn"); // Aries 25–30 Saturn
    expect(termRuler(30 * 8 + 12.5)).toBe("venus"); // Sagittarius 12–17 Venus
    expect(chaldeanFaceRuler(5)).toBe("mars"); // Aries I
    expect(chaldeanFaceRuler(15)).toBe("sun"); // Aries II
    expect(chaldeanFaceRuler(55)).toBe("saturn"); // Taurus III
    expect(chaldeanFaceRuler(355)).toBe("mars"); // Pisces III closes the cycle
  });

  it("peregrine = no domicile, exaltation, triplicity, term or face", () => {
    // Mars at 5° Gemini (day): term Mercury, face Jupiter, air day-triplicity Saturn
    const d = dignityOf("mars", 65, "day");
    expect(d.peregrine).toBe(true);
    expect(d.label).toBe("peregrine");
    expect(d.score).toBe(-5);
    // Mars at 20° Gemini holds its own term → not peregrine
    expect(dignityOf("mars", 80, "day").peregrine).toBe(false);
  });

  it("triplicity respects sect", () => {
    // Jupiter in Leo: fire night ruler
    expect(dignityOf("jupiter", 135, "night").minor).toContain("triplicity");
    expect(dignityOf("jupiter", 135, "day").minor).not.toContain("triplicity");
  });

  it("outer planets use modern rulership and are labelled as such", () => {
    expect(dignityOf("pluto", 220, null).major).toEqual(["domicile"]);
    expect(dignityOf("uranus", 130, null).major).toEqual(["detriment"]);
    expect(dignityOf("neptune", 340, null).system).toBe("modern");
  });
});

describe("aspects", () => {
  it("finds a square within orb and reports the exact orb", () => {
    const a = aspectBetween(body("mars", 10), body("saturn", 104), DEFAULT_ASPECT_SETTINGS)!;
    expect(a.type).toBe("square");
    expect(a.orb).toBeCloseTo(4);
  });

  it("applying vs separating", () => {
    // Faster Mars behind a square to slow Saturn and moving toward it → applying
    expect(aspectBetween(body("mars", 10, 0.6), body("saturn", 104, 0.03), DEFAULT_ASPECT_SETTINGS)!.applying).toBe(true);
    // Mars past the exact square → separating
    expect(aspectBetween(body("mars", 18, 0.6), body("saturn", 104, 0.03), DEFAULT_ASPECT_SETTINGS)!.applying).toBe(false);
    // Retrograde Mars backing into the exact square from beyond it → applying
    expect(aspectBetween(body("mars", 18, -0.3), body("saturn", 104, 0.03), DEFAULT_ASPECT_SETTINGS)!.applying).toBe(true);
  });

  it("flags out-of-sign (dissociate) aspects", () => {
    const a = aspectBetween(body("sun", 29), body("moon", 121), DEFAULT_ASPECT_SETTINGS)!; // 29° Aries, 1° Leo
    expect(a.type).toBe("square");
    expect(a.outOfSign).toBe(true);
  });

  it("gives the luminaries a wider orb", () => {
    expect(aspectBetween(body("sun", 0), body("mars", 98.5), DEFAULT_ASPECT_SETTINGS)?.type).toBe("square");
    expect(aspectBetween(body("venus", 0), body("mars", 98.5), DEFAULT_ASPECT_SETTINGS)).toBeNull();
  });

  it("finds minor aspects", () => {
    expect(aspectBetween(body("venus", 0), body("mars", 150.5), DEFAULT_ASPECT_SETTINGS)?.type).toBe("quincunx");
    expect(aspectBetween(body("venus", 0), body("mars", 45.5), DEFAULT_ASPECT_SETTINGS)?.type).toBe("semisquare");
    expect(aspectBetween(body("venus", 0), body("mars", 134), DEFAULT_ASPECT_SETTINGS)?.type).toBe("sesquiquadrate");
  });

  it("signedOrb measures distance from the nearest exact point", () => {
    expect(signedOrb(98, 10, 90)).toBeCloseTo(-2);
    expect(signedOrb(282, 10, 90)).toBeCloseTo(2);
  });
});

describe("aspect patterns", () => {
  const run = (bodies: AspectBody[]) =>
    findPatterns({
      aspects: findAspects(bodies, DEFAULT_ASPECT_SETTINGS),
      eligible: bodies.map((b) => b.id),
      signOf: (p) => bodies.find((b) => b.id === p)!.signIndex,
      houseOf: () => null,
      elementOf: (p) => (["fire", "earth", "air", "water"] as const)[bodies.find((b) => b.id === p)!.signIndex % 4],
    });

  it("T-square with apex", () => {
    const p = run([body("sun", 10), body("moon", 190), body("mars", 100)]);
    const t = p.find((x) => x.type === "t-square")!;
    expect(t.apex).toBe("mars");
  });

  it("Grand Cross", () => {
    const p = run([body("sun", 10), body("moon", 190), body("mars", 100), body("saturn", 280)]);
    expect(p.some((x) => x.type === "grand-cross")).toBe(true);
  });

  it("Grand Trine in one element, and a Kite", () => {
    const p = run([body("sun", 5), body("jupiter", 125), body("saturn", 245), body("moon", 185)]);
    const gt = p.find((x) => x.type === "grand-trine")!;
    expect(gt.detail).toBe("fire grand trine");
    const kite = p.find((x) => x.type === "kite")!;
    expect(kite.apex).toBe("moon");
  });

  it("Yod with apex", () => {
    const p = run([body("venus", 10), body("mars", 70), body("pluto", 220)]);
    expect(p.find((x) => x.type === "yod")!.apex).toBe("pluto");
  });

  it("Stellium by sign", () => {
    const p = run([body("sun", 185), body("mercury", 195), body("venus", 205), body("mars", 50)]);
    expect(p.find((x) => x.type === "stellium-sign")!.points).toEqual(["sun", "mercury", "venus"]);
  });
});

describe("house placement", () => {
  const cusps = [350, 20, 50, 80, 110, 140, 170, 200, 230, 260, 290, 320];
  it("handles the 0° Aries wrap", () => {
    expect(houseOf(355, cusps)).toBe(1);
    expect(houseOf(5, cusps)).toBe(1);
    expect(houseOf(20, cusps)).toBe(2);
    expect(houseOf(349.9, cusps)).toBe(12);
  });
});
