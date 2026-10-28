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
| `investment-change-name-request` | Investment Change Name Request | `901115619854` |
| `transfer-agreement-request` | (list at ClickUp list id below) | `901115630893` |

Full JSON for `CLICKUP_LIST_ID_MAP` (see `.env.example`):
```json
{"title-transfer-request":"901114002885","redemption-request":"901114014583","ira-funding-request":"901112504693","refund-request":"901114418101","side-letter-request":"901114320630","investor-information-update":"901114375425","account-maintenance-request":"901114375429","document-request":"901114375430","axiskey-report-request":"901114375435","investment-change-name-request":"901115619854","transfer-agreement-request":"901115630893"}
```

**This is an env var only — it is never committed to the repo.** It's set
on Vercel. `refund-request` is new (Aug 2026) — confirm it's been added
to the live Vercel value, since it was added to this table after the
original 8 went live. `investment-change-name-request` is new (Oct
2026) — **the user created this list and gave its ID, but no custom
fields have been provisioned on it yet**; `CUSTOM_FIELD_MAP`/
`ATTACHMENT_FIELD_MAP` in `lib/integrations/clickup.ts` have no entry
for this slug, so submissions land in ClickUp with only the task
description populated until `scripts/clickup/provision-forms.mjs` is
run (its `FIELD_PLAN` already has an entry for this list, built from
title-transfer-request's field set) and its output is pasted back to
wire those maps. The same "env var only" rule applies to
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

**The admin `Sidebar` (`components/layout/Sidebar.tsx`) is `sticky
top-0 h-screen`, not a plain flex child** (bug fixed Oct 2026): it used
to just be `flex` inside `PageShell`'s row, which let it scroll away
with the main content on any admin page tall enough to scroll — in
particular the footer block (the signed-in admin's email + sign-out
button) could end up below the fold, needing a scroll to reach. Now
the `<aside>` pins to the viewport (`nav` scrolls internally via
`overflow-y-auto` if its item list ever gets long enough to need it,
`shrink-0` on the logo block and the footer so they never get
squeezed), so the nav and the account footer stay visible on every
`/admin/*` screen regardless of how long that page's content is.

## SA Review (Subscription Agreement mapping-readiness tool)

`/admin/sa-review` lets an admin upload a Subscription Agreement (.docx)
and runs it through the same 7-category mapping-readiness checklist the
`anthropic-skills:sa-mapping-review` Claude Code skill uses (see that
skill's `SKILL.md` and the team's own
`Subscription_Agreement_Review_Guide_AxisKey_Branded.docx`) -- not PPMs,
despite how the feature was first described; PPM and SA are different
legal documents and this tool is specifically about SAs.

**This is a from-scratch Vercel-only reimplementation of the skill's
logic, not a web wrapper around the skill itself.** The real skill's
process (unzip -> render to PDF/images via LibreOffice -> read the
render with Claude vision -> apply XML fixes -> rezip) needs a shell and
LibreOffice, neither of which exists in a Vercel serverless function. The
two categories the skill detects visually (insufficient blank space,
inconsistent alignment) are approximated here from docx XML geometry
(cell widths in `w:tcW`, underscore-run lengths) instead of an actual
render -- this is a known, deliberate accuracy tradeoff for the other 5
categories (TBDs/highlights, dates, multiple classes, pre-filled
commitments, countersignature compatibility), which stay text/XML-based
evidence checks like the skill itself already uses.

- `lib/services/saReview/extractDocx.ts` pulls deterministic evidence
  out of the docx XML (blanks, table cell widths, highlighted/shaded
  runs, TBD/placeholder matches, literal dates, class mentions,
  possibly-prefilled fields) -- pure code, no Claude call.
- `lib/services/saReview/analyzeWithClaude.ts` sends that evidence to
  the Claude Messages API (`ANTHROPIC_API_KEY`, required -- see
  `.env.example`) with a forced `submit_review` tool call so the 7
  categories always come back as structured JSON, never free text to
  parse. Model is pinned in `MODEL` in that file.
- **Only categories 1 (space) and 2 (alignment) can ever be
  `"auto_fix"`.** This is a hard product constraint, not just a
  default: dates, TBDs, multiple classes, pre-filled commitments, and
  countersignature issues are legal-content judgment calls and must
  always come back as `"flag"` for a human to resolve, matching the
  skill's own "never guess legal content" philosophy. The system
  prompt in `analyzeWithClaude.ts` enforces this; don't loosen it
  without an explicit product decision to do so.
- `lib/services/saReview/applyMechanicalFixes.ts` re-locates each
  category 1/2 fix's verbatim `targetText` (which Claude copies
  directly from the evidence it was given, specifically so it can be
  found again) in the original docx XML and widens the blank / cell or
  left-aligns the paragraph. A fix it can't re-locate is left unapplied
  and reported back rather than guessed at.
- `supabase/migrations/007_sa_reviews.sql` adds the `sa_reviews` table
  (RLS enabled, no policies -- service-role only, same strictness as
  `order_tracking_links`) and a private `sa-reviews` storage bucket.
  **This migration has not been confirmed run against the live
  Supabase project** -- run it in the SQL editor before using the
  feature.
- Uploads/downloads go through `requireAdmin`-gated API routes
  (`app/api/admin/sa-review/**`), not direct browser-to-Storage
  upload like the public `attachments` bucket uses, since this bucket
  may hold investor PII and must stay admin-only. The upload endpoint
  takes base64 JSON (`{fileName, fileBase64}`), not multipart
  `FormData`, because `useAdminFetch()`'s `adminFetch()` always sets
  `Content-Type: application/json` whenever a body is present, which
  would otherwise corrupt a multipart upload. Downloads
  (`GET .../download`) stream the file through the same gate rather
  than a signed URL or `<a href>`, since plain browser navigation
  doesn't carry the Authorization bearer header `adminFetch()` attaches
  -- the admin UI fetches these as a blob and triggers a synthetic
  download (`lib/utils/downloadBlob.ts`).
- **The branded PDF report
  (`GET /api/admin/sa-review/[id]/report`) deliberately lives in
  `pages/api/admin/sa-review/[id]/report.ts` (Pages Router), not
  alongside the other sa-review routes in `app/api/admin/sa-review/`
  (App Router).** `@react-pdf/renderer`'s own React copy doesn't
  recognize elements created inside the `app/` directory's module
  graph -- Next bundles that graph against a "react-server" conditioned
  React build for RSC, and `@react-pdf/renderer` throws a minified
  invariant #31 ("Objects are not valid as a React child") even though
  the markup is correct. Confirmed by reproducing the identical render
  standalone in plain Node (works) vs. through an App Router route
  handler (fails) with the same code, in both `next dev` and a real
  production build (`next build && next start`) -- not a dev-only
  quirk. Pages API routes aren't part of that module graph, which is
  why this one endpoint is the sole thing under `pages/` in an
  otherwise fully App Router codebase. `lib/services/saReview/reportPdf.ts`
  itself is also deliberately plain `React.createElement` calls in a
  `.ts` file, not JSX in a `.tsx` file, since `next.config.mjs`'s
  `serverExternalPackages: ["@react-pdf/renderer"]` keeps the package
  itself out of webpack's bundle either way. Don't move this route
  back into `app/api` or reintroduce JSX there without re-confirming
  the underlying Next/React-PDF incompatibility is actually fixed
  upstream first.
- The admin UI (`components/admin/saReview/`) follows the same
  `useAdminFetch()` + `requireAdmin` pattern as every other admin
  page. Nav entry: `components/layout/nav.tsx`'s `getAdminNavItems`
  takes `AdminNavKey` (`"overview" | "forms" | "pdf-generator" |
  "sa-review"`).

### Format templates and the ongoing skill knowledge base (Oct 2026)

Two more admin-managed inputs feed into `analyzeWithClaude.ts`'s system
prompt on every review, both reachable from `/admin/sa-review` via
`SaReviewSubNav`'s tabs (Reviews / Format Templates / Knowledge Base):

- **Format Templates** (`/admin/sa-review/templates`,
  `sa_format_templates` table + private `sa-format-templates` bucket):
  an admin uploads a real SA the team has confirmed is correctly
  formatted for mapping. At most one template is ever "active" at a
  time (uploading a new one deactivates the previous one automatically,
  matching activation can also be toggled explicitly from the list).
  `lib/services/saReview/formatTemplates.ts`'s
  `getActiveFormatTemplateReference()` runs the active template through
  the same `extractDocxEvidence()` used for every review and summarizes
  its real blank-underscore lengths and table cell widths (dxa) into the
  prompt's "APPROVED FORMAT REFERENCE" section, so categories 1-2's
  auto_fix judgments are calibrated against a real approved example
  instead of a generic rule of thumb. When no template is active, a
  built-in `DEFAULT_FORMAT_GUIDANCE` string in `analyzeWithClaude.ts`
  is used instead (the "default template created by the AI" the user
  asked for until they upload a real one) -- the system still works
  with zero templates uploaded, it just reasons from generic defaults.
  **This does not change what gets auto-fixed** -- still only
  categories 1-2, still only widen-blank/left-align, never font/table
  style changes; the template only informs Claude's judgment of
  what counts as "too narrow" or "misaligned", per explicit user
  decision (richer template-driven reformatting -- fonts, spacing,
  table redesign -- was explicitly declined as a separate, larger,
  riskier project).
- **Knowledge Base** (`/admin/sa-review/knowledge`, `sa_skill_knowledge`
  table): free-text title+body entries an admin can add/edit/
  deactivate/delete at any time to keep feeding the reviewer new rules,
  corrections, and edge cases as they're discovered, without a code
  change. Every *active* entry is concatenated (most recently updated
  first, capped at `MAX_TOTAL_CHARS = 6000` in
  `lib/services/saReview/knowledgeBase.ts` to bound the added per-review
  token cost) into the prompt's "ADDITIONAL TEAM GUIDANCE" section on
  every future review -- per explicit user choice ("se envía
  automáticamente en cada revisión"), not just stored for manual
  reference. Deactivating (not deleting) is the way to stop using an
  entry while keeping it around.
- **Report page citations**: every `flag`/`auto_fix` finding (never
  `ok`) now also asks Claude for a `locatorText` -- a short verbatim
  quote quoted exactly from the evidence it was given. Since a `.docx`
  has no fixed pagination (it reflows with font/margin/zoom) and this
  app has no LibreOffice available to render real pages (see
  `extractDocx.ts`'s own module doc comment), there is no way to compute
  a verified page number -- `estimatePageForSnippet()` instead locates
  that quoted snippet in the document's plain text and divides its
  character offset by a flat `ESTIMATED_CHARS_PER_PAGE = 3000`
  constant. This is a rough estimate, always labeled "~p. N" in both the
  admin UI (`SaReviewDetail.tsx`) and the PDF report
  (`reportPdf.ts`), never a precise or verified page number -- per the
  user's explicit choice to show both the quoted citation (already
  existing) and an approximate page (new), having been told plainly
  that a real page number isn't available without a LibreOffice-based
  render. Returns `undefined`/absent rather than a guess whenever the
  quoted snippet can't be found verbatim in the evidence (e.g. Claude
  paraphrased instead of quoting).
- **The mechanical "Format document" button was reported broken live
  (Oct 2026) and is still unresolved** -- the user asked to hold off on
  guessing at a fix and instead first upload a real "perfect format"
  example via the new Format Templates page above, so the actual
  broken output can be compared against a known-good reference. Don't
  assume this is fixed without confirming against a real uploaded
  template and a fresh review.

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

## Schedule a Call (Calendly booking links)

