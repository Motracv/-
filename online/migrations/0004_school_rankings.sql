-- Expression indexes only; existing saves and account identifiers are unchanged.
CREATE INDEX school_level_ranking ON school_saves (
  CAST(json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END, '$.captain.level') AS INTEGER) DESC,
  CAST(COALESCE(json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END, '$.captain.xp'), 0) AS INTEGER) DESC,
  account_id
) WHERE json_valid(payload);
--> statement-breakpoint
CREATE INDEX school_tower_ranking ON school_saves (
  CAST(COALESCE(json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END, '$.activities.towerBest'), 0) AS INTEGER) DESC,
  account_id
) WHERE json_valid(payload);
