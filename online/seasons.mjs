import { simulateArena } from './arena.mjs';

const fail = (ok, message, status = 400) => { if (!ok) throw Object.assign(new Error(message), { status }); };
const uid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
const DAY = 86400000, KST = 9 * 3600000;
export const SEASON_RULES = Object.freeze({ anchor: Date.parse('2026-11-18T00:00:00+09:00'), duration: 28 * DAY, dailyAttacks: 5, powerRange: [.65, 1.35], win: 20, loss: -10, draw: 0, minimumRewardAttacks: 5, defenderRatingChanges: false, tiers: [{ id: 'bronze', minimum: 0 }, { id: 'silver', minimum: 1100 }, { id: 'gold', minimum: 1250 }, { id: 'diamond', minimum: 1450 }] });
const day = now => Math.floor((now + KST) / DAY);
export function currentSeason(now) {
  const index = Math.max(0, Math.floor((now - SEASON_RULES.anchor) / SEASON_RULES.duration)), startsAt = SEASON_RULES.anchor + index * SEASON_RULES.duration;
  return { id: index + 1, number: index + 1, name: `시즌 ${index + 1}`, startsAt, endsAt: startsAt + SEASON_RULES.duration, phase: now < startsAt ? 'upcoming' : 'active' };
}
export const seasonTier = rating => rating >= 1450 ? 'diamond' : rating >= 1250 ? 'gold' : rating >= 1100 ? 'silver' : 'bronze';
const rating = entry => Math.max(0, 1000 + (entry?.points || 0));
const tierName = { bronze: '브론즈', silver: '실버', gold: '골드', diamond: '다이아' };
export function seasonCosmetic(row) {
  return row && tierName[row.tier] ? { awardId: row.id, title: `시즌 ${row.season} · ${tierName[row.tier]} 도전자`, frame: `season-${row.tier}` } : null;
}
export async function equippedSeasonCosmetic(db, id) {
  const row = await db.prepare('SELECT a.* FROM school_season_profiles p JOIN school_season_awards a ON a.id = p.award_id AND a.account_id = p.account_id WHERE p.account_id = ?').bind(id).first();
  return seasonCosmetic(row);
}

