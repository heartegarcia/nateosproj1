/**
 * One-time data migration: copies everything from the local SQLite database
 * (data/nate-os.db) into Supabase Postgres.
 *
 * Run AFTER creating the tables in Supabase with supabase/schema.sql:
 *   npm run migrate:supabase
 *
 * Safe to re-run: every insert uses ON CONFLICT (id) DO NOTHING, so rows already
 * copied are skipped rather than duplicated or overwritten.
 *
 * Tables are copied in foreign-key dependency order — a task can't be inserted before
 * the business it references exists.
 */
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import postgres from "postgres";

const sqlitePath = path.join(process.cwd(), "data", "nate-os.db");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set. Add your Supabase connection string to .env first.");
  process.exit(1);
}
if (!fs.existsSync(sqlitePath)) {
  console.error(`No SQLite database found at ${sqlitePath} — nothing to migrate.`);
  process.exit(1);
}

const sqlite = new Database(sqlitePath, { readonly: true });
const sql = postgres(connectionString, { prepare: false, max: 1 });

/** Ordered so every table's foreign-key targets are inserted before it. */
const TABLES: { name: string; columns: string[] }[] = [
  { name: "users", columns: ["id", "email", "password_hash", "display_name", "role", "created_at"] },
  { name: "businesses", columns: ["id", "name", "color", "sort_order", "created_at"] },
  {
    name: "projects",
    columns: [
      "id", "business_id", "parent_project_id", "name", "description",
      "status", "health", "view_mode", "created_at", "deleted_at",
    ],
  },
  {
    name: "tasks",
    columns: [
      "id", "title", "business_id", "project_id", "assignee", "status", "base_priority",
      "due_date", "notes", "nate_note", "channels", "content_stage",
      "created_at", "completed_at", "deleted_at",
    ],
  },
  {
    name: "invoices",
    columns: [
      "id", "invoice_number", "period_start", "period_end", "total_hours", "hourly_rate",
      "total_amount", "status", "approval_task_id", "pdf_storage_path", "created_at",
    ],
  },
  {
    name: "time_entries",
    columns: ["id", "work_date", "start_time", "end_time", "notes", "invoice_id", "created_at", "deleted_at"],
  },
  { name: "invoice_settings", columns: ["id", "full_name", "bank_details", "hourly_rate", "payment_terms"] },
  {
    name: "task_attachments",
    columns: ["id", "task_id", "folder", "file_name", "storage_path", "file_size", "uploaded_at", "deleted_at"],
  },
  { name: "task_folders", columns: ["id", "task_id", "name", "created_at"] },
  {
    name: "project_fields",
    columns: [
      "id", "project_id", "label", "field_type", "auto_number_prefix",
      "sync_to_calendar", "options", "is_status", "sort_order", "created_at",
    ],
  },
  {
    name: "project_entries",
    columns: ["id", "project_id", "title", "linked_task_id", "created_at", "updated_at", "deleted_at"],
  },
  { name: "project_entry_values", columns: ["id", "entry_id", "field_id", "value", "updated_at"] },
  {
    name: "entry_attachments",
    columns: ["id", "entry_id", "folder", "file_name", "storage_path", "file_size", "uploaded_at", "deleted_at"],
  },
  { name: "entry_folders", columns: ["id", "entry_id", "name", "created_at"] },
  {
    name: "daily_reviews",
    columns: [
      "id", "review_date", "wins", "blockers", "tomorrow",
      "in_progress_summary", "waiting_summary", "overdue_summary", "created_at", "updated_at",
    ],
  },
  {
    name: "sop_documents",
    columns: ["id", "title", "category", "storage_path", "file_name", "external_url", "notes", "created_at", "deleted_at"],
  },
  {
    name: "social_content",
    columns: ["id", "content_date", "stage", "title", "task_id", "drive_link", "created_at", "updated_at"],
  },
  {
    name: "social_attachments",
    columns: ["id", "slot_id", "file_name", "storage_path", "file_size", "uploaded_at", "deleted_at"],
  },
];

function sqliteHasTable(name: string): boolean {
  const row = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
  return Boolean(row);
}

function sqliteColumns(table: string): Set<string> {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

async function migrate() {
  console.log(`Reading from ${sqlitePath}\n`);
  let grandTotal = 0;

  for (const table of TABLES) {
    if (!sqliteHasTable(table.name)) {
      console.log(`- ${table.name}: not present locally, skipped`);
      continue;
    }

    // Only copy columns that exist in BOTH databases — the local schema evolved through
    // several ALTER TABLE migrations, so an older local file may be missing newer columns.
    const localColumns = sqliteColumns(table.name);
    const columns = table.columns.filter((c) => localColumns.has(c));
    const rows = sqlite.prepare(`SELECT ${columns.join(", ")} FROM ${table.name}`).all() as Record<string, unknown>[];

    if (rows.length === 0) {
      console.log(`- ${table.name}: 0 rows`);
      continue;
    }

    let inserted = 0;
    for (const row of rows) {
      const values = columns.map((c) => row[c] ?? null);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      await sql.unsafe(
        `INSERT INTO ${table.name} (${columns.join(", ")}) VALUES (${placeholders})
         ON CONFLICT (id) DO NOTHING`,
        values as never[]
      );
      inserted++;
    }

    grandTotal += inserted;
    console.log(`✓ ${table.name}: ${inserted} rows`);
  }

  console.log(`\nDone — ${grandTotal} rows copied into Supabase.`);
  console.log("Uploaded files (data/attachments, data/invoices, data/sop-documents) are NOT");
  console.log("migrated yet — that happens when we move file storage to Supabase Storage.");

  await sql.end();
  sqlite.close();
}

migrate().catch(async (err) => {
  console.error("\nMigration failed:", err instanceof Error ? err.message : err);
  await sql.end();
  process.exit(1);
});
