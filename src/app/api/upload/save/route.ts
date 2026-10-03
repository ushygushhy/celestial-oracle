import { z } from "zod";
import { ExtractionSchema } from "@/lib/upload/schema";
import { saveUpload } from "@/lib/db/uploads";

const Body = z.object({ label: z.string().trim().min(1).max(120), personId: z.number().int().nullish(), data: ExtractionSchema });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid chart data" }, { status: 400 });
  const { label, personId, data } = parsed.data;
  for (const p of data.placements) {
    if (p.degree < 0 || p.degree > 29 || p.minute < 0 || p.minute > 59) return Response.json({ error: `${p.label}: degree must be 0–29 and minute 0–59` }, { status: 400 });
  }
  return Response.json({ id: saveUpload(label, data, personId ?? null) }, { status: 201 });
}
