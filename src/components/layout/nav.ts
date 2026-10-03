export interface NavItem {
  label: string;
  /** Path; ":person" is replaced with the active person id */
  href: string;
  needsPerson?: boolean;
  /** false = section not built yet (still clickable; shows what's coming) */
  ready: boolean;
}

export const NAV: NavItem[] = [
  { label: "Chart", href: "/chart/:person", needsPerson: true, ready: true },
  { label: "Sky Now", href: "/sky", ready: true },
  { label: "Transits", href: "/transits/:person", needsPerson: true, ready: true },
  { label: "Your Year", href: "/year/:person", needsPerson: true, ready: true },
  { label: "Numerology", href: "/numerology", ready: true },
  { label: "Tarot", href: "/tarot", ready: true },
  { label: "Upload", href: "/upload", ready: true },
  { label: "Synastry", href: "/synastry", ready: true },
  { label: "People", href: "/people", ready: true },
];
