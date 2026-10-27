import type { Metadata } from "next";
import { ScheduleMeetingView } from "@/components/scheduling/ScheduleMeetingView";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schedule a Call | AxisKey",
};

/**
 * One-time variant of /schedule-a-call: a token generated from the admin
 * Overview page's "Generate one-time link" button. Unlike every other
 * fail-open toggle in this codebase, this check fails CLOSED (a missing
 * row or a lookup error both render as "no longer valid") -- the entire
 * point of this route is a guarantee the link stops working after one
 * use, so an infrastructure hiccup should never accidentally let it
 * double as a second booking instead of silently staying usable.
 */
async function isLinkValid(token: string): Promise<boolean> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase.from("schedule_links").select("used_at").eq("id", token).maybeSingle();
    return !!data && data.used_at === null;
  } catch {
    return false;
  }
}

export default async function OneTimeScheduleMeetingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = await isLinkValid(token);
  return <ScheduleMeetingView token={token} invalid={!valid} />;
}
