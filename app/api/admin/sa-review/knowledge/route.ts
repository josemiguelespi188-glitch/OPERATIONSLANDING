import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sa_skill_knowledge")
    .select("id, title, content, is_active, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    entries: (data ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      content: e.content,
      isActive: e.is_active,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!title || !content) {
    return NextResponse.json({ error: "title and content are required." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: entry, error } = await supabase
    .from("sa_skill_knowledge")
    .insert({ title, content, created_by: admin.id })
    .select("id")
    .single();

  if (error || !entry) {
    return NextResponse.json({ error: error?.message ?? "Failed to save the entry." }, { status: 500 });
  }

  return NextResponse.json({ id: entry.id });
}
