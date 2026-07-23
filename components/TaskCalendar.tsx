"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Task } from "@/lib/types";

export type CalendarView = "month" | "week" | "day";

/** A non-task marker overlaid on the calendar (e.g. an Event's date surfaced from a
 * project entry). Rendered distinctly from task dots and navigates on click. */
export interface CalendarExtraItem {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  color: string;
}

function groupByDueDate(tasks: Task[]) {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    const key = t.due_date.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return map;
}

function groupExtra(items: CalendarExtraItem[]) {
  const map = new Map<string, CalendarExtraItem[]>();
  for (const it of items) {
    const key = it.date.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  return map;
}

export function TaskCalendar({
  tasks,
  onOpenTask,
  onDayClick,
  extraItems = [],
  onExtraItemClick,
}: {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onDayClick?: (dateStr: string) => void;
  extraItems?: CalendarExtraItem[];
  onExtraItemClick?: (item: CalendarExtraItem) => void;
}) {
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(new Date());

  const byDate = useMemo(() => groupByDueDate(tasks), [tasks]);
  const extraByDate = useMemo(() => groupExtra(extraItems), [extraItems]);

  function navigate(dir: 1 | -1) {
    if (view === "month") setCursor((c) => addMonths(c, dir));
    else if (view === "week") setCursor((c) => addWeeks(c, dir));
    else setCursor((c) => addDays(c, dir));
  }

  const label =
    view === "month"
      ? format(cursor, "MMMM yyyy")
      : view === "week"
        ? `${format(startOfWeek(cursor), "MMM d")} – ${format(endOfWeek(cursor), "MMM d, yyyy")}`
        : format(cursor, "EEEE, MMM d, yyyy");

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => navigate(1)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
          >
            Today
          </button>
          <span className="ml-1 text-sm font-semibold text-zinc-900">{label}</span>
        </div>
        <div className="flex rounded-lg border border-zinc-200 p-0.5">
          {(["month", "week", "day"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${
                view === v ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "month" && (
        <MonthGrid
          cursor={cursor}
          byDate={byDate}
          extraByDate={extraByDate}
          onOpenTask={onOpenTask}
          onDayClick={onDayClick}
          onExtraItemClick={onExtraItemClick}
        />
      )}
      {view === "week" && (
        <WeekGrid
          cursor={cursor}
          byDate={byDate}
          extraByDate={extraByDate}
          onOpenTask={onOpenTask}
          onDayClick={onDayClick}
          onExtraItemClick={onExtraItemClick}
        />
      )}
      {view === "day" && (
        <DayAgenda
          cursor={cursor}
          byDate={byDate}
          extraByDate={extraByDate}
          onOpenTask={onOpenTask}
          onDayClick={onDayClick}
          onExtraItemClick={onExtraItemClick}
        />
      )}
    </div>
  );
}

function DayDots({ tasks, onOpenTask, max = 3 }: { tasks: Task[]; onOpenTask: (t: Task) => void; max?: number }) {
  const shown = tasks.slice(0, max);
  const overflow = tasks.length - shown.length;
  return (
    <div className="mt-1 space-y-1">
      {shown.map((t) => (
        <button
          key={t.id}
          onClick={(e) => {
            e.stopPropagation();
            onOpenTask(t);
          }}
          className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-zinc-100"
          title={t.title}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: t.business_color }} />
          <span className={`truncate ${t.status === "completed" ? "text-zinc-400 line-through" : "text-zinc-700"}`}>
            {t.title}
          </span>
        </button>
      ))}
      {overflow > 0 && <div className="px-1 text-[11px] text-zinc-400">+{overflow} more</div>}
    </div>
  );
}

function ExtraDots({
  items,
  onExtraItemClick,
}: {
  items: CalendarExtraItem[];
  onExtraItemClick?: (item: CalendarExtraItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-1 space-y-1">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={(e) => {
            e.stopPropagation();
            onExtraItemClick?.(it);
          }}
          className="flex w-full items-center gap-1 truncate rounded border border-dashed border-zinc-200 px-1 py-0.5 text-left text-[11px] hover:bg-zinc-100"
          title={it.title}
        >
          <CalendarClock size={11} className="shrink-0" style={{ color: it.color }} />
          <span className="truncate text-zinc-600">{it.title}</span>
        </button>
      ))}
    </div>
  );
}

