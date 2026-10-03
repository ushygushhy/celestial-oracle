"use client";
import { useCallback, useEffect, useState } from "react";
import type { SkyData } from "@/lib/services/sky-service";
import type { ChartPoint } from "@/lib/astro/chart";
import { POINTS, SIGNS } from "@/lib/astro/constants";
import { ChartWheel } from "../chart/ChartWheel";
import { Position } from "../chart/ChartTables";
import { PointGlyph } from "../chart/Glyph";
import { Frame, Panel } from "../ui/Frame";
import { LocalTime } from "../ui/LocalTime";
import { MoonPhase } from "./MoonPhase";
import { PlaceSearch, type PlaceValue } from "../people/PlaceSearch";
import { askOracle } from "../chat/OracleChat";

const KIND_LABEL: Record<string, string> = { ingress: "Ingress", station: "Station", lunation: "Lunation", eclipse: "Eclipse" };

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);
  if (!now) return <span className="num">&nbsp;</span>;
  return <span className="num">{now.toLocaleString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>;
}

export function SkyView({ initial }: { initial: SkyData }) {
  const [data, setData] = useState(initial);
  const [editingPlace, setEditingPlace] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/sky", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const setPlace = async (p: PlaceValue | null) => {
    if (!p) return;
    await fetch("/api/settings/observer", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: p.label, lat: p.lat, lon: p.lon }) });
    setEditingPlace(false);
    refresh();
  };

  const wheelPoints = Object.values(data.chart.points).filter((p): p is ChartPoint => !!p && !["meanNode", "meanSouthNode", "vertex", "fortune"].includes(p.id));
  const majors = data.chart.aspects.filter((a) => ["conjunction", "opposition", "trine", "square", "sextile"].includes(a.type));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="engraved text-[0.65rem] text-faint">Sky now</p>
          <h1 className="font-masthead text-3xl font-bold tracking-wide">The Heavens at This Moment</h1>
          <p className="headline-italic mt-1 text-sm font-normal text-muted"><Clock /></p>
        </div>
        <div className="text-right text-sm">
          <p className="text-muted">
            Positions refreshed <LocalTime iso={data.generatedAt} mode="time" /> · every minute
            <button className="btn ml-2 px-2 py-0.5 text-[0.6rem]" onClick={refresh} disabled={refreshing}>{refreshing ? "…" : "Refresh"}</button>
          </p>
          <p className="mt-1 text-xs text-faint">
            Houses for: {data.observer ? data.observer.label : "no location set (signs only)"}{" "}
            <button className="underline decoration-dotted underline-offset-4 hover:text-accent-bright" onClick={() => setEditingPlace((e) => !e)}>{data.observer ? "change" : "set location"}</button>
          </p>
        </div>
      </div>
      {editingPlace && (
        <Panel title="Observer location (for houses and angles)">
          <PlaceSearch value={null} onChange={setPlace} />
        </Panel>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Frame className="!p-3 sm:!p-5">
          <div className="mx-auto max-w-[760px]">
            <ChartWheel chart={data.chart} points={wheelPoints} aspects={majors} onSelect={(t) => t.kind === "point" && askOracle({ text: `What does transiting ${POINTS[t.id].name} in ${SIGNS[data.chart.points[t.id]!.signIndex].name} mean for the collective right now?`, personId: null })} />
          </div>
        </Frame>

        <div className="space-y-5">
          <Panel title="The Moon">
            <div className="flex items-center gap-4">
              <MoonPhase elongation={data.moon.elongation} />
              <div className="text-sm">
                <p className="engraved text-[0.9rem] text-accent-bright">{data.moon.phase}</p>
                <p className="text-muted">{Math.round(data.moon.illumination * 100)}% illuminated · elongation {data.moon.elongation.toFixed(1)}°</p>
                {data.moon.ageDays !== null && <p className="text-muted">Lunation day {(data.moon.ageDays + 1).toFixed(1)}</p>}
                <p className="mt-1"><PointGlyph id="moon" className="text-accent-bright" /> <Position lon={data.points.find((p) => p.id === "moon")!.lon} /></p>
              </div>
            </div>
            <ul className="mt-3 space-y-1 border-t border-rule pt-2 text-sm">
              {data.moon.upcoming.map((l) => (
                <li key={l.iso} className="flex justify-between gap-2">
                  <span className="capitalize">{l.phase} Moon <span className="text-faint">· {SIGNS[Math.floor(l.lon / 30)].name}</span></span>
                  <LocalTime iso={l.iso} className="text-muted" />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Void of Course">
            {data.voc.active && data.voc.current ? (
              <div className="text-sm">
                <p className="engraved text-[0.85rem] text-danger">The Moon is void of course</p>
                <p className="mt-1 text-muted">
                  Since <LocalTime iso={data.voc.current.startIso} /> (last aspect: {data.voc.current.lastAspect ? `${data.voc.current.lastAspect.aspect} ${POINTS[data.voc.current.lastAspect.planet].name}` : "—"})
                </p>
                <p className="text-muted">Ends when the Moon enters {SIGNS[data.voc.current.nextSign].name} at <LocalTime iso={data.voc.current.ingressIso} /></p>
              </div>
            ) : (
              <div className="text-sm">
                <p className="engraved text-[0.85rem] text-success">The Moon is active</p>
                {data.voc.next && (
                  <p className="mt-1 text-muted">
                    Next void: <LocalTime iso={data.voc.next.startIso} /> → <LocalTime iso={data.voc.next.ingressIso} /> (Moon enters {SIGNS[data.voc.next.nextSign].name}; last aspect {data.voc.next.lastAspect ? `${data.voc.next.lastAspect.aspect} ${POINTS[data.voc.next.lastAspect.planet].name}` : "—"})
                  </p>
                )}
              </div>
            )}
            <p className="mt-2 text-[0.68rem] text-faint">Modern definition: from the Moon&apos;s last exact Ptolemaic aspect to Sun–Pluto until it changes sign.</p>
          </Panel>

          <Panel title="Coming Up · 45 days">
            <ul className="max-h-[22rem] space-y-1.5 overflow-y-auto text-sm">
              {data.events.map((e, i) => (
                <li key={`${e.iso}-${i}`} className="grid grid-cols-[6.5rem_1fr] gap-2 border-b border-rule pb-1">
                  <LocalTime iso={e.iso} mode="short" className="text-muted" />
                  <span>
                    {e.body && <PointGlyph id={e.body} className="mr-1 text-accent-bright" />}
                    {e.text} <span className="text-[0.65rem] text-faint">{KIND_LABEL[e.kind]} · <LocalTime iso={e.iso} mode="time" /></span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel title="Planetary Positions">
        <div className="overflow-x-auto">
          <table className="table-almanac text-[0.92rem]">
            <thead>
              <tr>
                <th>Body</th><th>Position</th>{data.observer && <th>House</th>}<th>Speed / day</th><th>Motion</th><th>Declination</th><th>Next sign change</th>
              </tr>
            </thead>
            <tbody>
              {data.points.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap"><span className="inline-block w-7 text-center text-lg text-accent-bright"><PointGlyph id={p.id} /></span>{POINTS[p.id].name}</td>
                  <td><Position lon={p.lon} seconds /></td>
                  {data.observer && <td className="num text-center">{p.house ?? "—"}</td>}
                  <td className="num">{p.speed >= 0 ? "+" : "−"}{Math.abs(p.speed).toFixed(4)}°</td>
                  <td className="whitespace-nowrap">{p.retrograde && p.kind !== "node" ? <span className="text-danger">℞ retrograde</span> : <span className="text-muted">direct</span>}{p.station && <span className="ml-1 text-accent-bright">· stationary</span>}</td>
                  <td className="num text-muted">{p.decl !== null ? `${p.decl >= 0 ? "+" : "−"}${Math.abs(p.decl).toFixed(2)}°` : "—"}{p.outOfBounds && <span className="ml-1 text-xs text-accent-bright">OOB</span>}</td>
                  <td className="whitespace-nowrap">{p.nextIngress ? <>{p.nextIngress.sign}{p.nextIngress.retrograde ? " (℞)" : ""} · <LocalTime iso={p.nextIngress.iso} className="text-muted" /></> : <span className="text-faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Eclipses · next twelve months">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.eclipses.map((e) => (
            <li key={e.iso} className="panel p-3 text-sm">
              <p className="engraved text-[0.75rem] text-accent-bright">{e.type} {e.kind}</p>
              <p><LocalTime iso={e.iso} /></p>
              <p className="text-muted"><Position lon={e.lon} /></p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
