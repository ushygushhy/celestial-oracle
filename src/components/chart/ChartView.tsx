"use client";
import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NatalChart, ChartPoint } from "@/lib/astro/chart";
import type { Aspect } from "@/lib/astro/aspects";
import { ASPECTS, ASPECT_IDS, PLANET_IDS, POINTS, type AspectId, type PointId } from "@/lib/astro/constants";
import { formatArc } from "@/lib/astro/math";
import { ordinal } from "@/lib/astro/patterns";
import { aspectColor } from "@/lib/design/tokens";
import { ChartWheel, type WheelTarget } from "./ChartWheel";
import { PlacementsTable, HousesTable, Position } from "./ChartTables";
import { AspectGrid, AspectList } from "./AspectTables";
import { BirthDataCard, ChartRulerCard, PatternsCard, BalanceCard } from "./ChartSidebar";
import { InterpretationPanel, type InterpretRequest } from "./InterpretationPanel";
import { AspectGlyph, PointGlyph, SignGlyph } from "./Glyph";
import { Frame, Panel } from "../ui/Frame";
import { Sparkle } from "../ui/Ornaments";
import { setActivePersonCookie } from "../layout/PersonSwitcher";

type OverlayKind = "none" | "transits" | "progressions" | "synastry";
interface OverlayData {
  kind: Exclude<OverlayKind, "none">;
  label: string;
  sublabel: string;
  points: ChartPoint[];
  aspects: Aspect[];
}

const HOUSE_SYSTEMS: Record<string, string> = { P: "Placidus", W: "Whole Sign", K: "Koch", E: "Equal", O: "Porphyry", R: "Regiomontanus", C: "Campanus" };
const MAJOR: AspectId[] = ["conjunction", "opposition", "trine", "square", "sextile"];
const MINOR: AspectId[] = ["quincunx", "semisextile", "semisquare", "sesquiquadrate"];
const OVERLAY_COLOR: Record<string, string> = {
  transits: "var(--color-cloud-300)",
  progressions: "var(--color-amethyst-400)",
  synastry: "var(--color-rose-300)",
};
const OPTIONAL_POINTS: { id: PointId; label: string }[] = [
  { id: "chiron", label: "Chiron" },
  { id: "trueNode", label: "Nodes" },
  { id: "lilith", label: "Lilith" },
  { id: "fortune", label: "Fortune" },
  { id: "vertex", label: "Vertex" },
];

