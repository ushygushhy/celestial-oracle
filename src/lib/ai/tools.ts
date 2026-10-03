/**
 * Engine-backed tools for the Oracle chat. The model never computes positions
 * or dates itself: it calls these, and they call the Swiss Ephemeris.
 */
import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { DateTime } from "luxon";
import { z } from "zod";
import { ASPECTS, ASPECT_IDS, POINTS, SIGNS, type AspectId, type PointId } from "../astro/constants";
import { formatArc, formatLon } from "../astro/math";
import { jdFromDate, dateFromJd } from "../astro/time";
import { pointsAt } from "../astro/positions";
import { bodySampler, stepFor, orbPeriods, exactPoints, findIngresses, findStations } from "../astro/search";
import { buildOverlay } from "../services/overlay-service";
import { chartForPerson } from "../services/chart-service";
import { getPerson, listPeople } from "../db/people";
import { chartContext, motion } from "./context";
import { annualProfection } from "../astro/profections";
import { numerologyProfile, label as numLabel } from "../numerology/core";
import { computeProgressions } from "../astro/progressions";
import { findCrossAspects } from "../astro/aspects";
import { PROGRESSION_ASPECT_SETTINGS } from "../services/overlay-service";
import type { ChartPoint } from "../astro/chart";
import { ordinal } from "../astro/patterns";

export interface ToolContext {
  /** IANA zone of the user's browser — used to read and print dates */
  timezone: string;
  /** person the conversation is about, if any */
  personId: number | null;
}

const BODIES = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "trueNode", "trueSouthNode", "meanNode", "lilith"] as const;
const NATAL_POINTS = [...BODIES, "asc", "mc", "dsc", "ic", "vertex", "fortune"] as const;
const STATIONING = new Set<PointId>(["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron"]);

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function parseWhen(input: string, tz: string): Date {
  const s = input.trim();
  let dt = DateTime.fromISO(s, { zone: tz, setZone: true });
  if (!dt.isValid) dt = DateTime.fromSQL(s, { zone: tz });
  if (!dt.isValid) throw new Error(`Could not read the date "${input}". Use ISO format, e.g. 2027-03-01 or 2027-03-01T09:30.`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) dt = dt.set({ hour: 12 });
  return dt.toJSDate();
}

export function fmtDate(jdOrDate: number | Date, tz: string, withTime = true): string {
  const d = typeof jdOrDate === "number" ? dateFromJd(jdOrDate) : jdOrDate;
  const local = DateTime.fromJSDate(d).setZone(tz);
  return withTime ? `${local.toFormat("ccc d LLL yyyy, HH:mm")} ${local.offsetNameShort ?? ""}`.trim() : local.toFormat("ccc d LLL yyyy");
}

function requirePerson(id: number | undefined | null) {
  if (!id) throw new Error("This needs a person_id (call list_people to find one).");
  const p = getPerson(id);
  if (!p) throw new Error(`No saved person with id ${id}.`);
  return p;
}

const PHASES = ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"];
export function moonPhase(sunLon: number, moonLon: number) {
  const elong = ((moonLon - sunLon) % 360 + 360) % 360;
  const illum = (1 - Math.cos((elong * Math.PI) / 180)) / 2;
  return { elongation: elong, illumination: illum, name: PHASES[Math.floor(((elong + 22.5) % 360) / 45)] };
}

const posLine = (p: ChartPoint, natalHouse = true) =>
  `${p.name}: ${p.formattedPrecise}${p.retrograde && p.kind !== "node" ? " ℞" : ""}${p.station ? ` (stationary, turning ${p.station})` : ""} · ${p.speed.toFixed(4)}°/day${natalHouse && p.house ? ` · natal house ${p.house}` : ""}`;

// ---------------------------------------------------------------------------
// tool definitions
// ---------------------------------------------------------------------------

const schemas = {
  list_people: z.object({}),
  get_natal_chart: z.object({ person_id: z.number().int() }),
  get_positions: z.object({ datetime: z.string(), person_id: z.number().int().optional() }),
  get_transits: z.object({ person_id: z.number().int(), datetime: z.string() }),
  find_aspect_dates: z.object({
    transiting: z.enum(BODIES),
    aspect: z.enum(ASPECT_IDS),
    natal_point: z.enum(NATAL_POINTS).optional(),
    person_id: z.number().int().optional(),
    longitude: z.number().min(0).max(360).optional(),
    start: z.string(),
    end: z.string(),
    orb: z.number().min(0.1).max(10).optional(),
  }),
  find_ingresses_and_stations: z.object({ body: z.enum(BODIES), start: z.string(), end: z.string() }),
  get_progressions: z.object({ person_id: z.number().int(), date: z.string() }),
  get_profection: z.object({ person_id: z.number().int(), date: z.string() }),
  get_numerology: z.object({ person_id: z.number().int(), date: z.string().optional() }),
};
export type ToolName = keyof typeof schemas;

