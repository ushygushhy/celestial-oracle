import { z } from "zod";
import { getObserver, setObserver } from "@/lib/services/sky-service";

const Schema = z.object({ label: z.string().min(1).max(300), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });

export async function GET() {
  return Response.json({ observer: getObserver() });
}

export async function PUT(req: Request) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid location" }, { status: 400 });
  setObserver(parsed.data);
  return Response.json({ observer: parsed.data });
}

export async function DELETE() {
  setObserver(null);
  return Response.json({ observer: null });
}
