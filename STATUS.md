# Nate OS — Build Status

Living status doc for the executive command center. See `README.md` for setup/run instructions and
demo login accounts, and `spec.md` for the original product spec. This file tracks what's done, what
isn't, and the reasoning behind non-obvious decisions — update it after any future round of work.

_Last updated: 2026-07-24_

## Summary

All 6 phases of the original spec are built, plus several rounds of revisions and a set of
"executive OS" upgrades (search, briefing, documentation timeline) added after the fact. The app is
in daily use by Genie against a real local SQLite database — this is not just a demo shell.

## Completed

### Core task engine
- Single `tasks` table; every view (Action Center, Nate-ification, Business pages, calendars) is a
  filtered read of the same records — nothing is duplicated per view.
- Auto priority escalation, evaluated against each viewer's own local date (Genie is in the
  Philippines, Nate in the US — "today" is computed per viewer, not server time).
- Auth: iron-session cookies, bcrypt password hashes, role-based landing page, route protection.

### Action Center & Nate-ification
- Action Center (`/action-center`): full-featured task table (Created/Task/Priority/Due/Assignee/
  Status/Notes/Business/Project columns), tiles, filter bar, list/calendar toggle, quick add, live
  Pacific clock.
- Nate-ification (`/dashboard`, nav label only — route unchanged): Nate's tasks, urgency-sorted,
  one-tap complete, inline notes, an **Executive Briefing panel** (next event, application pipeline
  counts, per-client health + latest deliverable version, content-ready-this-week, a documentation
  gap count) — designed to answer "what's happening" in under 60 seconds.
- Global search (`⌘K` / `Ctrl+K`, or the sidebar "Search" button): finds tasks, filed records,
  projects, and attachment file names from anywhere in the app.

### Businesses & Projects (structured galleries)
- Projects are galleries, not labels: each has admin-defined **typed custom fields**
  (text/long text/date/link/auto-number/status-select) rather than a fixed schema.
- Auto-numbering (e.g. `SOA001`, `SOA002`) for fields like application IDs.
- Date fields can sync to Nate-ification's calendar automatically (used by the Events project).
- Status/select fields power per-project pipelines (e.g. Applications: Draft → Submitted →
  Accepted) and roll up into the Executive Briefing.
- **Nested categories**: a project can have child sub-projects (e.g. every Mydas client
  auto-scaffolds Transcripts / Claude Prompts / Dashboard Concepts / Presentation folders). Creating
  a task under a nested project shows a two-level Project → Category picker.
- **Project timeline view**: for projects with categories, a chronological feed interleaving every
  entry and attachment across all categories — answers "how did this engagement evolve" in one
  scroll.
- Project health/status (on track / at risk / behind, active / on hold / completed) is editable
  from the project page and feeds the briefing.
- Folders are real, persisted entities (not just derived from uploaded file names) for both tasks
  and project entries; full upload/download/delete.
- Admin-only project/folder deletion (soft delete, cascades to children).
- Per-project view mode: gallery (cards) or list (table).

### Social Media content planner
- Custom split-cell monthly calendar: each day is Concept/Script (top) + Final project (bottom);
  a day turns green once both halves have output (a pasted link or an uploaded file).
- Tasks tagged to Social Media with a due date + content stage auto-plot onto the calendar.
- Adding output to a slot auto-completes its linked task (the one place in the app where completion
  is automated rather than nudged — see "Enforce the record" below for why this is the exception).

### Enforce the record (documentation hygiene)
- Attaching a file to any task shows a one-click "Mark complete?" nudge instead of auto-completing
  silently — avoids ever closing a task that isn't actually done.
- Review Center and the Executive Briefing both surface a **missing documentation** count: tasks
  completed with no project attached, i.e. tasks that structurally left no record behind.

### Review Center & SOP Library
- Review Center (`/review-center`): live auto-sections for today (completed/in progress/waiting on
  Nate/overdue/missing documentation) plus saved Wins/Blockers/Tomorrow notes, browsable by date,
  "copy as message" for sharing.
- SOP Library (`/sop-library`): upload a file or paste a link, grouped by category, searchable,
  admin-only add/delete.

### Timesheet & Invoicing
- Clock in/out (Pacific time specifically, unlike the rest of the app — see Notes below), manual
  entry for backfill/corrections.
