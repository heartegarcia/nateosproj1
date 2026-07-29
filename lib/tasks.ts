import { randomUUID } from "node:crypto";
import { db } from "./db";
import { computeEffectivePriority } from "./priority";
import type { CreateTaskInput, Task, TaskFilters, TaskRow, UpdateTaskInput } from "./types";

const BASE_SELECT = `
  SELECT t.*, b.name as business_name, b.color as business_color, p.name as project_name
  FROM tasks t
  JOIN businesses b ON b.id = t.business_id
  LEFT JOIN projects p ON p.id = t.project_id
  WHERE t.deleted_at IS NULL
`;

type TaskJoinRow = TaskRow & { business_name: string; business_color: string; project_name: string | null };

function hydrate(row: TaskJoinRow, today: Date): Task {
  const { effective, isOverdue, isAutoEscalated } = computeEffectivePriority(row.base_priority, row.due_date, row.status, today);
  return {
    ...row,
    effective_priority: effective,
    is_overdue: isOverdue,
    is_auto_escalated: isAutoEscalated,
    channels_list: row.channels ? row.channels.split(",").filter(Boolean) : [],
  };
}

export async function listTasks(filters: TaskFilters = {}, today: Date = new Date()): Promise<Task[]> {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.assignee) {
    clauses.push("t.assignee = @assignee");
    params.assignee = filters.assignee;
  }
  if (filters.businessId) {
    clauses.push("t.business_id = @businessId");
    params.businessId = filters.businessId;
  }
  if (filters.projectId) {
    clauses.push("t.project_id = @projectId");
    params.projectId = filters.projectId;
  }
  if (filters.status) {
    clauses.push("t.status = @status");
    params.status = filters.status;
  }
  if (filters.priority) {
    clauses.push("t.base_priority = @priority");
    params.priority = filters.priority;
  }
  if (filters.dueFrom) {
    clauses.push("t.due_date >= @dueFrom");
    params.dueFrom = filters.dueFrom;
  }
  if (filters.dueTo) {
    clauses.push("t.due_date <= @dueTo");
    params.dueTo = filters.dueTo;
  }

  const sql = BASE_SELECT + (clauses.length ? " AND " + clauses.join(" AND ") : "");
  const rows = await db.prepare(sql).all<TaskJoinRow>(params);
  return rows.map((r) => hydrate(r, today));
}

export async function getTaskById(id: string): Promise<Task | null> {
  const row = await db.prepare(BASE_SELECT + " AND t.id = @id").get<TaskJoinRow>({ id });
  if (!row) return null;
  return hydrate(row, new Date());
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO tasks (id, title, business_id, project_id, assignee, status, base_priority, due_date, notes, channels, content_stage, created_at)
       VALUES (@id, @title, @businessId, @projectId, @assignee, @status, @basePriority, @dueDate, @notes, @channels, @contentStage, @createdAt)`
    )
    .run({
      id,
      title: input.title,
      businessId: input.businessId,
      projectId: input.projectId ?? null,
      assignee: input.assignee ?? "genie",
      status: input.status ?? "not_started",
      basePriority: input.basePriority ?? "medium",
      dueDate: input.dueDate ?? null,
      notes: input.notes ?? null,
      channels: input.channels && input.channels.length ? input.channels.join(",") : null,
      contentStage: input.contentStage ?? null,
      createdAt: now,
    });
  return (await getTaskById(id))!;
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task | null> {
  const existing = await getTaskById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  const map: Record<string, unknown> = {
    title: input.title,
    business_id: input.businessId,
    project_id: input.projectId,
    assignee: input.assignee,
    base_priority: input.basePriority,
    due_date: input.dueDate,
    notes: input.notes,
    nate_note: input.nateNote,
    content_stage: input.contentStage,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = @${col}`);
      params[col] = val;
    }
  }
  if (input.channels !== undefined) {
    fields.push("channels = @channels");
    params.channels = input.channels && input.channels.length ? input.channels.join(",") : null;
  }
  if (input.status !== undefined) {
    fields.push("status = @status");
    params.status = input.status;
    fields.push("completed_at = @completedAt");
    params.completedAt = input.status === "completed" ? new Date().toISOString() : null;
  }

  if (fields.length === 0) return existing;

  await db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = @id`).run(params);
  return getTaskById(id);
}

export async function softDeleteTask(id: string): Promise<void> {
  await db.prepare("UPDATE tasks SET deleted_at = @now WHERE id = @id").run({ id, now: new Date().toISOString() });
}
