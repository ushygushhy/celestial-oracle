/**
 * Sky Now: live positions, Moon phase, void-of-course status, upcoming
 * ingresses, stations, lunations and eclipses.
 */
import { PLANET_IDS, SIGNS, POINTS, type PointId } from "../astro/constants";
import { computeChart, type ChartPoint, type NatalChart } from "../astro/chart";
import { pointsAt } from "../astro/positions";
import { jdFromDate, dateFromJd } from "../astro/time";
import { bodySampler, findIngresses, findStations } from "../astro/search";
import { lunations, voidOfCourse, eclipsesBetween, type Lunation, type VoidOfCourse, type Eclipse } from "../astro/transits";
import { moonPhase } from "../ai/tools";
import { formatLon } from "../astro/math";
import { db } from "../db";

export interface Observer {
  label: string;
  lat: number;
  lon: number;
}

export function getObserver(): Observer | null {
  const row = db().prepare("SELECT value FROM app_settings WHERE key = 'observer'").get() as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as Observer) : null;
}

export function setObserver(o: Observer | null) {
  if (!o) db().prepare("DELETE FROM app_settings WHERE key = 'observer'").run();
  else db().prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('observer', ?)").run(JSON.stringify(o));
}

const iso = (jd: number) => dateFromJd(jd).toISOString();

/** Search horizon (days) and step for each body's next sign change. */
const NEXT_INGRESS: Partial<Record<PointId, [number, number]>> = {
  moon: [3, 0.125], sun: [32, 0.5], mercury: [120, 0.5], venus: [250, 0.5], mars: [400, 1], jupiter: [800, 2],
  saturn: [1800, 3], chiron: [5000, 4], uranus: [5500, 5], neptune: [9000, 6], pluto: [12000, 8], trueNode: [600, 1], lilith: [300, 1],
};
const STATIONING: PointId[] = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron"];

export interface SkyPoint extends ChartPoint {
  nextIngress: { iso: string; sign: string; retrograde: boolean } | null;
}

export interface SkyEvent {
  iso: string;
  kind: "ingress" | "station" | "lunation" | "eclipse";
  body?: PointId;
  text: string;
}

export interface SkyData {
  generatedAt: string;
  points: SkyPoint[];
  chart: NatalChart;
  observer: Observer | null;
  moon: {
    phase: string;
    illumination: number;
    elongation: number;
    ageDays: number | null;
    upcoming: (Lunation & { iso: string })[];
  };
  voc: {
    active: boolean;
    current: (VoidOfCourse & { startIso: string | null; ingressIso: string }) | null;
    next: (VoidOfCourse & { startIso: string | null; ingressIso: string }) | null;
  };
  events: SkyEvent[];
  eclipses: (Eclipse & { iso: string })[];
}

/** A chart for "now": houses only when an observer location is set. */
export function skyChart(now: Date, observer: Observer | null): NatalChart {
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19);
  const chart = computeChart({ name: "The sky now", placeName: observer?.label ?? "", date, time, lat: observer?.lat ?? 0, lon: observer?.lon ?? 0, tz: "Etc/UTC", utcOffsetMinutes: 0 });
  if (!observer) {
    chart.houses = null;
    for (const id of ["asc", "mc", "dsc", "ic", "vertex", "fortune"] as PointId[]) delete chart.points[id];
    chart.aspects = chart.aspects.filter((a) => !["asc", "mc"].includes(a.a) && !["asc", "mc"].includes(a.b));
    chart.chartRuler = null;
    chart.sect = null;
  }
  return chart;
}

const vocWithIso = (v: VoidOfCourse) => ({ ...v, startIso: v.start ? iso(v.start) : null, ingressIso: iso(v.ingress) });

export function skyNow(now = new Date(), eventDays = 45): SkyData {
  const jd = jdFromDate(now);
  const observer = getObserver();
  const chart = skyChart(now, observer);
  const ids: PointId[] = [...PLANET_IDS, "chiron", "trueNode", "lilith"];
  const base = pointsAt(jd, { ids, cusps: chart.houses?.cusps.map((c) => c.lon) ?? null });

  const points: SkyPoint[] = base.map((p) => {
    const [days, step] = NEXT_INGRESS[p.id] ?? [365, 1];
    const next = findIngresses(bodySampler(p.id), jd, jd + days, step)[0];
    return { ...p, nextIngress: next ? { iso: iso(next.jd), sign: SIGNS[next.toSign].name, retrograde: next.retrograde } : null };
  });

  // Moon
  const sun = base.find((p) => p.id === "sun")!, moon = base.find((p) => p.id === "moon")!;
  const ph = moonPhase(sun.lon, moon.lon);
  const recent = lunations(jd - 31, jd).filter((l) => l.phase === "new").pop();
  const upcoming = lunations(jd, jd + 32).slice(0, 4).map((l) => ({ ...l, iso: iso(l.jd) }));

  // Void of course
  const vocs = voidOfCourse(jd - 2.5, jd + 5);
  const current = vocs.find((v) => v.start !== null && v.start <= jd && jd < v.ingress) ?? null;
  const next = vocs.find((v) => v.start !== null && v.start > jd) ?? null;

  // Upcoming events
  const end = jd + eventDays;
  const events: SkyEvent[] = [];
  for (const id of ["sun", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "trueNode"] as PointId[]) {
    const s = bodySampler(id);
    for (const g of findIngresses(s, jd, end, id === "sun" || id === "mercury" || id === "venus" ? 0.5 : 1)) {
      events.push({ iso: iso(g.jd), kind: "ingress", body: id, text: `${POINTS[id].name} enters ${SIGNS[g.toSign].name}${g.retrograde ? " (retrograde)" : ""}` });
    }
    if (STATIONING.includes(id)) {
      for (const st of findStations(s, jd, end, 0.5)) {
        events.push({ iso: iso(st.jd), kind: "station", body: id, text: `${POINTS[id].name} stations ${st.type === "retrograde" ? "retrograde" : "direct"} at ${formatLon(st.lon)}` });
      }
    }
  }
  for (const l of lunations(jd, end)) {
    if (l.phase === "new" || l.phase === "full") events.push({ iso: iso(l.jd), kind: "lunation", body: "moon", text: `${l.phase === "new" ? "New Moon" : "Full Moon"} at ${formatLon(l.lon)}` });
  }
  const eclipses = eclipsesBetween(jd, jd + 400).map((e) => ({ ...e, iso: iso(e.jd) }));
  for (const e of eclipses) if (e.jd <= end) events.push({ iso: e.iso, kind: "eclipse", text: `${e.type[0].toUpperCase() + e.type.slice(1)} ${e.kind} eclipse at ${formatLon(e.lon)}` });
  events.sort((a, b) => a.iso.localeCompare(b.iso));

  return {
    generatedAt: now.toISOString(),
    points,
    chart,
    observer,
    moon: { phase: ph.name, illumination: ph.illumination, elongation: ph.elongation, ageDays: recent ? jd - recent.jd : null, upcoming },
    voc: { active: !!current, current: current ? vocWithIso(current) : null, next: next ? vocWithIso(next) : null },
    events,
    eclipses,
  };
}
