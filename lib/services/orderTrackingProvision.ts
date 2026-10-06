import type { SupabaseClient } from "@supabase/supabase-js";
import { setCustomField } from "../integrations/clickup";
import { getSiteBaseUrl, ORDER_TRACKING_LIST_ID } from "../orderTracking";

/**
 * Creates (or, on a race, reuses) the order_tracking_links row for one
 * ClickUp task, using its order number as the token (see CLAUDE.md's
 * "Order Tracking" section for why), and best-effort writes the
 * resulting URL back into ClickUp's "Tracking Link" field. Shared by
 * both the clickup-order-tracking webhook (the normal, automatic path)
 * and GET /api/order-tracking/[token]'s self-healing fallback (when a
 * link is visited before the webhook has provisioned it, or because the
 * webhook never fired for that task at all).
 */
export async function provisionOrderTrackingLink(
  supabase: SupabaseClient,
  taskId: string,
  orderNumber: string
): Promise<string> {
  const { error: insertError } = await supabase
    .from("order_tracking_links")
    .insert({ clickup_task_id: taskId, clickup_list_id: ORDER_TRACKING_LIST_ID, token: orderNumber });

  let finalToken = orderNumber;
  if (insertError) {
    // Likely a race with a concurrent provisioning attempt for the same
    // task (webhook and fallback firing close together, or two investors
    // opening the link at once) -- re-select rather than failing.
    const { data: existing } = await supabase
      .from("order_tracking_links")
      .select("token")
      .eq("clickup_task_id", taskId)
      .maybeSingle();
    if (existing) {
      finalToken = existing.token;
    }
  }

  const trackingUrl = `${getSiteBaseUrl()}/order-tracking/${finalToken}`;

  const fieldId = process.env.CLICKUP_ORDER_TRACKING_FIELD_ID;
  const clickUpToken = process.env.CLICKUP_API_TOKEN;
  if (fieldId && clickUpToken) {
    await setCustomField(taskId, fieldId, trackingUrl, clickUpToken);
  }

  return finalToken;
}
