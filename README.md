# AxisKey Operations Hub

Internal request center for AxisKey. A single page where staff go to submit
operational process requests (IRA funding, title transfers, redemptions,
etc.) instead of hunting through emails, SOPs, and scattered links.

This is **not** a client portal, investor portal, or CRM — it's an internal
tool.

## Tech stack

- **Frontend:** Next.js 15 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Supabase (Postgres + Storage), accessed via Next.js API routes
- **Deployment:** Vercel
- **Live integration:** ClickUp API (task creation on every submission)
- **Future integration:** n8n, email notifications

## Project structure

```
app/
  page.tsx                          Landing page (single page app)
  layout.tsx                         Root layout, fonts
  api/requests/route.ts               POST — creates a request, syncs to ClickUp
  api/requests/[id]/retry-sync/route.ts  POST — retries a failed/pending ClickUp sync
  api/admin/stats/route.ts            GET — KPIs for the Admin panel
components/
  Logo.tsx                  Official AxisKey wordmark (public/axiskey-logo.png)
  RequestCard.tsx            One process card
  RequestModal.tsx           Request form (modal)
  AdminPanel.tsx              Admin KPI panel incl. ClickUp sync status
lib/
  requestTypes.ts             Source of truth for the 7 process types
  payload.ts                  Builds the integration-ready payload
  types.ts                    Shared TypeScript types
  supabase/client.ts           Browser Supabase client (anon key)
  supabase/server.ts           Server Supabase client (service role key)
  services/requestSync.ts      Business logic: orchestrates ClickUp + Supabase
  integrations/clickup.ts      ClickUp service — real API client (task create + attach)
  integrations/n8n.ts          n8n webhook trigger — stubbed, not wired up yet
supabase/
  schema.sql                  Tables, indexes, RLS policies (fresh installs)
  seed.sql                    Seeds request_types + creates storage bucket
  migrations/001_clickup_sync_status.sql   Run once on an already-live DB
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
- **Logo:** the official asset (`public/axiskey-logo.png`, monochrome,
  transparent background) is wired up in `components/Logo.tsx` via
  `next/image`, sized by height only so it never stretches or distorts.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase values, see below
npm run dev
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run `supabase/schema.sql`, then `supabase/seed.sql`.
   - Already have a live project from before the ClickUp sync fields
     existed? Also run `supabase/migrations/001_clickup_sync_status.sql` —
     `schema.sql` uses `create table if not exists`, which won't add new
     columns to a table that already exists.
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
   Environment Variables: the three Supabase values, `CLICKUP_API_TOKEN`,
   and `CLICKUP_LIST_ID_MAP` (leave `N8N_REQUEST_WEBHOOK_URL` blank until
   that integration is turned on).
4. Deploy. Every push to the branch connected in Vercel redeploys
   automatically.

## Request flow

1. User clicks a process card → `RequestModal` opens.
2. On submit, any attachments upload directly to the Supabase `attachments`
   storage bucket from the browser, then the form POSTs to
   `/api/requests`.
3. The API route builds a structured payload (`lib/payload.ts`), inserts
   into `requests` (+ `request_attachments`, `activity_log`), then calls
   `syncRequestAndPersist` (`lib/services/requestSync.ts`), which:
   - creates a ClickUp task via `lib/integrations/clickup.ts` (real API
     call, not a stub) — task name `"<Type> | <Requestor> | <Deal or
     Investor>"`, description with every submitted field, attachments
     best-effort re-uploaded to the task (URLs are always included as a
     fallback);
   - writes `clickup_task_id`, `clickup_sync_status`
     (`pending`/`synced`/`failed`), `clickup_sync_error`, and
     `clickup_synced_at` back onto the `requests` row;
   - logs the outcome to `activity_log`.
4. The user always sees a success confirmation once the request is saved in
   Supabase — a ClickUp failure never blocks or loses the submission, it's
   just marked `failed` (retryable) instead of `synced`.

## ClickUp integration

- **List mapping is entirely env-driven** — `CLICKUP_LIST_ID_MAP` is a JSON
  object of `request type slug -> ClickUp List ID` (see `.env.example`).
  Nothing is hardcoded; a request type missing from the map syncs as
  `failed` with a descriptive error instead of guessing a list.
- **Retry:** the Admin panel shows a "Retry" button on any request that
  isn't `synced`, which calls `POST /api/requests/[id]/retry-sync` — it
  re-reads the stored payload and re-attempts the ClickUp call.
- **Architecture is layered on purpose:** `lib/integrations/clickup.ts` only
  knows how to talk to the ClickUp API; `lib/services/requestSync.ts` is the
  business logic that decides what to persist in Supabase; the API routes
  are thin glue; the UI never talks to ClickUp directly. Swapping ClickUp
  for an n8n webhook later (`lib/integrations/n8n.ts`) means changing
  `requestSync.ts`, not the routes or components.

## Admin panel

Top-right "Admin" button opens a panel with total requests, requests by
type, status breakdown (Submitted / In Review / Completed), ClickUp sync
breakdown (Successful / Failed / Pending), and a list of recent requests —
each showing its ClickUp Task ID, sync status, submission date, and a Retry
action when sync isn't `synced`. No authentication yet — add it before this
goes further than internal MVP use.
