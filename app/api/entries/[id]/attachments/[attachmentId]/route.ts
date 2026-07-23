import fs from "node:fs";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getEntryAttachmentById, resolveEntryAttachmentDiskPath, softDeleteEntryAttachment } from "@/lib/entryAttachments";

type RouteContext = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, attachmentId } = await params;
  const attachment = getEntryAttachmentById(attachmentId);
  if (!attachment || attachment.entry_id !== id || attachment.deleted_at) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const diskPath = resolveEntryAttachmentDiskPath(attachment);
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
  const attachment = getEntryAttachmentById(attachmentId);
  if (!attachment || attachment.entry_id !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  softDeleteEntryAttachment(attachmentId);
  return NextResponse.json({ ok: true });
}
