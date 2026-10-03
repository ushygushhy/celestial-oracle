import type { NextRequest } from "next/server";
import { resolveMoment } from "@/lib/astro/time";

/** GET /api/timezone?lat=&lon=&date=YYYY-MM-DD&time=HH:mm[&tz=][&offset=minutes] — preview of the UTC conversion. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lat = Number(p.get("lat")), lon = Number(p.get("lon"));
  const date = p.get("date");
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !date) {
    return Response.json({ error: "lat, lon and date are required" }, { status: 400 });
  }
  try {
    const offset = p.get("offset");
    const m = resolveMoment({
      date,
      time: p.get("time") || null,
      lat,
      lon,
      tz: p.get("tz") || null,
      utcOffsetMinutes: offset !== null && offset !== "" ? Number(offset) : null,
    });
    return Response.json(m);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