const enumProp = (values: readonly string[], description: string) => ({ type: "string", enum: values, description });

export const ORACLE_TOOLS: BetaTool[] = [
  {
    name: "list_people",
    description: "List the people saved in the app (id, name, birth data). Use to find a person_id.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_natal_chart",
    description: "Full calculated natal chart for a saved person: placements with exact degrees, houses, dignities, decans, aspects with orbs, patterns, chart ruler, balance.",
    input_schema: { type: "object", properties: { person_id: { type: "integer" } }, required: ["person_id"] },
  },
  {
    name: "get_positions",
    description: "Exact planetary positions (sign, degree, minute, second, retrograde, speed) and Moon phase at any moment. If person_id is given, also the natal house each planet falls in.",
    input_schema: {
      type: "object",
      properties: {
        datetime: { type: "string", description: "ISO date or datetime in the user's local time zone unless an offset is included, e.g. 2027-03-01 or 2027-03-01T09:30" },
        person_id: { type: "integer" },
      },
      required: ["datetime"],
    },
  },
  {
    name: "get_transits",
    description: "Every transit-to-natal aspect within orb at a moment (orb, applying/separating), with natal houses.",
    input_schema: { type: "object", properties: { person_id: { type: "integer" }, datetime: { type: "string" } }, required: ["person_id", "datetime"] },
  },
  {
    name: "find_aspect_dates",
    description: "Exact dates a transiting body perfects an aspect to a natal point (or to a fixed longitude), including every retrograde re-pass, plus when it enters and leaves orb and any near-misses at stations. Use for any 'when' question about transits, returns (conjunction of a planet to its own natal position) and so on.",
    input_schema: {
      type: "object",
      properties: {
        transiting: enumProp(BODIES, "moving body"),
        aspect: enumProp(ASPECT_IDS, "aspect type"),
        natal_point: enumProp(NATAL_POINTS, "natal point (requires person_id)"),
        person_id: { type: "integer" },
        longitude: { type: "number", description: "absolute ecliptic longitude 0–360 instead of a natal point" },
        start: { type: "string", description: "ISO date" },
        end: { type: "string", description: "ISO date (max 120 years after start; 3 years for the Moon)" },
        orb: { type: "number", description: "orb in degrees for the in-orb window (default 1)" },
      },
      required: ["transiting", "aspect", "start", "end"],
    },
  },
  {
    name: "find_ingresses_and_stations",
    description: "Dates a body changes sign (including retrograde re-entries) and, for planets, its retrograde and direct stations, between two dates.",
    input_schema: {
      type: "object",
      properties: { body: enumProp(BODIES, "body"), start: { type: "string" }, end: { type: "string" } },
      required: ["body", "start", "end"],
    },
  },
  {
    name: "get_progressions",
    description: "Secondary progressed chart for a date: progressed planets and angles (solar arc in RA), their natal houses, and progressed-to-natal aspects within 1°.",
    input_schema: { type: "object", properties: { person_id: { type: "integer" }, date: { type: "string" } }, required: ["person_id", "date"] },
  },
  {
    name: "get_profection",
    description: "Annual profection for a date: age, profected house and sign, Lord of the Year and its natal condition and current transit position.",
    input_schema: { type: "object", properties: { person_id: { type: "integer" }, date: { type: "string" } }, required: ["person_id", "date"] },
  },
  {
    name: "get_numerology",
    description: "Pythagorean core numbers with step-by-step reductions (Life Path, Expression, Soul Urge, Personality, Birthday, Maturity, karmic debt) and Personal Year/Month/Day for a date.",
    input_schema: { type: "object", properties: { person_id: { type: "integer" }, date: { type: "string" } }, required: ["person_id"] },
  },
].map((t) => ({ ...t, eager_input_streaming: true }) as BetaTool);

// ---------------------------------------------------------------------------
// executors
// ---------------------------------------------------------------------------

export interface ToolOutcome {
  content: string;
  /** short label for the UI, e.g. "Searched Saturn square natal Sun (2026–2030)" */
  label: string;
  isError?: boolean;
}

const name = (id: string) => POINTS[id as PointId]?.name ?? id;

