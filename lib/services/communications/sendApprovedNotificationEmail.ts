import { getSiteBaseUrl } from "@/lib/orderTracking";

/**
 * Best-effort "this communication was approved" email, sent once a
 * reviewer approves via /communications-review/[token] (see
 * app/api/communications-review/[token]/approve/route.ts). Separate
 * from sendApprovalEmail.ts (the "please approve this" request) --
 * this is the opposite direction, notifying whoever actually builds
 * and launches communications that one just cleared approval and is
 * ready to go out.
 *
 * Recipient is hardcoded to annelise@axiskey.com, per explicit
 * instruction: Annelise owns creating communications and launching
 * them, so she's the one who needs to know the moment something is
 * ready_for_launch. CC'd to mike@axiskey.com "for tests rn" -- same
 * temporary testing CC as sendApprovalEmail.ts's MIKE_CC_EMAIL;
 * remove/change both together once testing is done.
 *
 * Links to the real admin detail page (/admin/communications/[id]),
 * not the public review token -- that token stops resolving the
 * instant status leaves pending_approval (see reviewToken.ts), so by
 * the time this email is sent the review link is already dead; the
 * admin page is what Annelise actually needs to get to the HTML and
 * launch it.
 *
 * Same gating/non-blocking pattern as sendApprovalEmail.ts: a missing
 * RESEND_API_KEY/RESEND_FROM_EMAIL returns {sent: false, error}
 * instead of throwing, so a notification failure never blocks the
 * approval itself.
 */
const ANNELISE_EMAIL = "annelise@axiskey.com";
const MIKE_CC_EMAIL = "mike@axiskey.com";

export async function sendApprovedNotificationEmail(input: {
  communicationId: string;
  communicationTitle: string;
  approvedBy: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { sent: false, error: "RESEND_API_KEY / RESEND_FROM_EMAIL not configured." };
  }

  const link = `${getSiteBaseUrl()}/admin/communications/${input.communicationId}`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: ANNELISE_EMAIL,
        cc: MIKE_CC_EMAIL,
        subject: `Approved: ${input.communicationTitle}`,
        html: `
          <p>Hi Annelise,</p>
          <p><strong>${input.communicationTitle}</strong> has just been approved by ${input.approvedBy} and is ready for launch.</p>
          <p>
            <a href="${link}" style="display:inline-block;padding:12px 24px;background:#201C1A;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
              Open this communication
            </a>
          </p>
        `,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { sent: false, error: `Resend API error ${response.status}: ${body.slice(0, 300)}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "Unknown error sending the email." };
  }
}
