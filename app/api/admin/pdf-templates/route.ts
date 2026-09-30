import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { PDF_TEMPLATE_BUCKET, toTemplateSummary } from "@/lib/pdfGenerator/templateRow";

export const dynamic = "force-dynamic";

function serverClient() {
  try {
    return getSupabaseServerClient();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = serverClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server is not configured yet. Missing Supabase credentials." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("pdf_templates")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: (data ?? []).map(toTemplateSummary) });
}

/**
 * Creates the template row and returns a signed upload URL for its PDF.
 * The browser uploads the file straight to Supabase Storage with it, so
 * large PDFs never pass through this function (Vercel caps request
 * bodies at ~4.5 MB).
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = serverClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server is not configured yet. Missing Supabase credentials." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 200) : "";
  if (!name) return NextResponse.json({ error: "Template name is required." }, { status: 400 });
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("pdf_templates")
    .insert({ name, file_name: fileName, created_by: admin.id })
    .select("*")
    .single();
  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? "Could not create the template." }, { status: 500 });
  }

  const filePath = `${row.id}/template.pdf`;
  const { data: upload, error: uploadError } = await supabase.storage
    .from(PDF_TEMPLATE_BUCKET)
    .createSignedUploadUrl(filePath, { upsert: true });
  if (uploadError || !upload) {
    await supabase.from("pdf_templates").delete().eq("id", row.id);
    return NextResponse.json(
      { error: `Could not prepare the upload: ${uploadError?.message ?? "unknown error"}. Has migration 006 been run?` },
      { status: 500 }
    );
  }

  const { data: updated } = await supabase
    .from("pdf_templates")
    .update({ file_path: filePath })
    .eq("id", row.id)
    .select("*")
    .single();

  return NextResponse.json({
    template: toTemplateSummary(updated ?? row),
    upload: { path: upload.path, token: upload.token },
  });
}
