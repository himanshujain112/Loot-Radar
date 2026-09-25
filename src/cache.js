// Loot Radar caching: stay under HALF of the free-tier limits.
// Published free-tier limits and our self-imposed targets (half):
//   KV: 100k reads/day, 1k writes/day   -> target < 50k reads,  < 500 writes/day
//   D1: 5M rows read/day, 100k rows written/day -> target < 2.5M reads, < 50k writes/day
// Strategy: per-isolate in-memory cache absorbs repeat reads (sessions, pro
// status, API keys, wishlist, upstream JSON); KV backs loot data so crons and
// web isolates share one upstream fetch; D1 writes are claim/insert-only.

import { CACHE_TTL } from "./config.js";

const mem = new Map();
export function memGet(k) {
  const e = mem.get(k);
  if (!e) return null;
  if (Date.now() > e.exp) { mem.delete(k); return null; }
  return e.val;
}
export function memPut(k, v, ttlSec) {
  mem.set(k, { val: v, exp: Date.now() + ttlSec * 1000 });
  if (mem.size > 600) mem.delete(mem.keys().next().value);
}
export function memDel(k) { mem.delete(k); }

// Negative-cache marker: a recent upstream failure for this URL. Served from
// memory (per isolate) and the shared Cache API so a failing isolate backs off
// instead of retrying upstream on every request (retry storm keeps the upstream
// rate-limited and the pool flapping between full and empty).
const NEG = "[fetchcached-negative-cache]";
const NEG_TTL = 60; // back off 60s, then try upstream again

function negCache(ctx, cache, req, mkey) {
  memPut(mkey, NEG, NEG_TTL);
  try {
    const res = new Response("upstream error", {
      status: 503,
      headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=" + NEG_TTL },
    });
    ctx.waitUntil(cache.put(req, res));
  } catch (e) {}
}

export async function fetchCached(ctx, url, headers, ttlSec) {
  // In-memory first (per isolate), then Cache API, then upstream.
  const ttl = ttlSec || CACHE_TTL;
  const mkey = "url:" + url;
  const hit = memGet(mkey);
  if (hit === NEG) throw new Error("upstream recently failed");
  if (hit) {
    return new Response(hit, { headers: { "Content-Type": "application/json" } });
  }
  const cache = caches.default;
  const req = new Request(url, { headers });
  let text = null;
  const cached = await cache.match(req);
  if (cached) {
    if (!cached.ok) throw new Error("upstream recently failed"); // NEG marker
    text = await cached.text();
  } else {
    let upstream;
    try {
      upstream = await fetch(url, { headers });
    } catch (e) {
      negCache(ctx, cache, req, mkey);
      throw new Error("upstream fetch failed");
    }
    if (!upstream.ok) {
      negCache(ctx, cache, req, mkey);
      throw new Error("upstream " + upstream.status);
    }
    text = await upstream.text();
    const res = new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
    });
    res.headers.set("Cache-Control", "public, max-age=" + ttl);
    ctx.waitUntil(cache.put(req, res.clone()));
  }
  memPut(mkey, text, ttl);
  return new Response(text, { headers: { "Content-Type": "application/json" } });
}
