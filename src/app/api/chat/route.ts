import { z } from "zod";
import { runChatTurn, type ChatEvent } from "@/lib/ai/chat";

const MAX_B64 = 30 * 1024 * 1024; // ~22 MB of binary

const BodySchema = z.object({
  threadId: z.number().int().nullish(),
  personId: z.number().int().nullish(),
  text: z.string().max(20_000),
  depth: z.enum(["standard", "deep"]).default("standard"),
  timezone: z.string().min(1).max(64).default("UTC"),
  attachments: z
    .array(
      z.object({
        kind: z.enum(["image", "pdf"]),
        mediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]),
        data: z.string().max(MAX_B64),
        name: z.string().max(200).optional(),
      }),
    )
    .max(6)
    .default([]),
});

/**
 * POST /api/chat — one Oracle turn, streamed as newline-delimited JSON events
 * (thread, text, tool, tool_done, notice, error, done).
 */
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const body = parsed.data;
  if (!body.text.trim() && body.attachments.length === 0) return Response.json({ error: "Empty message" }, { status: 400 });

  const encoder = new TextEncoder();
  const abort = new AbortController();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: ChatEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* client went away */
        }
      };
      await runChatTurn({
        threadId: body.threadId ?? null,
        personId: body.personId ?? null,
        text: body.text,
        attachments: body.attachments,
        depth: body.depth,
        timezone: body.timezone,
        emit,
        signal: abort.signal,
      });
      try { controller.close(); } catch { /* already closed */ }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
