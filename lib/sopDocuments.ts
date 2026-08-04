import { randomUUID } from "node:crypto";
import path from "node:path";
import { db } from "./db";
import { downloadFile, uploadFile } from "./storage";
import type { SopCategory, SopDocument } from "./types";

export async function listSopDocuments(): Promise<SopDocument[]> {
  return db
    .prepare("SELECT * FROM sop_documents WHERE deleted_at IS NULL ORDER BY created_at DESC")
    .all<SopDocument>();
}

export async function getSopDocumentById(id: string): Promise<SopDocument | null> {
  return (await db.prepare("SELECT * FROM sop_documents WHERE id = ?").get<SopDocument>(id)) ?? null;
}

export async function createSopFileDocument(
  title: string,
  category: SopCategory,
  notes: string | null,
  file: File
): Promise<SopDocument> {
  const id = randomUUID();
  const ext = path.extname(file.name);
  const storageKey = `sop-documents/${id}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(storageKey, buffer, file.type);

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO sop_documents (id, title, category, storage_path, file_name, external_url, notes, created_at)
       VALUES (@id, @title, @category, @storagePath, @fileName, NULL, @notes, @now)`
    )
    .run({ id, title, category, storagePath: storageKey, fileName: file.name, notes, now });

  return (await getSopDocumentById(id))!;
}

export async function createSopLinkDocument(
  title: string,
  category: SopCategory,
  externalUrl: string,
  notes: string | null
): Promise<SopDocument> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO sop_documents (id, title, category, storage_path, file_name, external_url, notes, created_at)
       VALUES (@id, @title, @category, NULL, NULL, @externalUrl, @notes, @now)`
    )
    .run({ id, title, category, externalUrl, notes, now });
  return (await getSopDocumentById(id))!;
}

export async function getSopDocumentBuffer(doc: SopDocument): Promise<Buffer | null> {
  if (!doc.storage_path) return null;
  return downloadFile(doc.storage_path);
}

export async function softDeleteSopDocument(id: string): Promise<void> {
  await db
    .prepare("UPDATE sop_documents SET deleted_at = @now WHERE id = @id")
    .run({ id, now: new Date().toISOString() });
}
