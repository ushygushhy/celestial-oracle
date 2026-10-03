import { computeChart, DEFAULT_CHART_SETTINGS, type ChartSettings, type NatalChart } from "../astro/chart";
import { HOUSE_SYSTEMS, type HouseSystem } from "../astro/ephemeris";
import { ASPECT_IDS, type AspectId } from "../astro/constants";
import { db } from "../db";
import { personToChartInput, type Person } from "../db/people";

/** Parse chart settings from URL search params (hs, node, pof, orbs). */
export function settingsFromParams(params: URLSearchParams | Record<string, string | string[] | undefined>, person?: Person): ChartSettings {
  const get = (k: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(k) ?? undefined;
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const hs = get("hs");
  const houseSystem: HouseSystem = hs && hs in HOUSE_SYSTEMS ? (hs as HouseSystem) : person?.houseSystem ?? "P";
  const orbs = { ...DEFAULT_CHART_SETTINGS.aspects.orbs };
  const orbParam = get("orbs");
  if (orbParam) {
    for (const part of orbParam.split(",")) {
      const [k, v] = part.split(":");
      if ((ASPECT_IDS as readonly string[]).includes(k) && Number.isFinite(Number(v))) orbs[k as AspectId] = Math.min(Math.max(Number(v), 0), 15);
    }
  }
  return {
    ...DEFAULT_CHART_SETTINGS,
    houseSystem,
    nodeType: get("node") === "mean" ? "mean" : "true",
    fortuneFormula: get("pof") === "day" ? "day" : "sect",
    aspectsToMinorPoints: get("minorpts") === "1",
    aspects: { ...DEFAULT_CHART_SETTINGS.aspects, orbs },
  };
}

export const settingsKey = (s: ChartSettings) =>
  [s.houseSystem, s.nodeType, s.fortuneFormula, s.aspectsToMinorPoints ? 1 : 0, ASPECT_IDS.map((a) => s.aspects.orbs[a]).join("/")].join("|");

/** Compute a person's natal chart and keep a snapshot (used as AI context and for export). */
export function chartForPerson(person: Person, settings?: ChartSettings): NatalChart {
  const s = settings ?? { ...DEFAULT_CHART_SETTINGS, houseSystem: person.houseSystem };
  const chart = computeChart(personToChartInput(person), s);
  db()
    .prepare("INSERT OR REPLACE INTO chart_snapshots (person_id, settings_key, json, computed_at) VALUES (?, ?, ?, datetime('now'))")
    .run(person.id, settingsKey(s), JSON.stringify(chart));
  return chart;
}
