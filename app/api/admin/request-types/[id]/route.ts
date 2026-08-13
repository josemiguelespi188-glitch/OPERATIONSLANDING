import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: type, error } = await supabase
    .from("request_types")
    .select(
      "id, slug, name, description, sort_order, is_active, is_locked, uses_dynamic_form, button_label, icon"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !type) {
    return NextResponse.json({ error: "Request type not found." }, { status: 404 });
  }

  const { data: fields } = await supabase
    .from("request_fields")
    .select("*")
    .eq("request_type_id", id)
    .order("display_order", { ascending: true });

  const fieldIds = (fields ?? []).map((f) => f.id);
  const { data: options } = fieldIds.length
    ? await supabase
        .from("request_field_options")
        .select("*")
        .in("field_id", fieldIds)
        .order("display_order", { ascending: true })
    : { data: [] as { field_id: string; id: string; label: string; value: string }[] };

  const optionsByField: Record<string, { id: string; label: string; value: string }[]> = {};
  for (const opt of options ?? []) {
    (optionsByField[opt.field_id] ??= []).push({ id: opt.id, label: opt.label, value: opt.value });
  }

  return NextResponse.json({
    id: type.id,
    slug: type.slug,
    name: type.name,
    description: type.description,
    sortOrder: type.sort_order,
    isActive: type.is_active,
    isLocked: type.is_locked,
    usesDynamicForm: type.uses_dynamic_form,
    buttonLabel: type.button_label,
    icon: type.icon,
    fields: (fields ?? []).map((f) => ({
      id: f.id,
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
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: existing } = await supabase
    .from("request_types")
    .select("is_locked")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Request type not found." }, { status: 404 });
  if (existing.is_locked) {
    return NextResponse.json(
      { error: "This request type is locked and can't be edited here." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.description === "string") update.description = body.description.trim();
  if (typeof body.buttonLabel === "string") {
    update.button_label = body.buttonLabel.trim() || "Open Request";
  }
  if (typeof body.icon === "string") update.icon = body.icon.trim() || null;
  if (typeof body.isActive === "boolean") update.is_active = body.isActive;
  if (typeof body.sortOrder === "number") update.sort_order = body.sortOrder;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { error } = await supabase.from("request_types").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("form_activity_log").insert({
    request_type_id: id,
    actor_id: admin.id,
    action: "request_type_updated",
    metadata: update,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: existing } = await supabase
    .from("request_types")
    .select("is_locked, name")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Request type not found." }, { status: 404 });
  if (existing.is_locked) {
    return NextResponse.json(
      { error: "This request type is locked and can't be deleted." },
      { status: 403 }
    );
  }

  const { error } = await supabase.from("request_types").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("form_activity_log").insert({
    request_type_id: null,
    actor_id: admin.id,
    action: "request_type_deleted",
    metadata: { id, name: existing.name },
  });

  return NextResponse.json({ ok: true });
}
