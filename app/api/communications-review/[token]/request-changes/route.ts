import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPendingCommunicationByToken } from "@/lib/services/communications/reviewToken";

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

  return NextResponse.json({ ok: true });
}
