import { NextResponse } from "next/server";
import { sendSupportInquiryEmail } from "@/lib/services/supportInquiry/sendSupportInquiryEmail";

export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated endpoint for the Support Inquiry form
 * (/support-inquiry) -- same trust model as /api/investor-feedback: no
 * admin auth, since the page itself has none either (it's shared
 * directly with coworkers, not gated behind /admin login). There is no
 * Supabase table for this feature at all -- the email this sends IS the
 * record (it triggers AxisKey's own Zendesk email-to-ticket automation
 * on ir@axiskey.com), so unlike other best-effort notification emails
 * in this codebase, a failed send here is returned as a real error.
 */
export async function POST(request: Request) {
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

  return NextResponse.json({ sent: true });
}
