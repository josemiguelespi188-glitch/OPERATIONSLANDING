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
 * (Oct 2026) -- a full AxisKey-styled email with the two logo images,
 * not the earlier plain-paragraph version. {Recipient Name},
 * {Communication Name}, {Requester Email}, and {Review Link} are its
 * only variable points; everything else (copy, layout, inline CSS) is
 * reproduced verbatim as given. Don't hand-edit the markup without the
 * user's own updated HTML -- a rewritten `<table>` nesting it in email
 * clients outside Gmail/Apple Mail/Outlook was not re-tested here.
 *
 * The user's original HTML had both logos embedded as base64 `data:`
 * URIs. **Outlook desktop (the Word-based rendering engine on
 * Windows) refuses to render base64-embedded `<img>` sources at
 * all** -- confirmed live (Oct 2026): the header/footer logos showed
 * as broken-image icons in a real Outlook inbox even though the rest
 * of the email rendered fine. Fixed by extracting both images to real
 * files (`public/email/approval-header-axis-logo.jpg`,
 * `public/email/approval-footer-axiskey-logo.png`, decoded verbatim
 * from the original base64, pixel-for-pixel identical) and
 * referencing them by their public HTTPS URL
 * (`${getSiteBaseUrl()}/email/...`) instead -- every mainstream email
 * client, including Outlook, renders a normal hosted `<img src>` to
 * fine. Don't go back to inline base64 for email images in this
 * codebase.
 *
 * Every send is CC'd to mike@axiskey.com, per explicit instruction
 * while this flow is being tested ("todas las pruebas y correos con
 * copia a este mail") -- not conditional on anything, applies to every
 * approver (saved or one-time). Remove/change MIKE_CC_EMAIL below if
 * this is only meant to be temporary.
 */
const MIKE_CC_EMAIL = "mike@axiskey.com";

function approvalEmailHtml(input: { approverName: string; communicationTitle: string; requestedBy: string; link: string; baseUrl: string }) {
  const { baseUrl } = input;
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
            <img src="${baseUrl}/email/approval-header-axis-logo.jpg" width="122" height="45" alt="AXIS" style="display:block; width:122px; height:45px;">
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
                  <img src="${baseUrl}/email/approval-footer-axiskey-logo.png" width="132" height="56" alt="AxisKey" style="display:block; width:132px; height:56px;">
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

  const baseUrl = getSiteBaseUrl();
  const link = `${baseUrl}/communications-review/${input.reviewToken}`;

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
          baseUrl,
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
