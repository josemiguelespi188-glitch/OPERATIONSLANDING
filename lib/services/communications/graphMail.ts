/**
 * Sends mail through Microsoft Graph as a real AxisKey Microsoft 365
 * mailbox (ir@axiskey.com by default), instead of a third-party email
 * API like Resend. Chosen specifically to avoid Resend's domain
 * verification step: Graph sends through a mailbox the tenant already
 * owns and controls, authenticated as an Azure AD app registration
 * rather than by proving ownership of axiskey.com to an outside
 * service.
 *
 * Auth: OAuth2 client credentials flow (an app-only token, no user
 * sign-in) -- POST to Azure AD's token endpoint with the app's client
 * id/secret, scoped to `https://graph.microsoft.com/.default`. The app
 * registration needs the Microsoft Graph **application** permission
 * `Mail.Send` with admin consent granted; by default that lets it send
 * as *any* mailbox in the tenant, so an Exchange Online "application
 * access policy" scoping it to just MS_GRAPH_SENDER_EMAIL is strongly
 * recommended (see README/CLAUDE.md for the exact Azure setup steps).
 *
 * Gated on MS_GRAPH_TENANT_ID / MS_GRAPH_CLIENT_ID /
 * MS_GRAPH_CLIENT_SECRET (see .env.example) -- same "missing config is
 * not an error" pattern as every other optional integration in this
 * codebase (CLICKUP_API_TOKEN, the old RESEND_* vars this replaces):
 * callers get back {sent: false, error} and decide what to do with it
 * rather than this throwing.
 */
interface GraphSendInput {
  to: string;
  cc?: string;
  subject: string;
  html: string;
}

async function getGraphAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Microsoft Graph auth failed (${response.status}): ${body.slice(0, 300)}`);
  }
  const data = await response.json();
  return data.access_token as string;
}

export async function sendMailViaGraph(input: GraphSendInput): Promise<{ sent: boolean; error?: string }> {
  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;
  const sender = process.env.MS_GRAPH_SENDER_EMAIL || "ir@axiskey.com";

  if (!tenantId || !clientId || !clientSecret) {
    return { sent: false, error: "MS_GRAPH_TENANT_ID / MS_GRAPH_CLIENT_ID / MS_GRAPH_CLIENT_SECRET not configured." };
  }

  try {
    const accessToken = await getGraphAccessToken(tenantId, clientId, clientSecret);

    const message: Record<string, unknown> = {
      subject: input.subject,
      body: { contentType: "HTML", content: input.html },
      toRecipients: [{ emailAddress: { address: input.to } }],
    };
    if (input.cc) {
      message.ccRecipients = [{ emailAddress: { address: input.cc } }];
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { sent: false, error: `Microsoft Graph sendMail error ${response.status}: ${body.slice(0, 300)}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "Unknown error sending the email via Microsoft Graph." };
  }
}
