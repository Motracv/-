CREATE TABLE school_raids (
 guild_id TEXT PRIMARY KEY NOT NULL REFERENCES school_guilds(id) ON DELETE CASCADE,
 payload TEXT NOT NULL CHECK(json_valid(payload)), revision INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
);
CREATE TABLE school_raid_slots (
 account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 guild_id TEXT NOT NULL REFERENCES school_guilds(id) ON DELETE CASCADE,
 room_id TEXT NOT NULL
);
CREATE INDEX school_raid_slots_room ON school_raid_slots(guild_id,room_id);
CREATE TABLE school_raid_days (
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 day INTEGER NOT NULL, used INTEGER NOT NULL CHECK(used BETWEEN 0 AND 5), PRIMARY KEY(account_id,day)
);
CREATE TABLE school_raid_scores (
 guild_id TEXT NOT NULL REFERENCES school_guilds(id) ON DELETE CASCADE,
 cycle INTEGER NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 damage INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(guild_id,cycle,account_id)
);
CREATE TABLE school_raid_rewards (
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, room_id TEXT NOT NULL,
 gold INTEGER NOT NULL, gems INTEGER NOT NULL, damage INTEGER NOT NULL, claimed INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL, PRIMARY KEY(account_id,room_id)
);
CREATE TRIGGER school_raid_delete_account BEFORE DELETE ON accounts BEGIN
 UPDATE school_raids SET payload=json_set(payload,
 '$.room.host',CASE WHEN json_extract(payload,'$.room.host')=OLD.id THEN NULL ELSE json_extract(payload,'$.room.host') END,
 '$.room.members',json(COALESCE((SELECT json_group_array(json(value)) FROM json_each(payload,'$.room.members') WHERE json_extract(value,'$.account')<>OLD.id),'[]')),
 '$.room.battle.teams',json(COALESCE((SELECT json_group_array(json(value)) FROM json_each(payload,'$.room.battle.teams') WHERE json_extract(value,'$.account')<>OLD.id),'[]')),
 '$.room.battle.events',json('[]')), revision=revision+1
 WHERE EXISTS(SELECT 1 FROM json_each(payload,'$.room.members') WHERE json_extract(value,'$.account')=OLD.id);
 UPDATE school_raids SET payload=json_set(payload,'$.receipts',json(COALESCE((SELECT json_group_array(value) FROM json_each(payload,'$.receipts') WHERE value NOT LIKE OLD.id||':%'),'[]'))),revision=revision+1 WHERE payload LIKE '%'||OLD.id||'%';
END;
