// Loot Radar alert engine: loot aggregation (freebies + deals), per-user
// dedup via D1 sent_alerts, the 20-minute Telegram poller, the daily email
// digest, per-user alert preferences, and Telegram bot commands.
// Telegram fast alerts only, no per-drop emails (Resend budget).

import {
  UA, FREEBIES_URL, ACTIVE_ALERT_STORES, DEFAULT_DEAL_STORES,
  STORE_ALIASES, STORE_NAMES, STORE_PICK_ORDER,
} from "./config.js";
import { cleanTitle, esc } from "./util.js";
import { memGet, memPut } from "./cache.js";
import { storeUrl } from "./feeds.js";
import { sendTelegram, sendEmail } from "./notify.js";
import { dailyDigestEmail } from "./emails.js";

// Store names for alert payloads, with hardcoded fallbacks for the three alert stores.
export async function alertStoreNames() {
  const hit = memGet("alert:storenames");
  if (hit) return hit;
  const m = { "1": "Steam", "25": "Epic Games Store", "7": "GOG" };
  try {
    const res = await fetch("https://www.cheapshark.com/api/1.0/stores", { headers: { "User-Agent": UA, "Accept": "application/json" } });
    if (res.ok) {
      const data = await res.json();
      for (const s of (Array.isArray(data) ? data : [])) m[s.storeID] = s.storeName;
    }
  } catch (e) {}
  memPut("alert:storenames", m, 86400);
  return m;
}

