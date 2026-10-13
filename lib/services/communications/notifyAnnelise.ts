import { getSiteBaseUrl } from "@/lib/orderTracking";

/**
 * Best-effort "something happened on a communication you're reviewing"
 * email to Annelise -- she owns creating communications and launching
 * them, so she needs to know about every action that happens on the
 * public /communications-review/[token] page, not just approvals:
 * comments posted there, changes requested, and the approval itself
 * all call this (see the three route handlers under
 * app/api/communications-review/[token]/). CC'd to mike@axiskey.com
 * "for tests rn" per explicit instruction -- same temporary testing CC
 * as sendApprovalEmail.ts's MIKE_CC_EMAIL; remove/change both together
 * once testing is done.
 *
 * Links to the real admin page (/admin/communications/[id]), not the
 * public review token -- a comment or "request changes" doesn't
 * invalidate the token (only approve does, since that's the only
 * action that moves status off pending_approval... except request-
 * changes also moves it off pending_approval, so by the time this
 * fires for that action the token is already dead too), and either
 * way the admin page is what Annelise actually needs to act on it.
 *
 * Same gating/non-blocking pattern as every other email in this
 * codebase: a missing RESEND_API_KEY/RESEND_FROM_EMAIL returns
 * {sent: false, error} instead of throwing, so a notification failure
 * never blocks the underlying action (posting the comment, requesting
 * changes, or approving).
 */
const ANNELISE_EMAIL = "annelise@axiskey.com";
const MIKE_CC_EMAIL = "mike@axiskey.com";

export async function notifyAnnelise(input: {
  communicationId: string;
  communicationTitle: string;
  subject: string;
  message: string;
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
        subject: input.subject,
        html: `
          <p>Hi Annelise,</p>
          <p>${input.message}</p>
          <p><strong>${input.communicationTitle}</strong></p>
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
