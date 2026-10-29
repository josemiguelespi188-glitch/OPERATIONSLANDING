import { NextResponse } from "next/server";
import { sendSupportInquiryEmail } from "@/lib/services/supportInquiry/sendSupportInquiryEmail";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/adminAuth";

export const dynamic = "force-dynamic";

/**
 * Requires the same login as the rest of /admin/* (Oct 2026, per
 * explicit instruction: "esta pagina debe tener acceso unicamente con
 * el autenticador") -- /support-inquiry used to be a no-login public
 * tool, deliberately reversed. The email this sends is still what
 * creates AxisKey's Zendesk ticket (an email-to-ticket automation on
 * ir@axiskey.com, outside this app), so a failed send is returned as a
 * real error -- the support_inquiries insert below is purely
 * best-effort on top of that: if it fails, the inquiry has still gone
 * out and reached IR, so the user-facing submission still succeeds.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const investorName = typeof body?.investorName === "string" ? body.investorName.trim().slice(0, 200) : "";
  const investorEmail = typeof body?.investorEmail === "string" ? body.investorEmail.trim().slice(0, 200) : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim().slice(0, 50) : "";
  const subject = typeof body?.subject === "string" ? body.subject.trim().slice(0, 200) : "";
  const detail = typeof body?.detail === "string" ? body.detail.trim().slice(0, 5000) : "";

  if (!investorName || !investorEmail || !subject || !detail) {
    return NextResponse.json(
      { error: "Investor name, email, subject, and detail are required." },
      { status: 400 }
    );
  }

  const result = await sendSupportInquiryEmail({ investorName, investorEmail, phone, subject, detail });
  if (!result.sent) {
    console.error("Failed to send support inquiry email:", result.error);
    return NextResponse.json(
      { error: "Could not send this inquiry right now. Please try again or email ir@axiskey.com directly." },
      { status: 502 }
    );
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("support_inquiries").insert({
      owner_email: admin.email ?? "unknown",
      investor_name: investorName,
      investor_email: investorEmail,
      phone: phone || null,
      subject,
      detail,
    });
    if (error) console.error("Failed to record support inquiry for the previous-tickets panel:", error.message);
  } catch (err) {
    console.error("Failed to record support inquiry for the previous-tickets panel:", err);
  }

  return NextResponse.json({ sent: true });
}
