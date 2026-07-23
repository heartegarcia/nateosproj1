import { addDays, endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import type { Task } from "@/lib/types";
import { priorityRank } from "@/lib/priority";
import type { FilterBarValue, SortBy } from "@/components/FilterBar";

function fmt(d: Date) {
  return format(d, "yyyy-MM-dd");
}

/** Compares a UTC timestamp against a viewer-local yyyy-MM-dd date, in the viewer's timezone. */
export function isLocalDate(iso: string, localDateStr: string): boolean {
  return fmt(parseISO(iso)) === localDateStr;
}

export function applyFilterBar(tasks: Task[], f: FilterBarValue): Task[] {
  const today = new Date();
  let from: string | undefined;
  let to: string | undefined;

  if (f.datePreset === "today") {
    from = to = fmt(today);
  } else if (f.datePreset === "tomorrow") {
    from = to = fmt(addDays(today, 1));
  } else if (f.datePreset === "this_week") {
    from = fmt(startOfWeek(today));
    to = fmt(endOfWeek(today));
  } else if (f.datePreset === "custom") {
    from = f.customFrom || undefined;
    to = f.customTo || undefined;
  }

  return tasks.filter((t) => {
    if (f.businessId && t.business_id !== f.businessId) return false;
    if (f.projectId && t.project_id !== f.projectId) return false;
    if (f.assignee && t.assignee !== f.assignee) return false;
    if (f.status && t.status !== f.status) return false;
    if (f.priority && t.base_priority !== f.priority) return false;
    if (from && (!t.due_date || t.due_date < from)) return false;
    if (to && (!t.due_date || t.due_date > to)) return false;
    return true;
  });
}

export function sortTasks(tasks: Task[], sortBy: SortBy): Task[] {
  const copy = [...tasks];
  if (sortBy === "created_at") {
    copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } else if (sortBy === "priority") {
    copy.sort((a, b) => priorityRank(b.effective_priority) - priorityRank(a.effective_priority));
  } else {
    copy.sort((a, b) => (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99"));
  }
  return copy;
}

/** Overdue first, then due today, then soonest due date, undated last. */
export function urgencySort(tasks: Task[]): Task[] {
  const copy = [...tasks];
  copy.sort((a, b) => {
    if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
    const ad = a.due_date ?? "9999-99-99";
    const bd = b.due_date ?? "9999-99-99";
    if (ad !== bd) return ad.localeCompare(bd);
    return priorityRank(b.effective_priority) - priorityRank(a.effective_priority);
  });
  return copy;
}
