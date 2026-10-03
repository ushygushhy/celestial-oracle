/**
 * "Your Year": profections, the Lord of the Year, solar return,
 * secondary progressions and numerology cycles for one person.
 */
import { DateTime } from "luxon";
import { ASPECTS, SIGNS, TRADITIONAL_RULER, POINTS, type AspectId, type PlanetId, type PointId } from "../astro/constants";
import { computeChart, houseOf, type ChartPoint, type NatalChart } from "../astro/chart";
import { annualProfection } from "../astro/profections";
import { swe, C, lonSpeed, SWE_BODY } from "../astro/ephemeris";
import { jdFromDate, dateFromJd } from "../astro/time";
import { computeTransitEvents, sampleSeries, seriesPeriods, nextCuspCrossing } from "../astro/transits";
import { computeProgressions, progressedJd, TROPICAL_YEAR_DAYS } from "../astro/progressions";
import { findIngresses, exactPoints, type Sampler } from "../astro/search";
import { findCrossAspects, type Aspect } from "../astro/aspects";
import { toReport, type ReportEvent } from "./transit-service";
import { natalAspectTargets, SYNASTRY_ASPECT_SETTINGS } from "./overlay-service";
import { numerologyProfile, label as numLabel, type CoreNumber } from "../numerology/core";
import { PERSONAL_YEAR, meaningOf } from "../numerology/meanings";
import { getObserver } from "./sky-service";
import type { Person } from "../db/people";

const iso = (jd: number) => dateFromJd(jd).toISOString();
const MAJORS: AspectId[] = ["conjunction", "opposition", "square", "trine", "sextile"];

export interface MonthlyProfection { index: number; start: string; end: string; sign: string; signId: string; lord: PlanetId; current: boolean }
export interface CycleNumber { value: number; label: string; meaning: string; steps: string[] }
export interface YearLocation { label: string; lat: number; lon: number }

export interface YearReport {
  generatedAt: string;
  name: string;
  timeUnknown: boolean;
  profection: {
    age: number; house: number; sign: string; signId: string; lord: PlanetId; from: "ascendant" | "sun";
    yearStart: string; yearEnd: string; lordNatal: ChartPoint | null;
  } | null;
  months: MonthlyProfection[];
  lordTransits: ReportEvent[];
  toLord: ReportEvent[];
  numerology: { method: string; nameUsed: string; nameMissing: boolean; year: CycleNumber; month: CycleNumber; day: CycleNumber; lifePath: CycleNumber };
  solarReturn: {
    iso: string; location: YearLocation; chart: NatalChart;
    ascNatalHouse: number | null;
    placements: { id: PointId; srHouse: number | null; natalHouse: number | null }[];
    aspects: Aspect[];
  } | null;
  progressions: {
    ageYears: number;
    points: ChartPoint[];
    angles: ChartPoint[];
    moon: { lon: number; house: number | null; nextSign: { iso: string; sign: string } | null; nextHouse: { iso: string; house: number } | null };
    current: Aspect[];
    perfecting: { progressed: PointId; natal: PointId; aspect: AspectId; iso: string; retrograde: boolean }[];
  };
}

function cycle(n: CoreNumber, meanings: Record<number, string> | null): CycleNumber {
  const m = meanings ? (meanings[n.value] ?? meanings[((n.value - 1) % 9) + 1]) : meaningOf(n.value).core;
  return { value: n.value, label: numLabel(n), meaning: m, steps: n.steps };
}

/** Real-time sampler for a progressed body (degrees per real day). */
function progressedSampler(natalJd: number, body: PointId): Sampler {
  const b = SWE_BODY[body]!;
  return (t) => {
    const [l, s] = lonSpeed(progressedJd(natalJd, t), b);
    return [l, s / TROPICAL_YEAR_DAYS];
  };
}

