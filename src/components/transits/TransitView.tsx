"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TransitReport, ReportEvent } from "@/lib/services/transit-service";
import type { NatalChart } from "@/lib/astro/chart";
import { ASPECTS, POINTS } from "@/lib/astro/constants";
import { formatArc } from "@/lib/astro/math";
import { ordinal } from "@/lib/astro/patterns";
import { aspectColor } from "@/lib/design/tokens";
import { Frame, Panel } from "../ui/Frame";
import { LocalTime } from "../ui/LocalTime";
import { PointGlyph, AspectGlyph } from "../chart/Glyph";
import { Position } from "../chart/ChartTables";
import { InterpretationPanel, type InterpretRequest } from "../chart/InterpretationPanel";
import { TransitTimeline } from "./TransitTimeline";
import { Sparkle } from "../ui/Ornaments";
import { askOracle } from "../chat/OracleChat";

const anchorIso = (e: ReportEvent) => e.hits[0]?.iso ?? e.nearMisses[0]?.iso ?? e.entersIso ?? e.leavesIso ?? new Date().toISOString();

function TransitLabel({ e }: { e: ReportEvent }) {
  return (
    <span className="whitespace-nowrap">
      <PointGlyph id={e.transiting} className="text-accent-bright" /> {POINTS[e.transiting].name}{" "}
      <AspectGlyph type={e.aspect} /> <span className="text-muted">{ASPECTS[e.aspect].name.toLowerCase()}</span>{" "}
      natal <PointGlyph id={e.natal} className="text-accent-bright" /> {POINTS[e.natal].name}
    </span>
  );
}

