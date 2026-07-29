import { randomUUID } from "node:crypto";
import { db } from "./db";

/** Merges the explicit folder registry with any folder names already in use by attachments,
 * so folders created before this registry existed still show up. */
export async function listTaskFolders(taskId: string): Promise<string[]> {
  const registry = await db
    .prepare("SELECT name FROM task_folders WHERE task_id = ?")
    .all<{ name: string }>(taskId);
  const fromAttachments = await db
    .prepare("SELECT DISTINCT folder FROM task_attachments WHERE task_id = ? AND deleted_at IS NULL")
    .all<{ folder: string }>(taskId);
  const names = new Set<string>(["General"]);
  for (const r of registry) names.add(r.name);
  for (const r of fromAttachments) names.add(r.folder);
  return Array.from(names);
}

export async function createTaskFolder(taskId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db
    .prepare(
      `INSERT INTO task_folders (id, task_id, name, created_at) VALUES (@id, @taskId, @name, @now)
       ON CONFLICT (task_id, name) DO NOTHING`
    )
    .run({ id: randomUUID(), taskId, name: trimmed, now: new Date().toISOString() });
}
