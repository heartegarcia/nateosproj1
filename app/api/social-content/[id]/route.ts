import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getSlotById, setDriveLink } from "@/lib/socialContent";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const slot = await getSlotById(id);
  if (!slot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ slot });
}

const updateSchema = z.object({ driveLink: z.string() });

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const slot = await setDriveLink(id, parsed.data.driveLink);
  if (!slot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ slot });
}
