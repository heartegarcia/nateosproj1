"use client";

import { format, parseISO } from "date-fns";
import { PriorityBadge } from "./PriorityBadge";
import { BusinessChip } from "./BusinessChip";
import { StatusSelect } from "./StatusSelect";
import type { Task, TaskStatus } from "@/lib/types";

function fmtDate(iso: string | null, pattern = "MMM d") {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return "—";
  }
}

const ASSIGNEE_LABEL: Record<string, string> = { genie: "Genie", nate: "Nate" };

const TH = "border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-500 whitespace-nowrap";
const TD = "border border-zinc-200 px-3 py-2 align-top text-sm";

export function TaskList({
  tasks,
  onOpenTask,
  onStatusChange,
  emptyMessage = "Nothing here. Enjoy the quiet.",
}: {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  emptyMessage?: string;
}) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-12 text-center text-sm text-zinc-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={TH}>Created</th>
            <th className={TH}>Task</th>
            <th className={TH}>Priority</th>
            <th className={TH}>Due</th>
            <th className={TH}>Assignee</th>
            <th className={TH}>Status</th>
            <th className={TH}>Notes</th>
            <th className={TH}>Business</th>
            <th className={TH}>Project</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr
              key={task.id}
              onClick={() => onOpenTask(task)}
              className="cursor-pointer hover:bg-zinc-50"
            >
              <td className={`${TD} whitespace-nowrap text-xs text-zinc-400`}>
                {fmtDate(task.created_at, "MMM d, h:mm a")}
              </td>
              <td className={TD}>
                <span
                  className={`font-medium ${task.status === "completed" ? "text-zinc-400 line-through" : "text-zinc-900"}`}
                >
                  {task.title}
                </span>
              </td>
              <td className={TD}>
                <PriorityBadge task={task} />
              </td>
              <td className={`${TD} whitespace-nowrap text-xs tabular-nums text-zinc-600`}>{fmtDate(task.due_date)}</td>
              <td className={`${TD} whitespace-nowrap text-xs text-zinc-600`}>{ASSIGNEE_LABEL[task.assignee]}</td>
              <td className={TD} onClick={(e) => e.stopPropagation()}>
                <StatusSelect value={task.status} onChange={(status) => onStatusChange(task, status)} />
              </td>
              <td className={`${TD} max-w-[16rem] truncate text-xs text-zinc-500`} title={task.notes ?? undefined}>
                {task.notes || "—"}
              </td>
              <td className={TD}>
                <BusinessChip name={task.business_name} color={task.business_color} />
              </td>
              <td className={`${TD} whitespace-nowrap text-xs text-zinc-500`}>{task.project_name || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
