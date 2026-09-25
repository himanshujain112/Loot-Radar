// Loot Radar upstream feeds: GamerPower freebies + CheapShark deals,
// normalized into the shapes the site, alerts and Pro API all share.

import { FREEBIES_URL, DEALS_URL, CS_BASE, UA } from "./config.js";
import { fetchCached } from "./cache.js";
import { cleanTitle, endsMs } from "./util.js";

// Deal URLs go straight to the store, never expose the upstream redirect links.
export function storeUrl(d, steamAppID) {
  const app = steamAppID || d.steamAppID;
  if (d.storeID === "1" && app) return "https://store.steampowered.com/app/" + app + "/";
  if (app && !d.storeID) return "https://store.steampowered.com/app/" + app + "/";
  return "https://www.cheapshark.com/redirect?dealID=" + (d.dealID || "");
}

export async function csGet(ctx, path, params, ttlSec) {
  // Thin proxy over the upstream deals API, with caching and a proper UA.
  // (Their email-based price-alert endpoints are intentionally NOT proxied,
  // Loot Radar's own alerts run over Telegram instead.)
  const qs = new URLSearchParams(params);
  const res = await fetchCached(ctx, CS_BASE + path + "?" + qs.toString(),
    { "User-Agent": UA, "Accept": "application/json" }, ttlSec);
  return res.json();
}

// Store directory, cached 24h, used to resolve store names on deal payloads.
export async function storeNameMap(ctx) {
  try {
    const data = await csGet(ctx, "/stores", {}, 86400);
    const m = {};
    for (const s of (Array.isArray(data) ? data : [])) m[s.storeID] = s.storeName;
    return m;
  } catch (e) { return {}; }
}

export function normDeal(d, steamAppID, storeName) {
  return {
    title: d.title || "Untitled",
    store: storeName || (d.storeID === "1" ? "Steam" : null),
    storeID: d.storeID || "1",
    price: d.salePrice || d.price || "0",
    was: d.normalPrice || d.retailPrice || "",
    off: Math.round(parseFloat(d.savings || "0")),
    thumb: d.thumb || "",
    url: storeUrl(d, steamAppID),
    steamAppID: steamAppID || d.steamAppID || null,
    gameID: d.gameID || null,
    ratingCount: parseInt(d.steamRatingCount || "0", 10) || 0,
    ratingPercent: parseInt(d.steamRatingPercent || "0", 10) || 0,
  };
}

// Quality ranking: discount % weighted by review count, so recognizable,
// well-reviewed games float above -95% shovelware nobody has heard of.
// score = off * log10(1 + reviews). Missing review data scores 0 and
// sinks, so an upstream format change degrades to upstream order.
export function dealScore(d) {
  return (d.off || 0) * Math.log10(1 + (d.ratingCount || 0));
}

