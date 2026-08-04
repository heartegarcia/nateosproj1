import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Storage — replaces local-disk file storage everywhere in the app
 * (task/entry attachments, SOP documents, social content, invoice PDFs).
 *
 * Uses the SERVICE ROLE key, not the anon key: all storage access goes through this
 * server-only module, and the app's own session auth (requireSession in every route)
 * is what gates who can read/write — there's no need for Supabase's own per-user RLS
 * on top of that, so the service role simply bypasses it.
 *
 * The client is created lazily (on first actual upload/download) rather than at module
 * scope. Unlike lib/db.ts's connection — which truly everything needs — only a handful
 * of upload/download functions need Storage, but this module gets pulled in by files
 * (e.g. lib/socialContent.ts) that plenty of unrelated code imports for other reasons.
 * A module-scope throw here would take down all of that unrelated code too if these
 * env vars aren't set yet.
 */
const BUCKET = "uploads";

let client: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Add them to .env locally and to your Vercel project's Environment Variables."
    );
  }

  client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  return client;
}

export async function uploadFile(key: string, buffer: Buffer, contentType?: string): Promise<void> {
  const { error } = await getClient()
    .storage.from(BUCKET)
    .upload(key, buffer, { contentType: contentType || "application/octet-stream", upsert: true });
  if (error) throw new Error(`Supabase Storage upload failed for "${key}": ${error.message}`);
}

/** Returns null if the object doesn't exist or the download otherwise fails. */
export async function downloadFile(key: string): Promise<Buffer | null> {
  const { data, error } = await getClient().storage.from(BUCKET).download(key);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
