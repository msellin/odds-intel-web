# OddsIntel Web — Agent Instructions

## Task Coordination

**All task tracking and documentation live in the engine repo at `../odds-intel-engine/`.** Before starting any frontend work:

1. Read `../odds-intel-engine/PRIORITY_QUEUE.md` — find the task, check it is not already `🔄 In Progress`
2. Mark it `🔄 In Progress` in PRIORITY_QUEUE.md **before writing any code**
3. When done, update status to `✅ Done YYYY-MM-DD` and update any relevant engine docs in the **same commit** as the code

See `../odds-intel-engine/CLAUDE.md` for the full task lifecycle protocol.

## Architecture

- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Auth + DB:** Supabase (server-side via `createSupabaseServer()`, client-side via `createBrowserClient()`)
- **Payments:** Stripe (checkout, webhook at `/api/stripe/webhook`, portal)
- **Error monitoring:** Sentry
- **Deployment:** Vercel

## Tier Gating Rules

Server-side gating is the only safe gating. Client-side gating is UI only — it hides content but does not protect data.

- Tier is read from `profiles.tier` (values: `free`, `pro`, `elite`) + `profiles.is_superadmin`
- `isElite = is_superadmin || tier === 'elite'`
- `isPro = isElite || tier === 'pro'`  ← Elite users are always also Pro
- Pro data (odds movement, events, lineups, stats, injuries) must only be **fetched** server-side when `isPro === true` — never fetch then conditionally hide
- Pass `isPro` and `isElite` as props to components that change their rendering by tier

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/engine-data.ts` | All Supabase queries — data fetching layer |
| `src/lib/signal-labels.ts` | Signal translation layer — raw floats → human labels |
| `src/app/(app)/matches/[id]/page.tsx` | Match detail — server-side tier gating |
| `src/app/(app)/value-bets/page.tsx` | Value bets — server-side tier gating |
| `src/components/match-signal-summary.tsx` | Intelligence Summary (SUX-4) |
| `src/components/signal-accordion.tsx` | Signal group accordion (SUX-5) |
| `src/components/signal-delta.tsx` | Signal delta — what changed (SUX-9) |
| `src/components/live-odds-chart.tsx` | Live in-play odds chart (FE-LIVE) |
| `src/components/bet-explain-button.tsx` | LLM bet explanation (BET-EXPLAIN) |
| `src/app/api/bet-explain/route.ts` | Gemini API route — Elite only |
| `src/app/api/live-odds/route.ts` | Live odds API route — Pro only |
| `src/app/api/stripe/webhook/route.ts` | Stripe webhook handler |

## Database Migrations

All migrations live in `../odds-intel-engine/supabase/migrations/` — never in this repo.

## Code Conventions

- Server components fetch data; client components handle interaction
- `"use client"` only when you need `useState`, `useEffect`, or browser APIs
- Supabase server client: `createSupabaseServer()` in server components and API routes
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- Select dropdowns: use `<SelectValue>{explicit display text}</SelectValue>` not `placeholder` — Radix doesn't resolve item labels until dropdown opens
