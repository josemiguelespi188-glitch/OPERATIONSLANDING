# AxisKey Operations Hub

Internal request center for AxisKey. A single page where staff go to submit
operational process requests (IRA funding, title transfers, redemptions,
etc.) instead of hunting through emails, SOPs, and scattered links.

This is **not** a client portal, investor portal, or CRM — it's an internal
tool.

## Tech stack

- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Supabase (Postgres + Storage), accessed via Next.js API routes
- **Deployment:** Vercel
- **Future integrations:** ClickUp API, n8n, email notifications

## Project structure

```
app/
  page.tsx                 Landing page (single page app)
  layout.tsx                Root layout, fonts
  api/requests/route.ts     POST — creates a request
  api/admin/stats/route.ts  GET — KPIs for the Admin panel
components/
  Logo.tsx                  Wordmark placeholder (swap for real logo asset)
  RequestCard.tsx            One process card
  RequestModal.tsx           Request form (modal)
  AdminPanel.tsx              Admin KPI panel
lib/
  requestTypes.ts             Source of truth for the 7 process types
  payload.ts                  Builds the integration-ready payload
  types.ts                    Shared TypeScript types
  supabase/client.ts           Browser Supabase client (anon key)
  supabase/server.ts           Server Supabase client (service role key)
  integrations/clickup.ts      ClickUp sync — stubbed, not wired up yet
  integrations/n8n.ts          n8n webhook trigger — stubbed, not wired up yet
supabase/
  schema.sql                  Tables, indexes, RLS policies
  seed.sql                    Seeds request_types + creates storage bucket
```

## Brand

Implemented from the AxisKey Brand Identity Guidelines (Jan 2026).

- **Colors:** Axis Core `#201C1A` (primary dark/text), Axis Signal `#E3F464`
  (accent — emphasis/CTAs only, never dense text or full-page backgrounds),
  Axis Base `#CEC1A9` (warm neutral, secondary surfaces), Axis Light
  `#F2F2F2` (light neutral, page/table backgrounds), White `#FFFFFF`
  (default background). Defined as Tailwind tokens (`axis-core`,
  `axis-signal`, `axis-base`, `axis-light`) in `tailwind.config.ts`.
- **Typography:** Eurostile (Regular/Medium only) for headlines, used
  sparingly and at scale — never for body copy. Helvetica Now / Inter for
  everything else; per the guidelines, Inter is the approved digital
  fallback for web applications, so it's the primary body font here (no
  fallback chain needed). Loads via `next/font/google`. Eurostile is a
  licensed font not included in this repo — drop the files into
  `public/fonts` and uncomment the `@font-face` block in
  `app/globals.css`; headlines fall back to a geometric sans stack until
  then. Left-aligned by default per the guidelines; centering is reserved
  for short, isolated statements.
- **Logo:** the guidelines document (`AxisKey_Brand_Identity_Guidelines.docx`)
  describes the mark system (Axis Icon, Primary Logo, Primary/Secondary
  Lockup) but contains no embedded logo file — and explicitly says "do not
  recreate or redraw the logo." `components/Logo.tsx` therefore renders a
  plain text wordmark rather than inventing an icon. Once the real
  SVG/PNG/AI asset is provided, drop it into `/public` and swap it in per
  the instructions in that file's header comment (clear space = 2× the
  width of the "I", optical alignment from the center of the "X", use the
  Primary Lockup by default).

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase values, see below
npm run dev
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run `supabase/schema.sql`, then `supabase/seed.sql`.
3. In Project Settings → API, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only — never
     expose this in client code or commit it)
4. Confirm the `attachments` storage bucket exists (created by `seed.sql`).

Tables: `request_types`, `requests`, `request_attachments`, `users`,
`activity_log`. RLS is enabled with permissive insert/read policies since
there's no auth yet — tighten these once internal login ships.

## Deploying to Vercel

1. Push this repo to GitHub (already done if you're reading this from the
   repo).
2. In the [Vercel dashboard](https://vercel.com/new), import the GitHub
   repository.
3. Add the environment variables from `.env.example` in Project Settings →
   Environment Variables (same three Supabase values; leave the ClickUp/n8n
   ones blank until those integrations are turned on).
4. Deploy. Every push to the branch connected in Vercel redeploys
   automatically.

## Request flow

1. User clicks a process card → `RequestModal` opens.
2. On submit, any attachments upload directly to the Supabase `attachments`
   storage bucket from the browser, then the form POSTs to
   `/api/requests`.
3. The API route builds a structured payload (`lib/payload.ts`), inserts
   into `requests` (+ `request_attachments`, `activity_log`), and calls
   `syncRequestToClickUp` / `triggerN8nWorkflow` — both currently no-ops.

## Connecting ClickUp / n8n later

The payload shape is already normalized and stored on `requests.payload`:

```ts
{
  requestType: "ira-funding-request",
  requestTypeName: "IRA Funding Request",
  requestorName: "",
  requestorEmail: "",
  investorName: "",
  dealName: "",
  notes: "",
  attachments: [{ fileName, fileUrl, fileSize, contentType }],
  submittedAt: "2026-01-01T00:00:00.000Z",
}
```

To go live with ClickUp:

- Implement `syncRequestToClickUp` in `lib/integrations/clickup.ts` — either
  call the ClickUp API directly (map `requestType` → a ClickUp List ID, per
  their [Create Task
  endpoint](https://developer.clickup.com/reference/createtask)) or POST the
  payload to an n8n webhook that owns the ClickUp side.
- Add `CLICKUP_API_TOKEN` / `CLICKUP_LIST_ID_MAP` (or
  `N8N_REQUEST_WEBHOOK_URL`) as environment variables.
- Both functions are already called (fire-and-forget) from
  `app/api/requests/route.ts` right after a request is saved, so wiring
  them up doesn't require touching the form or the API route.

## Admin panel

Top-right "Admin" button opens a panel with total requests, requests by
type, recent requests, and status breakdown (Submitted / In Review /
Completed). No authentication yet — add it before this goes further than
internal MVP use.
