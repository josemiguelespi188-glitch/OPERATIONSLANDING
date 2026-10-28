import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { clickUpTypeToWriteKind, fetchListCustomFields, getListIdForSlug } from "@/lib/integrations/clickup";

export const dynamic = "force-dynamic";

/**
 * Sentinel `clickup_field_id` for a field marked as "this question
 * becomes the ClickUp task's own name" rather than a custom field --
 * see supabase/migrations/025_clickup_field_map_task_name.sql.
 * `buildTaskName()` (lib/integrations/clickup.ts) already derives the
 * task name from this question's answer independently of this table
 * (via each FormSpec's `submissionMapping.investorNameField`), so this
 * is purely a record of the connection for the admin UI -- there is no
 * real ClickUp field id to look up or validate.
 */
const TASK_NAME_SENTINEL = "task_name";

/**
 * Connects one locked form field (by its internal fieldKey) to a real
 * ClickUp custom field, typed in directly by the admin from
 * FieldEditorPanel.tsx as either the field's id (a UUID) OR its exact
 * live name (e.g. "Order Number") -- the admin explicitly chose typing
 * over a live-fetched dropdown picker, but asked for name lookup too,
 * since a field's id is always unique while its name sometimes isn't
 * (this codebase has already documented duplicate field names on
 * several lists -- see "ClickUp workspace layout" in CLAUDE.md). Always
 * does a LIVE lookup against this request type's ClickUp list first --
 * an id/name that doesn't resolve to exactly one field returns `{ok:
 * false}` (the admin sees a red X) rather than being saved blind, same
 * "never guess/trust an unconfirmed ClickUp field" rule this codebase
 * applies everywhere else it touches ClickUp.
 *
 * A dropdown-kind field's `optionMap` is submitted on a second call once
 * the admin has matched each of the form's own options to one of this
 * field's live ClickUp options (shown via this route's own `liveOptions`
 * response on the first, option-map-less call) -- both calls hit this
 * same endpoint, which just upserts whatever optionMap it's given.
 *
 * `{fieldKey, markAsTaskName: true}` is a separate, simpler path: the
 * question that becomes the ClickUp task's own name isn't a custom
 * field at all, so searching ClickUp's field list for it always fails.
 * This records the connection directly with no live lookup -- see
 * `TASK_NAME_SENTINEL` above.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const fieldKey = typeof body?.fieldKey === "string" ? body.fieldKey.trim() : "";
  const markAsTaskName = body?.markAsTaskName === true;
  const clickupFieldInput = typeof body?.clickupField === "string" ? body.clickupField.trim() : "";
  const optionMap =
    body?.optionMap && typeof body.optionMap === "object" ? (body.optionMap as Record<string, string>) : {};

  if (!fieldKey || (!markAsTaskName && !clickupFieldInput)) {
    return NextResponse.json(
      { error: "fieldKey and either clickupField or markAsTaskName are required." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data: requestType } = await supabase.from("request_types").select("slug").eq("id", id).maybeSingle();
  if (!requestType) return NextResponse.json({ error: "Request type not found." }, { status: 404 });

  if (markAsTaskName) {
    const { error } = await supabase.from("request_type_clickup_field_map").upsert(
      {
        request_type_id: id,
        field_key: fieldKey,
        clickup_field_id: TASK_NAME_SENTINEL,
        clickup_field_name: "Task Name",
        kind: "task_name",
        option_map: {},
        connected_at: new Date().toISOString(),
      },
      { onConflict: "request_type_id,field_key" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      kind: "task_name",
      clickupFieldId: TASK_NAME_SENTINEL,
      liveFieldName: "Task Name",
    });
  }

  const listId = getListIdForSlug(requestType.slug);
  if (!listId) {
    return NextResponse.json({ ok: false, error: `No ClickUp list configured for "${requestType.slug}" yet.` });
  }

  const liveFields = await fetchListCustomFields(listId);
  let liveField = liveFields.find((f) => f.id === clickupFieldInput);
  if (!liveField) {
    const nameMatches = liveFields.filter(
      (f) => typeof f.name === "string" && f.name.toLowerCase() === clickupFieldInput.toLowerCase()
    );
    if (nameMatches.length === 1) {
      liveField = nameMatches[0];
    } else if (nameMatches.length > 1) {
      return NextResponse.json({
        ok: false,
        error: `${nameMatches.length} fields are named "${clickupFieldInput}" on this list -- type the exact field id instead. IDs: ${nameMatches
          .map((f) => f.id)
          .join(", ")}`,
      });
    }
  }
  if (!liveField) {
    return NextResponse.json({
      ok: false,
      error: `No field named or with id "${clickupFieldInput}" exists on this request type's live ClickUp list.`,
    });
  }
  const clickupFieldId = liveField.id as string;

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
      clickup_field_name: liveField.name as string,
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
    clickupFieldId,
    liveFieldName: liveField.name as string,
    liveOptions,
  });
}
