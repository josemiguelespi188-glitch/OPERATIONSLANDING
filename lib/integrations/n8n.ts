import type { RequestPayload } from "../types";

export interface N8nTriggerResult {
  triggered: boolean;
  error?: string;
}

/**
 * Not wired up yet. Once an n8n workflow URL exists (e.g. a Webhook node
 * that fans out to ClickUp, email notifications, etc.), POST the payload
 * here.
 *
 * Env var to add when this goes live:
 *   N8N_REQUEST_WEBHOOK_URL
 */
export async function triggerN8nWorkflow(
  _payload: RequestPayload
): Promise<N8nTriggerResult> {
  const webhookUrl = process.env.N8N_REQUEST_WEBHOOK_URL;

  if (!webhookUrl) {
    return { triggered: false, error: "N8N_REQUEST_WEBHOOK_URL not set." };
  }

  return { triggered: false, error: "n8n integration not yet implemented." };
}
