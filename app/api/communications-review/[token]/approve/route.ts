import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPendingCommunicationByToken } from "@/lib/services/communications/reviewToken";

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

  return NextResponse.json({ ok: true });
}
