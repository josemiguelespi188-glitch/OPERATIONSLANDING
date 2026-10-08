import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared lookup for every /api/communications-review/[token] route: a
 * token only resolves while its communication is still
 * "pending_approval" -- once approved or sent back for changes (by
 * this token's own use, or by an admin acting directly in /admin), the
 * link naturally stops working instead of needing a separate
 * revoke/expiry step.
 */
export async function getPendingCommunicationByToken(supabase: SupabaseClient, token: string) {
  const { data: row } = await supabase
    .from("communications")
    .select("*")
    .eq("review_token", token)
    .eq("status", "pending_approval")
    .maybeSingle();
  return row;
}
