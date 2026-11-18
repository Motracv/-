const assert = require('node:assert/strict');
const { fixture } = require('./account-fixture.cjs');
const G = require('../school/engine.js');

(async () => {
  const { currentSeason, SEASON_RULES, seasonTier } = await import('../online/seasons.mjs');
  const t = await fixture(), realNow = Date.now;
  let now = Date.parse('2026-11-18T12:00:00+09:00'), passed = 0;
  Date.now = () => now;
  const call = (who, path, data = {}) => t.call('/api/school/' + path, { catalogVersion: G.CATALOG_VERSION, ...data }, null, who ? { 'X-Account-Session': who.token } : {});
  const api = (who, kind, data = {}) => call(who, 'social', { kind, ...data });
  const state = async who => { const result = await api(who, 'season_state'); assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data; };
  const row = who => t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id = ?').get(who.profile.id);
  const patch = (who, change) => { const s = JSON.parse(row(who).payload); change(s); t.sqlite.prepare('UPDATE school_saves SET payload = ? WHERE account_id = ?').run(JSON.stringify(s), who.profile.id); };
  const test = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };
  const team = ['taeo', 'geonu', 'doyoon', 'horas', 'osia', 'lava'];
  const users = [];
  async function create(index, level = 35) {
    const who = (await t.login('season-person-' + index)).data;
    const read = await call(who, 'state'); assert.equal(read.status, 200);
    patch(who, s => { s.team = team; for (const id of team) s.units[id] = { level, stars: 2, xp: 0, shards: 0 }; });
    users.push(who); return who;
  }
  async function name(who, index) {
    const current = await call(who, 'state');
    const result = await call(who, 'action', { revision: current.data.revision, requestId: `season-name-${index}-request`, action: { kind: 'rename', name: `시즌단장${index}` } });
    assert.equal(result.status, 200, JSON.stringify(result.data));
  }
  const register = (who, extra = {}) => api(who, 'season_register', { seasonId: currentSeason(now).id, ...extra });
  const attack = (who, target, requestId, extra = {}) => api(who, 'season_attack', { seasonId: currentSeason(now).id, targetId: target.profile.id, requestId, ...extra });
  try {
    const a = await create(0), b = await create(1), c = await create(2), far = await create(3, 100);
    await test('Season calendar is four weeks in KST, tiers are bounded, and unnamed/anonymous entry is rejected', async () => {
      const first = currentSeason(now); assert.equal(first.id, 1); assert.equal(first.startsAt, Date.parse('2026-11-18T00:00:00+09:00')); assert.equal(first.endsAt, Date.parse('2026-12-16T00:00:00+09:00'));
      assert.equal(currentSeason(first.endsAt - 1).id, 1); assert.equal(currentSeason(first.endsAt).id, 2);
      assert.deepEqual([1099, 1100, 1249, 1250, 1449, 1450].map(seasonTier), ['bronze', 'silver', 'silver', 'gold', 'gold', 'diamond']);
      assert.equal((await api(null, 'season_state')).status, 401);
      assert.equal((await register(a)).status, 409);
      assert.equal((await state(a)).me.requiresName, true);
      assert.equal((await api(a, 'season_state', { catalogVersion: G.CATALOG_VERSION - 1 })).status, 426);
      for (const [index, who] of users.entries()) await name(who, index);
    });
    await test('Opt-in defense uses only current owned units; empty and power-filtered pools remain honest', async () => {
      const before = row(a).payload;
      let result = await register(a, { team: ['horas'], units: { horas: { level: 9999 } }, power: 1, rating: 9999 }); assert.equal(result.status, 200);
      assert.deepEqual(result.data.me.defense.team, team); assert.equal(result.data.me.defense.units.horas.level, 35); assert.equal(result.data.me.rating, 1000);
      assert.equal(result.data.candidates.length, 0); assert.equal(row(a).payload, before);
      assert.equal((await register(b)).status, 200); assert.equal((await register(c)).status, 200); assert.equal((await register(far)).status, 200);
      const view = await state(a); assert.equal(view.candidates.length, 2); assert.ok(view.candidates.every(peer => peer.id !== far.profile.id));
      assert.equal((await attack(a, far, 'season-invalid-power-001')).status, 409);
      assert.equal((await register(a, { seasonId: 9999 })).status, 409);
    });
    let firstId, firstKey = 'season-concurrent-first01';
    await test('Concurrent duplicate attacks produce one persisted authoritative replay and one challenger-only score', async () => {
      const saves = [row(a).payload, row(b).payload];
      const results = await Promise.all([attack(a, b, firstKey, { winner: 0, damage: 1e99, rating: 9999 }), attack(a, b, firstKey)]);
      results.forEach(result => assert.equal(result.status, 200, JSON.stringify(result.data)));
      const left = results[0].data.match, right = results[1].data.match; firstId = left.id;
      assert.deepEqual(left, right); assert.equal(left.mode, 'season'); assert.equal(left.meSide, 0);
      const count = t.sqlite.prepare('SELECT COUNT(*) AS n FROM school_season_matches').get().n; assert.equal(count, 1);
      const after = await state(a), opponent = await state(b);
      assert.equal(after.me.usedToday, 1); assert.equal(after.me.attacks, 1); assert.equal(after.me.rating, 1000 + left.ratingChange);
      assert.equal(opponent.me.rating, 1000); assert.equal(opponent.me.attacks, 0); assert.equal(opponent.me.usedToday, 0);
      assert.deepEqual([row(a).payload, row(b).payload], saves);
      const reverse = await api(b, 'season_match', { id: firstId }); assert.equal(reverse.status, 200); assert.equal(reverse.data.match.meSide, 1); assert.equal(reverse.data.match.ratingChange, 0);
      assert.deepEqual(left.events, reverse.data.match.events); assert.ok(left.events.some(event => event.kind === 'horas-cast'));
      assert.equal((await api(c, 'season_match', { id: firstId })).status, 404);
      assert.equal((await attack(a, b, 'season-repeat-opponent1')).status, 409);
    });
    await test('A committed response lost after SQL batch resumes with the original replay without another attack', async () => {
      const batch = t.db.batch; let lost = true;
      t.db.batch = async statements => { const result = await batch(statements); if (lost) { lost = false; throw Error('response lost after commit'); } return result; };
      try { assert.equal((await attack(a, c, 'season-lost-response001')).status, 503); } finally { t.db.batch = batch; }
      const recovered = await attack(a, c, 'season-lost-response001'); assert.equal(recovered.status, 200); assert.equal(recovered.data.repeated, true);
      assert.equal(recovered.data.me.usedToday, 2); assert.equal(recovered.data.me.attacks, 2);
      assert.equal((await attack(a, c, 'season-lost-response001')).data.match.id, recovered.data.match.id);
    });
    await test('KST midnight resets daily attempts, defense updates preserve rating, and five season attacks accumulate', async () => {
      const old = await state(a); now = old.dayResetsAt;
      let view = await state(a); assert.equal(view.me.usedToday, 0); assert.equal(view.me.attacks, 2);
      const beforeRating = view.me.rating;
      patch(a, s => { s.team = [...team].reverse(); });
      const updated = await register(a); assert.equal(updated.status, 200); assert.deepEqual(updated.data.me.defense.team, [...team].reverse()); assert.equal(updated.data.me.rating, beforeRating); assert.equal(updated.data.me.attacks, 2);
      assert.equal((await attack(a, b, 'season-day-two-attack01')).status, 200);
      assert.equal((await attack(a, c, 'season-day-two-attack02')).status, 200);
      view = await state(a); now = view.dayResetsAt;
      const fifth = await attack(a, b, 'season-day-three-attack1'); assert.equal(fifth.status, 200); assert.equal(fifth.data.me.attacks, 5);
      const delta = t.sqlite.prepare('SELECT SUM(delta) AS n FROM school_season_matches WHERE challenger = ?').get(a.profile.id).n;
      assert.equal(fifth.data.me.rating, Math.max(0, 1000 + delta));
      assert.equal(fifth.data.matches.filter(match => match.isAttack).length, 5);
    });
    await test('Rollover awards one cosmetic after five attacks, resets entry, preserves retries and never grants currency', async () => {
      t.sqlite.prepare('UPDATE school_season_entries SET points = 300 WHERE season = 1 AND account_id = ?').run(a.profile.id);
      const before = row(a).payload; now = currentSeason(now).endsAt;
      const [one, two] = await Promise.all([state(a), state(a)]);
      assert.equal(one.season.id, 2); assert.equal(one.me.registered, false); assert.equal(one.me.rating, 1000); assert.equal(one.me.usedToday, 0);
      assert.equal(one.awards.length, 1); assert.equal(one.awards[0].tier, 'gold'); assert.equal(one.awards[0].frame, 'season-gold'); assert.deepEqual(one.awards, two.awards);
      assert.equal((await state(b)).awards.length, 0); assert.equal(row(a).payload, before);
      const retry = await attack(a, b, firstKey, { seasonId: 1 }); assert.equal(retry.status, 200); assert.equal(retry.data.repeated, true); assert.equal(retry.data.match.id, firstId); assert.equal(retry.data.season.id, 2);
      assert.equal((await attack(a, b, 'season-old-new-request01', { seasonId: 1 })).status, 409);
      assert.equal((await register(a, { seasonId: 1 })).status, 409);
      assert.equal((await api(b, 'season_equip', { awardId: one.awards[0].id })).status, 403);
      const equipped = await api(a, 'season_equip', { awardId: one.awards[0].id }); assert.equal(equipped.status, 200); assert.equal(equipped.data.me.cosmetic.frame, 'season-gold');
      const ordinaryProfile = await api(a, 'state'); assert.equal(ordinaryProfile.data.me.cosmetic.frame, 'season-gold');
      const again = await register(a); assert.equal(again.data.me.rating, 1000); assert.equal(again.data.me.attacks, 0); assert.equal(again.data.rankings.find(entry => entry.isMe).cosmetic.frame, 'season-gold');
      const removed = await api(a, 'season_equip', { awardId: null }); assert.equal(removed.status, 200); assert.equal(removed.data.me.cosmetic, null);
    });
    await test('Opponent deletion removes replays but preserves charged attempts, points and retry tombstones', async () => {
      const cReplay = t.sqlite.prepare('SELECT * FROM school_season_matches WHERE target = ? AND challenger = ? LIMIT 1').get(c.profile.id, a.profile.id);
      const points = t.sqlite.prepare('SELECT points,attacks FROM school_season_entries WHERE season = 1 AND account_id = ?').get(a.profile.id);
      const daily = t.sqlite.prepare('SELECT SUM(attacks) AS n FROM school_season_days WHERE account_id = ?').get(a.profile.id).n;
      t.sqlite.prepare('DELETE FROM accounts WHERE id = ?').run(c.profile.id);
      assert.equal(t.sqlite.prepare('SELECT id FROM school_season_matches WHERE id = ?').get(cReplay.id), undefined);
      assert.deepEqual(t.sqlite.prepare('SELECT points,attacks FROM school_season_entries WHERE season = 1 AND account_id = ?').get(a.profile.id), points);
      assert.equal(t.sqlite.prepare('SELECT SUM(attacks) AS n FROM school_season_days WHERE account_id = ?').get(a.profile.id).n, daily);
      const replay = await api(a, 'season_attack', { seasonId: 1, targetId: c.profile.id, requestId: cReplay.request_key.slice(a.profile.id.length + 1) });
      assert.equal(replay.status, 200); assert.equal(replay.data.matchUnavailable, true); assert.equal(replay.data.match, null); assert.equal(replay.data.repeated, true);
      t.sqlite.prepare('DELETE FROM accounts WHERE id = ?').run(a.profile.id);
      for (const table of ['school_season_entries', 'school_season_days', 'school_season_receipts', 'school_season_awards', 'school_season_profiles']) assert.equal(t.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE account_id = ?`).get(a.profile.id).n, 0);
    });
    console.log(`${passed} authoritative season checks passed`);
  } finally { Date.now = realNow; t.sqlite.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
