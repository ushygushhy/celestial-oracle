import { deleteUpload } from "@/lib/db/uploads";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/upload/[id]">) {
  const { id } = await ctx.params;
  deleteUpload(Number(id));
  return Response.json({ ok: true });
}
