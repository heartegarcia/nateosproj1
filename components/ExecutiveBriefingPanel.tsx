"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { AlertTriangle, CalendarDays, CheckCircle2, FileWarning } from "lucide-react";
import { fetchBriefing, todayLocalISO } from "@/lib/client/api";
import type { ExecutiveBriefing } from "@/lib/types";

/**
 * Everything Nate needs to understand in under 60 seconds, aggregated server-side into
 * one call: next event, application pipeline counts, this week's content-ready count,
 * and a documentation-health flag.
 */
export function ExecutiveBriefingPanel() {
  const [briefing, setBriefing] = useState<ExecutiveBriefing | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { briefing } = await fetchBriefing(todayLocalISO());
      if (!cancelled) setBriefing(briefing);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!briefing) return null;

  const hasApplications = briefing.applications.length > 0;

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <BriefingCard icon={CalendarDays} title="Next up">
        {briefing.nextEvent ? (
          <Link href={briefing.nextEvent.href} className="block hover:underline">
            <p className="truncate text-sm font-medium text-zinc-900">{briefing.nextEvent.title}</p>
            <p className="text-xs text-zinc-400">{format(parseISO(briefing.nextEvent.date), "EEE, MMM d")}</p>
          </Link>
        ) : (
          <p className="text-sm text-zinc-300">No upcoming events</p>
        )}
      </BriefingCard>

      <BriefingCard icon={CheckCircle2} title="Content this week">
        <p className="text-sm text-zinc-900">
          <span className="font-semibold">{briefing.contentReadyThisWeek}</span> of {briefing.contentTotalThisWeek} days
          ready
        </p>
      </BriefingCard>

      {hasApplications && (
        <BriefingCard icon={AlertTriangle} title="Applications">
          <div className="space-y-2">
            {briefing.applications.map((a) => (
              <div key={a.projectId}>
                <p className="mb-1 truncate text-xs font-medium text-zinc-500">{a.projectName}</p>
                <div className="flex flex-wrap gap-1.5">
                  {a.counts.map((c) => (
                    <span
                      key={c.label}
                      className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600"
                    >
                      {c.label}: {c.count}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </BriefingCard>
      )}

      {briefing.missingDocumentationCount > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:col-span-2">
          <FileWarning size={16} className="shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800">
            {briefing.missingDocumentationCount} task{briefing.missingDocumentationCount === 1 ? "" : "s"} completed this
            week with no project attached — nothing was filed for {briefing.missingDocumentationCount === 1 ? "it" : "them"}.
          </p>
        </div>
      )}
    </div>
  );
}

function BriefingCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        <Icon size={13} /> {title}
      </p>
      {children}
    </div>
  );
}
