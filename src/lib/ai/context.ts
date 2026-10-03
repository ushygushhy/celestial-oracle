/**
 * Serializes engine output into compact, explicit text for the model.
 * Everything the AI says must trace back to a line produced here.
 */
import { ASPECTS, POINTS, SIGNS, TRADITIONAL_RULER, MODERN_RULER, type AspectId, type PointId, type PlanetId } from "../astro/constants";
import type { ChartPoint, NatalChart } from "../astro/chart";
import type { Aspect } from "../astro/aspects";
import { formatArc, formatLon } from "../astro/math";
import { ordinal } from "../astro/patterns";
import { HOUSE_SYSTEMS } from "../astro/ephemeris";
import type { Overlay, OverlayKind } from "../services/overlay-service";

const name = (id: PointId) => POINTS[id].name;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const roman = ["", "I", "II", "III"];

export function motion(p: ChartPoint): string {
  if (p.kind === "angle" || p.id === "fortune" || p.id === "vertex") return "—";
  const parts = [p.retrograde ? "retrograde" : "direct"];
  if (p.station) parts.push(`stationary (turning ${p.station})`);
  return parts.join(", ");
}

export function dignityText(p: ChartPoint): string {
  const d = p.dignity;
  if (!d) return "—";
  const bits: string[] = [];
  if (d.major.length) bits.push(d.major.join(" + "));
  if (d.minor.length) bits.push(`holds ${d.minor.join(", ")}`);
  if (d.peregrine) bits.push("peregrine");
  if (!bits.length) bits.push("no major dignity");
  const score = d.score !== null ? ` (Lilly score ${d.score >= 0 ? "+" : ""}${d.score})` : "";
  const notes = d.notes.length ? ` [${d.notes.join("; ")}]` : "";
  return `${bits.join("; ")}${score}${notes}`;
}

/** Houses ruled by a planet (traditional + modern), from the cusp signs. */
export function housesRuledBy(chart: NatalChart, planet: PlanetId): { traditional: number[]; modern: number[] } {
  const cusps = chart.houses?.cusps ?? [];
  return {
    traditional: cusps.filter((c) => TRADITIONAL_RULER[c.sign] === planet).map((c) => c.house),
    modern: cusps.filter((c) => MODERN_RULER[c.sign] === planet && TRADITIONAL_RULER[c.sign] !== planet).map((c) => c.house),
  };
}

export function pointLine(chart: NatalChart, p: ChartPoint): string {
  const parts = [`${p.name}: ${p.formattedPrecise}`];
  if (p.house) parts.push(`house ${p.house}`);
  parts.push(`motion ${motion(p)}`);
  if (p.kind !== "angle") parts.push(`decan ${roman[p.decan.number]} (triplicity ruler ${cap(p.decan.ruler)}, Chaldean face ${cap(p.decan.faceRuler)})`);
  if (p.dignity) parts.push(`dignity: ${dignityText(p)}; term ruler ${cap(p.dignity.rulers.term)}`);
  if (p.decl !== null && p.kind !== "angle") parts.push(`declination ${p.decl >= 0 ? "+" : ""}${p.decl.toFixed(2)}°${p.outOfBounds ? " (OUT OF BOUNDS)" : ""}`);
  if ((p.kind === "planet" || p.kind === "luminary") && chart.houses) {
    const r = housesRuledBy(chart, p.id as PlanetId);
    if (r.traditional.length) parts.push(`rules houses ${r.traditional.join(", ")}`);
    if (r.modern.length) parts.push(`modern co-ruler of houses ${r.modern.join(", ")}`);
  }
  if (p.uncertain) parts.push("POSITION UNCERTAIN (unknown birth time)");
  return parts.join(" | ");
}

export function aspectLine(a: Aspect, from?: string, to?: string): string {
  const info = ASPECTS[a.type];
  const state = a.applying === null ? "" : a.applying ? ", applying" : ", separating";
  return `${from ?? name(a.a)} ${info.name.toLowerCase()} ${to ?? name(a.b)} (orb ${formatArc(a.orb)}${state}${a.outOfSign ? ", out-of-sign" : ""})`;
}

/** The node pair NOT selected in settings is omitted from AI context to avoid duplicates. */
const unusedNodes = (chart: NatalChart): PointId[] =>
  chart.settings.nodeType === "true" ? ["meanNode", "meanSouthNode"] : ["trueNode", "trueSouthNode"];

