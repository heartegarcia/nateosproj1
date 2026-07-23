"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, FileStack, FolderKanban, Plus, Settings2, Trash2, X } from "lucide-react";
import {
  createProjectEntryClient,
  createProjectFieldClient,
  deleteProjectFieldClient,
  deleteProjectClient,
  fetchChildProjects,
  fetchProjectEntries,
  fetchProjectFields,
  updateProjectClient,
  updateProjectViewModeClient,
} from "@/lib/client/api";
import { ProjectTimeline } from "@/components/ProjectTimeline";
import type {
  Business,
  CreateProjectFieldInput,
  FieldType,
  Project,
  ProjectEntry,
  ProjectField,
  ProjectHealth,
  ProjectStatus,
  ProjectViewMode,
  Role,
} from "@/lib/types";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  longtext: "Long text",
  date: "Date",
  link: "Link",
  auto_number: "Auto-number",
  select: "Status / select",
};

const HEALTH_STYLES: Record<ProjectHealth, string> = {
  on_track: "bg-emerald-100 text-emerald-700",
  at_risk: "bg-amber-100 text-amber-700",
  behind: "bg-red-100 text-red-700",
};

const HEALTH_LABELS: Record<ProjectHealth, string> = {
  on_track: "On track",
  at_risk: "At risk",
  behind: "Behind",
};