export function yearReport(person: Person, natal: NatalChart, now = new Date(), location?: YearLocation | null, tz = "UTC"): YearReport {
  const nowJd = jdFromDate(now);
  const prof = annualProfection(natal, now);
  const cusps = natal.houses?.cusps.map((c) => c.lon) ?? null;

  // ---- profections -------------------------------------------------------
  let months: MonthlyProfection[] = [];
  let lordTransits: ReportEvent[] = [];
  let toLord: ReportEvent[] = [];
  if (prof) {
    const start = DateTime.fromISO(prof.yearStart, { zone: "UTC" });
    const baseIndex = SIGNS.findIndex((s) => s.id === prof.sign);
    months = Array.from({ length: 12 }, (_, k) => {
      const a = start.plus({ months: k }), b = start.plus({ months: k + 1 });
      const sign = SIGNS[(baseIndex + k) % 12];
      return {
        index: k + 1, start: a.toISODate()!, end: b.toISODate()!, sign: sign.name, signId: sign.id,
        lord: TRADITIONAL_RULER[sign.id], current: now >= a.toJSDate() && now < b.toJSDate(),
      };
    });
    const ys = jdFromDate(new Date(`${prof.yearStart}T00:00:00Z`)), ye = jdFromDate(new Date(`${prof.yearEnd}T00:00:00Z`));
    const lordAspects: AspectId[] = prof.lord === "moon" ? ["conjunction", "opposition"] : MAJORS;
    lordTransits = computeTransitEvents(natal, { startJd: ys, endJd: ye, bodies: [prof.lord], aspects: lordAspects })
      .map((e) => toReport(e, nowJd, false));
    toLord = computeTransitEvents(natal, { startJd: ys, endJd: ye, bodies: (["jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "trueNode"] as PointId[]).filter((b) => b !== prof.lord), natalPoints: [prof.lord], aspects: MAJORS })
      .map((e) => toReport(e, nowJd, false));
  }

  // ---- numerology ----------------------------------------------------------
  const local = DateTime.fromJSDate(now).setZone(tz);
  const nameUsed = person.fullBirthName || person.name;
  const n = numerologyProfile(nameUsed, person.birthDate, { y: local.year, m: local.month, d: local.day });
  const numerology = {
    method: "Calendar-year method: birth month + birth day + current year",
    nameUsed,
    nameMissing: !person.fullBirthName,
    year: cycle(n.cycles.year, PERSONAL_YEAR),
    month: cycle(n.cycles.month, PERSONAL_YEAR),
    day: cycle(n.cycles.day, PERSONAL_YEAR),
    lifePath: cycle(n.lifePath, null),
  };

  // ---- solar return ----------------------------------------------------------
  let solarReturn: YearReport["solarReturn"] = null;
  if (prof && natal.points.sun) {
    const loc = location ?? (getObserver() as YearLocation | null) ?? { label: `${natal.placeName} (birthplace)`, lat: natal.input.lat, lon: natal.input.lon };
    const startJd = jdFromDate(new Date(`${prof.yearStart}T00:00:00Z`)) - 3;
    const r = swe().solcross_ut(natal.points.sun.lon, startJd, C.SEFLG_SWIEPH);
    if (!r.error) {
      const when = dateFromJd(r.date).toISOString();
      const srChart = computeChart(
        { name: `Solar return ${when.slice(0, 4)}`, placeName: loc.label, date: when.slice(0, 10), time: when.slice(11, 23), lat: loc.lat, lon: loc.lon, tz: "Etc/UTC", utcOffsetMinutes: 0 },
        { ...natal.settings },
      );
      const placements = (Object.values(srChart.points).filter((p): p is ChartPoint => !!p && ![ "dsc", "ic", "meanNode", "meanSouthNode", "trueSouthNode", "vertex"].includes(p.id)))
        .map((p) => ({ id: p.id, srHouse: p.house, natalHouse: cusps ? houseOf(p.lon, cusps) : null }));
      const srBodies = natalAspectTargets(srChart).map((p) => ({ id: p.id, lon: p.lon, speed: 0, signIndex: p.signIndex }));
      const natalBodies = natalAspectTargets(natal).map((p) => ({ id: p.id, lon: p.lon, speed: 0, signIndex: p.signIndex }));
      const aspects = findCrossAspects(srBodies, natalBodies, { ...SYNASTRY_ASPECT_SETTINGS, enabled: MAJORS, orbs: { ...SYNASTRY_ASPECT_SETTINGS.orbs, conjunction: 3, opposition: 3, square: 2.5, trine: 2.5, sextile: 2 }, luminaryBonus: 0.5 });
      solarReturn = {
        iso: when,
        location: loc,
        chart: srChart,
        ascNatalHouse: srChart.points.asc && cusps ? houseOf(srChart.points.asc.lon, cusps) : null,
        placements,
        aspects,
      };
    }
  }

  // ---- progressions -----------------------------------------------------------
  const prog = computeProgressions(natal, now);
  const natalJd = natal.moment.jdUt;
  const pm = progressedSampler(natalJd, "moon");
  const nextSign = findIngresses(pm, nowJd, nowJd + 3 * 365.25, 3)[0];
  const nextHouse = cusps ? nextCuspCrossing(pm, cusps, nowJd, 4 * 365.25, 3) : null;
  const progMoon = prog.points.find((p) => p.id === "moon")!;
  const allProg = [...prog.points, ...prog.angles];
  const current = findCrossAspects(
    allProg.map((p) => ({ id: p.id, lon: p.lon, speed: p.speed, signIndex: p.signIndex })),
    natalAspectTargets(natal).map((p) => ({ id: p.id, lon: p.lon, speed: 0, signIndex: p.signIndex })),
    { enabled: MAJORS, orbs: { conjunction: 1, opposition: 1, square: 1, trine: 1, sextile: 1, quincunx: 0.5, semisextile: 0.5, semisquare: 0.5, sesquiquadrate: 0.5 }, luminaryBonus: 0, pointOrbFactor: 1 },
  );
  const perfecting: YearReport["progressions"]["perfecting"] = [];
  const winStart = prof ? jdFromDate(new Date(`${prof.yearStart}T00:00:00Z`)) : nowJd - 182;
  const winEnd = prof ? jdFromDate(new Date(`${prof.yearEnd}T00:00:00Z`)) : nowJd + 183;
  for (const body of ["sun", "moon", "mercury", "venus", "mars"] as PointId[]) {
    const series = sampleSeries(body, winStart, winEnd, 2, progressedSampler(natalJd, body));
    for (const target of natalAspectTargets(natal)) {
      for (const aspect of MAJORS) {
        for (const ep of exactPoints(target.lon, ASPECTS[aspect].angle)) {
          for (const period of seriesPeriods(series, ep.lon, 1)) {
            for (const h of period.hits) perfecting.push({ progressed: body, natal: target.id, aspect, iso: iso(h.jd), retrograde: h.retrograde });
          }
        }
      }
    }
  }
  perfecting.sort((a, b) => a.iso.localeCompare(b.iso));

  return {
    generatedAt: now.toISOString(),
    name: natal.name,
    timeUnknown: natal.moment.timeUnknown,
    profection: prof ? {
      age: prof.age, house: prof.house, sign: SIGNS.find((s) => s.id === prof.sign)!.name, signId: prof.sign, lord: prof.lord,
      from: prof.from, yearStart: prof.yearStart, yearEnd: prof.yearEnd, lordNatal: prof.lordNatal,
    } : null,
    months,
    lordTransits,
    toLord,
    numerology,
    solarReturn,
    progressions: {
      ageYears: prog.ageYears,
      points: prog.points,
      angles: prog.angles,
      moon: {
        lon: progMoon.lon,
        house: progMoon.house,
        nextSign: nextSign ? { iso: iso(nextSign.jd), sign: SIGNS[nextSign.toSign].name } : null,
        nextHouse: nextHouse ? { iso: iso(nextHouse.jd), house: nextHouse.house } : null,
      },
      current,
      perfecting,
    },
  };
}

/** Plain-text digest of the year for the AI synthesis. */
export function yearFacts(r: YearReport): string {
  const name = (id: PointId) => POINTS[id].name;
  const L: string[] = [`YOUR YEAR — ${r.name} (as of ${r.generatedAt.slice(0, 10)})`];
  if (r.profection) {
    const p = r.profection;
    L.push(`Annual profection: age ${p.age}, ${p.house}th-house year (counted from the ${p.from === "ascendant" ? "Ascendant, whole sign" : "Sun — birth time unknown"}), profected sign ${p.sign}, Lord of the Year ${name(p.lord)}${p.lordNatal ? ` (natally ${p.lordNatal.formattedPrecise}${p.lordNatal.house ? `, house ${p.lordNatal.house}` : ""}${p.lordNatal.retrograde ? ", retrograde" : ""}; dignity ${p.lordNatal.dignity?.label ?? "—"})` : ""}. Year runs ${p.yearStart} → ${p.yearEnd}.`);
    L.push(`Monthly profections: ${r.months.map((m) => `${m.start}: ${m.sign}/${name(m.lord)}${m.current ? " (CURRENT)" : ""}`).join("; ")}`);
    L.push(`Transits made by the Lord of the Year (${name(p.lord)}) this profection year: ${r.lordTransits.map((e) => `${e.aspect} natal ${name(e.natal)}${e.hits.length ? ` exact ${e.hits.map((h) => h.iso.slice(0, 10) + (h.retrograde ? "℞" : "")).join(", ")}` : " (no perfection)"}`).join("; ") || "none within orb"}`);
    L.push(`Slow-planet transits to the natal Lord of the Year: ${r.toLord.map((e) => `${name(e.transiting)} ${e.aspect} natal ${name(e.natal)}${e.hits.length ? ` exact ${e.hits.map((h) => h.iso.slice(0, 10)).join(", ")}` : ""}`).join("; ") || "none"}`);
  }
  const nu = r.numerology;
  L.push(`Numerology (${nu.method}; name used "${nu.nameUsed}"): Personal Year ${nu.year.label} — ${nu.year.meaning} Personal Month ${nu.month.label}. Personal Day ${nu.day.label}. Life Path ${nu.lifePath.label}.`);
  if (r.solarReturn) {
    const sr = r.solarReturn;
    const pts = sr.chart.points;
    L.push(`Solar return: ${sr.iso.replace("T", " ").slice(0, 16)} UT for ${sr.location.label}. SR Ascendant ${pts.asc?.formatted ?? "—"} (falls in natal house ${sr.ascNatalHouse ?? "—"}), SR MC ${pts.mc?.formatted ?? "—"}.`);
    L.push(`SR placements (SR house / natal house): ${sr.placements.filter((p) => !["asc", "mc", "fortune"].includes(p.id)).map((p) => `${name(p.id)} ${pts[p.id]?.formatted} (${p.srHouse ?? "—"}/${p.natalHouse ?? "—"})`).join("; ")}`);
    L.push(`SR-to-natal aspects: ${sr.aspects.slice(0, 15).map((a) => `SR ${name(a.a)} ${a.type} natal ${name(a.b)} (${a.orb.toFixed(1)}°)`).join("; ") || "none"}`);
  }
  const pr = r.progressions;
  L.push(`Secondary progressions (age ${pr.ageYears.toFixed(2)}): ${[...pr.points, ...pr.angles].filter((p) => ["sun", "moon", "mercury", "venus", "mars", "asc", "mc"].includes(p.id)).map((p) => `progressed ${p.name} ${p.formatted}${p.house ? ` (natal house ${p.house})` : ""}`).join("; ")}`);
  L.push(`Progressed Moon: next sign change ${pr.moon.nextSign ? `${pr.moon.nextSign.iso.slice(0, 10)} into ${pr.moon.nextSign.sign}` : "—"}; next natal house ${pr.moon.nextHouse ? `${pr.moon.nextHouse.iso.slice(0, 10)} into house ${pr.moon.nextHouse.house}` : "—"}.`);
  L.push(`Progressed aspects in orb now (1°): ${pr.current.map((a) => `progressed ${name(a.a)} ${a.type} natal ${name(a.b)} (${a.orb.toFixed(2)}°)`).join("; ") || "none"}`);
  L.push(`Progressed aspects perfecting this year: ${pr.perfecting.map((p) => `progressed ${name(p.progressed)} ${p.aspect} natal ${name(p.natal)} on ${p.iso.slice(0, 10)}`).join("; ") || "none"}`);
  return L.join("\n");
}
