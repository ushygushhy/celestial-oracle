import { z } from "zod";
import { CARD_BY_ID } from "@/lib/tarot/deck";
import { tarotFacts } from "@/lib/ai/tarot-context";
import { INTERPRETER_SYSTEM } from "@/lib/ai/prompts";
import { streamTextResponse } from "@/lib/ai/client";
import { getPerson } from "@/lib/db/people";
import { chartForPerson } from "@/lib/services/chart-service";

const Body = z.object({
  spreadName: z.string().max(120),
  positions: z.array(z.object({ label: z.string().max(80), meaning: z.string().max(200) })).max(20),
  cards: z.array(z.object({ id: z.string(), reversed: z.boolean() })).min(1).max(20),
  question: z.string().max(2000).default(""),
  personId: z.number().int().nullish(),
});

/** POST /api/tarot/interpret — streams a reading of the drawn cards. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid reading" }, { status: 400 });
  const b = parsed.data;
  if (b.cards.some((c) => !CARD_BY_ID.has(c.id))) return Response.json({ error: "Unknown card" }, { status: 400 });
  const person = b.personId ? getPerson(b.personId) : null;
  const facts = tarotFacts(b.question, b.spreadName, b.positions, b.cards, person ? chartForPerson(person) : null);
  return streamTextResponse({
    max_tokens: 16000,
    output_config: { effort: "medium" },
    system: [{ type: "text", text: INTERPRETER_SYSTEM }],
    messages: [{
      role: "user",
      content: `<focus>\n${facts}\n</focus>\n\nGive a tarot reading of this spread for the question. Read each position in turn, then the story the cards tell together (patterns of suit, element, number and Major Arcana), and close with clear, practical guidance. Reversals are part of the draw — interpret them.`,
    }],
  });
}
