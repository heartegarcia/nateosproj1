"use client";

import type { TaskStatus } from "@/lib/types";

const LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

const DOT: Record<TaskStatus, string> = {
  not_started: "bg-zinc-400",
  in_progress: "bg-blue-500",
  completed: "bg-emerald-500",
};

export function StatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: TaskStatus;
  onChange: (status: TaskStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative inline-flex items-center">
      <span className={`pointer-events-none absolute left-2 h-1.5 w-1.5 rounded-full ${DOT[value]}`} />
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as TaskStatus)}
        onClick={(e) => e.stopPropagation()}
        className="cursor-pointer appearance-none rounded-md border border-zinc-200 bg-white py-1 pl-5 pr-6 text-xs font-medium text-zinc-700 outline-none hover:border-zinc-300 focus:border-zinc-400 disabled:cursor-default disabled:opacity-60"
      >
        {(Object.keys(LABELS) as TaskStatus[]).map((s) => (
          <option key={s} value={s}>
            {LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
