/** Grounded facts about one transit event, for the interpreter. */
import { ASPECTS, POINTS, type AspectId, type PlanetId, type PointId } from "../astro/constants";
import type { NatalChart } from "../astro/chart";
import { houseOf } from "../astro/chart";
import { computeTransitEvents, eventStateAt, type TransitEvent } from "../astro/transits";
import { bodySampler } from "../astro/search";
import { jdFromDate, dateFromJd } from "../astro/time";
import { formatArc, formatLon } from "../astro/math";
import { housesRuledBy, pointLine } from "./context";
import { ordinal } from "../astro/patterns";

export interface TransitTarget {
  kind: "transit";
  transiting: PointId;
  aspect: AspectId;
  natal: PointId;
  /** any instant inside the period of interest (ISO) */
  date: string;
}

const name = (id: PointId) => POINTS[id].name;
const day = (jd: number) => dateFromJd(jd).toISOString().replace(/:\d\d\.\d+Z$/, "Z").replace("T", " ");

export function findTransitEvent(natal: NatalChart, t: TransitTarget): TransitEvent | null {
  const jd = jdFromDate(new Date(t.date));
  const events = computeTransitEvents(natal, { startJd: jd - 1, endJd: jd + 1, bodies: [t.transiting], natalPoints: [t.natal], aspects: [t.aspect] });
  return events.find((e) => (e.enters ?? -Infinity) <= jd + 1 && jd - 1 <= (e.leaves ?? Infinity)) ?? events[0] ?? null;
}

export function transitTitle(t: TransitTarget) {
  return `Transiting ${name(t.transiting)} ${ASPECTS[t.aspect].name.toLowerCase()} natal ${name(t.natal)}`;
}

export function transitFacts(natal: NatalChart, t: TransitTarget, now = new Date()): string {
  const e = findTransitEvent(natal, t);
  if (!e) return "This transit was not found in the calculated data.";
  const cusps = natal.houses?.cusps.map((c) => c.lon) ?? null;
  const sample = bodySampler(e.transiting);
  const where = (jd: number) => {
    const [lon, speed] = sample(jd);
    return `${formatLon(lon)}${speed < 0 ? " ℞" : ""}${cusps ? `, natal house ${houseOf(lon, cusps)}` : ""}`;
  };
  const L: string[] = [];
  L.push(`${transitTitle(t)} (orb setting ${formatArc(e.orb)}).`);
  if (e.heavyReason) L.push(`Classified as a heavy hitter: ${e.heavyReason}.`);
  L.push(`Within orb: ${e.enters ? `enters ${day(e.enters)} UT (transiting ${name(e.transiting)} at ${where(e.enters)})` : "already in orb before the searched span"} → ${e.leaves ? `leaves ${day(e.leaves)} UT (at ${where(e.leaves)})` : "still in orb after the searched span"}.`);
  if (e.hits.length) for (const h of e.hits) L.push(`Exact: ${day(h.jd)} UT at ${formatLon(h.lon, "name", true)}${h.retrograde ? " — retrograde pass" : ""}${cusps ? `, transiting through natal house ${houseOf(h.lon, cusps)}` : ""}.`);
  else L.push(`Does not perfect in this window; closest approach ${formatArc(e.minOrb)}.`);
  for (const m of e.nearMisses) L.push(`Near-miss: stations within ${formatArc(m.orb)} of exact on ${day(m.jd)} UT.`);
  const nowJd = jdFromDate(now);
  if ((e.enters ?? -Infinity) <= nowJd && nowJd <= (e.leaves ?? Infinity)) {
    const st = eventStateAt(e, nowJd);
    L.push(`Right now (${now.toISOString().slice(0, 16)}Z): orb ${formatArc(st.orb)}, ${st.applying ? "applying" : "separating"}${st.retrograde ? ", transiting planet retrograde" : ""}.`);
  } else {
    L.push(nowJd < (e.enters ?? 0) ? "This transit is in the future." : "This transit is in the past.");
  }
  if (natal.houses && (POINTS[e.transiting].kind === "planet" || POINTS[e.transiting].kind === "luminary")) {
    const r = housesRuledBy(natal, e.transiting as PlanetId);
    L.push(`In the natal chart, ${name(e.transiting)} rules house(s) ${[...r.traditional, ...r.modern.map((h) => `${h} (modern)`)].join(", ") || "none"}; natal ${name(e.transiting)} sits in the ${ordinal(natal.points[e.transiting]?.house ?? 0)} house.`);
  }
  const n = natal.points[e.natal];
  if (n) {
    L.push(`Natal point: ${pointLine(natal, n)}`);
    const asp = natal.aspects.filter((a) => a.a === e.natal || a.b === e.natal).slice(0, 8);
    if (asp.length) L.push(`Natal ${n.name}'s own aspects: ${asp.map((a) => `${a.type} ${name(a.a === e.natal ? a.b : a.a)} (${formatArc(a.orb)})`).join("; ")}`);
  }
  return L.join("\n");
}