export async function runTool(tool: string, rawInput: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const schema = schemas[tool as ToolName];
  if (!schema) return { content: `Unknown tool ${tool}`, label: tool, isError: true };
  const parsed = schema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return { content: `INVALID_INPUT: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, label: tool, isError: true };
  }
  try {
    return execute(tool as ToolName, parsed.data as never, ctx);
  } catch (e) {
    return { content: `Error: ${(e as Error).message}`, label: tool, isError: true };
  }
}

function execute(tool: ToolName, input: Record<string, never>, ctx: ToolContext): ToolOutcome {
  const tz = ctx.timezone;
  switch (tool) {
    case "list_people": {
      const people = listPeople();
      return {
        label: "Looked up saved people",
        content: people.length ? people.map((p) => `id ${p.id}: ${p.name} — born ${p.birthDate} ${p.birthTime ?? "(time unknown)"}, ${p.placeName}`).join("\n") : "No people saved yet.",
      };
    }
    case "get_natal_chart": {
      const i = input as unknown as z.infer<typeof schemas.get_natal_chart>;
      const person = requirePerson(i.person_id);
      return { label: `Read ${person.name}'s natal chart`, content: chartContext(chartForPerson(person)) };
    }
    case "get_positions": {
      const i = input as unknown as z.infer<typeof schemas.get_positions>;
      const when = parseWhen(i.datetime, tz);
      const natal = i.person_id ? chartForPerson(requirePerson(i.person_id)) : null;
      const pts = pointsAt(jdFromDate(when), { cusps: natal?.houses?.cusps.map((c) => c.lon) ?? null });
      const sun = pts.find((p) => p.id === "sun")!, moon = pts.find((p) => p.id === "moon")!;
      const ph = moonPhase(sun.lon, moon.lon);
      return {
        label: `Calculated positions for ${fmtDate(when, tz, false)}`,
        content: [
          `Positions for ${fmtDate(when, tz)} (${when.toISOString().replace(".000Z", "Z")})${natal ? `; houses are ${natal.name}'s natal houses` : ""}`,
          ...pts.map((p) => `- ${posLine(p, !!natal)}`),
          `Moon phase: ${ph.name}, Sun–Moon elongation ${ph.elongation.toFixed(1)}°, ${(ph.illumination * 100).toFixed(0)}% illuminated`,
        ].join("\n"),
      };
    }
    case "get_transits": {
      const i = input as unknown as z.infer<typeof schemas.get_transits>;
      const person = requirePerson(i.person_id);
      const when = parseWhen(i.datetime, tz);
      const natal = chartForPerson(person);
      const o = buildOverlay(natal, "transits", { date: when });
      const lines = o.aspects.map((a) => {
        const t = o.points.find((p) => p.id === a.a)!;
        const n = natal.points[a.b]!;
        return `- Transiting ${t.name} (${t.formatted}${t.retrograde ? " ℞" : ""}, in natal house ${t.house ?? "?"}) ${ASPECTS[a.type].name.toLowerCase()} natal ${n.name} (${n.formatted}${n.house ? `, house ${n.house}` : ""}) — orb ${formatArc(a.orb)}, ${a.applying ? "applying" : "separating"}`;
      });
      return {
        label: `Calculated ${person.name}'s transits for ${fmtDate(when, tz, false)}`,
        content: [`Transits to ${person.name}'s natal chart at ${fmtDate(when, tz)} (orbs: 2° majors, 1.5° sextile, 1° minors):`, ...(lines.length ? lines : ["(none within orb)"])].join("\n"),
      };
    }
    case "find_aspect_dates": {
      const i = input as unknown as z.infer<typeof schemas.find_aspect_dates>;
      const start = parseWhen(i.start, tz), end = parseWhen(i.end, tz);
      const span = (end.getTime() - start.getTime()) / 86_400_000;
      if (span <= 0) throw new Error("end must be after start");
      if (span > (i.transiting === "moon" ? 3 * 366 : 120 * 366)) throw new Error("Date range too long (max 120 years, or 3 years for the Moon).");
      let targetLon: number, targetLabel: string;
      if (i.natal_point) {
        const person = requirePerson(i.person_id ?? ctx.personId);
        const natal = chartForPerson(person);
        const p = natal.points[i.natal_point as PointId];
        if (!p) throw new Error(`${name(i.natal_point)} is not available in ${person.name}'s chart${natal.moment.timeUnknown ? " (birth time unknown)" : ""}.`);
        targetLon = p.lon;
        targetLabel = `${person.name}'s natal ${p.name} (${p.formattedPrecise})`;
      } else if (i.longitude !== undefined) {
        targetLon = i.longitude;
        targetLabel = `${formatLon(i.longitude, "name", true)}`;
      } else throw new Error("Give natal_point (with person_id) or longitude.");
      const orb = i.orb ?? 1;
      const sampler = bodySampler(i.transiting as PointId);
      const step = stepFor(i.transiting as PointId);
      const out: string[] = [];
      let count = 0;
      for (const ep of exactPoints(targetLon, ASPECTS[i.aspect as AspectId].angle)) {
        const periods = orbPeriods(sampler, ep.lon, jdFromDate(start), jdFromDate(end), step, orb);
        for (const p of periods) {
          count++;
          const parts = [`• Window ${p.enters ? `enters ${orb}° orb ${fmtDate(p.enters, tz)}` : "already in orb at start"} → ${p.leaves ? `leaves orb ${fmtDate(p.leaves, tz)}` : "still in orb at end"}`];
          for (const h of p.hits) parts.push(`   exact ${fmtDate(h.jd, tz)} at ${formatLon(h.lon, "name", true)}${h.retrograde ? " (retrograde pass)" : ""}`);
          for (const m of p.nearMisses) parts.push(`   near-miss: stations within ${formatArc(m.orb)} of exact on ${fmtDate(m.jd, tz)} without perfecting`);
          out.push(`${parts.join("\n")}${ep.side ? `   [exact point ${formatLon(ep.lon)}]` : ""}`);
        }
      }
      return {
        label: `Searched ${name(i.transiting)} ${ASPECTS[i.aspect as AspectId].name.toLowerCase()} ${i.natal_point ? `natal ${name(i.natal_point)}` : formatLon(targetLon)} (${start.getUTCFullYear()}–${end.getUTCFullYear()})`,
        content: [`Transiting ${name(i.transiting)} ${ASPECTS[i.aspect as AspectId].name.toLowerCase()} ${targetLabel}, ${fmtDate(start, tz, false)} to ${fmtDate(end, tz, false)}:`, ...(count ? out : ["No perfections or in-orb periods in this range."])].join("\n"),
      };
    }
    case "find_ingresses_and_stations": {
      const i = input as unknown as z.infer<typeof schemas.find_ingresses_and_stations>;
      const start = parseWhen(i.start, tz), end = parseWhen(i.end, tz);
      const span = (end.getTime() - start.getTime()) / 86_400_000;
      if (span <= 0) throw new Error("end must be after start");
      if (span > (i.body === "moon" ? 92 : 120 * 366)) throw new Error("Date range too long (max 120 years, or 3 months for the Moon).");
      const id = i.body as PointId;
      const s = bodySampler(id);
      const events: { jd: number; text: string }[] = findIngresses(s, jdFromDate(start), jdFromDate(end), stepFor(id)).map((g) => ({
        jd: g.jd,
        text: `${name(id)} enters ${SIGNS[g.toSign].name}${g.retrograde ? ` (retrograde, back from ${SIGNS[g.fromSign].name})` : ""}`,
      }));
      if (STATIONING.has(id)) {
        for (const st of findStations(s, jdFromDate(start), jdFromDate(end), stepFor(id))) {
          events.push({ jd: st.jd, text: `${name(id)} stations ${st.type === "retrograde" ? "retrograde (SR)" : "direct (SD)"} at ${formatLon(st.lon, "name", true)}` });
        }
      }
      events.sort((a, b) => a.jd - b.jd);
      return {
        label: `Found ${name(id)} ingresses${STATIONING.has(id) ? " and stations" : ""} (${start.getUTCFullYear()}–${end.getUTCFullYear()})`,
        content: events.length ? events.map((e) => `- ${fmtDate(e.jd, tz)}: ${e.text}`).join("\n") : "No ingresses or stations in this range.",
      };
    }
    case "get_progressions": {
      const i = input as unknown as z.infer<typeof schemas.get_progressions>;
      const person = requirePerson(i.person_id);
      const natal = chartForPerson(person);
      const when = parseWhen(i.date, tz);
      const prog = computeProgressions(natal, when);
      const all = [...prog.points, ...prog.angles];
      const asp = findCrossAspects(
        all.map((p) => ({ id: p.id, lon: p.lon, speed: p.speed, signIndex: p.signIndex })),
        Object.values(natal.points).filter((p): p is ChartPoint => !!p && !["dsc", "ic", "meanNode", "meanSouthNode", "trueSouthNode", "vertex", "fortune"].includes(p.id)).map((p) => ({ id: p.id, lon: p.lon, speed: 0, signIndex: p.signIndex })),
        PROGRESSION_ASPECT_SETTINGS,
      );
      return {
        label: `Calculated ${person.name}'s progressions for ${fmtDate(when, tz, false)}`,
        content: [
          `Secondary progressions for ${person.name} on ${fmtDate(when, tz, false)} (age ${prog.ageYears.toFixed(2)}; ephemeris day ${prog.ephemerisIso.slice(0, 10)}; angles by solar arc in RA ${prog.solarArcRa !== null ? formatArc(prog.solarArcRa) : "n/a"}):`,
          ...all.map((p) => `- Progressed ${p.name}: ${p.formattedPrecise}${p.retrograde && p.kind !== "node" && p.kind !== "angle" ? " ℞" : ""}${p.house ? ` · natal house ${p.house}` : ""}`),
          "Progressed-to-natal aspects within 1°:",
          ...(asp.length ? asp.map((a) => `- Progressed ${name(a.a)} ${ASPECTS[a.type].name.toLowerCase()} natal ${name(a.b)} — orb ${formatArc(a.orb)}${a.applying === null ? "" : a.applying ? ", applying" : ", separating"}`) : ["(none)"]),
        ].join("\n"),
      };
    }
    case "get_profection": {
      const i = input as unknown as z.infer<typeof schemas.get_profection>;
      const person = requirePerson(i.person_id);
      const natal = chartForPerson(person);
      const when = parseWhen(i.date, tz);
      return { label: `Calculated ${person.name}'s profection year`, content: profectionText(natal, when, tz) };
    }
    case "get_numerology": {
      const i = input as unknown as z.infer<typeof schemas.get_numerology>;
      const person = requirePerson(i.person_id);
      const when = i.date ? parseWhen(i.date, tz) : new Date();
      return { label: `Calculated ${person.name}'s numerology`, content: numerologyText(person.fullBirthName, person.name, person.birthDate, when, tz) };
    }
  }
}

