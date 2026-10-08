import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPendingCommunicationByToken } from "@/lib/services/communications/reviewToken";
import {
  toCommunicationSummary,
  type CommunicationComment,
  type CommunicationRow,
  type CommunicationStatusHistoryEntry,
} from "@/lib/communications/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/**
 * Public (no admin login), token-gated: what the approval-request
 * email's button links to. Deliberately scoped to read-only display
 * data for exactly one communication -- no list of other communications,
 * no way to navigate elsewhere -- see
 * app/communications-review/[token]/page.tsx for why.
 */
export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  const supabase = getSupabaseServerClient();

  const row = await getPendingCommunicationByToken(supabase, token);
  if (!row) {
    return NextResponse.json({ error: "This review link is no longer valid." }, { status: 404 });
  }

  const { data: historyRows } = await supabase
    .from("communications_status_history")
    .select("*")
    .eq("communication_id", row.id)
    .order("created_at", { ascending: false });
  const history: CommunicationStatusHistoryEntry[] = (historyRows ?? []).map((h) => ({
    id: h.id,
    fromStatus: h.from_status,
    toStatus: h.to_status,
    changedBy: h.changed_by,
    notes: h.notes,
    createdAt: h.created_at,
  }));

  const { data: commentRows } = await supabase
    .from("communication_comments")
    .select("id, author, body, created_at")
    .eq("communication_id", row.id)
    .order("created_at", { ascending: false });
  const comments: CommunicationComment[] = (commentRows ?? []).map((c) => ({
    id: c.id,
    author: c.author,
    body: c.body,
    createdAt: c.created_at,
  }));

  return NextResponse.json({ ...toCommunicationSummary(row as CommunicationRow), history, comments });
}
