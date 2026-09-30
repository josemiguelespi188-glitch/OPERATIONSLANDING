import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import type { InvestorUpdateStatus } from "@/lib/investorUpdateRequest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json(
      { error: "Server is not configured yet. Missing Supabase credentials." },
      { status: 503 }
    );
  }

  const { data: rows, error } = await supabase
    .from("investor_update_requests")
    .select(
      "id, requester_name, requester_email, offering_name, status, clickup_task_id, clickup_sync_status, clickup_sync_error, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const requests = rows ?? [];

  const byStatus: Record<InvestorUpdateStatus, number> = {
    submitted: 0,
    in_progress: 0,
    draft_created: 0,
    pending_client_approval: 0,
    approved: 0,
    published: 0,
    completed: 0,
  };

  for (const row of requests) {
    const status = row.status as InvestorUpdateStatus;
    if (status in byStatus) byStatus[status] += 1;
  }

  return NextResponse.json({
    total: requests.length,
    byStatus,
    recent: requests.slice(0, 10),
  });
}
