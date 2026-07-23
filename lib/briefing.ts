import { endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import { db } from "./db";
import { listTasks } from "./tasks";
import { listCalendarEntryItems } from "./projectEntries";
import { listClientLikeProjects } from "./projects";
import { listSlots } from "./socialContent";
import type { ApplicationStatusBreakdown, ClientBriefing, ContentStage, ExecutiveBriefing, NextEventBriefing } from "./types";

/** Any project with a select field marked is_status contributes a status breakdown —
 * not hardcoded to "Speaking Opportunity Applications" by name, so this keeps working
 * if another project adopts the same pipeline pattern later. */
function computeApplications(): ApplicationStatusBreakdown[] {
  const statusFields = db
    .prepare(
      `SELECT f.id as field_id, f.options, p.id as project_id, p.name as project_name, p.business_id
       FROM project_fields f JOIN projects p ON p.id = f.project_id
       WHERE f.field_type = 'select' AND f.is_status = 1 AND p.deleted_at IS NULL`
    )
    .all() as { field_id: string; options: string | null; project_id: string; project_name: string; business_id: string }[];

  return statusFields.map((f) => {
    const options: string[] = f.options ? JSON.parse(f.options) : [];
    const rows = db
      .prepare(
        `SELECT v.value, COUNT(*) as c FROM project_entry_values v
         JOIN project_entries e ON e.id = v.entry_id
         WHERE v.field_id = ? AND e.deleted_at IS NULL AND v.value IS NOT NULL AND v.value != ''
         GROUP BY v.value`
      )
      .all(f.field_id) as { value: string; c: number }[];
    const countMap = new Map(rows.map((r) => [r.value, r.c]));
    const labels = options.length ? options : Array.from(countMap.keys());
    return {
      projectId: f.project_id,
      projectName: f.project_name,
      businessId: f.business_id,
      counts: labels.map((label) => ({ label, count: countMap.get(label) ?? 0 })),
    };
  });
}

/** "Which client dashboard is on V4?" — answered without any new data entry, by
 * reading the most recent entry title in each client's Dashboard Concepts category
 * (Genie already names them "Mockup V1", "V2", "Final"). */
function computeClients(): ClientBriefing[] {
  return listClientLikeProjects().map((c) => {
    const dashboardCategory = db
      .prepare(
        `SELECT id FROM projects WHERE parent_project_id = ? AND deleted_at IS NULL AND name LIKE '%Dashboard%' LIMIT 1`
      )
      .get(c.id) as { id: string } | undefined;
    let latestDashboardVersion: string | null = null;
    if (dashboardCategory) {
      const latest = db
        .prepare("SELECT title FROM project_entries WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1")
        .get(dashboardCategory.id) as { title: string } | undefined;
      latestDashboardVersion = latest?.title ?? null;
    }
    return {
      projectId: c.id,
      businessId: c.business_id,
      name: c.name,
      health: c.health,
      status: c.status,
      latestDashboardVersion,
    };
  });
}

/** Single call that answers Nate's "under 60 seconds" questions — computed
 * server-side so the dashboard doesn't fan out into five separate client fetches. */
export function getExecutiveBriefing(todayISO?: string): ExecutiveBriefing {
  const today = todayISO ?? format(new Date(), "yyyy-MM-dd");
  const todayDate = parseISO(today);

  const openNate = listTasks({ assignee: "nate" }, todayDate).filter((t) => t.status !== "completed");

  const upcoming = listCalendarEntryItems()
    .filter((i) => i.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent: NextEventBriefing | null = upcoming[0]
    ? {
        id: upcoming[0].id,
        title: upcoming[0].title,
        date: upcoming[0].date,
        href: `/businesses/${upcoming[0].business_id}/projects/${upcoming[0].project_id}/entries/${upcoming[0].id}`,
      }
    : null;

  const weekStart = format(startOfWeek(todayDate), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(todayDate), "yyyy-MM-dd");
  const slots = listSlots(weekStart, weekEnd);
  const byDate = new Map<string, Partial<Record<ContentStage, boolean>>>();
  for (const s of slots) {
    if (!byDate.has(s.content_date)) byDate.set(s.content_date, {});
    byDate.get(s.content_date)![s.stage] = s.filled;
  }
  let contentReadyThisWeek = 0;
  for (const v of byDate.values()) {
    if (v.concept && v.final) contentReadyThisWeek++;
  }

  const missingDocumentation = db
    .prepare(
      `SELECT COUNT(*) as c FROM tasks
       WHERE deleted_at IS NULL AND status = 'completed' AND project_id IS NULL
         AND completed_at >= @weekStart AND completed_at <= @weekEndExclusive`
    )
    .get({ weekStart, weekEndExclusive: weekEnd + "T23:59:59" }) as { c: number };

  return {
    overdueCount: openNate.filter((t) => t.is_overdue).length,
    dueTodayCount: openNate.filter((t) => t.due_date === today).length,
    waitingOnNateCount: openNate.length,
    nextEvent,
    applications: computeApplications(),
    clients: computeClients(),
    contentReadyThisWeek,
    contentTotalThisWeek: 7,
    missingDocumentationCount: missingDocumentation.c,
  };
}
