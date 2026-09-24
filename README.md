# Loot Radar

**Free PC games, before they're gone.** Live at https://radar.codemeoww.com

Loot Radar tracks free-to-claim PC games and steep PC discounts across 14 storefronts, refreshing every 20 minutes. Browsing is free forever. Loot Radar Pro ($4/mo or $39/yr via DodoPayments) adds fast Telegram alerts (usually within 20 minutes), a daily email digest at 9 AM IST, wishlist price watch, and a Pro API.

## Architecture

Cloudflare Worker (`game-radar`), plain JavaScript ES modules in `src/`, bundled with esbuild into a single file for upload.

```
src/
  index.js    worker entrypoint: export default { fetch, scheduled }
  router.js   fetch handler (all routes) + scheduled cron handler
  config.js   constants: feed URLs, UA, cache TTL, store directory
  util.js     esc, randHex, sha256hex, cookies, title/expiry helpers
  cache.js    in-memory cache + Cache API wrapper (fetchCached)
  feeds.js    GamerPower + CheapShark fetchers and normalizers, Pro API logic
  auth.js     sessions, Pro status, wishlist reads, API key auth + rate limit
  alerts.js   loot aggregation, dedup ledger, Telegram poller, digest, prefs, bot commands
  notify.js   Resend email + Telegram Bot API senders
  payments.js DodoPayments webhook signature verification
  emails.js   email templates: shell, magic link, daily digest
  pages.js    all HTML pages, nav, footer, FAQ data
```

`dist/worker.js` is the built bundle (gitignored, rebuilt on every deploy). The old monolithic `worker.js` and all `worker.js.bak-*` snapshots live in `~/workspace/loot-radar-backups/` for reference and rollback.

## Deploy

```bash
cd ~/workspace/loot-radar
python3 deploy.py
```

`deploy.py` runs `npm run build` first, then uploads `dist/worker.js` to the `game-radar` worker with its D1/KV bindings and cron triggers (`*/20 * * * *`, `30 3 * * *`) via multipart upload. Same metadata, bindings and crons as before, every time.

## Secrets

All secrets live in the Cloudflare dashboard as worker secrets/env vars: `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DODO_WEBHOOK_SECRET`, plus the D1 (`loot-radar-db`) and KV (`loot-radar-kv`) bindings. Nothing secret is in this repo, ever. DB schema is in `schema.sql`.

## Analytics

`analytics.md` is a daily traffic log (Microsoft Clarity Data Export API), one row per day, kept next to the code so history survives Clarity's 3-day API window.
