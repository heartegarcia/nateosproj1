"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarRange, ChevronLeft, ChevronRight, Clipboard } from "lucide-react";
import { fetchReview, fetchReviewDates, fetchTasks, saveReviewClient, todayLocalISO } from "@/lib/client/api";
import type { DailyReview, ReviewTaskSummary, Task } from "@/lib/types";

type Mode = "day" | "range";

function addDaysToDateStr(dateStr: string, delta: number): string {
  const d = parseISO(dateStr);
  d.setDate(d.getDate() + delta);
  return format(d, "yyyy-MM-dd");
}

function toSummary(tasks: Task[]): ReviewTaskSummary[] {
  return tasks.map((t) => ({ id: t.id, title: t.title, business_name: t.business_name }));
}

function groupByBusiness(tasks: Task[]): { business: string; items: Task[] | ReviewTaskSummary[] }[] {
  const byBusiness = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!byBusiness.has(t.business_name)) byBusiness.set(t.business_name, []);
    byBusiness.get(t.business_name)!.push(t);
  }
  return Array.from(byBusiness.entries()).map(([business, items]) => ({ business, items }));
}

/** "Completed" can always be reconstructed live for ANY date, past or present, because
 * completed_at never changes once set — unlike in-progress/waiting/overdue, which are
 * mutable point-in-time states that only a same-day snapshot can capture accurately. */
function completedInRange(tasks: Task[], from: string, to: string): Task[] {
  return tasks.filter((t) => {
    if (!t.completed_at) return false;
    const localDate = format(parseISO(t.completed_at), "yyyy-MM-dd");
    return localDate >= from && localDate <= to;
  });
}

function formatAsMessage(
  date: string,
  completedByBusiness: { business: string; items: Task[] }[],
  inProgress: ReviewTaskSummary[],
  waiting: ReviewTaskSummary[],
  overdue: ReviewTaskSummary[],
  wins: string,
  blockers: string,
  tomorrow: string
): string {
  const lines: string[] = [`Daily Review — ${format(parseISO(date), "EEEE, MMM d, yyyy")}`, ""];

  lines.push("✅ Completed:");
  if (completedByBusiness.length === 0) lines.push("  —");
  for (const g of completedByBusiness) {
    lines.push(`  ${g.business}:`);
    for (const t of g.items) lines.push(`    - ${t.title}`);
  }
  lines.push("");

  lines.push("🔄 In progress:");
  lines.push(...(inProgress.length ? inProgress.map((t) => `  - ${t.title} (${t.business_name})`) : ["  —"]));
  lines.push("");

  lines.push("⏳ Waiting for Nate:");
  lines.push(...(waiting.length ? waiting.map((t) => `  - ${t.title} (${t.business_name})`) : ["  —"]));
  lines.push("");

  lines.push("🔴 Overdue:");
  lines.push(...(overdue.length ? overdue.map((t) => `  - ${t.title} (${t.business_name})`) : ["  —"]));
  lines.push("");

  lines.push("Wins: " + (wins.trim() || "—"));
  lines.push("Blockers: " + (blockers.trim() || "—"));
  lines.push("Tomorrow: " + (tomorrow.trim() || "—"));

  return lines.join("\n");
}

