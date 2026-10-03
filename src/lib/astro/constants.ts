/**
 * Static astrological reference data: signs, bodies, aspects, rulerships and
 * the traditional essential-dignity tables (Ptolemaic exaltations, Dorothean
 * triplicities, Egyptian terms, Chaldean faces).
 */

export const SIGN_IDS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const;
export type SignId = (typeof SIGN_IDS)[number];

export type Element = "fire" | "earth" | "air" | "water";
export type Modality = "cardinal" | "fixed" | "mutable";

export interface SignInfo {
  id: SignId;
  index: number;
  name: string;
  abbr: string;
  glyph: string;
  element: Element;
  modality: Modality;
  polarity: "yang" | "yin";
}

const ELEMENTS: Element[] = ["fire", "earth", "air", "water"];
const MODALITIES: Modality[] = ["cardinal", "fixed", "mutable"];
const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
const SIGN_ABBR = ["Ari", "Tau", "Gem", "Can", "Leo", "Vir", "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis"];

export const SIGNS: SignInfo[] = SIGN_IDS.map((id, index) => ({
  id,
  index,
  name: id.charAt(0).toUpperCase() + id.slice(1),
  abbr: SIGN_ABBR[index],
  glyph: SIGN_GLYPHS[index],
  element: ELEMENTS[index % 4],
  modality: MODALITIES[index % 3],
  polarity: index % 2 === 0 ? "yang" : "yin",
}));

export const signAt = (lon: number): SignInfo => SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)];

// ---------------------------------------------------------------------------
// Bodies & points
// ---------------------------------------------------------------------------

export const PLANET_IDS = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
] as const;
export type PlanetId = (typeof PLANET_IDS)[number];

export const TRADITIONAL_PLANETS: PlanetId[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];

export type PointId =
  | PlanetId
  | "chiron"
  | "trueNode" | "trueSouthNode"
  | "meanNode" | "meanSouthNode"
  | "lilith"
  | "fortune"
  | "asc" | "mc" | "ic" | "dsc" | "vertex";

export type PointKind = "luminary" | "planet" | "asteroid" | "node" | "point" | "angle";

export interface PointInfo {
  id: PointId;
  name: string;
  short: string;
  glyph: string;
  kind: PointKind;
  /** Mean daily motion in degrees (used for "stationary" detection). */
  meanSpeed?: number;
}

export const POINTS: Record<PointId, PointInfo> = {
  sun: { id: "sun", name: "Sun", short: "Sun", glyph: "☉", kind: "luminary", meanSpeed: 0.9856 },
  moon: { id: "moon", name: "Moon", short: "Moon", glyph: "☽", kind: "luminary", meanSpeed: 13.176 },
  mercury: { id: "mercury", name: "Mercury", short: "Mer", glyph: "☿", kind: "planet", meanSpeed: 1.383 },
  venus: { id: "venus", name: "Venus", short: "Ven", glyph: "♀", kind: "planet", meanSpeed: 1.2 },
  mars: { id: "mars", name: "Mars", short: "Mar", glyph: "♂", kind: "planet", meanSpeed: 0.524 },
  jupiter: { id: "jupiter", name: "Jupiter", short: "Jup", glyph: "♃", kind: "planet", meanSpeed: 0.083 },
  saturn: { id: "saturn", name: "Saturn", short: "Sat", glyph: "♄", kind: "planet", meanSpeed: 0.0335 },
  uranus: { id: "uranus", name: "Uranus", short: "Ura", glyph: "♅", kind: "planet", meanSpeed: 0.0117 },
  neptune: { id: "neptune", name: "Neptune", short: "Nep", glyph: "♆", kind: "planet", meanSpeed: 0.006 },
  pluto: { id: "pluto", name: "Pluto", short: "Plu", glyph: "♇", kind: "planet", meanSpeed: 0.004 },
  chiron: { id: "chiron", name: "Chiron", short: "Chi", glyph: "⚷", kind: "asteroid", meanSpeed: 0.0195 },
  trueNode: { id: "trueNode", name: "North Node (true)", short: "NN", glyph: "☊", kind: "node" },
  trueSouthNode: { id: "trueSouthNode", name: "South Node (true)", short: "SN", glyph: "☋", kind: "node" },
  meanNode: { id: "meanNode", name: "North Node (mean)", short: "mNN", glyph: "☊", kind: "node" },
  meanSouthNode: { id: "meanSouthNode", name: "South Node (mean)", short: "mSN", glyph: "☋", kind: "node" },
  lilith: { id: "lilith", name: "Black Moon Lilith", short: "Lil", glyph: "⚸", kind: "point" },
  fortune: { id: "fortune", name: "Part of Fortune", short: "PoF", glyph: "⊗", kind: "point" },
  asc: { id: "asc", name: "Ascendant", short: "ASC", glyph: "AC", kind: "angle" },
  mc: { id: "mc", name: "Midheaven", short: "MC", glyph: "MC", kind: "angle" },
  ic: { id: "ic", name: "Imum Coeli", short: "IC", glyph: "IC", kind: "angle" },
  dsc: { id: "dsc", name: "Descendant", short: "DSC", glyph: "DC", kind: "angle" },
  vertex: { id: "vertex", name: "Vertex", short: "Vx", glyph: "Vx", kind: "point" },
};

