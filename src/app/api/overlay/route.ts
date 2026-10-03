import type { NextRequest } from "next/server";
import { getPerson } from "@/lib/db/people";
import { chartForPerson, settingsFromParams } from "@/lib/services/chart-service";
import { buildOverlay, type OverlayKind } from "@/lib/services/overlay-service";

/** GET /api/overlay?person=1&kind=transits|progressions|synastry[&date=ISO][&other=2][&hs=P] */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const person = getPerson(Number(p.get("person")));
  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });
  const kind = (p.get("kind") ?? "transits") as OverlayKind;
  if (!["transits", "progressions", "synastry"].includes(kind)) return Response.json({ error: "Unknown overlay" }, { status: 400 });
  try {
    const natal = chartForPerson(person, settingsFromParams(p, person));
    const dateParam = p.get("date");
    const date = dateParam ? new Date(dateParam) : new Date();
    if (Number.isNaN(date.getTime())) return Response.json({ error: "Invalid date" }, { status: 400 });
    let partner;
    if (kind === "synastry") {
      const other = getPerson(Number(p.get("other")));
      if (!other) return Response.json({ error: "Choose a second person" }, { status: 400 });
      partner = chartForPerson(other);
    }
    return Response.json(buildOverlay(natal, kind, { date, partner }));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
