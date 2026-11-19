-- Global one-use reward receipts intentionally survive account deletion.
-- The actual redemption code and its hash are never stored in this table.
CREATE TABLE school_private_reward_claims (
  receipt_id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  request_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
