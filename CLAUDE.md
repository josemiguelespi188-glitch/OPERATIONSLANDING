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
`lib/integrations/clickup.ts`) are only fully wired for `ira-funding-request`
and `account-maintenance-request` — every field on their form has a
confirmed ClickUp field ID. Every other list is missing at least one field
(a Sept 2026 audit found several fields that were silently landing in the
task description only, never in their own ClickUp Field, because
`CUSTOM_FIELD_MAP` had no entry for them). Still pending a
`scripts/clickup/provision-forms.mjs` run (from a machine with real
internet access — this sandbox can't reach clickup.com) for:
- `refund-request` — brand-new list, no fields created yet (Investor
  Email, Reason for Refund, Refund Amount, Additional File).
- `document-request` — existing list, never provisioned (Offering Name,
  Document Needed, Requester Email, Note).
- `title-transfer-request` — otherwise fully confirmed, but Investor
  Email and Requester Email were never wired to a field.
- `redemption-request` — otherwise fully confirmed, but Investor Email,
  Requester Email, and the "Issuer Approved Redemption" checkbox were
  never wired to a field.
- `side-letter-request`'s "Side Letter Type" dropdown — new field
  replacing the old free-text "Side Letter Terms".
- `investor-information-update`'s "Order Number" — new field on this
  list.
- `axiskey-report-request`'s "Report Type" dropdown — its option set
  changed entirely; the script only creates a dropdown once and won't
  update an existing one's options, so replace them manually in ClickUp
  first, then add the field/option IDs to `CUSTOM_FIELD_MAP` by hand.

The form specs already send all of the above in `submissionMapping.
customFields` (see each `lib/formSpecs/<slug>.ts`) — once the script
returns real field IDs, wiring them into `CUSTOM_FIELD_MAP` is the only
remaining step, no form code needs to change.

If a list's fields ever change again, re-run the script (it's idempotent
for field *creation* — matches by field name — but never edits an
existing field's options) and update `CUSTOM_FIELD_MAP` with whatever it
prints.

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

## Public site layout

The public site (home page + every request form) is deliberately a single
screen with no sidebar — a sidebar nav was tried (Aug 2026) and explicitly
rejected: "no quiero que vaya esa franja negra a la izquierda... está de
más." Don't reintroduce `PageShell`/`Sidebar` there; those components are
now admin-only (`app/admin/layout.tsx`). `<ClickUpSyncNotice />` lives on
the admin Overview page (`components/admin/AdminOverview.tsx`), not on
any public page — same reasoning, the public Operations Hub Center screen
should show nothing but the request cards.

## Style

No em dash (`—`) in any user-facing platform text — form labels,
descriptions/helper text, button/UI copy, error messages shown to a user,
ClickUp task description fallbacks. It's fine in source code comments,
README.md, SQL comments, and CLI/script console output — none of that
renders to a user.

## Admin login test credentials

`components/admin/AdminLoginForm.tsx` currently pre-fills the login form
with `ir@axiskey.com` / a test password, for faster QA sign-in. Clearly
marked `// TEMP` in that file — remove before this is rolled out beyond
the internal testing team, since it puts a real password in client-side
source.
