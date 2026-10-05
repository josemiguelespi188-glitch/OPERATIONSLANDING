import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchClickUpTask } from "@/lib/integrations/clickup";
import { computeOrderTrackingView, type ClickUpTaskRaw } from "@/lib/orderTracking";

export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated endpoint behind an unguessable token (see
 * order_tracking_links -- no public RLS policy exists on it, so this
 * route is the only way to resolve a token to a ClickUp task). Always
 * fetches the live ClickUp task so the investor sees current status, not
 * a cached snapshot.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: "Server is not configured yet." }, { status: 503 });
  }

  const { data: link } = await supabase
    .from("order_tracking_links")
    .select("clickup_task_id")
    .eq("token", token)
    .maybeSingle();

  if (!link) {
    return NextResponse.json({ error: "Tracking link not found." }, { status: 404 });
  }

  const taskResult = await fetchClickUpTask(link.clickup_task_id);
  if (!taskResult.ok) {
    return NextResponse.json({ error: "Could not load your order right now." }, { status: 502 });
  }

  await supabase
    .from("order_tracking_links")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("token", token);

  const view = computeOrderTrackingView(taskResult.task as unknown as ClickUpTaskRaw);
  return NextResponse.json(view);
}
