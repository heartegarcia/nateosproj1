"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createBusinessClient } from "@/lib/client/api";
import type { Role } from "@/lib/types";

export interface BusinessSummary {
  id: string;
  name: string;
  color: string;
  open: number;
  overdue: number;
  pct: number;
}

const DEFAULT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9", "#8b5cf6", "#ef4444", "#14b8a6"];

export function BusinessesIndexClient({ businesses, role }: { businesses: BusinessSummary[]; role: Role }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLORS[businesses.length % DEFAULT_COLORS.length]);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createBusinessClient({ name: name.trim(), color });
      setCreating(false);
      setName("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Businesses</h1>
          <p className="mt-1 text-sm text-zinc-500">Every business is a filtered view over the same task list.</p>
        </div>
        {role === "admin" && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            <Plus size={16} /> New business
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {businesses.map((b) => (
          <Link
            key={b.id}
            href={`/businesses/${b.id}`}
            className="rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
              <h2 className="text-sm font-semibold text-zinc-900">{b.name}</h2>
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span>
                <span className="font-semibold text-zinc-900">{b.open}</span> open
              </span>
              <span className={b.overdue > 0 ? "font-semibold text-red-600" : ""}>
                <span className="font-semibold">{b.overdue}</span> overdue
              </span>
              <span>{b.pct}% complete</span>
            </div>
          </Link>
        ))}
      </div>

      {creating && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-24"
          onClick={() => setCreating(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">New business</h3>
              <button onClick={() => setCreating(false)} className="text-zinc-400 hover:text-zinc-600">
                <X size={18} />
              </button>
            </div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Business name"
              className="mb-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
            <div className="mb-4 flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full ${color === c ? "ring-2 ring-offset-2 ring-zinc-900" : ""}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCreating(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !name.trim()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {saving ? "Adding…" : "Add business"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
