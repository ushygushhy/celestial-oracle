/**
 * Full numerology profile: Pythagorean or Chaldean letter values, core numbers,
 * karmic debt and lessons, hidden passion, pinnacles and challenges with age
 * ranges, and personal cycles — every reduction shown.
 */
import {
  KARMIC_DEBT, MASTER, PYTHAGOREAN, isVowel, lifePath, normalizeName, personalCycles, reduce,
  type CoreNumber,
} from "./core";

export type NumerologySystem = "pythagorean" | "chaldean";

/** Chaldean values (1–8; 9 is considered sacred and assigned to no letter). */
export const CHALDEAN: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 8, G: 3, H: 5, I: 1, J: 1, K: 2, L: 3, M: 4,
  N: 5, O: 7, P: 8, Q: 1, R: 2, S: 3, T: 4, U: 6, V: 6, W: 6, X: 5, Y: 1, Z: 7,
};

const valuesFor = (s: NumerologySystem) => (s === "chaldean" ? CHALDEAN : PYTHAGOREAN);

export interface LetterCell { letter: string; value: number; vowel: boolean }

export function letterChart(name: string, system: NumerologySystem): LetterCell[][] {
  const v = valuesFor(system);
  return normalizeName(name).map((w) => w.split("").map((ch, i) => ({ letter: ch, value: v[ch], vowel: isVowel(w, i) })));
}

function finish(total: number, steps: string[], intermediates: number[], keepMaster: boolean): CoreNumber {
  const r = reduce(total, keepMaster);
  const karmic = [...new Set([...intermediates, ...r.totals].filter((t) => KARMIC_DEBT.includes(t)))];
  return { value: r.value, compound: total, steps: [...steps, ...r.steps], karmicDebt: karmic, master: keepMaster && MASTER.includes(r.value) };
}

/**
 * Name numbers. Pythagorean: each name reduced separately, then summed (master
 * numbers kept). Chaldean: one compound total of all letters, then reduced.
 */
function nameNumber(name: string, system: NumerologySystem, pick: (w: string, i: number) => boolean, label: string): CoreNumber {
  const v = valuesFor(system);
  const words = normalizeName(name);
  const steps: string[] = [];
  const inter: number[] = [];
  const sums = words.map((w) => {
    const letters = w.split("").map((ch, i) => (pick(w, i) ? `${ch}${v[ch]}` : null)).filter(Boolean) as string[];
    const sum = letters.reduce((a, l) => a + Number(l.slice(1)), 0);
    return { w, letters, sum };
  });
  if (system === "pythagorean") {
    const parts = sums.map(({ w, letters, sum }) => {
      const r = reduce(sum);
      inter.push(...r.totals);
      steps.push(`${w}: ${letters.join(" ") || "—"} = ${sum}${r.steps.length ? ` → ${r.value}` : ""}`);
      return r.value;
    });
    const total = parts.reduce((a, b) => a + b, 0);
    steps.push(`${label}: ${parts.join(" + ")} = ${total}`);
    return finish(total, steps, inter, true);
  }
  for (const { w, letters, sum } of sums) steps.push(`${w}: ${letters.join(" ") || "—"} = ${sum}`);
  const total = sums.reduce((a, s) => a + s.sum, 0);
  steps.push(`${label} compound: ${sums.map((s) => s.sum).join(" + ")} = ${total}`);
  return finish(total, steps, [], false);
}

export interface Period { number: number; label: string; fromAge: number; toAge: number | null; steps: string }

export interface FullProfile {
  system: NumerologySystem;
  name: string;
  birthDate: string;
  lifePath: CoreNumber;
  expression: CoreNumber;
  soulUrge: CoreNumber;
  personality: CoreNumber;
  birthday: CoreNumber;
  maturity: CoreNumber;
  karmicDebts: number[];
  karmicLessons: number[];
  hiddenPassion: number[];
  pinnacles: Period[];
  challenges: Period[];
  cycles: ReturnType<typeof personalCycles>;
  letters: LetterCell[][];
}

