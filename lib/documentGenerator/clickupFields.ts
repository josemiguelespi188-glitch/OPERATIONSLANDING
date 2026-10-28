import { fetchListCustomFields, getListIdForSlug } from "@/lib/integrations/clickup";

export interface KnownClickUpField {
  /** The real ClickUp custom field id -- becomes a DocumentField's clickUpFieldId once added to a mapping. */
  id: string;
  /** ClickUp's own live field name, fetched fresh every call. */
  label: string;
  kind: "text" | "number" | "currency" | "checkbox" | "dropdown" | "date";
  /** This field's live dropdown options, shown only as a hint in the field picker. */
  options?: string[];
}

const CLICKUP_TYPE_TO_KIND: Record<string, KnownClickUpField["kind"]> = {
  drop_down: "dropdown",
  checkbox: "checkbox",
  currency: "currency",
  number: "number",
  date: "date",
};

/**
 * Every custom field currently active on this request type's ClickUp
 * list -- the FULL live catalog, not just the ones already confirmed in
 * this codebase's hand-curated CUSTOM_FIELD_MAP. Per explicit product
 * decision (Oct 2026, second follow-up pass): "absolutamente todo lo que
 * vayamos a mapear va a estar en ClickUp" -- any field that exists on the
 * list has to be mappable here, whether or not this codebase's own
 * submission-sync code already uses it. The admin's field picker is
 * responsible for only *showing* the subset that's actually useful day
 * to day (the pinned fields -- see the pinned_clickup_fields column on
 * request_types and the "View More ClickUp Fields" panel), not this
 * function -- this always returns everything.
 */
export async function getAllClickUpFields(slug: string): Promise<KnownClickUpField[]> {
  const listId = getListIdForSlug(slug);
  if (!listId) return [];

  const raw = await fetchListCustomFields(listId);
  const fields: KnownClickUpField[] = [];
  for (const f of raw) {
    const id = f.id as string | undefined;
    const name = f.name as string | undefined;
    if (!id || !name) continue;
    const type = f.type as string | undefined;
    const kind = (type ? CLICKUP_TYPE_TO_KIND[type] : undefined) ?? "text";
    const typeConfig = f.type_config as { options?: { name: string }[] } | undefined;
    fields.push({
      id,
      label: name,
      kind,
      options: kind === "dropdown" ? typeConfig?.options?.map((o) => o.name) : undefined,
    });
  }
  return fields;
}
