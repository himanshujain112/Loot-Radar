// Loot Radar router: the fetch handler (all routes) and the scheduled
// cron handler. Behavior is identical to the old monolithic worker.

import { LOGO_SVG } from "./config.js";
import { randHex, getCookie, sha256hex, esc } from "./util.js";
import { memDel } from "./cache.js";
import {
  apiDeals, apiDealLookup, apiGameSearch, apiGameLookup, apiStores,
  getFreebies, getDeals, csGet, normGameSearch,
} from "./feeds.js";
import { sessionEmail, proStatus, apiKeyAuth, rateOk } from "./auth.js";
import { verifyDodoWebhook, dodoCustomerEmail } from "./payments.js";
import { sendEmail, sendTelegram } from "./notify.js";
import { setPrefs, handleTelegramCommand, pollAndAlert, sendDailyDigest, attachGameLows } from "./alerts.js";
import { discordAuthorizeUrl, discordExchangeCode, discordOAuthUser, sendDiscordDM, discordInviteUrl, discordBotGuilds, discordGuildChannels, sendDiscordChannel } from "./discord.js";
import { magicLinkEmail } from "./emails.js";
import {
  pageHTML, homeHTML, dealsPageHTML, freebiesPageHTML, pricingPageHTML,
  aboutPageHTML, termsPageHTML, privacyPageHTML, refundsPageHTML,
  apiDocsPageHTML, faqPageHTML, loginHTML, thanksHTML, proHTML, jsonLD,
} from "./pages.js";

