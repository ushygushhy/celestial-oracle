/**
 * JS-side handles to the design tokens defined in src/styles/tokens.css.
 * Components (especially the SVG chart wheel) reference CSS variables through
 * these constants so that the CSS file stays the single source of truth and
 * theme switches (midnight ↔ almanac) apply everywhere automatically.
 */

export const cssVar = (name: string) => `var(--${name})`;

export const color = {
  bg: cssVar("bg"),
  surface: cssVar("surface"),
  surfaceStrong: cssVar("surface-strong"),
  rule: cssVar("rule"),
  ruleStrong: cssVar("rule-strong"),
  text: cssVar("text"),
  muted: cssVar("text-muted"),
  faint: cssVar("text-faint"),
  accent: cssVar("accent"),
  accentBright: cssVar("accent-bright"),
  danger: cssVar("danger"),
} as const;

export const elementColor = {
  fire: cssVar("element-fire"),
  earth: cssVar("element-earth"),
  air: cssVar("element-air"),
  water: cssVar("element-water"),
} as const;

export const elementFill = {
  fire: cssVar("element-fire-fill"),
  earth: cssVar("element-earth-fill"),
  air: cssVar("element-air-fill"),
  water: cssVar("element-water-fill"),
} as const;

export const aspectColor: Record<string, string> = {
  conjunction: cssVar("aspect-conjunction"),
  opposition: cssVar("aspect-opposition"),
  square: cssVar("aspect-square"),
  trine: cssVar("aspect-trine"),
  sextile: cssVar("aspect-sextile"),
  quincunx: cssVar("aspect-quincunx"),
  semisextile: cssVar("aspect-semisextile"),
  semisquare: cssVar("aspect-semisquare"),
  sesquiquadrate: cssVar("aspect-sesquiquadrate"),
};

export const wheel = {
  bg: cssVar("wheel-bg"),
  band: cssVar("wheel-zodiac-band"),
  line: cssVar("wheel-line"),
  lineFaint: cssVar("wheel-line-faint"),
  glyph: cssVar("wheel-glyph"),
  angle: cssVar("wheel-angle"),
  center: cssVar("wheel-center"),
} as const;

export const font = {
  display: "var(--font-display)",
  masthead: "var(--font-masthead)",
  headline: "var(--font-headline)",
  serif: "var(--font-serif)",
  glyph: "var(--font-glyph)",
} as const;

/** Text-presentation selector: stops zodiac glyphs (♈–♓) rendering as emoji. */
export const TEXT_VS = "︎";
