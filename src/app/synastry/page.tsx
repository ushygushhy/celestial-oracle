import Link from "next/link";
import { cookies } from "next/headers";
import { getPerson, listPeople } from "@/lib/db/people";
import { chartForPerson } from "@/lib/services/chart-service";
import { synastry } from "@/lib/services/synastry-service";
import { SynastryView } from "@/components/synastry/SynastryView";
import { Frame } from "@/components/ui/Frame";

export default async function SynastryPage(props: PageProps<"/synastry">) {
  const sp = await props.searchParams;
  const people = listPeople();
  if (people.length < 2) {
    return (
      <div className="mx-auto max-w-2xl">
        <Frame title="Synastry" subtitle="Two charts, one conversation">
          <p className="text-muted">Synastry needs at least two saved people. <Link href="/people/new" className="text-accent-bright underline">Cast another chart</Link>.</p>
        </Frame>
      </div>
    );
  }
  const cookiePerson = Number((await cookies()).get("person")?.value) || null;
  const aId = Number(sp.a) || cookiePerson || people[0].id;
  const pa = getPerson(aId) ?? people[0];
  const requestedB = Number(sp.b) !== pa.id ? getPerson(Number(sp.b)) : null;
  const pb = requestedB ?? people.find((p) => p.id !== pa.id)!;
  const s = synastry(chartForPerson(pa), chartForPerson(pb));
  return <SynastryView key={`${pa.id}-${pb.id}`} aId={pa.id} bId={pb.id} a={s.a} b={s.b} bOnA={s.bOnA} aOnB={s.aOnB} composite={s.composite} people={people.map((p) => ({ id: p.id, name: p.name }))} />;
}
