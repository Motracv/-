CREATE TABLE school_coop_presence (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 seen_at INTEGER NOT NULL
);
CREATE TABLE school_coop_invites (
 id TEXT PRIMARY KEY,
 sender TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 target TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 mode TEXT NOT NULL CHECK(mode IN ('yeti','raid')),
 room_id TEXT NOT NULL,
 guild_id TEXT REFERENCES school_guilds(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','expired')),
 request_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 UNIQUE(sender,request_id), CHECK(sender<>target)
);
CREATE INDEX school_coop_inbox ON school_coop_invites(target,status,expires_at);
CREATE INDEX school_coop_outbox ON school_coop_invites(sender,created_at);
CREATE UNIQUE INDEX school_coop_pending_pair ON school_coop_invites(mode,room_id,sender,target) WHERE status='pending';
CREATE TABLE school_coop_accepts (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 invite_id TEXT NOT NULL REFERENCES school_coop_invites(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
