import { notFound } from "next/navigation";
import { getUpload } from "@/lib/db/uploads";
import { getPerson, listPeople } from "@/lib/db/people";
import { chartFromExtraction, compareCharts } from "@/lib/upload/manual-chart";
import { chartForPerson } from "@/lib/services/chart-service";
import { UploadedChartView } from "@/components/upload/UploadedChartView";

export default async function UploadedPage(props: PageProps<"/upload/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const up = getUpload(Number(id));
  if (!up) notFound();
  const chart = chartFromExtraction(up.data, up.label);
  const compareId = Number(sp.compare) || null;
  const person = compareId ? getPerson(compareId) : null;
  const comparison = person ? compareCharts(chart, chartForPerson(person)) : null;
  return <UploadedChartView id={up.id} chart={chart} people={listPeople().map((p) => ({ id: p.id, name: p.name }))} compareId={person?.id ?? null} comparison={comparison} comparedName={person?.name ?? null} />;
}
