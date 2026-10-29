import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildStatusPageUrl,
  fetchStatusTokenFieldId,
  fetchTicketsByIds,
  getStatusTokenValue,
  searchTicketsByRequesterEmail,
  type ZendeskTicket,
} from "@/lib/integrations/zendesk";

export const dynamic = "force-dynamic";

/** Same placeholder owner used by POST /api/support-inquiry -- see that route's comment. */
const SHARED_OWNER_EMAIL = "ir@axiskey.com";

/** Bounds how many unresolved rows get a Zendesk search attempt per call, so one slow page load can't fan out indefinitely. */
const MAX_RESOLVE_ATTEMPTS = 20;

interface InquiryRow {
  id: string;
  investor_name: string;
  investor_email: string;
  subject: string;
  submitted_at: string;
  zendesk_ticket_id: number | null;
  zendesk_status: string | null;
  status_page_url: string | null;
}

/**
 * Public, unauthenticated endpoint (same trust model as the rest of
 * /support-inquiry) that powers the "previous tickets" panel next to the
 * form. Three things happen on every call, all best-effort against
 * Zendesk so a Zendesk-side failure never breaks the panel -- it just
 * falls back to whatever this app already has cached from a prior call:
 *
 * 1. Any row still missing a zendesk_ticket_id (the email-to-ticket
 *    automation hadn't produced a match yet last time this ran) gets a
 *    fresh search attempt, by requester email and submission date.
 * 2. Every row that does have a ticket id gets its live status and
 *    Status Token custom field (-> the hosted status page link) refreshed
 *    in one batched call.
 * 3. Both kinds of updates are written back to support_inquiries so the
 *    next call starts from a warmer cache.
 */
export async function GET() {
  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: "Server is not configured yet. Missing Supabase credentials." }, { status: 503 });
  }

  const { data: rows, error } = await supabase
    .from("support_inquiries")
    .select("id, investor_name, investor_email, subject, submitted_at, zendesk_ticket_id, zendesk_status, status_page_url")
    .eq("owner_email", SHARED_OWNER_EMAIL)
    .order("submitted_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const inquiries = (rows ?? []) as InquiryRow[];

  const unresolved = inquiries.filter((row) => !row.zendesk_ticket_id).slice(0, MAX_RESOLVE_ATTEMPTS);
  const claimedTicketIds = new Set(
    inquiries.filter((row) => row.zendesk_ticket_id).map((row) => row.zendesk_ticket_id as number)
  );

  for (const row of unresolved) {
    const submittedOn = row.submitted_at.slice(0, 10);
    const candidates = await searchTicketsByRequesterEmail(row.investor_email, submittedOn);
    const match = pickBestMatch(candidates, row.submitted_at, claimedTicketIds);
    if (!match) continue;

    claimedTicketIds.add(match.id);
    row.zendesk_ticket_id = match.id;
    await supabase.from("support_inquiries").update({ zendesk_ticket_id: match.id }).eq("id", row.id);
  }

  const resolvedIds = inquiries
    .filter((row): row is InquiryRow & { zendesk_ticket_id: number } => row.zendesk_ticket_id !== null)
    .map((row) => row.zendesk_ticket_id);

  if (resolvedIds.length > 0) {
    const [tickets, statusTokenFieldId] = await Promise.all([
      fetchTicketsByIds(resolvedIds),
      fetchStatusTokenFieldId(),
    ]);
    const ticketsById = new Map(tickets.map((t) => [t.id, t]));

    for (const row of inquiries) {
      if (!row.zendesk_ticket_id) continue;
      const ticket = ticketsById.get(row.zendesk_ticket_id);
      if (!ticket) continue;

      const token = statusTokenFieldId ? getStatusTokenValue(ticket, statusTokenFieldId) : null;
      row.zendesk_status = ticket.status;
      row.status_page_url = token ? buildStatusPageUrl(token) : row.status_page_url;

      await supabase
        .from("support_inquiries")
        .update({
          zendesk_status: row.zendesk_status,
          status_page_url: row.status_page_url,
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({
    inquiries: inquiries.map((row) => ({
      id: row.id,
      investorName: row.investor_name,
      investorEmail: row.investor_email,
      subject: row.subject,
      submittedAt: row.submitted_at,
      zendeskTicketId: row.zendesk_ticket_id,
      zendeskStatus: row.zendesk_status,
      statusPageUrl: row.status_page_url,
    })),
  });
}

/**
 * Picks the ticket most likely to be the one this submission produced:
 * the candidate with the smallest time gap to submittedAt, never earlier
 * than a small buffer before it (the automation can't create a ticket
 * before the email that triggers it was sent), and never one already
 * claimed by another row resolved earlier in this same batch.
 */
function pickBestMatch(
  candidates: ZendeskTicket[],
  submittedAtIso: string,
  claimedTicketIds: Set<number>
): ZendeskTicket | null {
  const submittedAt = new Date(submittedAtIso).getTime();
  const EARLY_BUFFER_MS = 2 * 60 * 1000;

  let best: ZendeskTicket | null = null;
  let bestDelta = Infinity;
  for (const candidate of candidates) {
    if (claimedTicketIds.has(candidate.id)) continue;
    const createdAt = new Date(candidate.created_at).getTime();
    if (Number.isNaN(createdAt) || createdAt < submittedAt - EARLY_BUFFER_MS) continue;

    const delta = Math.abs(createdAt - submittedAt);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  return best;
}
