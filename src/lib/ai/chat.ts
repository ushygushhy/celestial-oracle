/**
 * The Oracle chat loop: stream Claude's reply, run engine tools it asks for,
 * and persist every message append-only so the conversation can be replayed
 * exactly on the next turn.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { BetaContentBlockParam, BetaMessageParam, BetaTextBlockParam, BetaToolResultBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { anthropic, aiConfigured, friendlyError, MODEL } from "./client";
import { ORACLE_TOOLS, runTool } from "./tools";
import { buildThreadSystem, dayKey, refreshText } from "./chat-context";
import { appendMessages, createThread, getThread, loadMessages, touchThread, type StoredKind } from "../db/chat";
import { getPerson } from "../db/people";

export interface Attachment {
  kind: "image" | "pdf";
  mediaType: string;
  /** base64, no data: prefix */
  data: string;
  name?: string;
}

export type ChatEvent =
  | { type: "thread"; id: number; title: string }
  | { type: "text"; text: string }
  | { type: "tool"; name: string; label: string }
  | { type: "tool_done"; name: string; label: string; error?: boolean }
  | { type: "notice"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

const MAX_TOOL_ROUNDS = 10;
const BETAS = ["server-side-fallback-2026-07-01", "thinking-binding-controls-2026-08-01"];

function userBlocks(text: string, attachments: Attachment[]): BetaContentBlockParam[] {
  const blocks: BetaContentBlockParam[] = attachments.map((a) =>
    a.kind === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data }, ...(a.name ? { title: a.name } : {}) }
      : { type: "image", source: { type: "base64", media_type: a.mediaType as "image/png", data: a.data } },
  );
  blocks.push({ type: "text", text: text.trim() || "(see attachment)" });
  return blocks;
}

export async function runChatTurn(opts: {
  threadId: number | null;
  personId: number | null;
  text: string;
  attachments: Attachment[];
  depth: "standard" | "deep";
  timezone: string;
  emit: (e: ChatEvent) => void;
  signal: AbortSignal;
}) {
  const { emit, signal } = opts;
  if (!aiConfigured()) {
    emit({ type: "error", message: "The Oracle needs an Anthropic API key. Add ANTHROPIC_API_KEY=… to celestial-oracle/.env.local and restart npm run dev." });
    return;
  }
  const now = new Date();

  // 1. Thread (frozen system prompt) -----------------------------------------
  let thread = opts.threadId ? getThread(opts.threadId) : null;
  if (!thread) {
    const person = opts.personId ? getPerson(opts.personId) : null;
    const title = opts.text.trim().replace(/\s+/g, " ").slice(0, 70) || (opts.attachments.length ? "Chart image" : "New conversation");
    thread = createThread(person?.id ?? null, buildThreadSystem(person, now, opts.timezone), opts.timezone, title, now);
    emit({ type: "thread", id: thread.id, title: thread.title });
  }
  const system = JSON.parse(thread.system_json) as BetaTextBlockParam[];
  const tz = thread.timezone || opts.timezone;
  const person = thread.person_id ? getPerson(thread.person_id) : null;

  // 2. History + the new user turn --------------------------------------------
  const history = loadMessages(thread.id).map((m) => m.message);
  const user: BetaMessageParam = { role: "user", content: userBlocks(opts.text, opts.attachments) };
  appendMessages(thread.id, [{ message: user, kind: "user" }]);

  // A later day gets refreshed "today" data, appended (never edited in).
  let pendingSystem: BetaMessageParam | null = null;
  if (dayKey(new Date(thread.context_at), tz) !== dayKey(now, tz)) {
    pendingSystem = { role: "system", content: refreshText(person, now, tz) };
  }
  const messages: BetaMessageParam[] = [...history, user, ...(pendingSystem ? [pendingSystem] : [])];
  const effort = opts.depth === "deep" ? "high" : "medium";

  // 3. Tool loop --------------------------------------------------------------
  let jsonRetries = 0;
  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const stream = anthropic().beta.messages.stream(
        {
          model: MODEL,
          max_tokens: 32000,
          betas: BETAS,
          fallbacks: "default",
          system,
          tools: ORACLE_TOOLS,
          messages,
          thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
          output_config: { effort },
        },
        { signal },
      );
      stream.on("text", (delta) => emit({ type: "text", text: delta }));

      let final: Awaited<ReturnType<typeof stream.finalMessage>>;
      try {
        final = await stream.finalMessage();
        jsonRetries = 0;
      } catch (err) {
        // Only a malformed streamed tool input is retried; API errors propagate.
        if (err instanceof Anthropic.APIError || signal.aborted || jsonRetries++ >= 2) throw err;
        continue;
      }

      const assistant: BetaMessageParam = { role: "assistant", content: final.content as BetaContentBlockParam[] };
      const toPersist: { message: BetaMessageParam; kind: StoredKind }[] = [];
      if (pendingSystem) {
        toPersist.push({ message: pendingSystem, kind: "system" });
      }
      toPersist.push({ message: assistant, kind: "assistant" });
      messages.push(assistant);

      const toolUses = final.content.filter((b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use");
      if (final.stop_reason === "tool_use" && toolUses.length) {
        const results: BetaToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          emit({ type: "tool", name: tu.name, label: tu.name.replace(/_/g, " ") });
          const out = await runTool(tu.name, tu.input, { timezone: tz, personId: thread.person_id });
          emit({ type: "tool_done", name: tu.name, label: out.label, error: out.isError });
          results.push({ type: "tool_result", tool_use_id: tu.id, content: out.content, ...(out.isError ? { is_error: true } : {}) });
        }
        const toolMsg: BetaMessageParam = { role: "user", content: results };
        toPersist.push({ message: toolMsg, kind: "tool_result" });
        messages.push(toolMsg);
        appendMessages(thread.id, toPersist);
        if (pendingSystem) touchThread(thread.id, now);
        pendingSystem = null;
        emit({ type: "text", text: "\n\n" });
        continue;
      }

      if (final.stop_reason === "max_tokens" && toolUses.length) {
        emit({ type: "notice", text: "The reply ran out of room mid-calculation. Ask again or narrow the question." });
        break; // the truncated assistant turn is not persisted: it holds an unanswered tool call
      }
      appendMessages(thread.id, toPersist);
      if (pendingSystem) touchThread(thread.id, now);
      pendingSystem = null;
      if (final.stop_reason === "refusal") emit({ type: "notice", text: "The Oracle declined to answer that request." });
      if (final.stop_reason === "max_tokens") emit({ type: "notice", text: "The reply reached its length limit." });
      break;
    }
  } catch (e) {
    if (signal.aborted || e instanceof Anthropic.APIUserAbortError) {
      emit({ type: "notice", text: "Stopped." });
    } else {
      emit({ type: "error", message: friendlyError(e) });
    }
  } finally {
    touchThread(thread.id);
  }
  emit({ type: "done" });
}
