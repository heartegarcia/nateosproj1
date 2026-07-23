import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getEntryById, setEntryValue, softDeleteEntry, updateEntryTitle } from "@/lib/projectEntries";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entry = getEntryById(id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ entry });
}

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  values: z.record(z.string(), z.string()).optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.title !== undefined) updateEntryTitle(id, parsed.data.title);
  if (parsed.data.values) {
    for (const [fieldId, value] of Object.entries(parsed.data.values)) {
      setEntryValue(id, fieldId, value);
    }
  }

  const entry = getEntryById(id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  softDeleteEntry(id);
  return NextResponse.json({ ok: true });
}
