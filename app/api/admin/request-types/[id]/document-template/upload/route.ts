import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { DOCUMENT_TEMPLATE_BUCKET, toDocumentTemplateSummary } from "@/lib/documentGenerator/templateRow";

export const dynamic = "force-dynamic";

/**
 * Creates (or replaces the file on) this request type's one document
 * template row, then returns a signed upload URL -- same "browser
 * uploads straight to Storage" pattern as /api/admin/pdf-templates, so
 * large PDFs never pass through this function. Re-uploading an existing
 * template keeps its saved mapping; only the file and page count reset
 * (the admin re-does box placement afterward if the new PDF's layout
 * changed).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const fileName = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 200) : "";
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("request_document_templates")
    .upsert({ request_type_id: requestTypeId, file_name: fileName }, { onConflict: "request_type_id" })
    .select("*")
    .single();
  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? "Could not create the document template." }, { status: 500 });
  }

  const filePath = `${row.id}/template.pdf`;
  const { data: upload, error: uploadError } = await supabase.storage
    .from(DOCUMENT_TEMPLATE_BUCKET)
    .createSignedUploadUrl(filePath, { upsert: true });
  if (uploadError || !upload) {
    return NextResponse.json(
      { error: `Could not prepare the upload: ${uploadError?.message ?? "unknown error"}. Has migration 019 been run?` },
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
