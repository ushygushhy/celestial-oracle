import { db } from "./index";
import type { Spread } from "../tarot/spreads";
import { customSpread } from "../tarot/spreads";

export interface DrawnCard { id: string; reversed: boolean }
export interface Reading {
  id: number;
  personId: number | null;
  personName: string | null;
  question: string;
  spread: Spread;
  cards: DrawnCard[];
  interpretation: string | null;
  notes: string | null;
  createdAt: string;
}

interface Row { id: number; person_id: number | null; person_name: string | null; question: string; spread_json: string; cards_json: string; interpretation: string | null; notes: string | null; created_at: string }
const fromRow = (r: Row): Reading => ({
  id: r.id, personId: r.person_id, personName: r.person_name, question: r.question,
  spread: JSON.parse(r.spread_json), cards: JSON.parse(r.cards_json),
  interpretation: r.interpretation, notes: r.notes, createdAt: r.created_at,
});

export function saveReading(r: { personId: number | null; question: string; spread: Spread; cards: DrawnCard[]; interpretation: string | null; notes?: string | null }): number {
  return Number(db().prepare("INSERT INTO tarot_readings (person_id, question, spread_json, cards_json, interpretation, notes) VALUES (?, ?, ?, ?, ?, ?)")
    .run(r.personId, r.question, JSON.stringify(r.spread), JSON.stringify(r.cards), r.interpretation, r.notes ?? null).lastInsertRowid);
}

export function listReadings(limit = 100): Reading[] {
  return (db().prepare("SELECT t.*, p.name AS person_name FROM tarot_readings t LEFT JOIN people p ON p.id = t.person_id ORDER BY t.created_at DESC, t.id DESC LIMIT ?").all(limit) as Row[]).map(fromRow);
}

export function getReading(id: number): Reading | null {
  const r = db().prepare("SELECT t.*, p.name AS person_name FROM tarot_readings t LEFT JOIN people p ON p.id = t.person_id WHERE t.id = ?").get(id) as Row | undefined;
  return r ? fromRow(r) : null;
}

export function deleteReading(id: number) {
  db().prepare("DELETE FROM tarot_readings WHERE id = ?").run(id);
}

export function listCustomSpreads(): Spread[] {
  return (db().prepare("SELECT id, name, positions_json FROM tarot_spreads ORDER BY name").all() as { id: number; name: string; positions_json: string }[])
    .map((r) => customSpread(`custom-${r.id}`, r.name, JSON.parse(r.positions_json)));
}

export function saveCustomSpread(name: string, positions: { label: string; meaning: string }[]): number {
  return Number(db().prepare("INSERT INTO tarot_spreads (name, positions_json) VALUES (?, ?)").run(name, JSON.stringify(positions)).lastInsertRowid);
}

export function deleteCustomSpread(id: number) {
  db().prepare("DELETE FROM tarot_spreads WHERE id = ?").run(id);
}
