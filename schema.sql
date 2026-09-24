-- Loot Radar v1 — D1 schema
-- Apply with: npx wrangler d1 execute loot-radar-db --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_entitlements (
  email TEXT PRIMARY KEY,
  plan TEXT NOT NULL,            -- 'monthly' | 'yearly'
  status TEXT NOT NULL,          -- 'active' | 'cancelled' | 'on_hold' | 'expired'
  current_period_end TEXT,       -- ISO-8601 timestamp
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS preferences (
  email TEXT PRIMARY KEY,
  notify_email INTEGER NOT NULL DEFAULT 1,  -- 1 = on, 0 = off
  telegram_chat_id TEXT,                    -- set when the user links Telegram
  discord_webhook_url TEXT,                 -- user-pasted channel webhook URL
  wishlist_threshold INTEGER                -- cents; reserved for per-user deal threshold
);

CREATE TABLE IF NOT EXISTS wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  game_title TEXT NOT NULL,
  target_price_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wishlist_email ON wishlist(email);

CREATE TABLE IF NOT EXISTS deals_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,          -- e.g. 'epic', 'steam', 'gog'
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  freebie INTEGER NOT NULL DEFAULT 0,  -- 1 = currently free to claim
  seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deals_cache_seen ON deals_cache(seen_at);

CREATE TABLE IF NOT EXISTS alert_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  channel TEXT NOT NULL,         -- 'email' | 'telegram' | 'discord'
  deal_id INTEGER,               -- deals_cache.id (nullable for non-deal alerts)
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alert_log_email ON alert_log(email);

-- Historical low tracking (added 2026-09-24): CheapShark cheapestPriceEver
-- cached per game, refreshed weekly. -1 low_price = upstream had no data.
CREATE TABLE IF NOT EXISTS game_lows (
  game_id TEXT PRIMARY KEY,
  low_price REAL NOT NULL,
  low_date INTEGER,
  checked_at TEXT NOT NULL
);
