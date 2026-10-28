import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { sanitizeDocumentConfig } from "@/lib/documentGenerator/types";
import { resolveDocumentValuesFromClickUp } from "@/lib/documentGenerator/resolveFromClickUp";

export const dynamic = "force-dynamic";

/**
 * Looks up this request type's ClickUp list for a task matching the
 * given Order Number and resolves every field of ONE specific document
 * mapping (a request type can have several) off it. Returns the
 * resolved values only -- the browser still does the actual PDF fill
 * (generatePdf(), reused unchanged from the PDF Generator tool) with its
 * own copy of this mapping's config + template bytes.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, templateId } = await params;
  const body = await request.json().catch(() => ({}));
  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber : "";

  const supabase = getSupabaseServerClient();
  const { data: requestType } = await supabase.from("request_types").select("slug").eq("id", id).maybeSingle();
  if (!requestType) return NextResponse.json({ error: "Request type not found." }, { status: 404 });

  const { data: templateRow } = await supabase
    .from("request_document_templates")
    .select("mapping")
    .eq("id", templateId)
    .eq("request_type_id", id)
    .maybeSingle();
  if (!templateRow) {
    return NextResponse.json({ error: "Document mapping not found." }, { status: 404 });
  }

  const mapping = sanitizeDocumentConfig(templateRow.mapping);
  if (mapping.fields.length === 0) {
    return NextResponse.json({ error: "This document's mapping has no fields yet." }, { status: 400 });
  }

  const result = await resolveDocumentValuesFromClickUp(requestType.slug, mapping.fields, orderNumber);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });

  return NextResponse.json({ values: result.values, taskId: result.taskId });
}
