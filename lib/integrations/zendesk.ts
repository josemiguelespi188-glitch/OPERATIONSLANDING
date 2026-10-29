/**
 * Zendesk integration for the Support Inquiry "previous tickets" panel
 * (app/support-inquiry, Oct 2026). Ticket creation itself is still
 * unchanged -- the form's self-addressed email to ir@axiskey.com keeps
 * triggering AxisKey's own email-to-ticket automation (see
 * sendSupportInquiryEmail.ts) -- this module is only for reading: finding
 * the ticket that automation created, and showing its live status.
 *
 * Authenticated with OAuth 2.0 client credentials, not a Zendesk API
 * token -- Zendesk stopped issuing new API tokens as of Oct 27 2026 (per
 * the admin). The OAuth client itself has to be created by hand in
 * Zendesk Admin Center (Apps and integrations -> APIs -> OAuth clients,
 * "Confidential" kind) -- this app has no way to create it, same as it
 * can't create a ClickUp custom field or register a ClickUp webhook.
 * ZENDESK_OAUTH_CLIENT_ID / ZENDESK_OAUTH_CLIENT_SECRET are env vars
 * only, never committed, same rule as CLICKUP_API_TOKEN.
 *
 * This sandbox's egress proxy only blocks clickup.com (see CLAUDE.md's
 * "Network access from a Claude Code" section) -- zendesk.com itself
 * isn't blocked, but no real OAuth client exists yet to test against, so
 * every function here degrades to a safe empty/null result rather than
 * throwing whenever the env vars are unset or a call fails. Confirm live
 * once the OAuth client is created and the env vars are set on Vercel.
 */

const ZENDESK_STATUS_TOKEN_FIELD_TITLE = "Status Token";

/**
 * The "Status Token" custom field only holds a token (e.g.
 * "6598.3cf142ec36533b9b0895841f816947a4"), not a full URL -- confirmed
 * directly from the admin, who also gave the real hosted status page's
 * URL shape. Hardcoded like CALENDLY_URL elsewhere in this codebase
 * (components/scheduling/ScheduleMeetingView.tsx) since it's a public
 * link shape, not a secret.
 */
const ZENDESK_STATUS_PAGE_BASE_URL = "https://status.axiskey.com/t/";

export interface ZendeskTicket {
  id: number;
  status: string;
  subject: string;
  created_at: string;
  custom_fields: { id: number; value: unknown }[];
}

function getZendeskApiBase(): string | null {
  const subdomain = process.env.ZENDESK_SUBDOMAIN?.trim();
  if (!subdomain) return null;
  return `https://${subdomain}.zendesk.com/api/v2`;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Client-credentials OAuth grant -- this integration acts as the
 * Operation Hub service itself, not as any one logged-in Zendesk agent,
 * so there's no user to redirect through an authorize step. Cached
 * in-memory for the life of the serverless function instance; refetched
 * a little before it actually expires.
 */
async function getZendeskAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const subdomain = process.env.ZENDESK_SUBDOMAIN?.trim();
  const clientId = process.env.ZENDESK_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.ZENDESK_OAUTH_CLIENT_SECRET?.trim();
  if (!subdomain || !clientId || !clientSecret) return null;

  try {
    const response = await fetch(`https://${subdomain}.zendesk.com/oauth/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "read",
      }),
    });
    if (!response.ok) {
      console.error("Zendesk OAuth token request failed:", response.status, await response.text().catch(() => ""));
      return null;
    }
    const body = await response.json();
    if (typeof body.access_token !== "string") return null;

    const expiresInMs = (typeof body.expires_in === "number" ? body.expires_in : 300) * 1000;
    cachedToken = { token: body.access_token, expiresAt: Date.now() + expiresInMs };
    return cachedToken.token;
  } catch (err) {
    console.error("Zendesk OAuth token request error:", err);
    return null;
  }
}

async function zendeskGet(path: string): Promise<unknown | null> {
  const base = getZendeskApiBase();
  const token = await getZendeskAccessToken();
  if (!base || !token) return null;

  try {
    const response = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      console.error("Zendesk API error:", response.status, path, await response.text().catch(() => ""));
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error("Zendesk API request error:", path, err);
    return null;
  }
}

/**
 * Resolves the "Status Token" custom field's live id by its exact title,
 * the same "connect by live name, never a hardcoded id" rule this
 * codebase already applies to ClickUp fields -- a field can be renamed
 * with zero warning, and the admin only gave us the field's name and a
 * sample value, not its id. Called fresh on every list request rather
 * than cached across requests, same reasoning.
 */
export async function fetchTicketFieldIdByTitle(title: string): Promise<number | null> {
  const body = (await zendeskGet(`/ticket_fields.json?per_page=100`)) as
    | { ticket_fields?: { id: number; title?: string; raw_title?: string }[] }
    | null;
  if (!body?.ticket_fields) return null;

  const match = body.ticket_fields.find(
    (f) => (f.title ?? f.raw_title ?? "").trim().toLowerCase() === title.trim().toLowerCase()
  );
  return match?.id ?? null;
}

export function fetchStatusTokenFieldId(): Promise<number | null> {
  return fetchTicketFieldIdByTitle(ZENDESK_STATUS_TOKEN_FIELD_TITLE);
}

/**
 * Finds the ticket Zendesk's email-to-ticket automation created for a
 * given Support Inquiry submission. There's no direct link between "we
 * sent this email" and "this is the resulting ticket" -- the automation
 * runs entirely on Zendesk's side -- so this matches by requester email
 * and a created-on-or-after date, newest first, and the caller picks the
 * best candidate (closest to the submission time). Zendesk's search
 * `created>` operator is date-granular, not timestamp-granular, so
 * `submittedOnOrAfter` should already be a plain YYYY-MM-DD.
 */
export async function searchTicketsByRequesterEmail(
  email: string,
  submittedOnOrAfter: string
): Promise<ZendeskTicket[]> {
  const query = `type:ticket requester:"${email}" created>=${submittedOnOrAfter}`;
  const body = (await zendeskGet(`/search.json?query=${encodeURIComponent(query)}&sort_by=created_at&sort_order=desc`)) as
    | { results?: ZendeskTicket[] }
    | null;
  return body?.results ?? [];
}

/** Batch live read, used to refresh every already-resolved ticket's status + Status Token in one call. */
export async function fetchTicketsByIds(ids: number[]): Promise<ZendeskTicket[]> {
  if (ids.length === 0) return [];
  const body = (await zendeskGet(`/tickets/show_many.json?ids=${ids.join(",")}`)) as
    | { tickets?: ZendeskTicket[] }
    | null;
  return body?.tickets ?? [];
}

export function getStatusTokenValue(ticket: ZendeskTicket, fieldId: number): string | null {
  const field = ticket.custom_fields?.find((f) => f.id === fieldId);
  return typeof field?.value === "string" && field.value ? field.value : null;
}

export function buildStatusPageUrl(token: string): string {
  return `${ZENDESK_STATUS_PAGE_BASE_URL}${token}`;
}
