CREATE TABLE IF NOT EXISTS school_guilds (
 id TEXT PRIMARY KEY NOT NULL,
 name_key TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 emblem INTEGER NOT NULL DEFAULT 0 CHECK(emblem BETWEEN 0 AND 2),
 notice TEXT NOT NULL DEFAULT '',
 creation_key TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS school_guild_members (
 account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 guild_id TEXT NOT NULL REFERENCES school_guilds(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('leader','member')),
 membership_key TEXT NOT NULL UNIQUE,
 joined_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS school_guild_members_guild ON school_guild_members(guild_id,joined_at);
CREATE UNIQUE INDEX IF NOT EXISTS school_guild_one_leader ON school_guild_members(guild_id) WHERE role='leader';
CREATE TABLE IF NOT EXISTS school_guild_invites (
 id TEXT PRIMARY KEY NOT NULL,
 guild_id TEXT NOT NULL REFERENCES school_guilds(id) ON DELETE CASCADE,
 target TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 UNIQUE(guild_id,target)
);
CREATE INDEX IF NOT EXISTS school_guild_invites_target ON school_guild_invites(target,expires_at);
CREATE TABLE IF NOT EXISTS school_guild_attendance (
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 day INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,day)
);
CREATE TRIGGER IF NOT EXISTS school_guild_capacity BEFORE INSERT ON school_guild_members
WHEN (SELECT COUNT(*) FROM school_guild_members WHERE guild_id=NEW.guild_id)>=30
BEGIN SELECT RAISE(ABORT,'guild_full'); END;
-- Account deletion and the last member leaving must not strand a guild.
CREATE TRIGGER IF NOT EXISTS school_guild_successor AFTER DELETE ON school_guild_members
BEGIN
 UPDATE school_guild_members SET role='leader' WHERE account_id=(SELECT account_id FROM school_guild_members WHERE guild_id=OLD.guild_id ORDER BY joined_at,account_id LIMIT 1) AND OLD.role='leader' AND NOT EXISTS(SELECT 1 FROM school_guild_members WHERE guild_id=OLD.guild_id AND role='leader');
 DELETE FROM school_guilds WHERE id=OLD.guild_id AND NOT EXISTS(SELECT 1 FROM school_guild_members WHERE guild_id=OLD.guild_id);
END;
