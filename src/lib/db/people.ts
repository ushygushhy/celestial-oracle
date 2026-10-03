import { z } from "zod";
import { db } from "./index";
import { HOUSE_SYSTEMS, type HouseSystem } from "../astro/ephemeris";
import { lookupTimezone } from "../astro/time";

export interface Person {
  id: number;
  name: string;
  fullBirthName: string | null;
  birthDate: string;
  birthTime: string | null;
  placeName: string;
  lat: number;
  lon: number;
  tz: string;
  utcOffsetOverride: number | null;
  houseSystem: HouseSystem;
  notes: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

interface PersonRow {
  id: number;
  name: string;
  full_birth_name: string | null;
  birth_date: string;
  birth_time: string | null;
  place_name: string;
  lat: number;
  lon: number;
  tz: string;
  utc_offset_override: number | null;
  house_system: string;
  notes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

const fromRow = (r: PersonRow): Person => ({
  id: r.id,
  name: r.name,
  fullBirthName: r.full_birth_name,
  birthDate: r.birth_date,
  birthTime: r.birth_time,
  placeName: r.place_name,
  lat: r.lat,
  lon: r.lon,
  tz: r.tz,
  utcOffsetOverride: r.utc_offset_override,
  houseSystem: (r.house_system in HOUSE_SYSTEMS ? r.house_system : "P") as HouseSystem,
  notes: r.notes,
  source: r.source,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const PersonInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  fullBirthName: z.string().trim().max(200).nullish(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  birthTime: z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/, "Use HH:mm").nullish(),
  placeName: z.string().trim().min(1, "Birth place is required").max(300),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  tz: z.string().trim().min(1).nullish(),
  utcOffsetOverride: z.number().min(-16 * 60).max(16 * 60).nullish(),
  houseSystem: z.enum(Object.keys(HOUSE_SYSTEMS) as [HouseSystem, ...HouseSystem[]]).default("P"),
  notes: z.string().max(5000).nullish(),
  source: z.string().max(40).optional(),
});
export type PersonInput = z.infer<typeof PersonInputSchema>;

export function listPeople(): Person[] {
  return (db().prepare("SELECT * FROM people ORDER BY name COLLATE NOCASE").all() as PersonRow[]).map(fromRow);
}

export function getPerson(id: number): Person | null {
  const row = db().prepare("SELECT * FROM people WHERE id = ?").get(id) as PersonRow | undefined;
  return row ? fromRow(row) : null;
}

export function createPerson(input: PersonInput): Person {
  const tz = input.tz || lookupTimezone(input.lat, input.lon);
  const info = db()
    .prepare(
      `INSERT INTO people (name, full_birth_name, birth_date, birth_time, place_name, lat, lon, tz, utc_offset_override, house_system, notes, source)
       VALUES (@name, @fullBirthName, @birthDate, @birthTime, @placeName, @lat, @lon, @tz, @utcOffsetOverride, @houseSystem, @notes, @source)`,
    )
    .run({
      name: input.name,
      fullBirthName: input.fullBirthName ?? null,
      birthDate: input.birthDate,
      birthTime: input.birthTime || null,
      placeName: input.placeName,
      lat: input.lat,
      lon: input.lon,
      tz,
      utcOffsetOverride: input.utcOffsetOverride ?? null,
      houseSystem: input.houseSystem,
      notes: input.notes ?? null,
      source: input.source ?? "manual",
    });
  return getPerson(Number(info.lastInsertRowid))!;
}

export function updatePerson(id: number, input: PersonInput): Person | null {
  const tz = input.tz || lookupTimezone(input.lat, input.lon);
  db()
    .prepare(
      `UPDATE people SET name=@name, full_birth_name=@fullBirthName, birth_date=@birthDate, birth_time=@birthTime,
         place_name=@placeName, lat=@lat, lon=@lon, tz=@tz, utc_offset_override=@utcOffsetOverride,
         house_system=@houseSystem, notes=@notes, updated_at=datetime('now')
       WHERE id=@id`,
    )
    .run({
      id,
      name: input.name,
      fullBirthName: input.fullBirthName ?? null,
      birthDate: input.birthDate,
      birthTime: input.birthTime || null,
      placeName: input.placeName,
      lat: input.lat,
      lon: input.lon,
      tz,
      utcOffsetOverride: input.utcOffsetOverride ?? null,
      houseSystem: input.houseSystem,
      notes: input.notes ?? null,
    });
  db().prepare("DELETE FROM chart_snapshots WHERE person_id = ?").run(id);
  db().prepare("DELETE FROM interpretations WHERE person_id = ?").run(id);
  return getPerson(id);
}

export function deletePerson(id: number): boolean {
  return db().prepare("DELETE FROM people WHERE id = ?").run(id).changes > 0;
}

/** Birth data in the shape the astro engine expects. */
export function personToChartInput(p: Person) {
  return {
    name: p.name,
    placeName: p.placeName,
    date: p.birthDate,
    time: p.birthTime,
    lat: p.lat,
    lon: p.lon,
    tz: p.tz,
    utcOffsetMinutes: p.utcOffsetOverride,
  };
}
