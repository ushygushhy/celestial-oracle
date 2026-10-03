import { PLANET_IDS, SIGNS, type AspectId, type Element, type PointId } from "./constants";
import type { Aspect } from "./aspects";

export type PatternType =
  | "stellium-sign" | "stellium-house"
  | "t-square" | "grand-trine" | "grand-cross" | "yod" | "kite" | "mystic-rectangle";

export interface AspectPattern {
  type: PatternType;
  name: string;
  points: PointId[];
  /** Focal point: T-square/Yod apex, Kite tail */
  apex?: PointId;
  /** Grand trine element, stellium sign, etc. */
  detail?: string;
  /** Average orb of the aspects composing the pattern */
  tightness?: number;
}

interface PatternInput {
  aspects: Aspect[];
  /** Points eligible for configurations (planets, Chiron, node, angles) */
  eligible: PointId[];
  /** sign index and house per point, for stelliums */
  signOf: (p: PointId) => number;
  houseOf: (p: PointId) => number | null;
  elementOf: (p: PointId) => Element;
}

export function findPatterns({ aspects, eligible, signOf, houseOf, elementOf }: PatternInput): AspectPattern[] {
  const set = new Set(eligible);
  const map = new Map<string, Aspect>();
  for (const a of aspects) {
    if (!set.has(a.a) || !set.has(a.b)) continue;
    map.set(`${a.a}|${a.b}`, a);
    map.set(`${a.b}|${a.a}`, a);
  }
  const get = (x: PointId, y: PointId, t: AspectId) => {
    const a = map.get(`${x}|${y}`);
    return a && a.type === t ? a : undefined;
  };
  const has = (x: PointId, y: PointId, t: AspectId) => !!get(x, y, t);
  const avgOrb = (pairs: [PointId, PointId, AspectId][]) =>
    pairs.reduce((s, [x, y, t]) => s + (get(x, y, t)?.orb ?? 0), 0) / pairs.length;

  const out: AspectPattern[] = [];
  const seen = new Set<string>();
  const add = (p: AspectPattern) => {
    const key = `${p.type}:${[...p.points].sort().join(",")}:${p.apex ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };

  const pts = eligible;
  const oppositions = aspects.filter((a) => a.type === "opposition" && set.has(a.a) && set.has(a.b));
  const sextiles = aspects.filter((a) => a.type === "sextile" && set.has(a.a) && set.has(a.b));

  // T-squares: opposition with a third body square to both ends
  for (const o of oppositions) {
    for (const c of pts) {
      if (c === o.a || c === o.b) continue;
      if (has(o.a, c, "square") && has(o.b, c, "square")) {
        add({
          type: "t-square", name: "T-Square", points: [o.a, o.b, c], apex: c,
          tightness: avgOrb([[o.a, o.b, "opposition"], [o.a, c, "square"], [o.b, c, "square"]]),
        });
      }
    }
  }

  // Grand crosses: two oppositions, all four cross-squares
  for (let i = 0; i < oppositions.length; i++) {
    for (let j = i + 1; j < oppositions.length; j++) {
      const [a, b] = [oppositions[i].a, oppositions[i].b];
      const [c, d] = [oppositions[j].a, oppositions[j].b];
      if (new Set([a, b, c, d]).size < 4) continue;
      if (has(a, c, "square") && has(a, d, "square") && has(b, c, "square") && has(b, d, "square")) {
        add({
          type: "grand-cross", name: "Grand Cross", points: [a, b, c, d],
          tightness: avgOrb([[a, b, "opposition"], [c, d, "opposition"], [a, c, "square"], [a, d, "square"], [b, c, "square"], [b, d, "square"]]),
        });
      }
      // Mystic rectangle: two oppositions joined by trines and sextiles
      for (const [p, q, r, s] of [[a, b, c, d], [a, b, d, c]] as PointId[][]) {
        if (has(p, r, "trine") && has(q, s, "trine") && has(p, s, "sextile") && has(q, r, "sextile")) {
          add({ type: "mystic-rectangle", name: "Mystic Rectangle", points: [p, q, r, s] });
        }
      }
    }
  }

  // Grand trines (and kites built on them)
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (!has(pts[i], pts[j], "trine")) continue;
      for (let k = j + 1; k < pts.length; k++) {
        const [a, b, c] = [pts[i], pts[j], pts[k]];
        if (!has(a, c, "trine") || !has(b, c, "trine")) continue;
        const els = new Set([elementOf(a), elementOf(b), elementOf(c)]);
        add({
          type: "grand-trine", name: "Grand Trine", points: [a, b, c],
          detail: els.size === 1 ? `${[...els][0]} grand trine` : "dissociate (mixed elements)",
          tightness: avgOrb([[a, b, "trine"], [a, c, "trine"], [b, c, "trine"]]),
        });
        for (const d of pts) {
          if ([a, b, c].includes(d)) continue;
          for (const [x, y, z] of [[a, b, c], [b, a, c], [c, a, b]] as PointId[][]) {
            if (has(d, x, "opposition") && has(d, y, "sextile") && has(d, z, "sextile")) {
              add({ type: "kite", name: "Kite", points: [a, b, c, d], apex: d, detail: `focal opposition ${d}–${x}` });
            }
          }
        }
      }
    }
  }

  // Yods: sextile whose ends both quincunx an apex
  for (const s of sextiles) {
    for (const c of pts) {
      if (c === s.a || c === s.b) continue;
      if (has(s.a, c, "quincunx") && has(s.b, c, "quincunx")) {
        add({
          type: "yod", name: "Yod (Finger of God)", points: [s.a, s.b, c], apex: c,
          tightness: avgOrb([[s.a, s.b, "sextile"], [s.a, c, "quincunx"], [s.b, c, "quincunx"]]),
        });
      }
    }
  }

  // Stelliums: 3+ planets (Sun–Pluto) in one sign or one house
  const planets = PLANET_IDS.filter((p) => set.has(p));
  const bySign = new Map<number, PointId[]>();
  const byHouse = new Map<number, PointId[]>();
  for (const p of planets) {
    const s = signOf(p);
    bySign.set(s, [...(bySign.get(s) ?? []), p]);
    const h = houseOf(p);
    if (h) byHouse.set(h, [...(byHouse.get(h) ?? []), p]);
  }
  for (const [s, members] of bySign) {
    if (members.length >= 3) add({ type: "stellium-sign", name: `Stellium in ${SIGNS[s].name}`, points: members, detail: SIGNS[s].name });
  }
  for (const [h, members] of byHouse) {
    if (members.length >= 3) add({ type: "stellium-house", name: `Stellium in the ${ordinal(h)} house`, points: members, detail: `house ${h}` });
  }

  return out;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
