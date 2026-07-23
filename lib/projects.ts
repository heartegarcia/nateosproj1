import { randomUUID } from "node:crypto";
import { db } from "./db";
import { getBusinessById } from "./businesses";
import type { CreateProjectInput, Project, ProjectViewMode, UpdateProjectInput } from "./types";

/** Clients under the "Mydas" business are auto-scaffolded with these four category
 * sub-folders, matching Nate's per-client OS build workflow. */
export const MYDAS_BUSINESS_NAME = "Mydas";
export const MYDAS_CATEGORIES = ["Transcripts", "Claude Prompts", "Dashboard Concepts", "Presentation"] as const;

export function listProjectsByBusiness(businessId: string): Project[] {
  return db
    .prepare(
      "SELECT * FROM projects WHERE business_id = ? AND parent_project_id IS NULL AND deleted_at IS NULL ORDER BY created_at ASC"
    )
    .all(businessId) as Project[];
}

export function listAllProjects(): Project[] {
  return db.prepare("SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at ASC").all() as Project[];
}

export function listChildProjects(parentProjectId: string): Project[] {
  return db
    .prepare("SELECT * FROM projects WHERE parent_project_id = ? AND deleted_at IS NULL ORDER BY created_at ASC")
    .all(parentProjectId) as Project[];
}

export function getProjectById(id: string): Project | null {
  return (db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project | undefined) ?? null;
}

function insertProject(input: {
  businessId: string;
  name: string;
  description: string | null;
  parentProjectId: string | null;
}): Project {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO projects (id, business_id, parent_project_id, name, description, status, health, created_at)
     VALUES (@id, @businessId, @parentProjectId, @name, @description, 'active', 'on_track', @createdAt)`
  ).run({
    id,
    businessId: input.businessId,
    parentProjectId: input.parentProjectId,
    name: input.name,
    description: input.description,
    createdAt: now,
  });
  return getProjectById(id)!;
}

export function createProject(input: CreateProjectInput): Project {
  const parentProjectId = input.parentProjectId ?? null;
  const project = insertProject({
    businessId: input.businessId,
    name: input.name,
    description: input.description ?? null,
    parentProjectId,
  });

  // Top-level clients under Mydas get the four standard category sub-folders.
  if (!parentProjectId) {
    const business = getBusinessById(input.businessId);
    if (business?.name === MYDAS_BUSINESS_NAME) {
      for (const category of MYDAS_CATEGORIES) {
        insertProject({
          businessId: input.businessId,
          name: category,
          description: null,
          parentProjectId: project.id,
        });
      }
    }
  }

  return project;
}

export function updateProjectViewMode(id: string, viewMode: ProjectViewMode): Project | null {
  db.prepare("UPDATE projects SET view_mode = ? WHERE id = ?").run(viewMode, id);
  return getProjectById(id);
}

export function updateProject(id: string, input: UpdateProjectInput): Project | null {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };
  if (input.status !== undefined) {
    fields.push("status = @status");
    params.status = input.status;
  }
  if (input.health !== undefined) {
    fields.push("health = @health");
    params.health = input.health;
  }
  if (fields.length === 0) return getProjectById(id);
  db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = @id`).run(params);
  return getProjectById(id);
}

/** Top-level projects that have child sub-projects — the generalized "client" shape
 * (Mydas today, potentially other nested businesses later). Used by the Executive
 * Briefing to surface per-client health/status without hardcoding a business name. */
export function listClientLikeProjects(): Project[] {
  return db
    .prepare(
      `SELECT * FROM projects p
       WHERE p.parent_project_id IS NULL AND p.deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM projects c WHERE c.parent_project_id = p.id AND c.deleted_at IS NULL)
       ORDER BY p.created_at ASC`
    )
    .all() as Project[];
}

/** Soft-deletes a project and cascades to its child projects (Mydas categories). */
export function softDeleteProject(id: string): void {
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare("UPDATE projects SET deleted_at = @now WHERE id = @id").run({ id, now });
    db.prepare("UPDATE projects SET deleted_at = @now WHERE parent_project_id = @id AND deleted_at IS NULL").run({
      id,
      now,
    });
  });
  tx();
}