- **Semi-monthly pay periods** (1st–15th, 16th–end of month) — tiles for hours today, hours this
  period, hours since last invoice, and unbilled total.
- Hourly rate is edited in one place only (Settings, admin-only) and is **snapshotted onto each
  invoice at generation time** — a future rate change only affects invoices generated after that
  point, never rewrites past ones.
- Generate an invoice from all unbilled hours or a specific pay period, with a live preview
  (entries, hours, and an explicit `hours × rate = total` calculation) before confirming.
- Invoice receipt (in-app, not just a PDF) shows the same explicit hours × rate breakdown, itemized
  entries, and a "Mark paid" action. A PDF is still generated internally and auto-attached to Nate's
  approval task.

## Not built / intentionally deferred

These were explicitly scoped as post-MVP or "later" and haven't been started:

- **Phase 6 (per original spec, marked post-MVP)**: Google Calendar overlay, push notifications,
  recurring tasks, AI-assisted review drafting.
- **Templates / one-click scaffolds** for standardized task types (new application, new client,
  new content) — reduces setup clicks but not built yet.
- **"Waiting on" task state** with an aging indicator (who it's blocked on, how long) — today,
  blocked work is just tracked as "not started"/"in progress."
- **Executive Support logs** (Email Activity, Calendar Logs) as real tracked projects.
- **Inline editing** in the Action Center table (currently requires opening the task drawer) and
  natural-language due dates.
- **Contacts as real entities** — event/client contacts are still free-text fields, not queryable.
- **Saved filter views** (e.g. "My day," "Submitted applications").
- **Proactive daily brief** — the Executive Briefing is pull (visit the page), not push (emailed/
  sent each morning).
- Migrating off local SQLite to a real hosted backend (Supabase/Postgres) — deferred until/unless
  the app needs to leave Genie's machine. The DB layer is isolated (see Notes) specifically so this
  migration doesn't require touching anything above it.

## Known minor issues

- The Action Center **filter bar**'s project dropdown lists nested category projects flat (not
  grouped under their parent client). Filtering still works correctly; it's a cosmetic gap. Only
  the task-*creation* forms (Quick Add, Task Drawer) do the two-level Project → Category picker.
- `README.md`'s "What's built" / "Not built yet" sections predate most of the work in this file and
  are stale — trust this file over that section until README is refreshed.

## Notes for future development

- **Architecture**: the SQLite layer is isolated in `lib/db.ts`, `lib/tasks.ts`, `lib/businesses.ts`,
  `lib/projects.ts`, `lib/users.ts`. A future migration to Postgres/Supabase means reimplementing
  those query functions with the same signatures — nothing in `app/api/*` or `components/*` should
  need to change.
- **Dev server restarts required after schema changes.** `globalThis.__nateOsDb` caches the open
  SQLite connection across Turbopack Fast Refresh, so `CREATE TABLE`/`ALTER TABLE` statements in
  `lib/db.ts` only run once per Node process. If a route 500s with "no such table" right after a
  schema change, restart the dev server before assuming the code is wrong. Occasionally a *new file*
  (not just schema) also needs a restart before Turbopack resolves the import, even if `tsc`/`eslint`
  are clean.
- **Timezone handling is intentionally inconsistent between two areas**: everywhere except the
  Timesheet uses each viewer's own local browser date (Genie/Philippines vs Nate/US both see "today"
  correctly). The Timesheet specifically runs on Pacific time regardless of viewer location, since
  that's the actual payroll timezone — see `lib/client/pacificTime.ts`.
- **`npm run seed` wipes the tasks table.** Never rerun it against the live local database without
  confirming first — this has been in daily real use since Phase 2.
- **Generalization pattern**: several features (nested project categories, the "client" concept in
  the briefing/timeline, calendar-sync fields) are deliberately built as generic mechanisms
  (`parent_project_id`, "any project with children," a `sync_to_calendar` flag) rather than
  hardcoded to specific business names like "Mydas" or "Events" — so the same pattern keeps working
  if another business adopts it later. Follow this pattern rather than special-casing a business
  name when extending things.
- **Data directory**: `data/` (the SQLite db, uploaded attachments, generated invoice PDFs) and
  `.env` are gitignored on purpose — they contain real business data and should never be committed.
