// D1-backed KV replacement. The old Workers KV namespace had a 1k/day write
// limit that bot traffic kept tripping (50% warnings); D1 gives 100k rows
// written/day and 5M rows read/day on the free tier, plus strong consistency,
// which KV's eventual consistency couldn't offer for sessions and tokens.
//
// API mirrors the KV calls it replaces:
//   kvGet(env, key)            -> string | null
//   kvGet(env, key, "json")    -> parsed object | null
//   kvPut(env, key, value, ttlSec)
//   kvDelete(env, key)
// Expiry is lazy: expired rows read as missing and are deleted on read;
// pruneKvStore() sweeps leftovers (called from the daily digest cron).

export async function kvGet(env, key, format) {
  if (!env || !env.DB || !key) return null;
  try {
    const row = await env.DB.prepare(
      "SELECT value, expires_at FROM kv_store WHERE key = ?"
    ).bind(key).first();
    if (!row) return null;
    const now = Math.floor(Date.now() / 1000);
    if (row.expires_at !== null && row.expires_at !== undefined && row.expires_at <= now) {
      try { await env.DB.prepare("DELETE FROM kv_store WHERE key = ?").bind(key).run(); } catch (e) {}
      return null;
    }
    if (format === "json") {
      try { return JSON.parse(row.value); } catch (e) { return null; }
    }
    return row.value;
  } catch (e) {
    return null;
  }
}

export async function kvPut(env, key, value, ttlSec) {
  if (!env || !env.DB || !key) return;
  const v = typeof value === "string" ? value : JSON.stringify(value);
  const exp = ttlSec ? Math.floor(Date.now() / 1000) + ttlSec : null;
  try {
    await env.DB.prepare(
      "INSERT INTO kv_store (key, value, expires_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at"
    ).bind(key, v, exp).run();
  } catch (e) {}
}

export async function kvDelete(env, key) {
  if (!env || !env.DB || !key) return;
  try {
    await env.DB.prepare("DELETE FROM kv_store WHERE key = ?").bind(key).run();
  } catch (e) {}
}

// Remove expired rows. Runs from the daily digest cron; cheap (one DELETE).
export async function pruneKvStore(env) {
  if (!env || !env.DB) return 0;
  try {
    const r = await env.DB.prepare(
      "DELETE FROM kv_store WHERE expires_at IS NOT NULL AND expires_at <= ?"
    ).bind(Math.floor(Date.now() / 1000)).run();
    return (r && r.meta && r.meta.changes) || 0;
  } catch (e) {
    return 0;
  }
}
