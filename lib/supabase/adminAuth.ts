import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "./server";

/**
 * Verifies the Supabase Auth bearer token on an admin API request and
 * confirms the signed-in user has an active row in `admin_users`. Returns
 * null (never throws) so callers can respond with a plain 401 — a valid
 * Supabase session alone isn't enough, since this project has no public
 * sign-up; only rows explicitly added to `admin_users` count as admins.
 */
export async function requireAdmin(request: Request): Promise<User | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!adminRow || !adminRow.is_active) return null;

  return data.user;
}