// ---------- Pro API: full deal-feed surface routed through the worker ----------
export async function apiDeals(url, ctx) {
  const q = url.searchParams;
  const params = { storeID: q.get("storeID") || "1" };
  params.pageSize = String(Math.min(parseInt(q.get("pageSize") || "30", 10) || 30, 60));
  if (q.get("pageNumber")) params.pageNumber = q.get("pageNumber");
  params.sortBy = q.get("sortBy") || "Savings";
  params.desc = q.get("desc") || "0";
  if (!q.get("upperPrice") && !q.get("lowerPrice") && !q.get("title") && !q.get("steamAppID")) params.upperPrice = "5";
  for (const k of ["lowerPrice", "upperPrice", "title", "exact", "onSale", "steamAppID", "metacritic",
    "steamRating", "minimumReviewCount", "steamworks", "AAA"]) {
    if (q.get(k) != null) params[k] = q.get(k);
  }
  if (q.get("maxAge") != null) {
    const ma = parseInt(q.get("maxAge"), 10);
    if (!isFinite(ma) || ma < 1 || ma > 2500) { const e = new Error("maxAge must be 1-2500"); e.status = 400; throw e; }
    params.maxAge = String(ma);
  }
  if ((q.get("output") || "").toUpperCase() === "RSS") {
    // Raw RSS passthrough: paging is forced to page 0 / size 100 upstream.
    const qs = new URLSearchParams(params); qs.delete("pageSize"); qs.delete("pageNumber"); qs.set("output", "RSS");
    const res = await fetchCached(ctx, CS_BASE + "/deals?" + qs.toString(),
      { "User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml" }, 900);
    const text = await res.text();
    return new Response(text, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Access-Control-Allow-Origin": "*" } });
  }
  const minSavings = q.get("minSavings") != null ? parseFloat(q.get("minSavings")) : 70;
  const data = await csGet(ctx, "/deals", params, 900);
  const names = await storeNameMap(ctx);
  let items = (Array.isArray(data) ? data : []).map(d => normDeal(d, null, names[d.storeID]));
  if (isFinite(minSavings) && minSavings > 0) items = items.filter(d => d.off >= minSavings);
  return { count: items.length, updated: new Date().toISOString(), items };
}

export async function apiDealLookup(dealID, ctx) {
  // Single-deal lookup: game info + cheaper stores + historical cheapest.
  if (!dealID) { const e = new Error("missing deal id"); e.status = 400; throw e; }
  const data = await csGet(ctx, "/deals", { id: dealID }, 900);
  if (!data || !data.gameInfo) { const e = new Error("deal not found"); e.status = 404; throw e; }
  const g = data.gameInfo;
  const names = await storeNameMap(ctx);
  const cheaper = (Array.isArray(data.cheaperStores) ? data.cheaperStores : []).map(d => normDeal({
    title: g.name, storeID: d.storeID, dealID: d.dealID,
    salePrice: d.price, normalPrice: d.retailPrice, savings: d.savings,
  }, d.steamAppID || g.steamAppID, names[d.storeID]));
  return {
    dealID,
    title: g.name || "Untitled",
    thumb: g.thumb || "",
    steamAppID: g.steamAppID || null,
    url: g.steamAppID ? "https://store.steampowered.com/app/" + g.steamAppID + "/" : null,
    cheapestEver: (data.cheapestPrice || {}).price || null,
    cheaperStores: cheaper,
  };
}

export function normGameSearch(g) {
  return {
    gameID: g.gameID,
    title: g.external || "Untitled",
    cheapest: g.cheapest || "0",
    thumb: g.thumb || "",
    steamAppID: g.steamAppID || null,
    url: g.steamAppID ? "https://store.steampowered.com/app/" + g.steamAppID + "/" : null,
    details: "https://radar.codemeoww.com/api/games/" + g.gameID,
  };
}

export async function apiGamesBulk(ids, ctx) {
  // Bulk lookup: up to 25 comma-separated game IDs.
  const list = String(ids || "").split(",").map(s => s.trim()).filter(s => /^\d+$/.test(s));
  if (!list.length) { const e = new Error("ids must be a comma-separated list of up to 25 numeric game IDs"); e.status = 400; throw e; }
  if (list.length > 25) { const e = new Error("ids limited to 25 per request"); e.status = 400; throw e; }
  const data = await csGet(ctx, "/games", { ids: list.join(","), format: "array" }, 3600);
  const items = (Array.isArray(data) ? data : []).map(g => {
    const info = g.info || {};
    const app = info.steamAppID || null;
    return {
      gameID: info.gameID,
      title: info.title || "Untitled",
      cheapest: (g.cheapestPriceEver || {}).price || "0",
      thumb: info.thumb || "",
      steamAppID: app,
      url: app ? "https://store.steampowered.com/app/" + app + "/" : null,
      details: "https://radar.codemeoww.com/api/games/" + info.gameID,
    };
  });
  return { count: items.length, items };
}

export async function apiGameSearch(url, ctx) {
  const q = url.searchParams;
  if (q.get("ids") != null) return apiGamesBulk(q.get("ids"), ctx);
  const title = (q.get("title") || "").trim();
  const steamAppID = (q.get("steamAppID") || "").trim();
  if (!title && !steamAppID) { const e = new Error("missing required query param: title or steamAppID"); e.status = 400; throw e; }
  const params = { limit: String(Math.min(parseInt(q.get("limit") || "10", 10) || 10, 60)) };
  if (title) params.title = title;
  if (steamAppID) params.steamAppID = steamAppID;
  if (q.get("exact")) params.exact = q.get("exact");
  const data = await csGet(ctx, "/games", params, 3600);
  const items = (Array.isArray(data) ? data : []).map(g => normGameSearch(g));
  return { count: items.length, items };
}

export async function apiGameLookup(gameID, ctx) {
  if (!/^\d+$/.test(gameID || "")) { const e = new Error("invalid game id"); e.status = 400; throw e; }
  const data = await csGet(ctx, "/games", { id: gameID }, 3600);
  const info = data.info || {};
  const names = await storeNameMap(ctx);
  const deals = (Array.isArray(data.deals) ? data.deals : []).map(d => normDeal({
    title: info.title, storeID: d.storeID, dealID: d.dealID,
    salePrice: d.price, normalPrice: d.retailPrice, savings: d.savings,
  }, info.steamAppID, names[d.storeID]));
  return {
    gameID,
    title: info.title || "Untitled",
    thumb: info.thumb || "",
    steamAppID: info.steamAppID || null,
    url: info.steamAppID ? "https://store.steampowered.com/app/" + info.steamAppID + "/" : null,
    cheapestEver: (data.cheapestPriceEver || {}).price || null,
    deals,
  };
}

export async function apiStores(url, ctx) {
  const q = url.searchParams;
  if (q.get("lastChange") != null) {
    // Store directory update timestamps, so clients can skip a full refresh.
    return await csGet(ctx, "/stores", { lastChange: "" }, 3600);
  }
  const data = await csGet(ctx, "/stores", {}, 86400);
  const items = (Array.isArray(data) ? data : []).map(s => ({
    storeID: s.storeID,
    name: s.storeName,
    active: String(s.isActive) === "1",
  }));
  return { count: items.length, items };
}

export async function getFreebies(ctx) {
  try {
    const res = await fetchCached(ctx, FREEBIES_URL, { "User-Agent": UA, "Accept": "application/json" });
    const data = await res.json();
    return (Array.isArray(data) ? data : []).slice(0, 40).map(g => ({
      title: cleanTitle(g.title),
      worth: g.worth || "Free",
      thumb: g.thumbnail || g.image || "",
      url: g.open_giveaway_url || g.gamerpower_url || "#",
      desc: (g.description || "").slice(0, 140),
      platforms: g.platforms || "PC",
      ends: g.end_date && g.end_date !== "N/A" ? g.end_date : null,
      published: g.date_published && g.date_published !== "N/A" ? g.date_published : null,
    })).sort((a, b) => (endsMs(a) || Infinity) - (endsMs(b) || Infinity)); // soonest-expiring first
  } catch (e) { return []; }
}

export async function getDeals(ctx) {
  // Two upstream pages (120 deals) filtered to 70%+ off, ranked by
  // discount x review count, top 100 kept for paging.
  try {
    const pages = await Promise.all([0, 1].map(pn =>
      fetchCached(ctx, DEALS_URL + "&pageNumber=" + pn, { "User-Agent": UA, "Accept": "application/json" })
        .then(r => r.json()).catch(() => [])
    ));
    const seen = new Set();
    const deals = [];
    for (const page of pages) {
      for (const d of (Array.isArray(page) ? page : [])) {
        const n = normDeal(d);
        if (n.off < 70) continue;
        const key = n.title + "|" + n.price;
        if (seen.has(key)) continue;
        seen.add(key);
        deals.push(n);
      }
    }
    deals.sort((a, b) => dealScore(b) - dealScore(a));
    return deals.slice(0, 100);
  } catch (e) { return []; }
}
