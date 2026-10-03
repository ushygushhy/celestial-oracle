import type { NextRequest } from "next/server";
import { listThreads } from "@/lib/db/chat";
import { aiConfigured } from "@/lib/ai/client";

/** GET /api/chat/threads[?person=ID|none] */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("person");
  const personId = p === null ? undefined : p === "none" ? null : Number(p);
  return Response.json({ threads: listThreads(personId), configured: aiConfigured() });
}
