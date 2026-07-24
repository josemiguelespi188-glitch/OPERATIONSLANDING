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

- Colors: Axis Core `#201C1A`, Axis Signal `#E3F464`, Axis Base `#CEC1A9`,
  Axis Light `#F2F2F2`, White `#FFFFFF` — defined as Tailwind tokens
  (`axis-core`, `axis-signal`, `axis-base`, `axis-light`) in
  `tailwind.config.ts`.
- Typography: Inter (body/UI) loads via `next/font/google`. Eurostile
  (headlines) is a licensed font — drop the font files into `public/fonts`
  and uncomment the `@font-face` block in `app/globals.css`. Until then,
  headlines fall back to a geometric sans stack.
- Logo: `components/Logo.tsx` is a placeholder wordmark. Replace it with the
  real AxisKey logo asset once provided.

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
