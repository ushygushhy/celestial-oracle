"use client";
import { useRouter } from "next/navigation";
import type { NatalChart, ChartPoint } from "@/lib/astro/chart";
import type { ComparisonRow } from "@/lib/upload/manual-chart";
import { POINTS } from "@/lib/astro/constants";
import { formatLon } from "@/lib/astro/math";
import { ChartWheel } from "../chart/ChartWheel";
import { PlacementsTable } from "../chart/ChartTables";
import { Frame, Panel } from "../ui/Frame";

export function UploadedChartView({ id, chart, people, compareId, comparison, comparedName }: {
  id: number; chart: NatalChart; people: { id: number; name: string }[]; compareId: number | null; comparison: ComparisonRow[] | null; comparedName: string | null;
}) {
  const router = useRouter();
  const points = Object.values(chart.points).filter((p): p is ChartPoint => !!p);
  const visible = new Set(points.map((p) => p.id));
  const majors = chart.aspects.filter((a) => ["conjunction", "opposition", "trine", "square", "sextile"].includes(a.type));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="engraved text-[0.65rem] text-faint">Uploaded chart</p>
          <h1 className="font-masthead text-3xl font-bold tracking-wide">{chart.name}</h1>
          <p className="headline-italic text-sm font-normal text-muted">Placements as read from the file — not recalculated.</p>
        </div>
        <button className="btn !text-danger" onClick={async () => { if (!confirm("Delete this upload?")) return; await fetch(`/api/upload/${id}`, { method: "DELETE" }); router.push("/upload"); }}>Delete</button>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Frame><div className="mx-auto max-w-[680px]"><ChartWheel chart={chart} points={points} aspects={majors} /></div></Frame>
        <Panel title="Compare with a calculated chart">
          <select className="field mb-3" value={compareId ?? ""} onChange={(e) => router.push(`/upload/${id}${e.target.value ? `?compare=${e.target.value}` : ""}`)}>
            <option value="">Choose a saved person…</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {comparison ? (
            <table className="table-almanac text-sm">
              <thead><tr><th>Point</th><th>Uploaded</th><th>Calculated ({comparedName})</th><th>Difference</th></tr></thead>
              <tbody>
                {comparison.map((r) => (
                  <tr key={r.id} className={r.delta !== null && r.delta > 2 ? "bg-[rgb(200_85_93/0.12)]" : ""}>
                    <td>{POINTS[r.id].name}</td>
                    <td className="num">{formatLon(r.extracted)}</td>
                    <td className="num">{r.calculated !== null ? formatLon(r.calculated) : "—"}</td>
                    <td className={`num ${r.delta !== null && r.delta > 2 ? "text-danger" : "text-success"}`}>{r.delta === null ? "—" : `${r.delta.toFixed(1)}′`}{r.signMatch === false ? " · sign differs" : ""}{r.houseExtracted && r.houseCalculated && r.houseExtracted !== r.houseCalculated ? ` · house ${r.houseExtracted}→${r.houseCalculated}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm italic text-muted">Pick the person this chart belongs to. Rows that differ by more than 2′ are highlighted — usually a misread glyph or a different birth time or timezone.</p>}
        </Panel>
      </div>
      <Panel title="Placements">
        <PlacementsTable chart={chart} visible={visible} onSelect={() => {}} />
      </Panel>
    </div>
  );
}
