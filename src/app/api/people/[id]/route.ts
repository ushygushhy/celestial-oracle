import { deletePerson, getPerson, PersonInputSchema, updatePerson } from "@/lib/db/people";

export async function GET(_req: Request, ctx: RouteContext<"/api/people/[id]">) {
  const { id } = await ctx.params;
  const person = getPerson(Number(id));
  return person ? Response.json({ person }) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(req: Request, ctx: RouteContext<"/api/people/[id]">) {
  const { id } = await ctx.params;
  const parsed = PersonInputSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const person = updatePerson(Number(id), parsed.data);
  return person ? Response.json({ person }) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/people/[id]">) {
  const { id } = await ctx.params;
  return deletePerson(Number(id)) ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
}
