#!/usr/bin/env node
/**
 * Builds data/tz-history.json — full-history IANA time zone transitions,
 * INCLUDING the pre-1970 "backzone" data that Node's ICU, moment-timezone and
 * the tzdata npm packages all drop (since tzdata 2022b, e.g. Europe/Amsterdam
 * became an alias of Europe/Brussels, erasing Amsterdam Mean Time).
 *
 * Steps (all from the official IANA distribution):
 *   1. download tzdata + tzcode from data.iana.org
 *   2. `make PACKRATDATA=backzone PACKRATLIST=zone.tab tzdata.zi zic`
 *   3. compile with IANA's zic (-b fat → explicit transitions through 2037)
 *   4. parse every TZif file into JSON
 *
 * Usage:  node scripts/build-tz-history.mjs [version]     (default: latest)
 *         node scripts/build-tz-history.mjs --from <dir-with-compiled-zoneinfo> [version]
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
let zoneinfoDir = null;
let version = "latest";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--from") zoneinfoDir = args[++i];
  else version = args[i];
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outFile = path.join(root, "data", "tz-history.json");

if (!zoneinfoDir) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "tzdb-"));
  const base = "https://data.iana.org/time-zones/releases";
  const dataUrl = version === "latest" ? "https://data.iana.org/time-zones/tzdata-latest.tar.gz" : `${base}/tzdata${version}.tar.gz`;
  const codeUrl = version === "latest" ? "https://data.iana.org/time-zones/tzcode-latest.tar.gz" : `${base}/tzcode${version}.tar.gz`;
  console.log(`Downloading IANA tzdb (${version}) into ${work}`);
  execSync(`curl -fsSL -o tzdata.tar.gz ${dataUrl} && curl -fsSL -o tzcode.tar.gz ${codeUrl}`, { cwd: work, stdio: "inherit" });
  execSync("tar xzf tzdata.tar.gz && tar xzf tzcode.tar.gz", { cwd: work, stdio: "inherit" });
  execSync("make PACKRATDATA=backzone PACKRATLIST=zone.tab tzdata.zi zic", { cwd: work, stdio: "inherit" });
  execSync("./zic -b fat -d zoneinfo tzdata.zi", { cwd: work, stdio: "inherit" });
  version = fs.readFileSync(path.join(work, "version"), "utf8").trim();
  zoneinfoDir = path.join(work, "zoneinfo");
}

/** Parse a TZif (RFC 8536) file, returning the 64-bit (v2+) data block. */
function parseTzif(buf) {
  if (buf.toString("ascii", 0, 4) !== "TZif") return null;
  const header = (off) => ({
    version: buf[off + 4],
    isutcnt: buf.readUInt32BE(off + 20),
    isstdcnt: buf.readUInt32BE(off + 24),
    leapcnt: buf.readUInt32BE(off + 28),
    timecnt: buf.readUInt32BE(off + 32),
    typecnt: buf.readUInt32BE(off + 36),
    charcnt: buf.readUInt32BE(off + 40),
  });
  const h1 = header(0);
  const v1len = h1.timecnt * 4 + h1.timecnt + h1.typecnt * 6 + h1.charcnt + h1.leapcnt * 8 + h1.isstdcnt + h1.isutcnt;
  let off = 44 + v1len;
  if (h1.version < 0x32) throw new Error("TZif v1 not supported");
  const h = header(off);
  off += 44;
  const times = [];
  for (let i = 0; i < h.timecnt; i++) times.push(Number(buf.readBigInt64BE(off + i * 8)));
  off += h.timecnt * 8;
  const idx = [];
  for (let i = 0; i < h.timecnt; i++) idx.push(buf[off + i]);
  off += h.timecnt;
  const types = [];
  for (let i = 0; i < h.typecnt; i++) {
    const o = off + i * 6;
    types.push({ utoff: buf.readInt32BE(o), isdst: buf[o + 4], desig: buf[o + 5] });
  }
  off += h.typecnt * 6;
  const chars = buf.toString("ascii", off, off + h.charcnt);
  const abbr = (i) => chars.slice(i, chars.indexOf("\0", i));
  return {
    types: types.map((t) => [t.utoff, t.isdst, abbr(t.desig)]),
    transitions: times.map((t, i) => [t, idx[i]]),
  };
}

const SKIP = new Set(["posix", "right", "posixrules", "Factory", "localtime"]);
const zones = {};
const walk = (dir, prefix = "") => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name) || ent.name.endsWith(".tab") || ent.name.endsWith(".zi")) continue;
    const full = path.join(dir, ent.name);
    const name = prefix ? `${prefix}/${ent.name}` : ent.name;
    if (ent.isDirectory()) walk(full, name);
    else {
      const parsed = parseTzif(fs.readFileSync(full));
      if (!parsed) continue;
      // keep transitions up to 2040; later dates fall back to ICU (identical modern rules)
      const LIMIT = Date.UTC(2040, 0, 1) / 1000;
      const transitions = parsed.transitions.filter(([t]) => t < LIMIT);
      // de-duplicate types actually referenced (type 0 is used before the first transition)
      const used = [...new Set([0, ...transitions.map(([, i]) => i)])].sort((a, b) => a - b);
      const remap = new Map(used.map((u, k) => [u, k]));
      zones[name] = {
        types: used.map((u) => parsed.types[u]),
        // flatten: [t0, i0, t1, i1, ...] for compactness
        t: transitions.flatMap(([t, i]) => [t, remap.get(i)]),
      };
    }
  }
};
walk(zoneinfoDir);

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ version, source: "IANA tzdb with backzone (PACKRATLIST=zone.tab), compiled by zic -b fat", zones }));
const size = (fs.statSync(outFile).size / 1024).toFixed(0);
console.log(`Wrote ${Object.keys(zones).length} zones (tzdb ${version}) → ${path.relative(root, outFile)} (${size} KB)`);