export function fullProfile(name: string, birthDate: string, on: { y: number; m: number; d: number }, system: NumerologySystem = "pythagorean"): FullProfile {
  const lp = lifePath(birthDate);
  const expression = nameNumber(name, system, () => true, "Expression");
  const soulUrge = nameNumber(name, system, (w, i) => isVowel(w, i), "Soul Urge");
  const personality = nameNumber(name, system, (w, i) => !isVowel(w, i), "Personality");
  const day = Number(birthDate.split("-")[2]);
  const birthday = finish(day, [`day of birth ${day}`], [], true);
  const matTotal = lp.value + expression.value;
  const maturity = finish(matTotal, [`Life Path ${lp.value} + Expression ${expression.value} = ${matTotal}`], [], true);

  // Karmic lessons & hidden passion use the letter values of the full name
  const counts = new Map<number, number>();
  for (const w of letterChart(name, system)) for (const c of w) counts.set(c.value, (counts.get(c.value) ?? 0) + 1);
  const range = system === "chaldean" ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const karmicLessons = range.filter((n) => !counts.get(n));
  const max = Math.max(0, ...counts.values());
  const hiddenPassion = max ? [...counts.entries()].filter(([, c]) => c === max).map(([n]) => n).sort((a, b) => a - b) : [];

  // Pinnacles & challenges (single-digit month/day/year; master numbers kept in pinnacles)
  const [y, m] = birthDate.split("-").map(Number);
  const rm = reduce(m, false).value, rd = reduce(day, false).value, ry = reduce(y, false).value;
  const lpRoot = reduce(lp.value, false).value;
  const firstEnd = 36 - lpRoot;
  const p = (a: number, b: number) => reduce(a + b, true).value;
  const p1 = p(rm, rd), p2 = p(rd, ry), p3 = p(p1, p2), p4 = p(rm, ry);
  const pinnacles: Period[] = [
    { number: p1, label: "First", fromAge: 0, toAge: firstEnd, steps: `month ${rm} + day ${rd}` },
    { number: p2, label: "Second", fromAge: firstEnd, toAge: firstEnd + 9, steps: `day ${rd} + year ${ry}` },
    { number: p3, label: "Third", fromAge: firstEnd + 9, toAge: firstEnd + 18, steps: `first ${p1} + second ${p2}` },
    { number: p4, label: "Fourth", fromAge: firstEnd + 18, toAge: null, steps: `month ${rm} + year ${ry}` },
  ];
  const c1 = Math.abs(rm - rd), c2 = Math.abs(rd - ry), c3 = Math.abs(c1 - c2), c4 = Math.abs(rm - ry);
  const challenges: Period[] = [
    { number: c1, label: "First", fromAge: 0, toAge: firstEnd, steps: `|month ${rm} − day ${rd}|` },
    { number: c2, label: "Second", fromAge: firstEnd, toAge: firstEnd + 9, steps: `|day ${rd} − year ${ry}|` },
    { number: c3, label: "Third (main)", fromAge: firstEnd + 9, toAge: firstEnd + 18, steps: `|first ${c1} − second ${c2}|` },
    { number: c4, label: "Fourth", fromAge: firstEnd + 18, toAge: null, steps: `|month ${rm} − year ${ry}|` },
  ];

  const karmicDebts = [...new Set([lp, expression, soulUrge, personality, birthday].flatMap((n) => n.karmicDebt))].sort();

  return {
    system, name, birthDate, lifePath: lp, expression, soulUrge, personality, birthday, maturity,
    karmicDebts, karmicLessons, hiddenPassion, pinnacles, challenges,
    cycles: personalCycles(birthDate, on),
    letters: letterChart(name, system),
  };
}

export const CHALLENGE_MEANINGS: Record<number, string> = {
  0: "The choice challenge: all lessons are available; nothing is forced, so the work is self-directed.",
  1: "Asserting yourself without domineering; standing up for your own ideas.",
  2: "Oversensitivity and fear of conflict; learning confident cooperation.",
  3: "Scattered or blocked self-expression; trusting your voice.",
  4: "Rigidity or avoidance of effort; building patiently and adapting the plan.",
  5: "Restlessness and excess; freedom through responsible choices.",
  6: "Control and perfectionism in relationships; accepting others as they are.",
  7: "Isolation and distrust; letting faith and people in.",
  8: "Money and power struggles; balancing the material and the spiritual.",
};
