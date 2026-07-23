import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "nate-os.db");

declare global {
  var __nateOsDb: Database.Database | undefined;
}

function createConnection() {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','executive')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_hold','completed')),
      health TEXT NOT NULL DEFAULT 'on_track' CHECK (health IN ('on_track','at_risk','behind')),
      created_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      project_id TEXT REFERENCES projects(id),
      assignee TEXT NOT NULL DEFAULT 'genie' CHECK (assignee IN ('genie','nate')),
      status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
      base_priority TEXT NOT NULL DEFAULT 'medium' CHECK (base_priority IN ('high','medium','low')),
      due_date TEXT,
      notes TEXT,
      nate_note TEXT,
      channels TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee, status);
    CREATE INDEX IF NOT EXISTS idx_tasks_business ON tasks(business_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

    CREATE TABLE IF NOT EXISTS task_attachments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      folder TEXT NOT NULL DEFAULT 'General',
      file_name TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_task ON task_attachments(task_id);

    -- Projects act as galleries: each entry is a "page" inside a project, optionally
    -- linked 1:1 to the task that created it. Fields are a per-project custom schema
    -- (e.g. Event/TF Offered/Location for "Speaking Opportunity Applications", or
    -- Theme/Materials/Logistics for "Events") so every project can shape its own gallery
    -- without hardcoding field sets per project name.
    CREATE TABLE IF NOT EXISTS project_fields (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      label TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'text',
      auto_number_prefix TEXT,
      sync_to_calendar INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL,
      linked_task_id TEXT REFERENCES tasks(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS project_entry_values (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES project_entries(id),
      field_id TEXT NOT NULL REFERENCES project_fields(id),
      value TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE(entry_id, field_id)
    );

    CREATE TABLE IF NOT EXISTS entry_attachments (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES project_entries(id),
      folder TEXT NOT NULL DEFAULT 'General',
      file_name TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_project_fields_project ON project_fields(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_entries_project ON project_entries(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_entries_task ON project_entries(linked_task_id);
    CREATE INDEX IF NOT EXISTS idx_entry_values_entry ON project_entry_values(entry_id);
    CREATE INDEX IF NOT EXISTS idx_entry_attachments_entry ON entry_attachments(entry_id);

    -- Folders as real, persisted containers: created immediately via "+ New folder" so
    -- they show up even before a file is uploaded into them (previously a folder only
    -- existed implicitly once an attachment used its name, which read as "I can only
    -- create one folder" once you'd uploaded to it and had nothing left to click).
    CREATE TABLE IF NOT EXISTS task_folders (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(task_id, name)
    );

    CREATE TABLE IF NOT EXISTS entry_folders (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES project_entries(id),
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(entry_id, name)
    );

    CREATE INDEX IF NOT EXISTS idx_task_folders_task ON task_folders(task_id);
    CREATE INDEX IF NOT EXISTS idx_entry_folders_entry ON entry_folders(entry_id);

    -- One row per calendar date. Only Wins/Blockers/Tomorrow are stored — the rest of
    -- the Review Center (completed today, in progress, waiting for Nate, overdue) is
    -- computed live from tasks and never persisted.
    CREATE TABLE IF NOT EXISTS daily_reviews (
      id TEXT PRIMARY KEY,
      review_date TEXT NOT NULL UNIQUE,
      wins TEXT,
      blockers TEXT,
      tomorrow TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sop_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('sop','contract','playbook','training','onboarding','other')),
      storage_path TEXT,
      file_name TEXT,
      external_url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sop_documents_category ON sop_documents(category);

    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      work_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      notes TEXT,
      invoice_id TEXT REFERENCES invoices(id),
      created_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number INTEGER NOT NULL UNIQUE,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      total_hours REAL NOT NULL,
      hourly_rate REAL NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid')),
      approval_task_id TEXT REFERENCES tasks(id),
      pdf_storage_path TEXT,
      created_at TEXT NOT NULL
    );

    -- Single row (id = 'singleton'), created lazily on first read/write.
    CREATE TABLE IF NOT EXISTS invoice_settings (
      id TEXT PRIMARY KEY,
      full_name TEXT,
      bank_details TEXT,
      hourly_rate REAL,
      payment_terms TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(work_date);
    CREATE INDEX IF NOT EXISTS idx_time_entries_invoice ON time_entries(invoice_id);

    -- Social Media content planner: one slot per (date, stage). "concept" = the
    -- yellow Concept/Script half, "final" = the purple Final project half. A slot is
    -- "filled" once it has a drive_link OR at least one attachment; a calendar day goes
    -- green when both halves are filled. task_id links the slot to the Action Center task
    -- that plotted it (so completing the task and filling the slot stay in sync).
    CREATE TABLE IF NOT EXISTS social_content (
      id TEXT PRIMARY KEY,
      content_date TEXT NOT NULL,
      stage TEXT NOT NULL CHECK (stage IN ('concept','final')),
      title TEXT,
      task_id TEXT REFERENCES tasks(id),
      drive_link TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(content_date, stage)
    );

    CREATE TABLE IF NOT EXISTS social_attachments (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL REFERENCES social_content(id),
      file_name TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_social_content_date ON social_content(content_date);
    CREATE INDEX IF NOT EXISTS idx_social_attachments_slot ON social_attachments(slot_id);
  `);

  const projectColumns = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!projectColumns.some((c) => c.name === "view_mode")) {
    db.exec(
      `ALTER TABLE projects ADD COLUMN view_mode TEXT NOT NULL DEFAULT 'gallery' CHECK (view_mode IN ('gallery','list'))`
    );
  }
  if (!projectColumns.some((c) => c.name === "parent_project_id")) {
    db.exec(`ALTER TABLE projects ADD COLUMN parent_project_id TEXT REFERENCES projects(id)`);
  }

  const fieldColumns = db.prepare("PRAGMA table_info(project_fields)").all() as { name: string }[];
  if (!fieldColumns.some((c) => c.name === "field_type")) {
    db.exec(`ALTER TABLE project_fields ADD COLUMN field_type TEXT NOT NULL DEFAULT 'text'`);
  }
  if (!fieldColumns.some((c) => c.name === "auto_number_prefix")) {
    db.exec(`ALTER TABLE project_fields ADD COLUMN auto_number_prefix TEXT`);
  }
  if (!fieldColumns.some((c) => c.name === "sync_to_calendar")) {
    db.exec(`ALTER TABLE project_fields ADD COLUMN sync_to_calendar INTEGER NOT NULL DEFAULT 0`);
  }
  if (!fieldColumns.some((c) => c.name === "options")) {
    db.exec(`ALTER TABLE project_fields ADD COLUMN options TEXT`);
  }
  if (!fieldColumns.some((c) => c.name === "is_status")) {
    db.exec(`ALTER TABLE project_fields ADD COLUMN is_status INTEGER NOT NULL DEFAULT 0`);
  }

  const taskColumns = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  if (!taskColumns.some((c) => c.name === "content_stage")) {
    db.exec(`ALTER TABLE tasks ADD COLUMN content_stage TEXT`);
  }

  return db;
}

export const db = globalThis.__nateOsDb ?? createConnection();
if (process.env.NODE_ENV !== "production") globalThis.__nateOsDb = db;
