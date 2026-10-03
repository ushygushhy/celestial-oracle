import { CARD_BY_ID } from "../tarot/deck";
import type { SpreadPosition } from "../tarot/spreads";
import type { NatalChart } from "../astro/chart";
import { buildOverlay } from "../services/overlay-service";
import { ASPECTS, POINTS } from "../astro/constants";
import { formatArc } from "../astro/math";

export function tarotFacts(question: string, spreadName: string, positions: Pick<SpreadPosition, "label" | "meaning">[], cards: { id: string; reversed: boolean }[], natal: NatalChart | null): string {
  const L: string[] = [`TAROT READING — spread: ${spreadName}`, `Question: ${question.trim() || "(no question — a general reading)"}`, ""];
  const tally = { fire: 0, water: 0, air: 0, earth: 0 };
  let majors = 0, reversed = 0;
  cards.forEach((c, i) => {
    const card = CARD_BY_ID.get(c.id);
    if (!card) return;
    const pos = positions[i];
    const side = c.reversed ? card.reversed : card.upright;
    tally[card.element]++;
    if (card.arcana === "major") majors++;
    if (c.reversed) reversed++;
    L.push(`${i + 1}. ${pos?.label ?? `Position ${i + 1}`} (${pos?.meaning ?? ""}): ${card.name}${c.reversed ? " — REVERSED" : ""}`);
    L.push(`   keywords: ${side.keywords.join(", ")}; traditional sense: ${side.meaning}`);
    L.push(`   element ${card.element}; astrology ${card.astrology}; numerology ${card.numerology}`);
  });
  L.push("", `Overview: ${majors} Major Arcana of ${cards.length}; ${reversed} reversed; elements — fire ${tally.fire}, water ${tally.water}, air ${tally.air}, earth ${tally.earth}.`);
  if (natal) {
    const o = buildOverlay(natal, "transits", { date: new Date() });
    const key = (["sun", "moon", "asc"] as const).map((id) => natal.points[id] ? `${POINTS[id].name} ${natal.points[id]!.formatted}` : null).filter(Boolean).join(", ");
    L.push("", `Querent: ${natal.name} — ${key}.`);
    L.push(`Current transits to their chart (calculated): ${o.aspects.slice(0, 12).map((a) => `${POINTS[a.a].name} ${ASPECTS[a.type].name.toLowerCase()} natal ${POINTS[a.b].name} (${formatArc(a.orb)}, ${a.applying ? "applying" : "separating"})`).join("; ") || "none within orb"}.`);
    L.push("Where a card's astrological correspondence echoes one of these transits, you may note the resonance — but do not invent positions.");
  }
  return L.join("\n");
}
