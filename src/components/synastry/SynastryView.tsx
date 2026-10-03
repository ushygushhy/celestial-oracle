"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NatalChart, ChartPoint } from "@/lib/astro/chart";
import type { Overlay } from "@/lib/services/overlay-service";
import type { Aspect } from "@/lib/astro/aspects";
import { ASPECTS, PLANET_IDS, POINTS, type PointId } from "@/lib/astro/constants";
import { formatArc } from "@/lib/astro/math";
import { ordinal } from "@/lib/astro/patterns";
import { aspectColor } from "@/lib/design/tokens";
import { ChartWheel } from "../chart/ChartWheel";
import { PlacementsTable, Position } from "../chart/ChartTables";
import { PointGlyph, AspectGlyph } from "../chart/Glyph";
import { Frame, Panel } from "../ui/Frame";
import { Sparkle } from "../ui/Ornaments";
import { InterpretationPanel, type InterpretRequest } from "../chart/InterpretationPanel";

const KEY: PointId[] = ["sun", "moon", "venus", "mars", "asc", "mc"];
const weight = (a: Aspect) => a.strength * (ASPECTS[a.type].major ? 1 : 0.4) + (KEY.includes(a.a) ? 0.5 : 0) + (KEY.includes(a.b) ? 0.5 : 0) + (a.type === "conjunction" || a.type === "opposition" ? 0.2 : 0);
const GRID: PointId[] = [...PLANET_IDS, "chiron", "trueNode", "asc", "mc"];

