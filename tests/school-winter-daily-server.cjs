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
  const patch = (who, change) => { const s = saved(who); change(s); assert.ok(G.validate(s), 'valid trusted server fixture'); t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s), who.profile.id); };
  const input = (who, action, requestId = 'winter-daily-action-' + String(++sequence).padStart(5, '0')) => ({ revision: row(who).revision, requestId, action });
  const act = (who, action) => call(who, 'action', input(who, action));
  const account = async name => { const r = await t.login('winter-daily-' + name); assert.equal(r.status, 200); assert.equal((await call(r.data, 'state')).status, 200); return r.data; };
  const funded = who => patch(who, s => { s.winter.snowflakes = s.winter.earned = 5000; });
  const info = who => G.winterInfo(saved(who), now);
  const item = (who, id) => info(who).items.find(entry => entry.id === id);
  const test = async (name, fn) => { now += 61000; await fn(); passed++; console.log('PASS', name); };
  try {
    await test('Catalog16 rejects old15 reads and purchases before any server migration or charge', async () => {
      assert.equal(G.CATALOG_VERSION, 24);
      const who = await account('catalog'); funded(who); const before = row(who);
      for (const route of ['state', 'action']) {
        const payload = route === 'action' ? input(who, { kind: 'winter-exchange', item: 'gold', cost: 10 }) : {};
        const r = await call(who, route, { ...payload, catalogVersion: 15 }); assert.equal(r.status, 426); assert.match(r.data.error, /업데이트/); assert.ok(!r.data.state);
      }
      assert.equal(row(who).payload, before.payload); assert.equal(row(who).revision, before.revision);
      assert.equal((await call(who, 'state')).status, 200);
    });

    await test('Legacy lifetime30/15 counts migrate once to a fresh daily allowance without changing wallet or old rewards', async () => {
      const who = await account('legacy');
      patch(who, s => { s.winter = { id: G.WINTER_EVENT.id, snowflakes: 1432, earned: 3000, exchanges: { gold: 30, gems: 15 } }; s.gold = 5860; s.gems = 290; });
      let r = await call(who, 'state'); assert.equal(r.status, 200);
      assert.equal(r.data.state.winter.snowflakes, 1432); assert.equal(r.data.state.winter.earned, 3000); assert.equal(r.data.state.gold, 5860); assert.equal(r.data.state.gems, 290);
      assert.deepEqual(r.data.state.winter.exchanges, { gold: 30, gems: 15 }); assert.deepEqual(r.data.state.winter.daily, { day: G.day(now), exchanges: { gold: 0, gems: 0 } });
      assert.ok(info(who).items.filter(i=>!i.hero).every(entry => entry.remaining === 10));
      r = await act(who, { kind: 'winter-exchange', item: 'gold' }); assert.equal(r.status, 200); assert.equal(r.data.state.winter.snowflakes, 1402); assert.equal(r.data.state.gold, 6860); assert.deepEqual(r.data.state.winter.exchanges, { gold: 31, gems: 15 }); assert.equal(r.data.state.winter.daily.exchanges.gold, 1);
      const reloaded = (await t.login('winter-daily-legacy')).data;
      const r2 = await call(reloaded, 'state', { state: { winter: { daily: null, snowflakes: 1e12, exchanges: { gold: 0, gems: 0 } } } });
      assert.equal(r2.status, 200); assert.equal(r2.data.state.winter.daily.exchanges.gold, 1); assert.equal(r2.data.state.winter.exchanges.gold, 31); assert.equal(r2.data.state.winter.snowflakes, 1402); assert.equal(item(who, 'gold').remaining, 9);
    });

    await test('Client costs, quantities, rewards, counters and timestamps are ignored for both exchange items', async () => {
      const who = await account('forged'); funded(who); const before = saved(who);
      let r = await call(who, 'action', { ...input(who, { kind: 'winter-exchange', item: 'gold', cost: 0, count: 10, gold: 1e12, gems: 1e12, snowflakes: 1e12, bought: 0, limit: 1e9, now: now + 1e12 }), winter: { daily: { exchanges: { gold: 0, gems: 0 } } }, now: now + 1e12 });
      assert.equal(r.status, 200); assert.deepEqual(r.data.result, { kind: 'winter-exchange', item: 'gold', cost: 30, gold: 1000, gems: 0, remaining: 9 }); assert.equal(r.data.state.gold, before.gold + 1000); assert.equal(r.data.state.gems, before.gems); assert.equal(r.data.state.winter.snowflakes, 4970); assert.equal(r.data.state.winter.daily.exchanges.gold, 1);
      r = await act(who, { kind: 'winter-exchange', item: 'gems', cost: 20, count: 10, gems: 1e12 });
      assert.equal(r.status, 200); assert.deepEqual(r.data.result, { kind: 'winter-exchange', item: 'gems', cost: 60, gold: 0, gems: 100, remaining: 9 }); assert.equal(r.data.state.gems, before.gems + 100); assert.equal(r.data.state.winter.snowflakes, 4910); assert.equal(r.data.state.winter.daily.exchanges.gems, 1); assert.equal(r.data.state.winter.daily.day, G.day(now));
    });

    await test('Exactly ten purchases of each item succeed per account; both eleventh attempts fail without consuming snow', async () => {
      const who = await account('limits'), other = await account('independent'); funded(who); funded(other); const before = saved(who), otherBefore = row(other).payload;
      for (const id of ['gold', 'gems']) for (let i = 0; i < 10; i++) { const r = await act(who, { kind: 'winter-exchange', item: id }); assert.equal(r.status, 200); assert.equal(r.data.result.remaining, 9 - i); }
      assert.deepEqual(saved(who).winter.daily.exchanges, { gold: 10, gems: 10 }); assert.deepEqual(saved(who).winter.exchanges, { gold: 10, gems: 10 }); assert.equal(saved(who).winter.snowflakes, 4100); assert.equal(saved(who).gold, before.gold + 10000); assert.equal(saved(who).gems, before.gems + 1000); assert.ok(info(who).items.filter(i=>!i.hero).every(entry => entry.remaining === 0 && !entry.canBuy));
      for (const id of ['gold', 'gems']) { const beforeRow = row(who).payload; const r = await act(who, { kind: 'winter-exchange', item: id, daily: { exchanges: { gold: 0, gems: 0 } }, now: now + 86400000, cost: 0 }); assert.equal(r.status, 400); assert.equal(row(who).payload, beforeRow); }
      assert.equal(row(other).payload, otherBefore); assert.ok(info(other).items.filter(i=>!i.hero).every(entry => entry.remaining === 10)); assert.equal((await act(other, { kind: 'winter-exchange', item: 'gems' })).status, 200); assert.equal(saved(other).winter.snowflakes, 4940); assert.equal(item(who, 'gems').remaining, 0);
    });

    await test('Korean midnight resets both quotas at the exact boundary, preserving snow and lifetime history', async () => {
      now = Date.parse('2026-11-20T00:00:00+09:00') - 1;
      const who = await account('midnight'); funded(who); patch(who, s => { s.winter.exchanges = { gold: 30, gems: 15 }; s.winter.daily.exchanges = { gold: 10, gems: 10 }; });
      const before = saved(who), yesterday = G.day(now), boundary = now + 1;
      assert.equal(info(who).resetsAt, boundary); assert.ok(info(who).items.filter(i=>!i.hero).every(entry => entry.remaining === 0));
      assert.equal((await act(who, { kind: 'winter-exchange', item: 'gold', now: boundary })).status, 400);
      now = boundary;
      let r = await call(who, 'state'); assert.equal(r.status, 200); const board = G.winterInfo(r.data.state, now); assert.equal(board.day, yesterday + 1); assert.ok(board.items.filter(i=>!i.hero).every(entry => entry.remaining === 10)); assert.equal(r.data.state.winter.snowflakes, before.winter.snowflakes); assert.deepEqual(r.data.state.winter.exchanges, before.winter.exchanges); assert.equal(r.data.state.gold, before.gold); assert.equal(r.data.state.gems, before.gems);
      r = await act(who, { kind: 'winter-exchange', item: 'gold' }); assert.equal(r.status, 200); assert.deepEqual(r.data.state.winter.daily, { day: yesterday + 1, exchanges: { gold: 1, gems: 0 } });
      r = await act(who, { kind: 'winter-exchange', item: 'gems' }); assert.equal(r.status, 200); assert.deepEqual(r.data.state.winter.daily.exchanges, { gold: 1, gems: 1 }); assert.deepEqual(r.data.state.winter.exchanges, { gold: 31, gems: 16 }); assert.equal(r.data.state.winter.snowflakes, before.winter.snowflakes - 90);
      r = await call(who, 'state'); assert.equal(G.winterInfo(r.data.state, now).items[0].remaining, 9); assert.equal(r.data.state.winter.daily.exchanges.gold, 1);
    });

    await test('Concurrent duplicate exchange and lost response recover once across midnight; a new request uses the new day', async () => {
      now = Date.parse('2026-11-21T00:00:00+09:00') - 1;
      const who = await account('lost-midnight'); funded(who); patch(who, s => { s.winter.exchanges.gold = 19; s.winter.daily.exchanges.gold = 9; });
      const before = saved(who), request = input(who, { kind: 'winter-exchange', item: 'gold' });
      const prepare = t.db.prepare; let drop = true;
      t.db.prepare = sql => { const statement = prepare(sql); if (!sql.startsWith('UPDATE school_saves')) return statement; return { bind(...args) { const bound = statement.bind(...args); return { ...bound, async run() { const result = await bound.run(); if (drop) { drop = false; throw Error('D1_RESPONSE_LOST'); } return result; } }; } }; };
      try { assert.equal((await call(who, 'action', request)).status, 503); } finally { t.db.prepare = prepare; }
      now++;
      const retries = await Promise.all([call(who, 'action', request), call(who, 'action', request)]);
      for (const r of retries) { assert.equal(r.status, 200); assert.equal(r.data.repeated, true); assert.equal(r.data.result.remaining, 0); assert.equal(r.data.state.winter.snowflakes, before.winter.snowflakes - 30); assert.equal(r.data.state.gold, before.gold + 1000); assert.equal(r.data.state.winter.exchanges.gold, 20); }
      assert.deepEqual(retries[0].data.result, retries[1].data.result);
      const fresh = await act(who, { kind: 'winter-exchange', item: 'gold' }); assert.equal(fresh.status, 200); assert.equal(fresh.data.result.remaining, 9); assert.equal(fresh.data.state.winter.daily.day, G.day(now)); assert.equal(fresh.data.state.winter.daily.exchanges.gold, 1); assert.equal(fresh.data.state.winter.exchanges.gold, 21); assert.equal(fresh.data.state.winter.snowflakes, before.winter.snowflakes - 60); assert.equal(fresh.data.state.gold, before.gold + 2000);
      const again = await call(who, 'action', request); assert.equal(again.data.repeated, true); assert.equal(again.data.state.winter.daily.exchanges.gold, 1); assert.equal(again.data.state.winter.snowflakes, before.winter.snowflakes - 60);
    });

    await test('Distinct concurrent requests for the final daily purchase have one winner and cannot exceed ten', async () => {
      const who = await account('last-race'); funded(who); patch(who, s => { s.winter.daily.exchanges.gems = 9; s.winter.exchanges.gems = 29; });
      const before = saved(who), requests = [input(who, { kind: 'winter-exchange', item: 'gems' }), input(who, { kind: 'winter-exchange', item: 'gems' })];
      const replies = await Promise.all(requests.map(request => call(who, 'action', request))); assert.deepEqual(replies.map(r => r.status).sort(), [200, 409]);
      assert.equal(saved(who).winter.daily.exchanges.gems, 10); assert.equal(saved(who).winter.exchanges.gems, 30); assert.equal(saved(who).winter.snowflakes, before.winter.snowflakes - 60); assert.equal(saved(who).gems, before.gems + 100);
      assert.equal((await act(who, { kind: 'winter-exchange', item: 'gems' })).status, 400);
    });

    await test('A backwards server clock cannot reset already-used quotas or mint repeat allowance', async () => {
      now = Date.parse('2026-11-22T00:00:00.200+09:00');
      const who = await account('backwards'); funded(who); patch(who, s => { s.winter.daily.exchanges = { gold: 10, gems: 10 }; s.winter.exchanges = { gold: 40, gems: 35 }; });
      const before = saved(who), usedDay = G.day(now), forwardTime = now;
      now -= 500;
      let r = await call(who, 'state'); assert.equal(r.status, 200); assert.equal(G.winterInfo(r.data.state, now).day, usedDay); assert.ok(G.winterInfo(r.data.state, now).items.filter(i=>!i.hero).every(entry => entry.remaining === 0));
      for (const id of ['gold', 'gems']) assert.equal((await act(who, { kind: 'winter-exchange', item: id, day: G.day(now), now: forwardTime + 86400000, daily: null })).status, 400);
      now = forwardTime; r = await call(who, 'state'); assert.equal(r.status, 200); assert.deepEqual(r.data.state.winter, before.winter); assert.equal(r.data.state.gold, before.gold); assert.equal(r.data.state.gems, before.gems);
      assert.equal((await act(who, { kind: 'winter-exchange', item: 'gold' })).status, 400);
    });

    await test('Insufficient snow and invalid items never consume daily quota or lifetime counters', async () => {
      const who = await account('invalid'); patch(who, s => { s.winter.snowflakes = s.winter.earned = 29; });
      for (const action of [{ kind: 'winter-exchange', item: 'gold', cost: 0, snowflakes: 1e9 }, { kind: 'winter-exchange', item: 'gems' }, { kind: 'winter-exchange', item: '__proto__' }, { kind: 'winter-exchange', item: 'constructor' }, { kind: 'winter-exchange', item: null }]) { const before = row(who).payload; assert.equal((await act(who, action)).status, 400); assert.equal(row(who).payload, before); }
      assert.deepEqual(saved(who).winter.exchanges, { gold: 0, gems: 0 }); assert.deepEqual(saved(who).winter.daily.exchanges, { gold: 0, gems: 0 });
    });

    await test('Every migrated save validates and reconnect exposes no private receipt or account tokens', async () => {
      for (const record of t.sqlite.prepare('SELECT payload FROM school_saves').all()) assert.ok(G.validate(JSON.parse(record.payload)));
      const who = await account('privacy'), r = await call(who, 'state'); assert.equal(r.status, 200); assert.ok(!('receipts' in r.data.state)); assert.ok(!JSON.stringify(r.data.state).includes(who.token));
    });
    console.log(`${passed} winter daily server checks passed`);
  } finally { Date.now = realNow; t.sqlite.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
