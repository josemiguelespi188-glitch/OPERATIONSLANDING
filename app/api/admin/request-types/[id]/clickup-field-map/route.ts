import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

/**
 * This request type's admin-connected ClickUp field map
 * (request_type_clickup_field_map), keyed by field_key so
 * FieldEditorPanel.tsx can look up a single field's connection state by
 * its own fieldKey.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { data: rows, error } = await supabase
    .from("request_type_clickup_field_map")
    .select("field_key, clickup_field_id, kind, option_map, connected_at")
    .eq("request_type_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const map: Record<
    string,
    { clickupFieldId: string; kind: string; optionMap: Record<string, string>; connectedAt: string }
  > = {};
  for (const row of rows ?? []) {
    map[row.field_key] = {
      clickupFieldId: row.clickup_field_id,
      kind: row.kind,
      optionMap: (row.option_map as Record<string, string>) ?? {},
      connectedAt: row.connected_at,
    };
  }

  return NextResponse.json({ map });
}
