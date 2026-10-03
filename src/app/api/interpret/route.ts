import { z } from "zod";
import { getPerson } from "@/lib/db/people";
import { chartForPerson, settingsFromParams, settingsKey } from "@/lib/services/chart-service";
import { chartContext, overlayFacts, overlayTitle, targetFacts, targetTitle, type InterpretTarget, type OverlayTarget } from "@/lib/ai/context";
import { buildOverlay } from "@/lib/services/overlay-service";
import { transitFacts, transitTitle, type TransitTarget } from "@/lib/ai/transit-context";
import { yearFacts, yearReport } from "@/lib/services/year-service";
import { fullProfile } from "@/lib/numerology/full";
import { numerologyFacts } from "@/lib/ai/numerology-context";
import { synastry, synastryFacts } from "@/lib/services/synastry-service";
import type { PointId } from "@/lib/astro/constants";
import { INTERPRETER_SYSTEM, PROMPT_VERSION } from "@/lib/ai/prompts";
import { MODEL, streamTextResponse } from "@/lib/ai/client";
import { cacheKey, getCachedInterpretation, saveInterpretation } from "@/lib/ai/cache";

const TargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("point"), id: z.string() }),
  z.object({ kind: z.literal("house"), house: z.number().int().min(1).max(12) }),
  z.object({ kind: z.literal("aspect"), a: z.string(), b: z.string(), type: z.string() }),
  z.object({ kind: z.literal("pattern"), index: z.number().int().min(0) }),
  z.object({ kind: z.literal("overview") }),
  z.object({ kind: z.literal("overlay-point"), overlay: z.enum(["transits", "progressions", "synastry"]), date: z.string(), other: z.number().int().optional(), id: z.string() }),
  z.object({ kind: z.literal("numerology"), system: z.enum(["pythagorean", "chaldean"]), name: z.string().min(1).max(200), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ kind: z.literal("synastry"), other: z.number().int(), focus: z.object({ a: z.string(), b: z.string(), type: z.string() }).nullish() }),
  z.object({ kind: z.literal("year"), timezone: z.string().optional(), location: z.object({ label: z.string(), lat: z.number(), lon: z.number() }).nullish() }),
  z.object({ kind: z.literal("transit"), transiting: z.string(), aspect: z.string(), natal: z.string(), date: z.string() }),
  z.object({ kind: z.literal("overlay-aspect"), overlay: z.enum(["transits", "progressions", "synastry"]), date: z.string(), other: z.number().int().optional(), a: z.string(), b: z.string(), type: z.string() }),
]);

type SynastryTarget = { kind: "synastry"; other: number; focus?: { a: string; b: string; type: string } | null };
type NumerologyTarget = { kind: "numerology"; system: "pythagorean" | "chaldean"; name: string; date: string };
type YearTarget = { kind: "year"; timezone?: string; location?: { label: string; lat: number; lon: number } | null };

const BodySchema = z.object({
  personId: z.number().int().nullish(),
  target: TargetSchema,
  /** chart settings as a query string, e.g. "hs=W&node=mean" */
  settings: z.string().optional(),
  fresh: z.boolean().optional(),
});

