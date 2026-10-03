import { cookies } from "next/headers";
import { listPeople } from "@/lib/db/people";
import { listCustomSpreads } from "@/lib/db/tarot";
import { TarotTable } from "@/components/tarot/TarotTable";

export default async function TarotPage() {
  const person = Number((await cookies()).get("person")?.value) || null;
  const people = listPeople().map((p) => ({ id: p.id, name: p.name }));
  return <TarotTable customSpreads={listCustomSpreads()} people={people} defaultPersonId={people.some((p) => p.id === person) ? person : null} />;
}
