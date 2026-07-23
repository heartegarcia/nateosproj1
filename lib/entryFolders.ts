import { randomUUID } from "node:crypto";
import { db } from "./db";

/** Merges the explicit folder registry with any folder names already in use by attachments,
 * so folders created before this registry existed still show up. */
export function listEntryFolders(entryId: string): string[] {
  const registry = db.prepare("SELECT name FROM entry_folders WHERE entry_id = ?").all(entryId) as { name: string }[];
  const fromAttachments = db
    .prepare("SELECT DISTINCT folder FROM entry_attachments WHERE entry_id = ? AND deleted_at IS NULL")
    .all(entryId) as { folder: string }[];
  const names = new Set<string>(["General"]);
  for (const r of registry) names.add(r.name);
  for (const r of fromAttachments) names.add(r.folder);
  return Array.from(names);
}

export function createEntryFolder(entryId: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  db.prepare(
    `INSERT INTO entry_folders (id, entry_id, name, created_at) VALUES (@id, @entryId, @name, @now)
     ON CONFLICT(entry_id, name) DO NOTHING`
  ).run({ id: randomUUID(), entryId, name: trimmed, now: new Date().toISOString() });
}
