/**
 * Pythagorean numerology core numbers, with the reduction shown step by step.
 * Master numbers 11, 22 and 33 are kept; karmic debt numbers 13, 14, 16 and 19
 * are flagged wherever they appear as an intermediate total.
 */

export const MASTER = [11, 22, 33];
export const KARMIC_DEBT = [13, 14, 16, 19];

export interface Reduction {
  value: number;
  /** e.g. ["1997 → 1+9+9+7 = 26", "26 → 2+6 = 8"] */
  steps: string[];
  /** every total seen on the way down, including the start */
  totals: number[];
}

const digits = (n: number) => String(n).split("").map(Number);

/** Reduce by summing digits until a single digit or (optionally) a master number. */
export function reduce(n: number, keepMaster = true): Reduction {
  const steps: string[] = [];
  const totals = [n];
  let cur = n;
  while (cur > 9 && !(keepMaster && MASTER.includes(cur))) {
    const ds = digits(cur);
    const next = ds.reduce((a, b) => a + b, 0);
    steps.push(`${cur} → ${ds.join("+")} = ${next}`);
    cur = next;
    totals.push(cur);
  }
  return { value: cur, steps, totals };
}

export const PYTHAGOREAN: Record<string, number> = Object.fromEntries(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch, i) => [ch, (i % 9) + 1]),
);

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

/** Letters only, uppercased, diacritics removed. */
export function normalizeName(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
}

/** Y counts as a vowel when neither neighbour is a vowel (Lynn, Mary), else a consonant (Yolanda, Maya). */
export function isVowel(word: string, i: number): boolean {
  const ch = word[i];
  if (VOWELS.has(ch)) return true;
  if (ch !== "Y") return false;
  return !VOWELS.has(word[i - 1] ?? "") && !VOWELS.has(word[i + 1] ?? "");
}

export interface CoreNumber {
  value: number;
  /** compound total before the final reduction, e.g. 29 for 29/11 */
  compound: number;
  steps: string[];
  karmicDebt: number[];
  master: boolean;
}

function finish(total: number, steps: string[], intermediates: number[]): CoreNumber {
  const r = reduce(total);
  const karmic = [...new Set([...intermediates, ...r.totals].filter((t) => KARMIC_DEBT.includes(t)))];
  return { value: r.value, compound: total, steps: [...steps, ...r.steps], karmicDebt: karmic, master: MASTER.includes(r.value) };
}

/** Life Path: month, day and year reduced separately, then summed and reduced. */
export function lifePath(date: string): CoreNumber {
  const [y, m, d] = date.split("-").map(Number);
  const parts = [["month", m], ["day", d], ["year", y]] as const;
  const steps: string[] = [];
  const inter: number[] = [];
  const reduced = parts.map(([label, n]) => {
    const r = reduce(n);
    steps.push(`${label} ${n}${r.steps.length ? `: ${r.steps.join("; ")}` : ""} → ${r.value}`);
    inter.push(...r.totals);
    return r.value;
  });
  const total = reduced.reduce((a, b) => a + b, 0);
  steps.push(`${reduced.join(" + ")} = ${total}`);
  return finish(total, steps, inter);
}

function nameNumber(fullName: string, pick: (word: string, i: number) => boolean, label: string): CoreNumber {
  const words = normalizeName(fullName);
  const steps: string[] = [];
  const inter: number[] = [];
  const parts = words.map((w) => {
    const letters = w.split("").map((ch, i) => (pick(w, i) ? `${ch}${PYTHAGOREAN[ch]}` : null)).filter(Boolean) as string[];
    const sum = letters.reduce((a, l) => a + Number(l.slice(1)), 0);
    const r = reduce(sum);
    inter.push(...r.totals);
    steps.push(`${w}: ${letters.join(" ") || "—"} = ${sum}${r.steps.length ? ` → ${r.value}` : ""}`);
    return r.value;
  });
  const total = parts.reduce((a, b) => a + b, 0);
  steps.push(`${label}: ${parts.join(" + ")} = ${total}`);
  return finish(total, steps, inter);
}

export const expression = (name: string) => nameNumber(name, () => true, "Expression");
export const soulUrge = (name: string) => nameNumber(name, (w, i) => isVowel(w, i), "Soul Urge");
export const personality = (name: string) => nameNumber(name, (w, i) => !isVowel(w, i), "Personality");

export function birthday(date: string): CoreNumber {
  const d = Number(date.split("-")[2]);
  return finish(d, [`day of birth ${d}`], []);
}

export function maturity(lp: CoreNumber, expr: CoreNumber): CoreNumber {
  const total = lp.value + expr.value;
  return finish(total, [`Life Path ${lp.value} + Expression ${expr.value} = ${total}`], []);
}

export interface PersonalCycles {
  year: CoreNumber;
  month: CoreNumber;
  day: CoreNumber;
}

/** Personal Year (calendar-year method), Month and Day for the given date. */
export function personalCycles(birthDate: string, on: { y: number; m: number; d: number }): PersonalCycles {
  const [, bm, bd] = birthDate.split("-").map(Number);
  const rm = reduce(bm, false).value, rd = reduce(bd, false).value, ry = reduce(on.y, false).value;
  const yTotal = rm + rd + ry;
  const year = finish(yTotal, [`birth month ${bm} → ${rm}, birth day ${bd} → ${rd}, year ${on.y} → ${ry}`, `${rm} + ${rd} + ${ry} = ${yTotal}`], []);
  const yRoot = reduce(year.value, false).value;
  const mTotal = yRoot + reduce(on.m, false).value;
  const month = finish(mTotal, [`personal year ${yRoot} + month ${on.m} = ${mTotal}`], []);
  const mRoot = reduce(month.value, false).value;
  const dTotal = mRoot + reduce(on.d, false).value;
  const day = finish(dTotal, [`personal month ${mRoot} + day ${on.d} = ${dTotal}`], []);
  return { year, month, day };
}

export interface NumerologyProfile {
  name: string;
  lifePath: CoreNumber;
  expression: CoreNumber;
  soulUrge: CoreNumber;
  personality: CoreNumber;
  birthday: CoreNumber;
  maturity: CoreNumber;
  cycles: PersonalCycles;
}

export function numerologyProfile(fullName: string, birthDate: string, on: { y: number; m: number; d: number }): NumerologyProfile {
  const lp = lifePath(birthDate);
  const ex = expression(fullName);
  return {
    name: fullName,
    lifePath: lp,
    expression: ex,
    soulUrge: soulUrge(fullName),
    personality: personality(fullName),
    birthday: birthday(birthDate),
    maturity: maturity(lp, ex),
    cycles: personalCycles(birthDate, on),
  };
}

export const label = (n: CoreNumber) => (n.master ? `${n.value}` : n.compound > 9 && n.compound !== n.value ? `${n.compound}/${n.value}` : `${n.value}`);
