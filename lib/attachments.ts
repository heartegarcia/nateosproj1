import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "./db";
import type { TaskAttachment } from "./types";

const storageRoot = path.join(process.cwd(), "data", "attachments");

function taskDir(taskId: string) {
  return path.join(storageRoot, taskId);
}

export function listAttachments(taskId: string): TaskAttachment[] {
  return db
    .prepare("SELECT * FROM task_attachments WHERE task_id = ? AND deleted_at IS NULL ORDER BY folder ASC, uploaded_at ASC")
    .all(taskId) as TaskAttachment[];
}

export function getAttachmentById(id: string): TaskAttachment | null {
  return (db.prepare("SELECT * FROM task_attachments WHERE id = ?").get(id) as TaskAttachment | undefined) ?? null;
}

export async function saveAttachment(taskId: string, folder: string, file: File): Promise<TaskAttachment> {
  const dir = taskDir(taskId);
  fs.mkdirSync(dir, { recursive: true });

  const id = randomUUID();
  const ext = path.extname(file.name);
  const storedFileName = `${id}${ext}`;
  const storagePath = path.join(dir, storedFileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(storagePath, buffer);

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO task_attachments (id, task_id, folder, file_name, storage_path, file_size, uploaded_at)
     VALUES (@id, @taskId, @folder, @fileName, @storagePath, @fileSize, @uploadedAt)`
  ).run({
    id,
    taskId,
    folder: folder.trim() || "General",
    fileName: file.name,
    storagePath: path.join(taskId, storedFileName),
    fileSize: buffer.byteLength,
    uploadedAt: now,
  });

  return getAttachmentById(id)!;
}

/** Same as saveAttachment, but for buffers we already have server-side (e.g. a
 * generated PDF) rather than an uploaded File. */
export function saveAttachmentFromBuffer(
  taskId: string,
  folder: string,
  fileName: string,
  buffer: Buffer
): TaskAttachment {
  const dir = taskDir(taskId);
  fs.mkdirSync(dir, { recursive: true });

  const id = randomUUID();
  const ext = path.extname(fileName);
  const storedFileName = `${id}${ext}`;
  const storagePath = path.join(dir, storedFileName);
  fs.writeFileSync(storagePath, buffer);

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO task_attachments (id, task_id, folder, file_name, storage_path, file_size, uploaded_at)
     VALUES (@id, @taskId, @folder, @fileName, @storagePath, @fileSize, @uploadedAt)`
  ).run({
    id,
    taskId,
    folder: folder.trim() || "General",
    fileName,
    storagePath: path.join(taskId, storedFileName),
    fileSize: buffer.byteLength,
    uploadedAt: now,
  });

  return getAttachmentById(id)!;
}

export function resolveAttachmentDiskPath(attachment: TaskAttachment): string {
  return path.join(storageRoot, attachment.storage_path);
}

export function softDeleteAttachment(id: string): void {
  db.prepare("UPDATE task_attachments SET deleted_at = @now WHERE id = @id").run({ id, now: new Date().toISOString() });
}
