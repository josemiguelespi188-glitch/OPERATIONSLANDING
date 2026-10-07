import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { extractDocxEvidence } from "@/lib/services/saReview/extractDocx";
import { analyzeWithClaude } from "@/lib/services/saReview/analyzeWithClaude";
import { uploadSaReviewFile } from "@/lib/services/saReview/storage";
import { getActiveFormatTemplateReference } from "@/lib/services/saReview/formatTemplates";
import { getActiveSkillKnowledgeText } from "@/lib/services/saReview/knowledgeBase";

export const dynamic = "force-dynamic";
// Docx extraction + a Claude call can take a while on a large document.
export const maxDuration = 60;

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sa_reviews")
    .select("id, file_name, status, mapping_ready, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    reviews: (data ?? []).map((r) => ({
      id: r.id,
      fileName: r.file_name,
      status: r.status,
      mappingReady: r.mapping_ready,
      createdAt: r.created_at,
    })),
  });
}

/**
 * Accepts the SA as base64 JSON (not multipart) so it can go through the
 * same adminFetch() helper every other admin API call uses -- that helper
 * always sets Content-Type: application/json when a body is present,
 * which would corrupt a multipart/form-data upload.
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

  const { data: review, error: insertError } = await supabase
    .from("sa_reviews")
    .insert({
      file_name: fileName,
      original_file_path: "",
      status: "analyzing",
      reviewed_by: admin.id,
    })
    .select("id")
    .single();

  if (insertError || !review) {
    return NextResponse.json({ error: insertError?.message ?? "Failed to create review." }, { status: 500 });
  }

  try {
    const originalPath = await uploadSaReviewFile(supabase, review.id, "original", fileName, buffer);
    await supabase.from("sa_reviews").update({ original_file_path: originalPath }).eq("id", review.id);

    const evidence = await extractDocxEvidence(buffer);
    const [formatTemplateReference, knowledgeBaseText] = await Promise.all([
      getActiveFormatTemplateReference(supabase),
      getActiveSkillKnowledgeText(supabase),
    ]);
    const { mappingReady, findings, mechanicalFixes } = await analyzeWithClaude(evidence, {
      formatTemplateReference,
      knowledgeBaseText,
    });

    await supabase
      .from("sa_reviews")
      .update({
        status: "completed",
        mapping_ready: mappingReady,
        findings,
        mechanical_fixes: mechanicalFixes,
      })
      .eq("id", review.id);

    return NextResponse.json({ id: review.id, mappingReady, findings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error reviewing the document.";
    await supabase.from("sa_reviews").update({ status: "failed", error: message }).eq("id", review.id);
    return NextResponse.json({ id: review.id, error: message }, { status: 500 });
  }
}
