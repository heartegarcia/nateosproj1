import { db } from "./db";
import type { SearchResult } from "./types";

const PER_TYPE_LIMIT = 8;

/**
 * Unified search across everything a task can leave behind: the task itself, the
 * project entry it filed into, the project/folder, and any attachment file names
 * (task-level, entry-level, or Social Media slot-level). Plain LIKE queries — the
 * data volume for a solo EA tool never justifies FTS5.
 */
export function search(query: string): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  const like = `%${q}%`;
  const results: SearchResult[] = [];

  const tasks = db
    .prepare(
      `SELECT t.id, t.title, t.status, b.name as business_name
       FROM tasks t JOIN businesses b ON b.id = t.business_id
       WHERE t.deleted_at IS NULL AND (t.title LIKE @like OR t.notes LIKE @like)
       ORDER BY t.created_at DESC LIMIT @limit`
    )
    .all({ like, limit: PER_TYPE_LIMIT }) as { id: string; title: string; status: string; business_name: string }[];
  for (const t of tasks) {
    results.push({
      type: "task",
      id: t.id,
      title: t.title,
      subtitle: `Task · ${t.business_name}${t.status === "completed" ? " · completed" : ""}`,
      href: `/action-center?task=${t.id}`,
    });
  }

  const entries = db
    .prepare(
      `SELECT e.id, e.title, p.id as project_id, p.name as project_name, b.id as business_id, b.name as business_name
       FROM project_entries e
       JOIN projects p ON p.id = e.project_id
       JOIN businesses b ON b.id = p.business_id
       WHERE e.deleted_at IS NULL AND e.title LIKE @like
       ORDER BY e.created_at DESC LIMIT @limit`
    )
    .all({ like, limit: PER_TYPE_LIMIT }) as {
    id: string;
    title: string;
    project_id: string;
    project_name: string;
    business_id: string;
    business_name: string;
  }[];
  for (const e of entries) {
    results.push({
      type: "entry",
      id: e.id,
      title: e.title,
      subtitle: `Record · ${e.business_name} / ${e.project_name}`,
      href: `/businesses/${e.business_id}/projects/${e.project_id}/entries/${e.id}`,
    });
  }

  const projects = db
    .prepare(
      `SELECT p.id, p.name, b.id as business_id, b.name as business_name
       FROM projects p JOIN businesses b ON b.id = p.business_id
       WHERE p.deleted_at IS NULL AND p.name LIKE @like
       ORDER BY p.created_at DESC LIMIT @limit`
    )
    .all({ like, limit: PER_TYPE_LIMIT }) as { id: string; name: string; business_id: string; business_name: string }[];
  for (const p of projects) {
    results.push({
      type: "project",
      id: p.id,
      title: p.name,
      subtitle: `Project · ${p.business_name}`,
      href: `/businesses/${p.business_id}/projects/${p.id}`,
    });
  }

  const taskAttachments = db
    .prepare(
      `SELECT a.id, a.file_name, t.id as task_id, t.title as task_title
       FROM task_attachments a JOIN tasks t ON t.id = a.task_id
       WHERE a.deleted_at IS NULL AND a.file_name LIKE @like
       ORDER BY a.uploaded_at DESC LIMIT @limit`
    )
    .all({ like, limit: PER_TYPE_LIMIT }) as { id: string; file_name: string; task_id: string; task_title: string }[];
  for (const a of taskAttachments) {
    results.push({
      type: "attachment",
      id: a.id,
      title: a.file_name,
      subtitle: `Attachment on "${a.task_title}"`,
      href: `/action-center?task=${a.task_id}`,
    });
  }

  const entryAttachments = db
    .prepare(
      `SELECT a.id, a.file_name, e.id as entry_id, e.title as entry_title, p.id as project_id, b.id as business_id
       FROM entry_attachments a
       JOIN project_entries e ON e.id = a.entry_id
       JOIN projects p ON p.id = e.project_id
       JOIN businesses b ON b.id = p.business_id
       WHERE a.deleted_at IS NULL AND a.file_name LIKE @like
       ORDER BY a.uploaded_at DESC LIMIT @limit`
    )
    .all({ like, limit: PER_TYPE_LIMIT }) as {
    id: string;
    file_name: string;
    entry_id: string;
    entry_title: string;
    project_id: string;
    business_id: string;
  }[];
  for (const a of entryAttachments) {
    results.push({
      type: "attachment",
      id: a.id,
      title: a.file_name,
      subtitle: `Attachment on "${a.entry_title}"`,
      href: `/businesses/${a.business_id}/projects/${a.project_id}/entries/${a.entry_id}`,
    });
  }

  const sops = db
    .prepare(
      `SELECT id, title, category FROM sop_documents WHERE deleted_at IS NULL AND title LIKE @like
       ORDER BY created_at DESC LIMIT @limit`
    )
    .all({ like, limit: PER_TYPE_LIMIT }) as { id: string; title: string; category: string }[];
  for (const s of sops) {
    results.push({
      type: "sop",
      id: s.id,
      title: s.title,
      subtitle: `SOP Library · ${s.category}`,
      href: `/sop-library`,
    });
  }

  return results;
}
