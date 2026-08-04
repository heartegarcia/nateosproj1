import { randomUUID } from "node:crypto";
import path from "node:path";
import { db } from "./db";
import { downloadFile, uploadFile } from "./storage";
import type { EntryAttachment } from "./types";

export async function listEntryAttachments(entryId: string): Promise<EntryAttachment[]> {
  return db
    .prepare(
      "SELECT * FROM entry_attachments WHERE entry_id = ? AND deleted_at IS NULL ORDER BY folder ASC, uploaded_at ASC"
    )
    .all<EntryAttachment>(entryId);
}

export async function getEntryAttachmentById(id: string): Promise<EntryAttachment | null> {
  return (await db.prepare("SELECT * FROM entry_attachments WHERE id = ?").get<EntryAttachment>(id)) ?? null;
}

export async function saveEntryAttachment(entryId: string, folder: string, file: File): Promise<EntryAttachment> {
  const id = randomUUID();
  const ext = path.extname(file.name);
  const storageKey = `entries/${entryId}/${id}${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(storageKey, buffer, file.type);

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO entry_attachments (id, entry_id, folder, file_name, storage_path, file_size, uploaded_at)
       VALUES (@id, @entryId, @folder, @fileName, @storagePath, @fileSize, @uploadedAt)`
    )
    .run({
      id,
      entryId,
      folder: folder.trim() || "General",
      fileName: file.name,
      storagePath: storageKey,
      fileSize: buffer.byteLength,
      uploadedAt: now,
    });

  return (await getEntryAttachmentById(id))!;
}

export async function getEntryAttachmentBuffer(attachment: EntryAttachment): Promise<Buffer | null> {
  return downloadFile(attachment.storage_path);
}

export async function softDeleteEntryAttachment(id: string): Promise<void> {
  await db
    .prepare("UPDATE entry_attachments SET deleted_at = @now WHERE id = @id")
    .run({ id, now: new Date().toISOString() });
}
