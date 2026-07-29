import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { softDeleteEntry, updateEntry } from "@/lib/timeEntries";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  workDate: z.string().min(1).optional(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const entry = await updateEntry(id, parsed.data);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await softDeleteEntry(id);
  return NextResponse.json({ ok: true });
}
