"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { FileStack, Paperclip } from "lucide-react";
import { fetchProjectTimeline } from "@/lib/client/api";
import type { TimelineItem } from "@/lib/types";

/** Interleaves every entry and attachment across a client's category sub-projects into
 * one chronological read — "how did this evolve" answered by scrolling one list instead
 * of hopping between Transcripts / Prompts / Dashboard Concepts / Presentation. */
export function ProjectTimeline({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { items } = await fetchProjectTimeline(projectId);
      if (!cancelled) {
        setItems(items);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) return <p className="text-sm text-zinc-400">Loading…</p>;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-14 text-center text-sm text-zinc-400">
        Nothing filed yet across this client&rsquo;s categories.
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-zinc-200 pl-6">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-zinc-300" />
          <Link
            href={item.entryHref}
            className="flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-300"
          >
            {item.type === "entry" ? (
              <FileStack size={15} className="mt-0.5 shrink-0 text-zinc-400" />
            ) : (
              <Paperclip size={15} className="mt-0.5 shrink-0 text-zinc-400" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900">{item.title}</p>
              <p className="text-xs text-zinc-400">
                {item.categoryName} · {format(parseISO(item.date), "MMM d, yyyy")}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
