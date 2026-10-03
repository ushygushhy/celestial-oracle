import { notFound } from "next/navigation";
import { getPerson } from "@/lib/db/people";
import { chartForPerson } from "@/lib/services/chart-service";
import { reportOptionsFromParams, transitReport } from "@/lib/services/transit-service";
import { TransitView } from "@/components/transits/TransitView";

export default async function TransitsPage(props: PageProps<"/transits/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const person = getPerson(Number(id));
  if (!person) notFound();
  const natal = chartForPerson(person);
  const opts = reportOptionsFromParams(sp);
  const report = transitReport(natal, new Date(), opts);
  const q = new URLSearchParams();
  for (const k of ["months", "fast", "minor", "orb"]) {
    const v = sp[k];
    if (typeof v === "string" && v) q.set(k, v);
  }
  return <TransitView key={q.toString()} personId={person.id} natal={natal} report={report} query={q.toString()} />;
}
