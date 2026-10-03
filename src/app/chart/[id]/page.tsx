import { notFound } from "next/navigation";
import { getPerson, listPeople } from "@/lib/db/people";
import { chartForPerson, settingsFromParams } from "@/lib/services/chart-service";
import { ChartView } from "@/components/chart/ChartView";

const SETTING_KEYS = ["hs", "node", "pof", "orbs", "minorpts"];

export default async function ChartPage(props: PageProps<"/chart/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const person = getPerson(Number(id));
  if (!person) notFound();

  const chart = chartForPerson(person, settingsFromParams(sp, person));
  const q = new URLSearchParams();
  for (const k of SETTING_KEYS) {
    const v = sp[k];
    if (typeof v === "string" && v) q.set(k, v);
  }
  const people = listPeople().map((p) => ({ id: p.id, name: p.name }));
  return <ChartView key={`${person.id}-${q}`} personId={person.id} chart={chart} settingsQuery={q.toString()} people={people} />;
}
