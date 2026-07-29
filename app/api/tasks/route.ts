import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createTask, listTasks } from "@/lib/tasks";
import { syncEntryForTask } from "@/lib/projectEntries";
import { syncSocialSlotForTask } from "@/lib/socialContent";
import type { TaskFilters } from "@/lib/types";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const sp = url.searchParams;

  const filters: TaskFilters = {
    assignee: (sp.get("assignee") as TaskFilters["assignee"]) || undefined,
    businessId: sp.get("businessId") || undefined,
    projectId: sp.get("projectId") || undefined,
    status: (sp.get("status") as TaskFilters["status"]) || undefined,
    priority: (sp.get("priority") as TaskFilters["priority"]) || undefined,
    dueFrom: sp.get("dueFrom") || undefined,
    dueTo: sp.get("dueTo") || undefined,
  };

  const todayParam = sp.get("today");
  const today = todayParam ? new Date(todayParam + "T12:00:00") : new Date();

  const tasks = await listTasks(filters, today);
  return NextResponse.json({ tasks });
}

const createSchema = z.object({
  title: z.string().min(1),
  businessId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  assignee: z.enum(["genie", "nate"]).optional(),
  status: z.enum(["not_started", "in_progress", "completed"]).optional(),
  basePriority: z.enum(["high", "medium", "low"]).optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  channels: z.array(z.enum(["fb", "ig", "tiktok"])).nullable().optional(),
  contentStage: z.enum(["concept", "final"]).nullable().optional(),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const task = await createTask(parsed.data);
  await syncEntryForTask(task.id, task.project_id, task.title);
  await syncSocialSlotForTask(task);
  return NextResponse.json({ task }, { status: 201 });
}
