import { describe, expect, it } from "vitest";
import { DECK, CARD_BY_ID } from "@/lib/tarot/deck";
import { SPREADS, customSpread } from "@/lib/tarot/spreads";

describe("tarot deck", () => {
  it("has 78 unique cards: 22 majors and four 14-card suits", () => {
    expect(DECK).toHaveLength(78);
    expect(new Set(DECK.map((c) => c.id)).size).toBe(78);
    expect(DECK.filter((c) => c.arcana === "major")).toHaveLength(22);
    for (const s of ["wands", "cups", "swords", "pentacles"]) expect(DECK.filter((c) => c.suit === s)).toHaveLength(14);
  });
  it("uses Golden Dawn correspondences", () => {
    expect(CARD_BY_ID.get("major-19")!.astrology).toBe("Sun");
    expect(CARD_BY_ID.get("major-16")!.astrology).toBe("Mars");
    expect(CARD_BY_ID.get("major-08")!.name).toBe("Strength");
    expect(CARD_BY_ID.get("major-08")!.astrology).toBe("Leo");
    expect(CARD_BY_ID.get("swords-03")!.astrology).toBe("Saturn in Libra");
    expect(CARD_BY_ID.get("pentacles-10")!.astrology).toBe("Mercury in Virgo");
    expect(CARD_BY_ID.get("cups-01")!.astrology).toBe("Root of Water");
  });
  it("every card has upright and reversed meanings", () => {
    for (const c of DECK) {
      expect(c.upright.meaning.length).toBeGreaterThan(20);
      expect(c.reversed.meaning.length).toBeGreaterThan(20);
      expect(c.upright.keywords.length).toBeGreaterThan(1);
    }
  });
  it("spreads have the expected sizes", () => {
    expect(SPREADS.map((s) => s.positions.length)).toEqual([1, 3, 10, 12]);
    expect(customSpread("c", "Test", [{ label: "A", meaning: "" }, { label: "B", meaning: "" }]).positions).toHaveLength(2);
  });
});