export function ProjectDetailClient({
  business,
  project,
  parentProject,
  role,
}: {
  business: Business;
  project: Project;
  parentProject: Project | null;
  role: Role;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<ProjectField[]>([]);
  const [entries, setEntries] = useState<ProjectEntry[]>([]);
  const [children, setChildren] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [manageFieldsOpen, setManageFieldsOpen] = useState(false);
  const [creatingEntry, setCreatingEntry] = useState(false);
  const [newEntryTitle, setNewEntryTitle] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);
  const [viewMode, setViewMode] = useState<ProjectViewMode>(project.view_mode);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [health, setHealth] = useState<ProjectHealth>(project.health);
  const [detailView, setDetailView] = useState<"categories" | "timeline">("categories");

  const hasChildren = children.length > 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [f, e, c] = await Promise.all([
        fetchProjectFields(project.id),
        fetchProjectEntries(project.id),
        fetchChildProjects(project.id),
      ]);
      if (cancelled) return;
      setFields(f.fields);
      setEntries(e.entries);
      setChildren(c.projects);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  async function refreshEntries() {
    const { entries } = await fetchProjectEntries(project.id);
    setEntries(entries);
  }

  async function handleCreateEntry() {
    if (!newEntryTitle.trim()) return;
    setSavingEntry(true);
    try {
      await createProjectEntryClient(project.id, newEntryTitle.trim());
      await refreshEntries();
      setCreatingEntry(false);
      setNewEntryTitle("");
    } finally {
      setSavingEntry(false);
    }
  }

  async function handleViewModeChange(next: ProjectViewMode) {
    setViewMode(next);
    await updateProjectViewModeClient(project.id, next);
  }

  async function handleHealthChange(next: ProjectHealth) {
    setHealth(next);
    await updateProjectClient(project.id, { health: next });
  }

  async function handleStatusChange(next: ProjectStatus) {
    setStatus(next);
    await updateProjectClient(project.id, { status: next });
  }

  async function handleDeleteProject() {
    if (!confirm(`Delete "${project.name}"? This also removes anything filed inside it. This can't be undone from here.`))
      return;
    setDeleting(true);
    try {
      await deleteProjectClient(project.id);
      router.push(parentProject ? `/businesses/${business.id}/projects/${parentProject.id}` : `/businesses/${business.id}`);
    } finally {
      setDeleting(false);
    }
  }

  const backHref = parentProject
    ? `/businesses/${business.id}/projects/${parentProject.id}`
    : `/businesses/${business.id}`;
  const backLabel = parentProject ? parentProject.name : business.name;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href={backHref}
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-600"
      >
        <ChevronLeft size={14} /> {backLabel}
      </Link>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: business.color }} />
          <h1 className="text-xl font-semibold text-zinc-900">{project.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {hasChildren && (
            <div className="flex rounded-lg border border-zinc-200 p-0.5">
              {(["categories", "timeline"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setDetailView(v)}
                  className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${
                    detailView === v ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {!hasChildren && (
            <div className="flex rounded-lg border border-zinc-200 p-0.5">
              {(["gallery", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => handleViewModeChange(v)}
                  className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${
                    viewMode === v ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {role === "admin" && !hasChildren && (
            <button
              onClick={() => setManageFieldsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-zinc-300"
            >
              <Settings2 size={14} /> Manage fields
            </button>
          )}
          {role === "admin" && (
            <button
              onClick={handleDeleteProject}
              disabled={deleting}
              title="Delete this project"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:border-red-200 hover:bg-red-50 disabled:opacity-40"
            >
              <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
          {!hasChildren && (
            <button
              onClick={() => setCreatingEntry(true)}
              className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              <Plus size={16} /> New entry
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {role === "admin" ? (
          <>
            <select
              value={health}
              onChange={(e) => handleHealthChange(e.target.value as ProjectHealth)}
              className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none ${HEALTH_STYLES[health]}`}
            >
              <option value="on_track">On track</option>
              <option value="at_risk">At risk</option>
              <option value="behind">Behind</option>
            </select>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
              className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 outline-none"
            >
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="completed">Completed</option>
            </select>
          </>
        ) : (
          <>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${HEALTH_STYLES[health]}`}>
              {HEALTH_LABELS[health]}
            </span>
            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium capitalize text-zinc-600">
              {status.replace("_", " ")}
            </span>
          </>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : hasChildren && detailView === "timeline" ? (
        <ProjectTimeline projectId={project.id} />
      ) : hasChildren ? (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Categories</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {children.map((c) => (
              <Link
                key={c.id}
                href={`/businesses/${business.id}/projects/${c.id}`}
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
              >
                <FolderKanban size={18} className="text-zinc-400" />
                <span className="text-sm font-medium text-zinc-900">{c.name}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-14 text-center text-sm text-zinc-400">
          Nothing here yet. Create a task with this project selected, or add an entry directly.
        </div>
      ) : viewMode === "list" ? (
        <EntryListTable entries={entries} fields={fields} businessId={business.id} projectId={project.id} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} fields={fields} businessId={business.id} projectId={project.id} />
          ))}
        </div>
      )}

      {creatingEntry && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-24"
          onClick={() => setCreatingEntry(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">New entry</h3>
              <button onClick={() => setCreatingEntry(false)} className="text-zinc-400 hover:text-zinc-600">
                <X size={18} />
              </button>
            </div>
            <input
              autoFocus
              value={newEntryTitle}
              onChange={(e) => setNewEntryTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateEntry();
                }
              }}
              placeholder="Title"
              className="mb-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCreatingEntry(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEntry}
                disabled={savingEntry || !newEntryTitle.trim()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {savingEntry ? "Adding…" : "Add entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {manageFieldsOpen && (
        <ManageFieldsModal
          projectId={project.id}
          fields={fields}
          onFieldsChange={setFields}
          onClose={() => setManageFieldsOpen(false)}
        />
      )}
    </div>
  );
}

function labeledPreviews(entry: ProjectEntry, fields: ProjectField[], max: number) {
  return fields
    .map((f) => ({ label: f.label, value: entry.values[f.id] }))
    .filter((p) => p.value && p.value.trim())
    .slice(0, max);
}

function EntryCard({
  entry,
  fields,
  businessId,
  projectId,
}: {
  entry: ProjectEntry;
  fields: ProjectField[];
  businessId: string;
  projectId: string;
}) {
  const previews = labeledPreviews(entry, fields, 3);

  return (
    <Link
      href={`/businesses/${businessId}/projects/${projectId}/entries/${entry.id}`}
      className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
    >
      <FileStack size={18} className="text-zinc-400" />
      <span className="text-sm font-medium text-zinc-900">{entry.title}</span>
      {previews.length > 0 ? (
        <div className="space-y-0.5">
          {previews.map((p, i) => (
            <div key={i} className="truncate text-xs text-zinc-500">
              <span className="text-zinc-400">{p.label}: </span>
              {p.value}
            </div>
          ))}
        </div>
      ) : (
        <span className="text-xs text-zinc-300">No details yet</span>
      )}
    </Link>
  );
}

const TH = "border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-500 whitespace-nowrap";
const TD = "border border-zinc-200 px-3 py-2 align-top text-sm";

function EntryListTable({
  entries,
  fields,
  businessId,
  projectId,
}: {
  entries: ProjectEntry[];
  fields: ProjectField[];
  businessId: string;
  projectId: string;
}) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={TH}>Title</th>
            {fields.map((f) => (
              <th key={f.id} className={TH}>
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              onClick={() => router.push(`/businesses/${businessId}/projects/${projectId}/entries/${entry.id}`)}
              className="cursor-pointer hover:bg-zinc-50"
            >
              <td className={`${TD} font-medium text-zinc-900`}>{entry.title}</td>
              {fields.map((f) => (
                <td key={f.id} className={`${TD} max-w-[16rem] truncate text-xs text-zinc-500`} title={entry.values[f.id] ?? ""}>
                  {entry.values[f.id] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManageFieldsModal({
  projectId,
  fields,
  onFieldsChange,
  onClose,
}: {
  projectId: string;
  fields: ProjectField[];
  onFieldsChange: (fields: ProjectField[]) => void;
  onClose: () => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [autoNumberPrefix, setAutoNumberPrefix] = useState("");
  const [syncToCalendar, setSyncToCalendar] = useState(false);
  const [optionsText, setOptionsText] = useState("");
  const [isStatus, setIsStatus] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!newLabel.trim()) return;
    setSaving(true);
    try {
      const input: CreateProjectFieldInput = { label: newLabel.trim(), fieldType };
      if (fieldType === "auto_number") input.autoNumberPrefix = autoNumberPrefix.trim();
      if (fieldType === "date") input.syncToCalendar = syncToCalendar;
      if (fieldType === "select") {
        input.options = optionsText
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean);
        input.isStatus = isStatus;
      }
      const { field } = await createProjectFieldClient(projectId, input);
      onFieldsChange([...fields, field]);
      setNewLabel("");
      setFieldType("text");
      setAutoNumberPrefix("");
      setSyncToCalendar(false);
      setOptionsText("");
      setIsStatus(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(fieldId: string) {
    await deleteProjectFieldClient(projectId, fieldId);
    onFieldsChange(fields.filter((f) => f.id !== fieldId));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-20" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">Manage fields</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-xs text-zinc-400">
          Fields show on every entry in this project. Dates can auto-appear on Nate&rsquo;s calendar, auto-numbers assign
          IDs like SOA001, and a status/select field marked as this project&rsquo;s status feeds the Executive Briefing.
        </p>
        <ul className="mb-4 space-y-1.5">
          {fields.map((f) => (
            <li key={f.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm text-zinc-700">{f.label}</span>
                <span className="shrink-0 rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                  {FIELD_TYPE_LABELS[f.field_type]}
                  {f.field_type === "auto_number" && f.auto_number_prefix ? ` · ${f.auto_number_prefix}` : ""}
                  {f.field_type === "date" && f.sync_to_calendar ? " · calendar" : ""}
                  {f.field_type === "select" && f.is_status ? " · briefing" : ""}
                </span>
              </span>
              <button onClick={() => handleRemove(f.id)} className="shrink-0 text-zinc-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
          {fields.length === 0 && <li className="text-xs text-zinc-400">No custom fields yet.</li>}
        </ul>

        <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Field label, e.g. Event date"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />
          <select
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as FieldType)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          >
            <option value="text">Text</option>
            <option value="longtext">Long text</option>
            <option value="date">Date</option>
            <option value="link">Link</option>
            <option value="auto_number">Auto-number (e.g. SOA001)</option>
            <option value="select">Status / select (e.g. Draft → Submitted → Accepted)</option>
          </select>
          {fieldType === "auto_number" && (
            <input
              value={autoNumberPrefix}
              onChange={(e) => setAutoNumberPrefix(e.target.value)}
              placeholder="Prefix, e.g. SOA"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
          )}
          {fieldType === "date" && (
            <label className="flex items-center gap-2 px-1 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={syncToCalendar}
                onChange={(e) => setSyncToCalendar(e.target.checked)}
              />
              Show this date on Nate&rsquo;s calendar
            </label>
          )}
          {fieldType === "select" && (
            <>
              <input
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="Options, comma separated: Draft, Submitted, Accepted, Rejected"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              />
              <label className="flex items-center gap-2 px-1 text-xs text-zinc-600">
                <input type="checkbox" checked={isStatus} onChange={(e) => setIsStatus(e.target.checked)} />
                Use as this project&rsquo;s status (shows on the Executive Briefing)
              </label>
            </>
          )}
          <button
            onClick={handleAdd}
            disabled={saving || !newLabel.trim()}
            className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add field"}
          </button>
        </div>
      </div>
    </div>
  );
}