export function chartContext(chart: NatalChart): string {
  const m = chart.moment;
  const skip = unusedNodes(chart);
  const L: string[] = [];
  L.push(`NATAL CHART — ${chart.name || "unnamed"}`);
  L.push(`Birth: ${chart.input.date} ${m.timeUnknown ? "(birth time UNKNOWN — noon chart; no houses/angles; Moon degree uncertain)" : chart.input.time} local time, ${chart.placeName} (${chart.input.lat.toFixed(4)}, ${chart.input.lon.toFixed(4)})`);
  L.push(`Time zone: ${m.tz}${m.abbreviation ? ` ${m.abbreviation}` : ""} ${m.offsetLabel}${m.isDst ? " (daylight/summer time)" : ""} → ${m.utcIso.replace(".000Z", "Z")}`);
  L.push(`Zodiac: tropical · House system: ${chart.houses ? chart.houses.systemName : "none (time unknown)"} · Lunar node: ${chart.settings.nodeType} · Sect: ${chart.sect ?? "unknown"} chart`);
  if (chart.warnings.length) L.push(`Notes: ${chart.warnings.join(" ")}`);
  if (chart.moonRange) L.push(`Moon range on the birth date: ${formatLon(chart.moonRange.from)} to ${formatLon(chart.moonRange.to)}`);

  L.push("", "PLACEMENTS");
  const order: PointId[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "trueNode", "trueSouthNode", "meanNode", "lilith", "fortune", "asc", "mc", "dsc", "ic", "vertex"];
  for (const id of order) {
    const p = chart.points[id];
    if (p && !skip.includes(id)) L.push(`- ${pointLine(chart, p)}`);
  }

  if (chart.houses) {
    L.push("", `HOUSE CUSPS (${HOUSE_SYSTEMS[chart.houses.effectiveSystem]})`);
    for (const c of chart.houses.cusps) {
      const ruler = chart.points[c.ruler];
      const occupants = Object.values(chart.points).filter((p) => p && p.house === c.house && p.kind !== "angle" && !skip.includes(p.id)).map((p) => p!.name);
      const modern = c.modernRuler !== c.ruler ? `; modern ruler ${cap(c.modernRuler)} at ${chart.points[c.modernRuler]?.formatted} (house ${chart.points[c.modernRuler]?.house})` : "";
      L.push(`- ${ordinal(c.house)} house: ${formatLon(c.lon, "name", true)} · ruler ${cap(c.ruler)} at ${ruler?.formatted} (house ${ruler?.house})${modern}${occupants.length ? ` · occupants: ${occupants.join(", ")}` : " · empty"}`);
    }
  }

  if (chart.chartRuler) {
    const t = chart.points[chart.chartRuler.traditional]!;
    L.push("", `CHART RULER: Ascendant in ${SIGNS.find((s) => s.id === chart.chartRuler!.ascSign)!.name} → traditional ruler ${t.name} at ${t.formattedPrecise}, house ${t.house}, ${motion(t)}, ${dignityText(t)}`);
    if (chart.chartRuler.modern) {
      const mr = chart.points[chart.chartRuler.modern]!;
      L.push(`Modern ruler: ${mr.name} at ${mr.formattedPrecise}, house ${mr.house}, ${motion(mr)}`);
    }
  }

  L.push("", "ASPECTS (tightest first)");
  for (const a of chart.aspects) L.push(`- ${aspectLine(a)}`);

  if (chart.patterns.length) {
    L.push("", "ASPECT PATTERNS");
    for (const p of chart.patterns) {
      L.push(`- ${p.name}: ${p.points.map(name).join(", ")}${p.apex ? ` (apex/focal: ${name(p.apex)})` : ""}${p.detail ? ` — ${p.detail}` : ""}${p.tightness !== undefined ? ` (avg orb ${formatArc(p.tightness)})` : ""}`);
    }
  }

  const b = chart.balance;
  L.push("", "BALANCE (planets Sun–Pluto; weighted score counts luminaries & Ascendant ×2)");
  L.push(`Elements: ${(["fire", "earth", "air", "water"] as const).map((e) => `${e} ${b.elements.planets[e].length} [${b.elements.planets[e].map(name).join(", ")}] w=${b.elements.weighted[e]}`).join("; ")}. Dominant ${b.elements.dominant}${b.elements.lacking.length ? `; lacking ${b.elements.lacking.join(", ")}` : ""}.`);
  L.push(`Modalities: ${(["cardinal", "fixed", "mutable"] as const).map((m2) => `${m2} ${b.modalities.planets[m2].length} w=${b.modalities.weighted[m2]}`).join("; ")}. Dominant ${b.modalities.dominant}.`);
  if (b.hemispheres) {
    L.push(`Hemispheres: below horizon (houses 1–6) ${b.hemispheres.north.length}, above (7–12) ${b.hemispheres.south.length}; eastern (10–3) ${b.hemispheres.east.length}, western (4–9) ${b.hemispheres.west.length}.`);
  }
  const d = chart.dispositors;
  L.push(`Final dispositor (traditional rulers): ${d.final ? cap(d.final) : "none (mixed chains or a loop)"}${d.mutualReceptions.length ? `; mutual receptions: ${d.mutualReceptions.map(([x, y]) => `${cap(x)}–${cap(y)}`).join(", ")}` : ""}.`);
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// Focus targets
// ---------------------------------------------------------------------------

export type InterpretTarget =
  | { kind: "point"; id: PointId }
  | { kind: "house"; house: number }
  | { kind: "aspect"; a: PointId; b: PointId; type: AspectId }
  | { kind: "pattern"; index: number }
  | { kind: "overview" };

export function targetTitle(chart: NatalChart, t: InterpretTarget): string {
  switch (t.kind) {
    case "point": return `${name(t.id)} in ${chart.points[t.id]?.formatted.split(" ").slice(1).join(" ") ?? "?"}`;
    case "house": return `The ${ordinal(t.house)} house`;
    case "aspect": return `${name(t.a)} ${ASPECTS[t.type].name.toLowerCase()} ${name(t.b)}`;
    case "pattern": return chart.patterns[t.index]?.name ?? "Pattern";
    case "overview": return "Chart overview";
  }
}

/** Focus block: the exact facts about the clicked element. */
export function targetFacts(chart: NatalChart, t: InterpretTarget): string {
  const L: string[] = [];
  const aspectsOf = (id: PointId) => chart.aspects.filter((a) => a.a === id || a.b === id);
  switch (t.kind) {
    case "point": {
      const p = chart.points[t.id];
      if (!p) return "This point is not present in the chart.";
      L.push(pointLine(chart, p));
      const sign = SIGNS[p.signIndex];
      L.push(`Sign ${sign.name}: ${sign.element}, ${sign.modality}; sign ruler ${cap(TRADITIONAL_RULER[sign.id])}${MODERN_RULER[sign.id] !== TRADITIONAL_RULER[sign.id] ? ` (modern ${cap(MODERN_RULER[sign.id])})` : ""}`);
      const disp = chart.points[TRADITIONAL_RULER[sign.id]];
      if (disp && disp.id !== p.id) L.push(`Dispositor: ${disp.name} at ${disp.formatted}${disp.house ? `, house ${disp.house}` : ""}`);
      if (chart.chartRuler?.traditional === t.id || chart.chartRuler?.modern === t.id) L.push("This planet is the CHART RULER.");
      const asp = aspectsOf(t.id);
      L.push(asp.length ? `Aspects: ${asp.map((a) => aspectLine(a)).join("; ")}` : "No aspects within orb.");
      const inPatterns = chart.patterns.filter((x) => x.points.includes(t.id));
      if (inPatterns.length) L.push(`Part of: ${inPatterns.map((x) => x.name + (x.apex === t.id ? " (as apex)" : "")).join(", ")}`);
      break;
    }
    case "house": {
      const c = chart.houses?.cusps[t.house - 1];
      if (!c) return "Houses are unavailable (birth time unknown).";
      L.push(`${ordinal(t.house)} house cusp: ${formatLon(c.lon, "name", true)} (${HOUSE_SYSTEMS[chart.houses!.effectiveSystem]})`);
      const occupants = Object.values(chart.points).filter((p) => p && p.house === t.house && !["asc", "mc", "dsc", "ic", ...unusedNodes(chart)].includes(p.id));
      L.push(occupants.length ? `Occupants: ${occupants.map((p) => pointLine(chart, p!)).join("\n  ")}` : "No planets or points in this house.");
      const ruler = chart.points[c.ruler]!;
      L.push(`Traditional ruler: ${pointLine(chart, ruler)}`);
      L.push(`Ruler's aspects: ${aspectsOf(c.ruler).map((a) => aspectLine(a)).join("; ") || "none"}`);
      if (c.modernRuler !== c.ruler) {
        const mr = chart.points[c.modernRuler];
        if (mr) L.push(`Modern ruler: ${pointLine(chart, mr)}`);
      }
      break;
    }
    case "aspect": {
      const asp = chart.aspects.find((a) => a.type === t.type && ((a.a === t.a && a.b === t.b) || (a.a === t.b && a.b === t.a)));
      if (!asp) return "This aspect is not in the chart.";
      L.push(`Aspect: ${aspectLine(asp)}; exact angle ${asp.angle}°, actual separation ${formatArc(asp.separation)}, allowed orb ${formatArc(asp.allowedOrb)}`);
      for (const id of [asp.a, asp.b]) {
        const p = chart.points[id];
        if (p) L.push(pointLine(chart, p));
      }
      const pats = chart.patterns.filter((x) => x.points.includes(asp.a) && x.points.includes(asp.b));
      if (pats.length) L.push(`Both belong to: ${pats.map((x) => x.name).join(", ")}`);
      break;
    }
    case "pattern": {
      const pat = chart.patterns[t.index];
      if (!pat) return "Pattern not found.";
      L.push(`${pat.name}${pat.detail ? ` — ${pat.detail}` : ""}${pat.apex ? `; apex/focal point ${name(pat.apex)}` : ""}`);
      for (const id of pat.points) {
        const p = chart.points[id];
        if (p) L.push(pointLine(chart, p));
      }
      const internal = chart.aspects.filter((a) => pat.points.includes(a.a) && pat.points.includes(a.b));
      L.push(`Internal aspects: ${internal.map((a) => aspectLine(a)).join("; ")}`);
      break;
    }
    case "overview":
      L.push("Give an integrated overview of the whole chart.");
      break;
  }
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// Overlay targets (transits, progressions, synastry)
// ---------------------------------------------------------------------------


export type OverlayTarget =
  | { kind: "overlay-point"; overlay: OverlayKind; date: string; other?: number; id: PointId }
  | { kind: "overlay-aspect"; overlay: OverlayKind; date: string; other?: number; a: PointId; b: PointId; type: AspectId };

const overlayPrefix = (o: Overlay) => (o.kind === "transits" ? "Transiting" : o.kind === "progressions" ? "Progressed" : `${o.label}'s`);

export function overlayTitle(o: Overlay, t: OverlayTarget): string {
  if (t.kind === "overlay-point") return `${overlayPrefix(o)} ${name(t.id)}`;
  return `${overlayPrefix(o)} ${name(t.a)} ${ASPECTS[t.type].name.toLowerCase()} natal ${name(t.b)}`;
}

export function overlayFacts(chart: NatalChart, o: Overlay, t: OverlayTarget): string {
  const L: string[] = [];
  const when = o.kind === "synastry" ? `Synastry: ${o.label}'s natal chart placed around ${chart.name}'s chart.` : `${o.label} for ${t.date.replace(".000Z", "Z")} (UT).`;
  L.push(when);
  const describeOuter = (p: ChartPoint) =>
    `${overlayPrefix(o)} ${p.name}: ${p.formattedPrecise}${p.house ? `, in ${chart.name}'s natal house ${p.house}` : ""}, ${motion(p)}${p.dignity ? `, ${dignityText(p)}` : ""}`;
  if (t.kind === "overlay-point") {
    const p = o.points.find((x) => x.id === t.id);
    if (!p) return "This point is not in the overlay.";
    L.push(describeOuter(p));
    const asp = o.aspects.filter((a) => a.a === t.id);
    L.push(asp.length ? `Contacts to natal points: ${asp.map((a) => aspectLine(a, `${overlayPrefix(o)} ${name(a.a)}`, `natal ${name(a.b)}`)).join("; ")}` : "No contacts to natal points within orb.");
    for (const a of asp) {
      const n = chart.points[a.b];
      if (n) L.push(`Natal ${pointLine(chart, n)}`);
    }
  } else {
    const a = o.aspects.find((x) => x.a === t.a && x.b === t.b && x.type === t.type);
    const p = o.points.find((x) => x.id === t.a);
    const n = chart.points[t.b];
    if (!a || !p || !n) return "This contact is not present.";
    L.push(`Contact: ${aspectLine(a, `${overlayPrefix(o)} ${name(a.a)}`, `natal ${name(a.b)}`)}; exact angle ${a.angle}°`);
    L.push(describeOuter(p));
    L.push(`Natal ${pointLine(chart, n)}`);
    if (o.kind === "transits") L.push("Exact perfection dates are not included in this data; do not state dates.");
  }
  return L.join("\n");
}
