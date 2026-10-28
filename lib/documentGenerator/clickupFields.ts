import { FORM_SPECS } from "@/lib/formSpecs";
import { getCustomFieldTargets } from "@/lib/integrations/clickup";

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
 */
export function getKnownClickUpFields(slug: string): KnownClickUpField[] {
  const spec = FORM_SPECS[slug as keyof typeof FORM_SPECS];
  if (!spec) return [];

  const targets = getCustomFieldTargets(slug);
  const fieldsByName = new Map(spec.fields.map((f) => [f.name, f]));

  const result: KnownClickUpField[] = [];
  for (const entry of spec.submissionMapping.customFields ?? []) {
    const target = targets[entry.key]?.[0];
    if (!target) continue;

    const fieldConfig = fieldsByName.get(entry.field);
    const options =
      fieldConfig && (fieldConfig.kind === "select" || fieldConfig.kind === "selectOrOther")
        ? fieldConfig.options
        : undefined;

    result.push({
      key: entry.key,
      label: fieldConfig?.label ?? entry.key,
      kind: target.kind,
      options: target.kind === "dropdown" ? options : undefined,
    });
  }
  return result;
}
