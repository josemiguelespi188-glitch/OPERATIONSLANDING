# AxisKey Operations Hub — project notes

Internal request-intake app (Next.js + Supabase) that syncs submissions to
ClickUp tasks. See README.md for the full architecture; this file holds
facts that don't belong in code comments but matter for future work here.

## ClickUp workspace layout

Team/workspace id: `9011712515`. Space: **Investor Relations**. Folder:
**Axis Operations Hub**. Confirmed List IDs, one per request type slug —
keep this in sync with `CLICKUP_LIST_ID_MAP` wherever that env var is
actually set (see below). `custom-request` was removed from the Hub
(Aug 2026) and no longer has a slug, page, or list mapping at all.

| slug | ClickUp List | List ID |
|---|---|---|
| `title-transfer-request` | Title Transfer Requests | `901114002885` |
| `redemption-request` | Redemptions Requests | `901114014583` |
| `ira-funding-request` | IRA Funding Request | `901112504693` |
| `refund-request` | Refund Request | `901114418101` |
| `side-letter-request` | Side Letter Requests | `901114320630` |
| `investor-information-update` | Investor Information Update | `901114375425` |
| `account-maintenance-request` | Account Maintenance Request | `901114375429` |
| `document-request` | Investor Documentation Request (renamed from "Document Request") | `901114375430` |
| `axiskey-report-request` | Request an AxisKey Report | `901114375435` |

Full JSON for `CLICKUP_LIST_ID_MAP` (see `.env.example`):
```json
{"title-transfer-request":"901114002885","redemption-request":"901114014583","ira-funding-request":"901112504693","refund-request":"901114418101","side-letter-request":"901114320630","investor-information-update":"901114375425","account-maintenance-request":"901114375429","document-request":"901114375430","axiskey-report-request":"901114375435"}
```

**This is an env var only — it is never committed to the repo.** It's set
on Vercel. `refund-request` is new (Aug 2026) — confirm it's been added
to the live Vercel value, since it was added to this table after the
original 8 went live. The same "env var only" rule applies to
`CLICKUP_API_TOKEN`.

Per-list custom field IDs (`CUSTOM_FIELD_MAP` / `ATTACHMENT_FIELD_MAP` in
`lib/integrations/clickup.ts`) were re-verified in full against a
read-only field dump (`scripts/clickup/audit-fields.mjs`, distinct from
the create-if-missing `provision-forms.mjs`) in Sept 2026, against
`AxisKey_Operations_Hub_Forms_Spec.md`'s Field Name column (the literal
ClickUp field name for each question). That audit found:

- **"Requester Email" vs "Client/Capital Raiser Email"** — two different
  fields exist on almost every list; the spec calls for "Client/Capital
  Raiser Email" specifically, but every form was wired to "Requester
  Email" instead. Fixed everywhere.
- **The shared "Note" field (`42b9ef7f...`) had briefly disappeared from
  ClickUp**, so every form pointing `notes` at it was failing silently.
  The user manually restored it (as Long Text) on `redemption-request`,
  `side-letter-request`, `account-maintenance-request`,
  `document-request`, and `axiskey-report-request` — all wired to
  `42b9ef7f...` now. `side-letter-request` also has a second, unrelated
  "Note" field (Short Text, `5cd3b348...`) — deliberately not used;
  consider deleting it in ClickUp to avoid future mixups.
- `investor-information-update` already has its own "Information to
  Update" field for this role (not a generic "Note") — wired correctly.
- `side-letter-request` and `redemption-request`'s "Order Number" was
  pointing at an id (`dd1e7aa6...`) that doesn't exist on any list —
  fixed to the real shared "Order Number" field.
- **"Offering Name" is now a single field shared across every list**
  (`3a84a910...`) — a second one (`c438a21a...`) that
  `side-letter-request`, `investor-information-update`, and
  `axiskey-report-request` used to point at no longer exists (apparently
  consolidated in ClickUp). Fixed all 3 to the surviving shared field.
- `axiskey-report-request`: "Date Range" is its own real field, separate
  from the older unused "Report Period" field this used to point at —
  fixed. The dropdown with the current option set (All Investors
  Accounts, etc.) is confusingly named **"Report Type-"** (trailing
  hyphen) in ClickUp, not "Report Type" — an old "Report Type" field
  with outdated options also still exists on the same list, unused now.
  Consider renaming "Report Type-" -> "Report Type" and deleting the old
  one in ClickUp.
