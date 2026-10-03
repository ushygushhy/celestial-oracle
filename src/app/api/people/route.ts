import { createPerson, listPeople, PersonInputSchema } from "@/lib/db/people";
import { computeChart } from "@/lib/astro/chart";

export async function GET() {
  return Response.json({ people: listPeople() });
}

export async function POST(req: Request) {
  const parsed = PersonInputSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input", issues: parsed.error.issues }, { status: 400 });
  const input = parsed.data;
  try {
    // Validate that the chart can be cast before saving.
    computeChart({ date: input.birthDate, time: input.birthTime ?? null, lat: input.lat, lon: input.lon, tz: input.tz, utcOffsetMinutes: input.utcOffsetOverride });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  return Response.json({ person: createPerson(input) }, { status: 201 });
}
