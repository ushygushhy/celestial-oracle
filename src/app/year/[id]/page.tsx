import { notFound } from "next/navigation";
import { getPerson } from "@/lib/db/people";
import { chartForPerson } from "@/lib/services/chart-service";
import { yearReport, type YearLocation } from "@/lib/services/year-service";
import { YearView } from "@/components/year/YearView";

export default async function YearPage(props: PageProps<"/year/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const person = getPerson(Number(id));
  if (!person) notFound();
  const natal = chartForPerson(person);
  const lat = Number(sp.srlat), lon = Number(sp.srlon);
  const location: YearLocation | null = Number.isFinite(lat) && Number.isFinite(lon) && sp.srlat !== undefined
    ? { lat, lon, label: typeof sp.srlabel === "string" ? sp.srlabel : `${lat.toFixed(2)}, ${lon.toFixed(2)}` }
    : null;
  // Server and browser run on the same machine, so the server's zone is the user's.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const report = yearReport(person, natal, new Date(), location, timezone);
  return <YearView key={`${person.id}-${location?.lat}-${location?.lon}`} personId={person.id} natal={natal} report={report} location={location} timezone={timezone} />;
}
