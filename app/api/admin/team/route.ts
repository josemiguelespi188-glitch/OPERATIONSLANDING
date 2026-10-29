import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

/**
 * Lists everyone with access to /admin (admin_users). Any active admin
 * can view and manage this list -- the `role` column already supports
 * 'admin'/'super_admin' at the schema level, but nothing in this app
 * reads it to gate anything (confirmed before building this page), so
 * Team management stays on the same flat requireAdmin() check as every
 * other /admin/* route rather than introducing a new permission tier
 * that could lock the current admin out of their own invite flow.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, email, full_name, role, is_active, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    members: (data ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
    })),
  });
}
