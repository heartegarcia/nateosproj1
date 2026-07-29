import postgres from "postgres";

/**
 * Supabase Postgres connection.
 *
 * Uses the Supabase *transaction pooler* connection string (port 6543). `prepare: false`
 * is REQUIRED for that pooler — pgBouncer in transaction mode cannot support Postgres
 * prepared statements.
 *
 * Pool size is deliberately environment-dependent:
 *   - On Vercel, each serverless invocation is its own short-lived process handling ONE
 *     request, so `max: 1` is correct and keeps many concurrent function instances from
 *     collectively exhausting Supabase's pooler connection limit.
 *   - In `next dev` (and `next start`), the process is long-lived and serves every
 *     request concurrently — including the burst of ~20 requests Next.js's <Link>
 *     fires off to prefetch every sidebar link the moment a page renders. With `max: 1`
 *     those all serialize through one socket; against a remote database (unlike local
 *     SQLite, where this was imperceptible) that queue is what looks like the whole app
 *     freezing after login. `VERCEL` is a var Vercel sets automatically on its
 *     platform — it is NOT the same thing as NODE_ENV=production, which also applies to
 *     a local `next build && next start`.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Add your Supabase connection string to .env locally and to your Vercel project's Environment Variables."
  );
}

declare global {
  var __nateOsSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  return postgres(connectionString!, {
    prepare: false,
    max: process.env.VERCEL ? 1 : 10,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

const sql = globalThis.__nateOsSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__nateOsSql = sql;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Translates the app's existing SQL — written for better-sqlite3 — into Postgres
 * positional parameters, so the migration didn't require rewriting every query string.
 *
 * Two placeholder styles are in use across the codebase and both are supported:
 *   - named:      `WHERE id = @id`      called as `.run({ id })`
 *   - positional: `WHERE id = ?`        called as `.get(id)`
 *
 * A repeated `@name` (e.g. `VALUES (@now, @now)`) correctly binds the same value twice.
 */
function build(query: string, params: unknown[]): { text: string; values: unknown[] } {
  const values: unknown[] = [];

  if (params.length === 1 && isPlainObject(params[0])) {
    const named = params[0];
    const text = query.replace(/@(\w+)/g, (_match, key: string) => {
      values.push(named[key] ?? null);
      return `$${values.length}`;
    });
    return { text, values };
  }

  let index = 0;
  const text = query.replace(/\?/g, () => {
    values.push(params[index++] ?? null);
    return `$${values.length}`;
  });
  return { text, values };
}

async function query<T>(text: string, params: unknown[]): Promise<T[]> {
  const built = build(text, params);
  const rows = await sql.unsafe(built.text, built.values as never[]);
  return rows as unknown as T[];
}

/**
 * Minimal async stand-in for better-sqlite3's statement API. Same call shapes as before
 * (`.get()`, `.all()`, `.run()`), but every one returns a Promise — which is why all the
 * data-layer functions in lib/ are now `async` and their callers `await` them.
 */
export const db = {
  prepare(text: string) {
    return {
      async get<T>(...params: unknown[]): Promise<T | undefined> {
        const rows = await query<T>(text, params);
        return rows[0];
      },
      async all<T>(...params: unknown[]): Promise<T[]> {
        return query<T>(text, params);
      },
      async run(...params: unknown[]): Promise<void> {
        await query(text, params);
      },
    };
  },

  /** Runs raw SQL with no parameters (schema DDL, multi-statement scripts). */
  async exec(text: string): Promise<void> {
    await sql.unsafe(text);
  },

  /** Escape hatch for anything that needs the underlying postgres.js client. */
  raw: sql,
};
