import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { uploadFormatTemplate } from "@/lib/services/saReview/formatTemplates";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sa_format_templates")
    .select("id, file_name, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    templates: (data ?? []).map((t) => ({
      id: t.id,
      fileName: t.file_name,
      isActive: t.is_active,
      createdAt: t.created_at,
    })),
  });
}

/**
 * Uploads a new "perfect format" reference .docx and makes it the sole
 * active template (deactivating any previous one) -- at most one template
 * is ever live at a time, see CLAUDE.md's "SA Review" section.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const fileName = typeof body?.fileName === "string" ? body.fileName : null;
  const fileBase64 = typeof body?.fileBase64 === "string" ? body.fileBase64 : null;
  if (!fileName || !fileBase64) {
    return NextResponse.json({ error: "fileName and fileBase64 are required." }, { status: 400 });
  }
  if (!fileName.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ error: "Only .docx files are supported." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const buffer = Buffer.from(fileBase64, "base64");

  try {
    const storagePath = await uploadFormatTemplate(supabase, fileName, buffer);

    await supabase.from("sa_format_templates").update({ is_active: false }).eq("is_active", true);

    const { data: template, error } = await supabase
      .from("sa_format_templates")
      .insert({
        file_name: fileName,
        storage_path: storagePath,
        is_active: true,
        uploaded_by: admin.id,
      })
      .select("id")
      .single();

    if (error || !template) {
      return NextResponse.json({ error: error?.message ?? "Failed to save the template." }, { status: 500 });
    }

    return NextResponse.json({ id: template.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload the template.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
