import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { syncInvestorUpdateAndPersist } from "@/lib/services/investorUpdateSync";
import type { AttachmentInput } from "@/lib/types";
import type { InvestorUpdateRequestInput } from "@/lib/investorUpdateRequest";

/** Maps a FormShell field name (the attachment's fieldKey) to which
 *  upload field it came from, for investor_update_files.category. */
function categoryForFieldKey(fieldKey: string | undefined): "supporting_material" | "image_chart" {
  return fieldKey === "imagesCharts" ? "image_chart" : "supporting_material";
}

export async function POST(request: Request) {
  let body: InvestorUpdateRequestInput;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const requesterName = body.requesterName?.trim();
  const requesterEmail = body.requesterEmail?.trim();
  const offeringName = body.offeringName?.trim();
  const mainUpdate = body.mainUpdate?.trim();

  if (!requesterName || !requesterEmail || !offeringName || !mainUpdate) {
    return NextResponse.json(
      { error: "Requester name, requester email, offering name, and main update are required." },
      { status: 400 }
    );
  }

  const industryResearchOption = body.industryResearchOption === "No" ? "No" : "Yes";
  const additionalNotes = body.additionalNotes?.trim() || null;

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json(
      { error: "Server is not configured yet. Missing Supabase credentials." },
      { status: 503 }
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("investor_update_requests")
    .insert({
      requester_name: requesterName,
      requester_email: requesterEmail,
      offering_name: offeringName,
      main_update: mainUpdate,
      industry_research_option: industryResearchOption,
      additional_notes: additionalNotes,
      status: "submitted",
    })
    .select("id, created_at")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to save the investor update request." },
      { status: 500 }
    );
  }

  const attachments: AttachmentInput[] = body.attachments ?? [];
  if (attachments.length > 0) {
    await supabase.from("investor_update_files").insert(
      attachments.map((attachment) => ({
        request_id: inserted.id,
        category: categoryForFieldKey(attachment.fieldKey),
        file_name: attachment.fileName,
        file_url: attachment.fileUrl,
        file_size: attachment.fileSize ?? null,
        content_type: attachment.contentType ?? null,
      }))
    );
  }

  await supabase.from("investor_update_status_history").insert({
    request_id: inserted.id,
    from_status: null,
    to_status: "submitted",
  });

  const submittedAt = new Date().toISOString();

  // Awaited so the response can report whether ClickUp sync succeeded —
  // but a ClickUp failure never fails the submission itself: the request
  // is already safely in Supabase and marked for retry.
  const sync = await syncInvestorUpdateAndPersist(supabase, inserted.id, {
    requesterName,
    requesterEmail,
    offeringName,
    mainUpdate,
    industryResearchOption,
    additionalNotes: additionalNotes ?? undefined,
    attachments,
    submittedAt,
  });

  return NextResponse.json({
    id: inserted.id,
    createdAt: inserted.created_at,
    clickupSynced: sync.synced,
    clickupTaskId: sync.taskId,
  });
}
