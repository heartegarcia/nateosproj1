"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useTaskData } from "@/lib/client/useTaskData";
import { fetchCalendarItems, updateTaskClient } from "@/lib/client/api";
import { urgencySort } from "@/lib/client/filtering";
import { TaskCalendar, type CalendarExtraItem } from "@/components/TaskCalendar";
import { TaskDrawer } from "@/components/TaskDrawer";
import { TaskList } from "@/components/TaskList";
import { ExecutiveBriefingPanel } from "@/components/ExecutiveBriefingPanel";
import { SummaryTiles, type Tile } from "@/components/SummaryTiles";
import type { Role, Task, TaskStatus } from "@/lib/types";

type TileKey = "needs_action" | "overdue" | "due_today";

export function ExecutiveDashboardClient({ displayName, role }: { displayName: string; role: Role }) {
  const router = useRouter();
  const { tasks, setTasks, businesses, projects, loading, asOf, refetchTasks } = useTaskData({ assignee: "nate" });
  const [view, setView] = useState<"list" | "calendar">("list");
  const [selected, setSelected] = useState<Task | null>(null);
  const [activeTile, setActiveTile] = useState<TileKey | null>(null);
  const [extraItems, setExtraItems] = useState<CalendarExtraItem[]>([]);
  const [calendarHrefs, setCalendarHrefs] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { items } = await fetchCalendarItems();
      if (cancelled) return;
      setExtraItems(items.map((it) => ({ id: it.id, date: it.date, title: it.title, color: it.business_color })));
      setCalendarHrefs(
        Object.fromEntries(
          items.map((it) => [it.id, `/businesses/${it.business_id}/projects/${it.project_id}/entries/${it.id}`])
        )
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const open = tasks.filter((t) => t.status !== "completed");
  const overdue = open.filter((t) => t.is_overdue);
  const today = format(new Date(), "yyyy-MM-dd");
  const dueToday = open.filter((t) => t.due_date === today);

  const tiles: Tile[] = [
    {
      key: "needs_action",
      label: "Needs your action",
      count: open.length,
      accent: "zinc",
      active: activeTile === "needs_action",
      onClick: () => setActiveTile((k) => (k === "needs_action" ? null : "needs_action")),
    },
    {
      key: "overdue",
      label: "Overdue",
      count: overdue.length,
      accent: "red",
      active: activeTile === "overdue",
      onClick: () => setActiveTile((k) => (k === "overdue" ? null : "overdue")),
    },
    {
      key: "due_today",
      label: "Due today",
      count: dueToday.length,
      accent: "amber",
      active: activeTile === "due_today",
      onClick: () => setActiveTile((k) => (k === "due_today" ? null : "due_today")),
    },
  ];

  const filtered = useMemo(() => {
    if (activeTile === "overdue") return open.filter((t) => t.is_overdue);
    if (activeTile === "due_today") return open.filter((t) => t.due_date === today);
    return open;
  }, [open, activeTile, today]);

  const sorted = useMemo(() => urgencySort(filtered), [filtered]);

  async function handleStatusChange(task: Task, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    await updateTaskClient(task.id, { status });
    refetchTasks();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Hey {displayName}</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Here&rsquo;s what needs you.</p>
        </div>
        {asOf && (
          <p className="text-xs text-zinc-400">as of {format(asOf, "MMM d, h:mm a")}</p>
        )}
      </div>

      <ExecutiveBriefingPanel />

      <div className="mb-6">
        <SummaryTiles tiles={tiles} />
      </div>

      <div className="mb-4 flex justify-end">
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
      ) : view === "calendar" ? (
        <TaskCalendar
          tasks={filtered}
          onOpenTask={setSelected}
          extraItems={extraItems}
          onExtraItemClick={(it) => {
            const href = calendarHrefs[it.id];
            if (href) router.push(href);
          }}
        />
      ) : (
        <TaskList
          tasks={sorted}
          onOpenTask={setSelected}
          onStatusChange={handleStatusChange}
          emptyMessage={activeTile ? "Nothing matches that filter." : "Nothing needs you right now."}
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
        />
      )}
    </div>
  );
}
