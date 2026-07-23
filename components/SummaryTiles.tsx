"use client";

export interface Tile {
  key: string;
  label: string;
  count: number;
  accent?: "red" | "amber" | "blue" | "emerald" | "zinc";
  active?: boolean;
  onClick?: () => void;
}

const ACCENT: Record<NonNullable<Tile["accent"]>, string> = {
  red: "text-red-600",
  amber: "text-amber-600",
  blue: "text-blue-600",
  emerald: "text-emerald-600",
  zinc: "text-zinc-900",
};

export function SummaryTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={t.onClick}
          disabled={!t.onClick}
          className={`rounded-2xl border p-4 text-left transition-colors ${
            t.active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white hover:border-zinc-300"
          } ${t.onClick ? "cursor-pointer" : "cursor-default"}`}
        >
          <div className={`text-2xl font-semibold tabular-nums ${t.active ? "text-white" : ACCENT[t.accent ?? "zinc"]}`}>
            {t.count}
          </div>
          <div className={`mt-0.5 text-xs font-medium ${t.active ? "text-zinc-300" : "text-zinc-500"}`}>{t.label}</div>
        </button>
      ))}
    </div>
  );
}
