import { cookies } from "next/headers";
import { getPerson, listPeople } from "@/lib/db/people";
import { fullProfile, type NumerologySystem } from "@/lib/numerology/full";
import { NumerologyView } from "@/components/numerology/NumerologyView";

export default async function NumerologyPage(props: PageProps<"/numerology">) {
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const system: NumerologySystem = str("system") === "chaldean" ? "chaldean" : "pythagorean";
  const cookiePerson = Number((await cookies()).get("person")?.value) || null;
  const manual = str("name") && /^\d{4}-\d{2}-\d{2}$/.test(str("date") ?? "");
  const personId = manual ? null : Number(str("person")) || cookiePerson;
  const person = personId ? getPerson(personId) : null;
  const now = new Date();
  const on = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  const profile = manual
    ? fullProfile(str("name")!, str("date")!, on, system)
    : person ? fullProfile(person.fullBirthName || person.name, person.birthDate, on, system) : null;
  return (
    <NumerologyView
      key={`${personId}-${str("name")}-${system}`}
      profile={profile}
      people={listPeople().map((p) => ({ id: p.id, name: p.name }))}
      personId={person?.id ?? null}
      today={now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
    />
  );
}
