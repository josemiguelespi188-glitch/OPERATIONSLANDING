import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { downloadSaReviewFile, uploadSaReviewFile } from "@/lib/services/saReview/storage";
import { applyMechanicalFixes } from "@/lib/services/saReview/applyMechanicalFixes";
import type { MechanicalFix } from "@/lib/services/saReview/analyzeWithClaude";

export const dynamic = "force-dynamic";

/**
 * Re-applies the category 1/2 mechanical fixes Claude already identified
 * against the ORIGINAL file (never the Claude output itself) and stores
 * the result as the "formatted" variant. Doesn't call Claude again --
 * mechanicalFixes was already captured and stored at review time.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: review, error } = await supabase
    .from("sa_reviews")
    .select("file_name, original_file_path, mechanical_fixes, status")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  if (review.status !== "completed") {
    return NextResponse.json({ error: "This review hasn't finished analyzing yet." }, { status: 400 });
  }

  const fixes = (review.mechanical_fixes ?? []) as MechanicalFix[];
  if (fixes.length === 0) {
    return NextResponse.json(
      { error: "No mechanical (space or alignment) fixes were found for this document." },
      { status: 400 }
    );
  }

  try {
    const originalBuffer = await downloadSaReviewFile(supabase, review.original_file_path);
    const { buffer, summary } = await applyMechanicalFixes(originalBuffer, fixes);

    const formattedPath = await uploadSaReviewFile(supabase, id, "formatted", review.file_name, buffer);
    await supabase.from("sa_reviews").update({ formatted_file_path: formattedPath }).eq("id", id);

    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to format the document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
