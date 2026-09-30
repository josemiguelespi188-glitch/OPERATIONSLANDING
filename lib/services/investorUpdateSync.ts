import type { SupabaseClient } from "@supabase/supabase-js";
import { syncInvestorUpdateToClickUp } from "../integrations/clickup";
import type { AttachmentInput } from "../types";

/**
 * Mirrors lib/services/requestSync.ts's syncRequestAndPersist, but for the
 * dedicated investor_update_requests table instead of the shared
 * `requests` table.
 */
export async function syncInvestorUpdateAndPersist(
  supabase: SupabaseClient,
  requestId: string,
  input: {
    requesterName: string;
    requesterEmail: string;
    offeringName: string;
    mainUpdate: string;
    industryResearchOption: "Yes" | "No";
    additionalNotes?: string;
    attachments: AttachmentInput[];
    submittedAt: string;
  }
): Promise<{ synced: boolean; taskId: string | null; error?: string; warnings?: string[] }> {
  const result = await syncInvestorUpdateToClickUp(input);

  const syncError =
    result.error ?? (result.warnings ? `Synced with warnings: ${result.warnings.join(" | ")}` : null);

  await supabase
    .from("investor_update_requests")
    .update({
      clickup_task_id: result.taskId,
      clickup_sync_status: result.synced ? "synced" : "failed",
      clickup_sync_error: syncError,
      clickup_synced_at: result.synced ? new Date().toISOString() : null,
    })
    .eq("id", requestId);

  return result;
}
