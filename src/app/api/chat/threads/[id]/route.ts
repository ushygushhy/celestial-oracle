import { deleteThread, getThread, loadMessages } from "@/lib/db/chat";
import { toDisplay } from "@/lib/ai/chat-display";

export async function GET(_req: Request, ctx: RouteContext<"/api/chat/threads/[id]">) {
  const { id } = await ctx.params;
  const t = getThread(Number(id));
  if (!t) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ thread: { id: t.id, personId: t.person_id, title: t.title }, items: toDisplay(loadMessages(t.id)) });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/chat/threads/[id]">) {
  const { id } = await ctx.params;
  deleteThread(Number(id));
  return Response.json({ ok: true });
}
