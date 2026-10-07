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
- The `token` in the URL is the ClickUp task's own **order number**
  (its `name` field, e.g. `6205330647`) — **not** a random value. This
  was a deliberate security trade-off: the original design (Oct 2026)
  used a cryptographically random 32-byte token specifically so the link
  couldn't be guessed or enumerated; the user explicitly asked to switch
  to the order number for a more readable URL, was shown this removes
  that protection (order numbers are not secret or high-entropy, so
  anyone who guesses or enumerates one can view that investor's order
  status with no further proof of identity), offered a hybrid
  (order-number + random suffix) that would have kept both, and
  explicitly chose the insecure option anyway. Don't revert this without
  asking first. It's still looked up via `order_tracking_links`
  (`supabase/migrations/006_order_tracking_links.sql`), a table with RLS
  enabled and **no policies at all** — stricter than every other table in
  this app, since it must only ever be read through the service-role
  client (`GET /api/order-tracking/[token]`); that part of the design is
  unchanged, only what gets stored in its `token` column changed.
- Links are generated **fully automatically**, with no manual ops work:
  `app/api/webhooks/clickup-order-tracking/route.ts` listens for
  `taskCreated`/`taskUpdated` on that list, reads the task's order number
  the first time a task is seen (confirmed against the live task's
  `list.id`, regardless of how the webhook itself ended up scoped in
  ClickUp), and never re-derives it afterward (so renaming a task later
  does not change its tracking link). Provisioning itself (the
  insert-or-reuse-the-row + best-effort write-back into ClickUp's
  "Tracking Link" field) lives in `lib/services/orderTrackingProvision.ts`,
  shared with the fallback below so both paths behave identically.
- **Self-healing fallback, not just the webhook**: in practice ClickUp's
  real webhook delivery to this endpoint has been unreliable (confirmed
  Oct 2026 -- real orders created/updated well after the webhook was
  registered and healthy never got a row), so `GET
  /api/order-tracking/[token]` does not treat a missing row as fatal. If
  no `order_tracking_links` row exists for the token, it calls
  `findTaskIdByName` (`lib/integrations/clickup.ts`, paginates
  `GET /list/{list_id}/task` since ClickUp v2 has no "name equals X"
  filter, capped at 10 pages) to find the task directly by order number
  and provisions it on the spot. This means **every** task on the list
  resolves correctly the first time its link is opened, regardless of
  whether the webhook ever fired for it -- the webhook is now purely an
  optimization (pre-provisions the row, pre-fills the ClickUp field
  before anyone clicks), not the thing the feature depends on for
  correctness. Don't remove this fallback on the assumption the webhook
  is "fixed" without first confirming real ClickUp-originated deliveries
  (not a manually-simulated signed POST) are actually arriving.
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
  column is authoritative over every individual checkbox — those can be
  stale on older orders (confirmed via live data) and must never flip a
  terminal order back to "pending" anywhere on the page (stepper,
  checklist, and narrative text all force to fully complete/canceled when
  `scenario` is terminal, not just the headline).
  **Bug fixed Oct 2026**: `isNativelyCompleted` used to also fall back to
  `task.status.type === "done"` — but ClickUp marks both `completed
  orders` AND `canceled orders` with type `"done"` on this list (confirmed
  live), so every canceled order was silently misclassified as
  `"completed"` and shown "Your order is complete" instead of "This order
  was canceled". Fixed by matching on the status **text** only
  (`"completed orders"` or `"close"`); don't reintroduce a `type`-based
  fallback without confirming ClickUp's type values are actually distinct
  for every status on this list, which they are not.
- The three progress dimensions (documentation/compliance, payment,
  order complete) are **independent**, not a fixed linear sequence —
  real ClickUp data has shown payment arrive before KYC/compliance is
  finished, not just the reverse. `computeOrderTrackingView` computes
  `docsComplete` and `paymentComplete` separately from their own fields
  and marks each stepper step from its own state; "Order complete" is
  the only step genuinely gated on both. The stepper's connecting line
  (`Stepper` in `OrderTrackingView.tsx`) is colored per segment (lit
  right after any completed step) rather than one single left-to-right
  fill percentage, since a single fill would misrepresent an
  out-of-order completion (e.g. payment done, documents still pending)
  as if progress stopped earlier than it actually has.
- Per product decision, the page shows both `investor (Investor Name)`
  and `Current Account Name` (an admin asked to hide the latter was
  overridden in favor of showing both).
- The "Docs needed" ClickUp field's own text is surfaced as a short
  "Note from AxisKey" inside the requirements modal (see below) rather
  than being the investor's only source of document guidance.
