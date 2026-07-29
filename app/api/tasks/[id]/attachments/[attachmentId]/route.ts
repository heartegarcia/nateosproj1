import fs from "node:fs";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getAttachmentById, resolveAttachmentDiskPath, softDeleteAttachment } from "@/lib/attachments";

type RouteContext = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, attachmentId } = await params;
  const attachment = await getAttachmentById(attachmentId);
  if (!attachment || attachment.task_id !== id || attachment.deleted_at) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const diskPath = resolveAttachmentDiskPath(attachment);
  if (!fs.existsSync(diskPath)) {
    return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
  }

  const bytes = fs.readFileSync(diskPath);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.file_name)}"`,
      "Content-Length": String(attachment.file_size),
    },
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, attachmentId } = await params;
  const attachment = await getAttachmentById(attachmentId);
  if (!attachment || attachment.task_id !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await softDeleteAttachment(attachmentId);
  return NextResponse.json({ ok: true });
}
