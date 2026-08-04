import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSopDocumentBuffer, getSopDocumentById } from "@/lib/sopDocuments";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await getSopDocumentById(id);
  if (!doc || doc.deleted_at) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bytes = await getSopDocumentBuffer(doc);
  if (!bytes) {
    return NextResponse.json({ error: "File missing in storage" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.file_name ?? doc.title)}"`,
    },
  });
}
