"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { YearReport, YearLocation } from "@/lib/services/year-service";
import type { NatalChart, ChartPoint } from "@/lib/astro/chart";
import { POINTS } from "@/lib/astro/constants";
import { formatArc } from "@/lib/astro/math";
import { ordinal } from "@/lib/astro/patterns";
import { Frame, Panel } from "../ui/Frame";
import { LocalTime } from "../ui/LocalTime";
import { PointGlyph, SignGlyph, AspectGlyph } from "../chart/Glyph";
import { Position } from "../chart/ChartTables";
import { ChartWheel } from "../chart/ChartWheel";
import { TransitTimeline } from "../transits/TransitTimeline";
import { InterpretationPanel, type InterpretRequest } from "../chart/InterpretationPanel";
import { PlaceSearch } from "../people/PlaceSearch";
import { Sparkle } from "../ui/Ornaments";
import { askOracle } from "../chat/OracleChat";

const name = (id: string) => POINTS[id as keyof typeof POINTS]?.name ?? id;

function NumberCard({ title, n }: { title: string; n: { label: string; meaning: string; steps: string[] } }) {
  return (
    <div className="border-b border-rule pb-2 last:border-0">
      <div className="flex items-baseline justify-between">
        <span className="engraved text-[0.62rem] text-faint">{title}</span>
        <span className="font-masthead text-2xl text-accent-bright">{n.label}</span>
      </div>
      <p className="text-sm text-muted">{n.meaning}</p>
      <details className="mt-0.5 text-xs text-faint"><summary className="cursor-pointer">workings</summary>{n.steps.join(" · ")}</details>
    </div>
  );
}

