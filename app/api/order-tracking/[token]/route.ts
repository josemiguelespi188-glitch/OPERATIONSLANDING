import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchClickUpTask, findTaskIdByName } from "@/lib/integrations/clickup";
import {
  computeOrderTrackingView,
  isPaymentReceivedRaw,
  ORDER_TRACKING_LIST_ID,
  type ClickUpTaskRaw,
} from "@/lib/orderTracking";
import { provisionOrderTrackingLink } from "@/lib/services/orderTrackingProvision";

export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated endpoint behind the order number (see
 * order_tracking_links -- no public RLS policy exists on it, so this
 * route is the only way to resolve a token to a ClickUp task). Always
 * fetches the live ClickUp task so the investor sees current status, not
 * a cached snapshot.
 *
 * Self-healing fallback: the clickup-order-tracking webhook is the
 * normal way a link gets provisioned, but it isn't the only way one can
 * work -- if no row exists yet for this token (the webhook never fired
 * for that task, fired before the Supabase table existed, or anything
 * else), this looks the task up directly in ClickUp by order number and
 * provisions it on the spot, so every task on the list resolves
 * correctly regardless of whether the webhook ever ran for it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: "Server is not configured yet." }, { status: 503 });
  }

  const { data: link } = await supabase
    .from("order_tracking_links")
    .select("clickup_task_id, payment_first_seen_received_at")
    .eq("token", token)
    .maybeSingle();

  let clickupTaskId = link?.clickup_task_id as string | undefined;

  if (!clickupTaskId) {
    const foundTaskId = await findTaskIdByName(ORDER_TRACKING_LIST_ID, token);
    if (!foundTaskId) {
      return NextResponse.json({ error: "Tracking link not found." }, { status: 404 });
    }
    await provisionOrderTrackingLink(supabase, foundTaskId, token);
    clickupTaskId = foundTaskId;
  }

  const taskResult = await fetchClickUpTask(clickupTaskId);
  if (!taskResult.ok) {
    return NextResponse.json({ error: "Could not load your order right now." }, { status: 502 });
  }

  const rawTask = taskResult.task as unknown as ClickUpTaskRaw;

  // Payment buffer bookkeeping: record the first time this system sees
  // payment as received (starts the 4-hour "Processing" window in
  // lib/orderTracking.ts), and clear it if ops un-flags payment later so
  // a subsequent real receipt starts its own fresh buffer instead of
  // reusing a stale timestamp from before the correction.
  let paymentFirstSeenReceivedAt = (link?.payment_first_seen_received_at as string | null) ?? null;
  const paymentReceivedNow = isPaymentReceivedRaw(rawTask);
  const updates: Record<string, string | null> = { last_viewed_at: new Date().toISOString() };
  if (paymentReceivedNow && !paymentFirstSeenReceivedAt) {
    paymentFirstSeenReceivedAt = new Date().toISOString();
    updates.payment_first_seen_received_at = paymentFirstSeenReceivedAt;
  } else if (!paymentReceivedNow && paymentFirstSeenReceivedAt) {
    paymentFirstSeenReceivedAt = null;
    updates.payment_first_seen_received_at = null;
  }
  await supabase.from("order_tracking_links").update(updates).eq("token", token);

  const view = computeOrderTrackingView(rawTask, {
    paymentFirstSeenReceivedAt: paymentFirstSeenReceivedAt ? new Date(paymentFirstSeenReceivedAt) : null,
  });
  return NextResponse.json(view);
}
