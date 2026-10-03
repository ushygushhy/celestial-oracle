/**
 * Birth-time → UTC → Julian Day conversion.
 *
 * Accuracy rules (these mirror what astro.com does):
 *  1. The timezone is the IANA zone for the location, resolved with the FULL
 *     historical boundary set (geo-tz/all). The default geo-tz build merges
 *     zones that have only agreed since 1970, which silently breaks older
 *     births (e.g. Amsterdam pre-1940, Oslo, Stockholm).
 *  2. The UTC offset is the one in force ON THAT DATE (DST, war time, double
 *     summer time, historical zone changes) — read from the IANA tz database
 *     compiled WITH backzone (see tz.ts; Node's ICU copy has lost pre-1970
 *     history for many European zones).
 *  3. Before a region adopted standard time, the tz database only knows the
 *     LMT of the zone's reference city. Astrologers use the LMT of the birth
 *     place itself (longitude × 4 min), so we substitute that.
 *  4. Non-existent (spring-forward gap) and repeated (fall-back) local times
 *     are detected and reported rather than silently guessed.
 */
import type { IANAZone } from "luxon";
import { find as findTimezones } from "geo-tz/all";
import { swe, C } from "./ephemeris";
import { getZone, isHistoricalZone, tzdbVersion, type HistoricalZone } from "./tz";

export interface BirthMoment {
  /** YYYY-MM-DD (local civil date at birthplace) */
  date: string;
  /** HH:mm or HH:mm:ss local clock time; null when unknown */
  time: string | null;
  lat: number;
  lon: number;
  /** IANA zone; looked up from coordinates when omitted */
  tz?: string | null;
  /** Manual override, minutes EAST of UTC (e.g. -300 for EST). Skips all tz rules. */
  utcOffsetMinutes?: number | null;
}

export type OffsetSource = "iana" | "lmt" | "override";

export interface ResolvedMoment {
  tz: string;
  /** Minutes east of UTC actually applied (may be fractional for LMT) */
  offsetMinutes: number;
  offsetSource: OffsetSource;
  /** e.g. "UTC−07:00", or "UTC+00:40:00" (seconds shown for LMT) */
  offsetLabel: string;
  /** Zone abbreviation in force, e.g. "PWT", "BST", "AMT", "LMT" */
  abbreviation: string;
  isDst: boolean;
  /** IANA tz database release used */
  tzdbVersion: string;
  /** ISO-8601 UTC instant */
  utcIso: string;
  jdUt: number;
  jdEt: number;
  timeUnknown: boolean;
  ambiguity: "none" | "gap" | "overlap";
  warnings: string[];
}

export function lookupTimezone(lat: number, lon: number): string {
  const zones = findTimezones(lat, lon);
  return zones[0] ?? "Etc/UTC";
}