// ---------------------------------------------------------------------------
// shared text builders (also used for the chat's frozen context)
// ---------------------------------------------------------------------------

export function profectionText(natal: ReturnType<typeof chartForPerson>, when: Date, tz: string): string {
  const pr = annualProfection(natal, when);
  if (!pr) return "Profection unavailable for this date.";
  const lordNow = pointsAt(jdFromDate(when), { ids: [pr.lord], cusps: natal.houses?.cusps.map((c) => c.lon) ?? null })[0];
  const lines = [
    `Annual profection on ${fmtDate(when, tz, false)}: age ${pr.age} → ${ordinal(pr.house)} house year, profected sign ${SIGNS.find((s) => s.id === pr.sign)!.name}${pr.from === "sun" ? " (counted from the Sun because the birth time is unknown — a solar profection)" : " (whole-sign from the Ascendant)"}.`,
    `Profection year runs ${pr.yearStart} to ${pr.yearEnd}.`,
    `Lord of the Year: ${name(pr.lord)}${pr.lordNatal ? ` — natally ${pr.lordNatal.formattedPrecise}${pr.lordNatal.house ? `, house ${pr.lordNatal.house}` : ""}, ${motion(pr.lordNatal)}` : ""}.`,
  ];
  if (lordNow) lines.push(`Transiting ${lordNow.name} now: ${lordNow.formattedPrecise}${lordNow.retrograde ? " ℞" : ""}${lordNow.house ? `, in natal house ${lordNow.house}` : ""}.`);
  return lines.join("\n");
}

