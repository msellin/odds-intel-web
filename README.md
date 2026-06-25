# OddsIntel — Web Frontend

The Next.js frontend for [oddsintel.app](https://oddsintel.app). All the
model, ledger, and verification work lives in the companion
[odds-intel-engine](https://github.com/msellin/odds-intel-engine) repo
— **start there if you're trying to understand or verify the picks**.

## What this repo does

- `src/app/page.tsx` — landing page (hero ROI, comparison block, premium waitlist)
- `src/app/picks/` — live pending picks (`/picks`)
- `src/app/(app)/performance/` — settled track record
- `src/app/methodology/` — model + verification methodology
- `src/app/api/v1/track-record/` — public JSON feed of settled bets
- `src/app/api/v1/upcoming/` — public JSON feed of pending picks
- `src/app/auth/callback/` — Supabase OAuth callback handler
- `src/app/(app)/admin/` — operator-only dashboards (bot management, real bets log)

The landing comparison block reads
[`ledger/comparison_*.json`](https://github.com/msellin/odds-intel-engine/tree/main/ledger)
from the engine repo at runtime (6h revalidate). When the weekly cron
in the engine refreshes those JSONs, the landing auto-updates with no
Vercel rebuild.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase Postgres + Auth + Storage
- Vercel hosting
- Sentry user feedback widget
- PostHog analytics

## Running locally

```bash
npm install
cp .env.local.example .env.local  # fill in NEXT_PUBLIC_SUPABASE_URL etc.
npm run dev
# http://localhost:3000
```

You'll need the same Supabase project the engine repo writes to. The
public API routes (`/api/v1/track-record`, `/api/v1/upcoming`) require
`SUPABASE_SECRET_KEY` because they bypass RLS.

## Where to find things

- **Production pipeline + model** → [odds-intel-engine](https://github.com/msellin/odds-intel-engine)
- **Picks ledger + Bitcoin anchors** → [odds-intel-engine/ledger](https://github.com/msellin/odds-intel-engine/tree/main/ledger)
- **Daily live picks** → [@oddsintelpicks](https://t.me/oddsintelpicks) on Telegram

## Disclaimer

Not financial or gambling advice. 18+ only.
