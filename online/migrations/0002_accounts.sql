CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  google_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE account_sessions (
  hash TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);
CREATE INDEX account_sessions_expiry ON account_sessions(expires);
CREATE INDEX account_sessions_owner ON account_sessions(account_id);
CREATE TABLE login_challenges (
  hash TEXT PRIMARY KEY NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX login_challenges_expiry ON login_challenges(expires);
CREATE TABLE match_awards (
  match_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL,
  result TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (match_id, account_id)
);
CREATE INDEX match_awards_owner ON match_awards(account_id);
