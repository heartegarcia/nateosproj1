import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { CreateTimeEntryInput, TimeEntry, UpdateTimeEntryInput } from "./types";

interface TimeEntryRow {
  id: string;
  work_date: string;
  start_time: string;
  end_time: string | null;
  notes: string | null;
  invoice_id: string | null;
  created_at: string;
  deleted_at: string | null;
}

export function computeHours(startTime: string, endTime: string | null): number {
  if (!endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return Math.max(0, minutes) / 60;
}

function hydrate(row: TimeEntryRow): TimeEntry {
  return { ...row, hours: computeHours(row.start_time, row.end_time) };
}

export function getRunningEntry(): TimeEntry | null {
  const row = db
    .prepare("SELECT * FROM time_entries WHERE end_time IS NULL AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1")
    .get() as TimeEntryRow | undefined;
  return row ? hydrate(row) : null;
}

export function getEntryById(id: string): TimeEntry | null {
  const row = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id) as TimeEntryRow | undefined;
  return row ? hydrate(row) : null;
}

export interface TimeEntryFilters {
  from?: string;
  to?: string;
  unbilledOnly?: boolean;
  invoiceId?: string;
}

export function listEntries(filters: TimeEntryFilters = {}): TimeEntry[] {
  const clauses = ["deleted_at IS NULL"];
  const params: Record<string, unknown> = {};

  if (filters.from) {
    clauses.push("work_date >= @from");
    params.from = filters.from;
  }
  if (filters.to) {
    clauses.push("work_date <= @to");
    params.to = filters.to;
  }
  if (filters.unbilledOnly) {
    clauses.push("invoice_id IS NULL");
  }
  if (filters.invoiceId) {
    clauses.push("invoice_id = @invoiceId");
    params.invoiceId = filters.invoiceId;
  }

  const rows = db
    .prepare(`SELECT * FROM time_entries WHERE ${clauses.join(" AND ")} ORDER BY work_date DESC, start_time DESC`)
    .all(params) as TimeEntryRow[];
  return rows.map(hydrate);
}

export function clockIn(workDate: string, startTime: string): TimeEntry {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO time_entries (id, work_date, start_time, created_at) VALUES (@id, @workDate, @startTime, @now)`
  ).run({ id, workDate, startTime, now: new Date().toISOString() });
  return getEntryById(id)!;
}

export function clockOut(id: string, endTime: string): TimeEntry | null {
  db.prepare("UPDATE time_entries SET end_time = @endTime WHERE id = @id").run({ id, endTime });
  return getEntryById(id);
}

export function createManualEntry(input: CreateTimeEntryInput): TimeEntry {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO time_entries (id, work_date, start_time, end_time, notes, created_at)
     VALUES (@id, @workDate, @startTime, @endTime, @notes, @now)`
  ).run({
    id,
    workDate: input.workDate,
    startTime: input.startTime,
    endTime: input.endTime ?? null,
    notes: input.notes ?? null,
    now: new Date().toISOString(),
  });
  return getEntryById(id)!;
}

export function updateEntry(id: string, input: UpdateTimeEntryInput): TimeEntry | null {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  const map: Record<string, unknown> = {
    work_date: input.workDate,
    start_time: input.startTime,
    end_time: input.endTime,
    notes: input.notes,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = @${col}`);
      params[col] = val;
    }
  }
  if (fields.length === 0) return getEntryById(id);

  db.prepare(`UPDATE time_entries SET ${fields.join(", ")} WHERE id = @id`).run(params);
  return getEntryById(id);
}

export function softDeleteEntry(id: string): void {
  db.prepare("UPDATE time_entries SET deleted_at = @now WHERE id = @id").run({ id, now: new Date().toISOString() });
}

export function markEntriesBilled(entryIds: string[], invoiceId: string): void {
  const stmt = db.prepare("UPDATE time_entries SET invoice_id = @invoiceId WHERE id = @id");
  const tx = db.transaction((ids: string[]) => {
    for (const id of ids) stmt.run({ id, invoiceId });
  });
  tx(entryIds);
}
