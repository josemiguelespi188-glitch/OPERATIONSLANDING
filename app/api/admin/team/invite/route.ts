import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";
import { getSiteBaseUrl } from "@/lib/orderTracking";

export const dynamic = "force-dynamic";

/**
 * Invites a new coworker into the Operations Hub admin (Oct 2026). Uses
 * Supabase Auth's own invite flow (auth.admin.inviteUserByEmail, Admin
 * API -- needs the service-role client) rather than a hand-rolled token
 * table: Supabase already generates a single-use, expiring link and
 * handles the "click link -> get a session -> set a password" dance
 * securely, so there's no reason to re-build that here. The invite
 * email's actual delivery/branding is configured entirely in the
 * Supabase dashboard (custom SMTP via Resend so it sends from
 * ir@axiskey.com, plus the email template itself) -- this app has no
 * way to set that from code, same as it can't create a ClickUp custom
 * field or a Zendesk OAuth client. See CLAUDE.md's "Team invites"
 * section for the exact one-time setup steps.
 *
 * redirectTo points at /accept-invite (a standalone page, no PageShell/
 * admin-layout gate -- same convention as /rate-your-experience), which
 * Supabase appends the session tokens to on click; that page is what
 * actually lets the invitee set their password.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 200) : "";
  const role = body.role === "super_admin" ? "super_admin" : "admin";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
    redirectTo: `${getSiteBaseUrl()}/accept-invite`,
  });

  if (inviteError || !invited.user) {
    return NextResponse.json(
      { error: inviteError?.message ?? "Could not send the invite." },
      { status: 500 }
    );
  }

  const { error: insertError } = await supabase.from("admin_users").insert({
    id: invited.user.id,
    email,
    full_name: fullName || null,
    role,
    is_active: true,
  });

  if (insertError) {
    return NextResponse.json(
      {
        error: `Invite email was sent, but could not grant admin access: ${insertError.message}. The invitee can sign in but won't pass the admin check until this is fixed.`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: invited.user.id });
}
