import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getTaskById, softDeleteTask, updateTask } from "@/lib/tasks";
import { syncEntryForTask } from "@/lib/projectEntries";
import { syncSocialSlotForTask } from "@/lib/socialContent";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  businessId: z.string().min(1).optional(),
  projectId: z.string().nullable().optional(),
  assignee: z.enum(["genie", "nate"]).optional(),
  status: z.enum(["not_started", "in_progress", "completed"]).optional(),
  basePriority: z.enum(["high", "medium", "low"]).optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  nateNote: z.string().nullable().optional(),
  channels: z.array(z.enum(["fb", "ig", "tiktok"])).nullable().optional(),
  contentStage: z.enum(["concept", "final"]).nullable().optional(),
});

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await getTaskById(id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const task = await updateTask(id, parsed.data);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await syncEntryForTask(task.id, task.project_id, task.title);
  await syncSocialSlotForTask(task);
  return NextResponse.json({ task });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await softDeleteTask(id);
  return NextResponse.json({ ok: true });
}