export function SynastryView({ aId, bId, a, b, bOnA, aOnB, composite, people }: { aId: number; bId: number; a: NatalChart; b: NatalChart; bOnA: Overlay; aOnB: Overlay; composite: NatalChart; people: { id: number; name: string }[]; }) {
  const router = useRouter();
  const ids = { a: aId, b: bId };
  const [focus, setFocus] = useState<{ a: PointId; b: PointId; type: string } | null | "overview">(null);
  const [showMinor, setShowMinor] = useState(false);
  const aspects = useMemo(() => bOnA.aspects.filter((x) => showMinor || ASPECTS[x.type].major), [bOnA, showMinor]);
  const strongest = useMemo(() => [...aspects].sort((x, y) => weight(y) - weight(x)).slice(0, 12), [aspects]);
  const map = new Map(aspects.map((x) => [`${x.a}|${x.b}`, x]));
  // Picking the other side's person swaps the pair rather than comparing someone with themselves.
  const go = (qa: number, qb: number) => {
    if (qa === qb) [qa, qb] = [ids.b, ids.a];
    router.push(`/synastry?a=${qa}&b=${qb}`);
  };

  const aPoints = Object.values(a.points).filter((p): p is ChartPoint => !!p && !["meanNode", "meanSouthNode", "vertex", "fortune", "trueSouthNode"].includes(p.id));
  const cPoints = Object.values(composite.points).filter((p): p is ChartPoint => !!p && !["trueSouthNode"].includes(p.id));
  const request: InterpretRequest | null = focus && ids.a && ids.b
    ? { personId: ids.a, target: { kind: "synastry", other: ids.b, focus: focus === "overview" ? null : focus } }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="engraved text-[0.65rem] text-faint">Synastry</p>
          <h1 className="font-masthead text-3xl font-bold tracking-wide">{a.name} <span className="text-accent">&amp;</span> {b.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="field w-auto py-1.5 text-sm" value={ids.a ?? ""} onChange={(e) => go(Number(e.target.value), ids.b)}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <span className="text-faint">&amp;</span>
          <select className="field w-auto py-1.5 text-sm" value={ids.b ?? ""} onChange={(e) => go(ids.a, Number(e.target.value))}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <button className="btn btn-gilt" onClick={() => setFocus("overview")}><Sparkle size={10} /> Read this relationship</button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Frame title="Bi-wheel" subtitle={`${a.name} inside · ${b.name} outside`}>
          <div className="mx-auto max-w-[760px]">
            <ChartWheel chart={a} points={aPoints} aspects={aspects} cross outer={{ label: b.name, points: bOnA.points, color: "var(--color-rose-300)" }}
              onSelect={(t) => t.kind === "aspect" && setFocus({ a: t.a, b: t.b, type: t.type })} />
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={showMinor} onChange={(e) => setShowMinor(e.target.checked)} className="accent-[var(--accent)]" /> Include minor aspects</label>
        </Frame>
        <Panel title="Strongest contacts">
          <ul className="space-y-1 text-sm">
            {strongest.map((x) => (
              <li key={`${x.a}${x.b}${x.type}`}>
                <button className="w-full rounded-sm px-2 py-1 text-left hover:bg-[rgb(204_168_116/0.08)]" onClick={() => setFocus({ a: x.a, b: x.b, type: x.type })}>
                  <span className="text-faint">{b.name.split(" ")[0]}&apos;s</span> <PointGlyph id={x.a} className="text-accent-bright" /> {POINTS[x.a].name} <AspectGlyph type={x.type} /> <span className="text-faint">{a.name.split(" ")[0]}&apos;s</span> <PointGlyph id={x.b} className="text-accent-bright" /> {POINTS[x.b].name}
                  <span className="num ml-1 text-xs text-faint">{formatArc(x.orb)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title={`Inter-aspect grid · rows ${b.name}, columns ${a.name}`}>
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm">
            <thead>
              <tr><th />{GRID.filter((id) => a.points[id]).map((id) => <th key={id} className="h-9 w-9 border border-rule text-accent-bright" title={POINTS[id].name}><PointGlyph id={id} /></th>)}</tr>
            </thead>
            <tbody>
              {GRID.filter((id) => bOnA.points.some((p) => p.id === id)).map((rid) => (
                <tr key={rid}>
                  <th className="h-9 w-9 border border-rule text-[color:var(--color-rose-300)]" title={POINTS[rid].name}><PointGlyph id={rid} /></th>
                  {GRID.filter((id) => a.points[id]).map((cid) => {
                    const x = map.get(`${rid}|${cid}`);
                    return (
                      <td key={cid} onClick={() => x && setFocus({ a: x.a, b: x.b, type: x.type })} className={`h-9 w-9 border border-rule text-center ${x ? "cursor-pointer" : ""}`}
                        style={x ? { boxShadow: `inset 0 0 0 999px color-mix(in srgb, ${aspectColor[x.type]} ${Math.round(5 + x.strength * 14)}%, transparent)` } : undefined}
                        title={x ? `${b.name}'s ${POINTS[x.a].name} ${x.type} ${a.name}'s ${POINTS[x.b].name} — ${formatArc(x.orb)}` : undefined}>
                        {x && <div className="flex flex-col items-center leading-none"><AspectGlyph type={x.type} /><span className="num mt-0.5 text-[0.55rem] text-faint">{Math.floor(x.orb)}°</span></div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        {[{ title: `${b.name}'s planets in ${a.name}'s houses`, o: bOnA, has: !!a.houses }, { title: `${a.name}'s planets in ${b.name}'s houses`, o: aOnB, has: !!b.houses }].map(({ title, o, has }, i) => (
          <Panel key={i} title={title}>
            {!has ? <p className="text-sm italic text-muted">Needs the house owner&apos;s birth time.</p> : (
              <table className="table-almanac text-sm">
                <tbody>
                  {o.points.filter((p) => PLANET_IDS.includes(p.id as never) || ["chiron", "trueNode", "asc", "mc"].includes(p.id)).map((p) => (
                    <tr key={p.id}><td className="whitespace-nowrap"><PointGlyph id={p.id} className="mr-1 text-accent-bright" />{POINTS[p.id].name}</td><td><Position lon={p.lon} /></td><td>{p.house ? `${ordinal(p.house)} house` : "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        ))}
      </div>

      <Frame title="Composite chart" subtitle="Midpoints of each pair of planets — the relationship as its own entity">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[680px]"><ChartWheel chart={composite} points={cPoints} aspects={composite.aspects.filter((x) => ASPECTS[x.type].major)} /></div>
          <div>
            <p className="mb-2 text-xs text-faint">{composite.warnings[0]}</p>
            <PlacementsTable chart={composite} visible={new Set(cPoints.map((p) => p.id))} onSelect={() => {}} />
          </div>
        </div>
      </Frame>

      <InterpretationPanel
        request={request}
        title={focus === "overview" || !focus ? `${a.name} & ${b.name}` : `${b.name}'s ${POINTS[focus.a].name} ${focus.type} ${a.name}'s ${POINTS[focus.b].name}`}
        topic={focus && focus !== "overview" ? `${b.name}'s ${POINTS[focus.a].name} ${focus.type} my ${POINTS[focus.b].name}` : `my relationship with ${b.name}`}
        facts={<div>{strongest.slice(0, 6).map((x) => `${POINTS[x.a].name} ${x.type} ${POINTS[x.b].name} (${formatArc(x.orb)})`).join(" · ")}</div>}
        onClose={() => setFocus(null)}
      />
    </div>
  );
}
