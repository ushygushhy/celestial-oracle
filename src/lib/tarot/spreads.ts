/** Spread definitions. Coordinates are in card units (1 = card width, card height = 1.6). */
export interface SpreadPosition {
  label: string;
  meaning: string;
  x: number;
  y: number;
  rotate?: number;
}
export interface Spread {
  id: string;
  name: string;
  description: string;
  positions: SpreadPosition[];
  custom?: boolean;
}

const HOUSE_MEANINGS = [
  "Self, body, how you meet the world", "Money, resources, values", "Communication, siblings, short journeys",
  "Home, family, roots", "Creativity, romance, children, pleasure", "Work, health, daily routines",
  "Partnerships, open enemies, contracts", "Shared resources, intimacy, transformation", "Beliefs, travel, higher learning",
  "Career, reputation, vocation", "Friends, groups, hopes", "The hidden, retreat, the unconscious",
];

function horoscopePositions(): SpreadPosition[] {
  const R = 3.1, cx = 3.6, cy = 3.6;
  return HOUSE_MEANINGS.map((meaning, i) => {
    const a = ((i * 30 + 15) * Math.PI) / 180;
    return { label: `House ${i + 1}`, meaning, x: Math.round((cx - R * Math.cos(a)) * 100) / 100, y: Math.round((cy + R * Math.sin(a)) * 0.62 * 100) / 100 + 0.4 };
  });
}

export const SPREADS: Spread[] = [
  { id: "single", name: "Single card", description: "One card for the day or a focused question.", positions: [{ label: "The card", meaning: "The heart of the matter", x: 0, y: 0 }] },
  {
    id: "three", name: "Past · Present · Future", description: "The arc of a situation through time.",
    positions: [
      { label: "Past", meaning: "What led here", x: 0, y: 0 },
      { label: "Present", meaning: "Where things stand", x: 1.25, y: 0 },
      { label: "Future", meaning: "Where it is heading", x: 2.5, y: 0 },
    ],
  },
  {
    id: "celtic", name: "Celtic Cross", description: "The classic ten-card reading of a situation in depth.",
    positions: [
      { label: "1 · Present", meaning: "The situation now", x: 1.25, y: 1.7 },
      { label: "2 · Challenge", meaning: "What crosses you", x: 1.25, y: 1.7, rotate: 90 },
      { label: "3 · Foundation", meaning: "The root beneath it", x: 1.25, y: 3.5 },
      { label: "4 · Recent past", meaning: "What is passing", x: 0, y: 1.7 },
      { label: "5 · Crown", meaning: "Conscious aim, best potential", x: 1.25, y: -0.1 },
      { label: "6 · Near future", meaning: "What approaches", x: 2.5, y: 1.7 },
      { label: "7 · Self", meaning: "Your attitude", x: 4.0, y: 4.5 },
      { label: "8 · Environment", meaning: "Others and surroundings", x: 4.0, y: 2.8 },
      { label: "9 · Hopes and fears", meaning: "What you hope or dread", x: 4.0, y: 1.1 },
      { label: "10 · Outcome", meaning: "Where it resolves", x: 4.0, y: -0.6 },
    ],
  },
  { id: "horoscope", name: "Horoscope (12 houses)", description: "One card for each astrological house — a whole-life survey.", positions: horoscopePositions() },
];

export const getSpread = (id: string, custom: Spread[] = []) => [...SPREADS, ...custom].find((s) => s.id === id) ?? SPREADS[0];

/** A simple row layout for custom spreads. */
export function customSpread(id: string, name: string, labels: { label: string; meaning: string }[]): Spread {
  const perRow = labels.length <= 5 ? labels.length : Math.ceil(labels.length / 2);
  return {
    id, name, custom: true, description: `Custom spread · ${labels.length} cards`,
    positions: labels.map((l, i) => ({ ...l, x: (i % perRow) * 1.25, y: Math.floor(i / perRow) * 1.9 })),
  };
}
