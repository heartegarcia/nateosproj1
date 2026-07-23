import type { Task } from "@/lib/types";

const STYLES: Record<string, string> = {
  high: "bg-red-50 text-red-700 ring-red-600/20",
  medium: "bg-amber-50 text-amber-700 ring-amber-600/20",
  low: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
};

export function PriorityBadge({ task }: { task: Pick<Task, "effective_priority" | "is_overdue" | "is_auto_escalated"> }) {
  if (task.is_overdue) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
        Overdue
      </span>
    );
  }

  const label = task.effective_priority[0].toUpperCase() + task.effective_priority.slice(1);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[task.effective_priority]}`}
    >
      {label}
      {task.is_auto_escalated && <span title="Auto-escalated due to due date">⏫</span>}
    </span>
  );
}
