CREATE TABLE IF NOT EXISTS school_names (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS school_friends (
  id TEXT PRIMARY KEY NOT NULL,
  pair_key TEXT NOT NULL UNIQUE,
  requester TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('pending', 'accepted')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS school_friends_target ON school_friends(target, status);
CREATE INDEX IF NOT EXISTS school_friends_requester ON school_friends(requester, status);
CREATE TABLE IF NOT EXISTS school_arena (
  id TEXT PRIMARY KEY NOT NULL,
  challenger TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('pending', 'done', 'declined')),
  request_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  payload TEXT
);
CREATE INDEX IF NOT EXISTS school_arena_challenger ON school_arena(challenger, created_at);
CREATE INDEX IF NOT EXISTS school_arena_target ON school_arena(target, created_at);
