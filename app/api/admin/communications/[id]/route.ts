import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import {
  COMMUNICATIONS_HTML_BUCKET,
  toCommunicationSummary,
  type CommunicationChannel,
  type CommunicationRow,
  type CommunicationSectionType,
  type CommunicationStatus,
  type CommunicationStatusHistoryEntry,
} from "@/lib/communications/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function serverClient() {
  try {
    return getSupabaseServerClient();
  } catch {
    return null;
  }
}

const SECTION_TYPES: CommunicationSectionType[] = [
  "section_1",
  "section_2",
  "faq_of_month",
  "full_communication",
];
const CHANNELS: CommunicationChannel[] = ["tribexa", "mass_email", "tbd"];
const STATUSES: CommunicationStatus[] = [
  "idea",
  "in_design",
  "sent_for_approval",
  "changes_requested",
  "approved",
  "scheduled",
  "sent",
];

export async function GET(request: Request, { params }: Params) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: row, error } = await supabase.from("communications").select("*").eq("id", id).maybeSingle();
  if (error || !row) return NextResponse.json({ error: "Communication not found." }, { status: 404 });

  let htmlFileUrl: string | null = null;
  const typedRow = row as CommunicationRow;
  if (typedRow.html_file_path) {
    const { data } = await supabase.storage
      .from(COMMUNICATIONS_HTML_BUCKET)
      .createSignedUrl(typedRow.html_file_path, 60 * 60);
    htmlFileUrl = data?.signedUrl ?? null;
  }

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

  return NextResponse.json({ ...toCommunicationSummary(typedRow), htmlFileUrl, history });
}

/**
 * Updates a communication's fields and/or advances its status. A status
 * change always writes a communications_status_history row. Moving INTO
 * "approved" requires approvedBy (who, of the approvers, clicked
 * approve); moving INTO "changes_requested" requires a comment (stored
 * as that history row's notes — there's no separate "last comment"
 * column, the detail page just reads the latest history entry).
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
  if (typeof body.segment === "string") update.segment = body.segment.trim() || null;
  if (CHANNELS.includes(body.channel)) update.channel = body.channel;
  if (typeof body.htmlUrl === "string") update.html_url = body.htmlUrl.trim() || null;
  if (typeof body.complianceReport === "string") update.compliance_report = body.complianceReport.trim() || null;
  if (typeof body.faqNotes === "string") update.faq_notes = body.faqNotes.trim() || null;
  if (typeof body.responsible === "string") update.responsible = body.responsible.trim() || null;
  if (typeof body.approvers === "string" && body.approvers.trim()) update.approvers = body.approvers.trim();

  let statusChange: { from: CommunicationStatus; to: CommunicationStatus; notes: string | null } | null = null;

  if (typeof body.status === "string" && STATUSES.includes(body.status) && body.status !== existing.status) {
    const toStatus = body.status as CommunicationStatus;

    if (toStatus === "approved") {
      const approvedBy = typeof body.approvedBy === "string" ? body.approvedBy.trim() : "";
      if (!approvedBy) {
        return NextResponse.json({ error: "Select who approved this communication." }, { status: 400 });
      }
      update.approved_at = new Date().toISOString();
      update.approved_by = approvedBy;
    }

    let notes: string | null = null;
    if (toStatus === "changes_requested") {
      const comment = typeof body.comment === "string" ? body.comment.trim() : "";
      if (!comment) {
        return NextResponse.json({ error: "Add a comment describing the requested changes." }, { status: 400 });
      }
      notes = comment;
    }

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

  return NextResponse.json(toCommunicationSummary(row as CommunicationRow));
}

export async function DELETE(request: Request, { params }: Params) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: row } = await supabase.from("communications").select("html_file_path").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Communication not found." }, { status: 404 });

  if (row.html_file_path) {
    await supabase.storage.from(COMMUNICATIONS_HTML_BUCKET).remove([row.html_file_path]);
  }
  const { error } = await supabase.from("communications").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
