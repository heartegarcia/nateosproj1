-- Nate OS — Postgres schema for Supabase
--
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- It is safe to re-run: every statement uses IF NOT EXISTS.
--
-- Ported from the original local SQLite schema. Differences worth knowing:
--   * REAL            -> DOUBLE PRECISION (money math; avoids float4 rounding surprises)
--   * Tables are ordered so foreign keys always reference an already-created table
--     (SQLite tolerated forward references, Postgres does not).
--   * Boolean-ish flags stay INTEGER (0/1) to match the application code, which
--     compares them numerically rather than as true/false.

-- ---------------------------------------------------------------- core identities

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

-- parent_project_id is a self-reference: a project with children acts as a "client"
-- folder (e.g. each Mydas client scaffolds Transcripts / Claude Prompts / ... beneath it).
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  parent_project_id TEXT REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_hold','completed')),
  health TEXT NOT NULL DEFAULT 'on_track' CHECK (health IN ('on_track','at_risk','behind')),
  view_mode TEXT NOT NULL DEFAULT 'gallery' CHECK (view_mode IN ('gallery','list')),
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

-- ---------------------------------------------------------------- tasks

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
  content_stage TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee, status);
CREATE INDEX IF NOT EXISTS idx_tasks_business ON tasks(business_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

-- ---------------------------------------------------------------- timesheet + invoicing
-- invoices must exist before time_entries (time_entries.invoice_id references it).

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number INTEGER NOT NULL UNIQUE,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_hours DOUBLE PRECISION NOT NULL,
  hourly_rate DOUBLE PRECISION NOT NULL,
  total_amount DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid')),
  approval_task_id TEXT REFERENCES tasks(id),
  pdf_storage_path TEXT,
  created_at TEXT NOT NULL
);

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

CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(work_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_invoice ON time_entries(invoice_id);

-- Single row, id = 'singleton', created lazily on first read/write.
CREATE TABLE IF NOT EXISTS invoice_settings (
  id TEXT PRIMARY KEY,
  full_name TEXT,
  bank_details TEXT,
  hourly_rate DOUBLE PRECISION,
  payment_terms TEXT
);

-- ---------------------------------------------------------------- task attachments

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

CREATE TABLE IF NOT EXISTS task_folders (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(task_id, name)
);

CREATE INDEX IF NOT EXISTS idx_task_folders_task ON task_folders(task_id);

-- ---------------------------------------------------------------- project galleries
-- Projects act as galleries: each entry is a "page" inside a project, optionally linked
-- 1:1 to the task that created it. Fields are a per-project custom schema so each
-- project shapes its own gallery without hardcoding field sets per project name.

CREATE TABLE IF NOT EXISTS project_fields (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  auto_number_prefix TEXT,
  sync_to_calendar INTEGER NOT NULL DEFAULT 0,
  options TEXT,
  is_status INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS entry_folders (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES project_entries(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(entry_id, name)
);

CREATE INDEX IF NOT EXISTS idx_project_fields_project ON project_fields(project_id);
CREATE INDEX IF NOT EXISTS idx_project_entries_project ON project_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_project_entries_task ON project_entries(linked_task_id);
CREATE INDEX IF NOT EXISTS idx_entry_values_entry ON project_entry_values(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_attachments_entry ON entry_attachments(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_folders_entry ON entry_folders(entry_id);

-- ---------------------------------------------------------------- review center

-- One row per calendar date. Wins/Blockers/Tomorrow are user-entered text. "Completed"
-- is never stored — it is recomputed from tasks.completed_at for any date, since a
-- completion timestamp never changes. In progress / waiting / overdue ARE snapshotted
-- (JSON arrays) each time today's Review Center is viewed, because those are mutable
-- point-in-time states that cannot be reconstructed after the fact.
CREATE TABLE IF NOT EXISTS daily_reviews (
  id TEXT PRIMARY KEY,
  review_date TEXT NOT NULL UNIQUE,
  wins TEXT,
  blockers TEXT,
  tomorrow TEXT,
  in_progress_summary TEXT,
  waiting_summary TEXT,
  overdue_summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ---------------------------------------------------------------- SOP library

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

-- ---------------------------------------------------------------- social content planner

-- One slot per (date, stage). "concept" = the yellow Concept/Script half, "final" = the
-- purple Final project half. A slot is "filled" once it has a drive_link OR at least one
-- attachment; a calendar day goes green when both halves are filled.
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
