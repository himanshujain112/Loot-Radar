# Loot Radar — technical notes

## Stack

Cloudflare Worker (`game-radar`). Plain JavaScript ES modules in `src/`, bundled with esbuild into a single file for upload. No framework, no other build step.

## Data sources

- Freebies: GamerPower (free public API)
- Deals: CheapShark (free public API), 14 storefronts

Both are free public APIs built for exactly this kind of use. No API keys or secrets involved, so naming them here is standard practice.

## Storage

- Cloudflare D1 (`loot-radar-db`): users, sessions, wishlist, Pro status, API keys, alert ledger
- Cloudflare KV (`loot-radar-kv`): feed caches

## Schedules

- Every 20 minutes: poll feeds, send Telegram alerts
- Daily 03:30 UTC: daily digest email (09:00 IST)

## Payments

DodoPayments: $4/month and $39/year. A signed webhook flips Pro status by buyer email.

## Project layout

```
src/            12 modules: config, feeds, pages, alerts, auth, payments, emails, notify, cache, util, router, index
schema.sql      D1 tables
deploy.py       builds, deploys the worker, then auto-pushes to GitHub
gh_push.py      pushes the tree to GitHub via the API
analytics.md    daily traffic log (Microsoft Clarity Data Export API)
```

## Deploy

`python3 deploy.py` (needs Cloudflare credentials). Rebuilds the gitignored `dist/worker.js` bundle and uploads it with the same D1/KV bindings and cron triggers every time. Every deploy auto-pushes to GitHub.

## Secrets

All secrets live as Worker environment variables in the Cloudflare dashboard: `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DODO_WEBHOOK_SECRET`. Nothing secret is in this repo, ever.