/**
 * POST /api/interpret — streams a grounded interpretation of one chart element.
 * The chart is recomputed server-side from stored birth data; the client only
 * says WHAT to interpret, never supplies positions.
 */
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { personId, fresh } = parsed.data;
  const target = parsed.data.target as InterpretTarget | OverlayTarget | TransitTarget | YearTarget | NumerologyTarget | SynastryTarget;

  // Numerology needs no chart: name + date only.
  if (target.kind === "numerology") {
    const now = new Date();
    const prof = fullProfile(target.name, target.date, { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() }, target.system);
    const nkey = cacheKey({ target, day: now.toDateString(), MODEL, PROMPT_VERSION });
    if (!fresh) {
      const cached = getCachedInterpretation(nkey);
      if (cached) return new Response(cached, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Cache": "hit" } });
    }
    return streamTextResponse(
      {
        max_tokens: 16000,
        output_config: { effort: "medium" },
        system: [{ type: "text", text: INTERPRETER_SYSTEM }],
        messages: [{ role: "user", content: `<focus>\n${numerologyFacts(prof, now.toDateString())}\n</focus>\n\nInterpret this numerology profile as a whole: how the core numbers interact, the current pinnacle and challenge, karmic notes, and this personal year. Use only the numbers given.` }],
      },
      (text) => saveInterpretation(nkey, personId ?? null, "numerology", target.name, text, MODEL),
    );
  }

  if (!personId) return Response.json({ error: "personId is required" }, { status: 400 });
  const person = getPerson(personId);
  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });

  const settings = settingsFromParams(new URLSearchParams(parsed.data.settings ?? ""), person);
  const chart = chartForPerson(person, settings);
  const key = cacheKey({ personId, updated: person.updatedAt, s: settingsKey(settings), target, MODEL, PROMPT_VERSION });

  if (!fresh) {
    const cached = getCachedInterpretation(key);
    if (cached) return new Response(cached, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Cache": "hit" } });
  }

  let title: string;
  let facts: string;
  let effort: "medium" | "high" = "medium";
  if (target.kind === "synastry") {
    const other = getPerson(target.other);
    if (!other) return Response.json({ error: "Second person not found" }, { status: 404 });
    const syn = synastry(chart, chartForPerson(other));
    const focus = target.focus ? { a: target.focus.a as PointId, b: target.focus.b as PointId, type: target.focus.type } : null;
    title = focus ? `${other.name}'s ${focus.a} ${focus.type} ${person.name}'s ${focus.b}` : `${person.name} & ${other.name}`;
    facts = synastryFacts(syn, focus);
    facts += focus
      ? "\n\nTask: interpret the FOCUS CONTACT in the context of both charts — how each person experiences it, and how it plays out between them."
      : "\n\nTask: read this relationship — the strongest inter-aspects, the house overlays (where each person lands in the other's life), and the composite chart's core themes. Balanced and specific; 700–1000 words.";
    effort = focus ? "medium" : "high";
  } else if (target.kind === "year") {
    title = "The year ahead — a synthesis";
    facts = yearFacts(yearReport(person, chart, new Date(), target.location ?? null, target.timezone ?? "UTC"));
    facts += "\n\nTask: weave the profection (and its Lord), the solar return, progressions and numerology into one coherent narrative of the year — main themes, timing (cite the dates given), and how the techniques agree or pull in different directions. 700–1100 words.";
    effort = "high";
  } else if (target.kind === "transit") {
    title = transitTitle(target);
    facts = transitFacts(chart, target);
  } else if (target.kind === "overlay-point" || target.kind === "overlay-aspect") {
    const partnerPerson = target.overlay === "synastry" && target.other ? getPerson(target.other) : null;
    if (target.overlay === "synastry" && !partnerPerson) return Response.json({ error: "Partner not found" }, { status: 404 });
    const overlay = buildOverlay(chart, target.overlay, {
      date: new Date(target.date),
      partner: partnerPerson ? chartForPerson(partnerPerson) : undefined,
    });
    title = overlayTitle(overlay, target);
    facts = overlayFacts(chart, overlay, target);
    if (partnerPerson) facts += `\n\n<partner_chart>\n${chartContext(chartForPerson(partnerPerson))}\n</partner_chart>`;
  } else {
    title = targetTitle(chart, target);
    facts = targetFacts(chart, target);
  }
  return streamTextResponse(
    {
      max_tokens: 16000,
      output_config: { effort },
      system: [
        { type: "text", text: INTERPRETER_SYSTEM },
        // Per-person chart context is stable across clicks → cache it.
        { type: "text", text: `<chart>\n${chartContext(chart)}\n</chart>`, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: `<focus>\n${facts}\n</focus>\n\nInterpret: ${title}. Ground everything in the calculated data above.`,
        },
      ],
    },
    (text) => saveInterpretation(key, personId, target.kind, title, text, MODEL),
  );
}
