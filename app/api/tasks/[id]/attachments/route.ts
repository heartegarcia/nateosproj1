import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listAttachments, saveAttachment } from "@/lib/attachments";
import { getTaskById } from "@/lib/tasks";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  return NextResponse.json({ attachments: await listAttachments(id) });
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await getTaskById(id);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });

  const file = formData.get("file");
  const folder = formData.get("folder");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds the 25MB limit" }, { status: 400 });
  }

  const attachment = await saveAttachment(id, typeof folder === "string" ? folder : "General", file);
  return NextResponse.json({ attachment }, { status: 201 });
}
