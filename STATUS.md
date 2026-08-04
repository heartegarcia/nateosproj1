# Nate OS — Build Status

Living status doc for the executive command center. See `README.md` for setup/run instructions and
demo login accounts, and `spec.md` for the original product spec. This file tracks what's done, what
isn't, and the reasoning behind non-obvious decisions — update it after any future round of work.

_Last updated: 2026-08-04_

## Summary

All 6 phases of the original spec are built, plus several rounds of revisions and a set of
"executive OS" upgrades (search, briefing, documentation timeline) added after the fact. The app has
been migrated off local SQLite onto Supabase Postgres and is now deployed and running live on Vercel,
connected to GitHub for deploys.

## Completed

### Production deployment (Supabase + Vercel) — 2026-07-30
- Migrated the database layer from local SQLite (`better-sqlite3`) to Supabase Postgres (`postgres`
  client, transaction pooler). See "Architecture" notes below for the shape of this change.
- Connected GitHub, Supabase, and Vercel: the app deploys to Vercel automatically from `main` on
  `github.com/heartegarcia/nateosproj1`, reading data from a Supabase Postgres project.
- Configured `DATABASE_URL` and `SESSION_SECRET` in Vercel's Production environment variables.
- Diagnosed and fixed a production-only login crash (`FUNCTION_INVOCATION_FAILED`): the deployed app
  had been running the old pre-migration SQLite code (the migration commit had never actually been
  pushed to GitHub), which tried to `mkdir` a local data directory on Vercel's read-only serverless
  filesystem. Fixed by committing and pushing the full migration.
- Verified end-to-end on the live Vercel URL: login works, the dashboard loads, and core features
  (viewing/creating/managing tasks and project data) work correctly against Supabase in production.

### Live-testing fixes — 2026-08-04
- **File uploads — migrated to Supabase Storage, verified working locally, not yet deployed.**
  All five local-disk storage locations — task attachments, project entry attachments, SOP
  documents, social content attachments, invoice PDFs — now go through `lib/storage.ts` (bucket
  `uploads`). Upload → download → delete round-tripped correctly end-to-end against real Supabase
  Storage in local dev. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set locally; **still need
  to be added to Vercel's Production environment variables** before this works on the live site.
  Storage's client init is intentionally lazy (only throws when an upload/download is actually
  attempted) specifically so a missing/misconfigured key can't crash unrelated routes — see
  Architecture notes.
- **Slow page loads, fixed**: two compounding causes. (1) Vercel was deploying functions to its
  default US region while the Supabase database runs in `ap-southeast-1` (Singapore) — every query
  paid a trans-Pacific round trip. Pinned via `vercel.json` (`"regions": ["sin1"]`). (2) The
  Executive Briefing (`lib/briefing.ts`) ran its ~6 independent queries sequentially, and two of its
  helper functions issued further queries in an un-parallelized loop (N+1) — all now run via
  `Promise.all`.
- **Nate-ification scope, fixed**: the Executive Briefing panel's "Clients" card listed every
  top-level project with sub-folders (i.e. every Mydas client), so creating a new client/folder made
  it appear on Nate's dashboard even though he has no task tied to it. Removed the Clients card (and
  the now-unused `listClientLikeProjects`/`ClientBriefing`) per explicit decision to keep
  Nate-ification scoped to only tasks assigned to him (which already includes invoice-approval
  tasks) — Next Up, Content This Week, and Applications cards are unaffected.

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
  counts, content-ready-this-week, a documentation gap count) — designed to answer "what's happening"
  in under 60 seconds, deliberately scoped to only what's assigned to him (no cross-business rollup).
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

## Known issues

- **File uploads still don't work in production — one deploy step left.** The Supabase Storage
  migration (see "Live-testing fixes" above) is verified working end-to-end locally. Uploads will
  keep failing on the live site until `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are added to
  Vercel's Production environment variables and this branch is deployed. This is the current top
  priority.

## Known minor issues

- The Action Center **filter bar**'s project dropdown lists nested category projects flat (not
  grouped under their parent client). Filtering still works correctly; it's a cosmetic gap. Only
  the task-*creation* forms (Quick Add, Task Drawer) do the two-level Project → Category picker.

## Notes for future development

- **Architecture (post-migration)**: `lib/db.ts` is now an async shim around the `postgres` client
  (Supabase's transaction pooler, port 6543, `prepare: false`). It translates the app's existing
  `@named`/`?` placeholder styles into Postgres `$1,$2,...` positional params, so the ~20 `lib/*.ts`
  data files kept their SQL nearly verbatim — every function just became `async`/`await`. Schema
  lives in `supabase/schema.sql` (run manually in Supabase's SQL Editor); the one-time SQLite→Postgres
  data migration script is `scripts/migrate-to-supabase.ts` (`npm run migrate:supabase`).
- **Connection pool size is environment-aware.** `max: process.env.VERCEL ? 1 : 10` — Vercel gives
  each invocation its own short-lived process (so `max: 1` avoids exhausting Supabase's pooler
  connection limit across many concurrent functions), while local `next dev` is one long-lived
  process serving many concurrent requests, including Next's `<Link>` prefetch bursts (`max: 1`
  there caused a multi-second dashboard freeze after login against the real network latency of a
  remote DB — fixed by making pool size env-aware).
- **Dev server restarts required after `lib/db.ts` config changes.** `globalThis.__nateOsSql` caches
  the open Postgres client across Turbopack Fast Refresh so it survives hot reloads; a code change to
  `lib/db.ts` itself needs a full server restart, not just a file save, before it takes effect.
- **`lib/storage.ts`'s Supabase client is created lazily**, unlike `lib/db.ts`'s eager module-scope
  throw — deliberately, because Storage is only needed by upload/download functions, but modules that
  need it for one narrow purpose (e.g. `lib/socialContent.ts`, needed by the briefing for an unrelated
  content-calendar count) get imported everywhere. An eager throw here previously took down
  `/api/tasks` and `/api/briefing` just because Storage env vars weren't set yet — don't revert this
  pattern without checking who transitively imports whichever file you're touching.
- **Timezone handling is intentionally inconsistent between two areas**: everywhere except the
  Timesheet uses each viewer's own local browser date (Genie/Philippines vs Nate/US both see "today"
  correctly). The Timesheet specifically runs on Pacific time regardless of viewer location, since
  that's the actual payroll timezone — see `lib/client/pacificTime.ts`.
- **`npm run seed` wipes the tasks table.** Never rerun it against the live local database without
  confirming first — this has been in daily real use since Phase 2.
- **Generalization pattern**: several features (nested project categories, the project timeline,
  calendar-sync fields) are deliberately built as generic mechanisms (`parent_project_id`, "any
  project with children," a `sync_to_calendar` flag) rather than hardcoded to specific business
  names like "Mydas" or "Events" — so the same pattern keeps working if another business adopts it
  later. Follow this pattern rather than special-casing a business name when extending things. (The
  Executive Briefing no longer surfaces a "clients" rollup at all — see "Live-testing fixes" above —
  but the underlying `parent_project_id` nesting this pattern was built on is still very much in use
  elsewhere, e.g. the project timeline and Mydas's own folder structure.)
- **`.env` is gitignored on purpose** — it contains real credentials and should never be committed.

## Next priority (highest priority)

Get file uploads working in **production**. Verified working end-to-end locally (see "Live-testing
fixes" above) — the only remaining step is adding `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to
Vercel's Production environment variables and deploying.
