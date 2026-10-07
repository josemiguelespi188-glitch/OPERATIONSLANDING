import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import {
  toCommunicationSummary,
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

/**
 * Quick-create: just a title and (optionally, e.g. clicked from a
 * calendar day) a send date — everything else (the HTML itself,
 * section type, FAQ notes) is filled in on the detail page right
 * after, which is why this is a tiny "+" action rather than a full form.
 */
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

  const sendDate = typeof body.sendDate === "string" ? body.sendDate.trim() : "";
  if (!sendDate) return NextResponse.json({ error: "Send date is required." }, { status: 400 });

  const sectionType: CommunicationSectionType = SECTION_TYPES.includes(body.sectionType)
    ? body.sectionType
    : "section_1";

  const { data: row, error } = await supabase
    .from("communications")
    .insert({
      title,
      section_type: sectionType,
      send_date: sendDate,
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
