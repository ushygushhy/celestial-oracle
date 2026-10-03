/**
 * Planet positions at an arbitrary moment, placed into a natal chart's houses.
 * Used for transit overlays and the Sky Now dashboard.
 */
import { PLANET_IDS, type PointId } from "./constants";
import { calcBody, obliquity, SWE_BODY } from "./ephemeris";
import { buildPoint, stationState, type ChartPoint } from "./chart";
import { norm360 } from "./math";

export const MOVING_POINTS: PointId[] = [...PLANET_IDS, "chiron", "trueNode", "trueSouthNode", "lilith"];

export function pointsAt(jdUt: number, opts: { cusps?: number[] | null; ids?: PointId[]; stations?: boolean } = {}): ChartPoint[] {
  const ids = opts.ids ?? MOVING_POINTS;
  const eps = obliquity(jdUt);
  const out: ChartPoint[] = [];
  for (const id of ids) {
    let raw: { lon: number; lat: number; speed: number; decl: number | null };
    if (id === "trueSouthNode" || id === "meanSouthNode") {
      const n = calcBody(jdUt, SWE_BODY[id === "trueSouthNode" ? "trueNode" : "meanNode"]!);
      raw = { lon: norm360(n.lon + 180), lat: -n.lat, speed: n.speed, decl: Number.isFinite(n.decl) ? -n.decl : null };
    } else {
      const body = SWE_BODY[id];
      if (body === undefined) continue;
      try {
        const p = calcBody(jdUt, body);
        raw = { lon: p.lon, lat: p.lat, speed: p.speed, decl: Number.isFinite(p.decl) ? p.decl : null };
      } catch {
        continue; // e.g. Chiron outside its ephemeris range
      }
    }
    out.push(buildPoint(id, raw, {
      cusps: opts.cusps ?? null,
      sect: null,
      eps,
      station: opts.stations === false ? null : stationState(jdUt, id),
    }));
  }
  return out;
}
