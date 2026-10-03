import { PersonForm } from "@/components/people/PersonForm";
import { Frame } from "@/components/ui/Frame";

export default async function NewPersonPage(props: PageProps<"/people/new">) {
  const sp = await props.searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const prefilled = s("name") || s("date") || s("place");
  return (
    <div className="mx-auto max-w-3xl">
      <Frame title="Cast a New Chart" subtitle="Enter the birth data exactly as recorded — the clock time on the certificate, not converted.">
        {prefilled && <p className="mb-4 text-sm text-muted">Prefilled from an uploaded chart. Search the birth place and pick the right result, then check the time zone line before casting.</p>}
        <PersonForm
          initial={prefilled ? {
            name: s("name"), fullBirthName: "", birthDate: /^\d{4}-\d{2}-\d{2}$/.test(s("date")) ? s("date") : "", birthTime: /^\d{1,2}:\d{2}/.test(s("time")) ? s("time").slice(0, 5).padStart(5, "0") : "",
            timeUnknown: !s("time"), place: null, tzOverride: "", offsetOverride: "", houseSystem: "P", notes: "Recalculated from an uploaded chart",
          } : undefined}
          initialPlaceQuery={s("place")}
        />
      </Frame>
    </div>
  );
}