- **"Requirements for &lt;account type&gt;" modal**
  (`lib/orderTracking/accountRequirements.ts`,
  `RequirementsModal` in `OrderTrackingView.tsx`): a structured, per
  -account-type breakdown of exactly which documents are needed, each
  with an Accepted/Not accepted (or "must show"/"one of these") list --
  ported directly from the shared HTML design prototype's `ACCOUNT_TYPES`
  data (all 9 account types), which already had this copy fully written.
  This is a deliberate reversal of this file's earlier note that the
  live "Docs needed" ClickUp text alone was enough and a parallel
  knowledge base wasn't worth building: the user explicitly asked for
  the prototype's full modal experience, so `accountRequirements.ts` is
  now that parallel knowledge base, keyed by the exact account type
  label strings `ACCOUNT_TYPE_BY_INDEX` in `lib/orderTracking.ts`
  decodes. It's static data with no live ClickUp read, so if ClickUp's
  real document requirements ever change, this file needs a manual
  update -- it will not silently drift out of sync with a visible error,
  same caveat as the rest of this codebase's ClickUp field mappings.
  Opened from two places that both just call the same `onClick`: the
  "View accepted KYC documents" button in the status panel (only shown
  for the `pending_documents` scenario, alongside "Open AxisKey portal"
  and a "How to upload KYC documents" Scribe guide link -- all three
  mirror the prototype's scenario-B action row) and the "View
  requirements for this account" link under the checklist panel.
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

## Order Tracking redesign (Oct 2026)

A few more product decisions on top of the ones already documented
above:

- **4-hour payment confirmation buffer**: when ClickUp first shows
  payment as received, `/order-tracking/[token]` doesn't immediately
  show "Payment received: Complete" — it shows "Processing" for 4 hours
  (`PAYMENT_BUFFER_MS` in `lib/orderTracking.ts`), so ops has a window to
  correct a mis-checked box without the investor ever seeing a payment
  get silently "un-received". The start-of-buffer timestamp is stored in
  `order_tracking_links.payment_first_seen_received_at`
  (`supabase/migrations/008_order_tracking_payment_buffer.sql`),
  written/cleared by `GET /api/order-tracking/[token]`, not by
  `computeOrderTrackingView` itself (kept a pure function — it takes the
  timestamp as an optional argument). For an order this system observes
  for the first time already past that moment (e.g. an older order seen
  for the first time after this buffer shipped), the task's own
  `date_updated` is used as a best-effort backfill instead of "now", so
  an order that's actually been settled for days doesn't show "Processing"
  on its very first view here.
- **Waived accreditation check only**: an order with `confirmedAmount >=
  200,000` (`WAIVED_AMOUNT_THRESHOLD`) shows "Waived" on the
  "Accreditation confirmed" pre-funding checklist item only, regardless
  of whether it's actually complete -- large, qualified investments
  don't need individual accreditation verification. Styled the same as
  "Complete" (same green pill). The other three checklist items
  (subscription agreement, KYC, account confirmed) always show their
  real complete/pending state regardless of order size -- two earlier
  passes got this wrong, first waiving only incomplete items, then
  (over-correcting) waiving all four items regardless of label; the
  user clarified it's accreditation specifically, nothing else.
- **`needsKycDocuments` / `needsAccreditationDocuments` drive the status
  panel's action buttons, independently**: the "pending_documents"
  scenario used to always show KYC-labeled buttons ("How to upload KYC
  documents" / "View accepted KYC documents") no matter which of the 4
  checklist items was actually outstanding. A first fix (wrong) modeled
  this as a single `blockingRequirement`, checked in a fixed priority
  order (subscription agreement, then KYC, then accreditation, then
  account confirmation) and showing only the first one's buttons -- but
  a real order can have, say, both the subscription agreement AND
  accreditation pending at once, and that priority order silently
  swallowed the accreditation buttons because subscription agreement
  "won". Replaced with two independent booleans,
  `needsKycDocuments`/`needsAccreditationDocuments`, each computed from
  its own field and shown together whenever both are genuinely
  outstanding -- no priority, no mutual exclusion. Subscription
  agreement and account confirmation still have no dedicated button
  beyond "Go to AxisKey portal" (no requirements content exists for
  those), they just no longer suppress the other two when also pending.
- **The narrative (headline/explanation/next step) distinguishes signing
  from uploading, and combines both when both are outstanding**:
  signing the Subscription Agreement happens inside the AxisKey portal,
  not as a document upload, so `buildNarrative`'s `"pending_documents"`
  case now takes `needsSignature` (`saNotSigned`) and `needsDocuments`
  (`kycIncomplete || needsAccreditationDocuments || accountNotConfirmed`)
  separately instead of one generic "We need a few documents from you" /
  "Upload the requested documents..." for every case. Signature-only:
  "Your agreement is ready to sign" / "Sign your Subscription Agreement
  inside AxisKey." Documents-only: unchanged original copy. Both at
  once (confirmed live, e.g. subscription agreement AND accreditation
  both pending): "Your agreement and a few documents are needed", next
  step mentions signing and uploading together. Each has its own
  payment-received variant too (prefixed "Payment received, ...").
- **Accreditation documents are 506C-only**: `needsAccreditationDocuments`
  is only ever true when `dealType === "506C"` (Reg D 506(c)) -- 506-B
  and Reg A offerings rely on KYC self-certification alone and never
  need a separate accreditation document upload, per the user. An
  accreditation item that's waived (see above) is also skipped here,
  same as the checklist UI already treats it. When it does apply,
  the panel shows "How to upload accreditation documents" (links to its
  own Scribe guide, `ACCREDITATION_UPLOAD_GUIDE_URL` in
  `lib/orderTracking/accreditationRequirements.ts` -- NOT the KYC one)
  and "View accepted accreditation documents", which opens
  `AccreditationRequirementsModal` in `OrderTrackingView.tsx`. That
  modal's content (three verification methods -- proof of income, proof
  of net worth, professional accreditation letter with a Jotform
  signable template link -- a shared "not accepted" list, the $200k
  waiver note, and the income/net-worth qualifying thresholds) is the
  same for every investor account type, confirmed directly from the user
  against the live prototype screenshots (not guessed) -- unlike
  `ACCOUNT_REQUIREMENTS`, this dataset isn't keyed by account type at
  all. The prototype site itself
  (`axiskey-investment-journey.maria-velizf.chatgpt.site`) remains
  unreachable from this sandbox's egress proxy; this was built from the
  user's screenshots and copy-pasted links, not a page read.
- **Completed orders no longer show the stepper** — just a single "Order
  complete" line with a checkmark, replacing the 4-step tracker (which
  has nothing left to communicate once the order is done). "Rate your
  experience" is a solid white pill with a hover scale/shadow, matching
  "Go to AxisKey portal"'s prominence instead of the faint `bg-white/10`
  button it used to be.
