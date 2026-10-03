/**
 * Anthropic API access — server-side only. The key is read from
 * ANTHROPIC_API_KEY in .env.local and never sent to the browser.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageStreamParams } from "@anthropic-ai/sdk/resources/beta/messages/messages";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

/**
 * Server-side refusal fallback: if a safety classifier declines a request,
 * the API re-runs it on Anthropic's recommended fallback model in the same call.
 */
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

export type StreamParams = Omit<BetaMessageStreamParams, "model" | "betas" | "fallbacks"> & { model?: string };

export function friendlyError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "The Anthropic API key is missing or invalid. Add ANTHROPIC_API_KEY to .env.local and restart the dev server.";
  if (e instanceof Anthropic.PermissionDeniedError) return "This API key does not have access to the configured model.";
  if (e instanceof Anthropic.RateLimitError) return "Rate limited by the Anthropic API — wait a moment and try again.";
  if (e instanceof Anthropic.BadRequestError) return `The API rejected the request: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return "Could not reach the Anthropic API (network error).";
  if (e instanceof Anthropic.APIError) return `Anthropic API error ${e.status ?? ""}: ${e.message}`;
  return (e as Error)?.message ?? String(e);
}

/**
 * Stream Claude's text output as a plain-text HTTP response.
 * `onComplete` receives the full text when the model finishes normally
 * (used to cache interpretations).
 */
export function streamTextResponse(params: StreamParams, onComplete?: (text: string) => void): Response {
  if (!aiConfigured()) {
    return new Response(
      "**AI interpretation is not configured.** Add `ANTHROPIC_API_KEY=...` to `.env.local` in the project root and restart `npm run dev`. All calculations work without it.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI": "unconfigured" } },
    );
  }
  const encoder = new TextEncoder();
  const stream = anthropic().beta.messages.stream({ ...FALLBACK, model: MODEL, ...params });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            text += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n*The interpreter declined to answer this request.*"));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n*(Response reached its length limit.)*"));
        } else {
          onComplete?.(text);
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n**Error:** ${friendlyError(e)}`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Model": MODEL },
  });
}
