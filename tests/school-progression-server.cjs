const assert = require('node:assert/strict');
const { fixture } = require('./account-fixture.cjs');
const G = require('../school/engine.js');

(async () => {
  const t = await fixture(), realNow = Date.now;
  let now = Date.parse('2026-11-18T12:00:00+09:00'), passed = 0, sequence = 0;
  Date.now = () => now;
  const call = (who, route, data = {}) => t.call('/api/school/' + route, { catalogVersion: G.CATALOG_VERSION, ...data }, null, who ? { 'X-Account-Session': who.token } : {});
  const row = who => t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id);
  const saved = who => JSON.parse(row(who).payload);
  // Trusted fixture changes seed specific existing server progress. The HTTP
  // assertions below separately verify that client-supplied versions are ignored.
  const patch = (who, change) => { const s = saved(who); change(s); assert.ok(G.validate(s), 'fixture must be a valid saved game'); t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s), who.profile.id); };
  const intent = (who, action, requestId = 'progression-action-' + String(++sequence).padStart(5, '0')) => ({ revision: row(who).revision, requestId, action });
  const act = (who, action, requestId) => call(who, 'action', intent(who, action, requestId));
  const account = async name => { const r = await t.login('progression-' + name); assert.equal(r.status, 200); const who = r.data; assert.equal((await call(who, 'state')).status, 200); return who; };
  // Independent accounts deliberately use separate login-rate windows. Within
  // each case time is frozen except where rollover/combat is under test.
  const test = async (name, fn) => { now += 61000; await fn(); console.log('PASS', name); passed++; };
  const award = (s, id) => G.questBoard(s, now).items.find(q => q.id === id);
  const prepareWin = (who, elapsed = 1000) => patch(who, s => { s.at = now - elapsed; for (const h of s.battle.heroes) { h.atk = 10000; h.energy = 0; } for (const e of s.battle.enemies) { e.hp = 1; e.atk = 0; } });
  try {
    await test('Catalog16 is required before account reads or spending; catalog15 cannot mutate a save', async () => {
      assert.equal(G.CATALOG_VERSION, 25);
      const who = await account('catalog'), before = row(who);
      for (const route of ['state', 'action']) {
        const data = route === 'action' ? intent(who, { kind: 'recruit', count: 1, cost: 100 }) : {};
        const r = await call(who, route, { ...data, catalogVersion: 15 });
        assert.equal(r.status, 426); assert.match(r.data.error, /업데이트/); assert.ok(!r.data.state);
      }
      assert.equal(row(who).payload, before.payload); assert.equal(row(who).revision, before.revision);
      assert.equal((await call(who, 'state')).status, 200);
    });

    await test('Forged progress, rewards, time and another account cannot make a quest claimable', async () => {
      const who = await account('forged'), other = await account('forged-other');
      const before = row(who).payload, otherBefore = row(other).payload;
      const fake = { version: 1, repeat: { kills: 999999, waves: 999999, bosses: 999999 }, daily: { day: G.day(now), kills: 999999, waves: 999999, bosses: 999999, claimed: [] } };
      const r = await call(who, 'action', { ...intent(who, { kind: 'quest-all', quests: fake, gold: 1e12, gems: 1e12, cycles: 1000, reward: { gold: 1e12, gems: 1e12 }, best: 60, now: now + 1e12 }), accountId: other.profile.id, state: { quests: fake, best: 60 }, now: now + 1e12 });
      assert.equal(r.status, 400); assert.equal(row(who).payload, before); assert.equal(row(other).payload, otherBefore);
      const read = await call(who, 'state', { quests: fake, state: { quests: fake }, kills: 999999, best: 60 });
      assert.equal(read.status, 200); assert.equal(read.data.state.best, 0); assert.equal(G.questReady(read.data.state, now), 0);
      assert.deepEqual(read.data.state.quests.repeat, { kills: 0, waves: 0, bosses: 0 });
    });

    await test('Actual server combat advances kill and wave counters without trusting browser totals', async () => {
      const who = await account('battle');
      patch(who, s => { s.quests.repeat.kills = 72; s.quests.daily.kills = 47; });
      prepareWin(who);
      const r = await call(who, 'state', { kills: 1e9, quests: { repeat: { kills: 1e9 } } });
      assert.equal(r.status, 200); assert.equal(r.data.state.battle.phase, 'victory');
      assert.equal(r.data.state.kills, 3); assert.equal(r.data.state.quests.repeat.kills, 75); assert.equal(r.data.state.quests.daily.kills, 50);
      assert.equal(r.data.state.quests.repeat.waves, 1); assert.equal(r.data.state.quests.daily.waves, 1); assert.equal(r.data.state.quests.repeat.bosses, 0);
      assert.equal(award(r.data.state, 'repeat-kills').ready, true); assert.equal(award(r.data.state, 'daily-kills').ready, true);
    });

    await test('Concurrent same-ID repeat claims and reconnect retries credit all cycles exactly once', async () => {
      const who = await account('same-claim'); patch(who, s => { s.quests.repeat.kills = 200; });
      const before = saved(who), input = intent(who, { kind: 'quest', quest: 'repeat-kills', cycles: 999, gold: 1e12, gems: 1e12 });
      const replies = await Promise.all([call(who, 'action', input), call(who, 'action', input)]);
      for (const r of replies) { assert.equal(r.status, 200); assert.equal(r.data.result.cycles, 2); assert.equal(r.data.result.gold, 1300); assert.equal(r.data.result.gems, 80); assert.equal(r.data.state.quests.repeat.kills, 50); }
      assert.deepEqual(replies[0].data.result, replies[1].data.result);
      const again = (await t.login('progression-same-claim')).data;
      const retry = await call(again, 'action', input); assert.equal(retry.status, 200); assert.equal(retry.data.repeated, true);
      assert.equal(saved(who).gold, before.gold + 1300); assert.equal(saved(who).gems, before.gems + 80);
      assert.equal((await act(again, { kind: 'quest', quest: 'repeat-kills' })).status, 400);
    });

    await test('Distinct simultaneous requests for the same completed quest have one winner', async () => {
      const who = await account('distinct-claim'); patch(who, s => { s.quests.repeat.waves = 30; });
      const before = saved(who), first = intent(who, { kind: 'quest', quest: 'repeat-waves' }), second = intent(who, { kind: 'quest', quest: 'repeat-waves' });
      const replies = await Promise.all([call(who, 'action', first), call(who, 'action', second)]);
      assert.deepEqual(replies.map(r => r.status).sort(), [200, 409]);
      assert.equal(saved(who).gold, before.gold + 910); assert.equal(saved(who).gems, before.gems + 40); assert.equal(saved(who).quests.repeat.waves, 0);
      assert.equal((await act(who, { kind: 'quest', quest: 'repeat-waves' })).status, 400);
    });

    await test('Repeat reward cap retains overflow for later claims and partial progress', async () => {
      const who = await account('overflow'); patch(who, s => { s.quests.repeat.kills = 7625; });
      const before = saved(who);
      let r = await act(who, { kind: 'quest', quest: 'repeat-kills' });
      assert.equal(r.status, 200); assert.equal(r.data.result.cycles, 100); assert.equal(r.data.state.quests.repeat.kills, 125);
      r = await act(who, { kind: 'quest', quest: 'repeat-kills' });
      assert.equal(r.status, 200); assert.equal(r.data.result.cycles, 1); assert.equal(r.data.state.quests.repeat.kills, 50);
      assert.equal(saved(who).gems, before.gems + 101 * 40); assert.equal(saved(who).gold, before.gold + 101 * 650);
      const r2 = await call(who, 'state'); assert.equal(award(r2.data.state, 'repeat-kills').value, 50); assert.equal(award(r2.data.state, 'repeat-kills').ready, false);
    });

    await test('Korean midnight resets daily eligibility without losing repeat progress or accepting forged yesterday', async () => {
      now = Date.parse('2026-11-18T23:59:59.700+09:00');
      const who = await account('midnight'); patch(who, s => { s.quests.repeat.kills = 77; s.quests.daily.kills = 50; s.quests.daily.waves = 15; });
      const yesterday = await act(who, { kind: 'quest', quest: 'daily-kills' }); assert.equal(yesterday.status, 200); assert.deepEqual(yesterday.data.state.quests.daily.claimed, ['daily-kills']);
      const before = saved(who), priorDay = G.day(now);
      now += 500;
      const r = await call(who, 'state'); assert.equal(r.status, 200);
      const board = G.questBoard(r.data.state, now); assert.equal(board.day, priorDay + 1); assert.equal(award(r.data.state, 'daily-kills').value, 0); assert.equal(award(r.data.state, 'daily-kills').ready, false);
      assert.equal(r.data.state.quests.repeat.kills, 77);
      const stale = await act(who, { kind: 'quest', quest: 'daily-waves', now: now - 1000, day: priorDay, claimed: [] }); assert.equal(stale.status, 400); assert.equal(saved(who).gems, before.gems);
      // Actual next-day combat clears yesterday's claim flag before counting new
      // kills. Old unclaimed daily progress cannot carry across the boundary.
      now += 1000; prepareWin(who); const fresh = await call(who, 'state'); assert.equal(fresh.status, 200); assert.equal(fresh.data.state.quests.daily.day, priorDay + 1); assert.deepEqual(fresh.data.state.quests.daily.claimed, []); assert.equal(fresh.data.state.quests.daily.kills, 3);
      patch(who, s => { s.quests.daily.kills = 50; });
      const claimed = await act(who, { kind: 'quest', quest: 'daily-kills' }); assert.equal(claimed.status, 200); assert.equal(claimed.data.result.gems, 30); assert.deepEqual(claimed.data.state.quests.daily.claimed, ['daily-kills']);
      assert.equal((await act(who, { kind: 'quest', quest: 'daily-kills' })).status, 400);
      now += 1000;
    });

    await test('Legacy best-stage progress is retroactively eligible once while old seven claims and currency stay intact', async () => {
      const who = await account('legacy');
      patch(who, s => { delete s.quests; s.best = 7; s.kills = 999999; s.claimed = G.QUESTS.map(q => q.id); s.redeemedCodes = ['OSIA_DEBUT', 'MAJORUPDATE']; s.gold = 5860; s.gems = 290; });
      let r = await call(who, 'state'); assert.equal(r.status, 200); assert.equal(r.data.state.gold, 5860); assert.equal(r.data.state.gems, 290); assert.equal(r.data.state.kills, 999999); assert.deepEqual(r.data.state.quests.repeat, { kills: 0, waves: 0, bosses: 0 }); assert.deepEqual(r.data.state.redeemedCodes, ['OSIA_DEBUT', 'MAJORUPDATE']);
      const ready = G.questBoard(r.data.state, now).items.filter(q => q.ready); assert.deepEqual(ready.map(q => q.id), Array.from({ length: 7 }, (_, i) => 'stage-' + (i + 1)));
      const input = intent(who, { kind: 'quest-all', best: 60, gold: 1e12, gems: 1e12 });
      r = await call(who, 'action', input); assert.equal(r.status, 200); assert.equal(r.data.result.cycles, 7); assert.equal(r.data.result.gems, 560); assert.equal(r.data.result.gold, 5096);
      assert.equal(r.data.state.gold, 10956); assert.equal(r.data.state.gems, 850);
      const retried = await call(who, 'action', input); assert.equal(retried.data.repeated, true); assert.equal(retried.data.state.gems, 850);
      assert.equal((await act(who, { kind: 'quest', quest: 'stage-7' })).status, 400); assert.equal((await act(who, { kind: 'quest', quest: 'stage-8' })).status, 400);
      const after = await call(who, 'state'); assert.equal(G.questReady(after.data.state, now), 0); for (const q of G.QUESTS) assert.ok(after.data.state.claimed.includes(q.id));
    });

    await test('Each real captain level gained from banked XP pays exactly160 gems and scaled coins, once despite lost response', async () => {
      const who = await account('captain-bank');
      patch(who, s => { s.offline = { seconds: 60, gold: 0, xp: 0, captainXp: G.captainNeed(1) + G.captainNeed(2) + G.captainNeed(3) + 7 }; });
      const before = saved(who), input = intent(who, { kind: 'offline', captain: { level: 200 }, gems: 1e12, reward: { gold: 1e12 } });
      const prepare = t.db.prepare; let drop = true;
      t.db.prepare = sql => { const statement = prepare(sql); if (!sql.startsWith('UPDATE school_saves')) return statement; return { bind(...args) { const bound = statement.bind(...args); return { ...bound, async run() { const result = await bound.run(); if (drop) { drop = false; throw Error('D1_RESPONSE_LOST'); } return result; } }; } }; };
      try { assert.equal((await call(who, 'action', input)).status, 503); } finally { t.db.prepare = prepare; }
      const retries = await Promise.all([call(who, 'action', input), call(who, 'action', input)]);
      for (const r of retries) { assert.equal(r.status, 200); assert.equal(r.data.repeated, true); assert.equal(r.data.state.captain.level, 4); assert.equal(r.data.state.captain.xp, 7); assert.equal(r.data.state.gems, before.gems + 480); assert.equal(r.data.state.gold, before.gold + 6240); }
      const events = saved(who).events.filter(e => e.kind === 'captain'); assert.deepEqual(events.map(e => [e.level, e.gems, e.gold]), [[2, 160, 1820], [3, 160, 2080], [4, 160, 2340]]);
      const again = (await t.login('progression-captain-bank')).data, reloaded = await call(again, 'state'); assert.equal(reloaded.data.state.gems, before.gems + 480); assert.equal((await act(again, { kind: 'offline' })).status, 400);
      assert.deepEqual(saved(who).quests.repeat, before.quests.repeat);
    });

    await test('A captain level gained from actual combat adds one reward and reconnect cannot replay it', async () => {
      const who = await account('captain-battle'); patch(who, s => { s.captain.xp = G.captainNeed(1) - 1; }); prepareWin(who);
      const before = saved(who), r = await call(who, 'state'); assert.equal(r.status, 200); assert.equal(r.data.state.captain.level, 2); assert.equal(r.data.state.gems, before.gems + 160); const combatReward = r.data.state.events.findLast(e => e.kind === 'reward'); assert.ok(combatReward.gold > 0); assert.equal(r.data.state.gold, before.gold + 1820 + combatReward.gold);
      assert.equal((await call(who, 'state')).data.state.gems, before.gems + 160); assert.equal(saved(who).events.filter(e => e.kind === 'captain' && e.level === 2).length, 1);
    });

    await test('All retired coupon names are rejected, while both new codes credit exact amounts once', async () => {
      const who = await account('codes');
      assert.deepEqual(Object.keys(G.COUPONS).sort(), ['HORAS_CELEBRATION', 'RANKING_FIRST_CONGRATS', 'RYUSION_UPDATE', 'THANKS_FOR_PLAYING', 'THANKS_FOR_REPORTING']);
      for (const code of ['MAJORUPDATE', 'OSIA_DEBUT', 'BUG_FIX', 'LAVA_DEBUT', 'THANK_YOU']) { const before = row(who).payload; const r = await act(who, { kind: 'redeem', code, now: Date.parse('2026-11-18T12:00:00+09:00'), expiresAt: 1e15 }); assert.equal(r.status, 400, code); assert.equal(row(who).payload, before, code); }
      for (const [code, amount] of [['THANKS_FOR_REPORTING', 500], ['HORAS_CELEBRATION', 2000]]) {
        const before = saved(who), input = intent(who, { kind: 'redeem', code: ' ' + code.toLowerCase() + ' ', gems: 1e12, gold: 1e12, redeemedCodes: [] });
        const replies = await Promise.all([call(who, 'action', input), call(who, 'action', input)]);
        for (const r of replies) { assert.equal(r.status, 200); assert.equal(r.data.result.code, code); assert.equal(r.data.result.gems, amount); assert.equal(r.data.result.gold, amount); assert.equal(r.data.state.gems, before.gems + amount); assert.equal(r.data.state.gold, before.gold + amount); }
        const retry = await call(who, 'action', input); assert.equal(retry.data.repeated, true); assert.equal((await act(who, { kind: 'redeem', code })).status, 400);
      }
      const again = (await t.login('progression-codes')).data, read = await call(again, 'state'); assert.deepEqual(read.data.state.redeemedCodes, ['THANKS_FOR_REPORTING', 'HORAS_CELEBRATION']); assert.equal(read.data.state.gems, 4300); assert.equal(read.data.state.gold, 3200);
    });

    await test('SSR and UR banners apply their own costs, ignoring client prices', async () => {
      for (const banner of ['horas', 'osia', 'lava']) {
        const who = await account('price-' + banner), r = await act(who, { kind: 'recruit', banner, count: 1, cost: 100, gems: 1e12 });
        assert.equal(r.status, 200); assert.equal(r.data.result.cost, G.recruitCost(banner,1)); assert.equal(r.data.state.gems, 1800-G.recruitCost(banner,1));
        const ten = await act(who, { kind: 'recruit', banner, count: 10, cost: 900 }); assert.equal(ten.status, 200); assert.equal(ten.data.result.cost, G.recruitCost(banner,10)); assert.equal(ten.data.state.gems, 1800-G.recruitCost(banner,1)-G.recruitCost(banner,10));
      }
    });

    await test('Offline accumulation and collection cannot manufacture repeat or daily combat counts', async () => {
      const who = await account('offline'); patch(who, s => { s.at = now - 3600000; s.quests.repeat = { kills: 43, waves: 13, bosses: 1 }; s.quests.daily.kills = 31; });
      const before = saved(who).quests, read = await call(who, 'state'); assert.equal(read.status, 200); assert.equal(read.data.state.offline.seconds, 3600); assert.deepEqual(read.data.state.quests, before);
      const claim = await act(who, { kind: 'offline', kills: 10000, quests: { repeat: { kills: 10000 } } }); assert.equal(claim.status, 200); assert.deepEqual(claim.data.state.quests, before);
    });

    await test('Already-cleared tower farming grants no quest counters; a new floor counts its real kills and one wave', async () => {
      const who = await account('tower'); patch(who, s => { s.activities.towerBest = 2; s.quests.repeat.kills = 19; s.quests.daily.kills = 11; });
      let r = await act(who, { kind: 'activity', mode: 'tower', floor: 1 }); assert.equal(r.status, 200); prepareWin(who);
      const before = saved(who).quests; r = await call(who, 'state'); assert.equal(r.status, 200); assert.equal(r.data.state.activities.lastResult.won, true); assert.equal(r.data.state.activities.lastResult.firstClear, false); assert.deepEqual(r.data.state.activities.lastResult.reward, { gold: 0, gems: 0, xp: 0 }); assert.deepEqual(r.data.state.quests, before);
      r = await act(who, { kind: 'activity', mode: 'tower', floor: 3 }); assert.equal(r.status, 200); prepareWin(who); r = await call(who, 'state'); assert.equal(r.status, 200); assert.equal(r.data.state.activities.lastResult.firstClear, true); assert.equal(r.data.state.quests.repeat.kills, before.repeat.kills + 3); assert.equal(r.data.state.quests.daily.kills, before.daily.kills + 3); assert.equal(r.data.state.quests.repeat.waves, before.repeat.waves + 1); assert.equal(r.data.state.quests.repeat.bosses, before.repeat.bosses);
    });

    await test('A real friend arena match and replay leave both accounts quest counters and currencies untouched', async () => {
      const a = await account('arena-a'), b = await account('arena-b'), social = (who, kind, data = {}) => call(who, 'social', { kind, ...data });
      for (const [who, name] of [[a, '임무검증알파'], [b, '임무검증베타']]) { assert.equal((await act(who, { kind: 'rename', name })).status, 200); patch(who, s => { s.quests.repeat = { kills: 99, waves: 29, bosses: 9 }; s.quests.daily = { day: G.day(now), kills: 49, waves: 14, bosses: 1, claimed: [] }; }); }
      let r = await social(a, 'friend_request', { name: '임무검증베타' }); assert.equal(r.status, 200); const request = r.data.requests.outgoing[0].id;
      assert.equal((await social(b, 'friend_accept', { id: request })).status, 200);
      const friend = (await social(a, 'state')).data.friends[0]; r = await social(a, 'arena_invite', { id: friend.id, requestId: 'progression-arena-invite01' }); assert.equal(r.status, 200); const invite = r.data.invites.outgoing[0].id;
      const before = [row(a).payload, row(b).payload]; r = await social(b, 'arena_accept', { id: invite, quests: { repeat: { kills: 1e9 } }, gems: 1e12 }); assert.equal(r.status, 200); assert.ok(r.data.match.events.length > 0); assert.equal(r.data.match.rules.rewards, false);
      assert.equal((await social(a, 'arena_match', { id: invite })).status, 200); assert.equal((await social(b, 'arena_match', { id: invite })).status, 200);
      assert.equal(row(a).payload, before[0]); assert.equal(row(b).payload, before[1]);
    });

    await test('Choosing a very weak cleared stage cannot farm quest counters or snow; the five-stage boundary is enforced server-side', async () => {
      const who = await account('weak-stage'); patch(who, s => { s.best = 60; s.quests.repeat = { kills: 90, waves: 20, bosses: 5 }; s.quests.daily = { day: G.day(now), kills: 40, waves: 10, bosses: 1, claimed: [] }; });
      for (const stage of [1, 54, 55]) {
        const entry = await act(who, { kind: 'stage', stage, mode: 'farm', best: 0, eligible: true }); assert.equal(entry.status, 200); assert.equal(entry.data.state.best, 60);
        patch(who, s => { s.seed = 1; }); prepareWin(who);
        const before = saved(who), r = await call(who, 'state', { eligible: true, state: { best: 0 }, stage: 60, questProgress: 1000, snowflakes: 1000 });
        assert.equal(r.status, 200); assert.equal(r.data.state.battle.phase, 'victory'); assert.equal(r.data.state.kills, before.kills + 3);
        if (stage < 55) { assert.deepEqual(r.data.state.quests, before.quests); assert.deepEqual(r.data.state.winter, before.winter); if (stage === 1) { assert.equal(r.data.state.gold, before.gold + 3); assert.equal(r.data.state.gems, before.gems); assert.deepEqual(r.data.state.captain, before.captain); for (const id of before.team) assert.equal(r.data.state.units[id].xp, before.units[id].xp); } }
        else { assert.equal(r.data.state.quests.repeat.kills, before.quests.repeat.kills + 3); assert.equal(r.data.state.quests.daily.kills, before.quests.daily.kills + 3); assert.equal(r.data.state.quests.repeat.waves, before.quests.repeat.waves + 1); assert.equal(r.data.state.winter.snowflakes, before.winter.snowflakes + 1); }
      }
      // A real final-wave settlement also cannot bypass the weak-stage rule.
      assert.equal((await act(who, { kind: 'stage', stage: 1, mode: 'farm' })).status, 200);
      patch(who, s => { s.wave = s.battle.wave = 4; s.battle.boss = true; s.battle.enemies = [s.battle.enemies[0]]; s.battle.enemies[0].boss = true; s.seed = 1; }); prepareWin(who);
      const before = saved(who), r = await call(who, 'state'); assert.equal(r.status, 200); assert.equal(r.data.state.battle.phase, 'victory'); assert.deepEqual(r.data.state.quests, before.quests); assert.deepEqual(r.data.state.winter, before.winter); assert.equal(r.data.state.gold, before.gold + 5); assert.equal(r.data.state.gems, before.gems); assert.deepEqual(r.data.state.captain, before.captain);
    });

    await test('Every persisted progression save remains valid and private receipts stay server-side', async () => {
      const rows = t.sqlite.prepare('SELECT payload FROM school_saves').all(); assert.ok(rows.length >= 15);
      for (const r of rows) assert.ok(G.validate(JSON.parse(r.payload)));
      const who = await account('privacy'), r = await call(who, 'state'); assert.equal(r.status, 200); assert.ok(!('receipts' in r.data.state)); assert.ok(!JSON.stringify(r.data.state).includes(who.token));
    });
    console.log(`${passed} school progression server checks passed`);
  } finally { Date.now = realNow; t.sqlite.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
