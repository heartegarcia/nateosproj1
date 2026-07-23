"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Clipboard } from "lucide-react";
import { fetchReview, fetchReviewDates, fetchTasks, saveReviewClient, todayLocalISO } from "@/lib/client/api";
import { isLocalDate } from "@/lib/client/filtering";
import type { Task } from "@/lib/types";

function addDaysToDateStr(dateStr: string, delta: number): string {
  const d = parseISO(dateStr);
  d.setDate(d.getDate() + delta);
  return format(d, "yyyy-MM-dd");
}

function buildAutoSections(tasks: Task[], date: string) {
  const completedToday = tasks.filter((t) => t.completed_at && isLocalDate(t.completed_at, date));
  const byBusiness = new Map<string, Task[]>();
  for (const t of completedToday) {
    if (!byBusiness.has(t.business_name)) byBusiness.set(t.business_name, []);
    byBusiness.get(t.business_name)!.push(t);
  }
  return {
    completedByBusiness: Array.from(byBusiness.entries()).map(([business, items]) => ({ business, items })),
    inProgress: tasks.filter((t) => t.status === "in_progress"),
    waitingForNate: tasks.filter((t) => t.assignee === "nate" && t.status !== "completed"),
    overdue: tasks.filter((t) => t.is_overdue),
    // Completed with no project attached — the one case that structurally can't have
    // left a filed record behind, per "every completed task leaves a useful record."
    missingDocs: completedToday.filter((t) => !t.project_id),
  };
}

function formatAsMessage(
  date: string,
  auto: ReturnType<typeof buildAutoSections> | null,
  wins: string,
  blockers: string,
  tomorrow: string
): string {
  const lines: string[] = [`Daily Review — ${format(parseISO(date), "EEEE, MMM d, yyyy")}`, ""];

  if (auto) {
    lines.push("✅ Completed today:");
    if (auto.completedByBusiness.length === 0) lines.push("  —");
    for (const g of auto.completedByBusiness) {
      lines.push(`  ${g.business}:`);
      for (const t of g.items) lines.push(`    - ${t.title}`);
    }
    lines.push("");

    lines.push("🔄 In progress:");
    lines.push(...(auto.inProgress.length ? auto.inProgress.map((t) => `  - ${t.title} (${t.business_name})`) : ["  —"]));
    lines.push("");

    lines.push("⏳ Waiting for Nate:");
    lines.push(
      ...(auto.waitingForNate.length ? auto.waitingForNate.map((t) => `  - ${t.title} (${t.business_name})`) : ["  —"])
    );
    lines.push("");

    lines.push("🔴 Overdue:");
    lines.push(...(auto.overdue.length ? auto.overdue.map((t) => `  - ${t.title} (${t.business_name})`) : ["  —"]));
    lines.push("");
  }

  lines.push("Wins: " + (wins.trim() || "—"));
  lines.push("Blockers: " + (blockers.trim() || "—"));
  lines.push("Tomorrow: " + (tomorrow.trim() || "—"));

  return lines.join("\n");
}

export function ReviewCenterClient() {
  const today = todayLocalISO();
  const [selectedDate, setSelectedDate] = useState(today);
  const [wins, setWins] = useState("");
  const [blockers, setBlockers] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pastDates, setPastDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isToday = selectedDate === today;

  useEffect(() => {
    fetchReviewDates().then((r) => setPastDates(r.dates));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [reviewRes, tasksRes] = await Promise.all([
        fetchReview(selectedDate),
        isToday ? fetchTasks({ today: selectedDate }) : Promise.resolve({ tasks: [] as Task[] }),
      ]);
      if (cancelled) return;
      setWins(reviewRes.review?.wins ?? "");
      setBlockers(reviewRes.review?.blockers ?? "");
      setTomorrow(reviewRes.review?.tomorrow ?? "");
      setTasks(tasksRes.tasks);
      setDirty(false);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const auto = useMemo(() => (isToday ? buildAutoSections(tasks, selectedDate) : null), [isToday, tasks, selectedDate]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveReviewClient(selectedDate, { wins, blockers, tomorrow });
      setDirty(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
      const dates = await fetchReviewDates();
      setPastDates(dates.dates);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    const text = formatAsMessage(selectedDate, auto, wins, blockers, tomorrow);
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
          <p className="mt-1 text-sm text-zinc-500">{format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="flex items-center gap-2">
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
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
          >
            {!pastDates.includes(today) && <option value={today}>{today} (today)</option>}
            {pastDates.map((d) => (
              <option key={d} value={d}>
                {d}
                {d === today ? " (today)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : (
        <>
          {isToday && auto ? (
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ReviewSection title="✅ Completed today" empty={auto.completedByBusiness.length === 0}>
                {auto.completedByBusiness.map((g) => (
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
              <ReviewSection title="🔄 In progress" empty={auto.inProgress.length === 0}>
                {auto.inProgress.map((t) => (
                  <p key={t.id} className="truncate text-sm text-zinc-700">
                    {t.title} <span className="text-xs text-zinc-400">({t.business_name})</span>
                  </p>
                ))}
              </ReviewSection>
              <ReviewSection title="⏳ Waiting for Nate" empty={auto.waitingForNate.length === 0}>
                {auto.waitingForNate.map((t) => (
                  <p key={t.id} className="truncate text-sm text-zinc-700">
                    {t.title} <span className="text-xs text-zinc-400">({t.business_name})</span>
                  </p>
                ))}
              </ReviewSection>
              <ReviewSection title="🔴 Overdue" empty={auto.overdue.length === 0}>
                {auto.overdue.map((t) => (
                  <p key={t.id} className="truncate text-sm text-zinc-700">
                    {t.title} <span className="text-xs text-zinc-400">({t.business_name})</span>
                  </p>
                ))}
              </ReviewSection>
              <ReviewSection
                title="📋 Missing documentation"
                empty={auto.missingDocs.length === 0}
                className="sm:col-span-2"
              >
                <p className="mb-1.5 text-xs text-zinc-400">
                  Completed with no project attached — nothing was filed for these.
                </p>
                {auto.missingDocs.map((t) => (
                  <p key={t.id} className="truncate text-sm text-zinc-700">
                    {t.title} <span className="text-xs text-zinc-400">({t.business_name})</span>
                  </p>
                ))}
              </ReviewSection>
            </div>
          ) : (
            <p className="mb-6 text-xs text-zinc-400">
              Auto-generated sections (completed/in progress/waiting/overdue) only reflect live task state, so they&rsquo;re
              only shown for today. This date shows the saved Wins/Blockers/Tomorrow only.
            </p>
          )}

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
    </div>
  );
}

function ReviewSection({
  title,
  empty,
  className = "",
  children,
}: {
  title: string;
  empty: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-4 ${className}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</p>
      {empty ? <p className="text-sm text-zinc-300">—</p> : children}
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
