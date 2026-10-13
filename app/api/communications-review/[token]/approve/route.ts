import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPendingCommunicationByToken } from "@/lib/services/communications/reviewToken";
import { sendApprovedNotificationEmail } from "@/lib/services/communications/sendApprovedNotificationEmail";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const supabase = getSupabaseServerClient();

  const row = await getPendingCommunicationByToken(supabase, token);
  if (!row) return NextResponse.json({ error: "This review link is no longer valid." }, { status: 404 });

  const approvedBy = row.requested_approver_name || row.requested_approver_email || "Approver";
  const { error } = await supabase
    .from("communications")
    .update({
      status: "ready_for_launch",
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("communications_status_history").insert({
    communication_id: row.id,
    from_status: "pending_approval",
    to_status: "ready_for_launch",
    changed_by: approvedBy,
    notes: null,
  });

  // Best-effort: never fails the approval itself if the notification
  // can't be sent -- same pattern as the approval-request email.
  const emailResult = await sendApprovedNotificationEmail({
    communicationId: row.id,
    communicationTitle: row.title,
    approvedBy,
  });
  if (!emailResult.sent) {
    console.error(`[communications] approved notification not sent for ${row.id}:`, emailResult.error);
  }

  return NextResponse.json({ ok: true });
}
