import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClickUpFieldTarget } from "../integrations/clickup";

/**
 * Loads this request type's admin-connected ClickUp field overrides
 * (request_type_clickup_field_map, see migration
 * 023_request_type_clickup_field_map.sql) in the shape
 * syncRequestToClickUp() expects, to merge on top of its hardcoded
 * CUSTOM_FIELD_MAP. A request type with no rows here (every type except
 * the redemption-request pilot, as of this writing) returns {}, which
 * leaves CUSTOM_FIELD_MAP fully in control -- this never removes a
 * field, only adds/replaces per key.
 */
export async function loadClickUpFieldMapOverrides(
  supabase: SupabaseClient,
  slug: string
): Promise<Record<string, ClickUpFieldTarget[]>> {
  const { data: typeRow } = await supabase
    .from("request_types")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!typeRow) return {};

  const { data: rows } = await supabase
    .from("request_type_clickup_field_map")
    .select("field_key, clickup_field_id, kind, option_map")
    .eq("request_type_id", typeRow.id);

  const overrides: Record<string, ClickUpFieldTarget[]> = {};
  for (const row of rows ?? []) {
    const target: ClickUpFieldTarget =
      row.kind === "dropdown"
        ? { id: row.clickup_field_id, kind: "dropdown", options: (row.option_map as Record<string, string>) ?? {} }
        : { id: row.clickup_field_id, kind: row.kind as "text" | "number" | "checkbox" };
    overrides[row.field_key] = [target];
  }
  return overrides;
}
