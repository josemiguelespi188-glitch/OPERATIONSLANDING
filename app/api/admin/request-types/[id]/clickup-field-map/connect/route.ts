import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { clickUpTypeToWriteKind, fetchListCustomFields, getListIdForSlug } from "@/lib/integrations/clickup";

export const dynamic = "force-dynamic";

/**
 * Connects one locked form field (by its internal fieldKey) to a real
 * ClickUp custom field, by id, typed in directly by the admin from
 * FieldEditorPanel.tsx. Always does a LIVE lookup against this request
 * type's ClickUp list first -- an id that doesn't exist on the list
 * returns `{ok: false}` (the admin sees a red X) rather than being
 * saved blind, same "never guess/trust an unconfirmed ClickUp field"
 * rule this codebase applies everywhere else it touches ClickUp.
 *
 * A dropdown-kind field's `optionMap` is submitted on a second call once
 * the admin has matched each of the form's own options to one of this
 * field's live ClickUp options (shown via this route's own `liveOptions`
 * response on the first, option-map-less call) -- both calls hit this
 * same endpoint, which just upserts whatever optionMap it's given.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const fieldKey = typeof body?.fieldKey === "string" ? body.fieldKey.trim() : "";
  const clickupFieldId = typeof body?.clickupFieldId === "string" ? body.clickupFieldId.trim() : "";
  const optionMap =
    body?.optionMap && typeof body.optionMap === "object" ? (body.optionMap as Record<string, string>) : {};

  if (!fieldKey || !clickupFieldId) {
    return NextResponse.json({ error: "fieldKey and clickupFieldId are required." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: requestType } = await supabase.from("request_types").select("slug").eq("id", id).maybeSingle();
  if (!requestType) return NextResponse.json({ error: "Request type not found." }, { status: 404 });

  const listId = getListIdForSlug(requestType.slug);
  if (!listId) {
    return NextResponse.json({ ok: false, error: `No ClickUp list configured for "${requestType.slug}" yet.` });
  }

  const liveFields = await fetchListCustomFields(listId);
  const liveField = liveFields.find((f) => f.id === clickupFieldId);
  if (!liveField) {
    return NextResponse.json({
      ok: false,
      error: "No field with that id exists on this request type's live ClickUp list.",
    });
  }

  const kind = clickUpTypeToWriteKind(liveField.type as string | undefined);
  const liveOptions =
    kind === "dropdown"
      ? (((liveField.type_config as { options?: { id: string; name: string }[] } | undefined)?.options ?? []).map(
          (o) => ({ id: o.id, name: o.name })
        ))
      : undefined;

  const { error } = await supabase.from("request_type_clickup_field_map").upsert(
    {
      request_type_id: id,
      field_key: fieldKey,
      clickup_field_id: clickupFieldId,
      kind,
      option_map: optionMap,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "request_type_id,field_key" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    kind,
    liveFieldName: liveField.name as string,
    liveOptions,
  });
}
