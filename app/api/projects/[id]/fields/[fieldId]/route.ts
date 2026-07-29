import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { deleteProjectField } from "@/lib/projectFields";

type RouteContext = { params: Promise<{ id: string; fieldId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fieldId } = await params;
  await deleteProjectField(fieldId);
  return NextResponse.json({ ok: true });
}
