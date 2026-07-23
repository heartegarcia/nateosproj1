import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createProjectField, listProjectFields } from "@/lib/projectFields";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  return NextResponse.json({ fields: listProjectFields(id) });
}

const createSchema = z.object({
  label: z.string().min(1),
  fieldType: z.enum(["text", "longtext", "date", "link", "auto_number", "select"]).optional(),
  autoNumberPrefix: z.string().nullable().optional(),
  syncToCalendar: z.boolean().optional(),
  options: z.array(z.string().min(1)).optional(),
  isStatus: z.boolean().optional(),
});

export async function POST(request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const field = createProjectField(id, parsed.data);
  return NextResponse.json({ field }, { status: 201 });
}
