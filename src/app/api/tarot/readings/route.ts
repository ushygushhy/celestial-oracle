import { z } from "zod";
import { listReadings, saveReading } from "@/lib/db/tarot";
import { CARD_BY_ID } from "@/lib/tarot/deck";

const Body = z.object({
  personId: z.number().int().nullish(),
  question: z.string().max(2000).default(""),
  spread: z.object({ id: z.string(), name: z.string(), description: z.string(), positions: z.array(z.object({ label: z.string(), meaning: z.string(), x: z.number(), y: z.number(), rotate: z.number().optional() })), custom: z.boolean().optional() }),
  cards: z.array(z.object({ id: z.string(), reversed: z.boolean() })).min(1).max(20),
  interpretation: z.string().max(100_000).nullish(),
  notes: z.string().max(10_000).nullish(),
});

export async function GET() {
  return Response.json({ readings: listReadings() });
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid reading" }, { status: 400 });
  const b = parsed.data;
  if (b.cards.some((c) => !CARD_BY_ID.has(c.id))) return Response.json({ error: "Unknown card" }, { status: 400 });
  const id = saveReading({ personId: b.personId ?? null, question: b.question, spread: b.spread, cards: b.cards, interpretation: b.interpretation ?? null, notes: b.notes ?? null });
  return Response.json({ id }, { status: 201 });
}
