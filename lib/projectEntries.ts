import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { CalendarEntryItem, ProjectEntry, ProjectField } from "./types";

interface EntryRow {
  id: string;
  project_id: string;
  title: string;
  linked_task_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

async function hydrateValues(entryIds: string[]): Promise<Map<string, Record<string, string>>> {
  const map = new Map<string, Record<string, string>>();
  if (entryIds.length === 0) return map;
  const placeholders = entryIds.map(() => "?").join(",");
  const rows = await db
    .prepare(`SELECT entry_id, field_id, value FROM project_entry_values WHERE entry_id IN (${placeholders})`)
    .all<{ entry_id: string; field_id: string; value: string | null }>(...entryIds);
  for (const r of rows) {
    if (!map.has(r.entry_id)) map.set(r.entry_id, {});
    map.get(r.entry_id)![r.field_id] = r.value ?? "";
  }
  return map;
}

export async function listEntries(projectId: string): Promise<ProjectEntry[]> {
  const rows = await db
    .prepare("SELECT * FROM project_entries WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC")
    .all<EntryRow>(projectId);
  const values = await hydrateValues(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, values: values.get(r.id) ?? {} }));
}

export async function getEntryById(id: string): Promise<ProjectEntry | null> {
  const row = await db.prepare("SELECT * FROM project_entries WHERE id = ?").get<EntryRow>(id);
  if (!row) return null;
  const values = await hydrateValues([row.id]);
  return { ...row, values: values.get(row.id) ?? {} };
}

/**
 * Assigns the next sequence value (e.g. SOA001, SOA002) to every auto-number field
 * in the project that this entry doesn't already have a value for. Called right after
 * an entry is created — whether manually or auto-linked from a task — so numbering is
 * consistent no matter how the entry was born.
 */
async function applyAutoNumberFields(entryId: string, projectId: string): Promise<void> {
  const fields = await db
    .prepare("SELECT * FROM project_fields WHERE project_id = ? AND field_type = 'auto_number'")
    .all<ProjectField>(projectId);
  if (fields.length === 0) return;

  const now = new Date().toISOString();
  for (const field of fields) {
    const already = await db
      .prepare("SELECT value FROM project_entry_values WHERE entry_id = ? AND field_id = ?")
      .get<{ value: string | null }>(entryId, field.id);
    if (already && already.value) continue;

    const prefix = field.auto_number_prefix ?? "";
    const existing = await db
      .prepare("SELECT value FROM project_entry_values WHERE field_id = ?")
      .all<{ value: string | null }>(field.id);
    let maxNum = 0;
    for (const row of existing) {
      const digits = (row.value ?? "").replace(prefix, "").replace(/\D/g, "");
      const n = parseInt(digits, 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
    const next = `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
    await db
      .prepare(
        `INSERT INTO project_entry_values (id, entry_id, field_id, value, updated_at)
         VALUES (@id, @entryId, @fieldId, @value, @now)
         ON CONFLICT (entry_id, field_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run({ id: randomUUID(), entryId, fieldId: field.id, value: next, now });
  }
}

export async function createEntry(projectId: string, title: string): Promise<ProjectEntry> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO project_entries (id, project_id, title, created_at, updated_at) VALUES (@id, @projectId, @title, @now, @now)`
    )
    .run({ id, projectId, title, now });
  await applyAutoNumberFields(id, projectId);
  return (await getEntryById(id))!;
}

export async function updateEntryTitle(id: string, title: string): Promise<ProjectEntry | null> {
  await db.prepare("UPDATE project_entries SET title = @title, updated_at = @now WHERE id = @id").run({
    id,
    title,
    now: new Date().toISOString(),
  });
  return getEntryById(id);
}

export async function softDeleteEntry(id: string): Promise<void> {
  await db
    .prepare("UPDATE project_entries SET deleted_at = @now WHERE id = @id")
    .run({ id, now: new Date().toISOString() });
}

export async function setEntryValue(entryId: string, fieldId: string, value: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO project_entry_values (id, entry_id, field_id, value, updated_at)
       VALUES (@id, @entryId, @fieldId, @value, @now)
       ON CONFLICT (entry_id, field_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run({ id: randomUUID(), entryId, fieldId, value, now });
}

/**
 * Keeps a task's linked gallery entry in sync: creates one the first time a task is
 * assigned to a project, or moves/renames the existing one if the task's project or
 * title changes later. Clearing a task's project leaves its entry where it is —
 * entries are meant to persist as a running archive even if the task moves on.
 */
export async function syncEntryForTask(taskId: string, projectId: string | null, title: string): Promise<void> {
  if (!projectId) return;
  const existing = await db
    .prepare("SELECT id FROM project_entries WHERE linked_task_id = ? AND deleted_at IS NULL")
    .get<{ id: string }>(taskId);
  const now = new Date().toISOString();
  if (existing) {
    await db
      .prepare("UPDATE project_entries SET project_id = @projectId, title = @title, updated_at = @now WHERE id = @id")
      .run({ id: existing.id, projectId, title, now });
  } else {
    const id = randomUUID();
    await db
      .prepare(
        `INSERT INTO project_entries (id, project_id, title, linked_task_id, created_at, updated_at)
         VALUES (@id, @projectId, @title, @taskId, @now, @now)`
      )
      .run({ id, projectId, title, taskId, now });
    await applyAutoNumberFields(id, projectId);
  }
}

/**
 * Every entry value that lives in a date field flagged sync_to_calendar, surfaced as a
 * calendar item. Powers the overlay of e.g. Events onto Nate's dashboard calendar so an
 * event's date shows up there automatically once Genie fills it in.
 */
export async function listCalendarEntryItems(): Promise<CalendarEntryItem[]> {
  const rows = await db
    .prepare(
      `SELECT e.id as id, v.value as date, e.title as title,
              p.id as project_id, p.name as project_name,
              b.id as business_id, b.name as business_name, b.color as business_color
       FROM project_entry_values v
       JOIN project_fields f ON f.id = v.field_id
       JOIN project_entries e ON e.id = v.entry_id
       JOIN projects p ON p.id = e.project_id
       JOIN businesses b ON b.id = p.business_id
       WHERE f.field_type = 'date' AND f.sync_to_calendar = 1
         AND v.value IS NOT NULL AND v.value != ''
         AND e.deleted_at IS NULL AND p.deleted_at IS NULL`
    )
    .all<CalendarEntryItem>();
  // Normalize any full ISO timestamps to YYYY-MM-DD.
  return rows.map((r) => ({ ...r, date: r.date.slice(0, 10) }));
}
