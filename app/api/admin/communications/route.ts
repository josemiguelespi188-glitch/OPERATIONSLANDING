import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import {
  toCommunicationSummary,
  type CommunicationChannel,
  type CommunicationSectionType,
  type CommunicationRow,
} from "@/lib/communications/types";

export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = serverClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server is not configured yet. Missing Supabase credentials." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("communications")
    .select("*")
    .order("send_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    communications: ((data ?? []) as CommunicationRow[]).map(toCommunicationSummary),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = serverClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server is not configured yet. Missing Supabase credentials." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 300) : "";
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const sectionType: CommunicationSectionType = SECTION_TYPES.includes(body.sectionType)
    ? body.sectionType
    : "section_1";
  const channel: CommunicationChannel = CHANNELS.includes(body.channel) ? body.channel : "tbd";

  const { data: row, error } = await supabase
    .from("communications")
    .insert({
      title,
      section_type: sectionType,
      send_date: typeof body.sendDate === "string" && body.sendDate ? body.sendDate : null,
      segment: typeof body.segment === "string" ? body.segment.trim() || null : null,
      channel,
      html_url: typeof body.htmlUrl === "string" ? body.htmlUrl.trim() || null : null,
      compliance_report: typeof body.complianceReport === "string" ? body.complianceReport.trim() || null : null,
      faq_notes: typeof body.faqNotes === "string" ? body.faqNotes.trim() || null : null,
      responsible: typeof body.responsible === "string" ? body.responsible.trim() || null : null,
      created_by: admin.id,
    })
    .select("*")
    .single();

  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? "Could not create the communication." }, { status: 500 });
  }

  await supabase.from("communications_status_history").insert({
    communication_id: row.id,
    from_status: null,
    to_status: row.status,
    changed_by: admin.email ?? admin.id,
  });

  return NextResponse.json({ communication: toCommunicationSummary(row as CommunicationRow) });
}
