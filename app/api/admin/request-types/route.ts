import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseServerClient();

  const { data: types, error } = await supabase
    .from("request_types")
    .select(
      "id, slug, name, description, sort_order, is_active, is_locked, uses_dynamic_form, button_label, icon"
    )
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: fieldRows } = await supabase.from("request_fields").select("request_type_id");
  const counts: Record<string, number> = {};
  for (const row of fieldRows ?? []) {
    counts[row.request_type_id] = (counts[row.request_type_id] ?? 0) + 1;
  }

  return NextResponse.json({
    requestTypes: (types ?? []).map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      sortOrder: t.sort_order,
      isActive: t.is_active,
      isLocked: t.is_locked,
      usesDynamicForm: t.uses_dynamic_form,
      buttonLabel: t.button_label,
      icon: t.icon,
      fieldCount: counts[t.id] ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const baseSlug = slugify(body.name);
  if (!baseSlug) {
    return NextResponse.json(
      { error: "Name must contain at least one letter or number." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  let slug = baseSlug;
  for (let i = 2; i < 50; i++) {
    const { data: clash } = await supabase
      .from("request_types")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${i}`;
  }

  const { data: maxSortRow } = await supabase
    .from("request_types")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: inserted, error } = await supabase
    .from("request_types")
    .insert({
      slug,
      name: body.name.trim(),
      description: body.description?.trim() ?? "",
      button_label: body.buttonLabel?.trim() || "Open Request",
      sort_order: (maxSortRow?.sort_order ?? 0) + 1,
      is_active: false,
      is_locked: false,
      uses_dynamic_form: true,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create request type." },
      { status: 500 }
    );
  }

  await supabase.from("form_activity_log").insert({
    request_type_id: inserted.id,
    actor_id: admin.id,
    action: "request_type_created",
    metadata: { name: body.name },
  });

  return NextResponse.json({ id: inserted.id, slug });
}