export function YearView({ personId, natal, report, location, timezone }: { personId: number; natal: NatalChart; report: YearReport; location: YearLocation | null; timezone: string }) {
  const router = useRouter();
  const [reading, setReading] = useState(false);
  const [pickPlace, setPickPlace] = useState(false);
  const p = report.profection;
  const sr = report.solarReturn;
  const pr = report.progressions;

  const request: InterpretRequest | null = reading ? { personId, target: { kind: "year", timezone, location } } : null;

  const srOuter = sr ? Object.values(natal.points).filter((x): x is ChartPoint => !!x && !["dsc", "ic", "meanNode", "meanSouthNode", "trueSouthNode", "vertex", "fortune"].includes(x.id)) : [];
  const srPoints = sr ? Object.values(sr.chart.points).filter((x): x is ChartPoint => !!x && !["meanNode", "meanSouthNode", "vertex"].includes(x.id)) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="engraved text-[0.65rem] text-faint">Your year</p>
          <h1 className="font-masthead text-3xl font-bold tracking-wide">{report.name}</h1>
          {p && <p className="headline-italic mt-1 text-sm font-normal text-muted">Age {p.age} · profection year {p.yearStart} → {p.yearEnd}</p>}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-gilt" onClick={() => setReading(true)}><Sparkle size={10} /> Read my year</button>
          <button className="btn" onClick={() => askOracle({ text: "About my year ahead: ", personId })}>Ask in chat</button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Frame title="Annual profection" subtitle={p ? `${ordinal(p.house)} house year` : undefined}>
          {p ? (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-3">
                <SignGlyph sign={p.signId as never} className="text-4xl" />
                <span><span className="engraved text-[0.8rem] text-accent-bright">{p.sign}</span><br /><span className="text-muted">profected from the {p.from === "ascendant" ? "Ascendant (whole sign)" : "Sun — birth time unknown"}</span></span>
              </p>
              <p className="border-t border-rule pt-2">
                <span className="engraved text-[0.62rem] text-faint">Lord of the Year</span><br />
                <PointGlyph id={p.lord} className="text-xl text-accent-bright" /> <b>{name(p.lord)}</b>
                {p.lordNatal && <> — natally <Position lon={p.lordNatal.lon} />{p.lordNatal.house ? ` in the ${ordinal(p.lordNatal.house)}` : ""}{p.lordNatal.retrograde ? " ℞" : ""}{p.lordNatal.dignity && p.lordNatal.dignity.label !== "—" ? ` · ${p.lordNatal.dignity.label}` : ""}</>}
              </p>
            </div>
          ) : <p className="text-sm italic text-muted">Unavailable.</p>}
        </Frame>

        <Frame title="Numerology cycles" subtitle={report.numerology.method}>
          <div className="space-y-2">
            <NumberCard title="Personal Year" n={report.numerology.year} />
            <NumberCard title="Personal Month" n={report.numerology.month} />
            <NumberCard title="Personal Day" n={report.numerology.day} />
          </div>
          {report.numerology.nameMissing && <p className="mt-2 text-xs text-faint">No full birth name saved — cycles use only the birth date, so they are unaffected.</p>}
        </Frame>

        <Frame title="Progressed Moon" subtitle="The inner weather of the next two and a half years">
          <div className="space-y-2 text-sm">
            <p><PointGlyph id="moon" className="text-xl text-accent-bright" /> <Position lon={pr.moon.lon} seconds />{pr.moon.house ? <span className="text-muted"> · natal {ordinal(pr.moon.house)} house</span> : null}</p>
            <p className="text-muted">Next sign: {pr.moon.nextSign ? <>{pr.moon.nextSign.sign} on <LocalTime iso={pr.moon.nextSign.iso} mode="date" /></> : "—"}</p>
            <p className="text-muted">Next house: {pr.moon.nextHouse ? <>{ordinal(pr.moon.nextHouse.house)} on <LocalTime iso={pr.moon.nextHouse.iso} mode="date" /></> : "—"}</p>
            <p className="border-t border-rule pt-2 text-xs text-faint">Progressed Sun <Position lon={pr.points.find((x) => x.id === "sun")!.lon} /> · age {pr.ageYears.toFixed(2)}</p>
          </div>
        </Frame>
      </div>

      {report.months.length > 0 && (
        <Panel title="Monthly profections">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {report.months.map((m) => (
              <div key={m.index} className={`panel px-3 py-2 text-sm ${m.current ? "!border-[color:var(--rule-strong)] shadow-[var(--shadow-glow)]" : ""}`}>
                <p className="engraved text-[0.6rem] text-faint">Month {m.index}{m.current ? " · now" : ""}</p>
                <p><SignGlyph sign={m.signId as never} /> {m.sign}</p>
                <p className="text-xs text-muted">Lord <PointGlyph id={m.lord} /> {name(m.lord)}</p>
                <p className="num text-[0.68rem] text-faint">{m.start} → {m.end}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {p && (
        <Panel title={`Transits of the Lord of the Year · ${name(p.lord)}`}>
          <p className="mb-2 text-xs text-faint">Aspects transiting {name(p.lord)} makes to the natal chart during this profection year, plus slow-planet transits to natal {name(p.lord)}.</p>
          <TransitTimeline events={[...report.lordTransits, ...report.toLord]} startIso={`${p.yearStart}T00:00:00.000Z`} endIso={`${p.yearEnd}T00:00:00.000Z`} onSelect={(e) => askOracle({ text: `About transiting ${name(e.transiting)} ${e.aspect} my natal ${name(e.natal)} during my ${name(p.lord)} year: `, personId })} />
        </Panel>
      )}

      {sr && (
        <Frame title="Solar return" subtitle={`Sun returns to ${natal.points.sun?.formattedPrecise} · ${sr.location.label}`} actions={<button className="btn px-3 py-1 text-[0.65rem]" onClick={() => setPickPlace((v) => !v)}>Change location</button>}>
          {pickPlace && (
            <div className="mb-4">
              <PlaceSearch value={null} onChange={(pl) => {
                if (!pl) return;
                const q = new URLSearchParams({ srlat: String(pl.lat), srlon: String(pl.lon), srlabel: pl.label });
                router.push(`/year/${personId}?${q}`);
              }} />
            </div>
          )}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="mx-auto w-full max-w-[720px]">
              <ChartWheel
                chart={sr.chart}
                points={srPoints}
                aspects={sr.aspects.map((a) => ({ ...a, a: a.b, b: a.a }))}
                cross
                outer={{ label: "Natal", points: srOuter, color: "var(--color-amethyst-400)" }}
              />
            </div>
            <div className="space-y-4 text-sm">
              <p>Exact return: <LocalTime iso={sr.iso} /></p>
              {sr.chart.points.asc && <p>SR Ascendant <Position lon={sr.chart.points.asc.lon} /> {sr.ascNatalHouse && <span className="text-muted">— falls in your natal {ordinal(sr.ascNatalHouse)} house</span>}</p>}
              <table className="table-almanac">
                <thead><tr><th>SR point</th><th>Position</th><th>SR house</th><th>Natal house</th></tr></thead>
                <tbody>
                  {sr.placements.filter((x) => !["asc", "mc"].includes(x.id)).map((x) => (
                    <tr key={x.id}>
                      <td className="whitespace-nowrap"><PointGlyph id={x.id} className="mr-1 text-accent-bright" />{name(x.id)}</td>
                      <td><Position lon={sr.chart.points[x.id]!.lon} /></td>
                      <td className="num text-center">{x.srHouse ?? "—"}</td>
                      <td className="num text-center">{x.natalHouse ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div>
                <h4 className="engraved mb-1 text-[0.65rem] text-faint">SR → natal aspects</h4>
                {sr.aspects.slice(0, 14).map((a) => (
                  <p key={`${a.a}${a.b}${a.type}`}>SR {name(a.a)} <AspectGlyph type={a.type} /> natal {name(a.b)} <span className="num text-faint">{formatArc(a.orb)}</span></p>
                ))}
              </div>
            </div>
          </div>
        </Frame>
      )}

      <Panel title="Secondary progressions">
        <div className="grid gap-6 lg:grid-cols-2">
          <table className="table-almanac text-[0.92rem]">
            <thead><tr><th>Progressed</th><th>Position</th><th>Natal house</th></tr></thead>
            <tbody>
              {[...pr.points, ...pr.angles].map((x) => (
                <tr key={x.id}>
                  <td className="whitespace-nowrap"><PointGlyph id={x.id} className="mr-1 text-accent-bright" />{x.name}</td>
                  <td><Position lon={x.lon} />{x.retrograde && x.kind !== "angle" && x.kind !== "node" ? <span className="text-danger"> ℞</span> : null}</td>
                  <td className="num text-center">{x.house ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="engraved mb-1 text-[0.65rem] text-faint">In orb now (1°)</h4>
              {pr.current.length ? pr.current.map((a) => (
                <p key={`${a.a}${a.b}${a.type}`}>Progressed {name(a.a)} <AspectGlyph type={a.type} /> natal {name(a.b)} <span className="num text-faint">{formatArc(a.orb)}{a.applying === null ? "" : a.applying ? " applying" : " separating"}</span></p>
              )) : <p className="italic text-muted">None.</p>}
            </div>
            <div>
              <h4 className="engraved mb-1 text-[0.65rem] text-faint">Perfecting this profection year</h4>
              {pr.perfecting.length ? pr.perfecting.map((x) => (
                <p key={`${x.progressed}${x.natal}${x.aspect}${x.iso}`}><LocalTime iso={x.iso} mode="date" className="text-muted" /> — progressed {name(x.progressed)} <AspectGlyph type={x.aspect} /> natal {name(x.natal)}{x.retrograde ? " (℞)" : ""}</p>
              )) : <p className="italic text-muted">No progressed aspects perfect this year.</p>}
            </div>
          </div>
        </div>
      </Panel>

      <InterpretationPanel
        request={request}
        title="The year ahead"
        topic="my year ahead"
        facts={<div>Profection, Lord of the Year and its transits, solar return ({sr?.location.label ?? "—"}), progressions and numerology cycles are all sent to the interpreter.</div>}
        onClose={() => setReading(false)}
      />
    </div>
  );
}
