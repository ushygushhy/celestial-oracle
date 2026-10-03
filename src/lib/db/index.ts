/**
 * Local SQLite store (better-sqlite3). Synchronous, single file, no server.
 * Location: data/celestial.db (override with DATABASE_PATH).
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS people (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     full_birth_name TEXT,
     birth_date TEXT NOT NULL,
     birth_time TEXT,
     place_name TEXT NOT NULL,
     lat REAL NOT NULL,
     lon REAL NOT NULL,
     tz TEXT NOT NULL,
     utc_offset_override REAL,
     house_system TEXT NOT NULL DEFAULT 'P',
     notes TEXT,
     source TEXT NOT NULL DEFAULT 'manual',
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE IF NOT EXISTS chart_snapshots (
     person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
     settings_key TEXT NOT NULL,
     json TEXT NOT NULL,
     computed_at TEXT NOT NULL DEFAULT (datetime('now')),
     PRIMARY KEY (person_id, settings_key)
   );
   CREATE TABLE IF NOT EXISTS geocode_cache (
     query TEXT PRIMARY KEY,
     json TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE IF NOT EXISTS interpretations (
     key TEXT PRIMARY KEY,
     person_id INTEGER REFERENCES people(id) ON DELETE CASCADE,
     kind TEXT NOT NULL,
     subject TEXT NOT NULL,
     text TEXT NOT NULL,
     model TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE IF NOT EXISTS app_settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );`,
  // v2: Oracle chat. Messages are stored exactly as sent to / returned by the API
  // (append-only) so conversations can be replayed byte-for-byte.
  `CREATE TABLE IF NOT EXISTS chat_threads (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
     title TEXT NOT NULL DEFAULT 'New conversation',
     system_json TEXT NOT NULL,
     context_at TEXT NOT NULL,
     timezone TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE IF NOT EXISTS chat_messages (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     thread_id INTEGER NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
     role TEXT NOT NULL,
     content_json TEXT NOT NULL,
     kind TEXT NOT NULL DEFAULT 'message',
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE INDEX IF NOT EXISTS chat_messages_thread ON chat_messages(thread_id, id);`,
  // v3: tarot journal, custom spreads, uploaded charts
  `CREATE TABLE IF NOT EXISTS tarot_readings (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
     question TEXT NOT NULL DEFAULT '',
     spread_json TEXT NOT NULL,
     cards_json TEXT NOT NULL,
     interpretation TEXT,
     notes TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE IF NOT EXISTS tarot_spreads (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     positions_json TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE IF NOT EXISTS uploaded_charts (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
     label TEXT NOT NULL,
     source TEXT,
     data_json TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );`,
];

type Db = Database.Database;
const g = globalThis as unknown as { __celestialDb?: Db };
// Module-level so that a hot reload re-checks migrations against a cached connection.
let migrated = false;

function migrate(conn: Db) {
  const version = conn.pragma("user_version", { simple: true }) as number;
  for (let v = version; v < MIGRATIONS.length; v++) {
    conn.transaction(() => {
      conn.exec(MIGRATIONS[v]);
      conn.pragma(`user_version = ${v + 1}`);
    })();
  }
  migrated = true;
}

export function db(): Db {
  let conn = g.__celestialDb;
  if (!conn) {
    const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "celestial.db");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    conn = new Database(file);
    conn.pragma("journal_mode = WAL");
    conn.pragma("foreign_keys = ON");
    g.__celestialDb = conn;
  }
  if (!migrated) migrate(conn);
  return conn;
}
