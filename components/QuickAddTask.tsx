"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createProjectClient } from "@/lib/client/api";
import type { Assignee, Business, ContentStage, CreateTaskInput, Priority, Project } from "@/lib/types";

const NEW_PROJECT = "__new__";

export function QuickAddTask({
  businesses,
  projects,
  defaultBusinessId,
  initialDueDate,
  onCreate,
  onProjectCreated,
  onClose,
}: {
  businesses: Business[];
  projects: Project[];
  defaultBusinessId?: string;
  initialDueDate?: string;
  onCreate: (input: CreateTaskInput) => Promise<void>;
  onProjectCreated: (project: Project) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [businessIdChoice, setBusinessIdChoice] = useState("");
  const [topProjectId, setTopProjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dueDate, setDueDate] = useState(initialDueDate ?? "");
  const [assignee, setAssignee] = useState<Assignee>("genie");
  const [priority, setPriority] = useState<Priority>("medium");
  const [contentStage, setContentStage] = useState<ContentStage | "">("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  // Derived rather than synced via effect: businesses/defaultBusinessId may arrive after mount.
  const businessId = businessIdChoice || defaultBusinessId || businesses[0]?.id || "";
  const businessName = businesses.find((b) => b.id === businessId)?.name ?? "";
  const isSocial = businessName === "Social Media";

  const topProjects = projects.filter((p) => p.business_id === businessId && !p.parent_project_id);
  const categories = topProjectId ? projects.filter((p) => p.parent_project_id === topProjectId) : [];
  const finalProjectId = categories.length > 0 ? categoryId : topProjectId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !businessId) return;
    setSaving(true);
    try {
      await onCreate({
        title: title.trim(),
        businessId,
        projectId: finalProjectId || null,
        assignee,
        basePriority: priority,
        dueDate: dueDate || null,
        notes: notes || null,
        contentStage: isSocial && contentStage ? contentStage : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateProject() {
    if (!newProjectName.trim() || !businessId) return;
    setSavingProject(true);
    try {
      const { project } = await createProjectClient({ businessId, name: newProjectName.trim() });
      onProjectCreated(project);
      setTopProjectId(project.id);
      setCategoryId("");
      setCreatingProject(false);
      setNewProjectName("");
    } finally {
      setSavingProject(false);
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
          <h3 className="text-sm font-semibold text-zinc-900">New task</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X size={18} />
          </button>
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          required
          className="mb-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
        />

        <div className="mb-3 grid grid-cols-2 gap-3">
          <select
            value={businessId}
            onChange={(e) => {
              setBusinessIdChoice(e.target.value);
              setTopProjectId("");
              setCategoryId("");
              setContentStage("");
              setCreatingProject(false);
            }}
            required
            className="input-select"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

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
              onChange={(e) => {
                if (e.target.value === NEW_PROJECT) {
                  setCreatingProject(true);
                } else {
                  setTopProjectId(e.target.value);
                  setCategoryId("");
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
              <option value={NEW_PROJECT}>+ New project in {businessName}…</option>
            </select>
          )}

          {categories.length > 0 && (
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input-select col-span-2"
            >
              <option value="">Choose a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {isSocial && (
            <select
              value={contentStage}
              onChange={(e) => setContentStage(e.target.value as ContentStage | "")}
              className="input-select col-span-2"
            >
              <option value="">Content stage (optional)</option>
              <option value="concept">Concept / Script (plots on the due date)</option>
              <option value="final">Final project (plots on the due date)</option>
            </select>
          )}

          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-select" />
          <select value={assignee} onChange={(e) => setAssignee(e.target.value as Assignee)} className="input-select">
            <option value="genie">Genie</option>
            <option value="nate">Nate</option>
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="input-select col-span-2"
          >
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </select>
        </div>

        {isSocial && contentStage && !dueDate && (
          <p className="mb-3 text-xs text-amber-600">
            Set a due date — that&rsquo;s the day this content gets plotted on the planner.
          </p>
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="mb-4 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
        />

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
            {saving ? "Adding…" : "Add task"}
          </button>
        </div>
      </form>
    </div>
  );
}
