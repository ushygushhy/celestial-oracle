/**
 * Personal transit report: current transits, a dated timeline, heavy hitters,
 * house ingresses and eclipses on natal points.
 */
import { ASPECT_IDS, type AspectId, type PointId } from "../astro/constants";
import type { NatalChart } from "../astro/chart";
import { jdFromDate, dateFromJd } from "../astro/time";
import {
  computeTransitEvents, defaultTransitOrb, eclipsesBetween, eventStateAt, houseTransits,
  TRANSITING_DEFAULT, TRANSITING_FAST, type TransitEvent, type Eclipse,
} from "../astro/transits";

export interface TransitReportOptions {
  months: number;
  /** include Sun, Mercury and Venus in the timeline */
  fast: boolean;
  /** include minor aspects */
  minor: boolean;
  /** orb multiplier: 0.5 tight, 1 standard, 1.5 wide */
  orbScale: number;
}

export const DEFAULT_REPORT_OPTIONS: TransitReportOptions = { months: 12, fast: false, minor: false, orbScale: 1 };

const iso = (jd: number | null) => (jd === null || !Number.isFinite(jd) ? null : dateFromJd(jd).toISOString());

export interface ReportEvent extends Omit<TransitEvent, "hits" | "nearMisses"> {
  entersIso: string | null;
  leavesIso: string | null;
  hits: { iso: string; lon: number; retrograde: boolean }[];
  nearMisses: { iso: string; orb: number }[];
  /** active at the report moment */
  current: boolean;
  now?: { orb: number; applying: boolean; retrograde: boolean; lon: number };
  fast: boolean;
}

export interface TransitReport {
  generatedAt: string;
  startIso: string;
  endIso: string;
  options: TransitReportOptions;
  events: ReportEvent[];
  current: ReportEvent[];
  houses: { body: PointId; house: number; next: { iso: string; house: number; retrograde: boolean } | null }[];
  eclipses: (Eclipse & { iso: string })[];
}

export function toReport(e: TransitEvent, nowJd: number, fast: boolean): ReportEvent {
  const current = (e.enters ?? -Infinity) <= nowJd && nowJd <= (e.leaves ?? Infinity);
  return {
    ...e,
    entersIso: iso(e.enters),
    leavesIso: iso(e.leaves),
    hits: e.hits.map((h) => ({ iso: iso(h.jd)!, lon: h.lon, retrograde: h.retrograde })),
    nearMisses: e.nearMisses.map((m) => ({ iso: iso(m.jd)!, orb: m.orb })),
    current,
    now: current ? eventStateAt(e, nowJd) : undefined,
    fast,
  };
}

export function transitReport(natal: NatalChart, now = new Date(), opts: TransitReportOptions = DEFAULT_REPORT_OPTIONS): TransitReport {
  const nowJd = jdFromDate(now);
  const endJd = nowJd + opts.months * 30.4375;
  const aspects: AspectId[] = opts.minor ? [...ASPECT_IDS] : ["conjunction", "opposition", "square", "trine", "sextile"];
  const orbFor = (b: PointId, a: AspectId) => defaultTransitOrb(b, a) * opts.orbScale;

  const slow = computeTransitEvents(natal, { startJd: nowJd, endJd, bodies: TRANSITING_DEFAULT, aspects, orbFor });
  // Fast planets: always computed for "current"; in the timeline only when requested.
  const fastEvents = computeTransitEvents(natal, { startJd: nowJd, endJd: opts.fast ? endJd : nowJd + 1, bodies: TRANSITING_FAST, aspects, orbFor });
  // The Moon: current contacts only.
  const moon = computeTransitEvents(natal, { startJd: nowJd - 0.5, endJd: nowJd + 0.5, bodies: ["moon"], aspects, orbFor: (_b, a) => (aspects.includes(a) && ["conjunction", "opposition", "square", "trine", "sextile"].includes(a) ? 3 : 1) * opts.orbScale });

  const events = [...slow.map((e) => toReport(e, nowJd, false)), ...fastEvents.map((e) => toReport(e, nowJd, true))]
    .filter((e) => opts.fast || !e.fast || e.current)
    .sort((a, b) => (a.entersIso ?? "").localeCompare(b.entersIso ?? ""));
  const current = [...events.filter((e) => e.current), ...moon.map((e) => toReport(e, nowJd, true)).filter((e) => e.current)]
    .sort((a, b) => (a.now?.orb ?? 9) - (b.now?.orb ?? 9));

  const houses = houseTransits(natal, ["sun", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "trueNode"], nowJd)
    .map((h) => ({ body: h.body, house: h.house, next: h.next ? { iso: iso(h.next.jd)!, house: h.next.house, retrograde: h.next.retrograde } : null }));

  const eclipses = eclipsesBetween(nowJd, endJd, natal, 3).map((e) => ({ ...e, iso: iso(e.jd)! }));

  return {
    generatedAt: now.toISOString(),
    startIso: iso(nowJd)!,
    endIso: iso(endJd)!,
    options: opts,
    events: events.filter((e) => !e.fast || opts.fast || e.current),
    current,
    houses,
    eclipses,
  };
}

export function reportOptionsFromParams(p: Record<string, string | string[] | undefined>): TransitReportOptions {
  const get = (k: string) => (Array.isArray(p[k]) ? p[k]![0] : (p[k] as string | undefined));
  const months = Math.min(Math.max(Number(get("months")) || 12, 1), 36);
  const orb = get("orb");
  return { months, fast: get("fast") === "1", minor: get("minor") === "1", orbScale: orb === "tight" ? 0.5 : orb === "wide" ? 1.5 : 1 };
}
