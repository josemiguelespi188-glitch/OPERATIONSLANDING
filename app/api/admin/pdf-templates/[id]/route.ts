import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { sanitizeMapping } from "@/lib/pdfGenerator/types";
import { PDF_TEMPLATE_BUCKET, toTemplateSummary } from "@/lib/pdfGenerator/templateRow";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { data: row, error } = await supabase.from("pdf_templates").select("*").eq("id", id).maybeSingle();
  if (error || !row) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  let fileUrl: string | null = null;
  if (row.file_path) {
    const { data } = await supabase.storage.from(PDF_TEMPLATE_BUCKET).createSignedUrl(row.file_path, 60 * 60);
    fileUrl = data?.signedUrl ?? null;
  }

  return NextResponse.json({ ...toTemplateSummary(row), fileUrl });
}

export async function PATCH(request: Request, { params }: Params) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 200);
    if (!name) return NextResponse.json({ error: "Template name is required." }, { status: 400 });
    update.name = name;
  }
  if (body.mapping !== undefined) update.mapping = sanitizeMapping(body.mapping);
  if (typeof body.pageCount === "number" && Number.isInteger(body.pageCount) && body.pageCount > 0) {
    update.page_count = body.pageCount;
  }

  const supabase = getSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("pdf_templates")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  return NextResponse.json(toTemplateSummary(row));
}

export async function DELETE(request: Request, { params }: Params) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { data: row } = await supabase.from("pdf_templates").select("file_path").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  if (row.file_path) await supabase.storage.from(PDF_TEMPLATE_BUCKET).remove([row.file_path]);
  const { error } = await supabase.from("pdf_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
