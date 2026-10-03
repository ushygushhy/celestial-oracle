import { z } from "zod";

export const SIGN_NAMES = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"] as const;
export const EXTRACT_BODIES = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
  "chiron", "north_node", "south_node", "lilith", "part_of_fortune", "ascendant", "midheaven", "descendant", "ic", "vertex", "other",
] as const;

export const PlacementSchema = z.object({
  body: z.enum(EXTRACT_BODIES),
  label: z.string().describe("The point's name exactly as printed, e.g. 'True Node' or 'Mean Lilith'"),
  sign: z.enum(SIGN_NAMES),
  degree: z.number().int().describe("Whole degrees within the sign, 0-29"),
  minute: z.number().int().describe("Arcminutes, 0-59"),
  house: z.number().int().nullable().describe("House number 1-12 if shown, else null"),
  retrograde: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]).describe("How sure you are of this reading"),
});

export const CuspSchema = z.object({
  house: z.number().int(),
  sign: z.enum(SIGN_NAMES),
  degree: z.number().int(),
  minute: z.number().int(),
});

export const ExtractionSchema = z.object({
  source: z.string().describe("Software or site that produced the chart if recognisable (astro.com, Co-Star, TimePassages, Solar Fire…), else 'unknown'"),
  zodiac: z.enum(["tropical", "sidereal", "unknown"]),
  houseSystem: z.string().nullable(),
  birthData: z.object({
    name: z.string().nullable(),
    date: z.string().nullable().describe("YYYY-MM-DD"),
    time: z.string().nullable().describe("24-hour local clock time HH:mm"),
    place: z.string().nullable(),
    timezone: z.string().nullable().describe("Zone or abbreviation as printed"),
    utcOffset: z.string().nullable().describe("e.g. -08:00 if printed"),
    latitude: z.string().nullable(),
    longitude: z.string().nullable(),
  }),
  placements: z.array(PlacementSchema),
  cusps: z.array(CuspSchema),
  notes: z.string().describe("Anything ambiguous, unreadable or unusual about the image"),
});
export type Extraction = z.infer<typeof ExtractionSchema>;
export type ExtractedPlacement = z.infer<typeof PlacementSchema>;
