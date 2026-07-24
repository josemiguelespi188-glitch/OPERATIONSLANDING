import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { REQUEST_TYPES } from "@/lib/requestTypes";
import type { RequestStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json(
      { error: "Server is not configured yet. Missing Supabase credentials." },
      { status: 503 }
    );
  }

  const { data: requests, error } = await supabase
    .from("requests")
    .select(
      "id, request_type_slug, requestor_name, investor_name, deal_name, status, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = requests ?? [];

  const byStatus: Record<RequestStatus, number> = {
    submitted: 0,
    in_review: 0,
    completed: 0,
  };
  const byType: Record<string, number> = {};

  for (const type of REQUEST_TYPES) {
    byType[type.slug] = 0;
  }

  for (const row of rows) {
    const status = row.status as RequestStatus;
    if (status in byStatus) byStatus[status] += 1;
    byType[row.request_type_slug] = (byType[row.request_type_slug] ?? 0) + 1;
  }

  return NextResponse.json({
    total: rows.length,
    byStatus,
    byType,
    recent: rows.slice(0, 10),
  });
}