export async function fetchLootItems(env, storeIDs) {
  // storeIDs: which storefronts to pull deals from. Defaults to DEFAULT_DEAL_STORES.
  // Memory (10 min) -> KV (20 min, shared across isolates/crons) -> upstream, keyed per store set.
  // KV writes: 2 per refresh (~144/day), far under the 500/day target.
  const stores = (Array.isArray(storeIDs) && storeIDs.length ? storeIDs : DEFAULT_DEAL_STORES).filter(s => ACTIVE_ALERT_STORES.includes(s));
  const dealKey = "loot:deals:" + stores.slice().sort().join(",");
  const mFree = memGet("loot:freebies"), mDeals = memGet(dealKey);
  if (mFree && mDeals) return { freebies: mFree, deals: mDeals };
  if (env && env.KV) {
    try {
      const kvFree = await env.KV.get("loot:freebies", "json");
      const kvDeals = await env.KV.get(dealKey, "json");
      if (kvFree && kvDeals) {
        memPut("loot:freebies", kvFree, 600);
        memPut(dealKey, kvDeals, 600);
        return { freebies: kvFree, deals: kvDeals };
      }
    } catch (e) {}
  }
  let freebies = [];
  try {
    const res = await fetch(FREEBIES_URL, { headers: { "User-Agent": UA, "Accept": "application/json" } });
    if (res.ok) {
      const data = await res.json();
      freebies = (Array.isArray(data) ? data : []).slice(0, 12).map(g => ({
        kind: "free",
        key: "free:" + String(g.title || "").toLowerCase().trim(),
        title: cleanTitle(g.title),
        url: g.open_giveaway_url || g.gamerpower_url || "#",
        image: g.image || "",
        worth: g.worth && g.worth !== "N/A" ? g.worth : "",
        platforms: g.platforms || "",
        ends: g.end_date && g.end_date !== "N/A" ? g.end_date : "",
      })).filter(g => g.key !== "free:");
    }
  } catch (e) {}
  // Alert deals: the requested stores, one fetch each, merged and
  // deduped by deal ID, 50%+ only (users filter further by their own threshold),
  // sorted by biggest discount.
  let deals = [];
  try {
    const names = await alertStoreNames();
    const lists = await Promise.all(stores.map(async (storeID) => {
      try {
        const res = await fetch("https://www.cheapshark.com/api/1.0/deals?storeID=" + storeID + "&upperPrice=5&pageSize=30&sortBy=Savings",
          { headers: { "User-Agent": UA, "Accept": "application/json" } });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (e) { return []; }
    }));
    const seen = {};
    for (const d of lists.flat()) {
      const id = d.dealID || "";
      if (!id || seen[id]) continue;
      seen[id] = 1;
      const savings = Math.round(parseFloat(d.savings) || 0);
      if (savings < 50) continue;
      deals.push({
        kind: "deal",
        key: "deal:" + id,
        gameID: d.gameID || null,
        title: d.title || "Untitled",
        store: names[d.storeID] || "PC",
        storeID: d.storeID || "1",
        url: storeUrl(d),
        image: d.thumb || "",
        sale: d.salePrice || "",
        normal: d.normalPrice || "",
        savings: savings,
      });
    }
    deals.sort((a, b) => b.savings - a.savings);
  } catch (e) {}
  // Write back to memory + KV so the next 20 minutes of crons/pages reuse it.
  memPut("loot:freebies", freebies, 600);
  memPut(dealKey, deals, 600);
  if (env && env.KV) {
    try {
      await env.KV.put("loot:freebies", JSON.stringify(freebies), { expirationTtl: 1200 });
      await env.KV.put(dealKey, JSON.stringify(deals), { expirationTtl: 1200 });
    } catch (e) {}
  }
  return { freebies: freebies, deals: deals };
}

// ---------- Alert preferences ----------
export function normPrefs(row) {
  const stores = String((row && row.deal_stores) || DEFAULT_DEAL_STORES.join(",")).split(",")
    .map(s => s.trim()).filter(s => ACTIVE_ALERT_STORES.includes(s));
  const md = parseInt(row && row.min_discount, 10);
  return {
    alert_freebies: !row || row.alert_freebies == null ? 1 : (row.alert_freebies ? 1 : 0),
    alert_deals: !row || row.alert_deals == null ? 1 : (row.alert_deals ? 1 : 0),
    deal_stores: stores.length ? stores : DEFAULT_DEAL_STORES.slice(),
    min_discount: (isFinite(md) && md >= 50 && md <= 95) ? md : 70,
    deals_mode: (row && row.deals_mode === "wishlist") ? "wishlist" : "all",
    digest_email: !row || row.digest_email == null ? 1 : (row.digest_email ? 1 : 0),
  };
}

// Validate and apply a prefs patch. Returns {ok} or {ok:false, error}.
export async function setPrefs(env, email, patch) {
  const sets = [];
  const vals = [];
  const bad = (m) => ({ ok: false, error: m });
  if (patch.alert_freebies !== undefined) {
    sets.push("alert_freebies = ?"); vals.push(patch.alert_freebies ? 1 : 0);
  }
  if (patch.alert_deals !== undefined) {
    sets.push("alert_deals = ?"); vals.push(patch.alert_deals ? 1 : 0);
  }
  if (patch.deal_stores !== undefined) {
    const list = String(patch.deal_stores).split(",").map(s => {
      s = s.trim().toLowerCase();
      return STORE_ALIASES[s] || s;
    }).filter(s => ACTIVE_ALERT_STORES.includes(s));
    const uniq = [...new Set(list)];
    if (!uniq.length) return bad("pick at least one store (see /stores for the list)");
    sets.push("deal_stores = ?"); vals.push(uniq.join(","));
  }
  if (patch.min_discount !== undefined) {
    const n = parseInt(patch.min_discount, 10);
    if (!isFinite(n) || n < 50 || n > 95) return bad("min discount must be 50-95");
    sets.push("min_discount = ?"); vals.push(n);
  }
  if (patch.deals_mode !== undefined) {
    const m = String(patch.deals_mode).toLowerCase();
    if (m !== "all" && m !== "wishlist") return bad("mode must be all or wishlist");
    sets.push("deals_mode = ?"); vals.push(m);
  }
  if (patch.digest_email !== undefined) {
    sets.push("digest_email = ?"); vals.push(patch.digest_email ? 1 : 0);
  }
  if (!sets.length) return bad("nothing to change");
  sets.push("updated_at = ?"); vals.push(new Date().toISOString());
  vals.push(email);
  try {
    await env.DB.prepare("UPDATE customers SET " + sets.join(", ") + " WHERE email = ?").bind(...vals).run();
    return { ok: true };
  } catch (e) { return bad("couldn't save, try again"); }
}

export function prefsSummary(p) {
  const stores = p.deal_stores.map(id => STORE_NAMES[id]).join(", ");
  return "🎮 <b>Your alert settings</b>\n\n" +
    "Free games: <b>" + (p.alert_freebies ? "on" : "off") + "</b>\n" +
    "Discounts: <b>" + (p.alert_deals ? "on" : "off") + "</b>\n" +
    "Stores: <b>" + stores + "</b>\n" +
    "Min. discount: <b>" + p.min_discount + "%</b>\n" +
    "Discount mode: <b>" + (p.deals_mode === "wishlist" ? "wishlist only" : "all deals") + "</b>\n\n" +
    "Change them with /help, or anytime at radar.codemeoww.com/pro";
}

// ---------- Single-message alert digest ----------
// Atomically claim (user, item). Returns true if this user never got it.
export async function claimItem(env, chatId, it) {
  const now = new Date().toISOString();
  try {
    const r = await env.DB.prepare("INSERT OR IGNORE INTO sent_alerts (chat_id, item_key, sent_at) VALUES (?,?,?)").bind(String(chatId), it.key, now).run();
    return !!(r && r.meta && r.meta.changes > 0);
  } catch (e) { return false; }
}
export async function releaseClaim(env, chatId, it) {
  try { await env.DB.prepare("DELETE FROM sent_alerts WHERE chat_id=? AND item_key=?").bind(String(chatId), it.key).run(); } catch (e) {}
}

// One message for the whole scan: game name first and bold, one compact
// detail line, then real tappable buttons (one per item) via reply_markup.
export function alertDigestCaption(items) {
  const n = items.length;
  let out = "🎮 <b>Loot Radar: " + n + " new drop" + (n === 1 ? "" : "s") + "</b>";
  for (const it of items) {
    if (it.kind === "deal") {
      out += "\n\n<b>" + esc(it.title) + "</b>\n" +
        "&#128293; " + it.savings + "% off · " + esc(it.store || "PC") + "\n" +
        "<s>$" + esc(it.normal) + "</s> → <b>$" + esc(it.sale) + "</b>" +
        (it.isNewLow ? "\n🏆 <b>lowest price ever tracked</b>" : "");
    } else {
      const meta = [it.worth ? "worth " + it.worth : "", it.ends ? "ends " + it.ends : "", it.platforms ? it.platforms : ""]
        .filter(function (x) { return !!x; }).join(" · ");
      out += "\n\n<b>" + esc(it.title) + "</b>\n" +
        "&#127918; <b>FREE</b>" + (meta ? " · " + esc(meta) : "");
    }
  }
  return out;
}

// Inline keyboard: one URL button per item, labeled with the game title so
// it's obvious which button opens which deal, plus a browse-all row.
export function alertButtons(items) {
  const rows = [];
  for (const it of items) {
    let label = String(it.title || "View deal");
    if (label.length > 24) label = label.slice(0, 23) + "…";
    const emoji = it.kind === "deal" ? "🔥 " : "🎁 ";
    rows.push([{ text: emoji + label + " →", url: it.url }]);
  }
  rows.push([{ text: "🌐 Browse all on Loot Radar", url: "https://radar.codemeoww.com/deals" }]);
  return { inline_keyboard: rows };
}

export async function wishlistTitleSet(env, email) {
  const s = {};
  try {
    const q = await env.DB.prepare("SELECT title FROM wishlist WHERE email = ?").bind(email).all();
    for (const r of ((q && q.results) || [])) s[String(r.title || "").toLowerCase().trim()] = 1;
  } catch (e) {}
  return s;
}

// ---------- Historical low tracking ----------
// CheapShark reports each game's all-time cheapest price (cheapestPriceEver)
// for free. We cache it in D1 (game_lows, refreshed weekly) so the 20-minute
// poll can flag deals sitting at their lowest tracked price without extra
// upstream calls. D1 budget: 1 batched read per poll, writes only when a
// game's cached low is missing, stale, or beaten by a live price.
const LOW_STALE_MS = 7 * 864e5;
export function normPrice(p) { const n = parseFloat(p); return isFinite(n) ? n : null; }

export async function getGameLows(env, gameIDs) {
  const lows = {};
  const ids = [...new Set((gameIDs || []).filter(Boolean))].map(String);
  if (!ids.length || !env || !env.DB) return lows;
  try {
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const q = await env.DB.prepare(
        "SELECT game_id, low_price, low_date, checked_at FROM game_lows WHERE game_id IN (" +
        chunk.map(() => "?").join(",") + ")").bind(...chunk).all();
      for (const r of ((q && q.results) || [])) {
        lows[r.game_id] = { price: r.low_price, date: r.low_date, checkedAt: r.checked_at };
      }
    }
  } catch (e) {}
  return lows;
}

