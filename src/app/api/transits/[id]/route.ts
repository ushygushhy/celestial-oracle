import type { NextRequest } from "next/server";
import { getPerson } from "@/lib/db/people";
import { chartForPerson } from "@/lib/services/chart-service";
import { reportOptionsFromParams, transitReport } from "@/lib/services/transit-service";

/** GET /api/transits/:personId?months=12&fast=1&minor=1&orb=tight|wide */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/transits/[id]">) {
  const { id } = await ctx.params;
  const person = getPerson(Number(id));
  if (!person) return Response.json({ error: "Not found" }, { status: 404 });
  const opts = reportOptionsFromParams(Object.fromEntries(req.nextUrl.searchParams));
  return Response.json(transitReport(chartForPerson(person), new Date(), opts));
}