export function finalize(html, status) {
  return new Response(html, {
    status: status || 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

export async function cachedPage(request, ctx, render) {
  const cache = caches.default;
  let res = await cache.match(request);
  if (!res) {
    res = await render();
    ctx.waitUntil(cache.put(request, res.clone()));
  }
  return res;
}

export async function handleFetch(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  const isApi = path === "/api/freebies" || path === "/api/deals" || path.startsWith("/api/deals/") ||
    path === "/api/games" || path === "/api/stores" || path.startsWith("/api/games/");
  if (isApi) {
    // Pro-only API. Auth: X-API-Key header or ?key= query param.
    const auth = await apiKeyAuth(request, env, url);
    if (!auth) {
      return new Response(JSON.stringify({ error: "Pro API key required", docs: "https://radar.codemeoww.com/api/docs" }), {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    if (!rateOk("api:" + auth.hash, 600, 3600)) {
      return new Response(JSON.stringify({ error: "rate limit exceeded (600/hour)" }), {
        status: 429,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    try {
      let body;
      if (path === "/api/freebies") {
        const items = await getFreebies(ctx);
        body = { count: items.length, updated: new Date().toISOString(), items };
      } else if (path === "/api/deals") {
        body = await apiDeals(url, ctx);
      } else if (path.startsWith("/api/deals/")) {
        body = await apiDealLookup(decodeURIComponent(path.slice("/api/deals/".length).split("/")[0]), ctx);
      } else if (path === "/api/games") {
        body = await apiGameSearch(url, ctx);
      } else if (path === "/api/stores") {
        body = await apiStores(url, ctx);
      } else {
        body = await apiGameLookup(path.slice("/api/games/".length).split("/")[0], ctx);
      }
      if (body instanceof Response) return body; // e.g. raw RSS passthrough from /api/deals?output=RSS
      return new Response(JSON.stringify(body, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
      });
    } catch (e) {
      const status = e && e.status ? e.status : 502;
      return new Response(JSON.stringify({ error: (e && e.message) || "upstream error" }), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
  }
  if (path === "/api/apikey/create" && request.method === "POST") {
    const email = await sessionEmail(request, env);
    const st = await proStatus(env, email);
    if (!email || !st.pro) {
      return new Response(JSON.stringify({ error: "Pro required" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
    if (!env || !env.DB) return new Response(JSON.stringify({ error: "db unavailable" }), { status: 500, headers: { "Content-Type": "application/json" } });
    try {
      const existing = await env.DB.prepare("SELECT COUNT(*) AS n FROM api_keys WHERE email = ? AND revoked = 0").bind(email).first();
      if (existing && existing.n >= 5) {
        return new Response(JSON.stringify({ error: "key limit reached (5). Revoke an old key first" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      const raw = "lr_" + randHex(24);
      const hash = await sha256hex(raw);
      await env.DB.prepare("INSERT INTO api_keys (api_key_hash, email, prefix, created_at, revoked) VALUES (?,?,?,?,0)")
        .bind(hash, email, raw.slice(0, 12), new Date().toISOString()).run();
      memDel("apikey:" + hash);
      return new Response(JSON.stringify({ key: raw, note: "Shown once. Copy it now." }), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: "could not create key" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }
  if (path === "/api/apikey/revoke" && request.method === "POST") {
    const email = await sessionEmail(request, env);
    if (!email) return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { "Content-Type": "application/json" } });
    let prefix = "";
    try { prefix = String((await request.json()).prefix || "").slice(0, 12); } catch (e) {}
    if (prefix && env && env.DB) {
      try { await env.DB.prepare("UPDATE api_keys SET revoked = 1 WHERE email = ? AND prefix = ?").bind(email, prefix).run(); } catch (e) {}
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }
  // ---------- Discord server (guild) alerts ----------
  // Invite URL for adding the bot to a server (bot scope, send-messages only).
  if (path === "/api/discord/invite-url") {
    const email = await sessionEmail(request, env);
    const st = await proStatus(env, email);
    if (!email || !st.pro) return new Response("Pro required", { status: 403 });
    if (!env.DISCORD_BOT_TOKEN) return new Response("Discord is not configured yet", { status: 503 });
    return new Response(JSON.stringify({ url: discordInviteUrl(env) }), { headers: { "Content-Type": "application/json" } });
  }
  // Servers the bot has been added to.
  if (path === "/api/discord/guilds") {
    const email = await sessionEmail(request, env);
    const st = await proStatus(env, email);
    if (!email || !st.pro) return new Response("Pro required", { status: 403 });
    const guilds = await discordBotGuilds(env);
    return new Response(JSON.stringify({ guilds }), { headers: { "Content-Type": "application/json" } });
  }
  // Text channels in one of the bot's servers.
  if (path === "/api/discord/channels") {
    const email = await sessionEmail(request, env);
    const st = await proStatus(env, email);
    if (!email || !st.pro) return new Response("Pro required", { status: 403 });
    const guildId = url.searchParams.get("guild_id") || "";
    const guilds = await discordBotGuilds(env);
    const guild = guilds.find(g => g.id === guildId);
    if (!guild) return new Response(JSON.stringify({ channels: [] }), { headers: { "Content-Type": "application/json" } });
    const channels = await discordGuildChannels(env, guildId);
    return new Response(JSON.stringify({ channels }), { headers: { "Content-Type": "application/json" } });
  }
  // Save where the bot should post alerts.
  if (path === "/api/discord/server" && request.method === "POST") {
    const email = await sessionEmail(request, env);
    const st = await proStatus(env, email);
    if (!email || !st.pro) return new Response("Pro required", { status: 403 });
    let body = {};
    try { body = await request.json(); } catch (e) {}
    const guildId = String(body.guild_id || ""), channelId = String(body.channel_id || "");
    const guilds = await discordBotGuilds(env);
    const guild = guilds.find(g => g.id === guildId);
    const channels = guild ? await discordGuildChannels(env, guildId) : [];
    const channel = channels.find(c => c.id === channelId);
    if (!guild || !channel) {
      return new Response(JSON.stringify({ ok: false, error: "pick a server and channel the bot is in" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    try {
      await env.DB.prepare("UPDATE customers SET discord_guild_id = ?, discord_guild_name = ?, discord_channel_id = ?, discord_channel_name = ?, updated_at = ? WHERE email = ?")
        .bind(guild.id, guild.name, channel.id, channel.name, new Date().toISOString(), email).run();
      memDel("pro:" + email);
    } catch (e) {
      return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    // Confirm in the channel so the user sees it worked.
    try { await sendDiscordChannel(env, channel.id, "🎮 Loot Radar connected! Fast loot alerts will land here, usually within 20 minutes of a drop."); } catch (e) {}
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }
  if (path === "/api/discord/server/disconnect" && request.method === "POST") {
    const email = await sessionEmail(request, env);
    if (!email) return new Response(JSON.stringify({ ok: false, error: "login required" }), { status: 401, headers: { "Content-Type": "application/json" } });
    if (env && env.DB) {
      try {
        await env.DB.prepare("UPDATE customers SET discord_guild_id = NULL, discord_guild_name = NULL, discord_channel_id = NULL, discord_channel_name = NULL, updated_at = ? WHERE email = ?").bind(new Date().toISOString(), email).run();
        memDel("pro:" + email);
      } catch (e) {}
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }
  if (path === "/api/dodo/webhook") {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }
    const raw = await request.text();
    const secret = (env && env.DODO_WEBHOOK_SECRET) || "";
    // Fail closed: without a configured secret, no payment events get processed.
    if (!secret) {
      return new Response(JSON.stringify({ error: "webhook not configured" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const v = await verifyDodoWebhook(request, raw, secret);
    if (!v.ok) {
      return new Response(JSON.stringify({ error: "bad signature", reason: v.reason }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const verified = true;
    let evt = null;
    try { evt = JSON.parse(raw); } catch (e) { /* ignore */ }
    const type = (evt && (evt.type || evt.event)) || "unknown";
    const email = dodoCustomerEmail(evt);
    const now = new Date().toISOString();
    try {
      if (env && env.DB) {
        await env.DB.prepare(
          "INSERT INTO webhook_events (type, email, payload, verified, received_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(type, email, raw.slice(0, 20000), verified ? 1 : 0, now).run();
        const d = (evt && evt.data) || {};
        const pid = d.product_id || "";
        const planFromProduct = pid === "pdt_0No6epRAEDlFPuD8vFMT3" ? "monthly"
          : pid === "pdt_0No6f9EaIF1CMH6wKBTVl" ? "yearly" : null;
        const plan = (d.metadata && d.metadata.plan) || d.plan || planFromProduct;
        const periodEnd = d.current_period_end || d.renews_at || d.next_billing_date || null;
        if (email && (type === "subscription.active" || type === "subscription.renewed" || type === "payment.succeeded")) {
          await env.DB.prepare(
            "INSERT INTO customers (email, pro, plan, pro_since, pro_until, deal_stores, updated_at) VALUES (?, 1, ?, ?, ?, '1,25,7,30', ?) " +
            "ON CONFLICT(email) DO UPDATE SET pro=1, plan=COALESCE(excluded.plan, customers.plan), pro_until=COALESCE(excluded.pro_until, customers.pro_until), updated_at=excluded.updated_at"
          ).bind(email, plan, now, periodEnd, now).run();
        } else if (email && (type === "subscription.cancelled" || type === "subscription.on_hold")) {
          await env.DB.prepare(
            "INSERT INTO customers (email, pro, plan, pro_until, deal_stores, updated_at) VALUES (?, 0, ?, ?, '1,25,7,30', ?) " +
            "ON CONFLICT(email) DO UPDATE SET pro=0, pro_until=excluded.pro_until, updated_at=excluded.updated_at"
          ).bind(email, plan, periodEnd, now).run();
        }
      }
    } catch (e) { /* never fail the webhook on DB errors */ }
    return new Response(JSON.stringify({ received: true, type, verified, has_email: !!email }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  if (path === "/logo.svg") {
    return new Response(LOGO_SVG, {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
    });
  }
  if (path === "/robots.txt") {
    return new Response("User-agent: *\nAllow: /\nSitemap: https://radar.codemeoww.com/sitemap.xml\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
    });
  }
  if (path === "/sitemap.xml") {
    const urls = ["", "deals", "freebies", "pricing", "faq", "about", "terms", "privacy", "refunds", "login", "api/docs"].map(p =>
      "<url><loc>https://radar.codemeoww.com/" + p + "</loc><lastmod>2026-09-24</lastmod></url>").join("");
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</urlset>", {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=86400" },
    });
  }
  if (path === "/api/auth/request" && request.method === "POST") {
    let email = "";
    try { email = (await request.json()).email || ""; } catch (e) {}
    email = String(email).trim().toLowerCase();
    // Per-IP throttle: max 10 magic-link requests/hour. Without this, one IP
    // could request links for endless addresses and burn the email budget.
    if (env && env.KV) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      try {
        const k = "ratelimit:magic:" + ip;
        const n = (parseInt(await env.KV.get(k) || "0", 10) || 0) + 1;
        if (n > 10) return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
        await env.KV.put(k, String(n), { expirationTtl: 3600 });
      } catch (e) {}
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && env && env.KV) {
      // One magic-link email per 15 minutes per address, a valid link is already in their inbox.
      const recent = await env.KV.get("magicemail:" + email);
      if (!recent) {
        const token = randHex(32);
        await env.KV.put("magic:" + token, JSON.stringify({ email: email }), { expirationTtl: 900 });
        await env.KV.put("magicemail:" + email, "1", { expirationTtl: 900 });
        const link = "https://radar.codemeoww.com/api/auth/verify?token=" + token;
        ctx.waitUntil(sendEmail(env, email, "Your Loot Radar login link", magicLinkEmail(link)));
      }
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }
  if (path === "/api/auth/verify") {
    const token = url.searchParams.get("token") || "";
    const rec = (env && env.KV) ? await env.KV.get("magic:" + token, "json") : null;
    if (!rec || !rec.email) {
      return finalize(pageHTML("Link expired: Loot Radar", "That login link is invalid or expired.", "/login") +
        '<div class="wrap" style="padding:80px 22px;text-align:center"><h1>Link expired</h1>' +
        '<p class="sec-sub" style="text-align:center">That login link is invalid or expired.</p>' +
        '<a class="btn" href="/login">Get a new link</a></div></body></html>', 400);
    }
    await env.KV.delete("magic:" + token);
    await env.KV.delete("magicemail:" + rec.email);
    const sid = randHex(32);
    await env.KV.put("sess:" + sid, JSON.stringify({ email: rec.email }), { expirationTtl: 2592000 });
    return new Response("", {
      status: 302,
      headers: {
        Location: "https://radar.codemeoww.com/pro",
        "Set-Cookie": "lr_sess=" + sid + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000",
      },
    });
  }
  if (path === "/api/auth/me") {
    const email = await sessionEmail(request, env);
    const st = await proStatus(env, email);
    return new Response(JSON.stringify({ email: email, pro: st.pro, plan: st.plan, telegram: st.telegram, discord: st.discord }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  if (path === "/api/auth/logout" && request.method === "POST") {
    const sid = getCookie(request, "lr_sess");
    if (sid && env && env.KV) { await env.KV.delete("sess:" + sid); memDel("sess:" + sid); }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Set-Cookie": "lr_sess=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" },
    });
  }
  if (path === "/api/pro/search" && request.method === "GET") {
    // Game search autocomplete for the Pro dashboard wishlist. Session-authed, Pro only.
    const email = await sessionEmail(request, env);
    if (!email) return new Response(JSON.stringify({ ok: false, items: [] }), { status: 401, headers: { "Content-Type": "application/json" } });
    const st = await proStatus(env, email);
    if (!st.pro) return new Response(JSON.stringify({ ok: false, items: [] }), { status: 403, headers: { "Content-Type": "application/json" } });
    const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
    if (q.length < 2) return new Response(JSON.stringify({ ok: true, items: [] }), { headers: { "Content-Type": "application/json" } });
    let items = [];
    try {
      const data = await csGet(ctx, "/games", { title: q, limit: "8" }, 3600);
      items = (Array.isArray(data) ? data : []).slice(0, 8).map(g => {
        const n = normGameSearch(g);
        return { title: n.title, thumb: n.thumb, cheapest: n.cheapest, steamAppID: n.steamAppID };
      });
    } catch (e) {}
    return new Response(JSON.stringify({ ok: true, items }), { headers: { "Content-Type": "application/json" } });
  }
  if (path === "/api/wishlist/add" && request.method === "POST") {
    const email = await sessionEmail(request, env);
    if (!email) return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { "Content-Type": "application/json" } });
    let title = "";
    try { title = String((await request.json()).title || "").trim().slice(0, 120); } catch (e) {}
    if (title && env && env.DB) {
      try { await env.DB.prepare("INSERT OR IGNORE INTO wishlist (email, title, added_at) VALUES (?,?,?)").bind(email, title, new Date().toISOString()).run(); memDel("wl:" + email); } catch (e) {}
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }
  if (path === "/api/telegram/unlink" && request.method === "POST") {
    const email = await sessionEmail(request, env);
    if (!email) return new Response(JSON.stringify({ ok: false, error: "login required" }), { status: 401, headers: { "Content-Type": "application/json" } });
    if (env && env.DB) {
      try { await env.DB.prepare("UPDATE customers SET telegram_chat_id = NULL, updated_at = ? WHERE email = ?").bind(new Date().toISOString(), email).run(); } catch (e) {}
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }
  // ---------- Discord connect (OAuth2) + DMs ----------
  if (path === "/api/discord/connect") {
    const email = await sessionEmail(request, env);
    const st = await proStatus(env, email);
    if (!email || !st.pro) return new Response("Pro required", { status: 403 });
    if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_CLIENT_SECRET) {
      return new Response("Discord is not configured yet", { status: 503 });
    }
    const state = randHex(16);
    try { await env.KV.put("discord:oauth:" + state, email, { expirationTtl: 600 }); } catch (e) {}
    return Response.redirect(discordAuthorizeUrl(env, state), 302);
  }
  if (path === "/api/discord/callback") {
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    let email = null;
    try { email = state ? await env.KV.get("discord:oauth:" + state) : null; } catch (e) {}
    if (state) { try { await env.KV.delete("discord:oauth:" + state); } catch (e) {} }
    const fail = () => Response.redirect("https://radar.codemeoww.com/pro?discord=error", 302);
    if (!email || !code) return fail();
    const tok = await discordExchangeCode(env, code);
    const du = tok && tok.access_token ? await discordOAuthUser(tok.access_token) : null;
    if (!du || !du.id) return fail();
    try {
      await env.DB.prepare("UPDATE customers SET discord_user_id = ?, updated_at = ? WHERE email = ?")
        .bind(String(du.id), new Date().toISOString(), email).run();
      memDel("pro:" + email);
    } catch (e) { return fail(); }
    // Best-effort welcome DM so the user sees it worked. Flag failure in the
    // redirect so the dashboard can say why instead of failing silently.
    let dmOk = false;
    try { dmOk = await sendDiscordDM(env, String(du.id), "🎮 Loot Radar connected! You'll get fast loot alerts here, usually within 20 minutes of a drop."); } catch (e) {}
    return Response.redirect("https://radar.codemeoww.com/pro?discord=ok" + (dmOk ? "" : "&dm=failed"), 302);
  }
  if (path === "/api/discord/unlink" && request.method === "POST") {
    const email = await sessionEmail(request, env);
    if (!email) return new Response(JSON.stringify({ ok: false, error: "login required" }), { status: 401, headers: { "Content-Type": "application/json" } });
    if (env && env.DB) {
      try {
        const row = await env.DB.prepare("SELECT discord_user_id FROM customers WHERE email = ?").bind(email).first();
        if (row && row.discord_user_id) { try { await env.KV.delete("discord:dm:" + row.discord_user_id); } catch (e) {} }
        await env.DB.prepare("UPDATE customers SET discord_user_id = NULL, updated_at = ? WHERE email = ?").bind(new Date().toISOString(), email).run();
        memDel("pro:" + email);
      } catch (e) {}
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }
  if (path === "/api/alerts/prefs" && request.method === "POST") {
    const email = await sessionEmail(request, env);
    if (!email) return new Response(JSON.stringify({ ok: false, error: "login required" }), { status: 401, headers: { "Content-Type": "application/json" } });
    let patch = {};
    try { patch = await request.json(); } catch (e) {}
    let res = { ok: false, error: "no database" };
    if (env && env.DB) res = await setPrefs(env, email, patch || {});
    const status = res.ok ? 200 : 400;
    return new Response(JSON.stringify(res), { status: status, headers: { "Content-Type": "application/json" } });
  }
  if (path === "/api/wishlist/remove" && request.method === "POST") {
    const email = await sessionEmail(request, env);
    if (!email) return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { "Content-Type": "application/json" } });
    let title = "";
    try { title = String((await request.json()).title || ""); } catch (e) {}
    if (env && env.DB) {
      try { await env.DB.prepare("DELETE FROM wishlist WHERE email = ? AND title = ?").bind(email, title).run(); memDel("wl:" + email); } catch (e) {}
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }
  if (path === "/login") {
    return finalize(pageHTML("Log in: Loot Radar", "Log in to Loot Radar with a magic link to manage your Pro alerts.", "/login") +
      loginHTML() + "</body></html>");
  }
  if (path === "/thanks") {
    const q = new URL(request.url).searchParams;
    const em = (q.get("email") || "").slice(0, 120);
    return finalize(pageHTML("You're Pro: Loot Radar", "Payment complete. Log in with your checkout email to unlock your Pro dashboard.", "/thanks") +
      thanksHTML(em) + "</body></html>");
  }
  if (path === "/pro") {
    const email = await sessionEmail(request, env);
    if (!email) return Response.redirect("https://radar.codemeoww.com/login", 302);
    let tgUrl = null;
    if (env && env.KV) {
      const t = randHex(16);
      await env.KV.put("tglink:" + t, JSON.stringify({ email: email }), { expirationTtl: 900 });
      tgUrl = "https://t.me/games_loot_bot?start=" + t;
    }
    return finalize(pageHTML("Pro dashboard: Loot Radar", "Manage your Loot Radar Pro alerts and Telegram/Discord connections.", "/pro") +
      await proHTML(env, email, tgUrl) + "</body></html>");
  }
  if (path === "/pricing") {
    return cachedPage(request, ctx, async () =>
      finalize(pageHTML("Pro pricing: Loot Radar", "Loot Radar Pro: fast Telegram or Discord alerts and a daily email digest for free games and deals that match your alert settings. $4/month or $39/year.", "/pricing") +
        pricingPageHTML() + "</body></html>"));
  }
  if (path === "/faq") {
    return cachedPage(request, ctx, async () =>
      finalize(pageHTML("FAQ: Loot Radar", "How Loot Radar works: Pro alerts, Telegram and Discord setup, the API, cancelling, refunds.", "/faq") +
        faqPageHTML() + "</body></html>"));
  }
  if (path === "/about") {
    return cachedPage(request, ctx, async () =>
      finalize(pageHTML("About: Loot Radar", "What Loot Radar is, how it tracks free PC games and Steam deals, and who runs it.", "/about") +
        aboutPageHTML() + "</body></html>"));
  }
  if (path === "/terms") {
    return cachedPage(request, ctx, async () =>
      finalize(pageHTML("Terms of service: Loot Radar", "Loot Radar terms of service: Pro subscriptions, no-refund policy, API fair use.", "/terms") +
        termsPageHTML() + "</body></html>"));
  }
  if (path === "/privacy") {
    return cachedPage(request, ctx, async () =>
      finalize(pageHTML("Privacy policy: Loot Radar", "Loot Radar privacy policy: what we collect, what we never do, your rights.", "/privacy") +
        privacyPageHTML() + "</body></html>"));
  }
  if (path === "/refunds") {
    return cachedPage(request, ctx, async () =>
      finalize(pageHTML("Refund policy: Loot Radar", "Loot Radar Pro sales are final and non-refundable. Cancel anytime.", "/refunds") +
        refundsPageHTML() + "</body></html>"));
  }
  if (path === "/api/docs") {
    return cachedPage(request, ctx, async () =>
      finalize(pageHTML("API docs: Loot Radar", "Loot Radar Pro API: live deals and freebies feeds as JSON. Authentication, endpoints, rate limits.", "/api/docs") +
        apiDocsPageHTML() + "</body></html>"));
  }
  if (path.indexOf("/api/telegram/hook/") === 0) {
    const secret = path.slice("/api/telegram/hook/".length);
    if (!secret || secret !== ((env && env.TELEGRAM_WEBHOOK_SECRET) || "unset")) {
      return new Response("not found", { status: 404 });
    }
    if (request.method !== "POST") return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    let update = null;
    try { update = await request.json(); } catch (e) {}
    const msg = update && update.message;
    const text = (msg && msg.text) || "";
    const chatId = msg && msg.chat && msg.chat.id;
    const m = text.match(/^\/start\s+([0-9a-f]{32})/);
    if (m && chatId && env && env.KV && env.DB) {
      const rec = await env.KV.get("tglink:" + m[1], "json");
      if (rec && rec.email) {
        await env.KV.delete("tglink:" + m[1]);
        const nowIso = new Date().toISOString();
        // One Telegram account belongs to one Loot Radar account, clear it elsewhere first.
        try {
          await env.DB.prepare("UPDATE customers SET telegram_chat_id = NULL, updated_at = ? WHERE telegram_chat_id = ? AND email != ?")
            .bind(nowIso, String(chatId), rec.email).run();
        } catch (e) {}
        await env.DB.prepare("UPDATE customers SET telegram_chat_id = ?, updated_at = ? WHERE email = ?")
          .bind(String(chatId), nowIso, rec.email).run();
        ctx.waitUntil(sendTelegram(env, chatId,
          "🎮 <b>Loot Radar connected!</b>\n\nYou'll get fast alerts here, usually within 20 minutes of a drop, one message per scan.\n\nTune what you get with /prefs, or anytime at radar.codemeoww.com/pro\n\nHappy hunting!"));
      }
    } else if (text === "/start" && chatId) {
      ctx.waitUntil(sendTelegram(env, chatId,
        "👋 Welcome to Loot Radar!\n\nTo link your Pro subscription, log in at https://radar.codemeoww.com/login and tap <b>Connect Telegram</b> in your dashboard."));
    } else if (chatId && text.charAt(0) === "/") {
      const reply = await handleTelegramCommand(env, chatId, text);
      if (reply) ctx.waitUntil(sendTelegram(env, chatId, reply));
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }
  if (path === "/" || path === "/index.html") {
    return cachedPage(request, ctx, async () => {
      const [freebies, deals] = await Promise.all([getFreebies(ctx), getDeals(ctx)]);
      await attachGameLows(env, deals);
      return finalize(pageHTML(null, null, "/", jsonLD(freebies)) + homeHTML(freebies, deals) + "</body></html>");
    });
  }
  if (path === "/deals") {
    return cachedPage(request, ctx, async () => {
      const deals = await getDeals(ctx);
      await attachGameLows(env, deals);
      return finalize(pageHTML("Steam deals: Loot Radar", "Every Steam deal tracked by Loot Radar, sorted by biggest discount first.", "/deals") +
        dealsPageHTML(deals) + "</body></html>");
    });
  }
  if (path === "/freebies") {
    return cachedPage(request, ctx, async () => {
      const freebies = await getFreebies(ctx);
      return finalize(pageHTML("Free PC games: Loot Radar", "Every free-to-claim PC game live right now, tracked by Loot Radar.", "/freebies") +
        freebiesPageHTML(freebies) + "</body></html>");
    });
  }
  return finalize(
    pageHTML("Not found: Loot Radar", "This page doesn't exist.", "/") +
    '<div class="wrap" style="padding:80px 22px;text-align:center"><h1>404: not found</h1>' +
    '<p class="sec-sub" style="text-align:center">This page doesn\'t exist.</p>' +
    '<a class="btn" href="/">Back to loot</a></div></body></html>', 404);
}

export async function handleScheduled(event, env, ctx) {
  if (event && event.cron === "30 3 * * *") ctx.waitUntil(sendDailyDigest(env));
  else ctx.waitUntil(pollAndAlert(env));
}
