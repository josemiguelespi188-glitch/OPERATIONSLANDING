import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { sanitizeDocumentConfig } from "@/lib/documentGenerator/types";
import { DOCUMENT_TEMPLATE_BUCKET, toDocumentTemplateSummary } from "@/lib/documentGenerator/templateRow";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * `id` here is the request_types row id, not the document template's own
 * id -- there's at most one document template per request type, so every
 * route in this folder is addressed by the request type instead of a
 * separate template id the admin UI would have to track.
 */
export async function GET(request: Request, { params }: Params) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: requestType, error: requestTypeError } = await supabase
    .from("request_types")
    .select("id, slug, name")
    .eq("id", id)
    .maybeSingle();
  if (requestTypeError || !requestType) {
    return NextResponse.json({ error: "Request type not found." }, { status: 404 });
  }

  const { data: row } = await supabase
    .from("request_document_templates")
    .select("*")
    .eq("request_type_id", id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ requestType, template: null });
  }

  let fileUrl: string | null = null;
  if (row.file_path) {
    const { data } = await supabase.storage.from(DOCUMENT_TEMPLATE_BUCKET).createSignedUrl(row.file_path, 60 * 60);
    fileUrl = data?.signedUrl ?? null;
  }

  return NextResponse.json({ requestType, template: { ...toDocumentTemplateSummary(row), fileUrl } });
}

export async function PATCH(request: Request, { params }: Params) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.mapping !== undefined) update.mapping = sanitizeDocumentConfig(body.mapping);
  if (typeof body.pageCount === "number" && Number.isInteger(body.pageCount) && body.pageCount > 0) {
    update.page_count = body.pageCount;
  }

  const supabase = getSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("request_document_templates")
    .update(update)
    .eq("request_type_id", id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) {
    return NextResponse.json(
      { error: "No document template exists yet for this request type. Upload a PDF first." },
      { status: 404 }
    );
  }

  return NextResponse.json(toDocumentTemplateSummary(row));
}
