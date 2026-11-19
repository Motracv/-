CREATE TABLE school_community_entries (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 kind TEXT NOT NULL CHECK(kind IN ('chat','post','comment')),
 parent_id INTEGER REFERENCES school_community_entries(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL UNIQUE,
 title TEXT NOT NULL DEFAULT '',
 body TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1))
);
CREATE INDEX school_community_feed ON school_community_entries(kind,deleted,id);
CREATE INDEX school_community_comments ON school_community_entries(parent_id,id);
CREATE INDEX school_community_rate ON school_community_entries(account_id,kind,created_at);
CREATE TABLE school_community_reports (
 entry_id INTEGER NOT NULL REFERENCES school_community_entries(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 reason TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(entry_id,account_id)
);
