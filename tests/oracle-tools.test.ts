import { beforeAll, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// Use a throwaway database — never the real data/celestial.db.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "oracle-test-"));
process.env.DATABASE_PATH = path.join(tmp, "test.db");

import { createPerson } from "@/lib/db/people";
import { runTool, ORACLE_TOOLS } from "@/lib/ai/tools";
import { buildThreadSystem, refreshText } from "@/lib/ai/chat-context";
import { toDisplay } from "@/lib/ai/chat-display";

let jobsId = 0;
const ctx = () => ({ timezone: "UTC", personId: jobsId });

beforeAll(() => {
  jobsId = createPerson({
    name: "Steve Jobs", fullBirthName: "Steven Paul Jobs", birthDate: "1955-02-24", birthTime: "19:15",
    placeName: "San Francisco", lat: 37 + 47 / 60, lon: -(122 + 25 / 60), houseSystem: "P",
  }).id;
});

describe("Oracle tools", () => {
  it("every tool is declared with eager input streaming and a schema", () => {
    expect(ORACLE_TOOLS.length).toBe(9);
    for (const t of ORACLE_TOOLS) {
      expect((t as { eager_input_streaming?: boolean }).eager_input_streaming).toBe(true);
      expect((t as { input_schema?: unknown }).input_schema).toBeDefined();
    }
  });

  it("rejects invalid input instead of guessing", async () => {
    const r = await runTool("find_aspect_dates", { transiting: "saturn", aspect: "squareish", start: "2026", end: "2027" }, ctx());
    expect(r.isError).toBe(true);
    expect(r.content).toMatch(/INVALID_INPUT/);
  });

  it("get_positions matches astro.com for the Jobs moment and gives natal houses", async () => {
    const r = await runTool("get_positions", { datetime: "1955-02-25T03:15:00Z", person_id: jobsId }, ctx());
    expect(r.isError).toBeFalsy();
    expect(r.content).toContain(`Sun: 5°44'53" Pisces`);
    expect(r.content).toContain(`Moon: 7°44'50" Aries`);
    expect(r.content).toMatch(/Sun: .* natal house 6/);
  });

  it("find_aspect_dates finds Jobs's first Saturn return", async () => {
    const r = await runTool("find_aspect_dates", { transiting: "saturn", aspect: "conjunction", natal_point: "saturn", person_id: jobsId, start: "1983-01-01", end: "1986-12-31" }, ctx());
    expect(r.isError).toBeFalsy();
    expect(r.content).toMatch(/exact .*198[45]/);
  });

  it("find_ingresses_and_stations reproduces Saturn's 2025–26 Aries ingress sequence", async () => {
    const r = await runTool("find_ingresses_and_stations", { body: "saturn", start: "2025-01-01", end: "2026-12-31" }, ctx());
    const lines = r.content.split("\n");
    const aries = lines.filter((l) => l.includes("Saturn enters Aries"));
    expect(aries).toHaveLength(2);
    expect(aries[0]).toContain("May 2025");
    expect(aries[1]).toContain("Feb 2026");
    expect(lines.some((l) => l.includes("Sep 2025") && l.includes("enters Pisces (retrograde"))).toBe(true);
    expect(lines.some((l) => l.includes("stations retrograde (SR)"))).toBe(true);
  });

  it("transits, progressions, profection and numerology all answer", async () => {
    for (const [tool, input] of [
      ["get_transits", { person_id: jobsId, datetime: "2026-10-02T12:00:00Z" }],
      ["get_progressions", { person_id: jobsId, date: "2026-10-02" }],
      ["get_profection", { person_id: jobsId, date: "2026-10-02" }],
      ["get_numerology", { person_id: jobsId, date: "2026-10-02" }],
      ["list_people", {}],
      ["get_natal_chart", { person_id: jobsId }],
    ] as const) {
      const r = await runTool(tool, input, ctx());
      expect(r.isError, `${tool}: ${r.content}`).toBeFalsy();
      expect(r.content.length).toBeGreaterThan(20);
    }
    const prof = await runTool("get_profection", { person_id: jobsId, date: "2026-10-02" }, ctx());
    expect(prof.content).toContain("12th house year");
    expect(prof.content).toContain("Lord of the Year: Sun");
  });
});

describe("Oracle context", () => {
  it("builds a frozen two-block system with the natal chart and today's data", () => {
    const now = new Date("2026-10-02T19:00:00Z");
    const person = { id: jobsId, name: "Steve Jobs", fullBirthName: "Steven Paul Jobs", birthDate: "1955-02-24", birthTime: "19:15", placeName: "San Francisco", lat: 37.7833, lon: -122.4167, tz: "America/Los_Angeles", utcOffsetOverride: null, houseSystem: "P" as const, notes: null, source: "manual", createdAt: "", updatedAt: "" };
    const sys = buildThreadSystem(person, now, "America/Los_Angeles");
    expect(sys).toHaveLength(2);
    expect(sys[1].cache_control).toEqual({ type: "ephemeral" });
    expect(sys[1].text).toContain("NATAL CHART — Steve Jobs");
    expect(sys[1].text).toContain("TRANSITS TO THE NATAL CHART NOW");
    expect(sys[1].text).toContain("ANNUAL PROFECTION");
    expect(sys[1].text).toContain("Life Path");
    // Deterministic for the same inputs (required for byte-identical replay)
    expect(JSON.stringify(buildThreadSystem(person, now, "America/Los_Angeles"))).toBe(JSON.stringify(sys));
    expect(refreshText(person, now, "America/Los_Angeles")).toMatch(/^Updated context/);
  });

  it("turns stored API messages into display items, grouping tool rounds", () => {
    const items = toDisplay([
      { kind: "user", message: { role: "user", content: [{ type: "text", text: "When is my Saturn return?" }] } },
      { kind: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Let me check." }, { type: "tool_use", id: "t1", name: "find_aspect_dates", input: { transiting: "saturn", aspect: "conjunction", natal_point: "saturn", start: "2020-01-01", end: "2030-01-01" } }] } },
      { kind: "tool_result", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "…" }] } },
      { kind: "assistant", message: { role: "assistant", content: [{ type: "thinking", thinking: "", signature: "x" }, { type: "text", text: "It perfects in 2027." }] } },
    ] as never);
    expect(items).toHaveLength(2);
    expect(items[1].role).toBe("assistant");
    expect(items[1].tools).toEqual(["Searched Saturn conjunction natal Saturn (2020-01-01 → 2030-01-01)"]);
    expect(items[1].text).toBe("Let me check.\n\nIt perfects in 2027.");
  });
});