- `title-transfer-request` and `account-maintenance-request` each have
  **two different fields both literally named "Investor Email"** —
  wired to whichever one is shared consistently across every other list;
  consider deleting the duplicate in ClickUp.

Every field on every one of the 9 forms is now wired to a confirmed,
currently-existing ClickUp field (verified against a live
`audit-fields.mjs` run) except `axiskey-report-request`'s old, unused
"Report Type" and "Report Period" fields, which are intentionally left
unwired.

Two ClickUp fields with the same name are not necessarily the same
field, and a field can vanish from ClickUp without any code change here
noticing (no error, just a silent no-op) — never assume a field ID still
applies without confirming it live. `scripts/clickup/audit-fields.mjs`
is the safe way to check (read-only, lists every field that actually
exists on all 9 lists); use `provision-forms.mjs` only when a field
genuinely needs to be created (it matches by exact name, so a
near-miss name creates an unwanted duplicate instead of finding the
real field).

## Network access from a Claude Code (web/remote) session

This repo is frequently worked on from a sandboxed remote session whose
egress proxy blocks the entire `clickup.com` domain (`api.clickup.com` and
`app.clickup.com` both return "Host not in allowlist" — an org policy, not
something to retry or route around). Don't spend time trying to call the
ClickUp API or open a ClickUp link directly from such a session — ask the
user for List/field IDs instead, or hand them
`scripts/clickup/provision-forms.mjs` to run from a machine with real
internet access.

## Locked (code-driven) forms

The forms under `app/forms/<slug>/page.tsx` — all 9 current request
types (`title-transfer-request`, `redemption-request`,
`ira-funding-request`, `refund-request`, `side-letter-request`,
`investor-information-update`, `account-maintenance-request`,
`document-request`, `axiskey-report-request`) — are all "locked" in the
`request_types` table (`is_locked = true`): their field structure, types,
and ClickUp mapping live in code (`lib/formSpecs/<slug>.ts`), not the
database. An admin can still edit each field's label/description/required
state and add brand-new questions from `/admin/forms/<id>` — see
`lib/dynamicForms/fieldConfigBridge.ts` for how DB overrides merge onto
the code spec, both for the public page and the admin editor. Changes
there apply to the live public form immediately (each page fetches
overrides server-side on every request — `export const dynamic =
"force-dynamic"`).

`supabase/seed.sql` is the source of truth for the `request_types` table
(name, description, sort order, is_locked) — it's idempotent
(`on conflict (slug) do update`), but has to be re-run manually in the
Supabase SQL editor after it changes in the repo; nothing applies it
automatically.

**The paragraph shown under a form's title always comes from
`request_types.description` (seed.sql), never from the FormSpec's
`descriptionParagraphs`** (`app/forms/<slug>/page.tsx` passes
`overrides.description ? [overrides.description] : spec.descriptionParagraphs`,
and `loadFormOverrides()` returns that DB column's value for every
existing row, seeded or admin-edited alike — there's no way to tell
"never customized" from "admin deliberately set this"). A FormSpec's own
`descriptionParagraphs` only renders if the `request_types` row is
somehow missing entirely, which doesn't happen for any of the 9 locked
slugs. So editing `descriptionParagraphs` in `lib/formSpecs/<slug>.ts`
alone will NOT change what's live; edit the row in `seed.sql` (and
re-run it in the Supabase SQL editor, or edit the row directly from
`/admin/forms/<id>`) instead.

## Order Tracking ("Track Your Investment")

A standalone, investor-facing order status page linked from automatic
investor emails. Built against the real **Payment Received Orders**
ClickUp list (`901113961474`, Investor Relations space, a sibling of the
Axis Operations Hub folder, not inside it) — distinct from the simpler
**Pending Orders** list (`901113950429`), which this feature does not
read from.

- `GET /order-tracking/[token]` (`app/order-tracking/[token]/page.tsx` +
  `components/orderTracking/OrderTrackingView.tsx`) is the public page.
  Like `/rate-your-experience`, it has no `PageShell`/`Sidebar` and no
  auth guard.
- The `token` is an opaque, server-generated random value (32 bytes,
  base64url) with no relation to the ClickUp task id. It's looked up via
  `order_tracking_links` (`supabase/migrations/006_order_tracking_links.sql`),
  a table with RLS enabled and **no policies at all** — stricter than
  every other table in this app, since it must only ever be read through
  the service-role client (`GET /api/order-tracking/[token]`).
