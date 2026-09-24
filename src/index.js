// Loot Radar worker entrypoint.
// ES modules are bundled with esbuild into dist/worker.js (single file, ESM)
// and uploaded to the `game-radar` Cloudflare Worker by deploy.py.
// Multi-page PC deals storefront: home, /deals, /freebies, /pricing, /faq, /about,
// /terms, /privacy, /refunds, /api/docs, /login, /pro.
// Data: GamerPower (freebies) + Steam deal feeds, cached via Cache API.
// D1: customers, webhook_events, sent_alerts, wishlist, api_keys. KV: magic links, sessions, telegram link tokens.
// Cron */20min polls sources and sends per-user deduped Telegram alerts (Pro); daily digest email at 09:00 IST.
// API (/api/deals, /api/freebies, /api/games, /api/stores) is Pro-only, keyed per customer.

import { handleFetch, handleScheduled } from "./router.js";

export default {
  fetch: handleFetch,
  scheduled: handleScheduled,
};
