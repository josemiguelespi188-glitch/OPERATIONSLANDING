import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { REQUEST_TYPES } from "@/lib/requestTypes";
import type { ClickUpSyncStatus, RequestStatus } from "@/lib/types";
import { parseStatsRange, statsRangeCutoffISO } from "@/lib/utils/dateRange";

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

  const range = parseStatsRange(new URL(request.url).searchParams.get("range"));
  const cutoff = statsRangeCutoffISO(range);

  let query = supabase
    .from("requests")
    .select(
      "id, request_type_slug, requestor_name, investor_name, deal_name, status, clickup_task_id, clickup_sync_status, clickup_sync_error, clickup_status_text, created_at"
    )
    .order("created_at", { ascending: false });
  if (cutoff) query = query.gte("created_at", cutoff);

  const { data: requests, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Used by the admin Overview's "Requests by Type" card to only show
  // slugs that are currently visible to investors (e.g. a deactivated
  // type like account-maintenance-request stays out of that list).
  // Fails open (every slug "active") on a lookup error, same default as
  // every other active/inactive check in this codebase.
  const { data: activeRows, error: activeError } = await supabase
    .from("request_types")
    .select("slug")
    .eq("is_active", true);
  const activeSlugs = activeError ? REQUEST_TYPES.map((t) => t.slug) : (activeRows ?? []).map((r) => r.slug);

  const rows = requests ?? [];

  const byStatus: Record<RequestStatus, number> = {
    submitted: 0,
    in_review: 0,
    completed: 0,
  };
  const bySyncStatus: Record<ClickUpSyncStatus, number> = {
    pending: 0,
    synced: 0,
    failed: 0,
  };
  const byType: Record<string, number> = {};

  for (const type of REQUEST_TYPES) {
    byType[type.slug] = 0;
  }

  for (const row of rows) {
    const status = row.status as RequestStatus;
    if (status in byStatus) byStatus[status] += 1;

    const syncStatus = row.clickup_sync_status as ClickUpSyncStatus;
    if (syncStatus in bySyncStatus) bySyncStatus[syncStatus] += 1;

    byType[row.request_type_slug] = (byType[row.request_type_slug] ?? 0) + 1;
  }

  return NextResponse.json({
    range,
    total: rows.length,
    byStatus,
    bySyncStatus,
    byType,
    activeSlugs,
    // Capped well above what the Overview page shows by default (4,
    // paginated) so "view more" has real further pages to show instead
    // of immediately running out.
    recent: rows.slice(0, 40),
  });
}
