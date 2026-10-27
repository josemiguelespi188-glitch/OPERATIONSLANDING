import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { getSiteBaseUrl } from "@/lib/orderTracking";

export const dynamic = "force-dynamic";

/**
 * Generates a fresh one-time "Schedule a Call" link for the admin to
 * copy and share. Each call inserts a new schedule_links row and
 * returns its public URL -- no body needed, this is a plain button
 * action, not a form.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data: row, error } = await supabase.from("schedule_links").insert({}).select("id").single();
  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? "Could not generate a link." }, { status: 500 });
  }

  return NextResponse.json({ url: `${getSiteBaseUrl()}/schedule-a-call/${row.id}` });
}
