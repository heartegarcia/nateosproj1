import { randomUUID } from "node:crypto";
import { db } from "./db";

/** Merges the explicit folder registry with any folder names already in use by attachments,
 * so folders created before this registry existed still show up. */
export function listTaskFolders(taskId: string): string[] {
  const registry = db.prepare("SELECT name FROM task_folders WHERE task_id = ?").all(taskId) as { name: string }[];
  const fromAttachments = db
    .prepare("SELECT DISTINCT folder FROM task_attachments WHERE task_id = ? AND deleted_at IS NULL")
    .all(taskId) as { folder: string }[];
  const names = new Set<string>(["General"]);
  for (const r of registry) names.add(r.name);
  for (const r of fromAttachments) names.add(r.folder);
  return Array.from(names);
}

export function createTaskFolder(taskId: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  db.prepare(
    `INSERT INTO task_folders (id, task_id, name, created_at) VALUES (@id, @taskId, @name, @now)
     ON CONFLICT(task_id, name) DO NOTHING`
  ).run({ id: randomUUID(), taskId, name: trimmed, now: new Date().toISOString() });
}
