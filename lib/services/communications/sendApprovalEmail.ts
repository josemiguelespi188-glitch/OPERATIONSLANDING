import { getSiteBaseUrl } from "@/lib/orderTracking";

/**
 * Best-effort "a communication needs your approval" email, sent via
 * Resend's plain REST API (a single fetch call, no SDK -- consistent
 * with how this codebase already talks to ClickUp) when "Send for
 * approval" is clicked with a chosen approver.
 *
 * Links to /communications-review/<reviewToken> -- a standalone,
 * chrome-free page (no admin sidebar, no "back" link) scoped to just
 * this one communication, not the admin UI -- per explicit
 * instruction that clicking the email button should open straight
 * into the review screen with nothing else to navigate.
 *
 * Gated on RESEND_API_KEY / RESEND_FROM_EMAIL (see .env.example) --
 * this codebase otherwise has no email-sending integration at all
 * (confirmed before building this). Exactly like CLICKUP_API_TOKEN
 * missing elsewhere in this app, a missing key here is not an error:
 * the status transition and the rest of the app work either way, the
 * approver just doesn't get an email and has to be told to check
 * /admin/communications directly until a key is configured.
 *
 * Every send is CC'd to mike@axiskey.com, per explicit instruction
 * while this flow is being tested ("todas las pruebas y correos con
 * copia a este mail") -- not conditional on anything, applies to every
 * approver (saved or one-time). Remove/change MIKE_CC_EMAIL below if
 * this is only meant to be temporary.
 */
const MIKE_CC_EMAIL = "mike@axiskey.com";

export async function sendApprovalRequestEmail(input: {
  reviewToken: string;
  communicationTitle: string;
  approverName: string;
  approverEmail: string;
  requestedBy: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { sent: false, error: "RESEND_API_KEY / RESEND_FROM_EMAIL not configured." };
  }

  const link = `${getSiteBaseUrl()}/communications-review/${input.reviewToken}`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.approverEmail,
        cc: MIKE_CC_EMAIL,
        subject: `Approval needed: ${input.communicationTitle}`,
        html: `
          <p>Hi ${input.approverName},</p>
          <p>There's a new investor communication that needs to be approved: <strong>${input.communicationTitle}</strong>.</p>
          <p>Requested by ${input.requestedBy}.</p>
          <p>
            <a href="${link}" style="display:inline-block;padding:12px 24px;background:#201C1A;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
              Review this communication
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