const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function ChartView({
  personId,
  chart,
  settingsQuery,
  people,
}: {
  personId: number;
  chart: NatalChart;
  settingsQuery: string;
  people: { id: number; name: string }[];
}) {
  const router = useRouter();
  const nodeId: PointId = chart.settings.nodeType === "true" ? "trueNode" : "meanNode";
  const southId: PointId = chart.settings.nodeType === "true" ? "trueSouthNode" : "meanSouthNode";

  const [aspectsOn, setAspectsOn] = useState<Set<AspectId>>(new Set(MAJOR));
  const [optional, setOptional] = useState<Set<PointId>>(new Set(["chiron", "trueNode", "lilith", "fortune"]));
  const [overlayKind, setOverlayKind] = useState<OverlayKind>("none");
  const [overlayDate, setOverlayDate] = useState(localNow);
  const [otherId, setOtherId] = useState<number | null>(people.find((p) => p.id !== personId)?.id ?? null);
  const [overlayData, setOverlay] = useState<OverlayData | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [lineMode, setLineMode] = useState<"natal" | "overlay">("natal");
  const [hover, setHover] = useState<{ t: WheelTarget; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<WheelTarget | { kind: "pattern"; index: number } | { kind: "overview" } | null>(null);

  useEffect(() => setActivePersonCookie(personId), [personId]);

  const visible = useMemo(() => {
    const s = new Set<PointId>([...PLANET_IDS, "asc", "mc", "dsc", "ic"]);
    for (const o of optional) {
      if (o === "trueNode") { s.add(nodeId); s.add(southId); } else s.add(o);
    }
    return s;
  }, [optional, nodeId, southId]);

  const wheelPoints = useMemo(() => Object.values(chart.points).filter((p): p is ChartPoint => !!p && visible.has(p.id)), [chart, visible]);
  const natalAspects = useMemo(
    () => chart.aspects.filter((a) => aspectsOn.has(a.type) && visible.has(a.a) && visible.has(a.b)),
    [chart, aspectsOn, visible],
  );

  // Fetch overlay ring data from the engine (state only set from the async response)
  const needsPartner = overlayKind === "synastry" && !otherId;
  useEffect(() => {
    if (overlayKind === "none" || needsPartner) return;
    const q = new URLSearchParams(settingsQuery);
    q.set("person", String(personId));
    q.set("kind", overlayKind);
    q.set("date", new Date(overlayDate).toISOString());
    if (overlayKind === "synastry" && otherId) q.set("other", String(otherId));
    const ctrl = new AbortController();
    fetch(`/api/overlay?${q}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setOverlayError(d.error); setOverlay(null); }
        else { setOverlay(d); setOverlayError(null); setLineMode("overlay"); }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [overlayKind, overlayDate, otherId, personId, settingsQuery, needsPartner]);
  const overlay = overlayKind !== "none" && !needsPartner && overlayData?.kind === overlayKind ? overlayData : null;
  const overlayMessage = needsPartner ? "Choose (or add) a second person to compare." : overlayKind !== "none" ? overlayError : null;

  // Outer ring follows the same point toggles as the natal ring
  const overlayPoints = useMemo(() => {
    const allowed = (id: PointId) => {
      if (id === "trueNode" || id === "trueSouthNode" || id === "meanNode" || id === "meanSouthNode") return optional.has("trueNode");
      if (id === "chiron" || id === "lilith" || id === "fortune" || id === "vertex") return optional.has(id);
      return true;
    };
    return overlay?.points.filter((p) => allowed(p.id)) ?? [];
  }, [overlay, optional]);
  const crossAspects = useMemo(
    () => overlay?.aspects.filter((a) => aspectsOn.has(a.type) && visible.has(a.b) && overlayPoints.some((p) => p.id === a.a)) ?? [],
    [overlay, aspectsOn, visible, overlayPoints],
  );
  const showCross = !!overlay && lineMode === "overlay";

  const onHover = useCallback((t: WheelTarget | null, e?: MouseEvent) => {
    setHover(t && e ? { t, x: e.clientX, y: e.clientY } : null);
  }, []);

  const setQuery = (key: string, value: string | null) => {
    const q = new URLSearchParams(settingsQuery);
    if (value === null) q.delete(key); else q.set(key, value);
    router.push(`/chart/${personId}${q.toString() ? `?${q}` : ""}`);
  };

  // ---- interpretation request + facts --------------------------------------
  const overlayParams = overlay ? { overlay: overlay.kind, date: new Date(overlayDate).toISOString(), other: overlay.kind === "synastry" ? otherId ?? undefined : undefined } : null;
  const request: InterpretRequest | null = useMemo(() => {
    if (!selected) return null;
    const base = { personId, settings: settingsQuery };
    switch (selected.kind) {
      case "point":
        if (selected.ring === "outer" && overlayParams) return { ...base, target: { kind: "overlay-point", id: selected.id, ...overlayParams } };
        return { ...base, target: { kind: "point", id: selected.id } };
      case "house": return { ...base, target: { kind: "house", house: selected.house } };
      case "aspect":
        if (selected.cross && overlayParams) return { ...base, target: { kind: "overlay-aspect", a: selected.a, b: selected.b, type: selected.type, ...overlayParams } };
        return { ...base, target: { kind: "aspect", a: selected.a, b: selected.b, type: selected.type } };
      case "pattern": return { ...base, target: { kind: "pattern", index: selected.index } };
      case "overview": return { ...base, target: { kind: "overview" } };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, personId, settingsQuery, overlay?.kind, overlayDate, otherId]);

  const panel = selected ? describe(selected, chart, overlay) : null;

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="engraved text-[0.65rem] text-faint">Natal chart</p>
          <h1 className="font-masthead text-3xl font-bold tracking-wide text-text">{chart.name}</h1>
          <p className="headline-italic mt-1 text-sm font-normal text-muted">
            {new Date(`${chart.input.date}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
            {chart.moment.timeUnknown ? " · time unknown" : ` · ${chart.input.time}`} · {chart.placeName}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {(["sun", "moon", "asc"] as PointId[]).map((id) => chart.points[id] && (
              <span key={id}><PointGlyph id={id} className="text-accent-bright" /> <Position lon={chart.points[id]!.lon} uncertain={chart.points[id]!.uncertain} /></span>
            ))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {chart.houses && (
            <select className="field w-auto py-1.5 text-sm" value={chart.houses.system} onChange={(e) => setQuery("hs", e.target.value)} aria-label="House system">
              {Object.entries(HOUSE_SYSTEMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          <select className="field w-auto py-1.5 text-sm" value={chart.settings.nodeType} onChange={(e) => setQuery("node", e.target.value === "mean" ? "mean" : null)} aria-label="Lunar node">
            <option value="true">True node</option>
            <option value="mean">Mean node</option>
          </select>
          <button className="btn" onClick={() => setSelected({ kind: "overview" })}><Sparkle size={9} /> Read whole chart</button>
          <Link href={`/people/${personId}/edit`} className="btn">Edit birth data</Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Frame className="!p-3 sm:!p-5">
          <div className="mx-auto max-w-[860px]">
            <ChartWheel
              chart={chart}
              points={wheelPoints}
              aspects={showCross ? crossAspects : natalAspects}
              cross={showCross}
              outer={overlay ? { label: overlay.label, points: overlayPoints, color: OVERLAY_COLOR[overlay.kind] } : null}
              focus={selected?.kind === "point" ? { id: selected.id, ring: selected.ring } : hover?.t.kind === "point" ? { id: hover.t.id, ring: hover.t.ring } : null}
              onHover={onHover}
              onSelect={setSelected}
            />
          </div>

          {/* Controls */}
          <div className="mt-4 space-y-3 border-t border-rule pt-4 text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="engraved mr-1 w-20 text-[0.6rem] text-faint">Aspects</span>
              {ASPECT_IDS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAspectsOn((s) => { const n = new Set(s); if (n.has(a)) n.delete(a); else n.add(a); return n; })}
                  className={`chip transition ${aspectsOn.has(a) ? "!border-[color:var(--rule-strong)] text-text" : "opacity-45"}`}
                  title={`${ASPECTS[a].name} (${ASPECTS[a].angle}°, orb ${chart.settings.aspects.orbs[a]}°)`}
                >
                  <AspectGlyph type={a} /> {ASPECTS[a].name}
                </button>
              ))}
              <button className="chip ml-1 text-accent-bright" onClick={() => setAspectsOn((s) => { const allMinor = MINOR.every((m) => s.has(m)); const n = new Set(s); MINOR.forEach((m) => (allMinor ? n.delete(m) : n.add(m))); return n; })}>
                {MINOR.every((m) => aspectsOn.has(m)) ? "− minor" : "+ minor"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="engraved mr-1 w-20 text-[0.6rem] text-faint">Points</span>
              {OPTIONAL_POINTS.map(({ id, label }) => (
                <button key={id} onClick={() => setOptional((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; })} className={`chip ${optional.has(id) ? "!border-[color:var(--rule-strong)] text-text" : "opacity-45"}`}>
                  <PointGlyph id={id === "trueNode" ? nodeId : id} /> {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="engraved mr-1 w-20 text-[0.6rem] text-faint">Outer ring</span>
              {(["none", "transits", "progressions", "synastry"] as OverlayKind[]).map((k) => (
                <button key={k} onClick={() => setOverlayKind(k)} className={`chip capitalize ${overlayKind === k ? "!border-[color:var(--rule-strong)] text-text" : "opacity-60"}`}>
                  {k !== "none" && <span className="inline-block h-2 w-2 rounded-full" style={{ background: OVERLAY_COLOR[k] }} />}
                  {k === "none" ? "Natal only" : k}
                </button>
              ))}
              {(overlayKind === "transits" || overlayKind === "progressions") && (
                <input type="datetime-local" className="field ml-1 w-auto py-1 text-xs" value={overlayDate} onChange={(e) => setOverlayDate(e.target.value)} />
              )}
              {overlayKind === "synastry" && (
                <select className="field ml-1 w-auto py-1 text-xs" value={otherId ?? ""} onChange={(e) => setOtherId(Number(e.target.value) || null)}>
                  <option value="">Choose a person…</option>
                  {people.filter((p) => p.id !== personId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              {overlay && (
                <span className="ml-2 inline-flex overflow-hidden rounded-sm border border-rule text-xs">
                  {(["natal", "overlay"] as const).map((m) => (
                    <button key={m} onClick={() => setLineMode(m)} className={`px-2 py-0.5 ${lineMode === m ? "bg-[rgb(204_168_116/0.18)] text-text" : "text-muted"}`}>
                      {m === "natal" ? "natal lines" : `${overlay.kind} lines`}
                    </button>
                  ))}
                </span>
              )}
              {overlayMessage && <span className="text-xs text-danger">{overlayMessage}</span>}
            </div>
          </div>
        </Frame>

        <div className="space-y-5">
          <BirthDataCard chart={chart} />
          <ChartRulerCard chart={chart} onSelect={(id) => setSelected({ kind: "point", id, ring: "natal" })} />
          <PatternsCard chart={chart} onSelect={(index) => setSelected({ kind: "pattern", index })} />
          <BalanceCard chart={chart} />
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel title="Placements">
          <PlacementsTable chart={chart} visible={new Set([...visible, "dsc", "ic"])} onSelect={(id) => setSelected({ kind: "point", id, ring: "natal" })} />
        </Panel>
        <Panel title={`Houses${chart.houses ? ` · ${chart.houses.systemName}` : ""}`}>
          <HousesTable chart={chart} onSelect={(house) => setSelected({ kind: "house", house })} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Aspectarian">
          <AspectGrid
            ids={[...PLANET_IDS, "chiron", nodeId, "lilith", "asc", "mc"].filter((id) => chart.points[id as PointId] && visible.has(id as PointId)) as PointId[]}
            aspects={natalAspects}
            onSelect={(a) => setSelected({ kind: "aspect", a: a.a, b: a.b, type: a.type, cross: false })}
          />
        </Panel>
        <Panel title={showCross ? `${overlay!.label} → natal` : "Aspects"}>
          <AspectList
            aspects={showCross ? crossAspects : natalAspects}
            labelA={showCross ? overlay!.kind === "synastry" ? overlay!.label : overlay!.kind === "transits" ? "Transiting" : "Progressed" : undefined}
            labelB={showCross ? "Natal" : undefined}
            onSelect={(a) => setSelected({ kind: "aspect", a: a.a, b: a.b, type: a.type, cross: showCross })}
          />
        </Panel>
      </div>

      {hover && !selected && (
        <div className="pointer-events-none fixed z-30 max-w-xs" style={{ left: Math.min(hover.x + 16, window.innerWidth - 330), top: Math.min(hover.y + 16, window.innerHeight - 260) }}>
          <div className="panel !bg-surface-strong px-3 py-2 text-sm shadow-[var(--shadow-card)]">
            <Tooltip t={hover.t} chart={chart} overlay={overlay} />
          </div>
        </div>
      )}

      <InterpretationPanel request={request} title={panel?.title ?? ""} facts={panel?.facts ?? null} topic={selected ? topicOf(selected, chart, overlay) : undefined} onClose={() => setSelected(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function aspectsFor(chart: NatalChart, id: PointId) {
  return chart.aspects.filter((a) => a.a === id || a.b === id);
}

function AspectLine({ a, from, to }: { a: Aspect; from?: string; to?: string }) {
  return (
    <span className="whitespace-nowrap">
      {from ?? POINTS[a.a].name} <span style={{ color: aspectColor[a.type] }}>{ASPECTS[a.type].glyph}</span> {to ?? POINTS[a.b].name}{" "}
      <span className="num text-faint">{formatArc(a.orb)}{a.applying === null ? "" : a.applying ? " a" : " s"}</span>
    </span>
  );
}

function Tooltip({ t, chart, overlay }: { t: WheelTarget; chart: NatalChart; overlay: OverlayData | null }) {
  if (t.kind === "point") {
    const p = t.ring === "outer" ? overlay?.points.find((x) => x.id === t.id) : chart.points[t.id];
    if (!p) return null;
    const asp = t.ring === "outer" ? overlay!.aspects.filter((a) => a.a === t.id) : aspectsFor(chart, t.id);
    return (
      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <PointGlyph id={p.id} className="text-lg text-accent-bright" />
          <b className="engraved text-[0.75rem]">{t.ring === "outer" ? `${overlay?.kind === "synastry" ? overlay.label : overlay?.kind === "transits" ? "Transiting" : "Progressed"} ` : ""}{p.name}</b>
        </div>
        <div><Position lon={p.lon} seconds uncertain={p.uncertain} /></div>
        <div className="text-xs text-muted">
          {p.house ? `${ordinal(p.house)} house${t.ring === "outer" ? " (natal)" : ""}` : ""}
          {p.retrograde && p.kind !== "angle" ? " · retrograde" : ""}{p.station ? ` · stationary ${p.station}` : ""}
          {p.dignity && p.dignity.label !== "—" ? ` · ${p.dignity.label}` : ""}{p.outOfBounds ? " · out of bounds" : ""}
        </div>
        {asp.length > 0 && (
          <div className="border-t border-rule pt-1 text-xs">
            {asp.slice(0, 7).map((a) => <div key={`${a.a}${a.b}${a.type}`}><AspectLine a={a} to={t.ring === "outer" ? `natal ${POINTS[a.b].name}` : undefined} /></div>)}
          </div>
        )}
        <div className="text-[0.65rem] italic text-faint">Click to interpret</div>
      </div>
    );
  }
  if (t.kind === "house") {
    const c = chart.houses?.cusps[t.house - 1];
    if (!c) return null;
    const ruler = chart.points[c.ruler];
    return (
      <div className="space-y-1">
        <b className="engraved text-[0.75rem]">{ordinal(t.house)} house</b>
        <div><Position lon={c.lon} seconds /></div>
        <div className="text-xs text-muted">Ruler {POINTS[c.ruler].name} in {ruler?.formatted} ({ordinal(ruler?.house ?? 0)})</div>
      </div>
    );
  }
  const a = (t.cross ? overlay?.aspects : chart.aspects)?.find((x) => x.a === t.a && x.b === t.b && x.type === t.type);
  if (!a) return null;
  return (
    <div className="space-y-1">
      <div><AspectLine a={a} from={t.cross ? `${overlay?.kind === "transits" ? "tr." : overlay?.kind === "progressions" ? "pr." : ""} ${POINTS[a.a].name}` : undefined} /></div>
      <div className="text-xs text-muted">{ASPECTS[a.type].angle}° · orb {formatArc(a.orb)} of {formatArc(a.allowedOrb)}{a.applying === null ? "" : a.applying ? " · applying" : " · separating"}{a.outOfSign ? " · out of sign" : ""}</div>
    </div>
  );
}

/** Plain-text subject of a selection, e.g. "my natal Mars in Aries". */
function topicOf(sel: WheelTarget | { kind: "pattern"; index: number } | { kind: "overview" }, chart: NatalChart, overlay: OverlayData | null): string {
  const sign = (lon: number) => ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"][Math.floor(lon / 30)];
  const kind = overlay?.kind === "transits" ? "transiting" : overlay?.kind === "progressions" ? "progressed" : overlay ? `${overlay.label}'s` : "";
  switch (sel.kind) {
    case "overview": return "my whole chart";
    case "pattern": return `my ${chart.patterns[sel.index]?.name ?? "aspect pattern"} (${chart.patterns[sel.index]?.points.map((id) => POINTS[id].name).join(", ")})`;
    case "house": return `my ${ordinal(sel.house)} house`;
    case "point": {
      const p = sel.ring === "outer" ? overlay?.points.find((x) => x.id === sel.id) : chart.points[sel.id];
      return p ? `${sel.ring === "outer" ? kind : "my natal"} ${p.name} in ${sign(p.lon)}` : POINTS[sel.id].name;
    }
    case "aspect":
      return `${sel.cross ? kind : "my natal"} ${POINTS[sel.a].name} ${ASPECTS[sel.type].name.toLowerCase()} ${sel.cross ? "natal " : ""}${POINTS[sel.b].name}`;
  }
}

function describe(sel: WheelTarget | { kind: "pattern"; index: number } | { kind: "overview" }, chart: NatalChart, overlay: OverlayData | null): { title: ReactNode; facts: ReactNode } {
  const line = (k: string, v: ReactNode) => <div key={k}><span className="engraved mr-2 text-[0.58rem] text-faint">{k}</span>{v}</div>;
  if (sel.kind === "overview") return { title: `${chart.name} — the whole chart`, facts: <div>Every placement, house, aspect, pattern and balance score shown on this page is sent to the interpreter.</div> };
  if (sel.kind === "pattern") {
    const p = chart.patterns[sel.index];
    return {
      title: p?.name ?? "Pattern",
      facts: p ? <>{p.points.map((id) => line(POINTS[id].name, <Position lon={chart.points[id]!.lon} seconds />))}{p.detail && line("Detail", p.detail)}</> : null,
    };
  }
  if (sel.kind === "point") {
    const outer = sel.ring === "outer";
    const p = outer ? overlay?.points.find((x) => x.id === sel.id) : chart.points[sel.id];
    if (!p) return { title: POINTS[sel.id].name, facts: null };
    const asp = outer ? overlay!.aspects.filter((a) => a.a === sel.id) : aspectsFor(chart, sel.id);
    const prefix = outer ? (overlay!.kind === "transits" ? "Transiting " : overlay!.kind === "progressions" ? "Progressed " : `${overlay!.label}'s `) : "";
    return {
      title: <><PointGlyph id={p.id} /> {prefix}{p.name} in <SignGlyph sign={p.sign} /> {p.formatted.split(" ").slice(1).join(" ")}</>,
      facts: (
        <>
          {line("Position", <Position lon={p.lon} seconds uncertain={p.uncertain} />)}
          {p.house && line(outer ? "Natal house" : "House", ordinal(p.house))}
          {p.kind !== "angle" && line("Motion", `${p.retrograde ? "retrograde" : "direct"}${p.station ? `, stationary (turning ${p.station})` : ""} · ${p.speed.toFixed(4)}°/day`)}
          {p.dignity && line("Dignity", `${p.dignity.major.join(" + ") || (p.dignity.peregrine ? "peregrine" : "—")}${p.dignity.minor.length ? ` (${p.dignity.minor.join(", ")})` : ""}${p.dignity.score !== null ? ` · score ${p.dignity.score}` : ""}`)}
          {p.kind !== "angle" && line("Decan", `${["", "I", "II", "III"][p.decan.number]} · ruler ${POINTS[p.decan.ruler].name} · face ${POINTS[p.decan.faceRuler].name}`)}
          {asp.length > 0 && line("Aspects", <span className="inline-flex flex-col">{asp.map((a) => <AspectLine key={`${a.a}${a.b}${a.type}`} a={a} to={outer ? `natal ${POINTS[a.b].name}` : undefined} />)}</span>)}
        </>
      ),
    };
  }
  if (sel.kind === "house") {
    const c = chart.houses?.cusps[sel.house - 1];
    const ruler = c ? chart.points[c.ruler] : null;
    return {
      title: `The ${ordinal(sel.house)} house`,
      facts: c ? (
        <>
          {line("Cusp", <Position lon={c.lon} seconds />)}
          {ruler && line("Ruler", <>{ruler.name} · <Position lon={ruler.lon} /> · {ordinal(ruler.house ?? 0)} house</>)}
          {line("Occupants", Object.values(chart.points).filter((p) => p && p.house === sel.house && !["asc", "mc", "dsc", "ic"].includes(p.id)).map((p) => p!.name).join(", ") || "none")}
        </>
      ) : "Houses need a birth time.",
    };
  }
  const list = sel.cross ? overlay?.aspects : chart.aspects;
  const a = list?.find((x) => x.a === sel.a && x.b === sel.b && x.type === sel.type);
  const pa = sel.cross ? overlay?.points.find((x) => x.id === sel.a) : chart.points[sel.a];
  const pb = chart.points[sel.b];
  return {
    title: <>{sel.cross ? `${overlay?.kind === "transits" ? "Transiting" : overlay?.kind === "progressions" ? "Progressed" : overlay?.label} ` : ""}{POINTS[sel.a].name} <AspectGlyph type={sel.type} /> {sel.cross ? "natal " : ""}{POINTS[sel.b].name}</>,
    facts: (
      <>
        {a && line("Aspect", `${ASPECTS[a.type].name} (${a.angle}°) · orb ${formatArc(a.orb)} · ${a.applying === null ? "—" : a.applying ? "applying" : "separating"}${a.outOfSign ? " · out of sign" : ""}`)}
        {pa && line(pa.name, <><Position lon={pa.lon} seconds />{pa.house ? ` · ${ordinal(pa.house)}` : ""}</>)}
        {pb && line(pb.name, <><Position lon={pb.lon} seconds />{pb.house ? ` · ${ordinal(pb.house)}` : ""}</>)}
      </>
    ),
  };
}
