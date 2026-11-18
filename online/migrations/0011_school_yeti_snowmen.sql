-- Existing victories keep their recorded rewards. Only new victories award a
-- roulette ticket, settled and claimed in the same transaction as snowflakes.
ALTER TABLE school_yeti_rewards ADD COLUMN snowmen INTEGER NOT NULL DEFAULT 0 CHECK(snowmen BETWEEN 0 AND 1);
