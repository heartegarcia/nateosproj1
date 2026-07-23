"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { MessageSquarePlus } from "lucide-react";
import { useTaskData } from "@/lib/client/useTaskData";
import { fetchCalendarItems, updateTaskClient } from "@/lib/client/api";
import { urgencySort } from "@/lib/client/filtering";
import { TaskCalendar, type CalendarExtraItem } from "@/components/TaskCalendar";
import { TaskDrawer } from "@/components/TaskDrawer";
import { ExecutiveBriefingPanel } from "@/components/ExecutiveBriefingPanel";
import { PriorityBadge } from "@/components/PriorityBadge";
import { BusinessChip } from "@/components/BusinessChip";
import { SummaryTiles, type Tile } from "@/components/SummaryTiles";
import type { Role, Task } from "@/lib/types";

function fmtDate(iso: string | null) {
  if (!iso) return "No due date";
  try {
    return format(parseISO(iso), "EEE, MMM d");
  } catch {
    return "—";
  }
}

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

  async function markDone(task: Task) {
    const next = task.status === "completed" ? "not_started" : "completed";
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    await updateTaskClient(task.id, { status: next });
    refetchTasks();
  }

  async function saveNote(task: Task, note: string) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, nate_note: note } : t)));
    await updateTaskClient(task.id, { nateNote: note });
    refetchTasks();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
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
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-14 text-center text-sm text-zinc-400">
          {activeTile ? "Nothing matches that filter." : "Nothing needs you right now."}
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((task) => (
            <ExecutiveTaskRow
              key={task.id}
              task={task}
              onMarkDone={() => markDone(task)}
              onSaveNote={(note) => saveNote(task, note)}
              onOpen={() => setSelected(task)}
            />
          ))}
        </ul>
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

function ExecutiveTaskRow({
  task,
  onMarkDone,
  onSaveNote,
  onOpen,
}: {
  task: Task;
  onMarkDone: () => void;
  onSaveNote: (note: string) => void;
  onOpen: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(task.nate_note ?? "");

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkDone();
          }}
          title="Mark done"
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            task.status === "completed" ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-300 hover:border-zinc-500"
          }`}
        >
          {task.status === "completed" && "✓"}
        </button>

        <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpen}>
          <p className={`text-base font-medium ${task.status === "completed" ? "text-zinc-400 line-through" : "text-zinc-900"}`}>
            {task.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <BusinessChip name={task.business_name} color={task.business_color} />
            <span className="text-xs text-zinc-500">{fmtDate(task.due_date)}</span>
            <PriorityBadge task={task} />
          </div>
        </div>
      </div>

      {noteOpen ? (
        <div className="mt-3 pl-9" onClick={(e) => e.stopPropagation()}>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Respond without a chat message…"
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                onSaveNote(note);
                setNoteOpen(false);
              }}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Save note
            </button>
            <button onClick={() => setNoteOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setNoteOpen(true);
          }}
          className="mt-2 flex items-center gap-1.5 pl-9 text-xs font-medium text-zinc-400 hover:text-zinc-600"
        >
          <MessageSquarePlus size={13} />
          {task.nate_note ? "Edit note" : "Add note"}
        </button>
      )}
    </li>
  );
}
