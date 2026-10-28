import { FORM_SPECS } from "@/lib/formSpecs";
import { fetchListCustomFields, getCustomFieldTargets, getListIdForSlug } from "@/lib/integrations/clickup";

export interface KnownClickUpField {
  /** Matches a FormSpec submissionMapping.customFields[].key, and becomes
   *  a DocumentField's customFieldKey once added to a mapping. */
  key: string;
  label: string;
  kind: "text" | "number" | "checkbox" | "dropdown";
  /** This form's own option labels, shown only as a hint in the field
   *  picker -- the real decode at generation time reads ClickUp's live
   *  option list instead (see resolveFromClickUp.ts), since the form's
   *  option text and ClickUp's option names aren't guaranteed identical. */
  options?: string[];
}

/**
 * Every field of this request type that's both part of its FormSpec AND
 * already confirmed to resolve to a real ClickUp custom field (has a
 * CUSTOM_FIELD_MAP entry) -- i.e. exactly the fields "Generate Document"
 * can actually pull live data for. A key present in `customFields` but
 * missing from CUSTOM_FIELD_MAP (not yet provisioned/confirmed in
 * ClickUp) is deliberately left out rather than offered and failing
 * later -- same "don't guess an unconfirmed field" rule this codebase
 * applies everywhere else it talks to ClickUp.
 *
 * `label` is ClickUp's own live field name (fetched fresh every call via
 * fetchListCustomFields(), the same "Get Accessible Custom Fields" call
 * resolveFromClickUp.ts uses to decode dropdowns) -- not this form's own
 * question wording, per explicit feedback that mapping is easier by the
 * name actually shown in ClickUp. Falls back to the FormSpec's own field
 * label only if the live call fails or that field has since vanished
 * from ClickUp, so the picker never shows a blank name.
 */
export async function getKnownClickUpFields(slug: string): Promise<KnownClickUpField[]> {
  const spec = FORM_SPECS[slug as keyof typeof FORM_SPECS];
  if (!spec) return [];

  const targets = getCustomFieldTargets(slug);
  const fieldsByName = new Map(spec.fields.map((f) => [f.name, f]));
  const entries = (spec.submissionMapping.customFields ?? []).filter((e) => targets[e.key]?.[0]);
  if (entries.length === 0) return [];

  const listId = getListIdForSlug(slug);
  const liveFields = listId ? await fetchListCustomFields(listId) : [];
  const liveNameById = new Map(liveFields.map((f) => [f.id as string, f.name as string]));

  return entries.map((entry) => {
    const target = targets[entry.key][0];
    const fieldConfig = fieldsByName.get(entry.field);
    const options =
      fieldConfig && (fieldConfig.kind === "select" || fieldConfig.kind === "selectOrOther")
        ? fieldConfig.options
        : undefined;

    return {
      key: entry.key,
      label: liveNameById.get(target.id) ?? fieldConfig?.label ?? entry.key,
      kind: target.kind,
      options: target.kind === "dropdown" ? options : undefined,
    };
  });
}
