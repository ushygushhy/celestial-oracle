import { deleteReading, getReading } from "@/lib/db/tarot";

export async function GET(_req: Request, ctx: RouteContext<"/api/tarot/readings/[id]">) {
  const { id } = await ctx.params;
  const r = getReading(Number(id));
  return r ? Response.json({ reading: r }) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/tarot/readings/[id]">) {
  const { id } = await ctx.params;
  deleteReading(Number(id));
  return Response.json({ ok: true });
}
