/**
 * Full-history IANA time zones for Luxon.
 *
 * Node's ICU (and therefore Luxon's default IANAZone) ships the *merged*
 * tz database, where since tzdata 2022b zones such as Europe/Amsterdam,
 * Europe/Oslo and Europe/Stockholm are aliases of a neighbour and their
 * pre-1970 history is gone. For birth charts that history matters, so we
 * load data/tz-history.json (built by scripts/build-tz-history.mjs from the
 * official IANA source *with* backzone) and expose it as a Luxon Zone.
 */
import fs from "node:fs";
import path from "node:path";
import { IANAZone, Zone, type ZoneOffsetFormat, type ZoneOffsetOptions } from "luxon";

interface ZoneRecord {
  /** [utcOffsetSeconds, isDst (0|1), abbreviation] */
  types: [number, number, string][];
  /** flattened [transitionUnixSeconds, typeIndex, …] */
  t: number[];
}
interface TzHistory {
  version: string;
  zones: Record<string, ZoneRecord>;
}

let cache: TzHistory | null = null;
function history(): TzHistory | null {
  if (cache) return cache;
  const file = process.env.TZ_HISTORY_PATH || path.join(process.cwd(), "data", "tz-history.json");
  try {
    cache = JSON.parse(fs.readFileSync(file, "utf8")) as TzHistory;
  } catch {
    console.warn(`[tz] ${file} not found — falling back to ICU time zones (pre-1970 data may be merged). Run: node scripts/build-tz-history.mjs`);
    cache = { version: "icu", zones: {} };
  }
  return cache;
}

export function tzdbVersion(): string {
  return history()?.version ?? "icu";
}

export interface ZoneState {
  /** minutes east of UTC */
  offset: number;
  isDst: boolean;
  /** e.g. "LMT", "AMT", "PWT", "BST" */
  abbr: string;
}

/** Explicit transitions run through 2037; beyond that the modern rules in ICU are used. */
const ICU_AFTER_MS = Date.UTC(2038, 0, 1);

export class HistoricalZone extends Zone<true> {
  private readonly zoneName: string;
  private readonly rec: ZoneRecord;
  private readonly icu: IANAZone;

  constructor(name: string, rec: ZoneRecord) {
    super();
    this.zoneName = name;
    this.rec = rec;
    this.icu = IANAZone.create(name);
  }

  get type(): string { return "iana-history"; }
  get name(): string { return this.zoneName; }
  get isUniversal(): boolean { return false; }
  get isValid(): true { return true; }

  stateAt(tsMs: number): ZoneState {
    const t = this.rec.t;
    if (tsMs >= ICU_AFTER_MS && this.icu.isValid) {
      const offset = this.icu.offset(tsMs);
      return { offset, isDst: false, abbr: this.icu.offsetName(tsMs, { format: "short" }) ?? "" };
    }
    const ts = tsMs / 1000;
    // binary search for the last transition ≤ ts
    let lo = 0, hi = t.length / 2 - 1, idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (t[mid * 2] <= ts) { idx = mid; lo = mid + 1; } else hi = mid - 1;
    }
    const [off, dst, abbr] = this.rec.types[idx < 0 ? 0 : t[idx * 2 + 1]];
    return { offset: off / 60, isDst: dst === 1, abbr };
  }

  offset(ts: number): number { return this.stateAt(ts).offset; }

  offsetName(ts: number, options: ZoneOffsetOptions): string {
    return options?.format === "long" ? this.zoneName : this.stateAt(ts).abbr;
  }

  formatOffset(ts: number, format: ZoneOffsetFormat): string {
    const o = this.offset(ts);
    const sign = o < 0 ? "-" : "+";
    const abs = Math.abs(o);
    const h = Math.floor(abs / 60), m = Math.floor(abs % 60);
    if (format === "narrow") return `${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
    if (format === "techie") return `${sign}${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}`;
    return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  equals(other: Zone): boolean {
    return other.type === this.type && other.name === this.name;
  }
}

const zoneCache = new Map<string, HistoricalZone | IANAZone>();

/** Full-history zone when available, otherwise Luxon's ICU-backed IANAZone. */
export function getZone(name: string): HistoricalZone | IANAZone {
  let z = zoneCache.get(name);
  if (z) return z;
  const rec = history()?.zones[name];
  z = rec ? new HistoricalZone(name, rec) : IANAZone.create(name);
  zoneCache.set(name, z);
  return z;
}

export function isHistoricalZone(z: Zone): z is HistoricalZone {
  return z instanceof HistoricalZone;
}
