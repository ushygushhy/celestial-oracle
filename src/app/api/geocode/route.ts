import type { NextRequest } from "next/server";
import { searchPlaces, suggestPlaces } from "@/lib/geo/geocode";

/** GET /api/geocode?q=Ulm&mode=search|suggest */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const mode = req.nextUrl.searchParams.get("mode") ?? "suggest";
  try {
    const places = mode === "search" ? await searchPlaces(q) : suggestPlaces(q);
    return Response.json({ places });
  } catch (e) {
    return Response.json({ places: [], error: (e as Error).message }, { status: 502 });
  }
}
