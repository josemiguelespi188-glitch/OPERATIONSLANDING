import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { COMMUNICATIONS_HTML_BUCKET } from "@/lib/communications/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Issues a signed upload URL for a communication's HTML design, same
 * pattern as POST /api/admin/pdf-templates: the browser uploads the file
 * straight to Supabase Storage with it (never through this function), at
 * a fixed path per communication (`<id>/design.html`) so re-uploading
 * replaces the previous design rather than accumulating files.
 */
export async function POST(request: Request, { params }: Params) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const fileName = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 200) : "";
  if (!fileName.toLowerCase().endsWith(".html") && !fileName.toLowerCase().endsWith(".htm")) {
    return NextResponse.json({ error: "Please upload an .html file." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: existing } = await supabase.from("communications").select("id").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Communication not found." }, { status: 404 });

  const filePath = `${id}/design.html`;
  const { data: upload, error: uploadError } = await supabase.storage
    .from(COMMUNICATIONS_HTML_BUCKET)
    .createSignedUploadUrl(filePath, { upsert: true });
  if (uploadError || !upload) {
    return NextResponse.json(
      { error: `Could not prepare the upload: ${uploadError?.message ?? "unknown error"}. Has migration 010 been run?` },
      { status: 500 }
    );
  }

  await supabase
    .from("communications")
    .update({ html_file_path: filePath, html_file_name: fileName, updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ upload: { path: upload.path, token: upload.token } });
}
