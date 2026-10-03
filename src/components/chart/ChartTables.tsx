"use client";
import type { ChartPoint, NatalChart } from "@/lib/astro/chart";
import { POINT_ORDER, POINTS, type PointId } from "@/lib/astro/constants";
import { zodiacPosition } from "@/lib/astro/math";
import { PointGlyph, SignGlyph } from "./Glyph";
import { ordinal } from "@/lib/astro/patterns";

const pad2 = (n: number) => String(n).padStart(2, "0");
const roman = ["", "I", "II", "III"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Position({ lon, uncertain, seconds = false }: { lon: number; uncertain?: boolean; seconds?: boolean }) {
  const z = zodiacPosition(lon);
  return (
    <span className="num whitespace-nowrap" title={`${z.degree}°${pad2(z.min)}'${pad2(z.sec)}" ${z.sign.name} (${lon.toFixed(4)}°)`}>
      {seconds ? `${z.degree}°${pad2(z.min)}'${pad2(z.sec)}"` : `${z.displayDeg}°${pad2(z.displayMin)}'`}{" "}
      <SignGlyph sign={z.sign.id} /> <span className="text-muted">{z.sign.name}</span>
      {uncertain && <span className="ml-1 text-danger" title="Unknown birth time — Moon position uncertain">?</span>}
    </span>
  );
}

function Motion({ p }: { p: ChartPoint }) {
  if (p.kind === "angle" || p.id === "fortune" || p.id === "vertex") return <span className="text-faint">—</span>;
  return (
    <span className="whitespace-nowrap">
      {p.retrograde ? <span className="text-danger" title="Retrograde">℞ retro</span> : <span className="text-muted">direct</span>}
      {p.station && <span className="ml-1 text-accent-bright" title={`Stationary, turning ${p.station}`}>· S{p.station === "direct" ? "D" : "R"}</span>}
    </span>
  );
}

function Dignity({ p }: { p: ChartPoint }) {
  const d = p.dignity;
  if (!d) return <span className="text-faint">—</span>;
  const tone = d.major.includes("domicile") || d.major.includes("exaltation") ? "text-success" : d.major.includes("detriment") || d.major.includes("fall") ? "text-danger" : "text-muted";
  const title = [
    d.major.length ? `Major: ${d.major.join(", ")}` : null,
    d.minor.length ? `Minor: ${d.minor.join(", ")}` : null,
    d.peregrine ? "Peregrine: no domicile, exaltation, triplicity, term or face" : null,
    `Term ruler: ${cap(d.rulers.term)} · Face: ${cap(d.rulers.face)}`,
    ...d.notes,
  ].filter(Boolean).join("\n");
  return (
    <span className="whitespace-nowrap" title={title}>
      <span className={tone}>{d.major.length ? d.major.join(" + ") : d.peregrine ? "peregrine" : "—"}</span>
      {d.minor.length > 0 && <span className="ml-1 text-xs text-faint">({d.minor.join(", ")})</span>}
      {d.score !== null && <span className="num ml-1.5 text-xs text-faint">{d.score > 0 ? "+" : ""}{d.score}</span>}
    </span>
  );
}

export function PlacementsTable({ chart, visible, onSelect }: { chart: NatalChart; visible: Set<PointId>; onSelect: (id: PointId) => void }) {
  const rows = POINT_ORDER.filter((id) => chart.points[id] && visible.has(id)).map((id) => chart.points[id]!);
  return (
    <div className="overflow-x-auto">
      <table className="table-almanac text-[0.92rem]">
        <thead>
          <tr>
            <th>Point</th>
            <th>Position</th>
            {chart.houses && <th>House</th>}
            <th>Motion</th>
            <th>Decan</th>
            <th>Dignity</th>
            <th>Decl.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="cursor-pointer" onClick={() => onSelect(p.id)}>
              <td className="whitespace-nowrap">
                <span className="inline-block w-7 text-center text-lg text-accent-bright"><PointGlyph id={p.id} /></span>
                {POINTS[p.id].name}
                {chart.chartRuler && (chart.chartRuler.traditional === p.id || chart.chartRuler.modern === p.id) && (
                  <span className="chip ml-2 !py-0 text-[0.62rem]" title="Ruler of the Ascendant">chart ruler{chart.chartRuler.modern === p.id ? " (mod.)" : ""}</span>
                )}
              </td>
              <td><Position lon={p.lon} uncertain={p.uncertain} /></td>
              {chart.houses && <td className="num text-center">{p.house ?? "—"}</td>}
              <td><Motion p={p} /></td>
              <td className="whitespace-nowrap text-muted">
                {p.kind === "angle" ? "—" : (
                  <span title={`Triplicity decan ruler: ${cap(p.decan.ruler)}${p.decan.modernRuler !== p.decan.ruler ? ` (modern ${cap(p.decan.modernRuler)})` : ""} · Chaldean face: ${cap(p.decan.faceRuler)}`}>
                    {roman[p.decan.number]} <span className="text-xs text-faint">{cap(p.decan.ruler)}/{cap(p.decan.faceRuler)}</span>
                  </span>
                )}
              </td>
              <td><Dignity p={p} /></td>
              <td className="num whitespace-nowrap text-muted">
                {p.decl !== null && p.kind !== "angle" ? (
                  <>
                    {p.decl >= 0 ? "+" : "−"}{Math.abs(p.decl).toFixed(2)}°
                    {p.outOfBounds && <span className="ml-1 text-xs text-accent-bright" title="Out of bounds: declination beyond the Sun's maximum">OOB</span>}
                  </>
                ) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HousesTable({ chart, onSelect }: { chart: NatalChart; onSelect: (house: number) => void }) {
  if (!chart.houses) return <p className="text-sm italic text-muted">Houses need a birth time.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="table-almanac text-[0.92rem]">
        <thead>
          <tr>
            <th>House</th>
            <th>Cusp</th>
            <th>Ruler</th>
            <th>Ruler&apos;s position</th>
            <th>Occupants</th>
          </tr>
        </thead>
        <tbody>
          {chart.houses.cusps.map((c) => {
            const ruler = chart.points[c.ruler];
            const modern = c.modernRuler !== c.ruler ? chart.points[c.modernRuler] : null;
            const occupants = POINT_ORDER.filter((id) => chart.points[id]?.house === c.house && !["asc", "mc", "dsc", "ic", ...(chart.settings.nodeType === "true" ? ["meanNode", "meanSouthNode"] : ["trueNode", "trueSouthNode"])].includes(id));
            return (
              <tr key={c.house} className="cursor-pointer" onClick={() => onSelect(c.house)}>
                <td className="engraved whitespace-nowrap text-[0.75rem] text-accent-bright">{ordinal(c.house)}</td>
                <td><Position lon={c.lon} /></td>
                <td className="whitespace-nowrap">
                  <PointGlyph id={c.ruler} className="text-accent-bright" /> {cap(c.ruler)}
                  {modern && <span className="text-xs text-faint"> · <PointGlyph id={c.modernRuler} /> {cap(c.modernRuler)}</span>}
                </td>
                <td className="whitespace-nowrap text-muted">
                  {ruler && <>{ruler.formatted.split(" ")[0]} <SignGlyph sign={ruler.sign} /> · {ordinal(ruler.house ?? 0)}{ruler.retrograde ? " ℞" : ""}</>}
                  {modern && <span className="block text-xs text-faint">{modern.formatted.split(" ")[0]} <SignGlyph sign={modern.sign} /> · {ordinal(modern.house ?? 0)}</span>}
                </td>
                <td className="text-lg tracking-wide text-text">
                  {occupants.length ? occupants.map((id) => <span key={id} title={POINTS[id].name} className="mr-1.5"><PointGlyph id={id} /></span>) : <span className="text-sm text-faint">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
