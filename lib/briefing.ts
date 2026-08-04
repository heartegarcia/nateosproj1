import { endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import { db } from "./db";
import { listTasks } from "./tasks";
import { listCalendarEntryItems } from "./projectEntries";
import { listSlots } from "./socialContent";
import type { ApplicationStatusBreakdown, ContentStage, ExecutiveBriefing, NextEventBriefing } from "./types";

/** Any project with a select field marked is_status contributes a status breakdown —
 * not hardcoded to "Speaking Opportunity Applications" by name, so this keeps working
 * if another project adopts the same pipeline pattern later. */
async function computeApplications(): Promise<ApplicationStatusBreakdown[]> {
  const statusFields = await db
    .prepare(
      `SELECT f.id as field_id, f.options, p.id as project_id, p.name as project_name, p.business_id
       FROM project_fields f JOIN projects p ON p.id = f.project_id
       WHERE f.field_type = 'select' AND f.is_status = 1 AND p.deleted_at IS NULL`
    )
    .all<{ field_id: string; options: string | null; project_id: string; project_name: string; business_id: string }>();

  return Promise.all(
    statusFields.map(async (f) => {
      const options: string[] = f.options ? JSON.parse(f.options) : [];
      const rows = await db
        .prepare(
          `SELECT v.value, COUNT(*)::int as c FROM project_entry_values v
           JOIN project_entries e ON e.id = v.entry_id
           WHERE v.field_id = ? AND e.deleted_at IS NULL AND v.value IS NOT NULL AND v.value != ''
           GROUP BY v.value`
        )
        .all<{ value: string; c: number }>(f.field_id);
      const countMap = new Map(rows.map((r) => [r.value, r.c]));
      const labels = options.length ? options : Array.from(countMap.keys());
      return {
        projectId: f.project_id,
        projectName: f.project_name,
        businessId: f.business_id,
        counts: labels.map((label) => ({ label, count: countMap.get(label) ?? 0 })),
      };
    })
  );
}

/** Single call that answers Nate's "under 60 seconds" questions — computed
 * server-side so the dashboard doesn't fan out into five separate client fetches. */
export async function getExecutiveBriefing(todayISO?: string): Promise<ExecutiveBriefing> {
  const today = todayISO ?? format(new Date(), "yyyy-MM-dd");
  const todayDate = parseISO(today);
  const weekStart = format(startOfWeek(todayDate), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(todayDate), "yyyy-MM-dd");

  // None of these five depend on each other — fired together instead of one-at-a-time
  // so this only pays for one round trip's worth of latency, not five.
  const [openNateAll, upcomingAll, slots, missingDocumentation, applications] = await Promise.all([
    listTasks({ assignee: "nate" }, todayDate),
    listCalendarEntryItems(),
    listSlots(weekStart, weekEnd),
    db
      .prepare(
        `SELECT COUNT(*)::int as c FROM tasks
         WHERE deleted_at IS NULL AND status = 'completed' AND project_id IS NULL
           AND completed_at >= @weekStart AND completed_at <= @weekEndExclusive`
      )
      .get<{ c: number }>({ weekStart, weekEndExclusive: weekEnd + "T23:59:59" }),
    computeApplications(),
  ]);

  const openNate = openNateAll.filter((t) => t.status !== "completed");

  const upcoming = upcomingAll.filter((i) => i.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent: NextEventBriefing | null = upcoming[0]
    ? {
        id: upcoming[0].id,
        title: upcoming[0].title,
        date: upcoming[0].date,
        href: `/businesses/${upcoming[0].business_id}/projects/${upcoming[0].project_id}/entries/${upcoming[0].id}`,
      }
    : null;

  const byDate = new Map<string, Partial<Record<ContentStage, boolean>>>();
  for (const s of slots) {
    if (!byDate.has(s.content_date)) byDate.set(s.content_date, {});
    byDate.get(s.content_date)![s.stage] = s.filled;
  }
  let contentReadyThisWeek = 0;
  for (const v of byDate.values()) {
    if (v.concept && v.final) contentReadyThisWeek++;
  }

  return {
    overdueCount: openNate.filter((t) => t.is_overdue).length,
    dueTodayCount: openNate.filter((t) => t.due_date === today).length,
    waitingOnNateCount: openNate.length,
    nextEvent,
    applications,
    contentReadyThisWeek,
    contentTotalThisWeek: 7,
    missingDocumentationCount: missingDocumentation?.c ?? 0,
  };
}
