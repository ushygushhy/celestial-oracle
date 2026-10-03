/**
 * Reference charts for engine validation.
 *
 * Birth data and the rounded Sun/Moon/Ascendant come from Astro-Databank
 * (astro.com/astro-databank), Rodden-rated A/AA records.
 * Full positions are astro.com's own Swiss Ephemeris output, retrieved from
 * astro.com/cgi/swetest.cgi (swetest 2.10.03, -eswe) for the UT moment that
 * Astro-Databank's timezone implies. Retrieved 2026-10-02.
 *
 * The test feeds ONLY the local birth data (date, clock time, coordinates)
 * through the full pipeline — timezone lookup → historical offset → UT →
 * Swiss Ephemeris — and compares against these values.
 */
import type { HouseSystem } from "@/lib/astro/ephemeris";

export interface ReferenceChart {
  id: string;
  label: string;
  rating: string;
  /** local civil birth data as published by Astro-Databank */
  local: { date: string; time: string; lat: number; lon: number; place: string };
  /** what the timezone pipeline must produce */
  expect: { utcIso: string; tz: string; abbreviation: string; offsetSource: "iana" | "lmt"; offsetMinutes: number };
  /** Astro-Databank display strings (rounded to the arcminute) */
  databank: { sun: string; moon: string; asc: string };
  /** astro.com swetest longitudes, decimal degrees */
  positions: Record<string, number>;
  /** speeds (deg/day) for retrograde checks */
  speeds?: Record<string, number>;
  /** Placidus unless noted, houses 1–12 */
  cusps: Partial<Record<HouseSystem, number[]>>;
  asc: number;
  mc: number;
  vertex: number;
}

