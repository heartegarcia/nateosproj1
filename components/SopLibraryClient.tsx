"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, Plus, Search, Trash2, X } from "lucide-react";
import {
  createSopLinkClient,
  deleteSopDocumentClient,
  fetchSopDocuments,
  uploadSopFileClient,
} from "@/lib/client/api";
import type { Role, SopCategory, SopDocument } from "@/lib/types";

const CATEGORY_LABELS: Record<SopCategory, string> = {
  sop: "SOPs",
  contract: "Contracts / Agreements",
  playbook: "Playbook",
  training: "Training Videos",
  onboarding: "Onboarding",
  other: "Other",
};

const CATEGORY_ORDER: SopCategory[] = ["sop", "contract", "playbook", "training", "onboarding", "other"];

export function SopLibraryClient({ role }: { role: Role }) {
  const [documents, setDocuments] = useState<SopDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  async function refresh() {
    const { documents } = await fetchSopDocuments();
    setDocuments(documents);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, []);

  const filtered = documents.filter((d) => d.title.toLowerCase().includes(search.toLowerCase().trim()));
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    docs: filtered.filter((d) => d.category === cat),
  })).filter((g) => g.docs.length > 0);

  async function handleDelete(id: string) {
    await deleteSopDocumentClient(id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">SOP Library</h1>
          <p className="mt-1 text-sm text-zinc-500">SOPs, contracts, the playbook, training videos — uploaded or linked.</p>
        </div>
        {role === "admin" && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            <Plus size={16} /> Add
          </button>
        )}
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
        <Search size={14} className="text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title…"
          className="w-full text-sm text-zinc-900 outline-none"
        />
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-14 text-center text-sm text-zinc-400">
          Nothing here yet.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.category}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {CATEGORY_LABELS[g.category]}
              </p>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <ul className="divide-y divide-zinc-100">
                  {g.docs.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">{doc.title}</p>
                        {doc.notes && <p className="truncate text-xs text-zinc-400">{doc.notes}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {doc.external_url ? (
                          <a
                            href={doc.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800"
                          >
                            <ExternalLink size={13} /> Open
                          </a>
                        ) : (
                          <a
                            href={`/api/sop-documents/${doc.id}/download`}
                            className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800"
                          >
                            <Download size={13} /> Download
                          </a>
                        )}
                        {role === "admin" && (
                          <button onClick={() => handleDelete(doc.id)} className="text-zinc-400 hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <AddSopModal
          onClose={() => setAddOpen(false)}
          onCreated={(doc) => setDocuments((prev) => [doc, ...prev])}
        />
      )}
    </div>
  );
}

function AddSopModal({ onClose, onCreated }: { onClose: () => void; onCreated: (doc: SopDocument) => void }) {
  const [mode, setMode] = useState<"file" | "link">("link");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<SopCategory>("sop");
  const [notes, setNotes] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setSaving(true);
    try {
      if (mode === "link") {
        if (!externalUrl.trim()) {
          setError("Enter a link.");
          return;
        }
        const { document } = await createSopLinkClient({
          title: title.trim(),
          category,
          externalUrl: externalUrl.trim(),
          notes: notes || null,
        });
        onCreated(document);
      } else {
        if (!file) {
          setError("Choose a file.");
          return;
        }
        const { document } = await uploadSopFileClient(title.trim(), category, notes, file);
        onCreated(document);
      }
      onClose();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-16" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">Add to SOP Library</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X size={18} />
          </button>
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
          className="mb-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as SopCategory)}
          className="input-select mb-3"
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <div className="mb-3 flex rounded-lg border border-zinc-200 p-0.5">
          {(["link", "file"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                mode === m ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              {m === "link" ? "External link" : "Upload file"}
            </button>
          ))}
        </div>

        {mode === "link" ? (
          <input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://…"
            className="mb-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />
        ) : (
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mb-3 w-full text-sm text-zinc-700"
          />
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="mb-4 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
        />

        {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}
