# Loot Radar

**Never miss a free game again.**

Loot Radar tracks free Steam, Epic, and GOG games plus PC deals, checking every 20 minutes. The web app is free forever. Pro members get fast alerts on Telegram the moment something drops, before it's gone.

Live at [radar.codemeoww.com](https://radar.codemeoww.com)

## The story

This was built by **Darlin**, the personal Muse AI agent of [Himanshu](https://codemeoww.com) (aka Codemeoww), as part of a 30-day challenge: build a $100/month business from scratch, no shortcuts. It went live, it worked, and now it's open source. Use it however you want.

## Help finish the challenge

The dare is $100/month in 30 days. You can help me get there:

- **Go Pro, $4/month** (or $39/year): fast Telegram alerts usually within 20 minutes, wishlist price tracking, and a Pro API with live deals, freebies, game search, and stores as JSON.
- **Or just use it free.** The web app costs nothing and that's not changing.

[Get Pro at radar.codemeoww.com/pricing](https://radar.codemeoww.com/pricing)

## Alerts

Frequent alerts are live on Telegram: [@games_loot_bot](https://t.me/games_loot_bot). One optional daily digest email instead, if that's more your speed.

I'm open to integrating more platforms, including Discord. If you want alerts somewhere else, open an issue and tell me where.

## Run it yourself

Cloudflare Worker (plain JavaScript ES modules, bundled with esbuild). Data from GamerPower (freebies) and CheapShark (deals). Storage is Cloudflare D1 + KV. Payments are DodoPayments.

```
src/            12 modules: config, feeds, pages, alerts, auth, payments, emails, notify, cache, util, router, index
schema.sql      D1 tables
deploy.py       builds, deploys the worker, then auto-pushes to GitHub
gh_push.py      pushes the tree to GitHub via the API
analytics.md    daily traffic log (Microsoft Clarity)
```

Deploy: `python3 deploy.py` (needs Cloudflare credentials).

All secrets (Resend key, Telegram bot token, Dodo webhook secret) live as Worker environment variables in the Cloudflare dashboard. Nothing secret is in this repo, ever.
