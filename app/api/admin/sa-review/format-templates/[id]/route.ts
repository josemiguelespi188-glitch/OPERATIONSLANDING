import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body?.isActive !== true) {
    return NextResponse.json({ error: "Only activating a template is supported here." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  await supabase.from("sa_format_templates").update({ is_active: false }).eq("is_active", true);

  const { error } = await supabase.from("sa_format_templates").update({ is_active: true }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: template } = await supabase
    .from("sa_format_templates")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (template) {
    await supabase.storage.from("sa-format-templates").remove([template.storage_path]);
  }

  const { error } = await supabase.from("sa_format_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
