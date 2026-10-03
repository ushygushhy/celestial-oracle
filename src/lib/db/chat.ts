import type { BetaMessageParam, BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { db } from "./index";

export interface ThreadRow {
  id: number;
  person_id: number | null;
  title: string;
  system_json: string;
  context_at: string;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThreadSummary {
  id: number;
  personId: number | null;
  personName: string | null;
  title: string;
  updatedAt: string;
}

export function createThread(personId: number | null, system: BetaTextBlockParam[], timezone: string, title: string, contextAt: Date): ThreadRow {
  const info = db()
    .prepare("INSERT INTO chat_threads (person_id, title, system_json, context_at, timezone) VALUES (?, ?, ?, ?, ?)")
    .run(personId, title, JSON.stringify(system), contextAt.toISOString(), timezone);
  return getThread(Number(info.lastInsertRowid))!;
}

export function getThread(id: number): ThreadRow | null {
  return (db().prepare("SELECT * FROM chat_threads WHERE id = ?").get(id) as ThreadRow | undefined) ?? null;
}

export function listThreads(personId?: number | null, limit = 40): ThreadSummary[] {
  const rows = db()
    .prepare(
      `SELECT t.id, t.person_id, t.title, t.updated_at, p.name AS person_name
       FROM chat_threads t LEFT JOIN people p ON p.id = t.person_id
       WHERE (? IS NULL OR t.person_id IS ?)
       ORDER BY t.updated_at DESC LIMIT ?`,
    )
    .all(personId === undefined ? null : 1, personId ?? null, limit) as { id: number; person_id: number | null; title: string; updated_at: string; person_name: string | null }[];
  return rows.map((r) => ({ id: r.id, personId: r.person_id, personName: r.person_name, title: r.title, updatedAt: r.updated_at }));
}

export function deleteThread(id: number) {
  db().prepare("DELETE FROM chat_threads WHERE id = ?").run(id);
}

export function touchThread(id: number, contextAt?: Date) {
  if (contextAt) db().prepare("UPDATE chat_threads SET updated_at = datetime('now'), context_at = ? WHERE id = ?").run(contextAt.toISOString(), id);
  else db().prepare("UPDATE chat_threads SET updated_at = datetime('now') WHERE id = ?").run(id);
}

export type StoredKind = "user" | "assistant" | "tool_result" | "system";

/** Messages exactly as they were sent to / returned by the API, in order. */
export function loadMessages(threadId: number): { message: BetaMessageParam; kind: StoredKind }[] {
  const rows = db().prepare("SELECT role, content_json, kind FROM chat_messages WHERE thread_id = ? ORDER BY id").all(threadId) as { role: string; content_json: string; kind: StoredKind }[];
  return rows.map((r) => ({ message: { role: r.role as BetaMessageParam["role"], content: JSON.parse(r.content_json) }, kind: r.kind }));
}

export function appendMessages(threadId: number, items: { message: BetaMessageParam; kind: StoredKind }[]) {
  const stmt = db().prepare("INSERT INTO chat_messages (thread_id, role, content_json, kind) VALUES (?, ?, ?, ?)");
  db().transaction(() => {
    for (const { message, kind } of items) stmt.run(threadId, message.role, JSON.stringify(message.content), kind);
  })();
}
