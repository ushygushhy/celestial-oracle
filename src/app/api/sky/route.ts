import { skyNow } from "@/lib/services/sky-service";

/** GET /api/sky — live sky (positions, Moon, void of course, upcoming events). */
export async function GET() {
  try {
    return Response.json(skyNow(new Date()));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
