import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { CreateProjectFieldInput, ProjectField } from "./types";

export async function listProjectFields(projectId: string): Promise<ProjectField[]> {
  return db
    .prepare("SELECT * FROM project_fields WHERE project_id = ? ORDER BY sort_order ASC")
    .all<ProjectField>(projectId);
}

/** The field (if any) driving this project's status pipeline — e.g. Applications'
 * Draft/Submitted/Accepted select — used by the Executive Briefing rollup. */
export async function getStatusField(projectId: string): Promise<ProjectField | null> {
  return (
    (await db
      .prepare("SELECT * FROM project_fields WHERE project_id = ? AND field_type = 'select' AND is_status = 1")
      .get<ProjectField>(projectId)) ?? null
  );
}

export async function createProjectField(
  projectId: string,
  input: CreateProjectFieldInput
): Promise<ProjectField> {
  const id = randomUUID();
  const max = await db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) as m FROM project_fields WHERE project_id = ?")
    .get<{ m: number }>(projectId);
  const fieldType = input.fieldType ?? "text";

  // Only one status field per project — unset any existing one before marking a new one.
  if (fieldType === "select" && input.isStatus) {
    await db.prepare("UPDATE project_fields SET is_status = 0 WHERE project_id = ?").run(projectId);
  }

  await db
    .prepare(
      `INSERT INTO project_fields (id, project_id, label, field_type, auto_number_prefix, sync_to_calendar, options, is_status, sort_order, created_at)
       VALUES (@id, @projectId, @label, @fieldType, @autoNumberPrefix, @syncToCalendar, @options, @isStatus, @sortOrder, @createdAt)`
    )
    .run({
      id,
      projectId,
      label: input.label,
      fieldType,
      autoNumberPrefix: fieldType === "auto_number" ? input.autoNumberPrefix ?? "" : null,
      syncToCalendar: fieldType === "date" && input.syncToCalendar ? 1 : 0,
      options: fieldType === "select" && input.options?.length ? JSON.stringify(input.options) : null,
      isStatus: fieldType === "select" && input.isStatus ? 1 : 0,
      sortOrder: (max?.m ?? -1) + 1,
      createdAt: new Date().toISOString(),
    });
  return (await db.prepare("SELECT * FROM project_fields WHERE id = ?").get<ProjectField>(id))!;
}

export async function deleteProjectField(fieldId: string): Promise<void> {
  await db.prepare("DELETE FROM project_entry_values WHERE field_id = ?").run(fieldId);
  await db.prepare("DELETE FROM project_fields WHERE id = ?").run(fieldId);
}
