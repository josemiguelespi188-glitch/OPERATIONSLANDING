import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Browser client — safe to use in client components. Scoped to the anon
 * key, which under RLS should only be able to insert into `requests` /
 * `request_attachments` and upload to the `attachments` storage bucket.
 *
 * persistSession is on so the Admin Portal's login (Supabase Auth) survives
 * a page reload — this has no effect on the anonymous request-submission
 * flow, which never reads or writes an auth session.
 */
export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars."
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true },
  });
}
