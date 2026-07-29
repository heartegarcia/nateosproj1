import { randomUUID } from "node:crypto";
import { db } from "./db";

/** Merges the explicit folder registry with any folder names already in use by attachments,
 * so folders created before this registry existed still show up. */
export async function listEntryFolders(entryId: string): Promise<string[]> {
  const registry = await db
    .prepare("SELECT name FROM entry_folders WHERE entry_id = ?")
    .all<{ name: string }>(entryId);
  const fromAttachments = await db
    .prepare("SELECT DISTINCT folder FROM entry_attachments WHERE entry_id = ? AND deleted_at IS NULL")
    .all<{ folder: string }>(entryId);
  const names = new Set<string>(["General"]);
  for (const r of registry) names.add(r.name);
  for (const r of fromAttachments) names.add(r.folder);
  return Array.from(names);
}

export async function createEntryFolder(entryId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db
    .prepare(
      `INSERT INTO entry_folders (id, entry_id, name, created_at) VALUES (@id, @entryId, @name, @now)
       ON CONFLICT (entry_id, name) DO NOTHING`
    )
    .run({ id: randomUUID(), entryId, name: trimmed, now: new Date().toISOString() });
}
