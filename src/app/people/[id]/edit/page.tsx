import { notFound } from "next/navigation";
import { getPerson } from "@/lib/db/people";
import { PersonForm } from "@/components/people/PersonForm";
import { Frame } from "@/components/ui/Frame";
import { DeletePersonButton } from "@/components/people/DeletePersonButton";

export default async function EditPersonPage(props: PageProps<"/people/[id]/edit">) {
  const { id } = await props.params;
  const p = getPerson(Number(id));
  if (!p) notFound();
  const offset = p.utcOffsetOverride;
  return (
    <div className="mx-auto max-w-3xl">
      <Frame title={`Edit ${p.name}`} subtitle="Saving recasts the chart and clears cached interpretations." actions={<DeletePersonButton id={p.id} name={p.name} />}>
        <PersonForm
          initial={{
            id: p.id,
            name: p.name,
            fullBirthName: p.fullBirthName ?? "",
            birthDate: p.birthDate,
            birthTime: p.birthTime ?? "",
            timeUnknown: !p.birthTime,
            place: { label: p.placeName, lat: p.lat, lon: p.lon, tz: p.tz },
            tzOverride: "",
            offsetOverride: offset === null ? "" : `${offset < 0 ? "-" : "+"}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`,
            houseSystem: p.houseSystem,
            notes: p.notes ?? "",
          }}
        />
      </Frame>
    </div>
  );
}
