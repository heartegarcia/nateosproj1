"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { X, Trash2 } from "lucide-react";
import {
  createProjectClient,
  createTaskFolder,
  deleteAttachment,
  fetchAttachments,
  fetchTaskFolders,
  uploadAttachment,
} from "@/lib/client/api";
import type { Assignee, Business, ContentStage, Priority, Project, Task, TaskStatus, UpdateTaskInput } from "@/lib/types";
import { AttachmentsSection } from "./AttachmentsSection";

const CHANNEL_OPTIONS: { key: "fb" | "ig" | "tiktok"; label: string }[] = [
  { key: "fb", label: "Facebook" },
  { key: "ig", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
];

const NEW_PROJECT = "__new__";

export function TaskDrawer({
  task,
  businesses,
  projects,
  role,
  onClose,
  onSave,
  onDelete,
  onProjectCreated,
}: {
  task: Task;
  businesses: Business[];
  projects: Project[];
  role: "admin" | "executive";
  onClose: () => void;
  onSave: (id: string, input: UpdateTaskInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onProjectCreated?: (project: Project) => void;
}) {
  const canEditAll = role === "admin";

  // Resolve the task's current project into a top-level project + optional category
  // child (Mydas clients nest category sub-folders under a parent project).
  const currentProject = projects.find((p) => p.id === task.project_id);
  const initialTop = currentProject?.parent_project_id ?? task.project_id ?? "";
  const initialCategory = currentProject?.parent_project_id ? (task.project_id ?? "") : "";

  const [title, setTitle] = useState(task.title);
  const [businessId, setBusinessId] = useState(task.business_id);
  const [topProjectId, setTopProjectId] = useState(initialTop);
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [assignee, setAssignee] = useState<Assignee>(task.assignee);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [basePriority, setBasePriority] = useState<Priority>(task.base_priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [nateNote, setNateNote] = useState(task.nate_note ?? "");
  const [channels, setChannels] = useState<string[]>(task.channels_list);
  const [contentStage, setContentStage] = useState<ContentStage | "">(task.content_stage ?? "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showAttachedNudge, setShowAttachedNudge] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  const businessName = businesses.find((b) => b.id === businessId)?.name ?? "";
  const isSocial = businessName === "Social Media";
  const topProjects = projects.filter((p) => p.business_id === businessId && !p.parent_project_id);
  const categories = topProjectId ? projects.filter((p) => p.parent_project_id === topProjectId) : [];
  const finalProjectId = categories.length > 0 ? categoryId : topProjectId;

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    setSavingProject(true);
    try {
      const { project } = await createProjectClient({ businessId, name: newProjectName.trim() });
      onProjectCreated?.(project);
      setTopProjectId(project.id);
      setCategoryId("");
      setCreatingProject(false);
      setNewProjectName("");
      setDirty(true);
    } finally {
      setSavingProject(false);
    }
  }

  async function handleMarkCompleteNow() {
    setMarkingComplete(true);
    try {
      await onSave(task.id, { status: "completed" });
      setStatus("completed");
      setShowAttachedNudge(false);
    } finally {
      setMarkingComplete(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(task.id, {
        title,
        businessId,
        projectId: finalProjectId || null,
        assignee,
        status,
        basePriority,
        dueDate: dueDate || null,
        notes: notes || null,
        nateNote: nateNote || null,
        channels: channels.length ? channels : null,
        contentStage: isSocial && contentStage ? contentStage : null,
      });
      setDirty(false);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-500">Task details</h2>
          <button onClick={onClose} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 px-5 py-5">
          <div>
            <input
              value={title}
              disabled={!canEditAll}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base font-medium text-zinc-900 outline-none focus:border-zinc-400 disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:text-zinc-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Business">
              <select
                value={businessId}
                disabled={!canEditAll}
                onChange={(e) => {
                  setBusinessId(e.target.value);
                  setTopProjectId("");
                  setCategoryId("");
                  setContentStage("");
                  setDirty(true);
                }}
                className="input-select"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Project">
              {creatingProject ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateProject();
                      }
                    }}
                    placeholder="Project name"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={handleCreateProject}
                    disabled={savingProject || !newProjectName.trim()}
                    className="shrink-0 rounded-lg bg-zinc-900 px-2 py-2 text-xs font-medium text-white disabled:opacity-40"
                  >
                    {savingProject ? "…" : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatingProject(false)}
                    className="shrink-0 text-zinc-400 hover:text-zinc-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <select
                  value={topProjectId}
                  disabled={!canEditAll}
                  onChange={(e) => {
                    if (e.target.value === NEW_PROJECT) {
                      setCreatingProject(true);
                    } else {
                      setTopProjectId(e.target.value);
                      setCategoryId("");
                      setDirty(true);
                    }
                  }}
                  className="input-select"
                >
                  <option value="">No project</option>
                  {topProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  {canEditAll && <option value={NEW_PROJECT}>+ New project…</option>}
                </select>
              )}
            </Field>
            {categories.length > 0 && (
              <Field label="Category">
                <select
                  value={categoryId}
                  disabled={!canEditAll}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setDirty(true);
                  }}
                  className="input-select"
                >
                  <option value="">Choose a category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Assignee">
              <select
                value={assignee}
                disabled={!canEditAll}
                onChange={(e) => {
                  setAssignee(e.target.value as Assignee);
                  setDirty(true);
                }}
                className="input-select"
              >
                <option value="genie">Genie</option>
                <option value="nate">Nate</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as TaskStatus);
                  setDirty(true);
                }}
                className="input-select"
              >
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={basePriority}
                disabled={!canEditAll}
                onChange={(e) => {
                  setBasePriority(e.target.value as Priority);
                  setDirty(true);
                }}
                className="input-select"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={dueDate}
                disabled={!canEditAll}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setDirty(true);
                }}
                className="input-select"
              />
            </Field>
          </div>

          {isSocial && (
            <Field label="Content stage (plots on the planner by due date)">
              <select
                value={contentStage}
                disabled={!canEditAll}
                onChange={(e) => {
                  setContentStage(e.target.value as ContentStage | "");
                  setDirty(true);
                }}
                className="input-select"
              >
                <option value="">Not planned</option>
                <option value="concept">Concept / Script</option>
                <option value="final">Final project</option>
              </select>
            </Field>
          )}

          {isSocial && (
            <Field label="Channels">
              <div className="flex flex-wrap gap-2">
                {CHANNEL_OPTIONS.map((c) => {
                  const active = channels.includes(c.key);
                  return (
                    <button
                      type="button"
                      key={c.key}
                      disabled={!canEditAll}
                      onClick={() => {
                        setChannels((prev) => (active ? prev.filter((x) => x !== c.key) : [...prev, c.key]));
                        setDirty(true);
                      }}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                        active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-600"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Notes (Genie)">
            <textarea
              value={notes}
              disabled={!canEditAll}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              rows={3}
              className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 disabled:border-transparent disabled:bg-zinc-50 disabled:text-zinc-500"
              placeholder="Working notes…"
            />
          </Field>

          <Field label="Nate's note">
            <textarea
              value={nateNote}
              onChange={(e) => {
                setNateNote(e.target.value);
                setDirty(true);
              }}
              rows={2}
              className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              placeholder="Nate can respond here without a chat message…"
            />
          </Field>

          <AttachmentsSection
            ownerId={task.id}
            fetchFn={fetchAttachments}
            uploadFn={uploadAttachment}
            deleteFn={deleteAttachment}
            downloadUrl={(taskId, attachmentId) => `/api/tasks/${taskId}/attachments/${attachmentId}`}
            fetchFoldersFn={fetchTaskFolders}
            createFolderFn={createTaskFolder}
            onAttached={() => {
              if (status !== "completed") setShowAttachedNudge(true);
            }}
          />

          {showAttachedNudge && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <span className="text-xs text-emerald-800">Attachment added — mark this task complete?</span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={handleMarkCompleteNow}
                  disabled={markingComplete}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
                >
                  {markingComplete ? "…" : "Mark complete"}
                </button>
                <button
                  onClick={() => setShowAttachedNudge(false)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Not yet
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between text-xs text-zinc-400">
            <span>Created {format(parseISO(task.created_at), "MMM d, yyyy")}</span>
            {task.completed_at && <span>Completed {format(parseISO(task.completed_at), "MMM d, yyyy")}</span>}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-4">
          {canEditAll && onDelete ? (
            <button
              onClick={() => onDelete(task.id)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-red-500 hover:bg-red-50"
            >
              <Trash2 size={14} /> Delete
            </button>
          ) : (
            <span />
          )}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
