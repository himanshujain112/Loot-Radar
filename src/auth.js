// Loot Radar auth: magic-link sessions (KV), Pro status (D1, cached),
// wishlist reads, and Pro API key authentication + per-key rate limiting.

import { getCookie, sha256hex } from "./util.js";
import { memGet, memPut } from "./cache.js";

export async function sessionEmail(request, env) {
  const sid = getCookie(request, "lr_sess");
  if (!sid || !env || !env.KV) return null;
  const hit = memGet("sess:" + sid);
  if (hit !== null) return hit || null; // "" sentinel = no session (cached)
  const s = await env.KV.get("sess:" + sid, "json");
  const email = (s && s.email) || null;
  memPut("sess:" + sid, email || "", 120);
  return email;
}
export async function proStatus(env, email) {
  if (!env || !env.DB || !email) return { pro: false, plan: null, telegram: false };
  const hit = memGet("pro:" + email);
  if (hit) return hit;
  const row = await env.DB.prepare("SELECT pro, plan, telegram_chat_id, discord_user_id FROM customers WHERE email = ?").bind(email).first();
  const st = { pro: !!(row && row.pro), plan: (row && row.plan) || null, telegram: !!(row && row.telegram_chat_id), discord: !!(row && row.discord_user_id) };
  memPut("pro:" + email, st, 120); // webhook flips propagate within ~2 min
  return st;
}
export async function getWishlist(env, email) {
  if (!env || !env.DB || !email) return [];
  const hit = memGet("wl:" + email);
  if (hit) return hit;
  let items = [];
  try {
    const wq = await env.DB.prepare("SELECT title FROM wishlist WHERE email = ? ORDER BY added_at").bind(email).all();
    items = ((wq && wq.results) || []).map(function (r) { return r.title; });
  } catch (e) {}
  memPut("wl:" + email, items, 120);
  return items;
}

/* ---------- Pro-only API keys ---------- */
export function apiKeyFrom(request, url) {
  const h = request.headers.get("X-API-Key") || request.headers.get("x-api-key") || "";
  if (h) return String(h).trim();
  const q = url.searchParams.get("key") || url.searchParams.get("api_key") || "";
  return String(q).trim();
}
// Light per-key rate limit (per isolate): 600 requests/hour. Protects upstream + KV budgets.
const rlMap = new Map();
export function rateOk(id, limit, windowSec) {
  const now = Date.now();
  const e = rlMap.get(id);
  if (!e || now > e.exp) { rlMap.set(id, { n: 1, exp: now + windowSec * 1000 }); return true; }
  e.n++;
  return e.n <= limit;
}
// Returns { email } when the key is valid and its owner is Pro, else null.
export async function apiKeyAuth(request, env, url) {
  const key = apiKeyFrom(request, url);
  if (!key || key.indexOf("lr_") !== 0 || !env || !env.DB) return null;
  const hash = await sha256hex(key);
  const hit = memGet("apikey:" + hash);
  if (hit !== null) return hit === "" ? null : hit;
  let row = null;
  try { row = await env.DB.prepare("SELECT email, revoked FROM api_keys WHERE api_key_hash = ?").bind(hash).first(); } catch (e) {}
  let auth = null;
  if (row && !row.revoked) {
    const st = await proStatus(env, row.email);
    if (st.pro) auth = { email: row.email, hash: hash };
  }
  memPut("apikey:" + hash, auth || "", 300);
  return auth;
}