- **Panel color**: only the status panel (the "We need a few documents
  from you" / "Payment received..." card) switched from `bg-axis-core`
  (near-black) to `bg-axis-base` (`#CEC1A9`, already an existing
  design-system token, not a new color) with dark text instead of white.
  The page's dark header bar at the very top was changed the same way
  in a first pass, then explicitly reverted back to `bg-axis-core` with
  `<Logo variant="light" />` and `text-white/40` — the user asked for
  that part specifically to stay as it was. Don't recolor the header
  again without asking.
- **Header copy**: the offering name moved out of a separate chip and
  into the title itself ("Track your investment on {offering name}");
  the chip row now leads with an "Order ID" chip (`view.orderName`,
  which is the same ClickUp order number used as the page's token)
  instead of the offering name. No trailing period after the offering
  name: a real offering name can already end in one (e.g. "Tech
  Holdings Inc."), which read as a double period. The `<h1>`'s own
  separate fallback period (only rendered when there's no deal name at
  all, `{!view.dealName && "."}`) is unrelated and unaffected.
- **Combined KYC + accreditation requirements, only when both are
  outstanding at once**: when `needsKycDocuments` and
  `needsAccreditationDocuments` are both true
  (`needsBothDocumentTypes` in `OrderTrackingView.tsx`), the status
  panel shows one button pair instead of two near-identical ones --
  "How to upload documents" (the generic Scribe guide,
  `DOCUMENT_UPLOAD_GUIDE_URL` from `accountRequirements.ts`, not the
  KYC- or accreditation-specific one) and "View accepted documents"
  (opens `CombinedRequirementsModal`, which stacks the same KYC section
  as `RequirementsModal` and the same Accreditation section as
  `AccreditationRequirementsModal` under one header/footer, with the
  accreditation `<details>` not defaulting open this time to avoid an
  all-expanded wall of content). This only changes the both-pending
  case -- KYC-only and accreditation-only orders still show their own
  separate dedicated button pair and modal exactly as before.

## PDF Generator (`/admin/pdf-generator`)

Admin-only tool with nothing to do with the Operations Hub request flow;
it lives here only to reuse the repo, the admin auth, and Supabase. Only
the template is persisted (`pdf_templates` table + private
`pdf-templates` bucket, `supabase/migrations/007_pdf_templates.sql`);
generation is 100% client-side (`lib/pdfGenerator/generate.ts`, pdf-lib),
so bulk batches never hit an API route or Vercel's body-size limit.
`pdf_templates.mapping` holds a `PdfTemplateConfig` (`{version: 2,
fields, boxes, fileNamePattern}`, `lib/pdfGenerator/types.ts`): fields
are the admin-named variables (each one = one column in the generate
table / Excel), boxes place a field on a page (many boxes per field
allowed). `sanitizeConfig` also accepts the original v1 bare array of
text/image boxes, so never drop that branch while old rows may exist.
Boxes are stored in PDF user-space points (bottom-left origin);
the editor converts with pdf.js `viewport.convertToViewportRectangle` /
`convertToPdfPoint`, so don't hand-roll the y-flip. Names use the 14
standard PDF fonts (WinAnsi only): characters outside that set are
stripped of accents or replaced with `?` — embedding a custom font via
`@pdf-lib/fontkit` would be the fix if that ever matters.
