import {
  EGYPTIAN_TERMS, EXALTATION, MODERN_EXALTATION_CONTESTED, MODERN_RULER, SIGNS, TRADITIONAL_PLANETS,
  TRADITIONAL_RULER, TRIPLICITY, chaldeanFaceRuler, signAt,
  type PlanetId, type PointId, type SignId,
} from "./constants";
import { norm360 } from "./math";

export type MajorDignity = "domicile" | "exaltation" | "detriment" | "fall";
export type MinorDignity = "triplicity" | "term" | "face";

export interface DignityReport {
  /** Major dignities/debilities that apply (Mercury in Virgo → domicile + exaltation). */
  major: MajorDignity[];
  /** Minor essential dignities held (traditional planets only). */
  minor: MinorDignity[];
  /** No domicile, exaltation, triplicity, term or face (traditional definition). */
  peregrine: boolean;
  /** One-word headline for tables. */
  label: MajorDignity | "peregrine" | "—";
  /** William Lilly's essential dignity points (+5 dom, +4 exalt, +3 trip, +2 term, +1 face, −5 det, −4 fall, −5 peregrine). */
  score: number | null;
  /** Rulers of the planet's degree, for dispositor chains and almuten analysis. */
  rulers: {
    domicile: PlanetId;
    modernDomicile: PlanetId;
    exaltation: PlanetId | null;
    triplicity: [PlanetId, PlanetId, PlanetId];
    term: PlanetId;
    face: PlanetId;
  };
  /** Notes such as "modern rulership" or "contested modern exaltation". */
  notes: string[];
  system: "traditional" | "modern" | "none";
}

const opposite = (sign: SignId): SignId => SIGNS[(SIGNS.findIndex((s) => s.id === sign) + 6) % 12].id;

export function termRuler(lon: number): PlanetId {
  const l = norm360(lon);
  const sign = signAt(l);
  const deg = l - sign.index * 30;
  for (const [ruler, end] of EGYPTIAN_TERMS[sign.id]) if (deg < end) return ruler;
  return EGYPTIAN_TERMS[sign.id][4][0];
}

export function exaltationRuler(sign: SignId): PlanetId | null {
  for (const [planet, ex] of Object.entries(EXALTATION)) if (ex!.sign === sign) return planet as PlanetId;
  return null;
}

/**
 * @param sect  "day" | "night" | null (unknown birth time → both triplicity rulers counted)
 */
export function dignityOf(point: PointId, lon: number, sect: "day" | "night" | null): DignityReport {
  const sign = signAt(lon);
  const trip = TRIPLICITY[sign.element];
  const rulers = {
    domicile: TRADITIONAL_RULER[sign.id],
    modernDomicile: MODERN_RULER[sign.id],
    exaltation: exaltationRuler(sign.id),
    triplicity: trip,
    term: termRuler(lon),
    face: chaldeanFaceRuler(lon),
  };

  const isTraditional = (TRADITIONAL_PLANETS as string[]).includes(point);
  const isOuter = point === "uranus" || point === "neptune" || point === "pluto";

  if (!isTraditional && !isOuter) {
    return { major: [], minor: [], peregrine: false, label: "—", score: null, rulers, notes: [], system: "none" };
  }

  const planet = point as PlanetId;
  const major: MajorDignity[] = [];
  const minor: MinorDignity[] = [];
  const notes: string[] = [];

  if (isTraditional) {
    // Domicile / detriment use the traditional rulers; Mercury etc. have two signs.
    const ruled = (Object.keys(TRADITIONAL_RULER) as SignId[]).filter((s) => TRADITIONAL_RULER[s] === planet);
    if (ruled.includes(sign.id)) major.push("domicile");
    if (EXALTATION[planet]?.sign === sign.id) major.push("exaltation");
    if (ruled.some((s) => opposite(s) === sign.id)) major.push("detriment");
    if (EXALTATION[planet] && opposite(EXALTATION[planet]!.sign) === sign.id) major.push("fall");

    const [day, night, part] = trip;
    if (sect === "day" ? planet === day : sect === "night" ? planet === night : planet === day || planet === night) {
      minor.push("triplicity");
    } else if (planet === part) {
      notes.push("participating triplicity ruler");
    }
    if (rulers.term === planet) minor.push("term");
    if (rulers.face === planet) minor.push("face");

    const peregrine = !major.includes("domicile") && !major.includes("exaltation") && minor.length === 0;
    let score = 0;
    if (major.includes("domicile")) score += 5;
    if (major.includes("exaltation")) score += 4;
    if (minor.includes("triplicity")) score += 3;
    if (minor.includes("term")) score += 2;
    if (minor.includes("face")) score += 1;
    if (major.includes("detriment")) score -= 5;
    if (major.includes("fall")) score -= 4;
    if (peregrine) score -= 5;

    const label: DignityReport["label"] = major[0] ?? (peregrine ? "peregrine" : "—");
    return { major, minor, peregrine, label, score, rulers, notes, system: "traditional" };
  }

  // Outer planets: modern rulership only (no traditional essential dignity exists).
  const ruled = (Object.keys(MODERN_RULER) as SignId[]).filter((s) => MODERN_RULER[s] === planet && TRADITIONAL_RULER[s] !== planet);
  if (ruled.includes(sign.id)) major.push("domicile");
  if (ruled.some((s) => opposite(s) === sign.id)) major.push("detriment");
  const ex = MODERN_EXALTATION_CONTESTED[planet];
  if (ex === sign.id) {
    major.push("exaltation");
    notes.push("modern exaltation (contested — sources disagree)");
  } else if (ex && opposite(ex) === sign.id) {
    major.push("fall");
    notes.push("modern fall (contested — sources disagree)");
  }
  notes.push("outer planet: modern rulership scheme");
  const label: DignityReport["label"] = major[0] ?? "peregrine";
  return { major, minor, peregrine: major.length === 0, label, score: null, rulers, notes, system: "modern" };
}
