import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Called from the browser (ScheduleMeetingView) the moment Calendly's
 * embedded widget fires its own `calendly.event_scheduled` postMessage --
 * i.e. the booking flow completed inside the iframe. Marks this link
 * used so reloading or reopening the same URL shows "no longer valid"
 * instead of the calendar again. No admin auth: the token itself is the
 * credential, same trust model as /api/order-tracking/[token] and
 * /api/communications-review/[token]/*.
 *
 * Idempotent and never errors on an unknown/already-used token -- a
 * duplicate postMessage firing twice, or a stale tab re-sending this
 * after the link was already consumed elsewhere, shouldn't surface as a
 * failure to the person who just finished booking.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getSupabaseServerClient();
  await supabase.from("schedule_links").update({ used_at: new Date().toISOString() }).eq("id", token).is("used_at", null);
  return NextResponse.json({ ok: true });
}