export function createSeasons(game) {
  async function save(db, id) {
    const row = await db.prepare('SELECT payload FROM school_saves WHERE account_id = ?').bind(id).first();
    fail(row, '먼저 학교용병단을 시작해 주세요.', 409);
    const value = JSON.parse(row.payload); fail(game.validate(value), '저장 정보를 확인해 주세요.', 409); return value;
  }
  const snapshot = state => {
    const result = { team: [...state.team], units: Object.fromEntries(state.team.map(id => [id, { level: state.units[id].level, stars: state.units[id].stars }])) };
    const equipment = game.snapshotEquipment?.(state, state.team);
    if (equipment && Object.keys(equipment.equipped).length) result.equipment = equipment;
    return result;
  };
  async function settle(db, id, season, now) {
    // A finished entry is immutable. Awards are minted once, without touching
    // gold, gems, campaign saves, or the current season's attack allowance.
    await db.batch([
      db.prepare('UPDATE school_season_entries SET finalized = 1 WHERE account_id = ? AND season < ? AND finalized = 0').bind(id, season.id),
      db.prepare(`INSERT OR IGNORE INTO school_season_awards(id,season,account_id,tier,rating,created_at)
      SELECT CAST(season AS TEXT)||':'||account_id,season,account_id,
        CASE WHEN 1000+points >= 1450 THEN 'diamond' WHEN 1000+points >= 1250 THEN 'gold' WHEN 1000+points >= 1100 THEN 'silver' ELSE 'bronze' END,
        MAX(0,1000+points),? FROM school_season_entries WHERE account_id = ? AND season < ? AND attacks >= ?`)
        .bind(now, id, season.id, SEASON_RULES.minimumRewardAttacks),
    ]);
  }
  async function candidates(db, id, season, now, power) {
    if (!power || season.phase !== 'active') return [];
    const rows = (await db.prepare(`SELECT e.account_id AS id,e.power,e.points,e.defense,n.display_name AS name,
        a.id AS award_id,a.season AS award_season,a.tier AS award_tier
      FROM school_season_entries e JOIN school_names n ON n.account_id = e.account_id
      LEFT JOIN school_season_profiles p ON p.account_id = e.account_id
      LEFT JOIN school_season_awards a ON a.id = p.award_id AND a.account_id = e.account_id
      WHERE e.season = ? AND e.account_id <> ? AND e.power BETWEEN ? AND ?
      AND NOT EXISTS (SELECT 1 FROM school_season_matches m WHERE m.season = e.season AND m.day = ? AND m.challenger = ? AND m.target = e.account_id)
      ORDER BY ABS(e.power - ?) ASC,e.account_id ASC LIMIT 3`)
      .bind(season.id, id, Math.ceil(power * .65), Math.floor(power * 1.35), day(now), id, power).all()).results || [];
    return rows.map(row => ({ id: row.id, name: row.name, power: row.power, rating: rating(row), tier: seasonTier(rating(row)), team: JSON.parse(row.defense).team,
      cosmetic: seasonCosmetic({ id: row.award_id, season: row.award_season, tier: row.award_tier }) }));
  }
  function matchView(row, id) {
    const match = JSON.parse(row.payload), meSide = row.challenger === id ? 0 : 1;
    return { ...match, id: row.id, createdAt: row.created_at, seasonId: row.season, mode: 'season', meSide, isAttack: meSide === 0, ratingChange: meSide === 0 ? row.delta : 0 };
  }
  async function receipt(db, id, key, now) {
    const prior = await db.prepare('SELECT match_id FROM school_season_receipts WHERE request_key = ? AND account_id = ?').bind(key, id).first();
    if (!prior) return null;
    const row = prior.match_id && await db.prepare('SELECT * FROM school_season_matches WHERE id = ?').bind(prior.match_id).first();
    return { ...await state(db, id, now), repeated: true, match: row ? matchView(row, id) : null, ...(!row ? { matchUnavailable: true } : {}) };
  }
  async function state(db, id, now) {
    const season = currentSeason(now); await settle(db, id, season, now);
    const [ownSave, own, entry, usage, awardRows, matchRows, rankRows, cosmetic] = await Promise.all([
      save(db, id),
      db.prepare('SELECT display_name FROM school_names WHERE account_id = ?').bind(id).first(),
      db.prepare('SELECT * FROM school_season_entries WHERE season = ? AND account_id = ?').bind(season.id, id).first(),
      db.prepare('SELECT attacks AS n FROM school_season_days WHERE season = ? AND day = ? AND account_id = ?').bind(season.id, day(now), id).first(),
      db.prepare('SELECT a.*,CASE WHEN p.award_id = a.id THEN 1 ELSE 0 END AS equipped FROM school_season_awards a LEFT JOIN school_season_profiles p ON p.account_id = a.account_id WHERE a.account_id = ? ORDER BY a.season DESC LIMIT 100').bind(id).all(),
      db.prepare(`SELECT m.id,m.season,m.challenger,m.target,m.delta,m.created_at,json_extract(m.payload,'$.winner') AS winner,
        CASE WHEN m.challenger = ? THEN json_extract(m.payload,'$.teams[1].name') ELSE json_extract(m.payload,'$.teams[0].name') END AS opponent
        FROM school_season_matches m WHERE m.challenger = ? OR m.target = ? ORDER BY m.created_at DESC,m.id DESC LIMIT 30`).bind(id, id, id).all(),
      db.prepare(`WITH ranked AS (SELECT e.*,n.display_name AS name,RANK() OVER(ORDER BY MAX(0,1000+e.points) DESC) AS rank,
        ROW_NUMBER() OVER(ORDER BY MAX(0,1000+e.points) DESC,e.registered_at ASC,e.account_id ASC) AS position
        FROM school_season_entries e JOIN school_names n ON n.account_id = e.account_id WHERE e.season = ?)
        SELECT r.*,a.id AS award_id,a.season AS award_season,a.tier AS award_tier FROM ranked r
        LEFT JOIN school_season_profiles p ON p.account_id = r.account_id
        LEFT JOIN school_season_awards a ON a.id = p.award_id AND a.account_id = r.account_id
        WHERE r.position <= 50 OR r.account_id = ? ORDER BY r.position`).bind(season.id, id).all(),
      equippedSeasonCosmetic(db, id),
    ]);
    const currentPower = game.power(ownSave), usedToday = usage?.n || 0;
    return {
      season, rules: SEASON_RULES,
      me: { registered: !!entry, canRegister: !!own, requiresName: !own, name: own?.display_name || ownSave.commanderName, rating: rating(entry), tier: seasonTier(rating(entry)), attacks: entry?.attacks || 0,
        usedToday, remainingToday: Math.max(0, SEASON_RULES.dailyAttacks - usedToday), attackPower: currentPower, cosmetic,
        defense: entry ? { ...JSON.parse(entry.defense), power: entry.power, updatedAt: entry.updated_at } : null },
      candidates: entry ? await candidates(db, id, season, now, currentPower) : [],
      rankings: (rankRows.results || []).map(row => ({ rank: row.rank, name: row.name, rating: rating(row), tier: seasonTier(rating(row)), attacks: row.attacks, isMe: row.account_id === id,
        cosmetic: seasonCosmetic({ id: row.award_id, season: row.award_season, tier: row.award_tier }) })),
      matches: (matchRows.results || []).map(row => { const isAttack = row.challenger === id, side = isAttack ? 0 : 1; return { id: row.id, seasonId: row.season, opponent: row.opponent, result: row.winner === -1 ? 'draw' : row.winner === side ? 'win' : 'loss', ratingChange: isAttack ? row.delta : 0, createdAt: row.created_at, isAttack }; }),
      awards: (awardRows.results || []).map(row => ({ id: row.id, season: row.season, tier: row.tier, rating: row.rating, ...seasonCosmetic(row), equipped: !!row.equipped })),
      serverTime: now, dayResetsAt: (day(now) + 1) * DAY - KST,
    };
  }
  return { async request(request, env, data, accounts) {
    const now = Date.now(), signed = await accounts.identity(request, env, now);
    fail(signed, '시즌 아레나는 Google 계정으로 로그인해 주세요.', 401);
    fail(data.catalogVersion === game.CATALOG_VERSION, '게임이 업데이트되었습니다. 새로고침해 주세요.', 426);
    const db = env.DB, id = signed.id, kind = data.kind, season = currentSeason(now);
    fail(['season_state', 'season_candidates', 'season_register', 'season_attack', 'season_match', 'season_equip'].includes(kind), '지원하지 않는 시즌 행동입니다.');
    if (kind === 'season_state' || kind === 'season_candidates') return state(db, id, now);
    if (kind === 'season_match') {
      const row = await db.prepare('SELECT * FROM school_season_matches WHERE id = ? AND (challenger = ? OR target = ?)').bind(data.id || '', id, id).first();
      fail(row, '이 시즌 대전 기록을 볼 수 없습니다.', 404); return { match: matchView(row, id), serverTime: now };
    }
    if (kind === 'season_attack') {
      fail(typeof data.requestId === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(data.requestId), '대전 요청 번호를 확인해 주세요.');
      const repeated = await receipt(db, id, id + ':' + data.requestId, now);
      if (repeated) return repeated;
    }
    if (kind === 'season_equip') {
      await settle(db, id, season, now);
      fail(data.awardId === null || typeof data.awardId === 'string', '꾸미기 보상을 확인해 주세요.');
      if (data.awardId !== null) {
        const ownAward = await db.prepare('SELECT id FROM school_season_awards WHERE id = ? AND account_id = ?').bind(data.awardId, id).first();
        fail(ownAward, '보유한 시즌 보상만 착용할 수 있어요.', 403);
      }
      await db.prepare(`INSERT INTO school_season_profiles(account_id,award_id,updated_at) SELECT id,?,? FROM accounts WHERE id = ?
        ON CONFLICT(account_id) DO UPDATE SET award_id=excluded.award_id,updated_at=excluded.updated_at`).bind(data.awardId, now, id).run();
      return state(db, id, now);
    }
    fail(season.phase === 'active', '시즌이 아직 시작되지 않았어요.', 409);
    fail(data.seasonId === season.id, '시즌이 변경되었어요. 새 시즌을 확인해 주세요.', 409);
    const ownSave = await save(db, id), own = await db.prepare('SELECT display_name FROM school_names WHERE account_id = ?').bind(id).first();
    fail(own, '먼저 중복되지 않는 단장 이름을 정해 주세요.', 409);
    if (kind === 'season_register') {
      const defense = snapshot(ownSave), power = game.power(defense);
      await db.prepare(`INSERT INTO school_season_entries(season,account_id,defense,power,registered_at,updated_at)
        SELECT ?,id,?,?,?,? FROM accounts WHERE id = ?
        ON CONFLICT(season,account_id) DO UPDATE SET defense=excluded.defense,power=excluded.power,updated_at=excluded.updated_at`)
        .bind(season.id, JSON.stringify(defense), power, now, now, id).run();
      return state(db, id, now);
    }
    fail(typeof data.targetId === 'string' && data.targetId !== id, '대전할 상대를 선택해 주세요.');
    const ownEntry = await db.prepare('SELECT account_id FROM school_season_entries WHERE season = ? AND account_id = ?').bind(season.id, id).first();
    fail(ownEntry, '먼저 이번 시즌 방어 편성을 등록해 주세요.', 409);
    const usage = await db.prepare('SELECT attacks FROM school_season_days WHERE season = ? AND day = ? AND account_id = ?').bind(season.id, day(now), id).first();
    if ((usage?.attacks || 0) >= SEASON_RULES.dailyAttacks) {
      const repeated = await receipt(db, id, id + ':' + data.requestId, now); if (repeated) return repeated;
      fail(false, '오늘 도전 5회를 모두 사용했어요. 내일 다시 도전해 주세요.', 409);
    }
    const pool = await candidates(db, id, season, now, game.power(ownSave));
    if (!pool.some(row => row.id === data.targetId)) {
      const repeated = await receipt(db, id, id + ':' + data.requestId, now); if (repeated) return repeated;
      fail(false, '상대 목록이 변경되었어요. 새 목록에서 선택해 주세요.', 409);
    }
    const target = await db.prepare(`SELECT e.*,n.display_name AS name FROM school_season_entries e JOIN school_names n ON n.account_id = e.account_id WHERE e.season = ? AND e.account_id = ?`).bind(season.id, data.targetId).first();
    const power = game.power(ownSave);
    fail(target && target.power >= Math.ceil(power * .65) && target.power <= Math.floor(power * 1.35), '상대의 방어 편성이 변경되었어요. 다시 선택해 주세요.', 409);
    const match = simulateArena(game, [snapshot(ownSave), JSON.parse(target.defense)], [own.display_name, target.name], crypto.getRandomValues(new Uint32Array(1))[0]);
    const delta = match.winner === -1 ? 0 : match.winner === 0 ? SEASON_RULES.win : SEASON_RULES.loss;
    const matchId = uid(), key = id + ':' + data.requestId;
    const commitNow = Date.now();
    fail(currentSeason(commitNow).id === season.id && day(commitNow) === day(now), '날짜 또는 시즌이 변경되었어요. 목록을 새로고침해 주세요.', 409);
    // One D1 batch transaction admits the attack and updates the challenger.
    // The unique request/opponent keys and conditional INSERT enforce both
    // limits under racing tabs; a duplicate generated ID cannot add points.
    const results = await db.batch([
      db.prepare('INSERT OR IGNORE INTO school_season_days(season,day,account_id) SELECT ?,?,id FROM accounts WHERE id = ?').bind(season.id, day(now), id),
      db.prepare(`INSERT OR IGNORE INTO school_season_matches(id,season,day,challenger,target,request_key,delta,payload,created_at)
        SELECT ?,?,?,?,?,?,?,?,? WHERE
        (SELECT attacks FROM school_season_days WHERE season = ? AND day = ? AND account_id = ?) < ?
        AND NOT EXISTS(SELECT 1 FROM school_season_receipts WHERE request_key = ?)
        AND EXISTS(SELECT 1 FROM school_season_entries WHERE season = ? AND account_id = ? AND finalized = 0)
        AND EXISTS(SELECT 1 FROM school_season_entries WHERE season = ? AND account_id = ? AND updated_at = ? AND defense = ?)
        AND EXISTS(SELECT 1 FROM accounts WHERE id = ?)`)
        .bind(matchId, season.id, day(now), id, data.targetId, key, delta, JSON.stringify(match), now,
          season.id, day(now), id, SEASON_RULES.dailyAttacks, key, season.id, id, season.id, data.targetId, target.updated_at, target.defense, id),
      db.prepare(`UPDATE school_season_entries SET points = points + ?,attacks = attacks + 1
        WHERE season = ? AND account_id = ? AND EXISTS(SELECT 1 FROM school_season_matches WHERE id = ?)`)
        .bind(delta, season.id, id, matchId),
      db.prepare(`UPDATE school_season_days SET attacks = attacks + 1 WHERE season = ? AND day = ? AND account_id = ?
        AND EXISTS(SELECT 1 FROM school_season_matches WHERE id = ?)`)
        .bind(season.id, day(now), id, matchId),
      db.prepare('INSERT OR IGNORE INTO school_season_receipts(request_key,account_id,match_id,created_at) SELECT request_key,challenger,id,created_at FROM school_season_matches WHERE id = ?').bind(matchId),
    ]);
    const committed = await db.prepare('SELECT * FROM school_season_matches WHERE request_key = ?').bind(key).first();
    if (!committed) {
      const repeated = await receipt(db, id, key, now); if (repeated) return repeated;
      fail(false, '오늘 도전 횟수를 모두 사용했거나 상대 정보가 변경되었어요. 목록을 새로고침해 주세요.', 409);
    }
    return { ...await state(db, id, now), match: matchView(committed, id), repeated: !results[1].meta.changes };
  } };
}
