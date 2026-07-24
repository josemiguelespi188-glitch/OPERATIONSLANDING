import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildRequestPayload } from "@/lib/payload";
import { getRequestType } from "@/lib/requestTypes";
import { syncRequestToClickUp } from "@/lib/integrations/clickup";
import { triggerN8nWorkflow } from "@/lib/integrations/n8n";
import type { AttachmentInput, RequestFormInput } from "@/lib/types";

export async function POST(request: Request) {
  let body: RequestFormInput;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const requestType = getRequestType(body.requestType);
  if (!requestType) {
    return NextResponse.json({ error: "Unknown request type." }, { status: 400 });
  }
  if (!body.requestorName?.trim() || !body.requestorEmail?.trim()) {
    return NextResponse.json(
      { error: "Requestor name and email are required." },
      { status: 400 }
    );
  }

  const payload = buildRequestPayload(body);

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json(
      { error: "Server is not configured yet. Missing Supabase credentials." },
      { status: 503 }
    );
  }

  const { data: typeRow } = await supabase
    .from("request_types")
    .select("id")
    .eq("slug", requestType.slug)
    .maybeSingle();

  const { data: inserted, error: insertError } = await supabase
    .from("requests")
    .insert({
      request_type_id: typeRow?.id ?? null,
      request_type_slug: requestType.slug,
      requestor_name: payload.requestorName,
      requestor_email: payload.requestorEmail,
      investor_name: payload.investorName || null,
      deal_name: payload.dealName || null,
      notes: payload.notes || null,
      status: "submitted",
      payload,
    })
    .select("id, created_at")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to save request." },
      { status: 500 }
    );
  }

  const attachments: AttachmentInput[] = body.attachments ?? [];
  if (attachments.length > 0) {
    await supabase.from("request_attachments").insert(
      attachments.map((attachment) => ({
        request_id: inserted.id,
        file_name: attachment.fileName,
        file_url: attachment.fileUrl,
        file_size: attachment.fileSize ?? null,
        content_type: attachment.contentType ?? null,
      }))
    );
  }

  await supabase.from("activity_log").insert({
    request_id: inserted.id,
    action: "request_submitted",
    actor_email: payload.requestorEmail,
    metadata: { requestType: requestType.slug },
  });

  // Fire-and-forget: neither integration is live yet, but calling them here
  // keeps the wiring point centralized for when they are.
  void syncRequestToClickUp(payload);
  void triggerN8nWorkflow(payload);

  return NextResponse.json({ id: inserted.id, createdAt: inserted.created_at });
}
