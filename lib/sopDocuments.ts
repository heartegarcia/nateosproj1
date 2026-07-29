import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "./db";
import type { SopCategory, SopDocument } from "./types";

// See lib/attachments.ts — local-disk storage, pending the Supabase Storage migration.
const storageRoot = path.join(process.cwd(), "data", "sop-documents");

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
  fs.mkdirSync(storageRoot, { recursive: true });

  const id = randomUUID();
  const ext = path.extname(file.name);
  const storedFileName = `${id}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(storageRoot, storedFileName), buffer);

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO sop_documents (id, title, category, storage_path, file_name, external_url, notes, created_at)
       VALUES (@id, @title, @category, @storagePath, @fileName, NULL, @notes, @now)`
    )
    .run({ id, title, category, storagePath: storedFileName, fileName: file.name, notes, now });

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

export function resolveSopDocumentDiskPath(doc: SopDocument): string | null {
  if (!doc.storage_path) return null;
  return path.join(storageRoot, doc.storage_path);
}

export async function softDeleteSopDocument(id: string): Promise<void> {
  await db
    .prepare("UPDATE sop_documents SET deleted_at = @now WHERE id = @id")
    .run({ id, now: new Date().toISOString() });
}
