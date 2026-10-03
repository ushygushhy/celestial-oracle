/**
 * Context for the Oracle chat.
 *
 * A conversation's top-level `system` is built ONCE when the thread starts and
 * stored; every later request re-sends it byte-for-byte. Fresher data (a new
 * day's transits) is appended as a mid-conversation `role: "system"` message.
 * This keeps the history append-only, which the API requires for replayed
 * thinking blocks and which also keeps the prompt cache warm.
 */
import { DateTime } from "luxon";
import type { BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { ASPECTS } from "../astro/constants";
import { formatArc } from "../astro/math";
import { jdFromDate } from "../astro/time";
import { pointsAt } from "../astro/positions";
import { buildOverlay } from "../services/overlay-service";
import { chartForPerson } from "../services/chart-service";
import { computeProgressions } from "../astro/progressions";
import type { Person } from "../db/people";
import { chartContext } from "./context";
import { moonPhase, numerologyText, profectionText, fmtDate } from "./tools";

export const ORACLE_PROMPT_VERSION = "2026-10-02.chat.1";

export const ORACLE_SYSTEM = `You are the Oracle inside Celestial Oracle, a private astrology, numerology and tarot workstation. You are talking with its owner, who knows astrology and wants depth, precision and honest nuance.

Calculated data is ground truth:
- Positions, degrees, houses, aspects, orbs, dignities, profections, progressions and numerology come from the app's Swiss Ephemeris engine (verified against astro.com to the arcsecond). They are given in <context> blocks and returned by your tools.
- Never estimate or recall an astronomical position, degree, house, aspect, orb or date from memory. If a question needs a value that is not already in the context, call a tool. This includes every "when" question (use find_aspect_dates or find_ingresses_and_stations) and any position on another date (get_positions). If no tool can answer it, say so.
- Dates from tools are already in the user's local time zone; quote them as given.
- If the birth time is unknown, don't interpret houses, angles, the Part of Fortune or the Moon's exact degree.

Interpreting:
- Ground claims in the data: cite the degree, sign, house, the houses a planet rules, its dignity, sect, aspects and whether they are applying or separating, and explain the reasoning ("Saturn rules your 10th, so…").
- Weigh condition against placement; synthesize rather than list; distinguish traditional and modern views where they differ; note when a technique is contested.
- Be perceptive, concrete and kind. Describe tendencies and timing, not fate. No medical, legal or financial directives.
- General astrology, tarot and numerology questions can be answered from knowledge; personal specifics must come from the data.

Images: if the user shares a chart image, read the placements carefully, say which glyphs or degrees are hard to read, and compare with the calculated chart when one is in context.

Style: conversational and well organized. Match length to the question — a quick question gets a short answer; a reading gets a structured one with short "##" headings. Use Markdown.`;

export function localNow(tz: string, now = new Date()) {
  const dt = DateTime.fromJSDate(now).setZone(tz);
  return `${dt.toFormat("cccc d LLLL yyyy, HH:mm")} (${tz}, UTC${dt.toFormat("ZZ")})`;
}

/** "Today" block: sky, transits, progressions, profection, numerology. */
export function todayBlock(person: Person | null, now: Date, tz: string): string {
  const L: string[] = [`Current date and time: ${localNow(tz, now)}.`];
  const jd = jdFromDate(now);
  if (!person) {
    const pts = pointsAt(jd);
    const sun = pts.find((p) => p.id === "sun")!, moon = pts.find((p) => p.id === "moon")!;
    const ph = moonPhase(sun.lon, moon.lon);
    L.push("Sky now:", ...pts.map((p) => `- ${p.name}: ${p.formattedPrecise}${p.retrograde && p.kind !== "node" ? " ℞" : ""}${p.station ? ` (stationary, turning ${p.station})` : ""}`));
    L.push(`Moon phase: ${ph.name} (${(ph.illumination * 100).toFixed(0)}% illuminated).`);
    return L.join("\n");
  }
  const natal = chartForPerson(person);
  const transits = buildOverlay(natal, "transits", { date: now });
  const sun = transits.points.find((p) => p.id === "sun")!, moon = transits.points.find((p) => p.id === "moon")!;
  L.push("", "TRANSITING POSITIONS NOW (with the natal house each falls in):");
  for (const p of transits.points) L.push(`- ${p.name}: ${p.formattedPrecise}${p.retrograde && p.kind !== "node" ? " ℞" : ""}${p.station ? ` (stationary, turning ${p.station})` : ""}${p.house ? ` · natal house ${p.house}` : ""}`);
  L.push(`Moon phase: ${moonPhase(sun.lon, moon.lon).name}.`);
  L.push("", "TRANSITS TO THE NATAL CHART NOW (orbs: 2° majors, 1.5° sextile, 1° minors):");
  if (!transits.aspects.length) L.push("(none within orb)");
  for (const a of transits.aspects) {
    const t = transits.points.find((p) => p.id === a.a)!, n = natal.points[a.b]!;
    L.push(`- Transiting ${t.name}${t.retrograde ? " ℞" : ""} ${ASPECTS[a.type].name.toLowerCase()} natal ${n.name} (natal house ${n.house ?? "—"}) — orb ${formatArc(a.orb)}, ${a.applying ? "applying" : "separating"}`);
  }
  const prog = computeProgressions(natal, now);
  const pm = prog.points.find((p) => p.id === "moon"), ps = prog.points.find((p) => p.id === "sun");
  L.push("", `SECONDARY PROGRESSIONS (age ${prog.ageYears.toFixed(2)}):`);
  if (ps) L.push(`- Progressed Sun ${ps.formattedPrecise}${ps.house ? `, natal house ${ps.house}` : ""}`);
  if (pm) L.push(`- Progressed Moon ${pm.formattedPrecise}${pm.house ? `, natal house ${pm.house}` : ""}`);
  for (const a of prog.angles) L.push(`- Progressed ${a.name} ${a.formattedPrecise}${a.house ? `, natal house ${a.house}` : ""}`);
  L.push("(Call get_progressions for every progressed planet and progressed-to-natal aspects.)");
  L.push("", "ANNUAL PROFECTION:", profectionText(natal, now, tz));
  L.push("", numerologyText(person.fullBirthName, person.name, person.birthDate, now, tz));
  return L.join("\n");
}

/** The frozen top-level system for a new thread. */
export function buildThreadSystem(person: Person | null, now: Date, tz: string): BetaTextBlockParam[] {
  const ctx: string[] = [`<context generated="${now.toISOString()}">`];
  if (person) {
    ctx.push(`This conversation is about ${person.name} (person_id ${person.id}). Saved notes: ${person.notes?.trim() || "none"}.`, "", "<natal_chart>", chartContext(chartForPerson(person)), "</natal_chart>", "");
  } else {
    ctx.push("No particular person is selected. Use list_people and get_natal_chart if the user asks about someone saved in the app.", "");
  }
  ctx.push("<today>", todayBlock(person, now, tz), "</today>", "</context>");
  return [
    { type: "text", text: ORACLE_SYSTEM },
    { type: "text", text: ctx.join("\n"), cache_control: { type: "ephemeral" } },
  ];
}

/** Appended as a `role: "system"` message when a thread resumes on a later day. */
export function refreshText(person: Person | null, now: Date, tz: string): string {
  return `Updated context — the date has moved on since this conversation began. This supersedes earlier "today" data:\n<today>\n${todayBlock(person, now, tz)}\n</today>`;
}

export const dayKey = (d: Date, tz: string) => DateTime.fromJSDate(d).setZone(tz).toISODate();
export { fmtDate };