export function ReviewCenterClient() {
  const today = todayLocalISO();
  const [mode, setMode] = useState<Mode>("day");
  const [selectedDate, setSelectedDate] = useState(today);
  const [rangeFrom, setRangeFrom] = useState(addDaysToDateStr(today, -6));
  const [rangeTo, setRangeTo] = useState(today);
  const [wins, setWins] = useState("");
  const [blockers, setBlockers] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [review, setReview] = useState<DailyReview | null>(null);
  const [pastDates, setPastDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isToday = selectedDate === today;

  // All tasks are fetched once — "Completed" is filtered live from completed_at for any
  // date, so there's no need to refetch per selected date.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tasksRes, datesRes] = await Promise.all([fetchTasks({ today }), fetchReviewDates()]);
      if (cancelled) return;
      setTasks(tasksRes.tasks);
      setTasksLoaded(true);
      setPastDates(datesRes.dates);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { review } = await fetchReview(selectedDate);
      if (cancelled) return;
      setReview(review);
      setWins(review?.wins ?? "");
      setBlockers(review?.blockers ?? "");
      setTomorrow(review?.tomorrow ?? "");
      setDirty(false);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const completedByBusiness = useMemo(() => {
    if (!tasksLoaded) return [];
    return groupByBusiness(completedInRange(tasks, selectedDate, selectedDate)) as { business: string; items: Task[] }[];
  }, [tasks, tasksLoaded, selectedDate]);

  const liveInProgress = useMemo(() => tasks.filter((t) => t.status === "in_progress"), [tasks]);
  const liveWaiting = useMemo(() => tasks.filter((t) => t.assignee === "nate" && t.status !== "completed"), [tasks]);
  const liveOverdue = useMemo(() => tasks.filter((t) => t.is_overdue), [tasks]);

  // Snapshot today's mutable sections every time today's Review Center is viewed, so a
  // later look-back at this exact date has something real to show. Past dates are never
  // overwritten — this only fires when selectedDate === today.
  useEffect(() => {
    if (!isToday || !tasksLoaded) return;
    saveReviewClient(today, {
      inProgressSummary: toSummary(liveInProgress),
      waitingSummary: toSummary(liveWaiting),
      overdueSummary: toSummary(liveOverdue),
    });
  }, [isToday, tasksLoaded, today, liveInProgress, liveWaiting, liveOverdue]);

  const inProgress: ReviewTaskSummary[] = isToday ? toSummary(liveInProgress) : review?.in_progress_summary ?? [];
  const waiting: ReviewTaskSummary[] = isToday ? toSummary(liveWaiting) : review?.waiting_summary ?? [];
  const overdue: ReviewTaskSummary[] = isToday ? toSummary(liveOverdue) : review?.overdue_summary ?? [];
  const hasHistoricalSnapshot =
    isToday ||
    (review !== null &&
      (review.in_progress_summary !== null || review.waiting_summary !== null || review.overdue_summary !== null));

  const rangeCompleted = useMemo(() => {
    if (!tasksLoaded || rangeFrom > rangeTo) return [];
    return groupByBusiness(completedInRange(tasks, rangeFrom, rangeTo)) as { business: string; items: Task[] }[];
  }, [tasks, tasksLoaded, rangeFrom, rangeTo]);
  const rangeCompletedCount = rangeCompleted.reduce((sum, g) => sum + g.items.length, 0);

  async function handleSave() {
    setSaving(true);
    try {
      await saveReviewClient(selectedDate, { wins, blockers, tomorrow });
      setDirty(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
      const { dates } = await fetchReviewDates();
      setPastDates(dates);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    const text = formatAsMessage(selectedDate, completedByBusiness, inProgress, waiting, overdue, wins, blockers, tomorrow);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers/contexts that block the async Clipboard API.
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch {
        // Give up silently — the confirmation below still tells the user we tried.
      }
    }
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2500);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Review Center</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {mode === "day" ? format(parseISO(selectedDate), "EEEE, MMMM d, yyyy") : "Custom range summary"}
          </p>
        </div>
        <div className="flex rounded-lg border border-zinc-200 p-0.5">
          {(["day", "range"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium capitalize ${
                mode === m ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              {m === "range" && <CalendarRange size={13} />}
              {m === "day" ? "Day" : "Range"}
            </button>
          ))}
        </div>
      </div>

      {mode === "day" ? (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedDate((d) => addDaysToDateStr(d, -1))}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setSelectedDate((d) => addDaysToDateStr(d, 1))}
              disabled={isToday}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(today)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
              >
                Today
              </button>
            )}
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
            />
            {pastDates.length > 0 && (
              <select
                value={pastDates.includes(selectedDate) ? selectedDate : ""}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
              >
                <option value="">Jump to a saved date…</option>
                {pastDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                    {d === today ? " (today)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {loading || !tasksLoaded ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ReviewSection title="✅ Completed" empty={completedByBusiness.length === 0}>
                  {completedByBusiness.map((g) => (
                    <div key={g.business} className="mb-2">
                      <p className="mb-1 text-xs font-semibold text-zinc-400">{g.business}</p>
                      {g.items.map((t) => (
                        <p key={t.id} className="truncate text-sm text-zinc-700">
                          {t.title}
                        </p>
                      ))}
                    </div>
                  ))}
                </ReviewSection>
                <ReviewSection title="🔄 In progress" empty={inProgress.length === 0} note={!hasHistoricalSnapshot ? "Not recorded for this date." : undefined}>
                  {inProgress.map((t) => (
                    <p key={t.id} className="truncate text-sm text-zinc-700">
                      {t.title} <span className="text-xs text-zinc-400">({t.business_name})</span>
                    </p>
                  ))}
                </ReviewSection>
                <ReviewSection title="⏳ Waiting for Nate" empty={waiting.length === 0} note={!hasHistoricalSnapshot ? "Not recorded for this date." : undefined}>
                  {waiting.map((t) => (
                    <p key={t.id} className="truncate text-sm text-zinc-700">
                      {t.title} <span className="text-xs text-zinc-400">({t.business_name})</span>
                    </p>
                  ))}
                </ReviewSection>
                <ReviewSection title="🔴 Overdue" empty={overdue.length === 0} note={!hasHistoricalSnapshot ? "Not recorded for this date." : undefined}>
                  {overdue.map((t) => (
                    <p key={t.id} className="truncate text-sm text-zinc-700">
                      {t.title} <span className="text-xs text-zinc-400">({t.business_name})</span>
                    </p>
                  ))}
                </ReviewSection>
              </div>

              <div className="mb-6 space-y-4">
                <ReviewField
                  label="Wins"
                  value={wins}
                  onChange={(v) => {
                    setWins(v);
                    setDirty(true);
                  }}
                />
                <ReviewField
                  label="Blockers"
                  value={blockers}
                  onChange={(v) => {
                    setBlockers(v);
                    setDirty(true);
                  }}
                />
                <ReviewField
                  label="Tomorrow"
                  value={tomorrow}
                  onChange={(v) => {
                    setTomorrow(v);
                    setDirty(true);
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:border-zinc-300"
                >
                  <Clipboard size={14} /> {justCopied ? "Copied!" : "Copy as message"}
                </button>
                <div className="flex items-center gap-3">
                  {justSaved && <span className="text-xs font-medium text-emerald-600">✓ Saved</span>}
                  <button
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {saving ? "Saving…" : "Save review"}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={rangeFrom}
              max={rangeTo}
              onChange={(e) => e.target.value && setRangeFrom(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
            />
            <span className="text-zinc-400">–</span>
            <input
              type="date"
              value={rangeTo}
              min={rangeFrom}
              max={today}
              onChange={(e) => e.target.value && setRangeTo(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
            />
          </div>

          {!tasksLoaded ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="mb-3 text-sm font-medium text-zinc-900">
                {rangeCompletedCount} task{rangeCompletedCount === 1 ? "" : "s"} completed between{" "}
                {format(parseISO(rangeFrom), "MMM d")} and {format(parseISO(rangeTo), "MMM d, yyyy")}
              </p>
              {rangeCompleted.length === 0 ? (
                <p className="text-sm text-zinc-300">Nothing completed in this range.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {rangeCompleted.map((g) => (
                    <div key={g.business}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{g.business}</p>
                      {g.items.map((t) => (
                        <p key={t.id} className="truncate text-sm text-zinc-700">
                          {t.title}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReviewSection({
  title,
  empty,
  note,
  children,
}: {
  title: string;
  empty: boolean;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</p>
      {empty ? <p className="text-sm text-zinc-300">{note ?? "—"}</p> : children}
    </div>
  );
}

function ReviewField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
        placeholder={`${label}…`}
      />
    </label>
  );
}
