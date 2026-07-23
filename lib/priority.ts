import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Priority, TaskStatus } from "./types";

const RANK: Record<Priority, number> = { low: 0, medium: 1, high: 2 };

/**
 * Effective priority per spec 6.7: overdue always sorts hottest; due within 48h
 * escalates to high; due within 5 days escalates to at least medium. Auto-escalation
 * never overwrites the stored base_priority, only what's shown/sorted on read.
 */
export function computeEffectivePriority(
  basePriority: Priority,
  dueDate: string | null,
  status: TaskStatus,
  today: Date = new Date()
): { effective: Priority; isOverdue: boolean; isAutoEscalated: boolean } {
  if (status === "completed" || !dueDate) {
    return { effective: basePriority, isOverdue: false, isAutoEscalated: false };
  }

  const days = differenceInCalendarDays(parseISO(dueDate), today);

  if (days < 0) {
    return { effective: "high", isOverdue: true, isAutoEscalated: basePriority !== "high" };
  }

  let escalated: Priority = basePriority;
  if (days <= 2) escalated = "high";
  else if (days <= 5 && RANK[escalated] < RANK.medium) escalated = "medium";

  return { effective: escalated, isOverdue: false, isAutoEscalated: RANK[escalated] > RANK[basePriority] };
}

export function priorityRank(p: Priority): number {
  return RANK[p];
}