/** Order used for tables and the wheel. */
export const POINT_ORDER: PointId[] = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
  "chiron", "trueNode", "trueSouthNode", "meanNode", "meanSouthNode", "lilith", "fortune",
  "asc", "mc", "dsc", "ic", "vertex",
];

// ---------------------------------------------------------------------------
// Aspects
// ---------------------------------------------------------------------------

export const ASPECT_IDS = [
  "conjunction", "opposition", "trine", "square", "sextile",
  "quincunx", "semisextile", "semisquare", "sesquiquadrate",
] as const;
export type AspectId = (typeof ASPECT_IDS)[number];

export interface AspectInfo {
  id: AspectId;
  name: string;
  angle: number;
  glyph: string;
  major: boolean;
  defaultOrb: number;
  nature: "fusion" | "flow" | "tension" | "adjustment" | "friction" | "subtle";
  /** Whole-sign distance(s) this aspect normally spans; null = not sign-based. */
  signDistance: number[] | null;
}

export const ASPECTS: Record<AspectId, AspectInfo> = {
  conjunction: { id: "conjunction", name: "Conjunction", angle: 0, glyph: "☌", major: true, defaultOrb: 8, nature: "fusion", signDistance: [0] },
  opposition: { id: "opposition", name: "Opposition", angle: 180, glyph: "☍", major: true, defaultOrb: 8, nature: "tension", signDistance: [6] },
  trine: { id: "trine", name: "Trine", angle: 120, glyph: "△", major: true, defaultOrb: 7, nature: "flow", signDistance: [4, 8] },
  square: { id: "square", name: "Square", angle: 90, glyph: "□", major: true, defaultOrb: 7, nature: "tension", signDistance: [3, 9] },
  sextile: { id: "sextile", name: "Sextile", angle: 60, glyph: "⚹", major: true, defaultOrb: 5, nature: "flow", signDistance: [2, 10] },
  quincunx: { id: "quincunx", name: "Quincunx", angle: 150, glyph: "⚻", major: false, defaultOrb: 3, nature: "adjustment", signDistance: [5, 7] },
  semisextile: { id: "semisextile", name: "Semi-sextile", angle: 30, glyph: "⚺", major: false, defaultOrb: 2, nature: "subtle", signDistance: [1, 11] },
  semisquare: { id: "semisquare", name: "Semi-square", angle: 45, glyph: "∠", major: false, defaultOrb: 2, nature: "friction", signDistance: null },
  sesquiquadrate: { id: "sesquiquadrate", name: "Sesquiquadrate", angle: 135, glyph: "⚼", major: false, defaultOrb: 2, nature: "friction", signDistance: null },
};

// ---------------------------------------------------------------------------
// Rulerships & essential dignities
// ---------------------------------------------------------------------------

