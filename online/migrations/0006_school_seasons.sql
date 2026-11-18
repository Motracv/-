-- Ranked seasons are separate from friend matches and campaign currency.
CREATE TABLE IF NOT EXISTS school_season_entries (
  season INTEGER NOT NULL CHECK(season >= 1),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  defense TEXT NOT NULL CHECK(json_valid(defense)),
  power INTEGER NOT NULL CHECK(power > 0),
  points INTEGER NOT NULL DEFAULT 0,
  attacks INTEGER NOT NULL DEFAULT 0 CHECK(attacks >= 0),
  finalized INTEGER NOT NULL DEFAULT 0 CHECK(finalized IN (0, 1)),
  registered_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(season, account_id)
);
CREATE INDEX IF NOT EXISTS school_season_pool ON school_season_entries(season, power);
CREATE INDEX IF NOT EXISTS school_season_rank ON school_season_entries(season, points DESC);
CREATE TABLE IF NOT EXISTS school_season_days (
  season INTEGER NOT NULL,
  day INTEGER NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  attacks INTEGER NOT NULL DEFAULT 0 CHECK(attacks BETWEEN 0 AND 5),
  PRIMARY KEY(season, day, account_id)
);
CREATE TABLE IF NOT EXISTS school_season_matches (
  id TEXT PRIMARY KEY NOT NULL,
  season INTEGER NOT NULL,
  day INTEGER NOT NULL,
  challenger TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL UNIQUE,
  delta INTEGER NOT NULL CHECK(delta IN (-10, 0, 20)),
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  created_at INTEGER NOT NULL,
  CHECK(challenger <> target),
  UNIQUE(season, day, challenger, target)
);
CREATE INDEX IF NOT EXISTS school_season_attack_day ON school_season_matches(season, day, challenger);
CREATE INDEX IF NOT EXISTS school_season_target_history ON school_season_matches(target, created_at DESC);
-- Keep a minimal receipt after an opponent deletes their account/replay.
-- It contains no opponent identity or battle data and prevents charging twice.
CREATE TABLE IF NOT EXISTS school_season_receipts (
  request_key TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  match_id TEXT REFERENCES school_season_matches(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS school_season_awards (
  id TEXT PRIMARY KEY NOT NULL,
  season INTEGER NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK(tier IN ('bronze', 'silver', 'gold', 'diamond')),
  rating INTEGER NOT NULL CHECK(rating >= 0),
  created_at INTEGER NOT NULL,
  UNIQUE(season, account_id)
);
CREATE TABLE IF NOT EXISTS school_season_profiles (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  award_id TEXT REFERENCES school_season_awards(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL
);
