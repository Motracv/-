CREATE TABLE school_coop_sessions (
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 client_id TEXT NOT NULL,
 seen_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,client_id)
);
CREATE INDEX school_coop_sessions_seen ON school_coop_sessions(account_id,seen_at);
