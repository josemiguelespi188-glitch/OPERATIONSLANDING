import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { RequestStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ClickUpStatusHistoryItem {
  field: string;
  after?: { status: string; type?: string };
}

interface ClickUpWebhookPayload {
  event: string;
  task_id?: string;
  history_items?: ClickUpStatusHistoryItem[];
}

/** ClickUp status "type" -> our 3-value status. Generalizes across lists
 *  with different status names, since every custom status still has one
 *  of these 4 categories. */
function mapStatusType(type: string | undefined): RequestStatus {
  if (type === "done" || type === "closed") return "completed";
  if (type === "custom") return "in_review";
  return "submitted";
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const signatureBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

/**
 * Receives ClickUp's taskStatusUpdated webhook and mirrors the task's
 * current status back onto the matching `requests` row (matched by
 * clickup_task_id). One-way sync in the opposite direction of
 * syncRequestToClickUp — this is ClickUp -> us, not us -> ClickUp.
 *
 * Always responds 2xx once the payload is understood (even for events we
 * ignore) so ClickUp doesn't treat an irrelevant event as a delivery
 * failure and retry it.
 */
export async function POST(request: Request) {
  const secret = process.env.CLICKUP_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CLICKUP_WEBHOOK_SECRET not configured." }, { status: 503 });
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

  if (payload.event !== "taskStatusUpdated") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const taskId = payload.task_id;
  const after = payload.history_items?.find((item) => item.field === "status")?.after;
  if (!taskId || !after?.status) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const { data: existing } = await supabase
    .from("requests")
    .select("id")
    .eq("clickup_task_id", taskId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  await supabase
    .from("requests")
    .update({
      status: mapStatusType(after.type),
      clickup_status_text: after.status,
      clickup_status_type: after.type ?? null,
    })
    .eq("id", existing.id);

  return NextResponse.json({ ok: true });
}
