import { z } from "zod";
import { listCustomSpreads, saveCustomSpread } from "@/lib/db/tarot";

const Body = z.object({ name: z.string().trim().min(1).max(80), positions: z.array(z.object({ label: z.string().trim().min(1).max(60), meaning: z.string().max(160) })).min(1).max(15) });

export async function GET() {
  return Response.json({ spreads: listCustomSpreads() });
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid spread" }, { status: 400 });
  const id = saveCustomSpread(parsed.data.name, parsed.data.positions);
  return Response.json({ id: `custom-${id}` }, { status: 201 });
}
