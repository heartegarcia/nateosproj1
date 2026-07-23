import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSlotById, saveSlotAttachment } from "@/lib/socialContent";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const slot = getSlotById(id);
  if (!slot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ attachments: slot.attachments });
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const slot = getSlotById(id);
  if (!slot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });

  const attachment = await saveSlotAttachment(id, file);
  return NextResponse.json({ attachment }, { status: 201 });
}
