import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

/**
 * Replaces this request type's full pinned-ClickUp-field set (shared
 * across every document mapping it has -- see migration 021). The
 * picker always sends the complete set after a toggle, not a diff.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const fieldIds = Array.isArray(body?.fieldIds) ? body.fieldIds.filter((v: unknown) => typeof v === "string") : null;
  if (!fieldIds) return NextResponse.json({ error: "fieldIds must be an array of strings." }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("request_types").update({ pinned_clickup_fields: fieldIds }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pinnedIds: fieldIds });
}
