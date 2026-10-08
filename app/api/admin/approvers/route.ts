import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

/**
 * The saved approver list used by a communication's "Send for approval"
 * / "Who is approving?" pickers (see CommunicationDetail.tsx) -- a
 * small reusable address book, same pattern as /api/admin/clients.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("approvers").select("id, name, email").order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ approvers: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  if (!name) return NextResponse.json({ error: "Approver name is required." }, { status: 400 });
  if (!email || !email.includes("@")) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });

  const supabase = getSupabaseServerClient();

  const { data: existing } = await supabase.from("approvers").select("id, name, email").ilike("email", email).maybeSingle();
  if (existing) return NextResponse.json({ approver: existing });

  const { data: row, error } = await supabase.from("approvers").insert({ name, email }).select("id, name, email").single();
  if (error || !row) return NextResponse.json({ error: error?.message ?? "Could not add the approver." }, { status: 500 });

  return NextResponse.json({ approver: row });
}
