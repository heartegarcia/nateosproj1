import fs from "node:fs";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getAttachmentById, resolveSlotAttachmentDiskPath, softDeleteSlotAttachment } from "@/lib/socialContent";

type RouteContext = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attachmentId } = await params;
  const attachment = await getAttachmentById(attachmentId);
  if (!attachment || attachment.deleted_at) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const diskPath = resolveSlotAttachmentDiskPath(attachment);
  if (!fs.existsSync(diskPath)) return NextResponse.json({ error: "File missing" }, { status: 404 });

  const buffer = fs.readFileSync(diskPath);
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
