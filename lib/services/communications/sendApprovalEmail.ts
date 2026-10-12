import { getSiteBaseUrl } from "@/lib/orderTracking";
import { sendMailViaGraph } from "./graphMail";

/**
 * Best-effort "a communication needs your approval" email when "Send
 * for approval" is clicked with a chosen approver. Sent through
 * Microsoft Graph (see graphMail.ts) as the real ir@axiskey.com
 * mailbox -- switched from Resend (Oct 2026) specifically to avoid
 * Resend's "verify you own this domain" step, which blocked every
 * real send attempt (axiskey.com was never verified there). Sending
 * through the mailbox the tenant already owns sidesteps that entirely.
 *
 * Links to /communications-review/<reviewToken> -- a standalone,
 * chrome-free page (no admin sidebar, no "back" link) scoped to just
 * this one communication, not the admin UI -- per explicit
 * instruction that clicking the email button should open straight
 * into the review screen with nothing else to navigate.
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
  const link = `${getSiteBaseUrl()}/communications-review/${input.reviewToken}`;

  return sendMailViaGraph({
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
  });
}
