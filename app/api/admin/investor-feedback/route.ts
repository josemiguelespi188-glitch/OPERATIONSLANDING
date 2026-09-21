import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

const WEEKS_OF_TREND = 8;

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json(
      { error: "Server is not configured yet. Missing Supabase credentials." },
      { status: 503 }
    );
  }

  const { data: rows, error } = await supabase
    .from("investor_feedback")
    .select("id, rating, comment, source, submitted_at")
    .order("submitted_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const feedback = rows ?? [];
  const total = feedback.length;

  const histogram: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;
  for (const row of feedback) {
    const rating = row.rating as 1 | 2 | 3 | 4 | 5;
    if (rating in histogram) histogram[rating] += 1;
    ratingSum += row.rating;
  }
  const averageRating = total > 0 ? ratingSum / total : 0;

  const recentComments = feedback
    .filter((row) => row.comment && row.comment.trim())
    .slice(0, 10)
    .map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      submittedAt: row.submitted_at,
    }));

  const weeklyTrend = buildWeeklyTrend(feedback);

  return NextResponse.json({
    total,
    averageRating,
    histogram,
    recentComments,
    weeklyTrend,
  });
}

/** Oldest -> newest average rating + count per calendar week, for the last WEEKS_OF_TREND weeks. */
function buildWeeklyTrend(
  feedback: { rating: number; submitted_at: string }[]
): { weekStart: string; averageRating: number; count: number }[] {
  const now = new Date();
  const weeks: { weekStart: Date; sum: number; count: number }[] = [];

  for (let i = WEEKS_OF_TREND - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setUTCHours(0, 0, 0, 0);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay() - i * 7);
    weeks.push({ weekStart, sum: 0, count: 0 });
  }

  for (const row of feedback) {
    const submitted = new Date(row.submitted_at);
    const bucket = weeks.find((w, idx) => {
      const next = weeks[idx + 1]?.weekStart;
      return submitted >= w.weekStart && (!next || submitted < next);
    });
    if (bucket) {
      bucket.sum += row.rating;
      bucket.count += 1;
    }
  }

  return weeks.map((w) => ({
    weekStart: w.weekStart.toISOString(),
    averageRating: w.count > 0 ? w.sum / w.count : 0,
    count: w.count,
  }));
}
