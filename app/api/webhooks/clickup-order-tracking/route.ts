import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchClickUpTask, setCustomField } from "@/lib/integrations/clickup";
import { ORDER_TRACKING_LIST_ID, getSiteBaseUrl } from "@/lib/orderTracking";

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

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Mirrors the shape of app/api/webhooks/clickup/route.ts, but reacts to
 * taskCreated/taskUpdated (not taskStatusUpdated) on the "Payment Received
 * Orders" list and provisions an investor-facing tracking link instead of
 * mirroring a status back onto a `requests` row.
 *
 * Fully idempotent and automatic, per product decision: the first time a
 * task on ORDER_TRACKING_LIST_ID is seen, a random token is generated once
 * and never regenerated; every later taskUpdated event for the same task
 * is a no-op here (the link doesn't change). Needs two one-time, manual
 * ClickUp-side setup steps from the user (a new custom field to hold the
 * generated link, and this webhook's own subscription + secret) -- see
 * CLAUDE.md's "Order Tracking" section for the exact steps.
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

  const token = generateToken();
  const { error: insertError } = await supabase
    .from("order_tracking_links")
    .insert({ clickup_task_id: taskId, clickup_list_id: ORDER_TRACKING_LIST_ID, token });

  let finalToken = token;
  if (insertError) {
    // Likely a race with a concurrent webhook delivery for the same task --
    // re-select rather than failing, so we always write back a real link.
    const { data: existingAfterRace } = await supabase
      .from("order_tracking_links")
      .select("token")
      .eq("clickup_task_id", taskId)
      .maybeSingle();
    if (!existingAfterRace) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }
    finalToken = existingAfterRace.token;
  }

  const trackingUrl = `${getSiteBaseUrl()}/order-tracking/${finalToken}`;

  const fieldId = process.env.CLICKUP_ORDER_TRACKING_FIELD_ID;
  const clickUpToken = process.env.CLICKUP_API_TOKEN;
  if (fieldId && clickUpToken) {
    await setCustomField(taskId, fieldId, trackingUrl, clickUpToken);
  }

  return NextResponse.json({ ok: true, trackingUrl });
}