export function numerologyText(fullBirthName: string | null, displayName: string, birthDate: string, when: Date, tz: string): string {
  const local = DateTime.fromJSDate(when).setZone(tz);
  const nameUsed = fullBirthName || displayName;
  const n = numerologyProfile(nameUsed, birthDate, { y: local.year, m: local.month, d: local.day });
  const row = (lbl: string, c: typeof n.lifePath) =>
    `- ${lbl}: ${numLabel(c)}${c.karmicDebt.length ? ` (karmic debt ${c.karmicDebt.join(", ")})` : ""} — ${c.steps.join("; ")}`;
  return [
    `Numerology (Pythagorean) for "${nameUsed}", born ${birthDate}${fullBirthName ? "" : " — NOTE: no full birth name saved, so name numbers use the display name and may be wrong"}:`,
    row("Life Path", n.lifePath),
    row("Expression/Destiny", n.expression),
    row("Soul Urge", n.soulUrge),
    row("Personality", n.personality),
    row("Birthday", n.birthday),
    row("Maturity", n.maturity),
    `Cycles on ${local.toFormat("d LLL yyyy")}: Personal Year ${numLabel(n.cycles.year)} (${n.cycles.year.steps.join("; ")}), Personal Month ${numLabel(n.cycles.month)}, Personal Day ${numLabel(n.cycles.day)}.`,
  ].join("\n");
}