export const REFERENCE_CHARTS: ReferenceChart[] = [
  {
    id: "jobs",
    label: "Steve Jobs",
    rating: "AA",
    local: { date: "1955-02-24", time: "19:15", lat: 37 + 47 / 60, lon: -(122 + 25 / 60), place: "San Francisco, California" },
    expect: { utcIso: "1955-02-25T03:15:00.000Z", tz: "America/Los_Angeles", abbreviation: "PST", offsetSource: "iana", offsetMinutes: -480 },
    databank: { sun: "5°45' Pisces", moon: "7°45' Aries", asc: "22°18' Virgo" },
    positions: {
      sun: 335.7481350, moon: 7.7473299, mercury: 314.3617288, venus: 291.1718706, mars: 29.0904871,
      jupiter: 110.5079593, saturn: 231.1626814, uranus: 114.1349630, neptune: 208.0512854, pluto: 145.3226968,
      meanNode: 272.5049475, trueNode: 273.4100230, lilith: 238.5218775, chiron: 302.3322355,
    },
    speeds: { mercury: -0.0329714, jupiter: -0.0630701, saturn: 0.0070609, uranus: -0.0292317, neptune: -0.0140757, pluto: -0.024357 },
    cusps: {
      P: [172.2940681, 198.2442502, 228.3543791, 261.3176331, 294.4780718, 325.2132564, 352.2940681, 18.2442502, 48.3543791, 81.3176331, 114.4780718, 145.2132564],
      K: [172.2940681, 201.9654834, 231.2373624, 261.3176331, 293.4719311, 322.8184072, 352.2940681, 21.9654834, 51.2373624, 81.3176331, 113.4719311, 142.8184072],
      O: [172.2940681, 201.9685897, 231.6431114, 261.3176331, 291.6431114, 321.9685897, 352.2940681, 21.9685897, 51.6431114, 81.3176331, 111.6431114, 141.9685897],
      E: [172.2940681, 202.2940681, 232.2940681, 262.2940681, 292.2940681, 322.2940681, 352.2940681, 22.2940681, 52.2940681, 82.2940681, 112.2940681, 142.2940681],
      W: [150, 180, 210, 240, 270, 300, 330, 0, 30, 60, 90, 120],
    },
    asc: 172.2940681, mc: 81.3176331, vertex: 337.2602141,
  },
  {
    id: "obama",
    label: "Barack Obama",
    rating: "AA",
    local: { date: "1961-08-04", time: "19:24", lat: 21 + 18 / 60, lon: -(157 + 52 / 60), place: "Honolulu, Hawaii" },
    expect: { utcIso: "1961-08-05T05:24:00.000Z", tz: "Pacific/Honolulu", abbreviation: "HST", offsetSource: "iana", offsetMinutes: -600 },
    databank: { sun: "12°33' Leo", moon: "3°21' Gemini", asc: "18°03' Aquarius" },
    positions: {
      sun: 132.5479239, moon: 63.3574372, mercury: 122.3316109, venus: 91.7893609, mars: 172.5766034,
      jupiter: 300.8586276, saturn: 295.3307492, uranus: 145.2708344, neptune: 218.6059504, pluto: 156.977759,
      meanNode: 147.8925576, trueNode: 147.3050181, lilith: 140.5795345, chiron: 335.3170018,
    },
    speeds: { mercury: 2.0047288, jupiter: -0.1243673, saturn: -0.0687929, chiron: -0.0438404 },
    cusps: {
      P: [318.0446579, 355.8981435, 30.2891348, 58.8854147, 83.9743133, 109.0165889, 138.0446579, 175.8981435, 210.2891348, 238.8854147, 263.9743133, 289.0165889],
    },
    asc: 318.0446579, mc: 238.8854147, vertex: 162.9025916,
  },
  {
    id: "diana",
    label: "Diana, Princess of Wales",
    rating: "A",
    local: { date: "1961-07-01", time: "19:45", lat: 52 + 50 / 60, lon: 0.5, place: "Sandringham, England" },
    expect: { utcIso: "1961-07-01T18:45:00.000Z", tz: "Europe/London", abbreviation: "BST", offsetSource: "iana", offsetMinutes: 60 },
    databank: { sun: "9°40' Cancer", moon: "25°02' Aquarius", asc: "18°25' Sagittarius" },
    positions: {
      sun: 99.6630612, moon: 325.0379428, mercury: 93.2014016, venus: 54.3998455, mars: 151.645717,
      jupiter: 305.0970843, saturn: 297.8140077, uranus: 143.3360291, neptune: 218.6366787, pluto: 156.0440374,
      meanNode: 149.7164928, trueNode: 148.1749094, lilith: 136.7637421, chiron: 336.4679531,
    },
    speeds: { mercury: -0.4817271, jupiter: -0.1041118, saturn: -0.0680734 },
    cusps: {
      P: [258.4084982, 299.8049199, 348.3559397, 23.0520989, 46.0526597, 63.2926111, 78.4084982, 119.8049199, 168.3559397, 203.0520989, 226.0526597, 243.2926111],
    },
    asc: 258.4084982, mc: 203.0520989, vertex: 124.2927826,
  },
  {
    id: "einstein",
    label: "Albert Einstein (Local Mean Time)",
    rating: "AA",
    local: { date: "1879-03-14", time: "11:30", lat: 48 + 24 / 60, lon: 10, place: "Ulm, Germany" },
    expect: { utcIso: "1879-03-14T10:50:00.000Z", tz: "Europe/Berlin", abbreviation: "LMT", offsetSource: "lmt", offsetMinutes: 40 },
    databank: { sun: "23°30' Pisces", moon: "14°32' Sagittarius", asc: "11°39' Cancer" },
    positions: {
      sun: 353.5077476, moon: 254.5259113, mercury: 3.143885, venus: 16.98501, mars: 296.9142225,
      jupiter: 327.4841003, saturn: 4.1898287, uranus: 151.2885997, neptune: 37.8719645, pluto: 54.7255638,
      meanNode: 301.4803639, trueNode: 302.7312757, lilith: 27.9767223, chiron: 35.5446925,
    },
    cusps: {
      P: [101.6464049, 118.6172424, 137.8079834, 162.8398652, 198.3329538, 243.109471, 281.6464049, 298.6172424, 317.8079834, 342.8398652, 18.3329538, 63.109471],
    },
    asc: 101.6464049, mc: 342.8398652, vertex: 237.9050493,
  },
  {
    id: "hendrix",
    label: "Jimi Hendrix (US War Time)",
    rating: "AA",
    local: { date: "1942-11-27", time: "10:15", lat: 47.6, lon: -(122 + 20 / 60), place: "Seattle, Washington" },
    expect: { utcIso: "1942-11-27T17:15:00.000Z", tz: "America/Los_Angeles", abbreviation: "PWT", offsetSource: "iana", offsetMinutes: -420 },
    databank: { sun: "4°50' Sagittarius", moon: "28°05' Cancer", asc: "24°41' Sagittarius" },
    positions: {
      sun: 244.8350118, moon: 118.0796419, mercury: 242.948655, venus: 247.5992432, mars: 227.5246553,
      jupiter: 114.8599453, saturn: 69.3732193, uranus: 62.4723765, neptune: 181.6738376, pluto: 127.1768104,
      meanNode: 149.3287059, trueNode: 148.7331978, lilith: 100.2769928, chiron: 149.1409612,
    },
    cusps: {
      P: [264.6799444, 305.3224934, 350.1796784, 24.1927551, 48.230339, 67.1706375, 84.6799444, 125.3224934, 170.1796784, 204.1927551, 228.230339, 247.1706375],
    },
    asc: 264.6799444, mc: 204.1927551, vertex: 127.6356693,
  },
];
