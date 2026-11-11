PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  puuid TEXT NOT NULL UNIQUE,
  game_name TEXT,
  tag_line TEXT,
  region TEXT NOT NULL DEFAULT 'ap',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS notification_destinations (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  discord_webhook_encrypted TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS processed_matches (
  match_id TEXT PRIMARY KEY,
  puuid TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_processed_puuid ON processed_matches(puuid);
