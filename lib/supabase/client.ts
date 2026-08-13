import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: SupabaseClient | undefined;

/**
 * Browser client — safe to use in client components. Scoped to the anon
 * key, which under RLS should only be able to insert into `requests` /
 * `request_attachments` and upload to the `attachments` storage bucket.
 *
 * persistSession is on so the Admin Portal's login (Supabase Auth) survives
 * a page reload — this has no effect on the anonymous request-submission
 * flow, which never reads or writes an auth session.
 *
 * Memoized to a single instance: multiple GoTrueClient instances sharing
 * the same localStorage session key (one per call site otherwise) causes
 * Supabase's own "Multiple GoTrueClient instances detected" warning and
 * can desync auth state between them.
 */
export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars."
    );
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true },
    });
  }

  return browserClient;
}