export const TRADITIONAL_RULER: Record<SignId, PlanetId> = {
  aries: "mars", taurus: "venus", gemini: "mercury", cancer: "moon", leo: "sun", virgo: "mercury",
  libra: "venus", scorpio: "mars", sagittarius: "jupiter", capricorn: "saturn", aquarius: "saturn", pisces: "jupiter",
};

export const MODERN_RULER: Record<SignId, PlanetId> = {
  ...TRADITIONAL_RULER,
  scorpio: "pluto",
  aquarius: "uranus",
  pisces: "neptune",
};

/** Ptolemaic exaltations with their traditional exaltation degree. */
export const EXALTATION: Partial<Record<PlanetId, { sign: SignId; degree: number }>> = {
  sun: { sign: "aries", degree: 19 },
  moon: { sign: "taurus", degree: 3 },
  mercury: { sign: "virgo", degree: 15 },
  venus: { sign: "pisces", degree: 27 },
  mars: { sign: "capricorn", degree: 28 },
  jupiter: { sign: "cancer", degree: 15 },
  saturn: { sign: "libra", degree: 21 },
};

/**
 * Modern exaltations for the outer planets. These are NOT traditional and
 * sources disagree; they are shown separately and flagged as contested.
 */
export const MODERN_EXALTATION_CONTESTED: Partial<Record<PlanetId, SignId>> = {
  uranus: "scorpio",
  neptune: "cancer",
  pluto: "leo",
};

/** Dorothean triplicity rulers: [day, night, participating]. */
export const TRIPLICITY: Record<Element, [PlanetId, PlanetId, PlanetId]> = {
  fire: ["sun", "jupiter", "saturn"],
  earth: ["venus", "moon", "mars"],
  air: ["saturn", "mercury", "jupiter"],
  water: ["venus", "mars", "moon"],
};

/** Egyptian terms (bounds): [ruler, end degree exclusive] per sign. */
export const EGYPTIAN_TERMS: Record<SignId, [PlanetId, number][]> = {
  aries: [["jupiter", 6], ["venus", 12], ["mercury", 20], ["mars", 25], ["saturn", 30]],
  taurus: [["venus", 8], ["mercury", 14], ["jupiter", 22], ["saturn", 27], ["mars", 30]],
  gemini: [["mercury", 6], ["jupiter", 12], ["venus", 17], ["mars", 24], ["saturn", 30]],
  cancer: [["mars", 7], ["venus", 13], ["mercury", 19], ["jupiter", 26], ["saturn", 30]],
  leo: [["jupiter", 6], ["venus", 11], ["saturn", 18], ["mercury", 24], ["mars", 30]],
  virgo: [["mercury", 7], ["venus", 17], ["jupiter", 21], ["mars", 28], ["saturn", 30]],
  libra: [["saturn", 6], ["mercury", 14], ["jupiter", 21], ["venus", 28], ["mars", 30]],
  scorpio: [["mars", 7], ["venus", 11], ["mercury", 19], ["jupiter", 24], ["saturn", 30]],
  sagittarius: [["jupiter", 12], ["venus", 17], ["mercury", 21], ["saturn", 26], ["mars", 30]],
  capricorn: [["mercury", 7], ["jupiter", 14], ["venus", 22], ["saturn", 26], ["mars", 30]],
  aquarius: [["mercury", 7], ["venus", 13], ["jupiter", 20], ["mars", 25], ["saturn", 30]],
  pisces: [["venus", 12], ["jupiter", 16], ["mercury", 19], ["mars", 28], ["saturn", 30]],
};

/** Chaldean order used for faces (decans), starting from Mars at 0° Aries. */
const CHALDEAN_FACE_SEQUENCE: PlanetId[] = ["mars", "sun", "venus", "mercury", "moon", "saturn", "jupiter"];
export const chaldeanFaceRuler = (lon: number): PlanetId => {
  const decanIndex = Math.floor((((lon % 360) + 360) % 360) / 10); // 0..35
  return CHALDEAN_FACE_SEQUENCE[decanIndex % 7];
};