export function TransitView({ personId, natal, report, query }: { personId: number; natal: NatalChart; report: TransitReport; query: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ReportEvent | null>(null);
  const setParam = (k: string, v: string | null) => {
    const q = new URLSearchParams(query);
    if (v === null) q.delete(k); else q.set(k, v);
    router.push(`/transits/${personId}${q.toString() ? `?${q}` : ""}`);
  };
  const o = report.options;

  // One card per heavy transit, merging all of its windows (retrograde cycles can split it in two or three).
  const heavy = useMemo(() => {
    const groups = new Map<string, ReportEvent[]>();
    for (const e of report.events) {
      if (!e.heavy) continue;
      const k = `${e.transiting}|${e.aspect}|${e.natal}`;
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    return [...groups.values()].map((evs) => ({
      event: evs.find((e) => e.hits.length) ?? evs[0],
      hits: evs.flatMap((e) => e.hits),
      misses: evs.flatMap((e) => e.nearMisses),
      enters: evs[0].entersIso,
      leaves: evs[evs.length - 1].leavesIso,
    }));
  }, [report.events]);
  const eclipseHits = report.eclipses.filter((e) => e.contacts.length);

  const request: InterpretRequest | null = selected
    ? { personId, target: { kind: "transit", transiting: selected.transiting, aspect: selected.aspect, natal: selected.natal, date: anchorIso(selected) } }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="engraved text-[0.65rem] text-faint">Transits</p>
          <h1 className="font-masthead text-3xl font-bold tracking-wide">{natal.name}</h1>
          <p className="headline-italic mt-1 text-sm font-normal text-muted">
            <LocalTime iso={report.startIso} mode="date" /> → <LocalTime iso={report.endIso} mode="date" /> · {report.events.length} transit windows
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select className="field w-auto py-1.5" value={o.months} onChange={(e) => setParam("months", e.target.value)} aria-label="Window">
            {[3, 6, 12, 18, 24, 36].map((m) => <option key={m} value={m}>Next {m} months</option>)}
          </select>
          <select className="field w-auto py-1.5" value={o.orbScale === 0.5 ? "tight" : o.orbScale === 1.5 ? "wide" : "std"} onChange={(e) => setParam("orb", e.target.value === "std" ? null : e.target.value)} aria-label="Orbs">
            <option value="tight">Tight orbs</option>
            <option value="std">Standard orbs</option>
            <option value="wide">Wide orbs</option>
          </select>
          <button className={`chip ${o.fast ? "!border-[color:var(--rule-strong)] text-text" : "opacity-60"}`} onClick={() => setParam("fast", o.fast ? null : "1")}>Sun · Mercury · Venus</button>
          <button className={`chip ${o.minor ? "!border-[color:var(--rule-strong)] text-text" : "opacity-60"}`} onClick={() => setParam("minor", o.minor ? null : "1")}>Minor aspects</button>
          <button className="btn" onClick={() => askOracle({ text: "Give me an overview of my most important transits for the coming months, in order of significance, with their exact dates.", personId })}>
            <Sparkle size={9} /> Ask for an overview
          </button>
        </div>
      </div>

      <Frame title="In effect now" subtitle="Every transit currently within orb, tightest first. Click any row for an interpretation.">
        <div className="overflow-x-auto">
          <table className="table-almanac text-[0.92rem]">
            <thead>
              <tr><th>Transit</th><th>Transiting position</th><th>Natal point</th><th>Orb now</th><th>Phase</th><th>Exact</th><th>Window</th></tr>
            </thead>
            <tbody>
              {report.current.map((e) => {
                const n = natal.points[e.natal];
                return (
                  <tr key={e.key} className="cursor-pointer" onClick={() => setSelected(e)}>
                    <td>
                      <TransitLabel e={e} />
                      {e.heavy && <span className="chip ml-2 !py-0 text-[0.6rem] text-accent-bright">✦ {e.heavyReason}</span>}
                    </td>
                    <td className="whitespace-nowrap text-muted">{e.now ? <><Position lon={e.now.lon} />{e.now.retrograde ? " ℞" : ""}</> : "—"}</td>
                    <td className="whitespace-nowrap">{n ? <><Position lon={n.lon} />{n.house ? <span className="text-faint"> · {ordinal(n.house)}</span> : null}</> : "—"}</td>
                    <td className="num">{e.now ? formatArc(e.now.orb) : "—"}</td>
                    <td className="text-muted">{e.now ? (e.now.applying ? "applying" : "separating") : "—"}</td>
                    <td className="whitespace-nowrap text-sm">{e.hits.length ? e.hits.map((h) => <div key={h.iso}><LocalTime iso={h.iso} mode="date" />{h.retrograde ? " ℞" : ""}</div>) : <span className="text-faint">{e.nearMisses.length ? "near-miss" : "—"}</span>}</td>
                    <td className="whitespace-nowrap text-sm text-muted"><LocalTime iso={e.entersIso} mode="short" /> → <LocalTime iso={e.leavesIso} mode="short" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {report.current.length === 0 && <p className="py-4 text-sm italic text-muted">No transits within orb right now.</p>}
        </div>
      </Frame>

      {(heavy.length > 0 || eclipseHits.length > 0) && (
        <Panel title={`Heavy hitters · next ${o.months} months`}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {heavy.map(({ event: e, hits, misses, enters, leaves }) => (
              <button key={e.key} onClick={() => setSelected(e)} className="panel p-3 text-left text-sm transition hover:shadow-[var(--shadow-glow)]" style={{ borderLeft: `3px solid ${aspectColor[e.aspect]}` }}>
                <p className="engraved text-[0.65rem] text-accent-bright">✦ {e.heavyReason}</p>
                <p className="mt-1"><TransitLabel e={e} /></p>
                <p className="mt-1 text-muted">
                  {hits.length ? <>Exact {hits.map((h, i) => <span key={h.iso}>{i ? ", " : ""}<LocalTime iso={h.iso} mode="date" />{h.retrograde ? " ℞" : ""}</span>)}</> : misses.length ? "Stations near exact without perfecting" : "Close approach without perfecting"}
                </p>
                <p className="text-xs text-faint">In orb <LocalTime iso={enters} mode="date" /> → <LocalTime iso={leaves} mode="date" /></p>
              </button>
            ))}
            {eclipseHits.map((ec) => (
              <div key={ec.iso} className="panel p-3 text-sm" style={{ borderLeft: "3px solid var(--accent-bright)" }}>
                <p className="engraved text-[0.65rem] text-accent-bright">✦ Eclipse on a natal point</p>
                <p className="mt-1 capitalize">{ec.type} {ec.kind} eclipse · <Position lon={ec.lon} /></p>
                <p className="text-muted"><LocalTime iso={ec.iso} /></p>
                <p className="text-xs text-faint">{ec.contacts.map((c) => `${c.aspect} natal ${POINTS[c.point].name} (${formatArc(c.orb)})`).join(" · ")}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Timeline">
        <p className="mb-2 text-xs text-faint">Bars span the time in orb · ◆ exact (red ◆ = retrograde pass) · ◇ station near exact without perfecting · gold edge = heavy hitter. Click a bar for an interpretation.</p>
        <TransitTimeline events={report.events} startIso={report.startIso} endIso={report.endIso} onSelect={setSelected} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Moving through your houses">
          {report.houses.length === 0 ? <p className="text-sm italic text-muted">Houses need a birth time.</p> : (
            <table className="table-almanac text-[0.92rem]">
              <thead><tr><th>Planet</th><th>Now in</th><th>Next</th></tr></thead>
              <tbody>
                {report.houses.map((h) => (
                  <tr key={h.body}>
                    <td className="whitespace-nowrap"><PointGlyph id={h.body} className="mr-1 text-accent-bright" />{POINTS[h.body].name}</td>
                    <td>{ordinal(h.house)} house</td>
                    <td className="text-sm text-muted">{h.next ? <>enters {ordinal(h.next.house)}{h.next.retrograde ? " (retrograde)" : ""} · <LocalTime iso={h.next.iso} mode="date" /></> : "beyond search horizon"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Eclipses in this window">
          <ul className="space-y-2 text-sm">
            {report.eclipses.map((ec) => (
              <li key={ec.iso} className="border-b border-rule pb-1.5">
                <span className="capitalize text-accent-bright">{ec.type} {ec.kind}</span> · <LocalTime iso={ec.iso} /> · <Position lon={ec.lon} />
                <span className="block text-xs text-faint">{ec.contacts.length ? `On natal ${ec.contacts.map((c) => `${POINTS[c.point].name} (${c.aspect}, ${formatArc(c.orb)})`).join(", ")}` : "No natal point within 3°"}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <InterpretationPanel
        request={request}
        title={selected ? `Transiting ${POINTS[selected.transiting].name} ${ASPECTS[selected.aspect].name.toLowerCase()} natal ${POINTS[selected.natal].name}` : ""}
        topic={selected ? `transiting ${POINTS[selected.transiting].name} ${ASPECTS[selected.aspect].name.toLowerCase()} my natal ${POINTS[selected.natal].name}` : undefined}
        facts={selected ? (
          <>
            <div>In orb <LocalTime iso={selected.entersIso} /> → <LocalTime iso={selected.leavesIso} /></div>
            {selected.hits.map((h) => <div key={h.iso}>Exact <LocalTime iso={h.iso} /> at <Position lon={h.lon} seconds />{h.retrograde ? " (retrograde pass)" : ""}</div>)}
            {selected.nearMisses.map((m) => <div key={m.iso}>Near-miss within {formatArc(m.orb)} on <LocalTime iso={m.iso} mode="date" /></div>)}
            {selected.now && <div>Now: orb {formatArc(selected.now.orb)}, {selected.now.applying ? "applying" : "separating"}</div>}
            {selected.heavyReason && <div className="text-accent-bright">✦ {selected.heavyReason}</div>}
          </>
        ) : null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
