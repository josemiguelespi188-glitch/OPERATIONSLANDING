# AxisKey Operations Hub — project notes

Internal request-intake app (Next.js + Supabase) that syncs submissions to
ClickUp tasks. See README.md for the full architecture; this file holds
facts that don't belong in code comments but matter for future work here.

## ClickUp workspace layout

Team/workspace id: `9011712515`. Space: **Investor Relations**. Folder:
**Axis Operations Hub**. Confirmed List IDs (Aug 2026), one per request
type slug — keep this in sync with `CLICKUP_LIST_ID_MAP` wherever that env
var is actually set (see below):

| slug | ClickUp List | List ID |
|---|---|---|
| `ira-funding-request` | IRA Funding Request | `901112504693` |
| `title-transfer-request` | Title Transfer Requests | `901114002885` |
| `redemption-request` | Redemptions Requests | `901114014583` |
| `side-letter-request` | Side Letter Requests | `901114320630` |
| `investor-information-update` | Investor Information Update | `901114375425` |
| `account-maintenance-request` | Account Maintenance Request | `901114375429` |
| `document-request` | Document Request | `901114375430` |
| `custom-request` | Custom Request | `901114375433` |
| `axiskey-report-request` | Request an AxisKey Report | `901114375435` |

`document-request` has no dedicated page under `app/forms/` yet (falls
back to the generic `RequestModal`), so it's low priority to wire up
custom fields for, but its List ID is included above for completeness.

Full JSON for `CLICKUP_LIST_ID_MAP` (see `.env.example`):
```json
{"ira-funding-request":"901112504693","title-transfer-request":"901114002885","redemption-request":"901114014583","side-letter-request":"901114320630","investor-information-update":"901114375425","account-maintenance-request":"901114375429","document-request":"901114375430","custom-request":"901114375433","axiskey-report-request":"901114375435"}
```

**This is an env var only — it is never committed to the repo.** It's set
on Vercel (confirmed live, Aug 2026). The same applies to
`CLICKUP_API_TOKEN`.

Per-list custom field IDs (`CUSTOM_FIELD_MAP` / `ATTACHMENT_FIELD_MAP` in
`lib/integrations/clickup.ts`) are wired for 8 of the 9 lists: the 3
original forms (`ira-funding-request`, `title-transfer-request`,
`redemption-request`, confirmed against real submitted tasks) plus
`side-letter-request`, `investor-information-update`,
`account-maintenance-request`, `custom-request`, and
`axiskey-report-request` (confirmed by running
`scripts/clickup/provision-forms.mjs` from a GitHub Codespace, Aug 2026 —
see that script's output history in the session that ran it for the raw
field/option IDs). Only `document-request` has no wiring, since it has no
dedicated form page yet. If a list's fields ever change in ClickUp,
re-run the script (it's idempotent — matches by field name) and update
`CUSTOM_FIELD_MAP` with whatever it prints.

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

The forms under `app/forms/<slug>/page.tsx` for `ira-funding-request`,
`title-transfer-request`, `redemption-request`, `side-letter-request`,
`investor-information-update`, `account-maintenance-request`,
`custom-request`, and `axiskey-report-request` are all "locked" in the
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