async function fetchCheapSharkLow(gameID) {
  try {
    const res = await fetch("https://www.cheapshark.com/api/1.0/games?id=" + encodeURIComponent(gameID),
      { headers: { "User-Agent": UA, "Accept": "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const ce = data && data.cheapestPriceEver;
    const p = ce ? normPrice(ce.price) : null;
    return p == null ? null : { price: p, date: ce.date || null };
  } catch (e) { return null; }
}

export async function refreshGameLows(env, gameIDs) {
  const lows = await getGameLows(env, gameIDs);
  if (!env || !env.DB) return lows;
  const now = new Date().toISOString();
  const need = [...new Set((gameIDs || []).filter(Boolean))].map(String).filter(id => {
    const l = lows[id];
    return !l || !l.checkedAt || Date.parse(l.checkedAt) < Date.now() - LOW_STALE_MS;
  });
  for (const id of need.slice(0, 25)) {
    const f = await fetchCheapSharkLow(id);
    const price = f ? f.price : -1; // -1 = upstream had no low data; don't retry for a week
    lows[id] = { price, date: f ? f.date : null, checkedAt: now };
    try {
      await env.DB.prepare(
        "INSERT INTO game_lows(game_id, low_price, low_date, checked_at) VALUES(?,?,?,?) " +
        "ON CONFLICT(game_id) DO UPDATE SET low_price=excluded.low_price, low_date=excluded.low_date, checked_at=excluded.checked_at"
      ).bind(id, price, f ? f.date : null, now).run();
    } catch (e) {}
  }
  return lows;
}

// Tag deals sitting at (or below) their all-time low. If the live price beats
// the cached low, record it immediately so the next poll stays accurate.
export async function tagNewLows(env, deals) {
  try {
    const lows = await refreshGameLows(env, deals.map(d => d.gameID));
    const now = new Date().toISOString();
    for (const d of deals) {
      if (d.kind !== "deal" || !d.gameID) continue;
      const sale = normPrice(d.sale);
      const l = lows[String(d.gameID)];
      if (sale == null || !l || l.price < 0) continue;
      if (sale <= l.price) {
        d.isNewLow = true;
        if (sale < l.price) {
          try {
            await env.DB.prepare("UPDATE game_lows SET low_price=?, low_date=?, checked_at=? WHERE game_id=?")
              .bind(sale, Math.floor(Date.now() / 1000), now, String(d.gameID)).run();
          } catch (e) {}
          l.price = sale;
        }
      }
    }
  } catch (e) {}
  return deals;
}

// Read-only: mark deals at their all-time low for page rendering (no refresh).
export async function attachGameLows(env, deals) {
  try {
    const lows = await getGameLows(env, deals.map(d => d.gameID));
    for (const d of deals) {
      const p = normPrice(d.price);
      const l = d.gameID ? lows[String(d.gameID)] : null;
      if (p != null && l && l.price >= 0 && p <= l.price) d.atLow = true;
    }
  } catch (e) {}
  return deals;
}

export async function pollAndAlert(env) {
  if (!env || !env.KV || !env.DB) return;
  // Sent-ledger: atomic per-user dedup. Prune at 180 days, feeds turn over far
  // faster than that, so nothing can re-alert from a pruned row.
  try { await env.DB.prepare("DELETE FROM sent_alerts WHERE sent_at < datetime('now','-180 days')").run(); } catch (e) {}
  let users = [];
  try {
    const q = await env.DB.prepare("SELECT email, telegram_chat_id, alert_freebies, alert_deals, deal_stores, min_discount, deals_mode FROM customers WHERE pro = 1").all();
    users = (q && q.results) || [];
  } catch (e) { return; }
  // Fetch deals only for the stores somebody actually wants, one upstream
  // request per store, shared across all users.
  const wanted = {};
  for (const u of users) {
    if (!u.telegram_chat_id) continue;
    const p = normPrefs(u);
    if (p.alert_deals) for (const s of p.deal_stores) wanted[s] = 1;
  }
  const storeIDs = Object.keys(wanted).length ? Object.keys(wanted) : DEFAULT_DEAL_STORES.slice();
  const loot = await fetchLootItems(env, storeIDs);
  await tagNewLows(env, loot.deals);
  for (const u of users) {
    const chatId = u.telegram_chat_id ? String(u.telegram_chat_id) : null;
    if (!chatId) continue;
    const prefs = normPrefs(u);
    let items = [];
    if (prefs.alert_freebies) items = items.concat(loot.freebies);
    if (prefs.alert_deals) {
      let deals = loot.deals.filter(d => prefs.deal_stores.includes(d.storeID) && d.savings >= prefs.min_discount);
      if (prefs.deals_mode === "wishlist") {
        const wl = await wishlistTitleSet(env, u.email);
        deals = deals.filter(d => wl[d.title.toLowerCase().trim()]);
        // All-time lows for wishlist games alert even under the discount threshold.
        const extra = loot.deals.filter(d => d.isNewLow && prefs.deal_stores.includes(d.storeID) &&
          d.savings < prefs.min_discount && wl[d.title.toLowerCase().trim()]);
        const keys = {};
        deals.forEach(d => keys[d.key] = 1);
        for (const d of extra) if (!keys[d.key]) deals.push(d);
      }
      items = items.concat(deals);
    }
    if (!items.length) continue;
    // Claim everything new, then send ONE message for the whole scan.
    const fresh = [];
    for (const it of items) {
      if (fresh.length >= 8) break;
      if (await claimItem(env, chatId, it)) fresh.push(it);
    }
    if (!fresh.length) continue;
    const ok = await sendTelegram(env, chatId, alertDigestCaption(fresh), alertButtons(fresh));
    if (!ok) for (const it of fresh) await releaseClaim(env, chatId, it);
  }
}
export async function handleTelegramCommand(env, chatId, text) {
  const parts = text.trim().split(/\s+/);
  const cmd = (parts[0] || "").toLowerCase().split("@")[0]; // strip @botname suffix
  const args = parts.slice(1);
  let cust = null;
  try {
    const q = await env.DB.prepare("SELECT email, pro, alert_freebies, alert_deals, deal_stores, min_discount, deals_mode FROM customers WHERE telegram_chat_id = ?").bind(String(chatId)).all();
    cust = (q && q.results && q.results[0]) || null;
  } catch (e) {}
  if (!cust) {
    return "👋 Link your Loot Radar Pro account first: log in at https://radar.codemeoww.com/login and tap <b>Connect Telegram</b> in your dashboard.";
  }
  if (!cust.pro) {
    return "Alerts need Loot Radar Pro. Grab it at https://radar.codemeoww.com/pricing";
  }
  const save = async (patch) => {
    const r = await setPrefs(env, cust.email, patch);
    if (!r.ok) return "⚠️ " + esc(r.error);
    let row = null;
    try {
      const q = await env.DB.prepare("SELECT alert_freebies, alert_deals, deal_stores, min_discount, deals_mode FROM customers WHERE email = ?").bind(cust.email).all();
      row = (q && q.results && q.results[0]) || null;
    } catch (e) {}
    return prefsSummary(normPrefs(row));
  };
  switch (cmd) {
    case "/prefs": return prefsSummary(normPrefs(cust));
    case "/help":
      return "🎮 <b>Loot Radar commands</b>\n\n" +
        "/prefs: show your alert settings\n" +
        "/freebies on|off: free game alerts\n" +
        "/deals on|off: discount alerts\n" +
        "/stores: show/change deal stores\n" +
        "/minoff 70: minimum discount %, 50-95\n" +
        "/mode all|wishlist: all deals, or wishlist games only\n" +
        "/unlink: disconnect this Telegram account";
    case "/freebies":
      if (!/^(on|off)$/i.test(args[0] || "")) return "Usage: /freebies on  or  /freebies off";
      return save({ alert_freebies: /^on$/i.test(args[0]) });
    case "/deals":
      if (!/^(on|off)$/i.test(args[0] || "")) return "Usage: /deals on  or  /deals off";
      return save({ alert_deals: /^on$/i.test(args[0]) });
    case "/stores":
      if (!args.length) {
        const aliasOf = {};
        for (const a of Object.keys(STORE_ALIASES)) aliasOf[STORE_ALIASES[a]] = a;
        const list = STORE_PICK_ORDER.map(id => "• " + STORE_NAMES[id] + "  (<code>" + aliasOf[id] + "</code>)").join("\n");
        return "🏪 <b>Available stores</b>\n\n" + list +
          "\n\nYour stores: <b>" + normPrefs(cust).deal_stores.map(id => STORE_NAMES[id]).join(", ") + "</b>" +
          "\nChange with: <code>/stores steam epic</code>  or  <code>/stores all</code>";
      }
      if (/^all$/i.test(args[0])) return save({ deal_stores: ACTIVE_ALERT_STORES.join(",") });
      return save({ deal_stores: args.join(",") });
    case "/unlink":
      try {
        await env.DB.prepare("UPDATE customers SET telegram_chat_id = NULL, updated_at = ? WHERE email = ?")
          .bind(new Date().toISOString(), cust.email).run();
      } catch (e) { return "⚠️ couldn't disconnect, try again"; }
      return "📴 Telegram disconnected. Link a different account anytime from radar.codemeoww.com/pro";
    case "/minoff":
      if (!args[0]) return "Usage: /minoff 70  (50-95)";
      return save({ min_discount: args[0] });
    case "/mode":
      if (!/^(all|wishlist)$/i.test(args[0] || "")) return "Usage: /mode all  or  /mode wishlist";
      return save({ deals_mode: args[0].toLowerCase() });
    default: return null;
  }
}

export async function checkWishlistPrice(title) {
  const key = "wlprice:" + String(title).toLowerCase().trim();
  const hit = memGet(key);
  if (hit !== null) return hit || null; // "" sentinel = no result (cached)
  let out = null;
  try {
    const res = await fetch("https://www.cheapshark.com/api/1.0/games?title=" + encodeURIComponent(title) + "&limit=1", { headers: { "User-Agent": UA, "Accept": "application/json" } });
    if (res.ok) {
      const data = await res.json();
      const g = (Array.isArray(data) && data[0]) || null;
      if (g && g.cheapestDealID) {
        const steam = g.steamAppID ? "https://store.steampowered.com/app/" + g.steamAppID + "/" : null;
        out = { title: g.external || title, price: g.cheapest || "?", url: steam || ("https://www.cheapshark.com/redirect?dealID=" + g.cheapestDealID), thumb: g.thumb || "" };
      }
    }
  } catch (e) {}
  memPut(key, out || "", 600);
  return out;
}
// One email per Pro user per day: wishlist prices + fresh freebies + top deals.
export async function sendDailyDigest(env) {
  if (!env || !env.DB || !env.KV) return;
  const today = new Date().toISOString().slice(0, 10);
  let users = [];
  try {
    const q = await env.DB.prepare("SELECT email FROM customers WHERE pro = 1 AND (digest_email IS NULL OR digest_email = 1)").all();
    users = (q && q.results) || [];
  } catch (e) { return; }
  if (!users.length) return;
  const loot = await fetchLootItems(env);
  const freebies = loot.freebies.slice(0, 8);
  const deals = loot.deals.filter(d => d.savings >= 70).slice(0, 8);
  for (const u of users) {
    const email = u.email;
    if (!email) continue;
    try {
      const done = await env.KV.get("dailydigest:" + today + ":" + email);
      if (done) continue;
      let wl = [];
      try {
        const wq = await env.DB.prepare("SELECT title FROM wishlist WHERE email = ? ORDER BY added_at").bind(email).all();
        wl = (wq && wq.results) || [];
      } catch (e) {}
      const hits = [];
      const list = wl.slice(0, 20);
      for (let i = 0; i < list.length; i++) {
        const h = await checkWishlistPrice(list[i].title);
        if (h) hits.push(h);
      }
      const n = freebies.length + deals.length + hits.length;
      await sendEmail(env, email, "Today's loot: " + n + " finds on your radar", dailyDigestEmail(freebies, deals, hits));
      await env.KV.put("dailydigest:" + today + ":" + email, "1", { expirationTtl: 172800 });
    } catch (e) {}
  }
}