function MonthGrid({
  cursor,
  byDate,
  extraByDate,
  onOpenTask,
  onDayClick,
  onExtraItemClick,
}: {
  cursor: Date;
  byDate: Map<string, Task[]>;
  extraByDate: Map<string, CalendarExtraItem[]>;
  onOpenTask: (t: Task) => void;
  onDayClick?: (dateStr: string) => void;
  onExtraItemClick?: (item: CalendarExtraItem) => void;
}) {
  const start = startOfWeek(startOfMonth(cursor));
  const end = endOfWeek(endOfMonth(cursor));
  const days = eachDayOfInterval({ start, end });

  return (
    <div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-zinc-400">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-zinc-100">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = byDate.get(key) ?? [];
          const dayExtra = extraByDate.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          return (
            <div
              key={key}
              onClick={() => onDayClick?.(key)}
              className={`group min-h-[86px] bg-white p-1.5 ${inMonth ? "" : "bg-zinc-50/60"} ${
                onDayClick ? "cursor-pointer hover:bg-zinc-50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    isToday(day) ? "bg-zinc-900 font-semibold text-white" : inMonth ? "text-zinc-600" : "text-zinc-300"
                  }`}
                >
                  {format(day, "d")}
                </span>
                {onDayClick && (
                  <Plus size={12} className="text-zinc-300 opacity-0 group-hover:opacity-100" />
                )}
              </div>
              <DayDots tasks={dayTasks} onOpenTask={onOpenTask} />
              <ExtraDots items={dayExtra} onExtraItemClick={onExtraItemClick} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  cursor,
  byDate,
  extraByDate,
  onOpenTask,
  onDayClick,
  onExtraItemClick,
}: {
  cursor: Date;
  byDate: Map<string, Task[]>;
  extraByDate: Map<string, CalendarExtraItem[]>;
  onOpenTask: (t: Task) => void;
  onDayClick?: (dateStr: string) => void;
  onExtraItemClick?: (item: CalendarExtraItem) => void;
}) {
  const start = startOfWeek(cursor);
  const days = eachDayOfInterval({ start, end: endOfWeek(cursor) });

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-zinc-100">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const dayTasks = byDate.get(key) ?? [];
        const dayExtra = extraByDate.get(key) ?? [];
        return (
          <div
            key={key}
            onClick={() => onDayClick?.(key)}
            className={`group min-h-[220px] bg-white p-2 ${onDayClick ? "cursor-pointer hover:bg-zinc-50" : ""}`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">{format(day, "EEE")}</span>
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  isToday(day) ? "bg-zinc-900 font-semibold text-white" : "text-zinc-600"
                }`}
              >
                {format(day, "d")}
              </span>
            </div>
            <DayDots tasks={dayTasks} onOpenTask={onOpenTask} max={8} />
            <ExtraDots items={dayExtra} onExtraItemClick={onExtraItemClick} />
            {onDayClick && (
              <Plus size={12} className="mt-1 text-zinc-300 opacity-0 group-hover:opacity-100" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DayAgenda({
  cursor,
  byDate,
  extraByDate,
  onOpenTask,
  onDayClick,
  onExtraItemClick,
}: {
  cursor: Date;
  byDate: Map<string, Task[]>;
  extraByDate: Map<string, CalendarExtraItem[]>;
  onOpenTask: (t: Task) => void;
  onDayClick?: (dateStr: string) => void;
  onExtraItemClick?: (item: CalendarExtraItem) => void;
}) {
  const key = format(cursor, "yyyy-MM-dd");
  const dayTasks = (byDate.get(key) ?? []).sort((a, b) => a.title.localeCompare(b.title));
  const dayExtra = extraByDate.get(key) ?? [];

  return (
    <div>
      {dayExtra.length > 0 && (
        <ul className="mb-3 space-y-1">
          {dayExtra.map((it) => (
            <li key={it.id}>
              <button
                onClick={() => onExtraItemClick?.(it)}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-50"
              >
                <CalendarClock size={14} style={{ color: it.color }} />
                <span className="text-zinc-700">{it.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {onDayClick && (
        <button
          onClick={() => onDayClick(key)}
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-200 py-2 text-xs font-medium text-zinc-400 hover:border-zinc-300 hover:text-zinc-600"
        >
          <Plus size={13} /> Add task on this day
        </button>
      )}
      {dayTasks.length === 0 ? (
        <div className="py-10 text-center text-sm text-zinc-400">
          Nothing due {isSameDay(cursor, new Date()) ? "today" : "this day"}.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {dayTasks.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onOpenTask(t)}
                className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-zinc-50"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.business_color }} />
                <span
                  className={`flex-1 text-sm ${t.status === "completed" ? "text-zinc-400 line-through" : "text-zinc-800"}`}
                >
                  {t.title}
                </span>
                <span className="text-xs text-zinc-400">{t.business_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

