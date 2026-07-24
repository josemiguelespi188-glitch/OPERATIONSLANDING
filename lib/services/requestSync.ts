import type { SupabaseClient } from "@supabase/supabase-js";
import { syncRequestToClickUp } from "../integrations/clickup";
import type { RequestPayload } from "../types";

/**
 * Business logic layer: orchestrates the ClickUp service + Supabase
 * service for one request. Kept separate from both so a future swap
 * (n8n instead of a direct ClickUp call, a different DB, etc.) only
 * touches this file, not the API routes or the UI.
 */
export async function syncRequestAndPersist(
  supabase: SupabaseClient,
  requestId: string,
  payload: RequestPayload
): Promise<{ synced: boolean; taskId: string | null; error?: string }> {
  const result = await syncRequestToClickUp(payload);

  await supabase
    .from("requests")
    .update({
      clickup_task_id: result.taskId,
      clickup_sync_status: result.synced ? "synced" : "failed",
      clickup_sync_error: result.error ?? null,
      clickup_synced_at: result.synced ? new Date().toISOString() : null,
    })
    .eq("id", requestId);

  await supabase.from("activity_log").insert({
    request_id: requestId,
    action: result.synced ? "clickup_synced" : "clickup_sync_failed",
    metadata: { taskId: result.taskId, error: result.error ?? null },
  });

  return result;
}
