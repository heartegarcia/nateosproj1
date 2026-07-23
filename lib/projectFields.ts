import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { CreateProjectFieldInput, ProjectField } from "./types";

export function listProjectFields(projectId: string): ProjectField[] {
  return db
    .prepare("SELECT * FROM project_fields WHERE project_id = ? ORDER BY sort_order ASC")
    .all(projectId) as ProjectField[];
}

/** The field (if any) driving this project's status pipeline — e.g. Applications'
 * Draft/Submitted/Accepted select — used by the Executive Briefing rollup. */
export function getStatusField(projectId: string): ProjectField | null {
  return (
    (db
      .prepare("SELECT * FROM project_fields WHERE project_id = ? AND field_type = 'select' AND is_status = 1")
      .get(projectId) as ProjectField | undefined) ?? null
  );
}

export function createProjectField(projectId: string, input: CreateProjectFieldInput): ProjectField {
  const id = randomUUID();
  const max = db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) as m FROM project_fields WHERE project_id = ?")
    .get(projectId) as { m: number };
  const fieldType = input.fieldType ?? "text";

  // Only one status field per project — unset any existing one before marking a new one.
  if (fieldType === "select" && input.isStatus) {
    db.prepare("UPDATE project_fields SET is_status = 0 WHERE project_id = ?").run(projectId);
  }

  db.prepare(
    `INSERT INTO project_fields (id, project_id, label, field_type, auto_number_prefix, sync_to_calendar, options, is_status, sort_order, created_at)
     VALUES (@id, @projectId, @label, @fieldType, @autoNumberPrefix, @syncToCalendar, @options, @isStatus, @sortOrder, @createdAt)`
  ).run({
    id,
    projectId,
    label: input.label,
    fieldType,
    autoNumberPrefix: fieldType === "auto_number" ? input.autoNumberPrefix ?? "" : null,
    syncToCalendar: fieldType === "date" && input.syncToCalendar ? 1 : 0,
    options: fieldType === "select" && input.options?.length ? JSON.stringify(input.options) : null,
    isStatus: fieldType === "select" && input.isStatus ? 1 : 0,
    sortOrder: max.m + 1,
    createdAt: new Date().toISOString(),
  });
  return db.prepare("SELECT * FROM project_fields WHERE id = ?").get(id) as ProjectField;
}

export function deleteProjectField(fieldId: string): void {
  db.prepare("DELETE FROM project_entry_values WHERE field_id = ?").run(fieldId);
  db.prepare("DELETE FROM project_fields WHERE id = ?").run(fieldId);
}
