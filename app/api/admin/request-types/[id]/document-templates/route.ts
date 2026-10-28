import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { DOCUMENT_TEMPLATE_BUCKET, toDocumentTemplateSummary } from "@/lib/documentGenerator/templateRow";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * A request type can hold any number of named document mappings (e.g.
 * several different Redemption Request document variants) -- this list
 * is what the Mapping tab shows and what the Generate tab's template
 * picker is built from.
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

  const { data: rows, error } = await supabase
    .from("request_document_templates")
    .select("*")
    .eq("request_type_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    requestType,
    templates: (rows ?? []).map(toDocumentTemplateSummary),
  });
}

/**
 * Creates a new named document mapping for this request type and
 * returns a signed upload URL for its base PDF -- same "browser uploads
 * straight to Storage" pattern as /api/admin/pdf-templates, so large
 * PDFs never pass through this function.
 */
export async function POST(request: Request, { params }: Params) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: requestTypeId } = await params;
  const supabase = getSupabaseServerClient();

  const { data: requestType } = await supabase
    .from("request_types")
    .select("id")
    .eq("id", requestTypeId)
    .maybeSingle();
  if (!requestType) return NextResponse.json({ error: "Request type not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 200) : "";
  if (!name) return NextResponse.json({ error: "Mapping name is required." }, { status: 400 });
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("request_document_templates")
    .insert({ request_type_id: requestTypeId, name, file_name: fileName })
    .select("*")
    .single();
  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? "Could not create the document mapping." }, { status: 500 });
  }

  const filePath = `${row.id}/template.pdf`;
  const { data: upload, error: uploadError } = await supabase.storage
    .from(DOCUMENT_TEMPLATE_BUCKET)
    .createSignedUploadUrl(filePath, { upsert: true });
  if (uploadError || !upload) {
    await supabase.from("request_document_templates").delete().eq("id", row.id);
    return NextResponse.json(
      { error: `Could not prepare the upload: ${uploadError?.message ?? "unknown error"}. Have migrations 019-020 been run?` },
      { status: 500 }
    );
  }

  const { data: updated } = await supabase
    .from("request_document_templates")
    .update({ file_path: filePath })
    .eq("id", row.id)
    .select("*")
    .single();

  return NextResponse.json({
    template: toDocumentTemplateSummary(updated ?? row),
    upload: { path: upload.path, token: upload.token },
  });
}
