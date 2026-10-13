import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPendingCommunicationByToken } from "@/lib/services/communications/reviewToken";
import { notifyAnnelise } from "@/lib/services/communications/notifyAnnelise";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const body = await request.json().catch(() => ({}));
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (!comment) return NextResponse.json({ error: "Add a comment describing the requested changes." }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const row = await getPendingCommunicationByToken(supabase, token);
  if (!row) return NextResponse.json({ error: "This review link is no longer valid." }, { status: 404 });

  const changedBy = row.requested_approver_name || row.requested_approver_email || "Approver";
  const { error } = await supabase
    .from("communications")
    .update({ status: "changes_requested", updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("communications_status_history").insert({
    communication_id: row.id,
    from_status: "pending_approval",
    to_status: "changes_requested",
    changed_by: changedBy,
    notes: comment,
  });

  // Best-effort: never fails the action itself if the notification
  // can't be sent -- same pattern as every other email here.
  const emailResult = await notifyAnnelise({
    communicationId: row.id,
    communicationTitle: row.title,
    subject: `Changes requested: ${row.title}`,
    eyebrow: "Changes Requested",
    headline: `Changes requested on ${row.title}`,
    introHtml: `<strong>${changedBy}</strong> requested changes before approving this communication:`,
    quoteHtml: comment,
  });
  if (!emailResult.sent) {
    console.error(`[communications] changes-requested notification not sent for ${row.id}:`, emailResult.error);
  }

  return NextResponse.json({ ok: true });
}
