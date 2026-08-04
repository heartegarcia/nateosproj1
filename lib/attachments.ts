import { randomUUID } from "node:crypto";
import path from "node:path";
import { db } from "./db";
import { downloadFile, uploadFile } from "./storage";
import type { TaskAttachment } from "./types";

export async function listAttachments(taskId: string): Promise<TaskAttachment[]> {
  return db
    .prepare(
      "SELECT * FROM task_attachments WHERE task_id = ? AND deleted_at IS NULL ORDER BY folder ASC, uploaded_at ASC"
    )
    .all<TaskAttachment>(taskId);
}

export async function getAttachmentById(id: string): Promise<TaskAttachment | null> {
  return (await db.prepare("SELECT * FROM task_attachments WHERE id = ?").get<TaskAttachment>(id)) ?? null;
}

export async function saveAttachment(taskId: string, folder: string, file: File): Promise<TaskAttachment> {
  const id = randomUUID();
  const ext = path.extname(file.name);
  const storageKey = `tasks/${taskId}/${id}${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(storageKey, buffer, file.type);

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO task_attachments (id, task_id, folder, file_name, storage_path, file_size, uploaded_at)
       VALUES (@id, @taskId, @folder, @fileName, @storagePath, @fileSize, @uploadedAt)`
    )
    .run({
      id,
      taskId,
      folder: folder.trim() || "General",
      fileName: file.name,
      storagePath: storageKey,
      fileSize: buffer.byteLength,
      uploadedAt: now,
    });

  return (await getAttachmentById(id))!;
}

/** Same as saveAttachment, but for buffers we already have server-side (e.g. a
 * generated PDF) rather than an uploaded File. */
export async function saveAttachmentFromBuffer(
  taskId: string,
  folder: string,
  fileName: string,
  buffer: Buffer
): Promise<TaskAttachment> {
  const id = randomUUID();
  const ext = path.extname(fileName);
  const storageKey = `tasks/${taskId}/${id}${ext}`;
  await uploadFile(storageKey, buffer);

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO task_attachments (id, task_id, folder, file_name, storage_path, file_size, uploaded_at)
       VALUES (@id, @taskId, @folder, @fileName, @storagePath, @fileSize, @uploadedAt)`
    )
    .run({
      id,
      taskId,
      folder: folder.trim() || "General",
      fileName,
      storagePath: storageKey,
      fileSize: buffer.byteLength,
      uploadedAt: now,
    });

  return (await getAttachmentById(id))!;
}

export async function getAttachmentBuffer(attachment: TaskAttachment): Promise<Buffer | null> {
  return downloadFile(attachment.storage_path);
}

export async function softDeleteAttachment(id: string): Promise<void> {
  await db
    .prepare("UPDATE task_attachments SET deleted_at = @now WHERE id = @id")
    .run({ id, now: new Date().toISOString() });
}
