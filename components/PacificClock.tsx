"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

export function PacificClock() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    function tick() {
      setLabel(formatter.format(new Date()));
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!label) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-500">
      <Clock size={12} />
      {label}
    </span>
  );
}
