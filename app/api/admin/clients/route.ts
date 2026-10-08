import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

/**
 * The saved client list used by a communication's Recipients section
 * (see CommunicationDetail.tsx) -- a small, reusable address book, not
 * tied to any one communication. Deliberately its own table/endpoint
 * rather than free text per communication, per explicit instruction
 * that client names should "quedarse guardados" (stay saved) for reuse.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("clients").select("id, name").order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ clients: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!name) return NextResponse.json({ error: "Client name is required." }, { status: 400 });

  const supabase = getSupabaseServerClient();

  // Already saved (case-insensitive) -- return the existing row instead
  // of erroring on the unique constraint, so re-adding the same client
  // from a different communication just reuses it.
  const { data: existing } = await supabase.from("clients").select("id, name").ilike("name", name).maybeSingle();
  if (existing) return NextResponse.json({ client: existing });

  const { data: row, error } = await supabase.from("clients").insert({ name }).select("id, name").single();
  if (error || !row) return NextResponse.json({ error: error?.message ?? "Could not add the client." }, { status: 500 });

  return NextResponse.json({ client: row });
}
