"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, FileStack, FolderKanban, Paperclip, Plus, Search, BookOpen } from "lucide-react";
import { searchClient } from "@/lib/client/api";
import type { SearchResult, SearchResultType } from "@/lib/types";

const TYPE_ICON: Record<SearchResultType, React.ComponentType<{ size?: number; className?: string }>> = {
  task: CheckSquare,
  entry: FileStack,
  project: FolderKanban,
  attachment: Paperclip,
  sop: BookOpen,
};

/**
 * Global ⌘K / Ctrl+K search across tasks, filed records, projects, attachment file
 * names, and the SOP Library — the "where did we save that?" killer. Mounted once in
 * AppShell so it's available from every page. Task results deep-link into Action
 * Center (the one view with no fixed business/assignee filter) via ?task=<id>, which
 * ActionCenterClient picks up to auto-open that task's drawer.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      if (!query.trim()) {
        if (!cancelled) setResults([]);
        return;
      }
      setLoading(true);
      const { results } = await searchClient(query.trim());
      if (!cancelled) {
        setResults(results);
        setActiveIndex(0);
        setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, open]);

  function go(result: SearchResult) {
    onClose();
    router.push(result.href);
  }

  function handleNewTask() {
    onClose();
    router.push("/action-center?new=1");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-24" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
          <Search size={16} className="shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[activeIndex]) {
                e.preventDefault();
                go(results[activeIndex]);
              }
            }}
            placeholder="Search tasks, records, projects, files…"
            className="w-full text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
          />
          <kbd className="shrink-0 rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          <button
            onClick={handleNewTask}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <Plus size={15} className="shrink-0 text-zinc-400" />
            New task
          </button>

          {loading && <p className="px-3 py-2 text-xs text-zinc-400">Searching…</p>}

          {!loading && query.trim() && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-zinc-400">No matches for &ldquo;{query}&rdquo;.</p>
          )}

          {results.map((r, i) => {
            const Icon = TYPE_ICON[r.type];
            return (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => go(r)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left ${
                  activeIndex === i ? "bg-zinc-100" : ""
                }`}
              >
                <Icon size={15} className="shrink-0 text-zinc-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-900">{r.title}</span>
                  <span className="block truncate text-xs text-zinc-400">{r.subtitle}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
