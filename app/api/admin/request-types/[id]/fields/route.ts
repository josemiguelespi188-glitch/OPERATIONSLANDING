import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { FORM_SPECS } from "@/lib/formSpecs";
import { codeFieldTypesByKey } from "@/lib/dynamicForms/fieldConfigBridge";
import type { RequestTypeSlug } from "@/lib/requestTypes";

export const dynamic = "force-dynamic";

const VALID_FIELD_TYPES = new Set([
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "currency",
  "date",
  "dropdown",
  "multi_select",
  "checkbox",
  "radio",
  "file_upload",
  "section_divider",
  "instructions",
  "readonly_info",
]);

interface IncomingField {
  fieldKey: string;
  fieldType: string;
  label: string;
  description?: string;
  placeholder?: string;
  helpText?: string;
  exampleText?: string;
  isRequired?: boolean;
  defaultValue?: string;
  validationRules?: string;
  columnSpan?: string;
  options?: { label: string; value: string }[];
}

/**
 * Replaces the entire field set for a request type in one call — simplest
 * correct approach for a builder UI that edits the whole form locally and
 * saves once. Not wrapped in a DB transaction (Supabase's REST client
 * doesn't expose one for arbitrary multi-statement logic); acceptable here
 * since nothing writes to these rows outside this endpoint.
 *
 * For a locked (code-driven) type, these rows are read live by its public
 * page (see lib/formSpecs/loadOverrides.ts + lib/dynamicForms/
 * fieldConfigBridge.ts's mergePublicFields) — a row whose field_key matches
 * a code-defined field overrides that field's copy, and any other row is
 * appended as a brand-new question. The dynamic renderer/ClickUp sync for
 * *non-locked*, fully database-driven request types is still a later
 * phase.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: existing } = await supabase
    .from("request_types")
    .select("is_locked, slug")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Request type not found." }, { status: 404 });

  // Locked types are code-driven pages (see lib/formSpecs) — their field
  // *structure* (keys, types, ClickUp mapping) can't come from the
  // database, but their copy can be overridden and new questions appended
  // (see lib/dynamicForms/fieldConfigBridge.ts, which the public page uses
  // to merge these rows onto the code spec at render time).
  const lockedSpec = existing.is_locked ? FORM_SPECS[existing.slug as RequestTypeSlug] : undefined;
  const codeFieldTypes = lockedSpec ? codeFieldTypesByKey(lockedSpec) : null;

  const body = await request.json().catch(() => null);
  const fields: IncomingField[] | null = Array.isArray(body?.fields) ? body.fields : null;
  if (!fields) return NextResponse.json({ error: "fields must be an array." }, { status: 400 });

  const seenKeys = new Set<string>();
  for (const f of fields) {
    if (!f.fieldKey?.trim() || !f.label?.trim() || !VALID_FIELD_TYPES.has(f.fieldType)) {
      return NextResponse.json(
        { error: `Every field needs a label, an internal name, and a valid type.` },
        { status: 400 }
      );
    }
    if (seenKeys.has(f.fieldKey.trim())) {
      return NextResponse.json(
        { error: `Duplicate internal field name: "${f.fieldKey.trim()}".` },
        { status: 400 }
      );
    }
    seenKeys.add(f.fieldKey.trim());
    if (f.validationRules) {
      try {
        JSON.parse(f.validationRules);
      } catch {
        return NextResponse.json(
          { error: `Invalid validation rules JSON for field "${f.label}".` },
          { status: 400 }
        );
      }
    }
    if (codeFieldTypes) {
      const codeType = codeFieldTypes[f.fieldKey.trim()];
      if (codeType && codeType !== f.fieldType) {
        return NextResponse.json(
          {
            error: `"${f.label}" is a code-managed field on this locked form — its type can't be changed here (expected "${codeType}").`,
          },
          { status: 400 }
        );
      }
    }
  }

  const { error: deleteError } = await supabase
    .from("request_fields")
    .delete()
    .eq("request_type_id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (fields.length === 0) {
    await logFieldsSaved(supabase, id, admin.id, 0);
    return NextResponse.json({ ok: true });
  }

  const { data: insertedFields, error: insertError } = await supabase
    .from("request_fields")
    .insert(
      fields.map((f, i) => ({
        request_type_id: id,
        field_key: f.fieldKey.trim(),
        field_type: f.fieldType,
        label: f.label.trim(),
        description: f.description?.trim() || null,
        placeholder: f.placeholder?.trim() || null,
        help_text: f.helpText?.trim() || null,
        example_text: f.exampleText?.trim() || null,
        is_required: !!f.isRequired,
        default_value: f.defaultValue?.trim() || null,
        validation_rules: f.validationRules ? JSON.parse(f.validationRules) : {},
        display_order: i,
        column_span: f.columnSpan === "full" ? "full" : "half",
      }))
    )
    .select("id, field_key");

  if (insertError || !insertedFields) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to save fields." },
      { status: 500 }
    );
  }

  const idByKey: Record<string, string> = {};
  for (const row of insertedFields) idByKey[row.field_key] = row.id;

  const optionRows = fields.flatMap((f) =>
    (f.options ?? [])
      .filter((o) => o.label?.trim() && o.value?.trim())
      .map((o, i) => ({
        field_id: idByKey[f.fieldKey.trim()],
        label: o.label.trim(),
        value: o.value.trim(),
        display_order: i,
      }))
  );

  if (optionRows.length > 0) {
    const { error: optionsError } = await supabase
      .from("request_field_options")
      .insert(optionRows);
    if (optionsError) return NextResponse.json({ error: optionsError.message }, { status: 500 });
  }

  await logFieldsSaved(supabase, id, admin.id, fields.length);
  return NextResponse.json({ ok: true });
}

async function logFieldsSaved(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  requestTypeId: string,
  actorId: string,
  fieldCount: number
) {
  await supabase.from("form_activity_log").insert({
    request_type_id: requestTypeId,
    actor_id: actorId,
    action: "fields_saved",
    metadata: { fieldCount },
  });
}
