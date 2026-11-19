-- Preserve every historical victory and its claimed state. The four-day event
-- doubles newly earned snowflakes only; roulette tickets stay at one.
CREATE TABLE school_yeti_rewards_weekend (
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 room_id TEXT NOT NULL, snowflakes INTEGER NOT NULL CHECK(snowflakes BETWEEN 20 AND 100),
 claimed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
 snowmen INTEGER NOT NULL DEFAULT 0 CHECK(snowmen BETWEEN 0 AND 1),
 PRIMARY KEY(account_id,room_id)
);
INSERT INTO school_yeti_rewards_weekend(account_id,room_id,snowflakes,claimed,created_at,snowmen)
 SELECT account_id,room_id,snowflakes,claimed,created_at,snowmen FROM school_yeti_rewards;
DROP TABLE school_yeti_rewards;
ALTER TABLE school_yeti_rewards_weekend RENAME TO school_yeti_rewards;
