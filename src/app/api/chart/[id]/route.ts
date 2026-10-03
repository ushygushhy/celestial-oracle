import type { NextRequest } from "next/server";
import { getPerson } from "@/lib/db/people";
import { chartForPerson, settingsFromParams } from "@/lib/services/chart-service";

/** GET /api/chart/:personId?hs=P&node=true&pof=sect — full calculated natal chart as JSON. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/chart/[id]">) {
  const { id } = await ctx.params;
  const person = getPerson(Number(id));
  if (!person) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    return Response.json({ person, chart: chartForPerson(person, settingsFromParams(req.nextUrl.searchParams, person)) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
