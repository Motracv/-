CREATE TABLE school_yeti_rooms (
 id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE,
 creator_id TEXT REFERENCES accounts(id) ON DELETE SET NULL, request_id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)), revision INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(creator_id,request_id)
);
CREATE TABLE school_yeti_slots (
 account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 room_id TEXT NOT NULL REFERENCES school_yeti_rooms(id) ON DELETE CASCADE
);
CREATE INDEX school_yeti_slots_room ON school_yeti_slots(room_id);
CREATE TABLE school_yeti_rewards (
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 room_id TEXT NOT NULL, snowflakes INTEGER NOT NULL CHECK(snowflakes BETWEEN 20 AND 50),
 claimed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,room_id)
);
CREATE TRIGGER school_yeti_delete_account BEFORE DELETE ON accounts BEGIN
 UPDATE school_yeti_rooms SET payload=json_set(payload,
 '$.status','finished','$.outcome','abandoned',
 '$.host',CASE WHEN json_extract(payload,'$.host')=OLD.id THEN NULL ELSE json_extract(payload,'$.host') END,
 '$.members',json(COALESCE((SELECT json_group_array(json(value)) FROM json_each(payload,'$.members') WHERE json_extract(value,'$.account')<>OLD.id),'[]')),
 '$.battle.ended',json('true'),'$.battle.outcome','abandoned',
 '$.battle.teams',json(COALESCE((SELECT json_group_array(json(value)) FROM json_each(payload,'$.battle.teams') WHERE json_extract(value,'$.account')<>OLD.id),'[]')),
 '$.battle.events',json('[]'),'$.receipts',json('[]')),revision=revision+1
 WHERE EXISTS(SELECT 1 FROM json_each(payload,'$.members') WHERE json_extract(value,'$.account')=OLD.id)
 OR EXISTS(SELECT 1 FROM json_each(payload,'$.battle.teams') WHERE json_extract(value,'$.account')=OLD.id);
 DELETE FROM school_yeti_slots WHERE room_id IN (SELECT id FROM school_yeti_rooms WHERE json_extract(payload,'$.status')='finished');
END;

-- Withdrawn raiders remain in the damage snapshot until settlement. Remove
-- their identity there too when an account is deleted after leaving the room.
DROP TRIGGER school_raid_delete_account;
CREATE TRIGGER school_raid_delete_account BEFORE DELETE ON accounts BEGIN
 UPDATE school_raids SET payload=json_set(payload,
 '$.room.host',CASE WHEN json_extract(payload,'$.room.host')=OLD.id THEN NULL ELSE json_extract(payload,'$.room.host') END,
 '$.room.members',json(COALESCE((SELECT json_group_array(json(value)) FROM json_each(payload,'$.room.members') WHERE json_extract(value,'$.account')<>OLD.id),'[]')),
 '$.room.battle.teams',json(COALESCE((SELECT json_group_array(json(value)) FROM json_each(payload,'$.room.battle.teams') WHERE json_extract(value,'$.account')<>OLD.id),'[]')),
 '$.room.battle.events',json('[]')),revision=revision+1
 WHERE EXISTS(SELECT 1 FROM json_each(payload,'$.room.members') WHERE json_extract(value,'$.account')=OLD.id)
 OR EXISTS(SELECT 1 FROM json_each(payload,'$.room.battle.teams') WHERE json_extract(value,'$.account')=OLD.id);
 UPDATE school_raids SET payload=json_set(payload,'$.receipts',json(COALESCE((SELECT json_group_array(value) FROM json_each(payload,'$.receipts') WHERE value NOT LIKE OLD.id||':%'),'[]'))),revision=revision+1 WHERE payload LIKE '%'||OLD.id||'%';
END;
