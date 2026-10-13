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
 * Gated on RESEND_API_KEY / RESEND_FROM_EMAIL (see .env.example).
 * axiskey.com is now a verified sending domain in Resend (Oct 2026),
 * so RESEND_FROM_EMAIL=ir@axiskey.com actually delivers.
 *
 * The HTML below is the branded template the user supplied directly
 * (Oct 2026) -- a full AxisKey-styled email with inline base64 logos,
 * not the earlier plain-paragraph version. {Recipient Name},
 * {Communication Name}, {Requester Email}, and {Review Link} are its
 * only variable points; everything else (copy, layout, inline CSS,
 * both logo images) is reproduced verbatim as given. Don't hand-edit
 * the markup without the user's own updated HTML -- a rewritten
 * `<table>` nesting it in email clients outside Gmail/Apple
 * Mail/Outlook was not re-tested here.
 *
 * Every send is CC'd to mike@axiskey.com, per explicit instruction
 * while this flow is being tested ("todas las pruebas y correos con
 * copia a este mail") -- not conditional on anything, applies to every
 * approver (saved or one-time). Remove/change MIKE_CC_EMAIL below if
 * this is only meant to be temporary.
 */
const MIKE_CC_EMAIL = "mike@axiskey.com";

function approvalEmailHtml(input: { approverName: string; communicationTitle: string; requestedBy: string; link: string }) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Approval Needed: Investor Communication</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style>
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
  body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #F2F2F2; }

  .headline { font-family: 'Century Gothic', 'Futura', 'Trebuchet MS', Helvetica, Arial, sans-serif; }
  .body-copy { font-family: Helvetica, Arial, sans-serif; }

  a.cta-btn:hover { background-color: #d7ea3a !important; }
  a.link { color: #201C1A; }

  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; }
    .fluid-pad { padding-left: 24px !important; padding-right: 24px !important; }
    .headline-text { font-size: 24px !important; line-height: 30px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F2F2F2;">
<!-- Preheader -->
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#F2F2F2; opacity:0;">
  A new investor communication is waiting on your approval.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F2F2F2;">
  <tr>
    <td align="center" style="padding: 40px 16px;">

      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#FFFFFF;">

        <!-- Top accent rule -->
        <tr>
          <td style="background-color:#E3F464; height:5px; line-height:5px; font-size:0;">&nbsp;</td>
        </tr>

        <!-- Header / Logo -->
        <tr>
          <td class="fluid-pad" style="padding: 40px 48px 8px 48px;">
            <img src="data:image/jpeg;base64,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" width="122" height="45" alt="AXIS" style="display:block; width:122px; height:45px;">
          </td>
        </tr>

        <!-- Eyebrow -->
        <tr>
          <td class="fluid-pad body-copy" style="padding: 28px 48px 0 48px; font-size:12px; line-height:16px; letter-spacing:2px; color:#8C8580; text-transform:uppercase; font-weight:bold;">
            Approval Needed
          </td>
        </tr>

        <!-- Headline -->
        <tr>
          <td class="fluid-pad headline headline-text" style="padding: 10px 48px 0 48px; font-size:28px; line-height:34px; color:#201C1A; font-weight:bold;">
            New Investor Communication Pending Approval
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td class="fluid-pad" style="padding: 22px 48px 0 48px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="border-top:1px solid #F2F2F2; font-size:0; line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td class="fluid-pad body-copy" style="padding: 24px 48px 0 48px; font-size:15px; line-height:24px; color:#4A4642;">
            Hi ${input.approverName},
          </td>
        </tr>

        <!-- Body copy -->
        <tr>
          <td class="fluid-pad body-copy" style="padding: 16px 48px 0 48px; font-size:15px; line-height:24px; color:#4A4642;">
            There's a new investor communication that needs to be approved: <strong style="color:#201C1A;">${input.communicationTitle}</strong>.
          </td>
        </tr>

        <!-- Requested by -->
        <tr>
          <td class="fluid-pad body-copy" style="padding: 14px 48px 0 48px; font-size:15px; line-height:24px; color:#4A4642;">
            Requested by <a href="mailto:${input.requestedBy}" class="link" style="color:#201C1A; font-weight:bold; text-decoration:none;">${input.requestedBy}</a>.
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td class="fluid-pad" align="center" style="padding: 32px 48px 4px 48px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td align="center" style="background-color:#E3F464; border-radius:28px; box-shadow:0 2px 6px rgba(32,28,26,0.18);">
                  <a href="${input.link}" class="cta-btn body-copy" style="display:inline-block; padding:15px 40px; font-size:14px; font-weight:bold; letter-spacing:0.5px; color:#201C1A; text-decoration:none; border-radius:28px;">
                    Review This Communication
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Spacer before footer -->
        <tr>
          <td style="padding-top:44px; font-size:0; line-height:0;">&nbsp;</td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#201C1A; padding: 40px 48px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-bottom:22px;">
                  <img src="data:image/png;base64,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" width="132" height="56" alt="AxisKey" style="display:block; width:132px; height:56px;">
                </td>
              </tr>
              <tr>
                <td class="body-copy" style="font-size:12px; line-height:19px; color:#CEC1A9;">
                  <span style="color:#FFFFFF; font-weight:bold; font-size:13px;">AxisKey Team</span><br>
                  AxisKey Inc<br>
                  20900 NE 30th Ave &nbsp;|&nbsp; Suite 510 &nbsp;|&nbsp; Miami, FL 33180<br>
                  Office: (786) 481-4448<br>
                  <a href="mailto:ir@axiskey.com" class="link" style="color:#E3F464; text-decoration:none;">ir@axiskey.com</a>
                  &nbsp;|&nbsp;
                  <a href="https://axiskey.com" class="link" style="color:#E3F464; text-decoration:none;">axiskey.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

      <!-- Sub-footer / legal -->
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
        <tr>
          <td class="fluid-pad body-copy" align="center" style="padding: 20px 48px 0 48px; font-size:11px; line-height:16px; color:#A6A19B;">
            This email and any information contained herein is intended for the designated recipient and may contain confidential information. Please do not forward or share this message or its contents without authorization.
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

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
        subject: `Approval Needed: ${input.communicationTitle}`,
        html: approvalEmailHtml({
          approverName: input.approverName,
          communicationTitle: input.communicationTitle,
          requestedBy: input.requestedBy,
          link,
        }),
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
