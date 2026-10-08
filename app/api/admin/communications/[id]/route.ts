import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { sendApprovalRequestEmail } from "@/lib/services/communications/sendApprovalEmail";
import {
  toCommunicationSummary,
  type CommunicationComment,
  type CommunicationRow,
  type CommunicationSectionType,
  type CommunicationStatus,
  type CommunicationStatusHistoryEntry,
  type RecipientType,
} from "@/lib/communications/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const SECTION_TYPES: CommunicationSectionType[] = [
  "section_1",
  "section_2",
  "faq_of_month",
  "full_communication",
];
const STATUSES: CommunicationStatus[] = [
  "building",
  "pending_approval",
  "changes_requested",
  "ready_for_launch",
  "deployed",
];
const RECIPIENT_TYPES: RecipientType[] = ["all_investors", "specific"];

export async function GET(request: Request, { params }: Params) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: row, error } = await supabase.from("communications").select("*").eq("id", id).maybeSingle();
  if (error || !row) return NextResponse.json({ error: "Communication not found." }, { status: 404 });

  const { data: historyRows } = await supabase
    .from("communications_status_history")
    .select("*")
    .eq("communication_id", id)
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
    .eq("communication_id", id)
    .order("created_at", { ascending: false });

  const comments: CommunicationComment[] = (commentRows ?? []).map((c) => ({
    id: c.id,
    author: c.author,
    body: c.body,
    createdAt: c.created_at,
  }));

  const { data: recipientRows } = await supabase
    .from("communication_recipients")
    .select("client_id")
    .eq("communication_id", id);
  const recipientClientIds = (recipientRows ?? []).map((r) => r.client_id as string);

  return NextResponse.json({
    ...toCommunicationSummary(row as CommunicationRow),
    history,
    comments,
    recipientClientIds,
  });
}

/**
 * Updates a communication's fields and/or advances its status. A status
 * change always writes a communications_status_history row.
 *
 * Normal (gated) transitions: moving INTO "pending_approval" requires
 * the HTML itself to actually be there and a chosen approver
 * (approverName/approverEmail -- the detail page's "Send for approval"
 * picker), which also triggers a best-effort email via
 * sendApprovalRequestEmail; moving INTO "ready_for_launch" requires
 * approvedBy; moving INTO "changes_requested" requires a comment
 * (stored as that history row's notes).
 *
 * `manualOverride: true` skips all of the above requirements and just
 * sets the status directly -- the detail page's "Change status
 * manually" dropdown, for correcting a mistake or handling a case the
 * guided flow doesn't cover. Deliberately separate from the guided
 * buttons rather than replacing them, so the normal approval workflow
 * still can't be skipped by accident.
 */
export async function PATCH(request: Request, { params }: Params) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from("communications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !existing) return NextResponse.json({ error: "Communication not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.title === "string") {
    const title = body.title.trim().slice(0, 300);
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    update.title = title;
  }
  if (SECTION_TYPES.includes(body.sectionType)) update.section_type = body.sectionType;
  if (body.sendDate === null || typeof body.sendDate === "string") update.send_date = body.sendDate || null;
  if (typeof body.htmlCode === "string") update.html_code = body.htmlCode;
  if (typeof body.faqNotes === "string") update.faq_notes = body.faqNotes.trim() || null;
  if (typeof body.approvers === "string" && body.approvers.trim()) update.approvers = body.approvers.trim();
  if (RECIPIENT_TYPES.includes(body.recipientType)) update.recipient_type = body.recipientType;

  let statusChange: { from: CommunicationStatus; to: CommunicationStatus; notes: string | null } | null = null;
  let approvalEmailTarget: { name: string; email: string; reviewToken: string } | null = null;
  const manualOverride = body.manualOverride === true;

  if (typeof body.status === "string" && STATUSES.includes(body.status) && body.status !== existing.status) {
    const toStatus = body.status as CommunicationStatus;

    if (!manualOverride) {
      if (toStatus === "pending_approval") {
        const html = typeof update.html_code === "string" ? update.html_code : existing.html_code;
        if (!html || !html.trim()) {
          return NextResponse.json({ error: "Add the HTML for this communication before sending for approval." }, { status: 400 });
        }
        const approverName = typeof body.approverName === "string" ? body.approverName.trim() : "";
        const approverEmail = typeof body.approverEmail === "string" ? body.approverEmail.trim() : "";
        if (!approverName || !approverEmail) {
          return NextResponse.json({ error: "Choose who you're requesting approval from." }, { status: 400 });
        }
        const reviewToken = crypto.randomUUID();
        update.requested_approver_name = approverName;
        update.requested_approver_email = approverEmail;
        update.review_token = reviewToken;
        approvalEmailTarget = { name: approverName, email: approverEmail, reviewToken };
      }

      if (toStatus === "ready_for_launch") {
        const approvedBy = typeof body.approvedBy === "string" ? body.approvedBy.trim() : "";
        if (!approvedBy) {
          return NextResponse.json({ error: "Select who approved this communication." }, { status: 400 });
        }
        update.approved_at = new Date().toISOString();
        update.approved_by = approvedBy;
      }
    }

    let notes: string | null = null;
    if (toStatus === "changes_requested" && !manualOverride) {
      const comment = typeof body.comment === "string" ? body.comment.trim() : "";
      if (!comment) {
        return NextResponse.json({ error: "Add a comment describing the requested changes." }, { status: 400 });
      }
      notes = comment;
    }
    if (manualOverride) notes = "Manually changed.";

    update.status = toStatus;
    statusChange = { from: existing.status, to: toStatus, notes };
  }

  const { data: row, error } = await supabase
    .from("communications")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Communication not found." }, { status: 404 });

  if (statusChange) {
    await supabase.from("communications_status_history").insert({
      communication_id: id,
      from_status: statusChange.from,
      to_status: statusChange.to,
      changed_by: admin.email ?? admin.id,
      notes: statusChange.notes,
    });
  }

  // Best-effort: never fails the transition itself if email sending
  // isn't configured or the call errors -- see sendApprovalRequestEmail.
  if (approvalEmailTarget) {
    await sendApprovalRequestEmail({
      reviewToken: approvalEmailTarget.reviewToken,
      communicationTitle: row.title,
      approverName: approvalEmailTarget.name,
      approverEmail: approvalEmailTarget.email,
      requestedBy: admin.email ?? "The Operations Hub",
    });
  }

  // Recipients: replace the full selection whenever clientIds is sent,
  // rather than diffing -- this is a small admin-managed list, not a
  // high-churn relation, so delete-then-reinsert is simple and correct.
  if (Array.isArray(body.clientIds)) {
    const clientIds: string[] = body.clientIds.filter((v: unknown): v is string => typeof v === "string");
    await supabase.from("communication_recipients").delete().eq("communication_id", id);
    if (clientIds.length > 0) {
      await supabase
        .from("communication_recipients")
        .insert(clientIds.map((clientId: string) => ({ communication_id: id, client_id: clientId })));
    }
  }

  return NextResponse.json(toCommunicationSummary(row as CommunicationRow));
}

export async function DELETE(request: Request, { params }: Params) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: row } = await supabase.from("communications").select("id").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Communication not found." }, { status: 404 });

  const { error } = await supabase.from("communications").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
