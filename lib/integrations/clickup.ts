import type { RequestPayload } from "../types";

export interface ClickUpSyncResult {
  synced: boolean;
  taskId: string | null;
  error?: string;
}

/**
 * Not wired up yet. This is the single entry point where a real ClickUp
 * integration will live: either a direct call to the ClickUp API (create
 * task in the list mapped from `payload.requestType`) or a trigger into an
 * n8n workflow that owns the ClickUp side.
 *
 * Env vars to add when this goes live:
 *   CLICKUP_API_TOKEN
 *   CLICKUP_LIST_ID_MAP (JSON: { [requestType]: clickupListId })
 *
 * Called fire-and-forget from app/api/requests/route.ts after a request is
 * persisted, so a slow/failed ClickUp call never blocks the submission.
 */
export async function syncRequestToClickUp(
  _payload: RequestPayload
): Promise<ClickUpSyncResult> {
  return {
    synced: false,
    taskId: null,
    error: "ClickUp integration not yet configured.",
  };
}
