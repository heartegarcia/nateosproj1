import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getAttachmentById, getSlotAttachmentBuffer, softDeleteSlotAttachment } from "@/lib/socialContent";

type RouteContext = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attachmentId } = await params;
  const attachment = await getAttachmentById(attachmentId);
  if (!attachment || attachment.deleted_at) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await getSlotAttachmentBuffer(attachment);
  if (!buffer) return NextResponse.json({ error: "File missing in storage" }, { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.file_name)}"`,
    },
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attachmentId } = await params;
  await softDeleteSlotAttachment(attachmentId);
  return NextResponse.json({ ok: true });
}
