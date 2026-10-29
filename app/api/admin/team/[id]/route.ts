import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

/**
 * Deactivating here only flips admin_users.is_active -- requireAdmin()
 * already checks that flag on every admin API call, so this is enough
 * to cut off access immediately without touching the person's Supabase
 * Auth account at all (no deletion, easy to reverse by toggling back).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive (boolean) is required." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("admin_users").update({ is_active: body.isActive }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/**
 * Permanently removes a team member, unlike PATCH above (Oct 2026, per
 * explicit request: "necesitamos poder borrar los usuarios no solo
 * dessactivar"). Deletes the real Supabase Auth user
 * (`auth.admin.deleteUser`) rather than just the admin_users row --
 * admin_users.id has `references auth.users(id) on delete cascade`
 * (migration 002), so that one call also removes the admin_users row
 * automatically; deleting only the admin_users row would have left a
 * live Auth account (same end state as deactivating, not deleting). A
 * signed-in admin can't delete their own account from here, to avoid
 * locking everyone out of /admin/team by accident -- they'd need
 * another active admin, or the Supabase dashboard, to do that.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