function parseDate(date: string): [number, number, number] {
  const m = /^(-?\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
  if (!m) throw new Error(`Invalid date "${date}" (expected YYYY-MM-DD)`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function parseTime(time: string): [number, number, number] {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(time.trim());
  if (!m) throw new Error(`Invalid time "${time}" (expected HH:mm or HH:mm:ss)`);
  const h = Number(m[1]), min = Number(m[2]), s = m[3] ? Number(m[3]) : 0;
  if (h > 23 || min > 59 || s >= 60) throw new Error(`Time out of range: ${time}`);
  return [h, min, s];
}

/** Wall-clock components interpreted as if UTC → epoch ms. Safe for years < 100. */
function wallClockMs(y: number, mo: number, d: number, h: number, mi: number, s: number): number {
  const dt = new Date(0);
  dt.setUTCFullYear(y, mo - 1, d);
  dt.setUTCHours(h, mi, 0, 0);
  return dt.getTime() + s * 1000;
}

export function formatOffset(minutes: number, withSeconds = false): string {
  const sign = minutes < 0 ? "−" : "+";
  const totalSec = Math.round(Math.abs(minutes) * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const base = `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return withSeconds || s ? `${base}:${String(s).padStart(2, "0")}` : base;
}

type AnyZone = HistoricalZone | IANAZone;

/**
 * Is this instant in the zone's Local Mean Time era (before standard time)?
 * With the full-history data the tz database labels it "LMT" explicitly.
 * For ICU-only zones we fall back to a heuristic: the offset equals the 1700
 * offset and is not a whole quarter-hour.
 */
function isLmtEra(zone: AnyZone, utcMs: number): boolean {
  if (isHistoricalZone(zone)) return zone.stateAt(utcMs).abbr === "LMT";
  const earliest = zone.offset(wallClockMs(1700, 1, 1, 0, 0, 0));
  const now = zone.offset(utcMs);
  const quarterHour = Math.abs((earliest * 60) % 900) < 1e-6;
  return !quarterHour && Math.abs(now - earliest) < 1e-9;
}

function zoneAbbr(zone: AnyZone, utcMs: number): string {
  if (isHistoricalZone(zone)) return zone.stateAt(utcMs).abbr;
  return zone.offsetName(utcMs, { format: "short" }) ?? "";
}

function isDstAt(zone: AnyZone, utcMs: number, offset: number): boolean {
  if (isHistoricalZone(zone)) return zone.stateAt(utcMs).isDst;
  // ICU fallback: DST ⇔ offset larger than the smaller of the Jan/Jul offsets that year.
  const y = new Date(utcMs).getUTCFullYear();
  const jan = zone.offset(wallClockMs(y, 1, 1, 12, 0, 0));
  const jul = zone.offset(wallClockMs(y, 7, 1, 12, 0, 0));
  return offset > Math.min(jan, jul) + 1e-9;
}

export function resolveMoment(input: BirthMoment): ResolvedMoment {
  const warnings: string[] = [];
  const [Y, M, D] = parseDate(input.date);
  const timeUnknown = !input.time;
  const [h, mi, s] = timeUnknown ? [12, 0, 0] : parseTime(input.time!);
  const tz = input.tz || lookupTimezone(input.lat, input.lon);
  const zone = getZone(tz);
  if (!zone.isValid) throw new Error(`Unknown timezone "${tz}"`);

  const wall = wallClockMs(Y, M, D, h, mi, s);
  let offset: number;
  let source: OffsetSource = "iana";
  let ambiguity: ResolvedMoment["ambiguity"] = "none";

  if (input.utcOffsetMinutes !== undefined && input.utcOffsetMinutes !== null) {
    offset = input.utcOffsetMinutes;
    source = "override";
  } else {
    // Candidate offsets around this wall time; a candidate is valid if
    // converting with it lands on an instant where the zone has that offset.
    const day = 86_400_000;
    const probes = [zone.offset(wall - day), zone.offset(wall), zone.offset(wall + day)];
    const candidates = [...new Set(probes.map((o) => zone.offset(wall - o * 60_000)).concat(probes))];
    const valid = candidates.filter((o) => Math.abs(zone.offset(wall - o * 60_000) - o) < 1e-9);
    const uniqueValid = [...new Set(valid)].sort((a, b) => b - a);
    if (uniqueValid.length === 1) {
      offset = uniqueValid[0];
    } else if (uniqueValid.length > 1) {
      ambiguity = "overlap";
      offset = uniqueValid[0]; // first occurrence (daylight time, before clocks fell back)
      warnings.push(
        `This local time occurred twice (clocks were set back). Assumed the first occurrence (UTC${formatOffset(uniqueValid[0])}); the second would be UTC${formatOffset(uniqueValid[1])}. Use a manual UTC offset to choose.`,
      );
    } else {
      ambiguity = "gap";
      offset = zone.offset(wall - day); // clock time before the jump
      warnings.push(
        `This local time did not exist (clocks sprang forward). Interpreted with the pre-change offset UTC${formatOffset(offset)}. Verify the recorded time.`,
      );
    }

    if (isLmtEra(zone, wall - offset * 60_000)) {
      const lmt = input.lon * 4; // 1° of longitude = 4 minutes of time
      warnings.push(
        `Before standard time was adopted here, so Local Mean Time for the birthplace (${input.lon.toFixed(2)}° → ${formatOffset(lmt, true)}) is used instead of the tz database's ${tz} reference LMT (${formatOffset(offset, true)}).`,
      );
      offset = lmt;
      source = "lmt";
    }
  }

  const utcMs = wall - offset * 60_000;
  const u = new Date(utcMs);
  const sec = u.getUTCSeconds() + u.getUTCMilliseconds() / 1000;
  const gregorian = utcMs >= wallClockMs(1582, 10, 15, 0, 0, 0);
  const jd = swe().utc_to_jd(
    u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate(),
    u.getUTCHours(), u.getUTCMinutes(), sec,
    gregorian ? C.SE_GREG_CAL : C.SE_JUL_CAL,
  );
  if (jd.flag < 0) throw new Error(`Julian day conversion failed: ${jd.error}`);

  const isDst = source === "iana" ? isDstAt(zone, utcMs, offset) : false;
  const abbreviation = source === "iana" ? zoneAbbr(zone, utcMs) : source === "lmt" ? "LMT" : "";
  if (timeUnknown) {
    warnings.push("Birth time unknown: using a 12:00 noon chart. Houses and angles are not shown, and the Moon's degree may be off by up to ±7°.");
  }

  return {
    tz,
    offsetMinutes: offset,
    offsetSource: source,
    offsetLabel: `UTC${formatOffset(offset, source === "lmt")}`,
    abbreviation,
    isDst,
    tzdbVersion: tzdbVersion(),
    utcIso: u.toISOString(),
    jdUt: jd.data[1],
    jdEt: jd.data[0],
    timeUnknown,
    ambiguity,
    warnings,
  };
}

/** Julian Day (UT) for a JS Date. */
export function jdFromDate(d: Date): number {
  const r = swe().utc_to_jd(
    d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds() + d.getUTCMilliseconds() / 1000,
    C.SE_GREG_CAL,
  );
  if (r.flag < 0) throw new Error(r.error);
  return r.data[1];
}

/** JS Date for a Julian Day (UT). */
export function dateFromJd(jdUt: number): Date {
  // JD 2440587.5 = 1970-01-01T00:00:00Z
  return new Date(Math.round((jdUt - 2440587.5) * 86_400_000));
}
