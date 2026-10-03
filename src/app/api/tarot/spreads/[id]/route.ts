import { deleteCustomSpread } from "@/lib/db/tarot";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/tarot/spreads/[id]">) {
  const { id } = await ctx.params;
  deleteCustomSpread(Number(String(id).replace("custom-", "")));
  return Response.json({ ok: true });
}
