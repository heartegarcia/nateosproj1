"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CheckCircle2, ChevronLeft, ChevronRight, Download, Trash2, X } from "lucide-react";
import {
  deleteSocialAttachment,
  fetchSocialSlots,
  setSocialDriveLinkClient,
  upsertSocialSlotClient,
  uploadSocialAttachment,
} from "@/lib/client/api";
import type { ContentStage, SocialSlot } from "@/lib/types";

function slotKey(date: string, stage: ContentStage) {
  return `${date}:${stage}`;
}

export function SocialCalendar() {
  const [cursor, setCursor] = useState(new Date());
  const [slots, setSlots] = useState<Map<string, SocialSlot>>(new Map());
  const [openDate, setOpenDate] = useState<string | null>(null);

  const start = startOfWeek(startOfMonth(cursor));
  const end = endOfWeek(endOfMonth(cursor));
  const fromISO = format(start, "yyyy-MM-dd");
  const toISO = format(end, "yyyy-MM-dd");

  const refresh = useCallback(async () => {
    const { slots } = await fetchSocialSlots(fromISO, toISO);
    const map = new Map<string, SocialSlot>();
    for (const s of slots) map.set(slotKey(s.content_date, s.stage), s);
    setSlots(map);
  }, [fromISO, toISO]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { slots } = await fetchSocialSlots(fromISO, toISO);
      if (cancelled) return;
      const map = new Map<string, SocialSlot>();
      for (const s of slots) map.set(slotKey(s.content_date, s.stage), s);
      setSlots(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [fromISO, toISO]);

  const days = useMemo(() => eachDayOfInterval({ start, end }), [start, end]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor((c) => addMonths(c, -1))}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
          >
            Today
          </button>
          <span className="ml-1 text-sm font-semibold text-zinc-900">{format(cursor, "MMMM yyyy")}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-amber-200" /> Concept/Script
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-purple-200" /> Final project
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-emerald-300" /> Ready
          </span>
        </div>
      </div>

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
          const concept = slots.get(slotKey(key, "concept"));
          const final = slots.get(slotKey(key, "final"));
          const conceptFilled = Boolean(concept?.filled);
          const finalFilled = Boolean(final?.filled);
          const ready = conceptFilled && finalFilled;
          const inMonth = isSameMonth(day, cursor);

          return (
            <button
              key={key}
              onClick={() => setOpenDate(key)}
              className={`relative flex min-h-[92px] flex-col overflow-hidden text-left ${inMonth ? "" : "opacity-50"}`}
            >
              <span
                className={`absolute left-1 top-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  isToday(day) ? "bg-zinc-900 font-semibold text-white" : "text-zinc-600"
                }`}
              >
                {format(day, "d")}
              </span>

              {ready ? (
                <span className="flex flex-1 flex-col items-center justify-center gap-1 bg-emerald-300 text-emerald-900">
                  <CheckCircle2 size={18} />
                  <span className="text-[10px] font-semibold">Ready</span>
                </span>
              ) : (
                <>
                  <span
                    className={`flex flex-1 items-end justify-end px-1 pb-0.5 text-[9px] font-medium ${
                      conceptFilled ? "bg-amber-300 text-amber-900" : "bg-amber-100 text-amber-500"
                    }`}
                  >
                    {conceptFilled ? "✓ Concept" : "Concept"}
                  </span>
                  <span
                    className={`flex flex-1 items-start justify-end px-1 pt-0.5 text-[9px] font-medium ${
                      finalFilled ? "bg-purple-300 text-purple-900" : "bg-purple-100 text-purple-500"
                    }`}
                  >
                    {finalFilled ? "✓ Final" : "Final"}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {openDate && (
        <DayModal
          date={openDate}
          concept={slots.get(slotKey(openDate, "concept")) ?? null}
          final={slots.get(slotKey(openDate, "final")) ?? null}
          onClose={() => setOpenDate(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function DayModal({
  date,
  concept,
  final,
  onClose,
  onChanged,
}: {
  date: string;
  concept: SocialSlot | null;
  final: SocialSlot | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">{format(new Date(date + "T12:00:00"), "EEEE, MMM d, yyyy")}</h2>
            <p className="text-xs text-zinc-400">Add the script/concept and the final content link. Both filled = green.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <StagePanel date={date} stage="concept" label="Concept / Script" accent="amber" slot={concept} onChanged={onChanged} />
          <StagePanel date={date} stage="final" label="Final project" accent="purple" slot={final} onChanged={onChanged} />
        </div>
      </div>
    </div>
  );
}

function StagePanel({
  date,
  stage,
  label,
  accent,
  slot,
  onChanged,
}: {
  date: string;
  stage: ContentStage;
  label: string;
  accent: "amber" | "purple";
  slot: SocialSlot | null;
  onChanged: () => Promise<void>;
}) {
  const [driveLink, setDriveLink] = useState(slot?.drive_link ?? "");
  const [savingLink, setSavingLink] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const headerBg = accent === "amber" ? "bg-amber-100 text-amber-900" : "bg-purple-100 text-purple-900";
  const filled = Boolean(slot?.filled);

  async function ensureSlotId(): Promise<string> {
    if (slot) return slot.id;
    const { slot: created } = await upsertSocialSlotClient(date, stage);
    return created.id;
  }

  async function handleSaveLink() {
    setSavingLink(true);
    try {
      const id = await ensureSlotId();
      await setSocialDriveLinkClient(id, driveLink);
      await onChanged();
    } finally {
      setSavingLink(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const id = await ensureSlotId();
      await uploadSocialAttachment(id, file);
      await onChanged();
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!slot) return;
    setBusy(true);
    try {
      await deleteSocialAttachment(slot.id, attachmentId);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200">
      <div className={`flex items-center justify-between rounded-t-xl px-4 py-2 ${headerBg}`}>
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-[11px] font-medium">{filled ? "✓ Provided" : "Waiting for output"}</span>
      </div>
      <div className="space-y-3 px-4 py-3">
        {slot && slot.attachments.length > 0 && (
          <ul className="space-y-1">
            {slot.attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5"
              >
                <span className="min-w-0 truncate text-xs text-zinc-700" title={a.file_name}>
                  {a.file_name}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <a
                    href={`/api/social-content/${slot.id}/attachments/${a.id}`}
                    className="text-zinc-400 hover:text-zinc-700"
                    title="Download"
                  >
                    <Download size={13} />
                  </a>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDeleteAttachment(a.id)}
                    className="text-zinc-400 hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2">
          <input
            value={driveLink}
            onChange={(e) => setDriveLink(e.target.value)}
            placeholder="Paste the Google Drive link…"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />
          <button
            type="button"
            onClick={handleSaveLink}
            disabled={savingLink}
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
          >
            {savingLink ? "…" : "Save link"}
          </button>
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700">
          {uploading ? "Uploading…" : "Attach script / concept file"}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </label>
      </div>
    </div>
  );
}
