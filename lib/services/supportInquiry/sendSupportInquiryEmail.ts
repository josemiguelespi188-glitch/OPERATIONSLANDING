/**
 * Sends the "Support Inquiry" form's submission straight to IR, via
 * Resend's plain REST API (same pattern as
 * lib/services/communications/sendApprovalEmail.ts -- a single fetch,
 * no SDK). Unlike every other email in this codebase, this one IS the
 * entire mechanism: the form has no Supabase table backing it at all
 * (per explicit product decision -- the resulting Zendesk ticket,
 * created automatically by AxisKey's own email-to-ticket integration on
 * ir@axiskey.com, is the system of record), so a failed send here is
 * surfaced as a real submission failure to the caller rather than
 * swallowed best-effort the way a secondary notification email
 * elsewhere in this app would be.
 *
 * Sent FROM and TO ir@axiskey.com on purpose (RESEND_FROM_EMAIL,
 * already verified in Resend -- see CLAUDE.md's Communications
 * Calendar section) -- a self-addressed email is what triggers
 * AxisKey's Zendesk email-to-ticket automation on that inbox.
 */
export async function sendSupportInquiryEmail(input: {
  investorName: string;
  investorEmail: string;
  phone: string;
  subject: string;
  detail: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { sent: false, error: "RESEND_API_KEY / RESEND_FROM_EMAIL not configured." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: from,
        reply_to: input.investorEmail,
        subject: `Support Inquiry: ${input.subject}`,
        html: inquiryEmailHtml(input),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { sent: false, error: `Resend API error ${response.status}: ${body.slice(0, 300)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "Unknown error sending email." };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inquiryEmailHtml(input: {
  investorName: string;
  investorEmail: string;
  phone: string;
  subject: string;
  detail: string;
}): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#6b6460;font-size:13px;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:4px 0;color:#201c1a;font-size:13px;">${escapeHtml(value)}</td></tr>`;

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#F5F1E9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr><td style="background:#201c1a;padding:18px 24px;">
      <span style="color:#ffffff;font-size:12px;letter-spacing:1px;text-transform:uppercase;">AxisKey Operations Hub</span>
      <h1 style="margin:4px 0 0;color:#ffffff;font-size:18px;">New Support Inquiry</h1>
    </td></tr>
    <tr><td style="padding:20px 24px;">
      <table role="presentation" width="100%">
        ${row("Investor", input.investorName)}
        ${row("Email", input.investorEmail)}
        ${input.phone ? row("Phone", input.phone) : ""}
        ${row("Subject", input.subject)}
      </table>
      <p style="margin:16px 0 4px;color:#6b6460;font-size:13px;">Detail</p>
      <p style="margin:0;color:#201c1a;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(input.detail)}</p>
    </td></tr>
  </table>
</body>
</html>`;
}
