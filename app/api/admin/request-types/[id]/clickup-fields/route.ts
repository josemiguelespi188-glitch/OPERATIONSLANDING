import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { getAllClickUpFields } from "@/lib/documentGenerator/clickupFields";

export const dynamic = "force-dynamic";

/**
 * The document mapping field picker's data for this request type: the
 * full live ClickUp field catalog (`all`) plus which of those ids are
 * currently pinned (`pinnedIds`, request_types.pinned_clickup_fields --
 * shared across every mapping this request type has). The picker's main
 * view shows only the pinned subset; "View More ClickUp Fields" shows
 * everything in `all`.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { data: requestType } = await supabase.from("request_types").select("slug").eq("id", id).maybeSingle();
  if (!requestType) return NextResponse.json({ error: "Request type not found." }, { status: 404 });

  // Selected separately from "slug" above: pinned_clickup_fields only
  // exists once migration 021_request_type_clickup_field_pins.sql has
  // been run. If it hasn't, this query errors (column doesn't exist)
  // rather than this whole route wrongly reporting "Request type not
  // found" -- fails open to an empty pinned set instead.
  const { data: pinnedRow } = await supabase
    .from("request_types")
    .select("pinned_clickup_fields")
    .eq("id", id)
    .maybeSingle();

  const all = await getAllClickUpFields(requestType.slug);
  const pinnedIds = Array.isArray(pinnedRow?.pinned_clickup_fields) ? pinnedRow.pinned_clickup_fields : [];
  return NextResponse.json({ all, pinnedIds });
}