Two standalone, unauthenticated public pages share the same
`ScheduleMeetingView` component and the Calendly inline widget embed
code the user provided (the actual Calendly scheduling page URL,
`https://calendly.com/d/dtv6-nwt-297/support-call`, is hardcoded as
`CALENDLY_URL` in `components/scheduling/ScheduleMeetingView.tsx` — not
an env var, since it's a public link, not a secret):

- **`/schedule-a-call`** (no token) — the plain evergreen link. Always
  shows the Calendly widget, unlimited uses, exactly as first built.
- **`/schedule-a-call/[token]`** (Oct 2026) — a one-time link. A token
  is minted by clicking "Generate one-time link" in the "Schedule a
  Call" section on `/admin` (`AdminOverview.tsx` -> `POST
  /api/admin/schedule-links`, which just inserts a row into the new
  `schedule_links` table — `supabase/migrations/018_schedule_links.sql`,
  RLS enabled with no policies, service-role only, same strictness as
  `order_tracking_links`). The admin copies the returned URL and sends
  it to one person.

**There is no `CALENDLY_API_TOKEN` anywhere in this codebase, and
there's no Calendly webhook subscription either** — explicitly declined
by the user ("no puede ser con lo que te pasé?") in favor of using only
the public embed snippet they'd already given. Calendly's own
single-use scheduling links (`max_event_count: 1` via their REST API)
would have been the server-verified way to do this, but that needs a
Personal Access Token the user didn't want to set up. Instead, "used" is
detected **client-side**: Calendly's embedded `widget.js` already posts
a `calendly.event_scheduled` window message the instant a booking
completes inside the iframe, regardless of any API/auth.
`ScheduleMeetingView.tsx` listens for that message (checking
`event.origin` ends in `calendly.com`), then calls `POST
/api/schedule-links/[token]/consume` (public — the token is the
credential, same trust model as `/api/order-tracking/[token]`) to set
`used_at`, and swaps the widget out for a thank-you card in the same
tab so a reload of that same session can't rebook either. **This is a
best-effort signal, not a server-verified booking confirmation** — someone
who disabled JS or blocked the request before it reached this app's API
could in theory dodge it. Fine for the intended use (sharing a link with
one client), but don't present a `used_at` timestamp as proof a meeting
was actually booked.

`app/schedule-a-call/[token]/page.tsx`'s validity check
(`isLinkValid()`) deliberately **fails closed** — a missing row or a
Supabase lookup error both render "This scheduling link is no longer
valid" — the opposite of every fail-open toggle default elsewhere in
this codebase (`loadOverrides.ts`, the homepage inactive-slugs fetch,
etc.). Those toggles gate visibility of something that's fine to leave
visible on an infra hiccup; this one exists specifically to guarantee a
link stops working, so erring toward "looks used" is the safer failure
mode here, not "stays bookable forever."

## Investment Change Name Request

`app/forms/investment-change-name-request` (`lib/formSpecs/
investmentChangeNameRequest.ts`) is a 10th locked request type, built
directly off `title-transfer-request`'s structure and field set (per
explicit instruction: "créame... una forma parecido al de title
transfer, cambia lo que sea necesario en frasing") -- phrasing was
reworded throughout to frame it as correcting/updating the name on an
existing order (legal name correction, marriage/divorce, individual ->
entity/trust) rather than transferring the order to a different
investor, but the field shape is otherwise identical (type-of-change
dropdown, investor name/email, offering name, order number,
current/new name, requester email, optional supporting-document
upload).

- Added to `request_types` in `seed.sql` at `sort_order = 10`
  (appended after `axiskey-report-request` rather than inserted in
  position 2 next to `title-transfer-request`, to avoid renumbering
  every other row's `sort_order`) -- **needs the seed re-run in the
  Supabase SQL editor**.
- `components/RequestCard.tsx`'s `DEDICATED_FORM_SLUGS` set had to get
  the new slug too, or the homepage card would silently fall back to
  the generic `RequestModal` instead of linking to the real page --
  easy to miss since nothing errors, the card just opens the wrong UI.
- **The ClickUp list now exists (`901115619854`, user-created, Oct
  2026) and is in `CLICKUP_LIST_ID_MAP`** -- see the ClickUp workspace
  layout section above. **No custom fields are provisioned on it yet
  though**, so submissions reach ClickUp but only the task description
  is populated (no `CUSTOM_FIELD_MAP`/`ATTACHMENT_FIELD_MAP` entries
  exist for this slug in `lib/integrations/clickup.ts`).
  `scripts/clickup/provision-forms.mjs`'s `FIELD_PLAN` already has an
  entry for this list (Type of Change dropdown, Current/New Account
  Name, Offering Name, Order Number, Investor Email, Client/Capital
  Raiser Email, plus the attachment field) -- run it from a machine
  with real internet access and paste its output back to wire those
  maps.
- `typeOfChange`'s options (Legal Name Correction, Marriage or Divorce
  Name Change, Entity Name Change, Other) were picked to fit a
  name-change framing, not confirmed against any ClickUp dropdown
  field (none exists yet) -- treat them as a starting point, not a
  confirmed spec.

## Transfer Agreement Request

`app/forms/transfer-agreement-request` (`lib/formSpecs/
transferAgreementRequest.ts`) is an 11th locked request type, built
directly off `redemption-request`'s structure per explicit instruction
("Hazle parecido al redemption solo que hay un buyer") -- same overall
shape (investor name/email, order number, offering name, account name
on file, amount, notes, requester email, optional supporting-document
upload), minus `redemption-request`'s Full/Partial dropdown and
issuer-approved checkbox (not asked for, and a transfer agreement
isn't the same concept as a redemption), plus one new required field
this type exists for: `buyerName` ("Who is the buyer receiving the
investment?").

- Added to `request_types` in `seed.sql` at `sort_order = 12`
  (appended after `investor-update-request` rather than renumbering
  any earlier row) -- **needs the seed re-run in the Supabase SQL
  editor**.
- `components/RequestCard.tsx`'s `DEDICATED_FORM_SLUGS` set includes
  this slug -- same reasoning as every other locked form, otherwise
  the homepage card would silently open the generic `RequestModal`
  instead of the real page.
- **The ClickUp list now exists (`901115630893`, user-provided, Oct
  2026) and is in `CLICKUP_LIST_ID_MAP`** -- see the ClickUp workspace
  layout section above. **This is an env var only, never committed to
  the repo** -- the updated JSON there still needs to be pasted into
  Vercel's `CLICKUP_LIST_ID_MAP` value before submissions can sync.
  **No custom fields are provisioned on it yet**, so until they are,
  submissions reach ClickUp but only the task description is populated
  (no `CUSTOM_FIELD_MAP`/`ATTACHMENT_FIELD_MAP` entries exist for this
  slug in `lib/integrations/clickup.ts`). A `FIELD_PLAN` entry for this
  list (Buyer Name, Investor Account Name, Offering Name, Order Number,
  Transfer Amount, Investor Email, Client/Capital Raiser Email, plus the
  attachment field) was added to `scripts/clickup/provision-forms.mjs`'s
  `EXISTING_LISTS`/`FIELD_PLAN` -- run it from a machine with real
  internet access (this sandbox cannot reach `clickup.com`) and paste
  its output back to wire `CUSTOM_FIELD_MAP`/`ATTACHMENT_FIELD_MAP` for
  this slug.

## Locked-form active/inactive toggle (Oct 2026)

Locked (code-driven) request types used to have no way to be hidden —
`request_types.is_active` existed and was already toggleable for
non-locked types from the Form Builder, but `PATCH
/api/admin/request-types/[id]` explicitly rejected `isActive` for any
locked row, and the public homepage (`app/page.tsx`) rendered the
static `REQUEST_TYPES` array with no server fetch at all, so the DB
column had no effect on a locked form even if it had been set.

Built per explicit instruction, triggered by `account-maintenance-request`
and `investor-information-update` covering the same ground
("son lo mismo... Hagamos solo una lista para los dos... Debe en el
admin section haber un toggle para activar y desactivar estos forms"):

- `PATCH /api/admin/request-types/[id]` now accepts `isActive` for
  locked rows too (alongside the existing `description` override) —
  see the updated comment in that file for why only those two fields
  are writable there.
- `lib/formSpecs/loadOverrides.ts`'s `FormOverrides` gained an
  `isActive` field (default `true` on any failure/missing row, so a
  Supabase hiccup never accidentally hides a live form). **Every one
  of the 10 locked `app/forms/<slug>/page.tsx` pages now calls
  `notFound()` when `overrides.isActive` is `false`** — hiding a form
  isn't just cosmetic (removed from the homepage grid); its direct
  URL also 404s, so it can't keep silently accepting submissions
  nobody is watching. Add this same two-line check
  (`if (!overrides.isActive) notFound();` right after the
  `loadFormOverrides()` call) to any future locked form page.
- `app/page.tsx` is now a server component (`export const dynamic =
  "force-dynamic"`) that fetches every `slug` with `is_active = false`
  from `request_types` and passes it down to the new
  `components/HomePageClient.tsx` (the original client-side modal/grid
  logic, extracted unchanged), which filters `REQUEST_TYPES` before
  rendering. Same fail-open default as `loadOverrides.ts` — a fetch
  error returns an empty inactive-slugs list, so every card still
  shows rather than the whole homepage silently going blank.
- `components/admin/formbuilder/FormBuilderList.tsx` now shows the
  Active/Inactive badge and an Activate/Deactivate button for locked
  rows too (previously only non-locked rows got either) — sits
  alongside "Edit copy", using the exact same `toggleActive()` handler
  non-locked rows already used (no new code path, just no longer
  gated on `!type.isLocked`).
- `supabase/migrations/017_hide_account_maintenance_request.sql` sets
  `is_active = false` on the `account-maintenance-request` row as a
  one-time data migration — **needs to be run in the Supabase SQL
  editor**. A plain re-run of `seed.sql` would NOT do this: its
  `on conflict` upsert deliberately never touches `is_active`, so an
  admin's toggle (or this migration's) can't be clobbered by a reseed.
  `account-maintenance-request`'s code/page/ClickUp mapping are all
  left completely intact — this is purely a visibility flag, not a
  deletion, so flipping it back on later is a one-click Form Builder
  action, no deploy needed.

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

- **It now has a `request_types` row (Oct 2026, `sort_order = 11`,
  `is_locked = true`)**, added purely so it shows up in the admin Form
  Builder list with the Active/Inactive toggle (see "Locked-form
  active/inactive toggle" below) — the user noticed it missing from
  that list ("El investor update no me sale en el form generator") and
  flagged it as an inconsistency once every other form got that
  toggle. It's still **not** wired into `FORM_SPECS` (no entry exists
  for this slug there, deliberately) or the generic field-override
  machinery — its field structure lives only in `components/axiskey-
  forms/InvestorUpdateRequestForm.tsx`, same as before. Clicking "Edit
  copy" on it in the Form Builder shows `RequestTypeEditor`'s own
  existing "locked but has no known code spec, can't be edited here"
  guard rather than a broken editor — no new code was needed for that
  block, it already existed for exactly this case. The row's
  `description` column is also not read by the public page (which has
  its own hardcoded copy) -- editing it in the admin has no live
  effect; only `is_active` does anything.
- `app/forms/investor-update-request/page.tsx` went from a plain
  static component to an async server component
  (`export const dynamic = "force-dynamic"`) that checks this new
  row's `is_active` directly (a small inline query, not
  `loadFormOverrides()` -- that helper also fetches `request_fields`/
  options this type doesn't use) and calls `notFound()` if false, same
  pattern as every other locked form page. Fails open to visible on
  any lookup error or missing row.
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

## Multi-email fields (Oct 2026)

`FormShell` (`components/axiskey-forms/FormShell.tsx`) gained a
`"multiemail"` field kind -- like `"email"`, but renders as the typical
chip/tag input: type an address, press Enter/Tab/Space/comma (or blur
the field) to commit it as a removable pill, keep typing for more.
First used on `ira-funding-request`'s `ccEmail` field (per explicit
request: "QUe sea la tipica que pones uno y se selecciona y ahí mismo
puedes type more than one").

**Space commits, it never types** (added Oct 2026, per explicit
follow-up: "Acá si typeas space debería ingresar el mail. no debe
dejarte poner espacio. Space es como enter básicamente."): the
`onKeyDown` handler always calls `e.preventDefault()` on `" "` before
checking whether to commit, unlike Enter/Tab/comma (which only
`preventDefault()` when there's something to commit, so Tab still
tabs to the next field on an empty draft). An email can never contain
a space anyway, so there's no case where letting it through would be
correct -- confirmed live that a space attempted mid-string (not just
trailing) is silently dropped rather than typed.

- **Storage stays a single string** -- `values[field.name]` holds a
  comma-separated list (`"a@x.com, b@y.com"`), same `Record<string,
  string>` every other field already uses. Nothing downstream
  (`notesFields`, `customFields`, `requestorEmailFields`, the ClickUp
  task description, `requests.requestor_email`) needed to change: a
  joined string reads correctly as plain text everywhere it already
  flows, and `ira-funding-request`'s `ccEmail` -> ClickUp mapping
  (`715f4b75...`, see `CUSTOM_FIELD_MAP` in `lib/integrations/
  clickup.ts`) is a ClickUp **text** field, not an email-typed one, so
  a multi-value string isn't rejected there either.
- **A real race condition was caught and fixed here** (found via an
  actual Playwright-driven browser test of the chip interactions, not
  just eyeballing a screenshot -- run several times, intermittently
  reproduced): `commitEmailDraft`'s first version computed the new
  email list from the `values` closure and called the single-field
  `setValue` helper, so two commits firing before React re-rendered in
  between (e.g. adding two addresses in quick succession) could each
  read the same stale "before" list and the second `setValues` call
  would silently clobber the first commit's email instead of adding to
  it. Fixed by having both `commitEmailDraft` and `removeEmail` read
  and write through `setValues`' own functional updater (computing the
  current list from `prev[name]`, not the outer closure), which
  guarantees each queued update sees the other's result regardless of
  batching -- confirmed fixed by re-running the same test script
  5 times back to back with zero drops, after it reproduced the drop
  on a prior run.
- Required-ness can't rely on the native HTML5 `required` attribute
  the way every other field kind does (there's no single native input
  whose value reflects "at least one chip exists"), so `FormShell`'s
  `handleSubmit` does a manual check for any required `"multiemail"`
  field with zero committed emails before proceeding, surfaced through
  the same error banner every other submit failure uses.
- `lib/dynamicForms/fieldConfigBridge.ts`'s `CONFIG_KIND_TO_DYNAMIC`
  maps `multiemail -> "email"` **for display only** in the admin Form
  Builder's field list -- unlike `"multifile"` (which never flows
  through this bridge at all, since investor-update-request isn't a
  locked form), `ira-funding-request` *is* a locked form, so its
  `ccEmail` field's admin-editable row does need a real
  `DynamicFieldType` to render as. An admin can still edit this
  field's label/helper/required from `/admin/forms/[id]` like any
  other locked field; its key/type stays code-owned either way (same
  as every other locked field), so showing "Email" there instead of a
  (non-existent) "Multi-email" type has no actual effect on behavior.
  `DYNAMIC_TO_CONFIG_KIND` has no reverse entry for it, so the admin's
  "Add question" picker still can't create a new one from scratch.

### Dynamic field labels (Oct 2026)

A `"checkbox"` **or** `"select"` field can reference another field's
live value in its own label via a literal `"{value}"` token, e.g.
`ira-funding-request`'s `hasExistingCustodianAccount` field: label
`"Does the investor already have an account with {value}?"` +
`dynamicLabelField: "custodian"` renders as "...with Directed IRA?"
and updates on every keystroke as the investor types the custodian
name, falling back to `dynamicLabelFallback` ("this custodian") while
that field is still empty. Per explicit request ("si pone directed
IRA. La pregunta que salga: does the investor already has an account
with directed ira?").

- Implemented narrowly: `FormShell`'s `displayLabel(field)` only
  substitutes `{value}` for a `"checkbox"` or `"select"` field that
  sets `dynamicLabelField`; every other field kind (and every
  checkbox/select that doesn't opt in) renders `field.label` as plain
  text, unchanged. This isn't a general templating system across all
  labels -- deliberately scoped to avoid any field whose label happens
  to contain a literal `{` rendering unexpectedly.
- `fieldConfigBridge.ts`'s `applyOverride` needed no change for this --
  neither the checkbox branch nor the generic fallback branch (which
  `"select"` falls through) strip unknown properties, so
  `dynamicLabelField`/`dynamicLabelFallback`/`options` always carry
  through an admin's label/required/helper edits unchanged.

**`hasExistingCustodianAccount` is `"select"` (Yes/No), not
`"checkbox"`** -- it started as a plain checkbox, but the user then
asked for it to be obligatory ("THIS QUESTION SHOULD BE OBLIGATORY").
A native HTML `required` checkbox can only mean "must be checked,"
which would have forced every submission to claim the investor already
has an account, including the (common, valid) cases where they don't
-- asked the user to confirm this tradeoff before building either way,
and they picked the dropdown so "No" stays a real, submittable answer
while still blocking submission until the question is actually
answered (confirmed live: submitting with the placeholder option still
selected shows the browser's native "Please select an item in the
list" validation and blocks submit; selecting "No" is accepted as
valid, not just "Yes"). `options: ["Yes", "No"]`.
- Still has **no ClickUp custom field mapping**
  (`CUSTOM_FIELD_MAP` in `lib/integrations/clickup.ts`) -- no confirmed
  field exists for this yet, and this session can't reach the ClickUp
  API to check (see "Network access from a Claude Code" above), so
  guessing an id would risk the exact silent-no-op mistake flagged
  elsewhere in this file. It only reaches ClickUp via the task
  description (`notesFields`) -- no `skipIfEmpty` needed now that it's
  required and always has a value. Add a real `customFields` entry
  once a field is provisioned and confirmed.

### Custodian dropdown with a free-text "Other" (Oct 2026)

`ira-funding-request`'s `custodian` field changed from plain free text
to a new `"selectOrOther"` `FieldConfig` kind: a normal `<select>` of
the custodians AxisKey actually works with, plus an "Other" choice
that reveals a free-text input for anything not on the list. Per
explicit request, listing the exact custodians and asking for this
pattern ("necesito que acá salga un dropdown con los custodians que
trabajamos y una opcion de other y poder typear"). Current list (code
only, no DB-backed source of truth -- editing it means editing
`lib/formSpecs/iraFundingRequest.ts`): Advanta Trust, American Estate &
Trust, Charles Schwab, Directed Trust Company, Equity Trust Company,
IRA Club, IRA Financial Trust, Madison Trust, Inspira Financial Trust,
Rocket Dollar, STRATA, Entrust, UDirect IRA, Other.

- **`values[name]` always holds the final answer, never the literal
  word "Other"** -- same storage principle as `"multiemail"` above,
  so `custodian` -> ClickUp mapping, `notesFields`, and the
  `hasExistingCustodianAccount` dynamic label (which reads
  `values.custodian` directly) all keep working unchanged whether the
  investor picked a listed name or typed a custom one. A sentinel
  (`OTHER_TOKEN = "__other__"`, module-level in `FormShell.tsx`) is
  only ever used as the `<select>`'s own option value/display state --
  it's never written into `values`.
- **Whether the Other branch is showing is derived, not just tracked**
  (`isOtherSelected()` in `FormShell.tsx`): explicit interaction (just
  picked "Other", or just picked a real option) always wins once it
  happens, but before that, a field whose stored value doesn't match
  any listed option is treated as Other too -- so a prefilled custom
  answer (e.g. from `initialValues`) opens showing its own text in the
  free-text box instead of looking blank or losing data.
- The free-text input gets the field's own `required`, so picking
  "Other" and leaving it blank still blocks submission (confirmed
  live: `validity.valueMissing` is `true` until something's typed) --
  no manual JS validation needed, same reasoning as the Yes/No
  `"select"` field above.
- `fieldConfigBridge.ts`'s `CONFIG_KIND_TO_DYNAMIC` maps
  `selectOrOther -> "dropdown"` **for display only** in the admin Form
  Builder (same reasoning as `multiemail -> "email"` above -- this
  field does flow through the bridge since `ira-funding-request` is a
  locked form), and `toDynamicField()`'s `options` line now also
  includes `"selectOrOther"` so the admin's field list actually shows
  the real option set, not an empty list. The admin-only "dropdown"
  representation has no "Other" escape hatch of its own -- that part
  only exists in `FormShell`'s own render.

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
- **Canceled orders don't show the stepper either** — same reasoning as
  completed: a 4-step tracker with every step marked "Canceled" has
  nothing useful left to communicate. Shows a single muted "Canceled
  order" line (axis-core/50, X icon in a light circle) in place of
  `<Stepper />`, mirroring the completed banner's layout but styled
  down instead of celebratory. `Stepper`'s own internal
  `isCanceled`/`litSegments` handling (dims the connector line, no lit
  segments) is now unreachable in practice since nothing calls it with
  canceled steps anymore -- left in place rather than stripped, since
  it's harmless and the component may get a future non-terminal caller.
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

## Communications Calendar (`/admin/communications`)

An admin-only tool for planning, drafting, and approving investor
communications (the recurring "Section 1 / Section 2 / FAQ of the
month" update emails, plus one-off comms) before they go out. Built
from a real planning session (the "Communications Calendar - Prompt de
Desarrollo" doc drafted earlier the same session has the full original
spec), then **reworked three times** on direct product feedback after
the first version shipped — **deliberately not synced to ClickUp or
any external email tool** ("no need to use clickup for this, is just a
calendar on the operation hub"), and now deliberately narrower in
scope than the original spec too (see below). This is a fully native
feature:

- **Storage**: one table, `communications`
  (`supabase/migrations/010_communications_calendar.sql` then
  `011_communications_simplify.sql` — 010 numbered that way, not 009,
  to avoid colliding with `009_sa_review_templates_knowledge.sql` from
  an unrelated SA Review feature another session merged directly into
  `claude/accesskey-request-platform-dbzoni`). Current columns: title,
  section type, send date, `html_code` (the email's raw HTML, see
  below), status, FAQ notes, approvers, approved at/by. Migration 011
  **dropped** `channel`, `segment`, `compliance_report`, `responsible`,
  `html_url`, `html_file_path`, and `html_file_name` entirely (not just
  hidden in the UI) per explicit feedback to make the form simpler —
  those were all in the original v1 spec/build but never actually
  wanted once the user saw them in practice. A second table,
  `communications_status_history`, is an audit trail of every status
  change (mirrors `investor_update_status_history` from migration 005)
  -- who sent something for approval, who approved or requested
  changes and when, and the comment left on a "changes requested"
  (that comment has no separate column; the detail page just reads the
  latest history row for it). Both tables are RLS-enabled with **no
  policies at all** (service-role only, same as `pdf_templates`) --
  this is an internal tool with no public insert path. The
  `communications-html` private storage bucket from migration 010 is
  now unused dead weight (v1 supported uploading an `.html` file to
  it; v2 replaced that with pasting the HTML as text) -- left in place
  since nothing was ever uploaded to it and dropping a bucket means
  removing its objects first, not worth a migration just for that.
- **The email's HTML is pasted in as code, not linked or uploaded.**
  V1 had a link field and a file-upload-to-Storage flow (`POST
  .../html-upload`, mirroring the `pdf-templates` signed-upload-URL
  pattern); the user explicitly rejected both ("no quiero cargar
  diseños, solo quiero cargar el código del HTML") in favor of a plain
  `html_code` text column edited directly on the detail page. That
  route and the upload UI were deleted outright, not just unused.
- **The detail page (`/admin/communications/[id]`,
  `CommunicationDetail.tsx`) is a two-column "mail client" layout**,
  per explicit instruction ("a la izquierda el mail y a la derecha las
  funciones"): the left column is the email itself (a Visual/HTML tab
  toggle, `htmlTab` state, **defaulting to Visual** -- "siempre que
  entras debería verse visual" -- an `<iframe srcDoc={htmlCode}
  sandbox="">` preview, with HTML as a plain monospace `<textarea>` on
  the other tab); the right column stacks Status actions, then Details
  (section type, send date, FAQ notes), with **one single Save button**
  at the bottom of the right column that persists everything together
  (title, section type, send date, FAQ notes, and the HTML) -- there
  used to be two separate Save buttons (one under the HTML box, one
  under Details), now there's just the one. The title itself is an
  inline-editable `<input>` in the page header (styled like a heading,
  bordered only on hover/focus), not a read-only `<h1>` -- editing it
  is part of the same single Save. `sandbox=""` (no value) blocks
  scripts, forms, same-origin access, everything, since this renders
  arbitrary pasted HTML/email markup in an authenticated admin tool and
  there's no reason it should ever need script execution.
- **Approval flow is in-app, not an emailed 3-button flow.** The
  original spec's "Send for approval" sends an email to Diego and Lana
  with Ver email/Aprobar/Solicitar cambios buttons via ClickUp
  automation -> N8N. This codebase has **no email-sending integration
  at all** (confirmed by grepping for Resend/SendGrid/Postmark/
  nodemailer/SMTP before building -- nothing exists), so building that
  literally would have meant inventing new email infrastructure nobody
  asked for. Instead, the Status card on the detail page's right column
  shows contextual actions: once in `pending_approval`, Diego or Lana
  (logged into `/admin` like anyone else, gated by the existing
  `requireAdmin`/`admin_users` check) see Approve (picks which of the
  two approved, sets `approved_at`/`approved_by`) and Request changes
  (requires a comment, written to `communications_status_history.notes`)
  buttons right there. If real outbound email to Diego/Lana is wanted
  later, that's additive on top of this -- the status/history model
  doesn't need to change, only a notification step added.
- **Status model (renamed Oct 2026, migration
  `012_communications_status_rename.sql`)**: `building ->
  pending_approval -> (ready_for_launch | changes_requested) ->
  deployed`. The original 7-value model (`idea`, `in_design`,
  `sent_for_approval`, `approved`, `scheduled`, `sent`, plus
  `changes_requested`) was collapsed to the 5 SLA stages actually
  wanted -- `idea`+`in_design` merged into one `building` stage ("en
  creación... processing o building"), `approved`+`scheduled` merged
  into one `ready_for_launch` stage -- migration 012 both renames the
  check constraint and **migrates existing row data** (not just new
  rows) with `update` statements per old-status group, so nothing left
  over in a dropped status value. `changes_requested` still loops back
  to `building` ("Back to Building (edit and resend)"). Moving
  `building -> pending_approval` is blocked (both client-side in
  `CommunicationDetail.tsx`'s `canSendForApproval`, and server-side in
  `PATCH /api/admin/communications/[id]`) until `html_code` is
  non-empty.
- **Two views on `/admin/communications`
  (`CommunicationsCalendarList.tsx`)**, a toggle between them, Calendar
  as the default: **Calendar** (`CalendarMonthView.tsx`) is a real
  month grid (prev/next/today nav, a dot-colored chip per communication
  on its `send_date`, up to 3 shown then "+N more"), replacing v1's
  "card grid grouped by month" which the user didn't consider an
  actual calendar. **List** is v1's status-filterable card grid, kept
  as a secondary view. The v1 header's description paragraph ("Plan,
  design, and approve investor communications before they go out...")
  was removed entirely, per instruction.
- **Every communication always has a send date -- there is no
  "unscheduled" state**, per explicit instruction ("no debería existir
  los unscheduled... todos deberían tener una fecha"): `sendDate` is
  now required (not optional) in both `QuickCreateModal.tsx` and the
  `POST /api/admin/communications` validation, defaulting to today's
  date when the "+" button opens with no day pre-filled. The calendar
  view's old "Unscheduled" fallback list (for communications with a
  null `send_date`) was removed from the UI -- the `send_date` column
  itself is still nullable at the DB level (no migration added a `not
  null` constraint, since nothing asked for one), this is purely an
  application-level guarantee going forward.
- **Creating one is a "+" button, not an inline form.** V1 had a
  title/section-type/date form embedded in the page; replaced with a
  round "+" icon button (top right) opening `QuickCreateModal.tsx` --
  just a title and a send date. **Clicking an empty day cell in the
  calendar opens the same modal with that day pre-filled** as the send
  date. Either path creates the row then routes straight to its detail
  page, where the HTML, section type, and everything else gets filled
  in.
- **Seeded starting content**: `supabase/seed.sql` carries over the 8
  investor-education topics that were already planned in the real
  "Axis IR Support" ClickUp list (shared as a screenshot: Topic 1-8,
  "Getting to Know AxisKey" through "Platform Updates") as the
  calendar's starting rows, `status = 'building'`, section type mapped
  to `full_communication` except Topic 4 ("Tax season Prep (Nov 2026)")
  which is `section_2` (a deadline/reminder). Each row gets a coherent,
  staggered weekly `send_date` (Topic 1 = 2026-10-30, one more topic
  each following week through Topic 8 = 2026-12-18) -- the ClickUp side
  never set real dates (beyond "Nov 2026" in Topic 4's own title), so
  these were chosen to be coherent, not pulled from a source of truth.
  The insert is matched by title to stay idempotent on re-run
  (`communications` has no other natural unique key); an `update` block
  right after it also backfills `send_date`/`status` on any of these 8
  rows that were already inserted by an earlier run of this file
  (before dates and the new status set existed), matched by title,
  only touching rows where `send_date is null` -- harmless no-op once
  they're already backfilled.
- Nav: "Communications" added to `getAdminNavItems`
  (`components/layout/nav.tsx`), reusing the existing `MegaphoneIcon`
  rather than adding a new one.

### Fourth pass: ClickUp-styled detail page, recipients, "Next up" (Oct 2026)

- **The title now saves itself on blur** (`handleTitleBlur` in
  `CommunicationDetail.tsx`), not just as part of the big Save button.
  The earlier version's title field visually let you type but only
  persisted on the unified Save click, far down the right column and
  with no "unsaved" indicator -- the user read that as the title not
  being editable at all, since it would quietly revert on reload if
  Save was never clicked. It still gets included in the full Save
  payload too, so both paths work. Styled with a dashed border so it
  visibly reads as an editable field (ClickUp's own click-to-edit
  title has no border at rest either, but this app's hover/focus
  states needed something to signal "this is a field" up front).
- **Status panel is now the dominant, color-filled card at the top of
  the right column** (`STATUS_PANEL_COLOR` in `CommunicationDetail.tsx`,
  one color per status, matching `STATUS_BADGE` elsewhere) instead of a
  plain white card with a small label -- the primary action button
  (Send for approval / Approve + Request changes / Back to Building /
  Mark as Deployed) was always there and rendering correctly before,
  but visually blended into the rest of the page enough that the user
  didn't register it as "the button that advances the SLA." This is
  a styling fix, not a logic change -- the same gated transitions
  (blocked on `html_code` before `pending_approval`, requires
  `approvedBy`/a comment for the other two) still apply; this was
  never free-jump between statuses like a ClickUp status dropdown,
  and stays that way on purpose (skipping the approval gate would
  defeat the point of the workflow).
- **Recipients** (new, migration
  `013_communications_recipients.sql`): a `clients` table (just `id`,
  `name`, unique by name) is a small reusable address book, separate
  from any one communication -- added once via the Recipients
  section's "Add a client" box, it then shows up as a checkbox on
  every future communication too, per explicit instruction ("tiene
  que haber una sección para poder añadir los nombres de los clientes
  y que se queden guardados"). `communications.recipient_type`
  (`all_investors` default | `specific`) plus a `communication_recipients`
  join table hold the per-communication selection. `GET`/`POST
  /api/admin/clients` manage the shared list (`POST` is
  case-insensitively idempotent -- adding "Acme" twice reuses the same
  row rather than erroring on the unique constraint); the detail
  `PATCH` endpoint accepts `recipientType` + `clientIds` and replaces
  the full recipient set for that communication (delete-then-reinsert,
  not diffed -- a small admin-managed list, not worth the extra
  complexity). Selecting recipients is folded into the same single
  Save button as everything else, not a separate action.
- **"Next up" panel on `/admin/communications`'s Calendar view**
  (`CommunicationsCalendarList.tsx`): next to the month grid (a
  `xl:grid-cols-[1fr_320px]` layout, stacks below it on narrower
  screens), the next 3 communications with `send_date >= today`
  sorted ascending, as large clickable cards -- same card style as
  the List view's cards but bigger type, so the upcoming sends are
  visible at a glance without hunting across the calendar grid.
- The overall detail-page direction ("que esta pantalla se vea como
  la organización de ClickUp") took the large-content-pane-left +
  property-panel-right shape and the per-section small-caps labels
  from ClickUp's task view, not a literal clone -- no activity feed,
  no assignee avatars, no custom-field system; just that same "the
  thing itself is big and front-and-center, everything you can do to
  it lives in a structured sidebar" feel already established in the
  prior pass and reinforced here.

### Fifth pass: 3-column layout, manual status, real approver emails, comments (Oct 2026)

- **Yellow hover everywhere in this section**: every button across
  `CommunicationDetail.tsx`, `CommunicationsCalendarList.tsx`,
  `CalendarMonthView.tsx`, and `QuickCreateModal.tsx` now hovers to
  `axis-signal` (the brand yellow/lime, `#E3F464`) -- solid dark
  buttons fill yellow with dark text (`PRIMARY_BTN` in
  `CommunicationDetail.tsx`), outline buttons tint yellow
  (`SECONDARY_BTN`), calendar day cells and chips tint yellow on
  hover. Deliberately **not** applied to Delete (stays red-on-hover)
  since a destructive action shouldn't invite a "go ahead" color. The
  "← Communications" back link is now a real button
  (`TEXT_BTN`) with the same yellow hover, not a bare text link.
- **Manual status override**: a `<select>` inside the Status card
  (always visible, every one of the 5 statuses as an option) lets an
  admin force the status directly, bypassing the guided workflow's
  required fields (`manualOverride: true` in the PATCH body, handled
  server-side in `app/api/admin/communications/[id]/route.ts` by
  skipping the approver/comment/HTML checks for that one request).
  This sits alongside, not instead of, the guided action buttons --
  the normal path still can't skip the approval gate by accident, this
  is purely an escape hatch for corrections.
- **Approvers are now a real, admin-managed list with actual email
  sending**, replacing the old hardcoded "Diego"/"Lana" radio buttons.
  New `approvers` table (migration
  `014_communications_approvers_comments.sql`, name+email, unique by
  email, same `/api/admin/approvers` GET/POST pattern as
  `/api/admin/clients`). "Send for approval" now opens a picker
  (who to request from, with an inline "add a new approver" mini-form)
  instead of transitioning immediately; the chosen approver's
  name/email are snapshotted onto the communication
  (`requested_approver_name`/`requested_approver_email` columns -- text,
  not a foreign key, so it still reads correctly if that approver is
  later edited or removed from the list) and shown on the Status card
  once pending. The later "Who is approving?" step also now picks from
  the same saved Approvers list instead of two hardcoded names.
- **A real approval-request email now goes out**, via
  `lib/services/communications/sendApprovalEmail.ts` -- a single
  `fetch` to Resend's REST API (no SDK added), gated on
  `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (see `.env.example`). Chosen
  the same way `CLICKUP_API_TOKEN` is handled elsewhere in this
  codebase: **best-effort and non-blocking** -- if the keys aren't set,
  or the Resend call fails, the status transition still succeeds and
  the chosen approver is still recorded, the email just silently isn't
  sent (the PATCH route never surfaces that failure to the UI). This
  is the first real outbound-email integration in this codebase (every
  other "notify someone" flow here, like Order Tracking or Rate Your
  Experience, is either investor-facing and sent from outside this app,
  or was explicitly built as in-app-only to avoid exactly this kind of
  new infrastructure) -- Resend was picked unprompted as the
  lowest-friction standard choice for a Vercel/Next app (no SMTP setup,
  generous free tier), not confirmed with the user first; the user
  still needs to create a Resend account, verify a sending domain (or
  use `onboarding@resend.dev` for testing), and set the two env vars
  on Vercel before any email actually sends.
- **Comments, merged with the status-change history into one
  timeline** (new `communication_comments` table, same migration 014;
  `POST /api/admin/communications/[id]/comments`; `GET
  .../[id]` now also returns both `comments` and `history`). The
  detail page's right-most column renders them interleaved by
  timestamp (`TimelineEntry` union type in `CommunicationDetail.tsx`)
  -- a free-text comment card, or a compact "Status A → Status B · who
  · when" line for a history entry, newest first. Posting a comment is
  its own action (an inline textarea + button in that column), not
  folded into the big Save button, since a comment is a timestamped
  event, not a field to persist.
- **3-column layout at the `xl` breakpoint**
  (`xl:grid-cols-[1.3fr_0.9fr_0.9fr]`): email (left) · Status/
  Recipients/Details/Save (middle) · Comments+history (right) --
  previously Comments/History sat full-width below a 2-column grid,
  which the user didn't like ("no me encanta que las cosas vayan para
  abajo"). Collapses to a single stacked column below `xl`.
- **The email preview/editor is capped at `max-w-[640px]`**, centered
  within its card, instead of stretching to fill the whole left
  column -- 640px matches the width real email clients render HTML
  emails at, so what you see while editing now actually represents
  what gets sent, instead of looking stretched/wide on a big monitor.
- **The admin content area now grows with the screen**
  (`app/admin/layout.tsx`'s wrapper: `max-w-6xl` →
  `xl:max-w-[1400px]` → `2xl:max-w-[1800px]`, up from a flat
  `max-w-5xl` that capped every `/admin/*` page, not just
  Communications, at 1024px regardless of monitor size). Still capped
  (unbounded width would make long lines of text hard to read), just
  at sizes that actually use a wide screen instead of leaving most of
  it as margin.

### Sixth pass: two approver-picker modes, FROM address, public review-token flow (Oct 2026)

- **"Send for approval" now has two explicit modes**, a small pill
  toggle at the top of the picker in `CommunicationDetail.tsx`
  (`sendForApprovalMode: "team" | "once"`): **"From the team"** is the
  prior behavior unchanged (radio list of saved `approvers`, plus an
  inline add-and-save form that still persists to the `approvers`
  table via `POST /api/admin/approvers`); **"Someone else (one time)"**
  is new -- plain name/email inputs passed straight into
  `setStatus("pending_approval", { approverName, approverEmail })`
  without ever calling the approvers-save endpoint, per explicit
  instruction that this person should **not** be saved ("no se queda
  guardada"). Both modes end up calling the exact same PATCH
  (`approverName`/`approverEmail` in the body), which already accepted
  arbitrary values not present in the `approvers` table -- the
  one-time mode needed no server-side change, only the new UI split
  and `handleConfirmSendForApproval` branching on `sendForApprovalMode`.
- **Notification FROM address**: `RESEND_FROM_EMAIL` should be set to
  `ir@axiskey.com` on Vercel (requires verifying the `axiskey.com`
  sending domain in Resend first) -- `.env.example` updated to say so
  explicitly. `sendApprovalRequestEmail` itself doesn't hardcode the
  address (it already just reads `RESEND_FROM_EMAIL`, matching this
  codebase's existing "configured via env, not hardcoded" pattern for
  every other optional integration), so no code change was needed
  there, only the env var's value once it's set.
- **Approval-request email copy**, matching the user's literal
  requested wording ("There's a new communication, investor
  communication that needs to be approved"): `sendApprovalRequestEmail`
  (`lib/services/communications/sendApprovalEmail.ts`) sends "There's a
  new investor communication that needs to be approved: `<title>`",
  who requested it, and a single styled button labeled "Review this
  communication".
- **The email's button opens a public, token-gated, back-navigation-
  free review screen scoped to exactly one communication** -- new
  `/communications-review/[token]` page
  (`app/communications-review/[token]/page.tsx` +
  `components/communicationsReview/CommunicationReviewView.tsx`),
  mirroring `/order-tracking/[token]`'s and `/rate-your-experience`'s
  existing "no `PageShell`/`Sidebar`, no auth guard,
  `export const dynamic = "force-dynamic"`" conventions for standalone
  public pages. Unlike `/order-tracking/[token]`'s token (the ClickUp
  order number -- an intentionally guessable, read-only identifier per
  an earlier explicit product decision documented above), this token
  gates **write** actions (approve / request changes), so it's a real
  high-entropy secret: a fresh `crypto.randomUUID()` generated server-
  side in `PATCH /api/admin/communications/[id]` on every "Send for
  approval" click (new `review_token` column,
  `supabase/migrations/015_communications_review_token.sql`, unique
  index, not yet confirmed run against the live Supabase project --
  run it in the SQL editor before relying on this flow). There is no
  separate expiry or revoke step: `getPendingCommunicationByToken`
  (`lib/services/communications/reviewToken.ts`) only resolves a token
  while the communication's status is still `pending_approval`, so a
  token naturally stops working the moment it's acted on (by its own
  use, or by an admin acting directly in `/admin`) or superseded by a
  new "Send for approval" click, which overwrites `review_token` with a
  fresh value.
- **Four new public API routes** under `app/api/communications-review/
  [token]/`, all looking the token up via the same
  `getPendingCommunicationByToken` helper and returning 404
  (`"This review link is no longer valid."`) once it's gone: `GET
  [token]` (the communication + its history + comments, same shape the
  admin detail GET returns), `POST .../comments` (adds a comment,
  author = the snapshotted `requested_approver_name`/`_email`), `POST
  .../approve` (-> `ready_for_launch`, sets `approved_at`/`approved_by`
  to that same snapshotted identity, writes a history row), `POST
  .../request-changes` (-> `changes_requested`, requires a non-empty
  `comment`, written as that history row's `notes`). None of these
  require `requireAdmin` -- the token itself is the credential, same
  trust model as `/order-tracking/[token]`'s page-level token gate.
- **The review screen itself** (`CommunicationReviewView.tsx`): a
  `Shell` with just the dark header + logo (no nav, no back link,
  nothing else on the page to click into) showing the email (same
  `max-w-[640px]` sandboxed iframe preview as the admin detail page),
  a Comments panel (post a new comment + the same merged
  comments/history `TimelineEntry` list the admin detail page shows,
  "con los comentarios anteriores" per the request), and an Actions
  card with exactly two buttons -- Approve, or Request changes
  (expands into a required comment box) -- per the user's explicit
  "dos opciones" spec. After either action, the page replaces itself
  with a simple thank-you/outcome card (no further navigation); if the
  token no longer resolves (already acted on, or superseded by a newer
  request), it shows a plain "This review link is no longer valid"
  card instead of erroring.
- Resolved: `RESEND_API_KEY` and `RESEND_FROM_EMAIL=ir@axiskey.com` are
  now set on Vercel and migration 015 has been run against the live
  Supabase project, so the approval-request email actually sends.
- **Every approval-request email is CC'd to `mike@axiskey.com`**
  (`MIKE_CC_EMAIL` in `sendApprovalEmail.ts`), unconditionally, for
  every approver (saved or one-time) -- per explicit instruction while
  this flow is being tested ("todas las pruebas y correos con copia a
  este mail"). Hardcoded, not env-configurable, since it was asked for
  as a blanket "every send" rule rather than a per-environment
  setting; revisit if this should become optional or temporary.
- A real Resend API key was pasted directly into chat during this
  session (while asking "de donde saco ese api") -- flagged to the
  user as compromised the same way an exposed admin password was
  treated earlier in this file, with instructions to revoke/rotate it
  in the Resend dashboard and only ever paste a new one straight into
  Vercel's env var UI, never into a prompt. Confirm this key was
  actually rotated if it wasn't already.
- **The approval email's send result used to be completely invisible
  from the UI** -- `sendApprovalRequestEmail`'s best-effort design
  (never fails the status transition) meant a misconfigured Resend
  setup (wrong/rotated key, unverified sending domain) looked
  identical to a successful send from the admin's point of view: the
  status still moved to `pending_approval`, no error anywhere. Live
  testing (Oct 2026) hit exactly this -- four real "Send for approval"
  attempts via the guided flow, zero of them showing up in Resend's
  own Emails log at all (not even as a failed attempt), which points
  at a Resend-side rejection before an email record is even created --
  most likely the `axiskey.com` sending domain not actually verified
  in Resend yet, since an unverified-domain `from` address is rejected
  before Resend logs anything, unlike a bad API key (which usually
  still shows a failed log entry). Fixed by threading the
  `{sent, error}` result all the way through: `PATCH
  /api/admin/communications/[id]` now also `console.error`s a failed
  send (visible in Vercel's function logs) and includes it as
  `emailResult` in its JSON response; `CommunicationDetail.tsx`'s
  `setStatus()` reads that and shows an amber warning banner ("The
  status changed, but the approval email was not sent: `<error>`")
  right on the page instead of failing silently. Still doesn't block
  the status transition itself -- only makes the failure visible.
- **That amber warning only lived in React state, not persisted** --
  a reload or navigating away and back lost it, which is exactly what
  happened during live debugging: two real send attempts went out
  (confirmed via `communications_status_history`) but the admin never
  saw the error because they'd navigated back to the page afterward.
  Fixed (migration `016_communications_last_email_error.sql`,
  `communications.last_approval_email_error`): the PATCH route now
  writes the send outcome into this column on every status change --
  the latest error message when a `pending_approval` email attempt
  fails, `null` on success or on any other status transition (so a
  stale failure doesn't linger once the admin has moved past it). The
  detail page now reads `data.lastApprovalEmailError` directly (no
  more ephemeral local state) so the warning survives reloads and is
  visible any time the page is opened, not just right after the click.
- **Root cause of the "nothing ever arrives" live debugging session
  (Oct 2026) turned out to be deployment promotion, not code**: Vercel
  deployments page showed the admin's git pushes landing as **Preview**
  only, with **Production** still pinned to an older commit (manually
  re-triggered via "Redeploy", which rebuilds the same commit a
  deployment already had rather than pulling the branch's latest) --
  so every code fix in this section (the CC, the amber banner, this
  persisted-error column) existed in the repo and in Preview
  deployments well before it ever reached the live site the admin was
  testing against. The fix is **"Promote to Production"** on the
  correct branch's Preview deployment (not "Redeploy"), or fixing
  Vercel's Production Branch setting so pushes to
  `claude/accesskey-request-platform-dbzoni` deploy to Production
  automatically. Worth checking first the next time a shipped fix
  "doesn't show up" live.
- **Briefly switched the approval-request email to Microsoft Graph
  (sending as the real `ir@axiskey.com` Microsoft 365 mailbox), then
  reverted back to Resend the same day (Oct 2026).** The switch was
  made to avoid Resend's domain-verification requirement (every real
  send attempt against `axiskey.com` came back `Resend API error 403:
  "The axiskey.com domain is not verified"`), but Graph's setup --
  register an Azure AD (Entra ID) app, generate a client secret, grant
  admin consent for the `Mail.Send` application permission, optionally
  lock it down with an Exchange Online application access policy via
  PowerShell -- needs real Microsoft 365 tenant admin work, which the
  user judged too heavy for this. `lib/services/communications/
  graphMail.ts` and the `MS_GRAPH_*` env vars were added and then
  removed again; `sendApprovalEmail.ts` is back to the original
  Resend `fetch` call, unchanged from before the detour. **The actual
  fix for the 403 is still pending**: either verify `axiskey.com` as a
  sending domain at resend.com/domains (just 2-3 DNS records at
  whoever manages that domain's DNS -- no admin-consent flow, much
  lighter than the Graph route), or, for the fastest possible test
  send with zero setup, set `RESEND_FROM_EMAIL=onboarding@resend.dev`
  (Resend's shared test sender -- works immediately, but mail won't
  come from `ir@axiskey.com` and may land in spam). Don't re-attempt
  the Microsoft Graph route without the user explicitly asking for it
  again, now that it's been tried and declined as overkill.
- **`axiskey.com` verified in Resend (Oct 2026)** -- the DKIM TXT
  (`resend._domainkey`) and the two SPF CNAMEs (`rsend`, `send`) were
  added at GoDaddy (the domain's registrar/DNS host) and all show
  Verified in Resend. The approval-request email now actually sends
  from `ir@axiskey.com` in production -- confirmed with a real send to
  `mike@axiskey.com` that arrived.
- **The approval-request email's HTML was replaced with a fully
  branded template the user supplied directly** (Oct 2026,
  `approvalEmailHtml()` in `sendApprovalEmail.ts`) -- an AxisKey-styled
  layout with inline base64 AXIS/AxisKey logos, an "Approval Needed"
  eyebrow, headline, greeting, body copy, a yellow pill CTA button
  ("Review This Communication"), and a dark footer with contact info
  and legal text, replacing the earlier plain-paragraph version. Only
  `{Recipient Name}`, `{Communication Name}`, `{Requester Email}`, and
  `{Review Link}` are substituted; the rest of the markup (including
  both embedded logo images) is reproduced verbatim as given -- don't
  hand-edit the HTML without a fresh copy from the user.
- **A second, separate notification email now fires when a reviewer
  approves** (`lib/services/communications/
  sendApprovedNotificationEmail.ts`, called from `POST
  /api/communications-review/[token]/approve` right after the status
  write and history insert succeed): hardcoded to `annelise@axiskey.com`
  -- she owns creating communications and launching them, so she's the
  one who needs to know the instant something clears
  `pending_approval` -- CC'd to `mike@axiskey.com` "for tests rn" per
  explicit instruction, same temporary testing CC as
  `sendApprovalEmail.ts`'s `MIKE_CC_EMAIL` (remove/change both
  together once testing is done). Links to the real admin page
  (`/admin/communications/[id]`), not the public review token, since
  that token stops resolving the moment status leaves
  `pending_approval` (see `reviewToken.ts`) -- by the time this email
  sends, the review link is already dead, so Annelise needs the actual
  admin detail page to get to the HTML and launch it. Same best-effort
  gating as every other email here: a missing Resend key/unconfigured
  domain returns `{sent: false, error}` and is `console.error`'d, but
  never blocks the approval itself.
- **`/communications-review/[token]`'s layout was redone to fit one
  screen with no outer scroll** (Oct 2026,
  `CommunicationReviewView.tsx`), per explicit feedback that the old
  version needed scrolling to reach the comments and action buttons.
  `Shell` is now `h-[100dvh] flex flex-col overflow-hidden` at the
  `lg` breakpoint (mobile still scrolls the page normally, since a
  fixed-height split doesn't work on a narrow screen -- `overflow-y-auto`
  there instead), with the header/title/status row `shrink-0` and the
  two-column body taking the remaining height. Left column (email)
  and right column (comments) are each independently
  `overflow-hidden` wrappers around their own internally-scrolling
  content, not one page-level scrollbar -- the email keeps its full
  `max-w-[640px]` realistic-email width (never cropped by the right
  column) and now fills the available vertical height instead of a
  fixed `560px` iframe. The comments thread is sorted **oldest-first,
  newest-last** (reversed from the admin detail page's
  newest-first feed) with a ref-based auto-scroll-to-bottom on load
  and on every new comment, chat-style; the "Add a comment" box sits
  directly below the thread (ClickUp's own comment-composer placement,
  not above it like the admin detail page does), and the
  Approve/Request-changes buttons sit below that, in their own
  bordered section at the bottom of the same column -- matching the
  explicit instruction to mirror "la pantalla de creación de
  comunicados" (the admin detail page's right-column structure) rather
  than inventing a new layout.
- **Annelise now gets notified on every reviewer action on the public
  review page, not just approval** (Oct 2026) -- per explicit
  instruction ("en cada acción que se requiera notificación").
  `sendApprovedNotificationEmail.ts` was replaced with a shared
  `lib/services/communications/notifyAnnelise.ts` (same
  `annelise@axiskey.com` recipient, `mike@axiskey.com` CC, same
  best-effort/non-blocking gating), called from all three
  `app/api/communications-review/[token]/*` route handlers: `POST
  .../approve` ("Approved: `<title>`"), `POST .../request-changes`
  ("Changes requested: `<title>`", quoting the actual comment left),
  and `POST .../comments` ("New comment: `<title>`", quoting the
  comment). All three link to the real admin page
  (`/admin/communications/[id]`), same reasoning as before -- the
  public review token is often already dead by the time these fire
  (request-changes and approve both move status off
  `pending_approval`), and the admin page is what Annelise needs to
  act regardless.
- **The approval email's two logos showed as broken-image icons in
  Outlook desktop** (reported live, Oct 2026, with a real screenshot
  from an Outlook inbox) -- confirmed root cause: **Outlook's desktop
  app (the Word-based rendering engine on Windows) refuses to render
  base64-embedded `data:image/...;base64,...` `<img>` sources at all**,
  even though the exact same HTML renders fine in Gmail and Apple
  Mail. The user's original template had both logos inline that way.
  Fixed by extracting them to real files -- decoded verbatim from the
  original base64 (pixel-for-pixel identical, not re-exported or
  recompressed) to `public/email/approval-header-axis-logo.jpg` (the
  small header "AXIS" mark) and
  `public/email/approval-footer-axiskey-logo.png` (the footer
  "AxisKey" wordmark) -- and referencing them by public HTTPS URL
  (`${getSiteBaseUrl()}/email/...`, via a new `baseUrl` param threaded
  into `approvalEmailHtml()`) instead of inlining the bytes.
  **General rule for any future email HTML in this codebase**: never
  embed images as base64 `data:` URIs -- host them as real files
  under `public/` (or anywhere else with a stable public HTTPS URL)
  and reference them by URL, since Outlook desktop is a large enough
  share of real investor/admin inboxes that base64 images will
  silently break for a meaningful fraction of recipients.
- **Annelise's notification emails (comment/changes-requested/
  approved) are now branded with the same AxisKey template shell as
  the approval-request email**, not plain unstyled HTML -- per
  explicit feedback on a real screenshot ("no me gusta este formato.
  hazle parecido al mail de request for approval"). `notifyAnnelise.ts`
  gained its own `notificationEmailHtml()` (header accent bar, AXIS
  logo, eyebrow label, headline, greeting, intro line, an optional
  quoted-text box for comments/changes-requested, a yellow pill CTA
  "Open This Communication", and the same dark AxisKey footer),
  reusing the identical two hosted logo files
  (`public/email/approval-header-axis-logo.jpg`,
  `public/email/approval-footer-axiskey-logo.png`) as
  `sendApprovalEmail.ts` rather than duplicating or re-embedding them.
  `notifyAnnelise()`'s signature changed from a single free-text
  `message` string to `{eyebrow, headline, introHtml, quoteHtml?}` --
  all three call sites
  (`app/api/communications-review/[token]/{approve,request-changes,
  comments}/route.ts`) were updated to match: approve has no
  `quoteHtml` (nothing to quote), request-changes and comments both
  quote the actual text in the highlighted box.
- **Both hosted logo files from the Outlook base64 fix above were
  themselves corrupted (found Oct 2026, from a real screenshot showing
  broken-image icons for both logos in every email, not just Outlook)**:
  the "verbatim decode from the original base64" that produced
  `public/email/approval-header-axis-logo.jpg` and
  `approval-footer-axiskey-logo.png` silently truncated both files --
  confirmed with the same completeness checks added for the PDF
  Generator bug the same day (`isCompleteImage` in
  `lib/pdfGenerator/generate.ts`): neither file's JPEG ended with the
  `FFD9` EOI marker nor the PNG with its IEND chunk, and trying to
  actually decode either one (`sharp`) failed outright ("premature end
  of data segment" / "libpng read error") -- not just a missing
  trailer, real pixel data was gone. **So the Outlook fix never
  actually fixed anything**: these two files have been broken in every
  email client (Gmail, Apple Mail, Outlook alike), not just Outlook,
  ever since that commit shipped -- the base64 inline images it
  replaced would at least have rendered in non-Outlook clients.
  `approval-header-axis-logo.jpg` is fixed (Oct 2026): the user
  supplied a fresh, complete, byte-valid 200x73 JPEG of the same AXIS
  mark (confirmed decodable). **`approval-footer-axiskey-logo.png` is
  still broken** -- its corruption is mid-IDAT (real pixel data
  missing, not just a missing trailing chunk), so unlike a
  missing-IEND-only file it can't be mechanically repaired by
  re-appending a valid trailer; a fresh complete export of the
  AxisKey wordmark is needed from the user before the footer logo will
  render anywhere. Until that's supplied, every email built from
  `sendApprovalEmail.ts`'s or `notifyAnnelise.ts`'s shared template
  shell still has a broken footer logo. Lesson for any future
  "extract an image from base64/elsewhere and commit it to `public/`"
  step in this codebase: verify the written file actually decodes
  (don't trust `file`'s magic-byte check alone, which both corrupted
  files still passed) before considering it fixed.

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

**The "Document name" pattern editor (`config.fileNamePattern`) lives
in the "2. Generate PDFs" tab (`BulkGenerator.tsx`), not "1. Mapping"
(Oct 2026)** — it used to be a panel in `MappingEditor.tsx`'s sidebar,
but per explicit feedback ("el document name solo debería salir en el
generate pdf") it only matters for generation, not for placing fields
on the page, so it moved. Still the same `config.fileNamePattern`
field persisted through the same `onChange`/"Save mapping" flow —
`PdfTemplateWorkspace.tsx` now passes `onChange={setMapping}` into
`BulkGenerator` too, not just `MappingEditor`.

Excel import (`lib/pdfGenerator/xlsx.ts`'s `parseXlsx`) is a from-
scratch, browser-only .xlsx reader (unzips with fflate, reads the raw
XML with DOMParser — no spreadsheet library) that has to handle two
completely different ways Excel can put a picture in a cell: legacy
floating pictures anchored over a cell (`twoCellAnchor`/
`oneCellAnchor` in a `drawing` part) and Excel 365's newer "Place in
Cell" picture (a rich-value cell, resolved through
`xl/metadata.xml` -> `xl/richData/rdrichvalue.xml` ->
`xl/richData/richValueRel.xml` -> the actual media file). **Reported
broken live (Oct 2026)**: imported Document Name and Logo not loading
correctly from a real user Excel file — not yet root-caused, since
diagnosing a hand-rolled OOXML parser without the actual failing file
is guesswork; next step is getting that real .xlsx from the user and
tracing `parseXlsx`/`mapSheetToFields` against its actual XML
structure (Excel's picture XML varies by version/OS/Mac vs Windows,
and this parser was never tested against that range).

**Bulk-generated PDFs corrupted / "may be damaged" in macOS Preview
(Oct 2026), fixed in `prepareLogo()` (`lib/pdfGenerator/generate.ts`):**
reported from a real "Wire Instructions" batch (Excel-imported company
logos) where several output PDFs wouldn't open in Preview and Quick
Look couldn't even thumbnail one of them, while most of the batch was
fine. Root-caused by reproducing the actual generation + ZIP pipeline
standalone (pdf-lib + fflate, same versions as this repo) against
deliberately truncated PNG/JPEG bytes, since a truncated source image
is exactly what the still-open Excel logo-import bug above can produce:
- A **truncated PNG fed to pdf-lib's `embedPng` doesn't throw -- it
  hangs forever** (confirmed: 4+ minutes of 100% CPU on an 8 KB PNG cut
  to 80/50/10% before being killed). This is strictly worse than one bad
  file: it would freeze the whole bulk batch on that row.
- A **truncated/corrupted JPEG fed to `embedJpg` also doesn't throw** --
  pdf-lib doesn't validate JPEG data, it just wraps whatever bytes it's
  given as a DCTDecode stream. The resulting PDF's container (xref,
  trailer, pages) is completely valid -- pdf-lib and presumably Chrome/
  Acrobat would still open it -- but the embedded image stream itself is
  broken. macOS Preview/Quick Look (ImageIO) is markedly stricter about
  malformed embedded JPEG data than other renderers and can refuse to
  open the *entire* PDF over it, which is exactly the reported symptom
  (and why Quick Look couldn't thumbnail the other file either -- same
  underlying ImageIO path).
- A wide battery of *valid* exotic inputs (progressive JPEG, CMYK JPEG,
  interlaced/palette/16-bit PNGs, unicode + emoji file names, duplicate
  doc names hitting the `uniqueFileName` "(2)" suffix path) all round-
  tripped byte-identical through generation + `zipFiles()` with no
  corruption -- ruling out pdf-lib's save(), fflate's `zipSync`, and the
  file-naming/dedup logic as the cause.
- Fix: `prepareLogo()` now checks a PNG ends with the IEND chunk
  (`PNG_IEND`, the fixed 12-byte trailer every PNG ends with) and a JPEG
  ends with the `FFD9` EOI marker *before* trusting raw bytes. A PNG/JPEG
  that fails this check no longer short-circuits to the direct-bytes
  path -- it now falls through to the same canvas-rasterize path already
  used for SVG/WebP/GIF, since the browser's native image decoder
  recovers a partial/slightly-damaged image far more often than pdf-lib
  does, and `canvas.toBlob` always re-encodes a clean, complete PNG
  either way. If the browser's own decoder also can't read it, this now
  throws a clear, catchable error (surfaced through the exact same
  `generateAll()`/`failures` reporting `BulkGenerator.tsx` already had
  for any other per-row generation error) instead of hanging the batch
  or silently baking in a broken image stream.
- This doesn't fix the underlying Excel logo-extraction bug above (still
  unconfirmed without the user's real .xlsx) -- it makes this codebase
  tolerate whatever that bug (or any other source of a bad image file)
  hands it, without hanging or shipping an unopenable PDF.

## Generate Document (per-request-type ClickUp-sourced PDFs, Oct 2026)

A "Generate Document" button next to Deactivate/Edit copy on every
**locked** row in `/admin/forms` (`FormBuilderList.tsx`) opens
`/admin/forms/[id]/document`. Unlike the PDF Generator tool above (a
freeform list of admin-named templates, values typed in or imported from
Excel), this is **exactly one document mapping per request type**, and
every field's value is **pulled live from ClickUp by Order Number**, never
typed in. Built as an explicit pilot on `redemption-request` first (per
explicit instruction) -- the feature is fully generic and the button
shows on every locked type, but it only actually works where that type's
Order Number and other fields are already confirmed in `CUSTOM_FIELD_MAP`
(see the ClickUp workspace layout section above); an unconfirmed type
shows a clear "nothing to map yet" state instead of guessing.

**Why this needed new code instead of just reusing PDF Generator
wholesale**: the box-placement engine (upload a PDF, draw text boxes,
style them, `generatePdf()`) is identical and genuinely reused --
`lib/documentGenerator/types.ts`'s `DocumentField` is a `PdfField` plus
one extra property (`customFieldKey`), so a `DocumentTemplateConfig`
satisfies `PdfTemplateConfig` structurally and
`components/admin/pdfgenerator/MappingEditor.tsx` and
`lib/pdfGenerator/generate.ts`'s `generatePdf()` are both used
**completely unmodified** -- zero changes to the existing PDF Generator
feature, zero added risk to it. What's new is *where a field's value
comes from*: not a name the admin types, but one of this request type's
already-wired ClickUp custom fields, picked from a list
(`ClickUpFieldPicker.tsx`, backed by `GET
/api/admin/request-types/[id]/clickup-fields` ->
`lib/documentGenerator/clickupFields.ts`'s `getKnownClickUpFields()`,
cross-referencing a FormSpec's `submissionMapping.customFields` against
`CUSTOM_FIELD_MAP` -- a key with no confirmed ClickUp field is left out
of the picker entirely, same "never guess an unconfirmed field" rule
this codebase applies everywhere else it touches ClickUp). If an admin
instead uses MappingEditor's own generic "+Text"/"+Image" buttons, that
field gets `customFieldKey: ""` (`DocumentTemplateWorkspace.tsx`'s
`toDocumentConfig()`) and simply renders blank at generation time
(`generatePdf()` already skips an empty value) -- not an error, just a
field with nothing to pull.

- **Storage**: `request_document_templates`
  (`supabase/migrations/019_request_document_templates.sql`, RLS
  enabled, no policies -- service-role only, same strictness as
  `pdf_templates`), one row per `request_type_id` (unique FK), plus a
  private `request-document-templates` bucket. Same signed-upload/
  signed-download URL pattern as `pdf_templates` -- the browser never
  touches the bucket with its own key.
- **The mapping is permanent, independent of any one generation** --
  exactly as asked ("el mapping del documento ya va a quedar guardado
  para siempre"): uploading the base PDF and placing fields happens once
  on `/admin/forms/[id]/document`'s "1. Mapping" tab; "2. Generate" never
  writes back to this row, it only reads the saved mapping plus whatever
  a live ClickUp lookup returns.
- **The actual search-and-fill flow**
  (`lib/documentGenerator/resolveFromClickUp.ts`'s
  `resolveDocumentValuesFromClickUp()`, called from `POST
  /api/admin/request-types/[id]/document-template/generate`): resolves
  the request type's ClickUp List ID (`CLICKUP_LIST_ID_MAP`) and its
  confirmed Order Number field id, then calls a new
  `findTaskByCustomFieldValue()` in `lib/integrations/clickup.ts`.
  **This could not reuse the existing `findTaskIdByName()`** (Order
  Tracking's by-order-number lookup): that one matches ClickUp's task
  **name**, which is correct for the Payment Received Orders list (its
  tasks are literally named after the order number) but wrong here --
  every Operations Hub request list names its tasks after the
  **investor** (`buildTaskName()` in `clickup.ts`), and Order Number
  only ever lives in a custom field. `findTaskByCustomFieldValue()`
  instead uses ClickUp's server-side `custom_fields` task filter
  (`GET /list/{listId}/task?custom_fields=[{"field_id":...,"operator":
  "=","value":...}]`). Once the matching task is found, its full custom
  field values come from the already-existing `fetchClickUpTask()`
  (same live, uncached read Order Tracking uses) -- so "Generate" always
  reflects whatever the ops team has since reviewed and edited directly
  in ClickUp, never the investor's original submission.
- **Dropdown fields decode correctly without a hand-maintained lookup
  table** (per explicit choice to include dropdowns from day one): a
  ClickUp dropdown custom field's stored value on a task is the
  selected option's numeric `orderindex`, not its name or UUID (same
  caveat `lib/orderTracking.ts` already documented and worked around
  with a static `ACCOUNT_TYPE_BY_INDEX` table). Rather than adding
  another static table that can silently drift the moment someone
  reorders options in ClickUp, a new `fetchListCustomFields()` in
  `clickup.ts` (ClickUp's "Get Accessible Custom Fields") is called
  **live, once per Generate click** -- only when at least one mapped
  field is actually a dropdown -- and `orderindex` is matched against
  that field's current live option list. Checkbox fields decode to
  "Yes"/"No"; number fields pull the FormSpec's own field `kind` (is it
  `"currency"`?) to decide whether to prefix `$` and add thousand
  separators, purely for display -- no new data is stored anywhere for
  this, it's read fresh from the FormSpec every time.
- `getListIdForSlug()` and `getCustomFieldTargets()` are thin new
  exports off `clickup.ts`'s existing private `getListIdMap()` and
  `CUSTOM_FIELD_MAP` -- added so this feature (and anything else later)
  can read them without duplicating either map.
- This sandbox cannot reach `clickup.com` (see "Network access from a
  Claude Code" above), so the live search-and-resolve flow was built
  from the same confirmed `CUSTOM_FIELD_MAP`/`fetchClickUpTask()`
  behavior already verified elsewhere in this codebase, not tested
  against a real ClickUp list from here -- **test the full Redemption
  Request pilot against a real order number once deployed** before
  relying on it or extending the pilot to other request types.

### Second pass: live ClickUp names, multiple mappings per type, tab order (Oct 2026)

The pilot above was live-tested against a real Redemption Request task
(confirmed working end to end) before three follow-up changes, all per
explicit feedback from that first real use:

- **The field picker now shows ClickUp's own live field names, not this
  form's question wording.** `getKnownClickUpFields()`
  (`lib/documentGenerator/clickupFields.ts`) is now `async` and calls
  `fetchListCustomFields()` (the same "Get Accessible Custom Fields"
  live call dropdown decoding already used) to read each mapped field's
  current `.name` straight from ClickUp, falling back to the FormSpec's
  own field label only if that live call fails or the field has since
  vanished. The user offered an exported Excel of the Redemptions
  Requests list's real column headers as a source of truth
  ("Current Account Name", "Order Number", "Redemption Amount",
  "Redemption type", "Investor Email", "Client/Capital Raiser Email",
  "Issuer Approved Redemption", confirmed against this list's real
  sample row, order number `4316815030` -- 10 digits, now the Order
  Number field's example placeholder in `GenerateFromOrderNumber.tsx`)
  -- cross-checked against every existing `CUSTOM_FIELD_MAP["redemption-
  request"]` entry and all matched, confirming that map's accuracy.
  Hardcoding those names from the Excel was deliberately rejected in
  favor of the live call: a hardcoded snapshot is exactly the kind of
  drift this file has flagged repeatedly elsewhere (a ClickUp field can
  be renamed with zero warning anywhere in this codebase), while the
  live call can never go stale.
- **A request type can now hold any number of named document mappings**,
  not just one -- per explicit example, "pueden haber tres tipos de
  Redemption Request documents que utilizamos." Migration
  `020_request_document_templates_multi.sql` adds a `name` column to
  `request_document_templates` and drops its one-per-`request_type_id`
  unique constraint (replaced with a plain index). The one mapping
  already created and tested during the pilot became `name = 'Default'`
  automatically (the column's own default value, applied to the
  existing row when the column was added).
- **API routes moved from singular to plural + per-mapping**:
  `/api/admin/request-types/[id]/document-template*` (one implicit
  mapping) was replaced outright with
  `/api/admin/request-types/[id]/document-templates` (list + create) and
  `.../document-templates/[templateId]` (get/patch/delete) and
  `.../document-templates/[templateId]/generate` -- the same shape
  `/api/admin/pdf-templates` already uses, just nested under a request
  type. The old singular route files were deleted, not deprecated.
- **The admin UI split into three pieces** instead of one workspace
  component: `DocumentTemplateWorkspace.tsx` (top-level: loads the list
  of mappings, owns the two tabs), `GenerateTab.tsx` (new -- a `<select>`
  of this type's mapping names, lazily loading the chosen one's bytes/
  config before rendering `GenerateFromOrderNumber.tsx`, which now takes
  an explicit `templateId` instead of assuming one implicit mapping),
  and `DocumentMappingManager.tsx` (new -- the list-create-edit-delete
  UI for mappings, replacing the old single-mapping upload form; editing
  one still shows `ClickUpFieldPicker` + the unmodified `MappingEditor`
  inline, exactly as the pilot did, just reachable per-mapping now
  instead of being the type's only mapping).
- **Tab order swapped: "1. Generate" now comes before "2. Mapping"** --
  per explicit feedback that Generate is the button's actual point day
  to day, Mapping is setup work done rarely. `DocumentTemplateWorkspace`
  defaults `tab` to `"generate"` (was `"mapping"`).
- Still untested against a real ClickUp list from this sandbox for this
  second pass specifically (same standing limitation as the first pilot
  -- `clickup.com` stays unreachable here) -- the live-name fetch and
  the per-mapping generate route reuse the exact same verified
  `fetchListCustomFields()`/`fetchClickUpTask()`/
  `findTaskByCustomFieldValue()` calls the already-confirmed pilot used,
  just re-wired for a `templateId`-scoped mapping instead of an implicit
  one, so re-confirm live once deployed before trusting it blindly.

### Third pass: fixed text fields + full live ClickUp field catalog with pins (Oct 2026)

Two more changes, both per explicit feedback on real screenshots of the
Mapping tab's Fields panel and field picker:

- **Fixed text fields, shared with the plain PDF Generator tool.**
  `PdfField` (`lib/pdfGenerator/types.ts`) gained an optional
  `fixedValue?: string` -- when set (including `""`), that text field's
  value at generation time is always this exact text, regardless of the
  row's own data (manual entry, Excel import, or a ClickUp-resolved
  value). This is a single change in the one function both tools share,
  `generatePdf()` (`lib/pdfGenerator/generate.ts`): it now prefers
  `field.fixedValue` over `values.text[field.id]` when the field is
  fixed, before falling back to `field.defaultValue` the same way it
  always did. Because both the PDF Generator tool and Generate Document
  call this exact function unmodified, this one change covers both --
  `BulkGenerator.tsx` needed zero changes, since a fixed field's value
  is injected regardless of what its row/Excel column holds. The admin
  sets this from `MappingEditor.tsx`'s Fields panel: a "+ Fixed text
  field" button creates a field already in fixed mode, or any existing
  text field can be toggled into it with a checkbox ("Always use this
  exact text (ignore row/ClickUp data)") next to its sample-value input
  -- toggled on, that same input switches from "Sample value for
  preview" to "Fixed text (always used)" and is visually tinted
  (`axis-signal`) so a fixed field reads as different at a glance.
  Toggling off clears `fixedValue` back to `undefined`, reverting to
  normal per-row/per-task behavior.
- **The ClickUp field picker now offers every field currently on the
  list, not just this codebase's hand-curated `CUSTOM_FIELD_MAP`
  entries** -- per explicit instruction ("absolutamente todo lo que
  vayamos a mapear va a estar en ClickUp... tienen que estar acá para yo
  poder mapearlo en el documento, aunque no los utilice"). `DocumentField`
  (`lib/documentGenerator/types.ts`) replaced its old, always-required
  `customFieldKey: string` (an internal FormSpec key) with an optional
  `clickUpFieldId?: string` -- the real live ClickUp custom field id --
  so a field is now valid with either a `clickUpFieldId` (ClickUp-
  sourced) or a `fixedValue` (fixed-text), matching the same shared
  `PdfField.fixedValue` from above. **This is a breaking change for any
  mapping saved before this pass** -- the old `customFieldKey` is no
  longer read at all, so a pre-existing mapping's ClickUp-sourced fields
  (e.g. the "Test" mapping built during the pilot, with 2 fields) lose
  their value source and need to be removed and re-added from the new
  picker (a few seconds: delete the 2 old field rows, re-check them in
  the picker). Not worth a migration shim for what the user themselves
  called a test mapping while this feature was still being iterated on.
  - `lib/documentGenerator/clickupFields.ts`'s `getAllClickUpFields(slug)`
    replaced `getKnownClickUpFields()` -- it calls
    `fetchListCustomFields()` directly and returns the FULL catalog
    (id, live name, a `kind` derived straight from ClickUp's own live
    field `type` string -- `drop_down`/`checkbox`/`currency`/`number`/
    `date`, defaulting to `text`), with no cross-reference against
    `CUSTOM_FIELD_MAP`/`FORM_SPECS` at all.
  - `lib/documentGenerator/resolveFromClickUp.ts` was rewritten the same
    way: it now always fetches `fetchListCustomFields()` (previously
    only when a mapped field was a dropdown) and decodes every
    ClickUp-sourced field purely from that live field's own `type` +
    `type_config`, keyed by `clickUpFieldId` -- no more per-field
    lookup through `FORM_SPECS`/`CUSTOM_FIELD_MAP` for decoding (that
    map is still used for exactly one thing here: resolving the Order
    Number field to search the task by, via
    `getCustomFieldTargets(slug).orderNumber`, unchanged). A field with
    no `clickUpFieldId` (a fixed-text field) is skipped in this
    resolver entirely -- `generatePdf()` already has its fixed value
    and never looks at the resolved values map for it.
  - **"Pinned" fields, scoped per request type (not per mapping)** --
    confirmed explicitly with the user via `AskUserQuestion` ("Por tipo
    de request (Recomendado)"), so every document mapping a request
    type has shares the same pinned set. New column
    `request_types.pinned_clickup_fields` (jsonb array of ClickUp field
    ids, migration `021_request_type_clickup_field_pins.sql`, default
    `[]` -- **needs the migration run in the Supabase SQL editor**).
    `GET /api/admin/request-types/[id]/clickup-fields` now returns
    `{all, pinnedIds}` (the full live catalog plus the pinned subset)
    instead of the old `{fields}`; a new `PATCH
    /api/admin/request-types/[id]/clickup-field-pins` (body
    `{fieldIds: string[]}`) replaces the full pinned set in one call --
    the UI always sends the complete set after a toggle, not a diff,
    same pattern as Communications' recipient selection.
  - **`ClickUpFieldPicker.tsx` rewritten**: the main checklist now shows
    only pinned fields not already in the mapping, plus a "+ Add fixed
    text field" button (adds a field with `fixedValue: ""` directly,
    same one the admin can also create from `MappingEditor.tsx`). A
    "View More ClickUp Fields" toggle expands a scrollable, filterable
    list of every field in the full live catalog, each with its own
    Pinned checkbox (toggling calls the pins PATCH immediately,
    optimistic update, reverts and shows an error if the save fails) --
    pinning something there makes it appear in the main checklist right
    away without closing the panel. A "Refresh" button next to the
    panel title re-fetches `GET .../clickup-fields` on demand, so a
    field just created directly in ClickUp (or renamed/retyped there)
    shows up without a code change or redeploy.
- Still untested against a real ClickUp list from this sandbox for this
  third pass specifically (same standing limitation as every prior pass
  -- `clickup.com` stays unreachable here) -- re-confirm live once
  deployed: re-pick the Redemption Request pilot's 2 fields from the new
  picker, confirm "View More ClickUp Fields" actually lists every field
  on that list (including ones never in `CUSTOM_FIELD_MAP`), confirm
  pinning/unpinning persists across a page reload, and confirm a fixed
  text field's value shows up correctly in a generated PDF from both the
  PDF Generator tool and Generate Document.

### Fourth pass: seeding a starting pinned set from CUSTOM_FIELD_MAP (Oct 2026)

With `pinned_clickup_fields` live but empty by default, the user asked
for a sensible starting "pinned" set per request type instead of every
admin starting from zero and manually pinning each field. The user's
own screenshots of ClickUp's per-task field panel (hovering a field's
pin icon shows "Pin"/"Unpin") turned out not to be a reliable source:
ClickUp's own per-task "pin" toggle isn't exposed anywhere in its REST
API, so there would be no way to read it back even with live network
access, and the two screenshots of the same task's panel also showed
what looks like an accidental field deletion ("Additional File",
`3d082ed6...` -- the exact id `ATTACHMENT_FIELD_MAP["redemption-
request"].redemptionAgreement` points to) happening while the pin icon
was being hovered -- flagged to the user to confirm/restore in ClickUp,
since if that field is really gone, redemption attachments will start
silently failing to link into that custom field (same as the
`FIELD_250` limitation already documented above, just now possibly
missing the field entirely rather than merely unable to write to it).

Instead, per the user's own definition ("los que están pineados son los
que utilizamos con frecuencia" -- the ones pinned are the ones we use
often) and their explicit confirmation this should differ per list, not
share one set, `supabase/migrations/022_pin_confirmed_clickup_fields.sql`
seeds each locked request type's `pinned_clickup_fields` from that
type's own already-confirmed `CUSTOM_FIELD_MAP`/`ATTACHMENT_FIELD_MAP`
entries in `lib/integrations/clickup.ts` -- i.e. exactly the ClickUp
fields that type's form already submits to, a reliable, already-live-
verified proxy for "frequently used," with zero guessing and no need to
reach ClickUp. Each of the 9 slugs with confirmed field maps gets its
own distinct `update ... where slug = '...'` block with only that
list's own ids (title-transfer-request, redemption-request,
ira-funding-request, refund-request, side-letter-request,
investor-information-update, account-maintenance-request,
document-request, axiskey-report-request) -- **needs this migration run
in the Supabase SQL editor, after migration 021**.
`investment-change-name-request` and `transfer-agreement-request` have
no `CUSTOM_FIELD_MAP` entries yet (see their own sections above), so
nothing is seeded for them; `investor-update-request` isn't wired into
`CUSTOM_FIELD_MAP` at all and is skipped for the same reason. This is
only a starting default -- fully editable afterward per request type
from "View More ClickUp Fields" in the Generate Document mapping
editor, same as any other pin.

## AxisKey Orders (`/admin/orders`, Oct 2026)

A new "AxisKey Orders" nav item in the admin sidebar, mirroring the
same ClickUp list Order Tracking already reads from
(`ORDER_TRACKING_LIST_ID = "901113961474"` in `lib/orderTracking.ts`) --
**the user renamed this list in ClickUp from "Payment Received Orders"
to "AxisKey Orders"** around the same time, to avoid confusion with this
new admin page; the list id itself is unchanged, so nothing in Order
Tracking needed updating. Per explicit instruction, this replicates
ClickUp's own List view as closely as this codebase already understands
the list's fields: grouped by native ClickUp status (same groups/order
ClickUp's List view itself uses, e.g. "NEW PENDING ORDERS", "PENDING
ORDERS - PAID"), refreshed on every page load and via its own "Refresh"
button -- **always a live read, nothing here is ever cached or stored**.

- `GET /api/admin/orders` (`requireAdmin`-gated) fetches the whole list
  fresh on every call: `fetchListDetails()` (new export in
  `lib/integrations/clickup.ts`, ClickUp's "Get List", for the
  `statuses` array's live `orderindex` -- so groups sort exactly the way
  ClickUp's own workflow currently orders them, not a hardcoded guess)
  and `fetchAllListTasks()` (new export, paginates
  `GET /list/{listId}/task` up to 50 pages/~5,000 tasks, unlike
  `findTaskIdByName()`'s 10-page early-exit search -- this needs every
  task, not one match).
- **Row decoding deliberately reuses `lib/orderTracking.ts` instead of
  re-deriving anything**: `lib/adminOrders.ts`'s `decodeOrderRow()`
  reads straight off the already-confirmed `ORDER_TRACKING_FIELD_IDS`,
  `ACCOUNT_TYPE_BY_INDEX`, `DEAL_TYPE_BY_INDEX`, and the small decode
  helpers (`fieldValue`/`isChecked`/`textValue`/`numberValue`/
  `dropdownIndex`) -- all newly exported from that file (were module-
  private) specifically so this page can't drift out of sync with the
  investor-facing page's own field mapping for the same list.
- **Only the 15 fields `ORDER_TRACKING_FIELD_IDS` already confirms are
  shown.** The user's own ClickUp view (and the Excel export shared in
  chat) also has a few more columns on this list -- Issued Shares, New
  Investor, Tracking Link, Accreditation Email Status -- whose field ids
  were never confirmed anywhere in this codebase (Order Tracking's
  investor-facing page never needed them). Rather than guess an id and
  risk the exact silent-no-op mistake this file warns about repeatedly
  elsewhere, they're left out of the table for now. Add them the same
  way every other field here was confirmed (a real
  `clickup_get_custom_fields` call, or an `audit-fields.mjs`-style
  check from a machine with real ClickUp access) and extend
  `AdminOrderRow`/`decodeOrderRow()`/`COLUMNS` in `AdminOrdersView.tsx`.
- **Checkbox columns keep the list's own inverted meaning** ("checked =
  problem/pending", already documented for this exact list in
  `orderTracking.ts`) -- rendered as a small red "!" badge when true, an
  empty outlined square when false, not a green check, so a glance at
  the table reads as "what's wrong with this order" rather than
  "what's done."
- **Groups default collapsed**, each a header with the status name (CSS
  uppercased, matching ClickUp's own all-caps group headers) and a
  count, click to expand -- avoids rendering a 273-row table (a real
  count seen in the user's screenshot) on page load. Each expanded
  group's table scrolls horizontally (`min-w-[1400px]`, 17 columns) with
  a sticky header row, mirroring how ClickUp's own wide list view works.
- This sandbox cannot reach `clickup.com` (see "Network access from a
  Claude Code" above), so this was built and verified structurally
  (typecheck, build, a clean 200 with no Supabase/ClickUp configured)
  but not exercised against the real live list from here -- **confirm
  the grouping, counts, and column values against the real ClickUp view
  once deployed**, especially that `fetchListDetails()`'s `statuses`
  array actually orders groups the way the screenshot showed (new
  pending orders before pending orders - paid, etc.).
- No editing, filtering, or sorting controls yet -- purely a read-only
  mirror for this first pass, per the user's own "ya te digo qué otras
  funciones más adelante" (more features to come later, described
  separately when they're ready to spec them).

## Admin Overview redesign (`/admin`, Oct 2026)

`AdminOverview.tsx` was reworked a second time, per explicit feedback on
the first pass (an earlier priority-ordered, fully-collapsible layout
with a Last 30 Days/All Time toggle, never documented here) -- "no me
gusta como quedo. haz una nueva propuesta," plus three concrete asks:
important info has to actually show (not live behind a click), the
Schedule a Call button has to always be visible at the top, and
generating a link should pop up a dialog instead of revealing it inline.

- **"About ClickUp Sync" removed entirely**, including the component it
  rendered (`components/ClickUpSyncNotice.tsx`, deleted outright --
  nothing else referenced it) -- the user said this static "sync
  limitations" notice is no longer needed.
- **Schedule a Call is now a permanent banner pinned right under the
  page header**, not a collapsible section -- a dark `bg-axis-core` card
  with the "Generate one-time link" button in `axis-signal`, always
  rendered above every metric on the page (KPIs, the failed-sync alert,
  Recent Requests), never inside the accordion system. This directly
  satisfies "el boton para agendar meetings siempre tiene que verse
  arriba."
- **Generating a link now opens a popup** (a `fixed inset-0` modal
  overlay, same pattern as `QuickCreateModal.tsx` --
  `bg-axis-core/50` backdrop, click-outside-to-close, `shadow-modal`
  panel) showing the link in a read-to-copy input plus a Copy button,
  instead of the old inline reveal row under the button. Replaces,
  rather than duplicates, the earlier inline UI.
- **"Recent Requests" is no longer collapsible** -- it always renders in
  full (same markup/behavior as before, just outside the
  `CollapsibleSection` wrapper) immediately after the KPI grid and the
  failed-sync alert, since this was explicitly called out as important
  info that shouldn't require a click to see. The failed-sync alert's
  "Review and retry" button still scrolls to it (`recentRef`), just
  without needing to also force a section open first.
- **Everything else stays a collapsible accordion under a new "More
  metrics" label** -- ClickUp Sync Health, Requests by Type, Investor
  Experience Rating, Investor Update Requests -- all closed by default,
  same progressive-disclosure reasoning as before: these are real
  metrics worth having, just not what an admin needs at a glance on
  every visit. `SectionKey`/`openSections` was narrowed to only these
  four keys now that Schedule a Call and Recent Requests no longer
  belong to the collapsible system.

### Second redesign pass: no more collapsing anywhere, compact row, paginated Recent Requests (Oct 2026)

Direct follow-up feedback on the pass above, same day: the user liked
the direction overall, but explicitly rejected the remaining
`CollapsibleSection`/`openSections` accordion system entirely --
"no me gusta que le hagas como cerrándose... todo que esté abierto
solamente menos información y más como apretado" (don't collapse
anything, show it all, just make each piece show less and sit tighter).
`CollapsibleSection`/`ChevronDownIcon`/`SectionKey`/`openSections` were
deleted outright -- nothing on this page toggles open/closed anymore.

- **ClickUp Sync Health, Investor Experience Rating, and Requests by
  Type now share one compact 3-column row** (`grid lg:grid-cols-3`)
  instead of three full-width stacked sections -- per explicit
  complaint that stacking them wasted "mucho espacio de izquierda a
  derecha." Each is a small `CompactCard`: Sync Health shows 3 tight
  `MiniStat` lines (Synced/Failed/Pending, Failed in red when > 0)
  instead of 3 big `KpiCard`s; Investor Experience Rating shows just
  the average-rating number + star + rating count (the histogram and
  Recent Comments list from the first pass were dropped entirely, not
  hidden behind anything -- "menos información" was explicit); Requests
  by Type drops its progress-bar visualization for a tight name/count
  list.
- **Requests by Type now only lists currently-active request types**
  (per explicit instruction: "pondría solamente los request types que
  están activos... si es que no está activo... no le pondría ahí") --
  `GET /api/admin/stats` (`app/api/admin/stats/route.ts`) now also
  queries `request_types` for `is_active = true` and returns
  `activeSlugs: string[]` (fails open to every slug on a lookup error,
  same default as every other active/inactive check in this codebase),
  and `AdminOverview.tsx` filters `REQUEST_TYPES` against it before
  rendering that card. The whole card shows "No requests yet" instead
  of an empty list when `stats.total === 0`, matching "si es que
  obviamente no hay... no le pondría."
- **Recent Requests now shows 4 at a time with Prev/Next pagination**
  (`RECENT_PAGE_SIZE = 4`, client-side pagination over the list `GET
  /api/admin/stats` returns) instead of one long list -- per explicit
  instruction, after going back and forth on the exact number ("los
  últimos tres"... "diez"... settling twice on "solamente los últimos
  cuatro"). The API's own `recent` slice was bumped from 10 to 40 rows
  so paging actually has real further pages to show instead of running
  out after 2-3 clicks. `recentPage` resets to 0 on a range switch and
  when "Review and retry" jumps to this section, so a failed sync (
  almost always among the most recent requests) is reliably on the
  first page the admin lands on.
- **Investor Update Requests** is now a plain always-visible card (same
  KPI grid as before), just no longer wrapped in an accordion.

## Admin-editable ClickUp field connections (`/admin/forms/[id]`, pilot on redemption-request, Oct 2026)

Until now, which ClickUp custom field a locked form question's answer
gets written to lived only in `CUSTOM_FIELD_MAP`/`ATTACHMENT_FIELD_MAP`
(`lib/integrations/clickup.ts`) -- hardcoded in source, changeable only
via a code change + deploy. The user asked (after looking at the Form
Builder's field cards, which already show each locked field's internal
code name, e.g. "typeOfTransfer") whether a field could instead be
connected to a ClickUp field id directly from that UI, with a visible
green check / red X for whether it's actually connected. Explicitly
chose **typing the ClickUp field id by hand** over a live-fetched
dropdown picker (the latter was offered and declined) -- confirmed via
`AskUserQuestion` -- and to pilot this on **Redemption Request only**
first, same scoping pattern as every other ClickUp-touching feature
this session.

- **New table** `request_type_clickup_field_map`
  (`supabase/migrations/023_request_type_clickup_field_map.sql`, RLS
  enabled, no policies -- service-role only, same strictness as every
  other admin-only table): `(request_type_id, field_key)` unique,
  storing `clickup_field_id`, `kind` (`text`/`number`/`checkbox`/
  `dropdown` -- matches `ClickUpFieldTarget`'s kind union, not
  ClickUp's own raw type string), and `option_map` (form option value ->
  ClickUp dropdown option id, only meaningful when `kind = 'dropdown'`).
  A row here **overrides** `CUSTOM_FIELD_MAP` for that one field key at
  sync time; a field key with no row still falls back to
  `CUSTOM_FIELD_MAP` unchanged, so nothing already working regresses
  just because this table exists. **Seeded for redemption-request's 9
  fields** from the exact ids already confirmed in
  `CUSTOM_FIELD_MAP["redemption-request"]`, so the pilot opens already
  "connected" instead of blank -- **needs this migration run in the
  Supabase SQL editor, after migration 022**. Known, accepted gap:
  `redemptionAmount` sends to two ClickUp fields in `CUSTOM_FIELD_MAP`
  (both always carry the same value on real tasks); this table only
  supports one target per field key, so only the primary id was seeded
  -- this new system can't yet represent a field that fans out to more
  than one ClickUp field.
- **`lib/integrations/clickup.ts`**: `syncRequestToClickUp()` gained an
  optional second parameter, `fieldMapOverrides` -- merged on top of
  `CUSTOM_FIELD_MAP[payload.requestType]` (`{ ...CUSTOM_FIELD_MAP[slug],
  ...fieldMapOverrides }`, so an override key wins, every other key
  still comes from the hardcoded map). New export
  `clickUpTypeToWriteKind(type)` maps a live ClickUp field's own `type`
  string to the 4-way kind `resolveFieldValue()` actually knows how to
  write (`currency` collapses into `number`; every other unhandled type,
  including `date`, falls back to `text` -- connecting to a true date
  field "succeeds" here but won't actually format correctly, a known gap
  since `resolveFieldValue` has no real date case).
- **`lib/services/clickupFieldMapOverrides.ts`** (new): loads this
  request type's map rows and shapes them into `fieldMapOverrides`.
  Called from `lib/services/requestSync.ts`'s `syncRequestAndPersist()`
  (the one function both real sync paths -- new submission and the
  admin's "Retry" button -- go through), so both pick this up
  automatically with no other call-site changes.
- **Two new admin API routes**: `GET
  /api/admin/request-types/[id]/clickup-field-map` (the full map for
  this request type, keyed by `field_key`) and `POST
  .../clickup-field-map/connect` (body `{fieldKey, clickupFieldId,
  optionMap?}`) -- the connect route always does a **live** lookup
  (`fetchListCustomFields()`) against this request type's real ClickUp
  list first; an id that doesn't exist there returns `{ok: false}`
  (never saved) rather than being trusted blind, same "never guess an
  unconfirmed ClickUp field" rule this file has flagged repeatedly
  elsewhere. On success it derives `kind` live and, for a dropdown
  field, also returns that field's live option list so the UI can offer
  a per-option picker on a second call.
- **UI**: `FieldEditorPanel.tsx` (the slide-over opened from a locked
  field's card in `/admin/forms/[id]`) gained a new "ClickUp field
  connection" section, only for `isCodeManaged` fields -- a plain text
  input for the ClickUp field id (monospace, matches the existing
  "Internal field name" input's style) plus a Connect button, with a
  green "✓ Connected" / red "✕ Failed" indicator exactly as asked. For a
  dropdown-type question (e.g. Redemption Type), a successful connect
  reveals a per-option `<select>` (each populated with that field's real
  live ClickUp options) to match the form's own option values to
  ClickUp's option ids, plus its own "Save option mapping" button --
  both buttons call the same connect endpoint, the second one just also
  sends `optionMap`. `RequestTypeEditor.tsx` fetches the whole map once
  on load and passes each field's own entry + a setter down into the
  panel so the indicator state persists correctly as the admin moves
  between fields without a re-fetch.
- Not yet tested against a real ClickUp list from this sandbox
  (`clickup.com` stays unreachable here, per the standing note above) --
  **confirm live on Redemption Request once deployed**: that an already
  -seeded field shows "Connected", that typing a real id for an
  unconnected field and clicking Connect actually flips it green, that
  a bad/typo'd id shows red, and that a real test submission on
  Redemption Request actually lands in the fields this table points at
  (not just the ones still coming from `CUSTOM_FIELD_MAP`). Extend to
  the other 10 locked types only after this pilot is confirmed working
  end to end, per the user's own explicit pilot-first scoping.
