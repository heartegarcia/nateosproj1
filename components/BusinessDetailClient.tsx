"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus, X } from "lucide-react";
import { useTaskData } from "@/lib/client/useTaskData";
import { createProjectClient, createTaskClient, deleteTaskClient, updateTaskClient } from "@/lib/client/api";
import { TaskList } from "@/components/TaskList";
import { TaskDrawer } from "@/components/TaskDrawer";
import { TaskCalendar } from "@/components/TaskCalendar";
import { QuickAddTask } from "@/components/QuickAddTask";
import { SocialCalendar } from "@/components/SocialCalendar";
import type { Business, Role, Task, TaskStatus } from "@/lib/types";

type BusinessView = "list" | "calendar" | "planner";

export function BusinessDetailClient({ business, role }: { business: Business; role: Role }) {
  const { tasks, setTasks, businesses, projects, setProjects, loading, refetchTasks } = useTaskData({
    businessId: business.id,
  });
  const isSocial = business.name === "Social Media";
  const [view, setView] = useState<BusinessView>("list");
  const [selected, setSelected] = useState<Task | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<string | undefined>(undefined);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  const sorted = useMemo(
    () => [...tasks].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")),
    [tasks]
  );
  const open = tasks.filter((t) => t.status !== "completed").length;
  const overdue = tasks.filter((t) => t.is_overdue).length;
  const businessProjects = projects.filter((p) => p.business_id === business.id);

  async function handleStatusChange(task: Task, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    await updateTaskClient(task.id, { status });
    refetchTasks();
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    setSavingProject(true);
    try {
      const { project } = await createProjectClient({ businessId: business.id, name: newProjectName.trim() });
      setProjects((prev) => [...prev, project]);
      setCreatingProject(false);
      setNewProjectName("");
    } finally {
      setSavingProject(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: business.color }} />
            <h1 className="text-xl font-semibold text-zinc-900">{business.name}</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {open} open · {overdue} overdue · {tasks.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-zinc-200 p-0.5">
            {((isSocial ? ["list", "calendar", "planner"] : ["list", "calendar"]) as BusinessView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${
                  view === v ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {role === "admin" && (
            <button
              onClick={() => {
                setQuickAddDate(undefined);
                setQuickAddOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              <Plus size={16} /> New task
            </button>
          )}
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Projects</span>
          {role === "admin" &&
            (creatingProject ? (
              <span className="flex items-center gap-1">
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
                  className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
                <button
                  onClick={handleCreateProject}
                  disabled={savingProject || !newProjectName.trim()}
                  className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
                >
                  {savingProject ? "…" : "Add"}
                </button>
                <button onClick={() => setCreatingProject(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X size={14} />
                </button>
              </span>
            ) : (
              <button
                onClick={() => setCreatingProject(true)}
                title="New project"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-800"
              >
                <Plus size={16} />
              </button>
            ))}
        </div>

        {businessProjects.length === 0 ? (
          <p className="text-sm text-zinc-400">No projects yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {businessProjects.map((p) => (
              <Link
                key={p.id}
                href={`/businesses/${business.id}/projects/${p.id}`}
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
              >
                <FolderKanban size={18} className="text-zinc-400" />
                <span className="text-sm font-medium text-zinc-900">{p.name}</span>
                <span className="text-xs capitalize text-zinc-400">{p.health.replace("_", " ")}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {view === "planner" ? (
        <SocialCalendar />
      ) : loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : view === "list" ? (
        <TaskList tasks={sorted} onOpenTask={setSelected} onStatusChange={handleStatusChange} />
      ) : (
        <TaskCalendar
          tasks={sorted}
          onOpenTask={setSelected}
          onDayClick={
            role === "admin"
              ? (date) => {
                  setQuickAddDate(date);
                  setQuickAddOpen(true);
                }
              : undefined
          }
        />
      )}

      {quickAddOpen && (
        <QuickAddTask
          businesses={businesses}
          projects={projects}
          defaultBusinessId={business.id}
          initialDueDate={quickAddDate}
          onCreate={async (input) => {
            await createTaskClient(input);
            refetchTasks();
          }}
          onProjectCreated={(project) => setProjects((prev) => [...prev, project])}
          onClose={() => setQuickAddOpen(false)}
        />
      )}

      {selected && (
        <TaskDrawer
          key={selected.id}
          task={selected}
          businesses={businesses}
          projects={projects}
          role={role}
          onClose={() => setSelected(null)}
          onSave={async (id, input) => {
            await updateTaskClient(id, input);
            await refetchTasks();
          }}
          onProjectCreated={(project) => setProjects((prev) => [...prev, project])}
          onDelete={
            role === "admin"
              ? async (id) => {
                  await deleteTaskClient(id);
                  setSelected(null);
                  await refetchTasks();
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
