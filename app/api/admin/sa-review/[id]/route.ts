import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("sa_reviews").select("*").eq("id", id).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Review not found." }, { status: 404 });

  return NextResponse.json({
    review: {
      id: data.id,
      fileName: data.file_name,
      status: data.status,
      mappingReady: data.mapping_ready,
      findings: data.findings,
      mechanicalFixes: data.mechanical_fixes,
      hasFormattedFile: Boolean(data.formatted_file_path),
      error: data.error,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: review } = await supabase
    .from("sa_reviews")
    .select("original_file_path, formatted_file_path")
    .eq("id", id)
    .maybeSingle();

  if (review) {
    const paths = [review.original_file_path, review.formatted_file_path].filter(
      (p): p is string => Boolean(p)
    );
    if (paths.length > 0) {
      await supabase.storage.from("sa-reviews").remove(paths);
    }
  }

  const { error } = await supabase.from("sa_reviews").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
