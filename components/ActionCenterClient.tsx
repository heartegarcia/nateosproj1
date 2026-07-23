"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useTaskData } from "@/lib/client/useTaskData";
import { createTaskClient, deleteTaskClient, updateTaskClient } from "@/lib/client/api";
import { applyFilterBar, isLocalDate, sortTasks } from "@/lib/client/filtering";
import { TaskList } from "@/components/TaskList";
import { TaskCalendar } from "@/components/TaskCalendar";
import { TaskDrawer } from "@/components/TaskDrawer";
import { QuickAddTask } from "@/components/QuickAddTask";
import { SummaryTiles, type Tile } from "@/components/SummaryTiles";
import { PacificClock } from "@/components/PacificClock";
import { FilterBar, DEFAULT_FILTERS, type FilterBarValue } from "@/components/FilterBar";
import type { Role, Task, TaskStatus } from "@/lib/types";

type TileKey = "due_today" | "overdue" | "waiting_nate" | "completed_today";

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

export function ActionCenterClient({ displayName, role }: { displayName: string; role: Role }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tasks, setTasks, businesses, projects, setProjects, loading, refetchTasks } = useTaskData({});
  const [filters, setFilters] = useState<FilterBarValue>(DEFAULT_FILTERS);
  const [activeTile, setActiveTile] = useState<TileKey | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [selected, setSelected] = useState<Task | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<string | undefined>(undefined);

  const today = todayStr();

  // Deep-links from the command palette / elsewhere: ?task=<id> opens that task's
  // drawer directly (Action Center has no fixed business/assignee filter, so it's the
  // one place any task can always be found), ?new=1 opens quick-add.
  useEffect(() => {
    if (loading) return;
    (async () => {
      const taskId = searchParams.get("task");
      if (taskId) {
        const found = tasks.find((t) => t.id === taskId);
        if (found) setSelected(found);
        router.replace("/action-center");
      } else if (searchParams.get("new")) {
        setQuickAddOpen(true);
        router.replace("/action-center");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams]);

  const tileCounts = useMemo(() => {
    return {
      due_today: tasks.filter((t) => t.due_date === today && t.status !== "completed").length,
      overdue: tasks.filter((t) => t.is_overdue).length,
      waiting_nate: tasks.filter((t) => t.assignee === "nate" && t.status !== "completed").length,
      completed_today: tasks.filter((t) => t.completed_at && isLocalDate(t.completed_at, today)).length,
    };
  }, [tasks, today]);

  const tiles: Tile[] = [
    {
      key: "due_today",
      label: "Due Today",
      count: tileCounts.due_today,
      accent: "amber",
      active: activeTile === "due_today",
      onClick: () => setActiveTile((k) => (k === "due_today" ? null : "due_today")),
    },
    {
      key: "overdue",
      label: "Overdue",
      count: tileCounts.overdue,
      accent: "red",
      active: activeTile === "overdue",
      onClick: () => setActiveTile((k) => (k === "overdue" ? null : "overdue")),
    },
    {
      key: "waiting_nate",
      label: "Waiting for Nate",
      count: tileCounts.waiting_nate,
      accent: "blue",
      active: activeTile === "waiting_nate",
      onClick: () => setActiveTile((k) => (k === "waiting_nate" ? null : "waiting_nate")),
    },
    {
      key: "completed_today",
      label: "Completed Today",
      count: tileCounts.completed_today,
      accent: "emerald",
      active: activeTile === "completed_today",
      onClick: () => setActiveTile((k) => (k === "completed_today" ? null : "completed_today")),
    },
  ];

  const displayed = useMemo(() => {
    let result = tasks;
    if (activeTile === "due_today") result = result.filter((t) => t.due_date === today && t.status !== "completed");
    if (activeTile === "overdue") result = result.filter((t) => t.is_overdue);
    if (activeTile === "waiting_nate") result = result.filter((t) => t.assignee === "nate" && t.status !== "completed");
    if (activeTile === "completed_today")
      result = result.filter((t) => t.completed_at && isLocalDate(t.completed_at, today));
    result = applyFilterBar(result, filters);
    return sortTasks(result, filters.sortBy);
  }, [tasks, activeTile, filters, today]);

  async function handleStatusChange(task: Task, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    await updateTaskClient(task.id, { status });
    refetchTasks();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-zinc-900">Action Center</h1>
            <PacificClock />
          </div>
          <p className="mt-1 text-sm text-zinc-500">Good to see you, {displayName}. Here&rsquo;s everything, everywhere.</p>
        </div>
        <button
          onClick={() => {
            setQuickAddDate(undefined);
            setQuickAddOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <Plus size={16} /> New task
        </button>
      </div>

      <div className="mb-6">
        <SummaryTiles tiles={tiles} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterBar value={filters} onChange={setFilters} businesses={businesses} projects={projects} />
        <div className="flex rounded-lg border border-zinc-200 p-0.5">
          {(["list", "calendar"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${
                view === v ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : view === "list" ? (
        <TaskList tasks={displayed} onOpenTask={setSelected} onStatusChange={handleStatusChange} />
      ) : (
        <TaskCalendar
          tasks={displayed}
          onOpenTask={setSelected}
          onDayClick={(date) => {
            setQuickAddDate(date);
            setQuickAddOpen(true);
          }}
        />
      )}

      {quickAddOpen && (
        <QuickAddTask
          businesses={businesses}
          projects={projects}
          initialDueDate={quickAddDate}
          onCreate={async (input) => {
            await createTaskClient(input);
            refetchTasks();
          }}
          onProjectCreated={(project) => setProjects((prev) => [...prev, project])}
          onClose={() => setQuickAddOpen(false)}
        />
      )}

      {selected && (
        <TaskDrawer
          key={selected.id}
          task={selected}
          businesses={businesses}
          projects={projects}
          role={role}
          onClose={() => setSelected(null)}
          onSave={async (id, input) => {
            await updateTaskClient(id, input);
            await refetchTasks();
          }}
          onProjectCreated={(project) => setProjects((prev) => [...prev, project])}
          onDelete={
            role === "admin"
              ? async (id) => {
                  await deleteTaskClient(id);
                  setSelected(null);
                  await refetchTasks();
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
