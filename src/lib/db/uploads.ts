import { db } from "./index";
import type { Extraction } from "../upload/schema";

export interface UploadedChart { id: number; personId: number | null; label: string; source: string | null; data: Extraction; createdAt: string }
interface Row { id: number; person_id: number | null; label: string; source: string | null; data_json: string; created_at: string }
const fromRow = (r: Row): UploadedChart => ({ id: r.id, personId: r.person_id, label: r.label, source: r.source, data: JSON.parse(r.data_json), createdAt: r.created_at });

export function saveUpload(label: string, data: Extraction, personId: number | null = null): number {
  return Number(db().prepare("INSERT INTO uploaded_charts (person_id, label, source, data_json) VALUES (?, ?, ?, ?)").run(personId, label, data.source, JSON.stringify(data)).lastInsertRowid);
}
export function getUpload(id: number): UploadedChart | null {
  const r = db().prepare("SELECT * FROM uploaded_charts WHERE id = ?").get(id) as Row | undefined;
  return r ? fromRow(r) : null;
}
export function listUploads(): UploadedChart[] {
  return (db().prepare("SELECT * FROM uploaded_charts ORDER BY created_at DESC, id DESC").all() as Row[]).map(fromRow);
}
export function deleteUpload(id: number) {
  db().prepare("DELETE FROM uploaded_charts WHERE id = ?").run(id);
}
