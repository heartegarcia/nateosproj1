import { db } from "./db";
import { listChildProjects } from "./projects";
import type { TimelineItem } from "./types";

/**
 * Interleaves every entry and attachment across a client's category sub-projects
 * (Transcripts, Claude Prompts, Dashboard Concepts, Presentation, ...) into one
 * chronological feed, oldest first — so months later, anyone can scroll one list and
 * see exactly how the engagement evolved (Transcript 001 -> Prompt V1 -> Mockup V1 ->
 * V2 -> Final -> Presentation) without hopping between four separate folders.
 */
export function getClientTimeline(clientProjectId: string): TimelineItem[] {
  const categories = listChildProjects(clientProjectId);
  if (categories.length === 0) return [];

  const items: TimelineItem[] = [];

  for (const category of categories) {
    const entries = db
      .prepare(
        "SELECT id, title, created_at FROM project_entries WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at ASC"
      )
      .all(category.id) as { id: string; title: string; created_at: string }[];

    for (const entry of entries) {
      const entryHref = `/businesses/${category.business_id}/projects/${category.id}/entries/${entry.id}`;
      items.push({
        id: `entry-${entry.id}`,
        type: "entry",
        date: entry.created_at,
        title: entry.title,
        categoryName: category.name,
        entryId: entry.id,
        entryHref,
      });

      const attachments = db
        .prepare(
          "SELECT id, file_name, uploaded_at FROM entry_attachments WHERE entry_id = ? AND deleted_at IS NULL ORDER BY uploaded_at ASC"
        )
        .all(entry.id) as { id: string; file_name: string; uploaded_at: string }[];
      for (const a of attachments) {
        items.push({
          id: `attachment-${a.id}`,
          type: "attachment",
          date: a.uploaded_at,
          title: a.file_name,
          categoryName: category.name,
          entryId: entry.id,
          entryHref,
        });
      }
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date));
  return items;
}
