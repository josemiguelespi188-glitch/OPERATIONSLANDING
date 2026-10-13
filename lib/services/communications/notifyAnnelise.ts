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
 * Branded with the same AxisKey template shell as sendApprovalEmail.ts
 * (Oct 2026) -- the original plain unstyled version was explicitly
 * rejected ("no me gusta este formato. hazle parecido al mail de
 * request for approval"). Reuses the exact same two hosted logo files
 * (public/email/approval-header-axis-logo.jpg,
 * public/email/approval-footer-axiskey-logo.png) referenced by public
 * HTTPS URL, never base64 -- see sendApprovalEmail.ts's module doc
 * comment for why (Outlook desktop silently refuses to render
 * base64-embedded <img> sources). Eyebrow/headline/intro/quote are the
 * only things that vary per action (approve has no quote; comment and
 * request-changes both quote the actual text).
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

function notificationEmailHtml(input: {
  baseUrl: string;
  eyebrow: string;
  headline: string;
  introHtml: string;
  quoteHtml?: string;
  link: string;
}) {
  const { baseUrl } = input;
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${input.headline}</title>
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
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#F2F2F2; opacity:0;">
  ${input.headline}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F2F2F2;">
  <tr>
    <td align="center" style="padding: 40px 16px;">

      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#FFFFFF;">

        <tr>
          <td style="background-color:#E3F464; height:5px; line-height:5px; font-size:0;">&nbsp;</td>
        </tr>

        <tr>
          <td class="fluid-pad" style="padding: 40px 48px 8px 48px;">
            <img src="${baseUrl}/email/approval-header-axis-logo.jpg" width="122" height="45" alt="AXIS" style="display:block; width:122px; height:45px;">
          </td>
        </tr>

        <tr>
          <td class="fluid-pad body-copy" style="padding: 28px 48px 0 48px; font-size:12px; line-height:16px; letter-spacing:2px; color:#8C8580; text-transform:uppercase; font-weight:bold;">
            ${input.eyebrow}
          </td>
        </tr>

        <tr>
          <td class="fluid-pad headline headline-text" style="padding: 10px 48px 0 48px; font-size:28px; line-height:34px; color:#201C1A; font-weight:bold;">
            ${input.headline}
          </td>
        </tr>

        <tr>
          <td class="fluid-pad" style="padding: 22px 48px 0 48px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="border-top:1px solid #F2F2F2; font-size:0; line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="fluid-pad body-copy" style="padding: 24px 48px 0 48px; font-size:15px; line-height:24px; color:#4A4642;">
            Hi Annelise,
          </td>
        </tr>

        <tr>
          <td class="fluid-pad body-copy" style="padding: 16px 48px 0 48px; font-size:15px; line-height:24px; color:#4A4642;">
            ${input.introHtml}
          </td>
        </tr>

        ${
          input.quoteHtml
            ? `<tr>
          <td class="fluid-pad" style="padding: 16px 48px 0 48px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F6F4F0; border-radius:8px;">
              <tr>
                <td class="body-copy" style="padding: 16px 20px; font-size:14px; line-height:22px; color:#4A4642;">
                  ${input.quoteHtml}
                </td>
              </tr>
            </table>
          </td>
        </tr>`
            : ""
        }

        <tr>
          <td class="fluid-pad" align="center" style="padding: 32px 48px 4px 48px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td align="center" style="background-color:#E3F464; border-radius:28px; box-shadow:0 2px 6px rgba(32,28,26,0.18);">
                  <a href="${input.link}" class="cta-btn body-copy" style="display:inline-block; padding:15px 40px; font-size:14px; font-weight:bold; letter-spacing:0.5px; color:#201C1A; text-decoration:none; border-radius:28px;">
                    Open This Communication
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding-top:44px; font-size:0; line-height:0;">&nbsp;</td>
        </tr>

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

export async function notifyAnnelise(input: {
  communicationId: string;
  communicationTitle: string;
  subject: string;
  eyebrow: string;
  headline: string;
  introHtml: string;
  quoteHtml?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { sent: false, error: "RESEND_API_KEY / RESEND_FROM_EMAIL not configured." };
  }

  const baseUrl = getSiteBaseUrl();
  const link = `${baseUrl}/admin/communications/${input.communicationId}`;

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
        html: notificationEmailHtml({
          baseUrl,
          eyebrow: input.eyebrow,
          headline: input.headline,
          introHtml: input.introHtml,
          quoteHtml: input.quoteHtml,
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
