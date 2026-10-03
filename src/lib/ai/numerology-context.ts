import type { FullProfile } from "../numerology/full";
import { label } from "../numerology/core";

export function numerologyFacts(p: FullProfile, today: string): string {
  const row = (name: string, n: FullProfile["lifePath"]) => `- ${name}: ${label(n)}${n.master ? " (master number)" : ""}${n.karmicDebt.length ? ` (karmic debt ${n.karmicDebt.join(", ")})` : ""} — ${n.steps.join("; ")}`;
  return [
    `NUMEROLOGY (${p.system}) for "${p.name}", born ${p.birthDate}:`,
    row("Life Path", p.lifePath),
    row("Expression / Destiny", p.expression),
    row("Soul Urge / Heart's Desire", p.soulUrge),
    row("Personality", p.personality),
    row("Birthday", p.birthday),
    row("Maturity", p.maturity),
    `Karmic debt numbers present: ${p.karmicDebts.join(", ") || "none"}.`,
    `Karmic lessons (missing numbers in the name): ${p.karmicLessons.join(", ") || "none"}. Hidden passion: ${p.hiddenPassion.join(", ") || "—"}.`,
    `Pinnacles: ${p.pinnacles.map((x) => `${x.label} ${x.number} (ages ${x.fromAge}–${x.toAge ?? "life"}; ${x.steps})`).join("; ")}.`,
    `Challenges: ${p.challenges.map((x) => `${x.label} ${x.number} (ages ${x.fromAge}–${x.toAge ?? "life"})`).join("; ")}.`,
    `Personal cycles on ${today}: Year ${label(p.cycles.year)}, Month ${label(p.cycles.month)}, Day ${label(p.cycles.day)}.`,
    p.system === "chaldean" ? "Note: Chaldean values run 1–8 and the compound (pre-reduction) numbers carry their own meaning; master numbers are not held." : "Note: Pythagorean values with master numbers 11/22/33 held.",
  ].join("\n");
}
