import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { DynamicField } from "@/lib/dynamicForms/types";

export interface FormOverrides {
  /** Overrides the spec's descriptionParagraphs (as a single paragraph)
   *  when set from the admin Form Builder. */
  description: string | null;
  fields: DynamicField[];
}

const EMPTY: FormOverrides = { description: null, fields: [] };

/**
 * Loads any admin-authored overrides for a locked (code-driven) form's
 * copy/extra fields — see lib/dynamicForms/fieldConfigBridge.ts for how
 * they're merged onto the form's base FormSpec.
 *
 * Never throws: a missing Supabase config, a network hiccup, or a request
 * type that was never opened in the Form Builder are all just "no
 * overrides yet" — the public form must always render from its FormSpec
 * defaults even if this fails.
 */
export async function loadFormOverrides(slug: string): Promise<FormOverrides> {
  try {
    const supabase = getSupabaseServerClient();

    const { data: type } = await supabase
      .from("request_types")
      .select("id, description")
      .eq("slug", slug)
      .maybeSingle();
    if (!type) return EMPTY;

    const { data: fields } = await supabase
      .from("request_fields")
      .select("*")
      .eq("request_type_id", type.id)
      .order("display_order", { ascending: true });

    if (!fields || fields.length === 0) {
      return { description: type.description || null, fields: [] };
    }

    const fieldIds = fields.map((f) => f.id);
    const { data: options } = await supabase
      .from("request_field_options")
      .select("*")
      .in("field_id", fieldIds)
      .order("display_order", { ascending: true });

    const optionsByField: Record<string, { label: string; value: string }[]> = {};
    for (const o of options ?? []) {
      (optionsByField[o.field_id] ??= []).push({ label: o.label, value: o.value });
    }

    return {
      description: type.description || null,
      fields: fields.map((f) => ({
        fieldKey: f.field_key,
        fieldType: f.field_type,
        label: f.label,
        description: f.description ?? "",
        placeholder: f.placeholder ?? "",
        helpText: f.help_text ?? "",
        exampleText: f.example_text ?? "",
        isRequired: f.is_required,
        defaultValue: f.default_value ?? "",
        validationRules: JSON.stringify(f.validation_rules ?? {}),
        displayOrder: f.display_order,
        columnSpan: f.column_span,
        options: optionsByField[f.id] ?? [],
      })),
    };
  } catch {
    return EMPTY;
  }
}
