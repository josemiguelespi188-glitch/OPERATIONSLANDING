import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Comment text is required." }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data: existing } = await supabase.from("communications").select("id").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Communication not found." }, { status: 404 });

  const { data: row, error } = await supabase
    .from("communication_comments")
    .insert({ communication_id: id, author: admin.email ?? admin.id, body: text })
    .select("id, author, body, created_at")
    .single();
  if (error || !row) return NextResponse.json({ error: error?.message ?? "Could not add the comment." }, { status: 500 });

  return NextResponse.json({
    comment: { id: row.id, author: row.author, body: row.body, createdAt: row.created_at },
  });
}
