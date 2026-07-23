"use client";

import type { Business, Project } from "@/lib/types";

export type DatePreset = "all" | "today" | "tomorrow" | "this_week" | "custom";
export type SortBy = "due_date" | "created_at" | "priority";

export interface FilterBarValue {
  businessId: string;
  projectId: string;
  assignee: string;
  status: string;
  priority: string;
  datePreset: DatePreset;
  customFrom: string;
  customTo: string;
  sortBy: SortBy;
}

export const DEFAULT_FILTERS: FilterBarValue = {
  businessId: "",
  projectId: "",
  assignee: "",
  status: "",
  priority: "",
  datePreset: "all",
  customFrom: "",
  customTo: "",
  sortBy: "due_date",
};

export function FilterBar({
  value,
  onChange,
  businesses,
  projects,
  showAssignee = true,
  showSort = true,
}: {
  value: FilterBarValue;
  onChange: (next: FilterBarValue) => void;
  businesses: Business[];
  projects: Project[];
  showAssignee?: boolean;
  showSort?: boolean;
}) {
  function set<K extends keyof FilterBarValue>(key: K, val: FilterBarValue[K]) {
    onChange({ ...value, [key]: val });
  }

  const scopedProjects = value.businessId ? projects.filter((p) => p.business_id === value.businessId) : projects;
  const hasActive =
    value.businessId || value.projectId || value.assignee || value.status || value.priority || value.datePreset !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select
        value={value.businessId}
        onChange={(e) => {
          set("businessId", e.target.value);
          set("projectId", "");
        }}
        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
      >
        <option value="">All businesses</option>
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <select
        value={value.projectId}
        onChange={(e) => set("projectId", e.target.value)}
        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
      >
        <option value="">All projects</option>
        {scopedProjects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {showAssignee && (
        <select
          value={value.assignee}
          onChange={(e) => set("assignee", e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
        >
          <option value="">Anyone</option>
          <option value="genie">Genie</option>
          <option value="nate">Nate</option>
        </select>
      )}

      <select
        value={value.status}
        onChange={(e) => set("status", e.target.value)}
        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
      >
        <option value="">Any status</option>
        <option value="not_started">Not started</option>
        <option value="in_progress">In progress</option>
        <option value="completed">Completed</option>
      </select>

      <select
        value={value.priority}
        onChange={(e) => set("priority", e.target.value)}
        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
      >
        <option value="">Any priority</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      <select
        value={value.datePreset}
        onChange={(e) => set("datePreset", e.target.value as DatePreset)}
        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
      >
        <option value="all">Any date</option>
        <option value="today">Due today</option>
        <option value="tomorrow">Due tomorrow</option>
        <option value="this_week">Due this week</option>
        <option value="custom">Custom range</option>
      </select>

      {value.datePreset === "custom" && (
        <>
          <input
            type="date"
            value={value.customFrom}
            onChange={(e) => set("customFrom", e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
          />
          <span className="text-zinc-400">–</span>
          <input
            type="date"
            value={value.customTo}
            onChange={(e) => set("customTo", e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
          />
        </>
      )}

      {showSort && (
        <select
          value={value.sortBy}
          onChange={(e) => set("sortBy", e.target.value as SortBy)}
          className="ml-auto rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
        >
          <option value="due_date">Sort: Due date</option>
          <option value="created_at">Sort: Created date</option>
          <option value="priority">Sort: Priority</option>
        </select>
      )}

      {hasActive && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-600"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
