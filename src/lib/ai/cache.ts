import { createHash } from "node:crypto";
import { db } from "../db";

export const cacheKey = (parts: unknown) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");

export function getCachedInterpretation(key: string): string | null {
  const row = db().prepare("SELECT text FROM interpretations WHERE key = ?").get(key) as { text: string } | undefined;
  return row?.text ?? null;
}

export function saveInterpretation(key: string, personId: number | null, kind: string, subject: string, text: string, model: string) {
  db()
    .prepare("INSERT OR REPLACE INTO interpretations (key, person_id, kind, subject, text, model) VALUES (?, ?, ?, ?, ?, ?)")
    .run(key, personId, kind, subject, text, model);
}
