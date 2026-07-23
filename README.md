# Nate OS — Demo MVP

Executive command center for Genie (EA) and Nate (CEO). This build covers Phases 0–2 from `spec.md`:
auth + roles, the task engine, the Action Center, the Executive Dashboard, and calendars — plus a
lightweight Businesses view. It's local-first: SQLite on disk, no external accounts required, so it
runs immediately.

## Run it

```bash
npm install     # first time only
npm run seed    # (re)creates data/nate-os.db with the two accounts + demo tasks
npm run dev
```

Open http://localhost:3000.

## Accounts (seeded, local only)

| Who | Email | Password | Role |
|---|---|---|---|
| Genie | geniepcaubava@gmail.com | genie123 | admin — lands on Action Center |
| Nate | nate@nateos.local | nate123 | executive — lands on Executive Dashboard |

**Change these before this ever leaves your machine** — passwords are stored as bcrypt hashes, but
these demo values are documented in plaintext here on purpose. Re-run `npm run seed` after editing
`scripts/seed.ts` to rotate them, or wire up a real settings UI later.

## What's built

- **Task engine**: one `tasks` table, no duplication. Business/Project/Assignee/Calendar views are
  all filtered reads over the same records — completing a task anywhere completes it everywhere.
- **Auto priority escalation**: `base_priority` is stored and never mutated; `effective_priority` +
  overdue flag are computed at read time (`lib/priority.ts`), evaluated against the *viewer's local
  date* so Genie (Philippines) and Nate (US) each see "today" correctly.
- **Action Center** (`/action-center`): tiles, filters (business/project/assignee/status/priority/date),
  list + calendar views, quick add, full task drawer.
- **Executive Dashboard** (`/dashboard`): fixed to Nate's tasks, urgency-sorted, one-tap mark done,
  inline "add note" without opening anything, "as of" timestamp, phone-width friendly.
- **Businesses** (`/businesses`): per-business task counts/health at a glance, drilling into a
  business shows the exact same task records as Action Center.
- **Auth**: iron-session cookie sessions, bcrypt password hashes, role-based landing page, route
  protection via `proxy.ts`.

## Not built yet (later phases per spec.md §12)

Review Center, Timesheet/Invoicing, and the SOP Library have nav entries with "coming soon" stubs —
their data models (time entries, invoices, SOP docs) aren't in the schema yet. Task attachments are
also out of scope for this pass.

## Migrating off local SQLite

The DB layer is isolated in `lib/db.ts` / `lib/tasks.ts` / `lib/businesses.ts` / `lib/projects.ts` /
`lib/users.ts` — swapping to Supabase/Postgres later means reimplementing those query functions
against `pg`/Supabase's client while keeping the same function signatures; nothing above that layer
(API routes, components) needs to change.
