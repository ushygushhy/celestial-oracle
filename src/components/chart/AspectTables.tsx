"use client";
import type { Aspect } from "@/lib/astro/aspects";
import { POINTS, type PointId } from "@/lib/astro/constants";
import { formatArc } from "@/lib/astro/math";
import { aspectColor } from "@/lib/design/tokens";
import { AspectGlyph, PointGlyph } from "./Glyph";

/** Triangular aspectarian grid. */
export function AspectGrid({ ids, aspects, onSelect }: { ids: PointId[]; aspects: Aspect[]; onSelect: (a: Aspect) => void }) {
  const map = new Map<string, Aspect>();
  for (const a of aspects) {
    map.set(`${a.a}|${a.b}`, a);
    map.set(`${a.b}|${a.a}`, a);
  }
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <tbody>
          {ids.map((row, i) => (
            <tr key={row}>
              {ids.slice(0, i).map((col) => {
                const a = map.get(`${row}|${col}`);
                return (
                  <td
                    key={col}
                    onClick={() => a && onSelect(a)}
                    title={a ? `${POINTS[a.a].name} ${a.type} ${POINTS[a.b].name} — orb ${formatArc(a.orb)}${a.applying === null ? "" : a.applying ? " applying" : " separating"}` : undefined}
                    className={`h-9 w-9 border border-rule text-center align-middle ${a ? "cursor-pointer hover:bg-[rgb(204_168_116/0.1)]" : ""}`}
                    style={a ? { boxShadow: `inset 0 0 0 999px color-mix(in srgb, ${aspectColor[a.type]} ${Math.round(4 + a.strength * 12)}%, transparent)` } : undefined}
                  >
                    {a && (
                      <div className="flex flex-col items-center leading-none">
                        <AspectGlyph type={a.type} className="text-[0.95rem]" />
                        <span className="num mt-0.5 text-[0.55rem] text-faint">
                          {Math.floor(a.orb)}°{a.applying === null ? "" : a.applying ? "a" : "s"}
                        </span>
                      </div>
                    )}
                  </td>
                );
              })}
              <td className="h-9 w-9 border border-rule-strong text-center text-base text-accent-bright" title={POINTS[row].name}>
                <PointGlyph id={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AspectList({ aspects, onSelect, labelA, labelB }: { aspects: Aspect[]; onSelect: (a: Aspect) => void; labelA?: string; labelB?: string }) {
  if (!aspects.length) return <p className="text-sm italic text-muted">No aspects with the current filters.</p>;
  return (
    <div className="max-h-[28rem] overflow-y-auto">
      <table className="table-almanac text-[0.9rem]">
        <thead>
          <tr>
            <th>{labelA ?? "Point"}</th>
            <th>Aspect</th>
            <th>{labelB ?? "Point"}</th>
            <th>Orb</th>
            <th>Phase</th>
          </tr>
        </thead>
        <tbody>
          {aspects.map((a) => (
            <tr key={`${a.a}-${a.b}-${a.type}`} className="cursor-pointer" onClick={() => onSelect(a)}>
              <td className="whitespace-nowrap"><PointGlyph id={a.a} className="mr-1 text-accent-bright" />{POINTS[a.a].name}</td>
              <td className="whitespace-nowrap"><AspectGlyph type={a.type} className="mr-1" /> <span className="text-muted">{a.type}</span></td>
              <td className="whitespace-nowrap"><PointGlyph id={a.b} className="mr-1 text-accent-bright" />{POINTS[a.b].name}</td>
              <td className="num whitespace-nowrap">{formatArc(a.orb)}{a.outOfSign && <span className="ml-1 text-xs text-faint" title="Out-of-sign (dissociate) aspect">o/s</span>}</td>
              <td className="whitespace-nowrap text-muted">{a.applying === null ? "—" : a.applying ? "applying" : "separating"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
