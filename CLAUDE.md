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

## Admin login

`components/admin/AdminLoginForm.tsx` no longer pre-fills any credentials
(it briefly did, for QA convenience — that put a real admin password in
client-side source, visible to anyone who loaded `/admin` without signing
in, so it was removed). Since that password was exposed both in this
source and in chat history, treat it as compromised and rotate it (and
any other admin password shared the same way) in the Supabase dashboard.
