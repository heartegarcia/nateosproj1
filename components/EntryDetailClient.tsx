"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ExternalLink, Trash2 } from "lucide-react";
import {
  createEntryFolder,
  deleteEntryAttachment,
  deleteEntryClient,
  fetchEntryAttachments,
  fetchEntryFolders,
  fetchProjectFields,
  updateEntryClient,
  uploadEntryAttachment,
} from "@/lib/client/api";
import { AttachmentsSection } from "@/components/AttachmentsSection";
import type { Business, Project, ProjectEntry, ProjectField, Role } from "@/lib/types";

export function EntryDetailClient({
  business,
  project,
  initialEntry,
  role,
}: {
  business: Business;
  project: Project;
  initialEntry: ProjectEntry;
  role: Role;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<ProjectField[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(initialEntry.title);
  const [values, setValues] = useState<Record<string, string>>(initialEntry.values);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { fields } = await fetchProjectFields(project.id);
      if (!cancelled) {
        setFields(fields);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateEntryClient(initialEntry.id, { title, values });
      setDirty(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await deleteEntryClient(initialEntry.id);
    router.push(`/businesses/${business.id}/projects/${project.id}`);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href={`/businesses/${business.id}/projects/${project.id}`}
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-600"
      >
        <ChevronLeft size={14} /> {project.name}
      </Link>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty(true);
        }}
        className="mb-6 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-lg font-semibold text-zinc-900 outline-none focus:border-zinc-400"
      />

      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : (
        <div className="mb-6 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white px-5 py-1">
          {fields.length === 0 && (
            <p className="py-4 text-xs text-zinc-400">
              No custom fields yet for this project — add some from &ldquo;Manage fields&rdquo; on the project page.
            </p>
          )}
          {fields.map((f) => (
            <FieldRow
              key={f.id}
              field={f}
              value={values[f.id] ?? ""}
              onChange={(v) => {
                setValues((prev) => ({ ...prev, [f.id]: v }));
                setDirty(true);
              }}
            />
          ))}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4">
        <AttachmentsSection
          ownerId={initialEntry.id}
          fetchFn={fetchEntryAttachments}
          uploadFn={uploadEntryAttachment}
          deleteFn={deleteEntryAttachment}
          downloadUrl={(entryId, attachmentId) => `/api/entries/${entryId}/attachments/${attachmentId}`}
          fetchFoldersFn={fetchEntryFolders}
          createFolderFn={createEntryFolder}
        />
      </div>

      <div className="flex items-center justify-between">
        {role === "admin" ? (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-red-500 hover:bg-red-50"
          >
            <Trash2 size={14} /> Delete entry
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {justSaved && <span className="text-xs font-medium text-emerald-600">✓ Saved</span>}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** One labeled field row, rendered with a type-appropriate control. Auto-numbers are
 * read-only (assigned on creation); links get an "open" affordance; long text gets a
 * roomy textarea; dates get a native date picker. Layout is deliberately airy and
 * label-aligned so an entry like an Event reads cleanly at a glance. */
function FieldRow({
  field,
  value,
  onChange,
}: {
  field: ProjectField;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400";

  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:items-start sm:gap-4">
      <span className="pt-2 text-xs font-medium text-zinc-500">{field.label}</span>
      <div>
        {field.field_type === "auto_number" ? (
          <span className="inline-block rounded-lg bg-zinc-100 px-3 py-2 font-mono text-sm text-zinc-700">
            {value || "—"}
          </span>
        ) : field.field_type === "select" ? (
          <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
            <option value="">Not set</option>
            {(field.options ? (JSON.parse(field.options) as string[]) : []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : field.field_type === "date" ? (
          <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
        ) : field.field_type === "link" ? (
          <div className="flex items-center gap-2">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Paste a link (e.g. Google Drive)"
              className={inputClass}
            />
            {value.trim() && (
              <a
                href={value}
                target="_blank"
                rel="noreferrer"
                title="Open link"
                className="shrink-0 rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
              >
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        ) : field.field_type === "longtext" ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className={`${inputClass} resize-y`}
            placeholder="Empty — fill in once you have it"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
            placeholder="Empty — fill in once you have it"
          />
        )}
      </div>
    </div>
  );
}
