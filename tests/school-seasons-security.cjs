const assert = require('node:assert/strict');
const { fixture } = require('./account-fixture.cjs');
const G = require('../school/engine.js');

(async () => {
  const t = await fixture(), realNow = Date.now, realRandom = crypto.getRandomValues;
  let now = Date.parse('2026-11-18T12:00:00+09:00'), passed = 0, sequence = 0;
  Date.now = () => now;
  const call = (who, route, data = {}) => t.call('/api/school/' + route, { catalogVersion: G.CATALOG_VERSION, ...data }, null, who ? { 'X-Account-Session': who.token } : {});
  const social = (who, kind, data = {}) => call(who, 'social', { kind, ...data });
  const row = who => t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id);
  const saved = who => JSON.parse(row(who).payload);
  const patch = (who, change) => { const state = saved(who); change(state); assert.ok(G.validate(state), 'trusted fixture save must validate'); t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(state), who.profile.id); };
  const key = () => 'security-request-' + String(++sequence).padStart(7, '0');
  const intent = (who, action, requestId = key()) => ({ revision: row(who).revision, requestId, action });
  const act = (who, action) => call(who, 'action', intent(who, action));
  const account = async (name, level = 1) => { const login = await t.login('season-security-' + name); assert.equal(login.status, 200); const who = login.data; assert.equal((await call(who, 'state')).status, 200); if (level !== 1) patch(who, state => { for (const unit of Object.values(state.units)) unit.level = level; }); return who; };
  const test = async (name, run) => { now += 61000; await run(); passed++; console.log('PASS', name); };
  const wallet = state => ({ gold: state.gold, gems: state.gems, units: state.units, captain: state.captain, quests: state.quests, winter: state.winter });
  const { currentSeason, SEASON_RULES } = await import('../online/seasons.mjs');
  const { simulateArena } = await import('../online/arena.mjs');
  const isolate = () => t.sqlite.exec('DELETE FROM school_season_entries');
  const entry = who => t.sqlite.prepare('SELECT * FROM school_season_entries WHERE season=? AND account_id=?').get(currentSeason(now).id, who.profile.id);
  const register = async who => { const r = await social(who, 'season_register', { seasonId: currentSeason(now).id }); assert.equal(r.status, 200, JSON.stringify(r.data)); return r; };
  const contender = async (name, level = 1) => { const who = await account(name, level); assert.equal((await act(who, { kind: 'rename', name: '단장' + (++sequence) })).status, 200); await register(who); return who; };
  const attack = (who, targetId, extra = {}) => social(who, 'season_attack', { seasonId: currentSeason(now).id, targetId, requestId: key(), ...extra });
  const list = async who => { const r = await social(who, 'season_state'); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; };
  const publicOnly = (data, accounts = []) => { const serialized = JSON.stringify(data); for (const forbidden of ['never-store@example.test', 'Never Publish Real Name', 'google_key', 'account_sessions', 'shards', 'presets', ...accounts.map(who => who.token)]) assert.ok(!serialized.includes(forbidden), 'public reply must not leak ' + forbidden); };
  try {
    await test('Catalog16 rejects old15 state and preset mutations without changing saved progress', async () => {
      assert.equal(G.CATALOG_VERSION, 22);
      const who = await account('catalog'), before = row(who);
      const read = await call(who, 'state', { catalogVersion: 15 }); assert.equal(read.status, 426); assert.ok(!read.data.state);
      const write = await call(who, 'action', { ...intent(who, { kind: 'preset-save', slot: 0 }), catalogVersion: 15 }); assert.equal(write.status, 426); assert.equal(row(who).payload, before.payload); assert.equal(row(who).revision, before.revision);
    });

    await test('Legacy accounts get three empty preset slots without overwriting their active team or currency', async () => {
      const who = await account('preset-legacy'); patch(who, state => { delete state.presets; state.gold = 5860; state.gems = 290; });
      const before = saved(who), r = await call(who, 'state'); assert.equal(r.status, 200);
      assert.deepEqual(r.data.state.presets, [{ name: '모험', team: [] }, { name: '보스', team: [] }, { name: '아레나', team: [] }]); assert.deepEqual(r.data.state.team, before.team); assert.deepEqual(wallet(r.data.state), wallet(before));
    });

    await test('Preset save copies only the authenticated current team and ignores forged foreign or invalid team payloads', async () => {
      const who = await account('preset-own'), other = await account('preset-other');
      patch(other, state => { state.units.horas = { level: 80, xp: 0, stars: 5, shards: 12345 }; });
      const otherBefore = row(other).payload, own = saved(who).team;
      for (const team of [['horas'], ['harin', 'harin'], Array(7).fill('taeo')]) {
        const r = await call(who, 'action', { ...intent(who, { kind: 'preset-save', slot: 0, team, presets: [{ name: 'forged', team }], units: saved(other).units }), accountId: other.profile.id, state: saved(other) });
        assert.equal(r.status, 200); assert.deepEqual(r.data.state.presets[0].team, own); assert.deepEqual(r.data.state.team, own); assert.ok(!r.data.state.units.horas);
        const before = row(who).payload; assert.equal((await act(who, { kind: 'team', team })).status, 400); assert.equal(row(who).payload, before);
      }
      assert.equal(row(other).payload, otherBefore);
      const read = await call(other, 'state', { accountId: who.profile.id }); assert.deepEqual(read.data.state.presets[0].team, []);
      for (const slot of [-1, 3, 1.5, '__proto__', null]) { const before = row(who).payload; assert.equal((await act(who, { kind: 'preset-save', slot })).status, 400); assert.equal(row(who).payload, before); }
    });

    await test('Preset application is atomic, costs no currency and replays once under concurrent requests and reconnect', async () => {
      const who = await account('preset-atomic');
      assert.equal((await act(who, { kind: 'preset-save', slot: 0 })).status, 200);
      assert.equal((await act(who, { kind: 'team', team: ['harin', 'taeo', 'sua'] })).status, 200);
      assert.equal((await act(who, { kind: 'preset-save', slot: 1 })).status, 200);
      const before = saved(who), input = intent(who, { kind: 'preset-apply', slot: 0, team: ['horas'], gems: 1e12, gold: 1e12 });
      const replies = await Promise.all([call(who, 'action', input), call(who, 'action', input)]);
      for (const r of replies) { assert.equal(r.status, 200); assert.deepEqual(r.data.state.team, ['taeo', 'harin', 'sua']); assert.deepEqual(wallet(r.data.state), wallet(before)); }
      assert.deepEqual(replies[0].data.result, replies[1].data.result); assert.equal(saved(who).events.filter(e => e.kind === 'wave').length, before.events.filter(e => e.kind === 'wave').length + 1);
      const again = (await t.login('season-security-preset-atomic')).data, retry = await call(again, 'action', input); assert.equal(retry.status, 200); assert.equal(retry.data.repeated, true); assert.deepEqual(retry.data.state.presets, before.presets);
      const read = await call(again, 'state'); assert.deepEqual(read.data.state.team, ['taeo', 'harin', 'sua']); assert.deepEqual(read.data.state.presets, before.presets);
      const payload = row(who).payload; assert.equal((await act(who, { kind: 'preset-apply', slot: 0 })).status, 400); assert.equal(row(who).payload, payload);
    });

    await test('Owned one-unit and six-unit presets retain exact order and use current growth on activation', async () => {
      const who = await account('preset-boundaries'); patch(who, state => { for (const id of ['yuna', 'minjae', 'nari']) state.units[id] = { level: 1, xp: 0, stars: 0, shards: 0 }; });
      const six = ['nari', 'minjae', 'yuna', 'harin', 'taeo', 'sua'];
      assert.equal((await act(who, { kind: 'team', team: six })).status, 200); assert.equal((await act(who, { kind: 'preset-save', slot: 2 })).status, 200);
      assert.equal((await act(who, { kind: 'team', team: ['harin'] })).status, 200); assert.equal((await act(who, { kind: 'preset-save', slot: 1 })).status, 200);
      assert.equal((await act(who, { kind: 'train', hero: 'nari' })).status, 200); const before = saved(who);
      const r = await act(who, { kind: 'preset-apply', slot: 2 }); assert.equal(r.status, 200); assert.deepEqual(r.data.state.team, six); assert.equal(r.data.state.battle.heroes.length, 6); assert.equal(r.data.state.battle.heroes.find(h => h.id === 'nari').atk, G.stats('nari', before.units.nari).atk); assert.equal(r.data.state.gold, before.gold); assert.equal(r.data.state.gems, before.gems);
      const one = await act(who, { kind: 'preset-apply', slot: 1 }); assert.equal(one.status, 200); assert.deepEqual(one.data.state.team, ['harin']); assert.equal(one.data.state.battle.heroes.length, 1);
    });

    await test('Active dungeon denies preset apply without losing its key, run or save; rename/delete obey slot bounds', async () => {
      const who = await account('preset-dungeon');
      assert.equal((await act(who, { kind: 'preset-save', slot: 0 })).status, 200);
      assert.equal((await act(who, { kind: 'team', team: ['harin', 'taeo', 'sua'] })).status, 200);
      assert.equal((await act(who, { kind: 'activity', mode: 'daily', tier: 1 })).status, 200);
      const before = row(who).payload; assert.equal((await act(who, { kind: 'preset-apply', slot: 0 })).status, 400); assert.equal(row(who).payload, before);
      assert.equal((await act(who, { kind: 'preset-rename', slot: 0, name: '내 모험 조합' })).status, 200); assert.equal(saved(who).presets[0].name, '내 모험 조합');
      for (const name of ['', '<script>', '이름이너무길어서허용범위를초과함']) { const payload = row(who).payload; assert.equal((await act(who, { kind: 'preset-rename', slot: 0, name })).status, 400); assert.equal(row(who).payload, payload); }
      assert.equal((await act(who, { kind: 'preset-delete', slot: 0 })).status, 200); assert.deepEqual(saved(who).presets[0], { name: '내 모험 조합', team: [] }); assert.ok(!saved(who).activities.run.settled);
      const payload = row(who).payload; assert.equal((await act(who, { kind: 'preset-apply', slot: 0 })).status, 400); assert.equal(row(who).payload, payload);
    });

    await test('Every season endpoint authenticates, rejects old catalogs and reports an honest empty pool', async () => {
      isolate();
      const who = await account('season-auth');
      for (const kind of ['season_state', 'season_candidates', 'season_register', 'season_attack', 'season_match', 'season_equip']) {
        assert.equal((await social(null, kind, { accountId: who.profile.id, seasonId: 1, targetId: who.profile.id, requestId: key(), awardId: null })).status, 401);
        assert.equal((await social(who, kind, { catalogVersion: 15 })).status, 426);
      }
      const empty = await list(who); assert.deepEqual(empty.candidates, []); assert.deepEqual(empty.rankings, []); assert.equal(empty.me.registered, false); assert.equal(empty.me.requiresName, true);
      assert.equal((await social(who, 'season_register', { seasonId: 1, name: 'clientName', team: ['horas'] })).status, 409);
      assert.equal((await act(who, { kind: 'rename', name: '빈 아레나' })).status, 200);
      await register(who); assert.deepEqual((await list(who)).candidates, []); assert.equal((await attack(who, who.profile.id)).status, 400);
      assert.equal((await attack(who, 'nonexistent-account')).status, 409); assert.equal(entry(who).attacks, 0);
      assert.equal((await social(who, 'season_state', { accountId: 'someone-else', now: SEASON_RULES.anchor + SEASON_RULES.duration })).data.season.id, 1);
    });

    await test('Defense snapshots contain only owned selected units and update from trusted current growth', async () => {
      isolate(); const who = await contender('season-snapshot'), viewer = await contender('season-viewer');
      patch(who, state => { state.units.horas = { level: 80, xp: 4321, stars: 5, shards: 987654 }; state.gems = 987654321; });
      const before = row(who).payload;
      const r = await social(who, 'season_register', { seasonId: 1, accountId: viewer.profile.id, power: 999999999, defense: { team: ['horas'], units: { horas: { level: 9999, stars: 99 } } }, team: ['horas', 'horas', 'alien'], units: { alien: { level: 9999 } } });
      assert.equal(r.status, 200); assert.equal(row(who).payload, before); assert.equal(entry(who).power, G.power(saved(who)));
      const defense = JSON.parse(entry(who).defense); assert.deepEqual(defense.team, ['taeo', 'harin', 'sua']); assert.deepEqual(Object.keys(defense.units).sort(), [...defense.team].sort()); assert.deepEqual(Object.keys(defense.units.taeo).sort(), ['level', 'stars']); assert.ok(!defense.units.horas);
      const publicState = await list(viewer), candidate = publicState.candidates.find(c => c.id === who.profile.id); assert.ok(candidate); assert.deepEqual(candidate.team, defense.team); assert.ok(!candidate.defense && !candidate.units); publicOnly(publicState, [who, viewer]); assert.ok(!JSON.stringify(publicState).includes('987654'));
      const unchanged = entry(who).defense; assert.equal((await act(who, { kind: 'train', hero: 'taeo' })).status, 200); assert.equal(entry(who).defense, unchanged, 'registered defense remains a snapshot until refreshed'); await register(who); assert.equal(JSON.parse(entry(who).defense).units.taeo.level, saved(who).units.taeo.level);
      patch(who, state => { for (const id of ['yuna', 'minjae', 'nari']) state.units[id] = { level: 1, xp: 0, stars: 0, shards: 0 }; });
      const six = ['nari', 'minjae', 'yuna', 'harin', 'taeo', 'sua']; assert.equal((await act(who, { kind: 'team', team: six })).status, 200); await register(who); assert.deepEqual(JSON.parse(entry(who).defense).team, six);
      assert.equal((await act(who, { kind: 'team', team: ['harin'] })).status, 200); await register(who); assert.deepEqual(JSON.parse(entry(who).defense).team, ['harin']);
    });

    await test('The server enforces the ±35 percent opponent power window and ignores forged power', async () => {
      isolate(); const who = await contender('season-range'), peer = await contender('season-range-peer'), high = await contender('season-range-high', 100);
      const pool = (await list(who)).candidates; assert.ok(pool.some(c => c.id === peer.profile.id)); assert.ok(!pool.some(c => c.id === high.profile.id));
      assert.equal((await attack(who, high.profile.id, { power: entry(high).power, attackPower: entry(high).power, targetPower: entry(who).power })).status, 409); assert.equal(entry(who).attacks, 0);
      // Trusted database boundary setup isolates inclusive integer rounding from
      // hero stat steps; client API still provides no power override.
      const base = G.power(saved(who));
      for (const [power, eligible] of [[Math.ceil(base * .65), true], [Math.ceil(base * .65) - 1, false], [Math.floor(base * 1.35), true], [Math.floor(base * 1.35) + 1, false]]) {
        t.sqlite.prepare('UPDATE school_season_entries SET power=? WHERE account_id=?').run(power, peer.profile.id); assert.equal((await list(who)).candidates.some(c => c.id === peer.profile.id), eligible);
      }
      await register(peer); const before = row(who).payload, beforePeer = row(peer).payload;
      const match = await attack(who, peer.profile.id); assert.equal(match.status, 200); assert.equal(row(who).payload, before); assert.equal(row(peer).payload, beforePeer);
    });

    await test('Seed, combat, score and replay perspectives are authoritative and private to the two participants', async () => {
      isolate(); const who = await contender('season-seed'), peer = await contender('season-seed-peer'), stranger = await contender('season-seed-stranger');
      const seed = 0x4a19c721, own = JSON.parse(entry(who).defense), target = JSON.parse(entry(peer).defense), names = [(await list(who)).me.name, (await list(peer)).me.name];
      const expected = simulateArena(G, [own, target], names, seed), before = entry(peer), wallets = [row(who).payload, row(peer).payload];
      let r; crypto.getRandomValues = array => array instanceof Uint32Array && array.length === 1 ? (array[0] = seed, array) : realRandom.call(crypto, array);
      try { r = await attack(who, peer.profile.id, { seed: 123, winner: 0, delta: 5000, points: 999999, team: ['horas'], targetTeam: [], match: { winner: 0, seed: 123 }, state: { gold: 1e12 } }); } finally { crypto.getRandomValues = realRandom; }
      assert.equal(r.status, 200, JSON.stringify(r.data)); const match = r.data.match; assert.equal(match.seed, seed); assert.equal(match.winner, expected.winner); assert.deepEqual(match.events, expected.events); assert.deepEqual(match.damage, expected.damage); assert.equal(match.meSide, 0); assert.equal(match.ratingChange, expected.winner === -1 ? 0 : expected.winner === 0 ? 20 : -10);
      assert.equal(entry(who).points, match.ratingChange); assert.equal(entry(peer).points, before.points); assert.equal(entry(peer).attacks, before.attacks);
      const defenseView = await social(peer, 'season_match', { id: match.id, accountId: who.profile.id }); assert.equal(defenseView.status, 200); assert.equal(defenseView.data.match.meSide, 1); assert.equal(defenseView.data.match.ratingChange, 0); assert.deepEqual(defenseView.data.match.events, match.events); assert.deepEqual(defenseView.data.match.teams, match.teams);
      const attackView = await social(who, 'season_match', { id: match.id }); assert.equal(attackView.data.match.meSide, 0);
      assert.equal((await social(stranger, 'season_match', { id: match.id, accountId: who.profile.id, targetId: peer.profile.id })).status, 404); assert.equal((await social(peer, 'season_match', { id: match.id + "' OR 1=1--" })).status, 404);
      publicOnly(match, [who, peer, stranger]); publicOnly(defenseView.data, [who, peer]); assert.equal(row(who).payload, wallets[0]); assert.equal(row(peer).payload, wallets[1]);
      const attackHistory = (await list(who)).matches.find(m => m.id === match.id), defenseHistory = (await list(peer)).matches.find(m => m.id === match.id); assert.equal(attackHistory.isAttack, true); assert.equal(defenseHistory.isAttack, false); assert.equal(defenseHistory.ratingChange, 0);
    });

    await test('Concurrent different requests against one opponent admit only one battle per Korean day', async () => {
      isolate(); const who = await contender('season-opponent-race'), peer = await contender('season-opponent-race-peer');
      const replies = await Promise.all(Array.from({ length: 8 }, () => attack(who, peer.profile.id)));
      assert.equal(replies.filter(r => r.status === 200).length, 1); assert.ok(replies.every(r => [200, 409].includes(r.status))); assert.equal(entry(who).attacks, 1); assert.equal((await list(who)).me.usedToday, 1); assert.equal(t.sqlite.prepare('SELECT COUNT(*) AS n FROM school_season_matches WHERE challenger=?').get(who.profile.id).n, 1);
      assert.equal((await attack(who, peer.profile.id)).status, 409); assert.equal(entry(peer).attacks, 0); assert.equal((await list(peer)).me.usedToday, 0);
      const reverse = await attack(peer, who.profile.id); assert.equal(reverse.status, 200, 'each challenger has an independent daily opponent limit');
    });

    await test('Duplicate concurrent requests replay the same match and never increment points twice', async () => {
      isolate(); const who = await contender('season-request-race'), peer = await contender('season-request-race-peer'), requestId = key();
      const replies = await Promise.all(Array.from({ length: 8 }, () => attack(who, peer.profile.id, { requestId })));
      assert.ok(replies.every(r => r.status === 200), replies.map(r => r.status).join(',')); assert.equal(new Set(replies.map(r => r.data.match.id)).size, 1); assert.equal(replies.filter(r => !r.data.repeated).length, 1); assert.equal(entry(who).attacks, 1); assert.equal(entry(who).points, replies[0].data.match.ratingChange); assert.equal((await list(who)).me.usedToday, 1);
      const repeated = await attack(who, 'forged-other-target', { requestId, seasonId: -1, seed: 0 }); assert.equal(repeated.status, 200); assert.equal(repeated.data.repeated, true); assert.equal(repeated.data.match.id, replies[0].data.match.id);
      const other = await attack(peer, who.profile.id, { requestId }); assert.equal(other.status, 200); assert.notEqual(other.data.match.id, replies[0].data.match.id, 'request IDs are scoped to the authenticated account');
    });

    await test('Racing eligible opponents cannot exceed five daily attacks; refresh and defense registration do not refund them', async () => {
      isolate(); const who = await contender('season-quota'), peers = [];
      for (let i = 0; i < 7; i++) peers.push(await contender('season-quota-peer-' + i));
      for (let i = 0; i < 4; i++) { const target = (await list(who)).candidates[0]; assert.ok(target); assert.equal((await attack(who, target.id)).status, 200); }
      const targets = (await list(who)).candidates; assert.equal(targets.length, 3);
      const replies = await Promise.all(targets.map(target => attack(who, target.id))); assert.equal(replies.filter(r => r.status === 200).length, 1); assert.ok(replies.every(r => [200, 409].includes(r.status)));
      const state = await list(who); assert.equal(state.me.usedToday, 5); assert.equal(state.me.remainingToday, 0); assert.equal(entry(who).attacks, 5);
      const points = t.sqlite.prepare('SELECT SUM(delta) AS points FROM school_season_matches WHERE challenger=?').get(who.profile.id).points; assert.equal(entry(who).points, points);
      await register(who); assert.equal((await list(who)).me.usedToday, 5); assert.equal(entry(who).attacks, 5); assert.equal(entry(who).points, points); assert.equal((await attack(who, state.candidates[0].id)).status, 409);
      assert.equal((await list(peers[0])).me.usedToday, 0);
    });

    await test('A committed match with a lost response retries once across the exact Korean midnight boundary', async () => {
      isolate(); const who = await contender('season-midnight'), peer = await contender('season-midnight-peer');
      now = Date.parse('2026-11-19T00:00:00+09:00') - 1;
      const requestId = key(), originalBatch = t.db.batch; let committed = false;
      t.db.batch = async statements => { const result = await originalBatch.call(t.db, statements); committed = true; throw Error('Simulated lost successful database response'); };
      let first; try { first = await attack(who, peer.profile.id, { requestId }); } finally { t.db.batch = originalBatch; }
      assert.ok(committed); assert.ok(first.status >= 500); assert.equal(entry(who).attacks, 1); const firstPoints = entry(who).points;
      assert.equal((await list(who)).me.usedToday, 1); assert.equal((await list(who)).dayResetsAt, now + 1);
      now++; const retry = await attack(who, peer.profile.id, { requestId }); assert.equal(retry.status, 200); assert.equal(retry.data.repeated, true); assert.equal(retry.data.me.usedToday, 0); assert.equal(entry(who).attacks, 1); assert.equal(entry(who).points, firstPoints);
      const next = await attack(who, peer.profile.id); assert.equal(next.status, 200); assert.equal(next.data.me.usedToday, 1); assert.equal(entry(who).attacks, 2); assert.notEqual(next.data.match.id, retry.data.match.id);
      assert.equal((await attack(who, peer.profile.id)).status, 409); assert.equal((await list(who)).me.usedToday, 1);
    });

    await test('A failed transaction leaves no partial rating, battle, daily charge or receipt', async () => {
      isolate(); const who = await contender('season-rollback'), peer = await contender('season-rollback-peer'), requestId = key();
      t.failNextBatch(); const r = await attack(who, peer.profile.id, { requestId }); assert.ok(r.status >= 500); assert.equal(entry(who).attacks, 0); assert.equal(entry(who).points, 0); assert.equal((await list(who)).me.usedToday, 0);
      assert.equal(t.sqlite.prepare('SELECT COUNT(*) AS n FROM school_season_receipts WHERE account_id=?').get(who.profile.id).n, 0); assert.equal((await attack(who, peer.profile.id, { requestId })).status, 200); assert.equal(entry(who).attacks, 1);
    });

    await test('A defense refreshed between simulation and SQL admission cannot commit a stale match', async () => {
      isolate(); const who = await contender('season-defense-race'), peer = await contender('season-defense-race-peer');
      const originalBatch = t.db.batch; let refreshed = false;
      t.db.batch = async statements => {
        if (!refreshed && statements.length === 5) {
          refreshed = true;
          patch(peer, state => { state.units.taeo.level++; });
          assert.equal((await register(peer)).status, 200);
        }
        return originalBatch.call(t.db, statements);
      };
      let r; try { r = await attack(who, peer.profile.id); } finally { t.db.batch = originalBatch; }
      assert.ok(refreshed); assert.equal(r.status, 409); assert.equal(entry(who).attacks, 0); assert.equal(entry(who).points, 0); assert.equal((await list(who)).me.usedToday, 0);
      assert.equal(t.sqlite.prepare('SELECT COUNT(*) AS n FROM school_season_matches WHERE challenger=?').get(who.profile.id).n, 0);
      const next = await attack(who, peer.profile.id); assert.equal(next.status, 200); assert.equal(next.data.match.teams[1].units.find(unit => unit.id === 'taeo').level, 2);
    });

    await test('An attack that crosses Korean midnight during simulation is rejected before consuming an attempt', async () => {
      isolate(); const who = await contender('season-sim-midnight'), peer = await contender('season-sim-midnight-peer');
      const boundary = (await list(who)).dayResetsAt; now = boundary - 1;
      crypto.getRandomValues = array => { if (array instanceof Uint32Array && array.length === 1) now = boundary; return realRandom.call(crypto, array); };
      let r; try { r = await attack(who, peer.profile.id); } finally { crypto.getRandomValues = realRandom; }
      assert.equal(r.status, 409); assert.equal(entry(who).attacks, 0); assert.equal(entry(who).points, 0); assert.equal((await list(who)).me.usedToday, 0);
      assert.equal(t.sqlite.prepare('SELECT COUNT(*) AS n FROM school_season_days WHERE account_id=?').get(who.profile.id).n, 0);
      assert.equal((await attack(who, peer.profile.id)).status, 200); assert.equal(entry(who).attacks, 1);
    });

    await test('Season settlement racing an already simulated attack seals the final score before awarding it', async () => {
      isolate(); const who = await contender('season-finalize-race'), peer = await contender('season-finalize-race-peer');
      t.sqlite.prepare('UPDATE school_season_entries SET points=250,attacks=5 WHERE account_id=?').run(who.profile.id);
      const ending = currentSeason(now), before = row(who).payload; now = ending.endsAt - 1;
      const originalBatch = t.db.batch; let settled;
      t.db.batch = async statements => {
        if (!settled && statements.length === 5) { now = ending.endsAt; settled = true; settled = await list(who); }
        return originalBatch.call(t.db, statements);
      };
      let r; try { r = await attack(who, peer.profile.id); } finally { t.db.batch = originalBatch; }
      assert.ok(settled); assert.equal(r.status, 409); assert.equal(settled.awards.length, 1); assert.equal(settled.awards[0].tier, 'gold'); assert.equal(settled.awards[0].rating, 1250);
      const ended = t.sqlite.prepare('SELECT * FROM school_season_entries WHERE season=? AND account_id=?').get(ending.id, who.profile.id); assert.equal(ended.finalized, 1); assert.equal(ended.points, 250); assert.equal(ended.attacks, 5); assert.equal(row(who).payload, before);
      assert.equal(t.sqlite.prepare('SELECT COUNT(*) AS n FROM school_season_matches WHERE challenger=?').get(who.profile.id).n, 0); assert.equal((await list(who)).me.usedToday, 0);
      // Subsequent groups remain in this new season, with fresh server sessions
      // created by their own fixture setup.
    });

    await test('Opponent deletion preserves challenger points, consumed attempts and minimal replay receipts', async () => {
      isolate(); const who = await contender('season-delete'), peer = await contender('season-delete-peer'), observer = await contender('season-delete-observer');
      const requestId = key(), played = await attack(who, peer.profile.id, { requestId }); assert.equal(played.status, 200); const ownEntry = entry(who), peerId = peer.profile.id, observerEntry = entry(observer), ownPayload = row(who).payload;
      const deleted = await t.call('/api/account/delete', { confirm: 'DELETE' }, peer.token); assert.equal(deleted.status, 200);
      assert.ok(!t.sqlite.prepare('SELECT id FROM accounts WHERE id=?').get(peerId)); assert.equal(entry(who).points, ownEntry.points); assert.equal(entry(who).attacks, 1); assert.equal((await list(who)).me.usedToday, 1); assert.deepEqual(entry(observer), observerEntry); assert.equal(row(who).payload, ownPayload);
      assert.equal(t.sqlite.prepare('SELECT COUNT(*) AS n FROM school_season_matches WHERE target=? OR challenger=?').get(peerId, peerId).n, 0); assert.equal(t.sqlite.prepare('SELECT COUNT(*) AS n FROM school_season_days WHERE account_id=?').get(peerId).n, 0);
      const receipt = t.sqlite.prepare('SELECT * FROM school_season_receipts WHERE request_key=?').get(who.profile.id + ':' + requestId); assert.ok(receipt); assert.equal(receipt.match_id, null); assert.ok(!JSON.stringify(receipt).includes(peerId));
      const retry = await attack(who, observer.profile.id, { requestId }); assert.equal(retry.status, 200); assert.equal(retry.data.repeated, true); assert.equal(retry.data.matchUnavailable, true); assert.equal(retry.data.match, null); assert.equal(entry(who).attacks, 1);
      assert.equal((await social(who, 'season_match', { id: played.data.match.id })).status, 404); assert.equal((await social(peer, 'season_state')).status, 401);
      const erase = await t.call('/api/account/delete', { confirm: 'DELETE' }, who.token); assert.equal(erase.status, 200); for (const table of ['school_season_entries', 'school_season_days', 'school_season_receipts', 'school_season_awards', 'school_season_profiles']) assert.equal(t.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE account_id=?`).get(who.profile.id).n, 0);
      assert.deepEqual(entry(observer), observerEntry); assert.deepEqual(t.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    });

    await test('Season rollover awards only qualified tier cosmetics once, resets rankings and enforces owned equipment', async () => {
      isolate(); const who = await contender('season-award'), low = await contender('season-award-low'), tiers = [];
      for (const [tier, points] of [['bronze', -5000], ['silver', 100], ['gold', 250], ['diamond', 450]]) { const holder = await contender('season-award-' + tier); t.sqlite.prepare('UPDATE school_season_entries SET points=?,attacks=5 WHERE account_id=?').run(points, holder.profile.id); tiers.push({ holder, tier }); }
      t.sqlite.prepare('UPDATE school_season_entries SET points=9999,attacks=4 WHERE account_id=?').run(low.profile.id); t.sqlite.prepare('UPDATE school_season_entries SET points=250,attacks=5 WHERE account_id=?').run(who.profile.id);
      const oldSeason = currentSeason(now), payload = row(who).payload;
      now = oldSeason.endsAt - 1; assert.deepEqual((await list(who)).awards, []); assert.equal((await list(who)).season.id, oldSeason.id);
      now++; const fresh = await list(who); assert.equal(fresh.season.id, oldSeason.id + 1); assert.equal(fresh.me.registered, false); assert.equal(fresh.me.attacks, 0); assert.equal(fresh.me.usedToday, 0); assert.equal(fresh.me.rating, 1000); assert.equal(fresh.me.remainingToday, 5); assert.deepEqual(fresh.rankings, []); assert.deepEqual(fresh.candidates, []); assert.equal(fresh.awards.length, 1); assert.equal(fresh.awards[0].tier, 'gold'); assert.equal(fresh.awards[0].season, oldSeason.id); assert.equal(row(who).payload, payload);
      assert.deepEqual((await list(low)).awards, [], 'four attacks cannot receive even a high-tier reward');
      for (const { holder, tier } of tiers) { const info = await list(holder); assert.equal(info.awards.length, 1); assert.equal(info.awards[0].tier, tier); assert.equal(info.awards[0].frame, 'season-' + tier); assert.ok(info.awards[0].rating >= 0); }
      const award = fresh.awards[0]; const responses = await Promise.all(Array.from({ length: 6 }, () => list(who))); assert.ok(responses.every(r => r.awards.length === 1)); assert.equal(t.sqlite.prepare('SELECT COUNT(*) AS n FROM school_season_awards WHERE account_id=?').get(who.profile.id).n, 1);
      assert.equal((await social(low, 'season_equip', { awardId: award.id, accountId: who.profile.id })).status, 403); assert.equal((await social(who, 'season_equip', { awardId: 'season-diamond' })).status, 403);
      const equipped = await social(who, 'season_equip', { awardId: award.id, gems: 1e12, gold: 1e12, tier: 'diamond' }); assert.equal(equipped.status, 200); assert.equal(equipped.data.me.cosmetic.frame, 'season-gold'); assert.equal(equipped.data.awards[0].equipped, true); assert.equal(row(who).payload, payload);
      const removed = await social(who, 'season_equip', { awardId: null }); assert.equal(removed.status, 200); assert.equal(removed.data.me.cosmetic, null); assert.equal(removed.data.awards[0].equipped, false);
      assert.equal((await social(who, 'season_register', { seasonId: oldSeason.id })).status, 409); assert.equal((await attack(who, low.profile.id, { seasonId: oldSeason.id })).status, 409);
      await register(who); await register(low); const result = await attack(who, low.profile.id); assert.equal(result.status, 200); assert.equal(result.data.me.attacks, 1); assert.equal(result.data.me.usedToday, 1); assert.equal(result.data.me.rating, 1000 + result.data.match.ratingChange); assert.equal(result.data.awards.length, 1); assert.equal(row(who).payload, payload);
      assert.equal(t.sqlite.prepare('SELECT points FROM school_season_entries WHERE season=? AND account_id=?').get(oldSeason.id, who.profile.id).points, 250, 'new matches never alter ended season entries');
      assert.deepEqual(t.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    });

    console.log(`${passed} season/preset security checks passed`);
  } finally { Date.now = realNow; crypto.getRandomValues = realRandom; t.sqlite.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
