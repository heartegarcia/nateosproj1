import { randomUUID } from "node:crypto";
import path from "node:path";
import { db } from "./db";
import { downloadFile, uploadFile } from "./storage";
import { updateTask } from "./tasks";
import type { ContentStage, SocialAttachment, SocialSlot, Task } from "./types";

export const SOCIAL_BUSINESS_NAME = "Social Media";

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

async function listAttachmentsForSlots(slotIds: string[]): Promise<Map<string, SocialAttachment[]>> {
  const map = new Map<string, SocialAttachment[]>();
  if (slotIds.length === 0) return map;
  const placeholders = slotIds.map(() => "?").join(",");
  const rows = await db
    .prepare(
      `SELECT * FROM social_attachments WHERE slot_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY uploaded_at ASC`
    )
    .all<SocialAttachment>(...slotIds);
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

export async function listSlots(from: string, to: string): Promise<SocialSlot[]> {
  const rows = await db
    .prepare("SELECT * FROM social_content WHERE content_date >= ? AND content_date <= ? ORDER BY content_date ASC")
    .all<SlotRow>(from, to);
  const attachments = await listAttachmentsForSlots(rows.map((r) => r.id));
  return rows.map((r) => hydrate(r, attachments.get(r.id) ?? []));
}

export async function getSlotById(id: string): Promise<SocialSlot | null> {
  const row = await db.prepare("SELECT * FROM social_content WHERE id = ?").get<SlotRow>(id);
  if (!row) return null;
  const attachments = await listAttachmentsForSlots([row.id]);
  return hydrate(row, attachments.get(row.id) ?? []);
}

async function getSlotByDateStage(date: string, stage: ContentStage): Promise<SlotRow | null> {
  return (
    (await db
      .prepare("SELECT * FROM social_content WHERE content_date = ? AND stage = ?")
      .get<SlotRow>(date, stage)) ?? null
  );
}

/** Creates the (date, stage) slot if missing, or fills in title/task_id on an existing
 * empty one. Idempotent so a Social Media task and a manual calendar edit converge on the
 * same slot. */
export async function upsertSlot(input: {
  date: string;
  stage: ContentStage;
  title?: string | null;
  taskId?: string | null;
}): Promise<SocialSlot> {
  const existing = await getSlotByDateStage(input.date, input.stage);
  const now = new Date().toISOString();
  if (existing) {
    await db
      .prepare(
        `UPDATE social_content
         SET title = COALESCE(@title, title),
             task_id = COALESCE(task_id, @taskId),
             updated_at = @now
         WHERE id = @id`
      )
      .run({ id: existing.id, title: input.title ?? null, taskId: input.taskId ?? null, now });
    return (await getSlotById(existing.id))!;
  }
  const id = randomUUID();
  await db
    .prepare(
      `INSERT INTO social_content (id, content_date, stage, title, task_id, created_at, updated_at)
       VALUES (@id, @date, @stage, @title, @taskId, @now, @now)`
    )
    .run({ id, date: input.date, stage: input.stage, title: input.title ?? null, taskId: input.taskId ?? null, now });
  return (await getSlotById(id))!;
}

async function autoCompleteLinkedTask(slot: SlotRow): Promise<void> {
  if (slot.task_id) await updateTask(slot.task_id, { status: "completed" });
}

/** When a Social Media task carries a content stage and a due date, plot it onto the
 * content calendar (its due date is the plot date). Called from the task create/update
 * routes, mirroring syncEntryForTask. */
export async function syncSocialSlotForTask(task: Task): Promise<void> {
  if (task.business_name !== SOCIAL_BUSINESS_NAME) return;
  if (!task.content_stage || !task.due_date) return;
  await upsertSlot({
    date: task.due_date.slice(0, 10),
    stage: task.content_stage,
    title: task.title,
    taskId: task.id,
  });
}

export async function setDriveLink(id: string, driveLink: string): Promise<SocialSlot | null> {
  const row = await db.prepare("SELECT * FROM social_content WHERE id = ?").get<SlotRow>(id);
  if (!row) return null;
  await db.prepare("UPDATE social_content SET drive_link = @driveLink, updated_at = @now WHERE id = @id").run({
    id,
    driveLink: driveLink.trim() || null,
    now: new Date().toISOString(),
  });
  if (driveLink.trim()) await autoCompleteLinkedTask(row);
  return getSlotById(id);
}

export async function getAttachmentById(id: string): Promise<SocialAttachment | null> {
  return (await db.prepare("SELECT * FROM social_attachments WHERE id = ?").get<SocialAttachment>(id)) ?? null;
}

export async function saveSlotAttachment(slotId: string, file: File): Promise<SocialAttachment> {
  const id = randomUUID();
  const ext = path.extname(file.name);
  const storageKey = `social/${slotId}/${id}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(storageKey, buffer, file.type);

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO social_attachments (id, slot_id, file_name, storage_path, file_size, uploaded_at)
       VALUES (@id, @slotId, @fileName, @storagePath, @fileSize, @uploadedAt)`
    )
    .run({
      id,
      slotId,
      fileName: file.name,
      storagePath: storageKey,
      fileSize: buffer.byteLength,
      uploadedAt: now,
    });

  const row = await db.prepare("SELECT * FROM social_content WHERE id = ?").get<SlotRow>(slotId);
  if (row) await autoCompleteLinkedTask(row);

  return (await getAttachmentById(id))!;
}

export async function getSlotAttachmentBuffer(attachment: SocialAttachment): Promise<Buffer | null> {
  return downloadFile(attachment.storage_path);
}

export async function softDeleteSlotAttachment(id: string): Promise<void> {
  await db.prepare("UPDATE social_attachments SET deleted_at = @now WHERE id = @id").run({
    id,
    now: new Date().toISOString(),
  });
}