- Links are generated **fully automatically**, with no manual ops work:
  `app/api/webhooks/clickup-order-tracking/route.ts` listens for
  `taskCreated`/`taskUpdated` on that list, creates a token the first time
  a task is seen (confirmed against the live task's `list.id`, regardless
  of how the webhook itself ended up scoped in ClickUp), and never
  regenerates it afterward.
- `GET /api/order-tracking/[token]` fetches the ClickUp task **live** on
  every request (`fetchClickUpTask` in `lib/integrations/clickup.ts`) and
  computes a view model in `lib/orderTracking.ts` — never cached beyond
  the token -> `clickup_task_id` mapping itself.
- Field decoding in `lib/orderTracking.ts` (`ORDER_TRACKING_FIELD_IDS`)
  was confirmed against live ClickUp data (`clickup_get_custom_fields` +
  two real sample tasks), not guessed: every status checkbox on this list
  means "checked = problem/pending" (e.g. `isKyccomplete` is really "KYC
  INCOMPLETE?"); `accountTypeName`/`dealTypeId` are dropdowns whose stored
  value is the option's numeric `orderindex`, not its UUID.
- Per product decision, for a **terminal** order (ClickUp status
  `completed orders`, `canceled orders`, or `close`) the native Status
  column is authoritative over any individual checkbox — those can be
  stale on older orders (confirmed via live data) and must never flip a
  terminal order back to "pending" in the tracker.
- Per product decision, the page shows both `investor (Investor Name)`
  and `Current Account Name` (an admin asked to hide the latter was
  overridden in favor of showing both).
- The "Docs needed" ClickUp field's own text is surfaced directly to the
  investor when documents are pending, instead of rebuilding a parallel
  document-requirements knowledge base in code.
- For a completed order, the page links into the **existing**
  `/rate-your-experience` investor feedback flow instead of a separate
  feedback form.
- `NEXT_PUBLIC_SITE_URL` (optional, `.env.example`) builds the full
  tracking link; no such env var existed anywhere else in this codebase
  before this feature, so it defaults to the production domain already in
  use elsewhere in this app if unset.

**Two manual, one-time ClickUp-side setup steps are required** — this
app has no way to create a ClickUp custom field or register a ClickUp
webhook subscription itself:
1. Create a new custom field on the "Payment Received Orders" list (e.g.
   a URL or Text field named "Tracking Link"), and set its id as
   `CLICKUP_ORDER_TRACKING_FIELD_ID` on Vercel. Without this, tracking
   links still work end-to-end, they just aren't written back into
   ClickUp for ops to see at a glance.
2. Register a ClickUp webhook (ClickUp has no UI for this -- it's
   API-only: `POST /team/{team_id}/webhook`) for the `taskCreated` and
   `taskUpdated` events, pointed at
   `https://<this app's domain>/api/webhooks/clickup-order-tracking`,
   scoped to list `901113961474` if the API allows it (the endpoint
   double-checks the task's list itself either way). Set the `secret`
   ClickUp returns as `CLICKUP_ORDER_TRACKING_WEBHOOK_SECRET` on Vercel.
   `.github/workflows/clickup-register-order-tracking-webhook.yml` is a
   manual (`workflow_dispatch`), re-runnable helper that makes this call
   from a GitHub Actions runner (which has normal internet access, unlike
   a sandboxed Claude Code session) -- needs a `CLICKUP_API_TOKEN` repo
   secret, then trigger it from the Actions tab and read the `secret`
   off the run's Summary page.

## Public site layout

The public site (home page + every request form) is deliberately a single
screen with no sidebar — a sidebar nav was tried (Aug 2026) and explicitly
rejected: "no quiero que vaya esa franja negra a la izquierda... está de
más." Don't reintroduce `PageShell`/`Sidebar` there; those components are
now admin-only (`app/admin/layout.tsx`). `<ClickUpSyncNotice />` lives on
the admin Overview page (`components/admin/AdminOverview.tsx`), not on
any public page — same reasoning, the public Operations Hub Center screen
should show nothing but the request cards. `/rate-your-experience` (see
below) is the one deliberate exception, and it doesn't use `PageShell`
either — it has no chrome at all, not even the plain header the request
forms use.

## Investor feedback ("Rate Your Experience")

`app/rate-your-experience` is a standalone public page linked from
transactional emails (e.g. "Allocation Confirmed"). It lives outside the
Operations Hub's normal navigation on purpose: no `PageShell`/`Sidebar`
wraps it, and it isn't gated by the admin auth check (that check only
applies inside `app/admin`, via `app/admin/layout.tsx`'s client-side
session gate; there's no global middleware). It reads `?stars=N` from the
URL to preselect a rating but lets the investor change it before
submitting.

`POST /api/investor-feedback` is the public, unauthenticated endpoint the
page posts to; it writes to the `investor_feedback` table (see
`supabase/migrations/004_investor_feedback.sql`), the same "public insert
via the service-role client" pattern as `POST /api/requests` writing to
`requests`. `investor_email` is nullable and currently unused: the
payload the page sends has no investor identifier (no session/token),
just `rating`/`comment`/`source`/`submittedAt`.

`GET /api/admin/investor-feedback` (admin-only, same `requireAdmin` gate
as the rest of `/api/admin/*`) aggregates that table for the "Investor
Experience Rating" card on `/admin` (average rating, 1-5 histogram,
recent comments, an 8-week trend) — see `AdminOverview.tsx`.

## Investor Update Request

`app/forms/investor-update-request` looks and behaves like every other
request form (same `FormShell`, same design system, homepage card), but
is deliberately **not** wired into the shared `requests` table/
`request_types` row/`FORM_SPECS` override machinery every other request
type uses. Its future roadmap (AI-generated drafts, templates, an
approval workflow, version history, direct publication to investor
portals) needs a richer status model and structured per-field storage
the generic schema isn't built for, so it got its own tables up front —
see `supabase/migrations/005_investor_update_requests.sql`
(`investor_update_requests`, `investor_update_files`,
`investor_update_status_history`). Because of this:

- It has no row in `request_types` (`supabase/seed.sql` doesn't touch
  it) and isn't editable from the admin Form Builder — its field
  structure lives only in `components/axiskey-forms/
  InvestorUpdateRequestForm.tsx`.
- It's excluded from the "Requests by Type" bar list in
  `AdminOverview.tsx` (it would always show 0 there, since it never
  lands in `requests`) — it gets its own "Investor Update Requests"
  section instead, driven by `GET /api/admin/investor-update-requests`.
- `POST /api/investor-update-requests` is its own endpoint, not
  `POST /api/requests`. `FormShell` gained two opt-in props to support
  this without touching any of the other 9 forms' behavior:
  `submitEndpoint` (where to POST) and `buildSubmission` (how to shape
  the outgoing JSON, bypassing the generic requestorName/investorName/
  dealName/notes resolution). It also gained a `"multifile"` field kind
  (any number of files per field, each uploaded as its own attachment
  sharing that field's name as `fieldKey`) for the "Upload Supporting
  Files" / "Upload Images or Charts" questions, and a `submitLabel` prop
  for the "Request Investor Update" button text.
- `status` supports the full future workflow (`submitted`, `in_progress`,
  `draft_created`, `pending_client_approval`, `approved`, `published`,
  `completed`) at the schema level, but only `submitted` is ever actually
  set today — nothing in this codebase changes it yet. Same for
  `investor_update_status_history`: a `submitted` row is written on
  create, but nothing else writes to it yet.
- ClickUp sync (`syncInvestorUpdateToClickUp` in
  `lib/integrations/clickup.ts`, kept separate from `syncRequestToClickUp`
  since the payload shape is different) reuses the same
  `CLICKUP_LIST_ID_MAP` env var as every other type — add an
  `"investor-update-request"` entry once its ClickUp list exists. No
  `CUSTOM_FIELD_MAP` entry exists for it yet, so every field only reaches
  ClickUp via the task description until a list/field IDs are
  provisioned and confirmed, same as any other newly added list.

## Style

No em dash (`—`) in any user-facing platform text — form labels,
descriptions/helper text, button/UI copy, error messages shown to a user,
ClickUp task description fallbacks. It's fine in source code comments,
README.md, SQL comments, and CLI/script console output — none of that
renders to a user.

## Admin login

`components/admin/AdminLoginForm.tsx` no longer pre-fills any credentials
(it briefly did, for QA convenience — that put a real admin password in
client-side source, visible to anyone who loaded `/admin` without signing
in, so it was removed). Since that password was exposed both in this
source and in chat history, treat it as compromised and rotate it (and
any other admin password shared the same way) in the Supabase dashboard.
