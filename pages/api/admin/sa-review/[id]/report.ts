import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { renderSaReviewReportPdf } from "@/lib/services/saReview/reportPdf";
import type { SaReviewFinding } from "@/lib/services/saReview/checklist";

/**
 * Deliberately a Pages Router API route, not an App Router route handler.
 * @react-pdf/renderer's own React copy doesn't recognize elements created
 * inside the app/ directory's module graph (Next bundles that graph against
 * a "react-server" conditioned React build for RSC) and throws a minified
 * invariant #31 ("Objects are not valid as a React child") even though the
 * markup is correct -- confirmed by reproducing the render standalone in
 * plain Node (works) vs through app/api/.../route.ts (fails) with the same
 * code. Pages API routes aren't part of that module graph, which is why
 * this one endpoint lives here instead of alongside the other sa-review
 * routes in app/api/admin/sa-review.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const authRequest = new Request("http://localhost", {
    headers: { authorization: req.headers.authorization ?? "" },
  });
  const admin = await requireAdmin(authRequest);
  if (!admin) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = req.query.id;
  if (typeof id !== "string") {
    res.status(400).json({ error: "Invalid id." });
    return;
  }

  const supabase = getSupabaseServerClient();
  const { data: review, error } = await supabase
    .from("sa_reviews")
    .select("file_name, status, mapping_ready, findings")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!review) {
    res.status(404).json({ error: "Review not found." });
    return;
  }
  if (review.status !== "completed") {
    res.status(400).json({ error: "This review hasn't finished analyzing yet." });
    return;
  }

  try {
    const buffer = await renderSaReviewReportPdf({
      fileName: review.file_name,
      mappingReady: review.mapping_ready,
      findings: (review.findings ?? []) as SaReviewFinding[],
    });

    const downloadName = review.file_name.replace(/\.docx$/i, "") + "-sa-review-report.pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName.replace(/"/g, "")}"`);
    res.status(200).send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate the report.";
    res.status(500).json({ error: message });
  }
}
