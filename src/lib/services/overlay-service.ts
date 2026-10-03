/**
 * Outer-ring data for the chart wheel: transits, secondary progressions, or a
 * partner's natal chart (synastry), with the cross-aspects to the natal chart.
 * All positions come from the engine; nothing is computed in the browser.
 */
import type { NatalChart, ChartPoint } from "../astro/chart";
import { findCrossAspects, DEFAULT_TRANSIT_ORBS, type Aspect, type AspectBody, type AspectSettings } from "../astro/aspects";
import { ASPECT_IDS, PLANET_IDS, type AspectId, type PointId } from "../astro/constants";
import { pointsAt } from "../astro/positions";
import { computeProgressions } from "../astro/progressions";
import { jdFromDate } from "../astro/time";
import { buildPoint } from "../astro/chart";

export type OverlayKind = "transits" | "progressions" | "synastry";

export interface Overlay {
  kind: OverlayKind;
  label: string;
  sublabel: string;
  points: ChartPoint[];
  /** from = overlay point (a), to = natal point (b) */
  aspects: Aspect[];
}

const toBodies = (pts: ChartPoint[]): AspectBody[] =>
  pts.map((p) => ({ id: p.id, lon: p.lon, speed: p.speed, signIndex: p.signIndex }));

export function natalAspectTargets(natal: NatalChart): ChartPoint[] {
  const node: PointId = natal.settings.nodeType === "true" ? "trueNode" : "meanNode";
  const ids: PointId[] = [...PLANET_IDS, "chiron", node, "lilith", "asc", "mc"];
  return ids.map((id) => natal.points[id]).filter((p): p is ChartPoint => !!p);
}

const uniformOrbs = (major: number, minor: number) =>
  Object.fromEntries(ASPECT_IDS.map((a) => [a, ["conjunction", "opposition", "square", "trine", "sextile"].includes(a) ? major : minor])) as Record<AspectId, number>;

export const TRANSIT_ASPECT_SETTINGS: AspectSettings = { enabled: [...ASPECT_IDS], orbs: DEFAULT_TRANSIT_ORBS, luminaryBonus: 0, pointOrbFactor: 1 };
export const PROGRESSION_ASPECT_SETTINGS: AspectSettings = { enabled: [...ASPECT_IDS], orbs: uniformOrbs(1, 0.5), luminaryBonus: 0, pointOrbFactor: 1 };
export const SYNASTRY_ASPECT_SETTINGS: AspectSettings = {
  enabled: [...ASPECT_IDS],
  orbs: { conjunction: 7, opposition: 7, square: 6, trine: 6, sextile: 4, quincunx: 2, semisextile: 1.5, semisquare: 1.5, sesquiquadrate: 1.5 },
  luminaryBonus: 1,
  pointOrbFactor: 0.5,
};

export function buildOverlay(natal: NatalChart, kind: OverlayKind, opts: { date?: Date; partner?: NatalChart } = {}): Overlay {
  const cusps = natal.houses?.cusps.map((c) => c.lon) ?? null;
  const targets = toBodies(natalAspectTargets(natal));
  const date = opts.date ?? new Date();

  if (kind === "transits") {
    const points = pointsAt(jdFromDate(date), { cusps });
    const movers = points.filter((p) => p.id !== "trueSouthNode");
    return {
      kind,
      label: "Transits",
      sublabel: date.toISOString(),
      points,
      aspects: findCrossAspects(toBodies(movers), targets, TRANSIT_ASPECT_SETTINGS),
    };
  }

  if (kind === "progressions") {
    const prog = computeProgressions(natal, date);
    const points = [...prog.points, ...prog.angles];
    return {
      kind,
      label: "Secondary progressions",
      sublabel: `${date.toISOString()} · age ${prog.ageYears.toFixed(2)}`,
      points,
      aspects: findCrossAspects(toBodies(points), targets, PROGRESSION_ASPECT_SETTINGS),
    };
  }

  const partner = opts.partner;
  if (!partner) throw new Error("Synastry overlay needs a second person");
  const eps = natal.engine.obliquity;
  const points = natalAspectTargets(partner).map((p) =>
    buildPoint(p.id, { lon: p.lon, lat: p.lat, speed: p.speed, decl: p.decl }, { cusps, sect: partner.sect, eps, station: p.station }),
  );
  return {
    kind,
    label: partner.name || "Partner",
    sublabel: "Synastry",
    points,
    aspects: findCrossAspects(toBodies(points), targets, SYNASTRY_ASPECT_SETTINGS),
  };
}
