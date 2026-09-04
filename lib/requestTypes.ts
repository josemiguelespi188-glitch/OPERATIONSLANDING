export type RequestTypeSlug =
  | "title-transfer-request"
  | "redemption-request"
  | "ira-funding-request"
  | "refund-request"
  | "side-letter-request"
  | "investor-information-update"
  | "account-maintenance-request"
  | "document-request"
  | "axiskey-report-request";

export interface RequestTypeConfig {
  slug: RequestTypeSlug;
  name: string;
  description: string;
  buttonLabel: string;
}

/**
 * Single source of truth for the operational processes surfaced on the hub.
 * Mirrors the `request_types` table (see supabase/seed.sql) so the UI can
 * render immediately without a network round trip, while submissions still
 * resolve to the matching row server-side. Order here is the order the
 * cards render in on the home page — matches the official form spec's
 * numbering.
 */
export const REQUEST_TYPES: RequestTypeConfig[] = [
  {
    slug: "title-transfer-request",
    name: "Title Transfer Request",
    description: "Submit a title transfer request.",
    buttonLabel: "Open Request",
  },
  {
    slug: "redemption-request",
    name: "Redemption Request",
    description: "Submit an investor redemption request.",
    buttonLabel: "Open Request",
  },
  {
    slug: "ira-funding-request",
    name: "IRA Funding Request",
    description: "Request funds from an IRA custodian.",
    buttonLabel: "Open Request",
  },
  {
    slug: "refund-request",
    name: "Refund Request",
    description: "Request a refund of an investor payment made in error.",
    buttonLabel: "Open Request",
  },
  {
    slug: "side-letter-request",
    name: "Side Letter Request",
    description: "Request the creation of a side letter for an investor.",
    buttonLabel: "Open Request",
  },
  {
    slug: "investor-information-update",
    name: "Investor Information Update",
    description: "Request updates to investor records.",
    buttonLabel: "Open Request",
  },
  {
    slug: "account-maintenance-request",
    name: "Account Maintenance Request",
    description: "General account maintenance requests.",
    buttonLabel: "Open Request",
  },
  {
    slug: "document-request",
    name: "Investor Documentation Request",
    description: "Request outstanding documentation from an investor.",
    buttonLabel: "Open Request",
  },
  {
    slug: "axiskey-report-request",
    name: "Request an AxisKey Report",
    description: "Request a report on investors, orders, or account activity.",
    buttonLabel: "Open Request",
  },
];

export function getRequestType(slug: string): RequestTypeConfig | undefined {
  return REQUEST_TYPES.find((type) => type.slug === slug);
}
