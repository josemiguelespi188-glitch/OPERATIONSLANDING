import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { downloadSaReviewFile } from "@/lib/services/saReview/storage";

export const dynamic = "force-dynamic";

/**
 * Streams the original or formatted .docx bytes through this
 * requireAdmin-gated route rather than a signed storage URL or a plain
 * <a href>, since browser navigation never carries the Authorization
 * bearer header adminFetch() attaches -- the admin UI must fetch this as
 * a blob and trigger a synthetic download client-side.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const url = new URL(request.url);
  const variant = url.searchParams.get("variant") === "formatted" ? "formatted" : "original";

  const supabase = getSupabaseServerClient();
  const { data: review, error } = await supabase
    .from("sa_reviews")
    .select("file_name, original_file_path, formatted_file_path")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });

  const path = variant === "formatted" ? review.formatted_file_path : review.original_file_path;
  if (!path) {
    return NextResponse.json({ error: `No ${variant} file is available for this review.` }, { status: 404 });
  }

  try {
    const buffer = await downloadSaReviewFile(supabase, path);
    const downloadName =
      variant === "formatted" ? `formatted-${review.file_name}` : review.file_name;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${downloadName.replace(/"/g, "")}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to download the file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
