import Link from "next/link";
import { listPeople } from "@/lib/db/people";
import { computeChart } from "@/lib/astro/chart";
import { personToChartInput } from "@/lib/db/people";
import { Frame } from "@/components/ui/Frame";
import { PointGlyph, SignGlyph } from "@/components/chart/Glyph";
import type { PointId } from "@/lib/astro/constants";

export default function PeoplePage() {
  const people = listPeople();
  return (
    <Frame title="The Register" subtitle="Everyone whose stars you keep." actions={<Link href="/people/new" className="btn btn-gilt">＋ New chart</Link>}>
      {people.length === 0 ? (
        <p className="py-8 text-center italic text-muted">No charts yet. Cast the first one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => {
            let big3: { id: PointId; sign: string; deg: string }[] = [];
            try {
              const c = computeChart(personToChartInput(p));
              big3 = (["sun", "moon", "asc"] as PointId[]).filter((id) => c.points[id]).map((id) => ({ id, sign: c.points[id]!.sign, deg: c.points[id]!.formatted.split(" ")[0] }));
            } catch { /* ignore */ }
            return (
              <Link key={p.id} href={`/chart/${p.id}`} className="panel block p-4 transition hover:shadow-[var(--shadow-glow)]">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="engraved text-base text-accent-bright">{p.name}</h3>
                  <span className="text-xs text-faint">{p.source === "upload" ? "from upload" : ""}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted">{p.birthDate} · {p.birthTime ?? "time unknown"} · {p.placeName}</p>
                <p className="mt-2 flex gap-4 text-sm">
                  {big3.map((b) => (
                    <span key={b.id} className="num"><PointGlyph id={b.id} className="text-accent-bright" /> {b.deg} <SignGlyph sign={b.sign as never} /></span>
                  ))}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </Frame>
  );
}
