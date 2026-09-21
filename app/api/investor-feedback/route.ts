import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { InvestorFeedbackInput } from "@/lib/types";

/**
 * Public, unauthenticated endpoint: the "Rate Your Experience" landing
 * page (app/rate-your-experience) posts here directly from an email link,
 * with no investor login. Uses the service role client (bypasses RLS)
 * rather than relying solely on the anon-insert policy on
 * investor_feedback, matching how POST /api/requests writes to `requests`.
 */
export async function POST(request: Request) {
  let body: InvestorFeedbackInput;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "rating must be an integer between 1 and 5." },
      { status: 400 }
    );
  }

  const comment = typeof body.comment === "string" ? body.comment.trim() : null;
  const source = typeof body.source === "string" && body.source.trim()
    ? body.source.trim()
    : "allocation_confirmed_email";

  const submittedAt = body.submittedAt && !Number.isNaN(Date.parse(body.submittedAt))
    ? new Date(body.submittedAt).toISOString()
    : new Date().toISOString();

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json(
      { error: "Server is not configured yet. Missing Supabase credentials." },
      { status: 503 }
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("investor_feedback")
    .insert({
      rating,
      comment: comment || null,
      source,
      submitted_at: submittedAt,
    })
    .select("id, created_at")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to save feedback." },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: inserted.id, createdAt: inserted.created_at }, { status: 201 });
}
