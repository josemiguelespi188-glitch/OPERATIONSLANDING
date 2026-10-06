import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchClickUpTask } from "@/lib/integrations/clickup";
import { ORDER_TRACKING_LIST_ID } from "@/lib/orderTracking";
import { provisionOrderTrackingLink } from "@/lib/services/orderTrackingProvision";

export const dynamic = "force-dynamic";

interface ClickUpWebhookPayload {
  event: string;
  task_id?: string;
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const signatureBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

/**
 * Mirrors the shape of app/api/webhooks/clickup/route.ts, but reacts to
 * taskCreated/taskUpdated (not taskStatusUpdated) on the "Payment Received
 * Orders" list and provisions an investor-facing tracking link instead of
 * mirroring a status back onto a `requests` row.
 *
 * The URL segment is the task's own `name` (the order number, e.g.
 * "6205330647"), NOT a random token, per an explicit product decision
 * (Oct 2026) made after being warned this removes the link's security:
 * order numbers are not secret or high-entropy, so anyone who guesses or
 * enumerates one can view that investor's order status (amount, name,
 * account) with no further proof of identity. The safer alternative (a
 * random token, or an order-number + random-suffix hybrid) was offered
 * and explicitly declined. See CLAUDE.md's "Order Tracking" section.
 *
 * Fully idempotent and automatic: the first time a task on
 * ORDER_TRACKING_LIST_ID is seen, its order number is read once and never
 * re-derived; every later taskUpdated event for the same task is a no-op
 * here (the link doesn't change even if the task is later renamed). Needs
 * two one-time, manual ClickUp-side setup steps from the user (a new
 * custom field to hold the generated link, and this webhook's own
 * subscription + secret) -- see CLAUDE.md's "Order Tracking" section for
 * the exact steps.
 */
export async function POST(request: Request) {
  const secret = process.env.CLICKUP_ORDER_TRACKING_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CLICKUP_ORDER_TRACKING_WEBHOOK_SECRET not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");
  if (!signature || !verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: ClickUpWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (payload.event !== "taskCreated" && payload.event !== "taskUpdated") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const taskId = payload.task_id;
  if (!taskId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const { data: existing } = await supabase
    .from("order_tracking_links")
    .select("token")
    .eq("clickup_task_id", taskId)
    .maybeSingle();

  // Already provisioned -- the link never changes once created, so later
  // taskUpdated events for the same task are a no-op.
  if (existing) {
    return NextResponse.json({ ok: true });
  }

  const taskResult = await fetchClickUpTask(taskId);
  if (!taskResult.ok) {
    return NextResponse.json({ ok: true, ignored: true, error: taskResult.error });
  }

  const taskListId = (taskResult.task.list as { id?: string } | undefined)?.id;
  if (taskListId !== ORDER_TRACKING_LIST_ID) {
    // Not on the Payment Received Orders list -- ignore, regardless of how
    // broadly this webhook ended up scoped in ClickUp's UI.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const orderNumber = typeof taskResult.task.name === "string" ? taskResult.task.name.trim() : "";
  if (!orderNumber) {
    return NextResponse.json({ ok: true, ignored: true, error: "Task has no name to use as the order number." });
  }

  const finalToken = await provisionOrderTrackingLink(supabase, taskId, orderNumber);
  return NextResponse.json({ ok: true, token: finalToken });
}
