CREATE TABLE school_guild_projects (
 guild_id TEXT NOT NULL REFERENCES school_guilds(id) ON DELETE CASCADE,
 week INTEGER NOT NULL,
 quest_id TEXT NOT NULL,
 stars INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(guild_id,week,quest_id)
);
CREATE TABLE school_guild_activity (
 event_key TEXT PRIMARY KEY NOT NULL,
 guild_id TEXT NOT NULL REFERENCES school_guilds(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 week INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('attendance','raid')),
 reference TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount>=0),
 coop INTEGER NOT NULL DEFAULT 0 CHECK(coop IN (0,1)),
 created_at INTEGER NOT NULL
);
CREATE INDEX school_guild_activity_week ON school_guild_activity(guild_id,week,account_id);
CREATE TABLE school_guild_project_claims (
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 week INTEGER NOT NULL,
 quest_id TEXT NOT NULL,
 guild_id TEXT REFERENCES school_guilds(id) ON DELETE SET NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,week,quest_id)
);
CREATE TABLE school_guild_rooms (
 guild_id TEXT PRIMARY KEY NOT NULL REFERENCES school_guilds(id) ON DELETE CASCADE,
 theme TEXT NOT NULL DEFAULT 'dawn' CHECK(theme IN ('dawn','moon','winter')),
 rug TEXT NOT NULL DEFAULT 'teal' CHECK(rug IN ('teal','rose','night')),
 furniture TEXT NOT NULL DEFAULT 'plants' CHECK(furniture IN ('plants','books','trophy')),
 revision INTEGER NOT NULL DEFAULT 0,
 request_key TEXT NOT NULL DEFAULT ''
);
-- Completion is an immutable guild achievement. Deleting an account removes its
-- contribution rows, but does not take an earned decoration away from the guild.
CREATE TRIGGER school_guild_activity_complete AFTER INSERT ON school_guild_activity
BEGIN
 INSERT OR IGNORE INTO school_guild_projects(guild_id,week,quest_id,stars,created_at)
 SELECT NEW.guild_id,NEW.week,'attendance',2,NEW.created_at
 WHERE (SELECT COUNT(*) FROM school_guild_activity WHERE guild_id=NEW.guild_id AND week=NEW.week AND kind='attendance')>=10;
 INSERT OR IGNORE INTO school_guild_projects(guild_id,week,quest_id,stars,created_at)
 SELECT NEW.guild_id,NEW.week,'coop',3,NEW.created_at
 WHERE (SELECT COUNT(DISTINCT reference) FROM school_guild_activity WHERE guild_id=NEW.guild_id AND week=NEW.week AND kind='raid' AND coop=1)>=5;
 INSERT OR IGNORE INTO school_guild_projects(guild_id,week,quest_id,stars,created_at)
 SELECT NEW.guild_id,NEW.week,'damage',5,NEW.created_at
 WHERE (SELECT COALESCE(SUM(amount),0) FROM school_guild_activity WHERE guild_id=NEW.guild_id AND week=NEW.week AND kind='raid')>=3000000;
END;
