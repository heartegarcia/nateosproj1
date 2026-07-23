import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "./db";
import { updateTask } from "./tasks";
import type { ContentStage, SocialAttachment, SocialSlot, Task } from "./types";

export const SOCIAL_BUSINESS_NAME = "Social Media";

const storageRoot = path.join(process.cwd(), "data", "social-attachments");

interface SlotRow {
  id: string;
  content_date: string;
  stage: ContentStage;
  title: string | null;
  task_id: string | null;
  drive_link: string | null;
  created_at: string;
  updated_at: string;
}

function listAttachmentsForSlots(slotIds: string[]): Map<string, SocialAttachment[]> {
  const map = new Map<string, SocialAttachment[]>();
  if (slotIds.length === 0) return map;
  const placeholders = slotIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT * FROM social_attachments WHERE slot_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY uploaded_at ASC`
    )
    .all(...slotIds) as SocialAttachment[];
  for (const r of rows) {
    if (!map.has(r.slot_id)) map.set(r.slot_id, []);
    map.get(r.slot_id)!.push(r);
  }
  return map;
}

function hydrate(row: SlotRow, attachments: SocialAttachment[]): SocialSlot {
  return {
    ...row,
    attachments,
    filled: Boolean((row.drive_link && row.drive_link.trim()) || attachments.length > 0),
  };
}

export function listSlots(from: string, to: string): SocialSlot[] {
  const rows = db
    .prepare("SELECT * FROM social_content WHERE content_date >= ? AND content_date <= ? ORDER BY content_date ASC")
    .all(from, to) as SlotRow[];
  const attachments = listAttachmentsForSlots(rows.map((r) => r.id));
  return rows.map((r) => hydrate(r, attachments.get(r.id) ?? []));
}

export function getSlotById(id: string): SocialSlot | null {
  const row = db.prepare("SELECT * FROM social_content WHERE id = ?").get(id) as SlotRow | undefined;
  if (!row) return null;
  const attachments = listAttachmentsForSlots([row.id]);
  return hydrate(row, attachments.get(row.id) ?? []);
}

function getSlotByDateStage(date: string, stage: ContentStage): SlotRow | null {
  return (
    (db.prepare("SELECT * FROM social_content WHERE content_date = ? AND stage = ?").get(date, stage) as
      | SlotRow
      | undefined) ?? null
  );
}

/** Creates the (date, stage) slot if missing, or fills in title/task_id on an existing
 * empty one. Idempotent so a Social Media task and a manual calendar edit converge on the
 * same slot. */
export function upsertSlot(input: {
  date: string;
  stage: ContentStage;
  title?: string | null;
  taskId?: string | null;
}): SocialSlot {
  const existing = getSlotByDateStage(input.date, input.stage);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare(
      `UPDATE social_content
       SET title = COALESCE(@title, title),
           task_id = COALESCE(task_id, @taskId),
           updated_at = @now
       WHERE id = @id`
    ).run({ id: existing.id, title: input.title ?? null, taskId: input.taskId ?? null, now });
    return getSlotById(existing.id)!;
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO social_content (id, content_date, stage, title, task_id, created_at, updated_at)
     VALUES (@id, @date, @stage, @title, @taskId, @now, @now)`
  ).run({ id, date: input.date, stage: input.stage, title: input.title ?? null, taskId: input.taskId ?? null, now });
  return getSlotById(id)!;
}

function autoCompleteLinkedTask(slot: SlotRow): void {
  if (slot.task_id) updateTask(slot.task_id, { status: "completed" });
}

/** When a Social Media task carries a content stage and a due date, plot it onto the
 * content calendar (its due date is the plot date). Called from the task create/update
 * routes, mirroring syncEntryForTask. */
export function syncSocialSlotForTask(task: Task): void {
  if (task.business_name !== SOCIAL_BUSINESS_NAME) return;
  if (!task.content_stage || !task.due_date) return;
  upsertSlot({
    date: task.due_date.slice(0, 10),
    stage: task.content_stage,
    title: task.title,
    taskId: task.id,
  });
}

export function setDriveLink(id: string, driveLink: string): SocialSlot | null {
  const row = db.prepare("SELECT * FROM social_content WHERE id = ?").get(id) as SlotRow | undefined;
  if (!row) return null;
  db.prepare("UPDATE social_content SET drive_link = @driveLink, updated_at = @now WHERE id = @id").run({
    id,
    driveLink: driveLink.trim() || null,
    now: new Date().toISOString(),
  });
  if (driveLink.trim()) autoCompleteLinkedTask(row);
  return getSlotById(id);
}

export function getAttachmentById(id: string): SocialAttachment | null {
  return (db.prepare("SELECT * FROM social_attachments WHERE id = ?").get(id) as SocialAttachment | undefined) ?? null;
}

export async function saveSlotAttachment(slotId: string, file: File): Promise<SocialAttachment> {
  const dir = path.join(storageRoot, slotId);
  fs.mkdirSync(dir, { recursive: true });

  const id = randomUUID();
  const ext = path.extname(file.name);
  const storedFileName = `${id}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, storedFileName), buffer);

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO social_attachments (id, slot_id, file_name, storage_path, file_size, uploaded_at)
     VALUES (@id, @slotId, @fileName, @storagePath, @fileSize, @uploadedAt)`
  ).run({
    id,
    slotId,
    fileName: file.name,
    storagePath: path.join(slotId, storedFileName),
    fileSize: buffer.byteLength,
    uploadedAt: now,
  });

  const row = db.prepare("SELECT * FROM social_content WHERE id = ?").get(slotId) as SlotRow | undefined;
  if (row) autoCompleteLinkedTask(row);

  return getAttachmentById(id)!;
}

export function resolveSlotAttachmentDiskPath(attachment: SocialAttachment): string {
  return path.join(storageRoot, attachment.storage_path);
}

export function softDeleteSlotAttachment(id: string): void {
  db.prepare("UPDATE social_attachments SET deleted_at = @now WHERE id = @id").run({
    id,
    now: new Date().toISOString(),
  });
}
