# Nate OS

Executive command center for Genie (EA) and Nate (CEO) — built against `spec.md`'s full roadmap,
plus a set of "executive OS" upgrades added after the original spec (global search, an executive
briefing rollup, per-client documentation timelines). It's local-first: SQLite on disk, no external
accounts required, so it runs immediately. In active daily use, not just a demo shell.

**For a full breakdown of what's built, what's intentionally deferred, and notes for future
development, see [`STATUS.md`](./STATUS.md).**

## Run it

```bash
npm install     # first time only
npm run seed    # (re)creates data/nate-os.db with the two accounts + demo tasks
npm run dev
```

Open http://localhost:3000.

> **`npm run seed` wipes the tasks table.** Don't rerun it against a database with real data in it
> without confirming first — this instance has been in real daily use since early in its build.

## Accounts (seeded, local only)

| Who | Email | Password | Role |
|---|---|---|---|
| Genie | geniepcaubava@gmail.com | genie123 | admin — lands on Action Center |
| Nate | nate@nateos.local | nate123 | executive — lands on Nate-ification (Executive Dashboard) |

**Change these before this ever leaves your machine** — passwords are stored as bcrypt hashes, but
these demo values are documented in plaintext here on purpose. Re-run `npm run seed` after editing
`scripts/seed.ts` to rotate them, or wire up a real settings UI later.

## What's built

- **Task engine**: one `tasks` table, no duplication — every view (Action Center, Nate-ification,
  Business pages, calendars) is a filtered read of the same records, evaluated against each viewer's
  own local date for priority/overdue status.
- **Action Center** (`/action-center`): full task table, tiles, filters, list/calendar views, quick
  add, attachments and folders per task.
- **Nate-ification** (`/dashboard`): Nate's tasks plus an **Executive Briefing** panel (next event,
  application pipeline counts, per-client health, content-ready status) for a 60-second overview.
- **Businesses & Projects**: projects are structured galleries with admin-defined typed fields
  (text/date/link/auto-number/status), nested category sub-projects (e.g. per-client folders that
  auto-scaffold), and a chronological timeline view across those categories.
- **Social Media content planner**: a split-cell calendar (Concept/Script + Final project) that
  turns green once both halves have output, auto-linked to tasks.
- **Timesheet & Invoicing** (`/timesheet`): clock in/out, semi-monthly pay periods, a single editable
  hourly rate snapshotted per invoice, and an in-app invoice receipt with explicit hours × rate math.
- **Review Center** (`/review-center`) and **SOP Library** (`/sop-library`): daily auto-generated
  review sections plus a searchable, categorized document library.
- **Global search** (`⌘K` / `Ctrl+K`): finds any task, filed record, project, or attachment by name
  from anywhere in the app.
- **Auth**: iron-session cookie sessions, bcrypt password hashes, role-based landing page, route
  protection via `proxy.ts`.

See [`STATUS.md`](./STATUS.md) for what's intentionally *not* built yet (templates, contacts as
entities, saved views, and a few other deferred items) and why.

## Migrating off local SQLite

The DB layer is isolated in `lib/db.ts` / `lib/tasks.ts` / `lib/businesses.ts` / `lib/projects.ts` /
`lib/users.ts` — swapping to Supabase/Postgres later means reimplementing those query functions
against `pg`/Supabase's client while keeping the same function signatures; nothing above that layer
(API routes, components) needs to change.
