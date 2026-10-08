import { getSiteBaseUrl } from "@/lib/orderTracking";

/**
 * Best-effort "a communication needs your approval" email, sent via
 * Resend's plain REST API (a single fetch call, no SDK -- consistent
 * with how this codebase already talks to ClickUp) when "Send for
 * approval" is clicked with a chosen approver.
 *
 * Gated on RESEND_API_KEY / RESEND_FROM_EMAIL (see .env.example) --
 * this codebase otherwise has no email-sending integration at all
 * (confirmed before building this). Exactly like CLICKUP_API_TOKEN
 * missing elsewhere in this app, a missing key here is not an error:
 * the status transition and the rest of the app work either way, the
 * approver just doesn't get an email and has to be told to check
 * /admin/communications directly until a key is configured.
 */
export async function sendApprovalRequestEmail(input: {
  communicationId: string;
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
        to: input.approverEmail,
        subject: `Approval needed: ${input.communicationTitle}`,
        html: `
          <p>Hi ${input.approverName},</p>
          <p>${input.requestedBy} sent a communication for your approval: <strong>${input.communicationTitle}</strong>.</p>
          <p><a href="${link}">Review it in the Operations Hub</a></p>
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
