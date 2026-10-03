import Link from "next/link";
import { notFound } from "next/navigation";
import { getReading } from "@/lib/db/tarot";
import { CARD_BY_ID } from "@/lib/tarot/deck";
import { Frame, Panel } from "@/components/ui/Frame";
import { Markdown } from "@/components/ui/Markdown";
import { SpreadLayout } from "@/components/tarot/SpreadLayout";
import { LocalTime } from "@/components/ui/LocalTime";

export default async function ReadingPage(props: PageProps<"/tarot/journal/[id]">) {
  const { id } = await props.params;
  const r = getReading(Number(id));
  if (!r) notFound();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="engraved text-[0.65rem] text-faint">Journal · <LocalTime iso={r.createdAt.replace(" ", "T") + "Z"} /></p>
          <h1 className="font-masthead text-2xl font-bold tracking-wide">{r.question || r.spread.name}</h1>
          <p className="headline-italic text-sm font-normal text-muted">{r.spread.name}{r.personName ? ` · read for ${r.personName}` : ""}</p>
        </div>
        <Link href="/tarot/journal" className="btn">All readings</Link>
      </div>
      <Frame>
        <div className="overflow-x-auto py-4">
          <SpreadLayout spread={r.spread} drawn={r.cards} revealed={r.cards.map(() => true)} width={r.cards.length > 10 ? 78 : r.cards.length > 3 ? 92 : 128} />
        </div>
      </Frame>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel title="The cards">
          <ul className="space-y-2 text-sm">
            {r.cards.map((c, i) => {
              const card = CARD_BY_ID.get(c.id)!;
              const side = c.reversed ? card.reversed : card.upright;
              return (
                <li key={i} className="border-b border-rule pb-2">
                  <p className="engraved text-[0.62rem] text-faint">{r.spread.positions[i]?.label}</p>
                  <p className="text-accent-bright">{card.name}{c.reversed ? " (reversed)" : ""}</p>
                  <p className="text-muted">{side.keywords.join(" · ")}</p>
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel title="Interpretation">
          {r.interpretation ? <Markdown text={r.interpretation} /> : <p className="italic text-muted">This reading was saved without an interpretation.</p>}
        </Panel>
      </div>
    </div>
  );
}
