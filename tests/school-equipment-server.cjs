const assert = require('node:assert/strict');
const { fixture } = require('./account-fixture.cjs');
const G = require('../school/engine.js');

(async () => {
  const t = await fixture(), realNow = Date.now, realRandom = crypto.getRandomValues;
  let now = Date.parse('2026-11-18T12:00:00+09:00'), sequence = 0, passed = 0;
  Date.now = () => now;
  const call = (who, route, data = {}) => t.call('/api/school/' + route, { catalogVersion: G.CATALOG_VERSION, ...data }, null, who ? { 'X-Account-Session': who.token } : {});
  const social = (who, kind, data = {}) => call(who, 'social', { kind, ...data });
  const row = who => t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id);
  const saved = who => JSON.parse(row(who).payload);
  // Only this trusted fixture helper writes server saves. Every hostile input
  // below is submitted through the real authenticated Worker route.
  const patch = (who, change) => { const state = saved(who); change(state); assert.ok(G.validate(state), 'valid trusted equipment fixture'); t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(state), who.profile.id); };
  const key = () => 'equipment-request-' + String(++sequence).padStart(6, '0');
  const intent = (who, action, requestId = key()) => ({ revision: row(who).revision, requestId, action });
  const act = (who, action) => call(who, 'action', intent(who, action));
  const account = async name => { const r = await t.login('equipment-security-' + name); assert.equal(r.status, 200); const who = r.data; assert.equal((await call(who, 'state')).status, 200); return who; };
  const test = async (name, run) => { now += 61000; await run(); passed++; console.log('PASS', name); };
  const items = state => G.equipmentInfo(state).items;
  const item = (state, slot, rarity = 'R') => { const found = items(state).find(i => i.slot === slot && i.rarity === rarity); assert.ok(found, slot + '/' + rarity); return found.id; };
  const total = state => Object.values(state.equipment?.inventory || {}).reduce((sum, owned) => sum + owned.count, 0);
  const fund = (who, id, count = 1, stars = 0) => patch(who, s => { s.equipment.inventory[id] = { count, stars }; });
  const equip = (who, hero, id) => act(who, { kind: 'gear-equip', hero, item: id });
  const awaken = (who, id) => act(who, { kind: 'gear-awaken', item: id });
  const begin = async (who, mode = 'daily', value = 1) => { const r = await act(who, { kind: 'activity', mode, ...(mode === 'tower' ? { floor: value } : { tier: value }) }); assert.equal(r.status, 200, JSON.stringify(r.data)); return r; };
  const prepareWin = who => patch(who, state => { state.at = now - 1000; for (const hero of state.battle.heroes) { hero.atk = 100000000; hero.energy = 0; } for (const enemy of state.battle.enemies) { enemy.hp = 1; enemy.atk = 0; } });
  const won = async who => { prepareWin(who); const r = await call(who, 'state'); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.state.activities.lastResult.won, true); return r; };
  const secure = async (value, run) => { let reads = 0; crypto.getRandomValues = array => { if (array instanceof Uint32Array && array.length === 1) { reads++; array[0] = value; return array; } return realRandom.call(crypto, array); }; try { return { value: await run(), reads }; } finally { crypto.getRandomValues = realRandom; } };
  const loseWriteResponse = async run => {
    const prepare = t.db.prepare; let lost = false;
    t.db.prepare = sql => { const statement = prepare(sql); if (!sql.startsWith('UPDATE school_saves')) return statement; return { bind(...args) { const bound = statement.bind(...args); return { ...bound, async run() { const result = await bound.run(); if (!lost && result.meta.changes) { lost = true; throw Error('D1_RESPONSE_LOST_AFTER_EQUIPMENT_COMMIT'); } return result; } }; } }; };
    try { const result = await run(); assert.ok(lost); return result; } finally { t.db.prepare = prepare; }
  };
  try {
    await test('Current catalog and authentication protect all equipment changes before any write', async () => {
      assert.equal(G.CATALOG_VERSION, 32);
      const who = await account('catalog'), before = row(who), id = item(saved(who), 'weapon');
      for (const action of [{ kind: 'gear-equip', hero: 'taeo', item: id }, { kind: 'gear-unequip', hero: 'taeo', slot: 'weapon' }, { kind: 'gear-awaken', item: id }]) {
        assert.equal((await call(null, 'action', intent(who, action))).status, 401);
        assert.equal((await call(who, 'action', { ...intent(who, action), catalogVersion: 15 })).status, 426);
      }
      assert.equal((await call(who, 'state', { catalogVersion: 15 })).status, 426); assert.equal(row(who).payload, before.payload); assert.equal(row(who).revision, before.revision);
    });

    await test('Legacy saves migrate to an empty bag once without inventing equipment or changing old progression', async () => {
      const who = await account('legacy'); patch(who, s => { delete s.equipment; s.gold = 5860; s.gems = 290; });
      const before = saved(who), r = await call(who, 'state'); assert.equal(r.status, 200); assert.deepEqual(r.data.state.equipment, { inventory: {}, equipped: {} });
      const after = G.clone(r.data.state); delete after.equipment; delete before.receipts; assert.deepEqual(after, before);
      const payload = row(who).payload; assert.equal((await call(who, 'state')).status, 200); assert.equal(row(who).payload, payload);
    });

    await test('Forged inventory, counts, stars, loot, cost and another account cannot create owned equipment', async () => {
      const who = await account('forged'), other = await account('forged-other'), id = item(saved(who), 'weapon', 'SSR'); fund(other, id, 99, 5);
      const otherBefore = row(other).payload, before = row(who).payload, fake = { inventory: { [id]: { count: 999999, stars: 5 } }, equipped: { taeo: { weapon: id } } };
      for (const action of [{ kind: 'gear-equip', hero: 'taeo', item: id }, { kind: 'gear-awaken', item: id }]) {
        const r = await call(who, 'action', { ...intent(who, { ...action, equipment: fake, count: 99999, stars: 5, level: 100, cost: 0, materials: [], reward: { item: id, count: 99999 } }), state: { equipment: fake }, equipment: fake, accountId: other.profile.id });
        assert.equal(r.status, 400); assert.equal(row(who).payload, before); assert.equal(row(other).payload, otherBefore);
      }
      const read = await call(who, 'state', { equipment: fake, state: saved(other), accountId: other.profile.id, gearDrops: [{ item: id, count: 99999 }] }); assert.equal(read.status, 200); assert.equal(total(read.data.state), 0);
      assert.equal(row(other).payload, otherBefore);
    });

    await test('One physical copy cannot be worn twice; switching or removing equipment never consumes the collection', async () => {
      const who = await account('copies'), a = item(saved(who), 'weapon'), b = item(saved(who), 'weapon', 'SR'); fund(who, a, 2); fund(who, b);
      assert.equal((await equip(who, 'taeo', a)).status, 200); assert.equal((await equip(who, 'harin', a)).status, 200);
      const before = row(who).payload; assert.equal((await equip(who, 'sua', a)).status, 400); assert.equal(row(who).payload, before);
      assert.equal((await equip(who, 'taeo', b)).status, 200); assert.equal((await equip(who, 'sua', a)).status, 200);
      assert.equal(saved(who).equipment.inventory[a].count, 2); assert.equal(saved(who).equipment.inventory[b].count, 1);
      assert.equal((await act(who, { kind: 'gear-unequip', hero: 'harin', slot: 'weapon' })).status, 200); assert.equal(saved(who).equipment.inventory[a].count, 2);
      assert.equal((await equip(who, 'taeo', a)).status, 200); assert.equal(total(saved(who)), 3); assert.equal(G.equipmentInfo(saved(who)).items.find(i => i.id === b).free, 1);
      assert.equal((await equip(who, 'taeo', a)).status, 400);
    });

    await test('Malformed/prototype IDs and foreign heroes are rejected without mutation or prototype pollution', async () => {
      const who = await account('invalid'), id = item(saved(who), 'weapon'); fund(who, id, 4); assert.equal((await equip(who, 'taeo', id)).status, 200);
      const actions = [];
      for (const value of ['__proto__', 'constructor', 'prototype', 'not-an-item', '', null, {}, [], 1]) {
        actions.push({ kind: 'gear-equip', hero: 'taeo', item: value }, { kind: 'gear-awaken', item: value }, { kind: 'gear-equip', hero: value, item: id }, { kind: 'gear-unequip', hero: 'taeo', slot: value });
      }
      actions.push({ kind: 'gear-equip', hero: 'horas', item: id }, { kind: 'gear-unequip', hero: 'horas', slot: 'weapon' });
      actions.push({ kind: 'gear-equip', hero: 'sua', item: id, slot: 'armor' }, { kind: 'gear-equip', hero: 'sua', item: id, count: 1000 }, { kind: 'gear-equip', hero: 'sua', item: id, stars: 5 }, { kind: 'gear-awaken', item: id, count: 1000 }, { kind: 'gear-awaken', item: id, stars: 5 });
      for (const action of actions) { const before = row(who).payload; assert.equal((await act(who, action)).status, 400, JSON.stringify(action)); assert.equal(row(who).payload, before); }
      assert.equal({}.polluted, undefined);
      for (const mutation of [
        s => { s.equipment.inventory[id].count = -1; }, s => { s.equipment.inventory[id].count = 1.5; }, s => { s.equipment.inventory[id].stars = 6; }, s => { s.equipment.inventory[id].stars = -1; },
        s => { s.equipment.inventory[id].stars = 1.5; }, s => { s.equipment.equipped.horas = { weapon: id }; }, s => { s.equipment.equipped.sua = { armor: id }; },
        s => { s.equipment.inventory[id].count = 1; s.equipment.equipped.sua = { weapon: id }; }, s => { s.equipment.inventory = JSON.parse('{"__proto__":{"count":1,"stars":5}}'); },
      ]) { const state = saved(who); mutation(state); assert.equal(G.validate(state), false, 'malformed persisted equipment is rejected'); }
    });

    await test('Global item awakening consumes only surplus matching copies at costs1,1,2,2,3 and never the retained original', async () => {
      const who = await account('awakening'), id = item(saved(who), 'weapon', 'SSR'); fund(who, id, 11); assert.equal((await equip(who, 'taeo', id)).status, 200); assert.equal((await equip(who, 'harin', id)).status, 200);
      const wallet = [saved(who).gold, saved(who).gems], battle = saved(who).battle; let count = 11;
      for (const [stars, cost] of [1, 1, 2, 2, 3].entries()) {
        const r = await act(who, { kind: 'gear-awaken', item: id, cost: 0, hero: 'sua', materials: ['forged'] }); assert.equal(r.status, 200); count -= cost;
        assert.deepEqual(r.data.state.equipment.inventory[id], { count, stars: stars + 1 }); assert.deepEqual(r.data.state.battle, battle); assert.deepEqual([r.data.state.gold, r.data.state.gems], wallet);
        assert.deepEqual(r.data.state.equipment.equipped.taeo, { weapon: id }); assert.deepEqual(r.data.state.equipment.equipped.harin, { weapon: id });
      }
      assert.equal(count, 2); const maxed = row(who).payload; assert.equal((await awaken(who, id)).status, 400); assert.equal(row(who).payload, maxed);
      const lone = await account('awakening-lone'), other = item(saved(lone), 'armor'); fund(lone, other, 1); const before = row(lone).payload; assert.equal((await awaken(lone, other)).status, 400); assert.equal(row(lone).payload, before);
      fund(lone, other, 2); assert.equal((await awaken(lone, other)).status, 200); assert.deepEqual(saved(lone).equipment.inventory[other], { count: 1, stars: 1 });
    });

    await test('Concurrent same-request awakening and reconnect consume materials once; different requests cannot double spend', async () => {
      const who = await account('awakening-race'), id = item(saved(who), 'weapon'); fund(who, id, 2);
      const request = intent(who, { kind: 'gear-awaken', item: id }), responses = await Promise.all(Array.from({ length: 5 }, () => call(who, 'action', request)));
      assert.ok(responses.every(r => r.status === 200)); assert.deepEqual(saved(who).equipment.inventory[id], { count: 1, stars: 1 }); assert.ok(responses.every(r => JSON.stringify(r.data.result) === JSON.stringify(responses[0].data.result)));
      const again = (await t.login('equipment-security-awakening-race')).data, retry = await call(again, 'action', request); assert.equal(retry.status, 200); assert.equal(retry.data.repeated, true); assert.deepEqual(retry.data.state.equipment.inventory[id], { count: 1, stars: 1 });
      fund(who, id, 2, 0); const first = intent(who, { kind: 'gear-awaken', item: id }), second = intent(who, { kind: 'gear-awaken', item: id });
      const raced = await Promise.all([call(who, 'action', first), call(who, 'action', second)]); assert.deepEqual(raced.map(r => r.status).sort(), [200, 409]); assert.deepEqual(saved(who).equipment.inventory[id], { count: 1, stars: 1 }); assert.equal((await awaken(who, id)).status, 400);
    });

    await test('Two heroes racing for the last free copy have one winner, and a lost awakening response replays safely', async () => {
      const who = await account('equip-race'), id = item(saved(who), 'armor'); fund(who, id);
      const requests = ['taeo', 'harin'].map(hero => intent(who, { kind: 'gear-equip', hero, item: id })); const results = await Promise.all(requests.map(request => call(who, 'action', request))); assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
      assert.equal(Object.values(saved(who).equipment.equipped).filter(slots => slots.armor === id).length, 1); assert.equal(saved(who).equipment.inventory[id].count, 1);
      fund(who, id, 2); const request = intent(who, { kind: 'gear-awaken', item: id }); assert.equal((await loseWriteResponse(() => call(who, 'action', request))).status, 503);
      const repeats = await Promise.all([call(who, 'action', request), call(who, 'action', request)]); assert.ok(repeats.every(r => r.status === 200 && r.data.repeated)); assert.deepEqual(saved(who).equipment.inventory[id], { count: 1, stars: 1 });
    });

    await test('Equipping and awakening never reset or heal an active battle and are blocked during an unsettled dungeon', async () => {
      const who = await account('battle-lock'), weapon = item(saved(who), 'weapon'), armor = item(saved(who), 'armor'); fund(who, weapon, 2); fund(who, armor, 2);
      patch(who, state => { state.battle.heroes[0].hp = 1; state.battle.heroes[1].hp = 0; }); const initial = saved(who).battle;
      assert.equal((await equip(who, 'taeo', weapon)).status, 200); assert.equal((await awaken(who, weapon)).status, 200); assert.deepEqual(saved(who).battle, initial);
      await begin(who); const before = row(who).payload;
      for (const action of [{ kind: 'gear-equip', hero: 'taeo', item: armor }, { kind: 'gear-unequip', hero: 'taeo', slot: 'weapon' }, { kind: 'gear-awaken', item: armor }]) { assert.equal((await act(who, action)).status, 400); assert.equal(row(who).payload, before); }
      await won(who); const finished = saved(who).battle, reward = saved(who).activities.lastResult; assert.equal((await equip(who, 'taeo', armor)).status, 200); assert.deepEqual(saved(who).battle, finished); assert.deepEqual(saved(who).activities.lastResult, reward);
      assert.equal((await act(who, { kind: 'activity-exit' })).status, 200); const hero = saved(who).battle.heroes.find(h => h.id === 'taeo'), stats = G.stats('taeo', saved(who).units.taeo, saved(who)); assert.equal(hero.atk, stats.atk); assert.equal(hero.max, stats.hp);
    });

    await test('Actual daily and weekly wins award exactly1/2 server-selected items and preserve normal rewards', async () => {
      for (const [mode, expected] of [['daily', 1], ['weekly', 2]]) {
        const who = await account('drop-' + mode), start = await begin(who, mode); assert.equal(total(start.data.state), 0); assert.ok(!start.data.state.activities.run.gearDrops);
        const before = saved(who), reward = G.activityReward(mode, 1); prepareWin(who);
        const secured = await secure(0, () => call(who, 'state', { gearDrops: [{ item: item(before, 'weapon', 'SSR'), count: 1000 }], equipment: { inventory: { forged: { count: 1000, stars: 5 } } }, won: true }));
        const r = secured.value; assert.equal(r.status, 200); assert.equal(r.data.state.activities.lastResult.won, true); assert.equal(total(r.data.state), expected); assert.equal(r.data.state.activities.lastResult.gearDrops.length, expected); assert.equal(secured.reads, expected * 2);
        assert.equal(r.data.state.gold, before.gold + reward.gold); assert.equal(r.data.state.gems, before.gems + reward.gems); assert.equal(r.data.state.activities[mode].used, 1);
        const drops = r.data.state.activities.lastResult.gearDrops; for (const drop of drops) { assert.equal(drop.count, 1); assert.equal(drop.stars, 0); assert.equal(items(r.data.state).find(i => i.id === drop.item).rarity, 'R'); }
        if (mode === 'weekly') { assert.equal(drops[0].duplicate, false); assert.equal(drops[1].duplicate, true); }
        assert.equal(r.data.state.events.filter(e => e.kind === 'activity-result').at(-1).gearDrops.length, expected);
      }
    });

    await test('Client-visible battle seeds do not predict authoritative loot; preview never fabricates confirmed items', async () => {
      const a = await account('secure-a'), b = await account('secure-b'); await begin(a); await begin(b);
      const template = saved(a); patch(b, state => { Object.assign(state, G.clone(template)); }); prepareWin(a); prepareWin(b);
      const first = saved(a), second = saved(b); assert.equal(first.seed, second.seed); assert.deepEqual(first.battle, second.battle);
      const preview = G.clone(first); G.advance(preview, now, { preview: true }); assert.equal(preview.activities.lastResult.won, true); assert.equal(preview.activities.lastResult.gearPending, true); assert.deepEqual(preview.activities.lastResult.gearDrops, []); assert.equal(total(preview), 0);
      const low = await secure(0, () => call(a, 'state')), high = await secure(0xffffffff, () => call(b, 'state')); assert.equal(low.value.status, 200); assert.equal(high.value.status, 200); assert.equal(low.reads, 2); assert.equal(high.reads, 2);
      const l = low.value.data.state, h = high.value.data.state; assert.equal(l.seed, h.seed, 'loot draws do not consume predictable battle RNG'); assert.notDeepEqual(l.activities.lastResult.gearDrops, h.activities.lastResult.gearDrops); assert.equal(items(l).find(i => i.id === l.activities.lastResult.gearDrops[0].item).rarity, 'R'); assert.equal(items(h).find(i => i.id === h.activities.lastResult.gearDrops[0].item).rarity, 'SSR');
      for (const state of [l, h]) { assert.ok(!state.activities.lastResult.gearPending); assert.ok(!('receipts' in state)); assert.ok(!JSON.stringify(state.activities.run).includes('lootSeed')); }
    });

    await test('Concurrent settlement reads commit one loot result and response loss cannot roll or award again', async () => {
      const who = await account('settle-race'); await begin(who, 'weekly'); prepareWin(who);
      const r = await Promise.all(Array.from({ length: 6 }, () => call(who, 'state'))); assert.ok(r.every(reply => reply.status === 200)); assert.equal(total(saved(who)), 2);
      assert.ok(r.every(reply => JSON.stringify(reply.data.state.equipment) === JSON.stringify(saved(who).equipment))); assert.equal(saved(who).events.filter(e => e.kind === 'activity-result').length, 1);
      const first = G.clone(saved(who).activities.lastResult); for (let i = 0; i < 4; i++) assert.deepEqual((await call(who, 'state')).data.state.activities.lastResult, first); assert.equal(total(saved(who)), 2);
      await begin(who); prepareWin(who); assert.equal((await loseWriteResponse(() => call(who, 'state'))).status, 503); const committed = saved(who), drops = G.clone(committed.activities.lastResult.gearDrops); assert.equal(total(committed), 3);
      const retries = await Promise.all([call(who, 'state'), call(who, 'state')]); assert.ok(retries.every(reply => reply.status === 200)); assert.ok(retries.every(reply => JSON.stringify(reply.data.state.activities.lastResult.gearDrops) === JSON.stringify(drops))); assert.equal(total(saved(who)), 3);
      assert.equal((await act(who, { kind: 'activity-exit', won: true, gearDrops: drops })).status, 200); assert.equal(total(saved(who)), 3);
    });

    await test('An invalid action cannot discard a pending reward and selectively reroll until a desired SSR appears', async () => {
      const who = await account('selective-reroll'); await begin(who); prepareWin(who);
      const desired = item(saved(who), 'charm', 'SSR'), initial = row(who), input = intent(who, { kind: 'gear-equip', hero: 'taeo', item: desired });
      const first = await secure(0, () => call(who, 'action', input)); assert.equal(first.value.status, 400); assert.equal(first.reads, 2);
      const committed = saved(who); assert.equal(total(committed), 1, 'real victory must be saved even when the requested action is invalid'); assert.equal(committed.activities.run.settled, true); assert.equal(row(who).revision, initial.revision + 1); assert.ok(!committed.equipment.inventory[desired]);
      const originalLoot = G.clone(committed.equipment), result = G.clone(committed.activities.lastResult);
      for (let i = 0; i < 4; i++) {
        const reroll = await secure(0xffffffff, () => act(who, { kind: 'gear-equip', hero: 'taeo', item: desired })); assert.equal(reroll.value.status, 400); assert.equal(reroll.reads, 0); assert.deepEqual(saved(who).equipment, originalLoot); assert.deepEqual(saved(who).activities.lastResult, result);
      }
      assert.equal((await equip(who, 'taeo', result.gearDrops[0].item)).status, 200); assert.equal(total(saved(who)), 1);
    });

    await test('Lost pre-action loot commit and conflicting selective probes cannot discard or regenerate its reward', async () => {
      const who = await account('selective-lost'); await begin(who); prepareWin(who);
      const desired = item(saved(who), 'charm', 'SSR'), input = intent(who, { kind: 'gear-equip', hero: 'taeo', item: desired });
      const lost = await secure(0, () => loseWriteResponse(() => call(who, 'action', input))); assert.equal(lost.value.status, 503); assert.equal(lost.reads, 2); assert.equal(total(saved(who)), 1); assert.equal(saved(who).activities.run.settled, true);
      const equipment = G.clone(saved(who).equipment), original = G.clone(saved(who).activities.lastResult);
      const stale = await secure(0xffffffff, () => call(who, 'action', input)); assert.equal(stale.value.status, 409); assert.equal(stale.reads, 0); assert.deepEqual(saved(who).equipment, equipment);
      const requests = Array.from({ length: 5 }, () => intent(who, { kind: 'gear-equip', hero: 'taeo', item: desired }));
      const raced = await secure(0xffffffff, () => Promise.all(requests.map(request => call(who, 'action', request)))); assert.ok(raced.value.every(r => r.status === 400)); assert.equal(raced.reads, 0); assert.deepEqual(saved(who).equipment, equipment); assert.deepEqual(saved(who).activities.lastResult, original);
    });

    await test('Simultaneous selective probes cannot choose which of their independently rolled rewards survives', async () => {
      const who = await account('selective-concurrent'); await begin(who); prepareWin(who);
      const desired = item(saved(who), 'charm', 'SSR'), inputs = Array.from({ length: 4 }, () => intent(who, { kind: 'gear-equip', hero: 'taeo', item: desired })); let reads = 0;
      crypto.getRandomValues = array => { if (array instanceof Uint32Array && array.length === 1) { array[0] = reads++ < 2 ? 0 : 0xffffffff; return array; } return realRandom.call(crypto, array); };
      let results; try { results = await Promise.all(inputs.map(input => call(who, 'action', input))); } finally { crypto.getRandomValues = realRandom; }
      assert.ok(results.every(r => [400, 409].includes(r.status))); assert.ok(reads >= 2); assert.equal(total(saved(who)), 1); assert.ok(!saved(who).equipment.inventory[desired]); assert.equal(saved(who).activities.run.settled, true);
      assert.equal(saved(who).events.filter(e => e.kind === 'activity-result').length, 1); const result = saved(who).activities.lastResult; assert.equal(items(saved(who)).find(i => i.id === result.gearDrops[0].item).rarity, 'R');
    });

    await test('Abandoning, defeat, refund, offline progress and ordinary campaign victories cannot mint dungeon gear', async () => {
      const who = await account('no-drops');
      for (let i = 0; i < 4; i++) { await begin(who); assert.equal(total(saved(who)), 0); const exit = await act(who, { kind: 'activity-exit', won: true, reward: { gear: 99 } }); assert.equal(exit.status, 200); assert.equal(exit.data.result.result.refunded, true); assert.equal(saved(who).activities.daily.used, 0); assert.equal(total(saved(who)), 0); }
      await begin(who); patch(who, state => { state.at = now - 1000; state.battle.heroes.forEach(hero => { hero.hp = 0; }); }); const defeat = await call(who, 'state'); assert.equal(defeat.status, 200); assert.equal(defeat.data.state.activities.lastResult.won, false); assert.equal(defeat.data.state.activities.daily.used, 0); assert.equal(total(defeat.data.state), 0);
      await begin(who); patch(who, state => { state.at = now - 3600000; }); const offline = await call(who, 'state', { now: now + 86400000, won: true }); assert.equal(offline.status, 200); assert.equal(offline.data.state.activities.run.settled, false); assert.equal(total(offline.data.state), 0); assert.equal(offline.data.state.activities.daily.used, 1);
      assert.equal((await act(who, { kind: 'offline', gearDrops: [{ item: item(saved(who), 'weapon'), count: 100 }] })).status, 200); assert.equal(total(saved(who)), 0);
      assert.equal((await act(who, { kind: 'activity-exit' })).status, 200); prepareWin(who); const campaign = await call(who, 'state'); assert.equal(campaign.status, 200); assert.equal(campaign.data.state.battle.phase, 'victory'); assert.equal(total(campaign.data.state), 0);
    });

    await test('Only newly cleared fifth tower floors drop gear; a repeated boss and ordinary new floor do not', async () => {
      const who = await account('tower'); patch(who, state => { state.activities.towerBest = 4; });
      await begin(who, 'tower', 5); let r = await won(who); assert.equal(r.data.state.activities.lastResult.firstClear, true); assert.equal(total(r.data.state), 1); assert.equal(r.data.state.activities.lastResult.gearDrops.length, 1);
      await begin(who, 'tower', 5); r = await won(who); assert.equal(r.data.state.activities.lastResult.firstClear, false); assert.equal(total(r.data.state), 1); assert.deepEqual(r.data.state.activities.lastResult.gearDrops, []);
      await begin(who, 'tower', 6); r = await won(who); assert.equal(r.data.state.activities.lastResult.firstClear, true); assert.equal(total(r.data.state), 1); assert.deepEqual(r.data.state.activities.lastResult.gearDrops, []);
      patch(who, state => { state.activities.towerBest = 9; }); await begin(who, 'tower', 10); r = await won(who); assert.equal(total(r.data.state), 2); assert.equal(r.data.state.activities.lastResult.gearDrops.length, 1);
    });

    await test('Previously settled legacy results are not paid retroactively; an old unsettled run can earn its one new drop', async () => {
      const old = await account('legacy-result'); await begin(old); await won(old);
      patch(old, state => { delete state.equipment; delete state.activities.lastResult.gearDrops; delete state.activities.lastResult.gearPending; for (const event of state.events) { delete event.gearDrops; delete event.gearPending; } });
      const legacyResult = G.clone(saved(old).activities.lastResult), beforeGold = saved(old).gold;
      const first = await call(old, 'state'); assert.equal(first.status, 200); assert.equal(total(first.data.state), 0); assert.deepEqual(first.data.state.activities.lastResult, legacyResult); assert.equal(first.data.state.gold, beforeGold);
      assert.equal((await act(old, { kind: 'activity-exit' })).status, 200); assert.equal(total(saved(old)), 0);
      const pending = await account('legacy-run'); await begin(pending); patch(pending, state => { delete state.equipment; }); const ready = await won(pending); assert.equal(total(ready.data.state), 1); assert.equal((await call(pending, 'state')).status, 200); assert.equal(total(saved(pending)), 1);
    });

    await test('An extreme capped item stack cannot corrupt a completed run or repay its other rewards on retry', async () => {
      const who = await account('overflow'), id = item(saved(who), 'weapon'); fund(who, id, 1000000000, 5); await begin(who); prepareWin(who); const before = saved(who);
      const rolled = await secure(0, () => call(who, 'state')); assert.equal(rolled.value.status, 200); const state = rolled.value.data.state, drop = state.activities.lastResult.gearDrops[0];
      assert.equal(drop.item, id); assert.equal(drop.count, 0); assert.equal(drop.overflow, true); assert.equal(drop.stars, 5); assert.equal(state.equipment.inventory[id].count, 1000000000); assert.equal(state.gold, before.gold + G.activityReward('daily', 1).gold); assert.equal(state.activities.run.settled, true); assert.ok(G.validate(saved(who)));
      const again = await secure(0xffffffff, () => call(who, 'state')); assert.equal(again.value.status, 200); assert.equal(again.reads, 0); assert.equal(again.value.data.state.gold, state.gold); assert.deepEqual(again.value.data.state.activities.lastResult, state.activities.lastResult);
    });

    await test('Gear keeps hero progression dominant and does not change critical chance, damage reduction or skill timings', async () => {
      const baseState = G.create(now), definitions = items(baseState); assert.equal(definitions.length, 13); assert.deepEqual([...new Set(definitions.map(i => i.slot))].sort(), ['armor', 'charm', 'weapon']);
      let highestAtk = 1, highestHp = 1, highestPower = 1, grownAtk = 1, grownHp = 1, grownPower = 1;
      for (const hero of G.HEROES) for (const level of [1, 50, 100]) for (const stars of [0, 5]) {
        const s = G.create(now); s.units[hero.id] = { level, stars, xp: 0, shards: 0 }; s.team = [hero.id]; s.equipment.equipped[hero.id] = {};
        for (const slot of ['weapon', 'armor', 'charm']) { const id = item(s, slot, 'SSR'); s.equipment.inventory[id] = { count: 1, stars: 5 }; s.equipment.equipped[hero.id][slot] = id; }
        const bare = G.stats(hero.id, s.units[hero.id]), geared = G.stats(hero.id, s.units[hero.id], s), base = G.clone(s); base.equipment = { inventory: {}, equipped: {} };
        assert.ok(geared.atk >= bare.atk && geared.atk <= Math.round(bare.atk * 1.09) + 1); assert.ok(geared.hp >= bare.hp && geared.hp <= Math.round(bare.hp * 1.14) + 1); assert.equal(geared.defense, bare.defense); assert.equal(geared.critChance, bare.critChance); assert.equal(geared.critMultiplier, bare.critMultiplier);
        highestAtk = Math.max(highestAtk, geared.atk / bare.atk); highestHp = Math.max(highestHp, geared.hp / bare.hp); highestPower = Math.max(highestPower, G.power(s) / G.power(base));
        if (level >= 50) { grownAtk = Math.max(grownAtk, geared.atk / bare.atk); grownHp = Math.max(grownHp, geared.hp / bare.hp); grownPower = Math.max(grownPower, G.power(s) / G.power(base)); }
        const bonus = G.equipmentBonus(s, hero.id); assert.ok(bonus.atk <= .090001); assert.ok(bonus.hp <= .140001);
      }
      console.log('BALANCE max rounded ratios', JSON.stringify({ allLevels: { attack: +highestAtk.toFixed(4), hp: +highestHp.toFixed(4), power: +highestPower.toFixed(4) }, level50plus: { attack: +grownAtk.toFixed(4), hp: +grownHp.toFixed(4), power: +grownPower.toFixed(4) } }));
    });

    await test('Presets retain per-hero loadouts, farming fingerprints follow effective gear, and fresh battles use upgraded gear', async () => {
      const who = await account('preset-farm'), id = item(saved(who), 'weapon'); fund(who, id, 3);
      assert.equal((await act(who, { kind: 'preset-save', slot: 0 })).status, 200); const initial = G.farmingFingerprint(saved(who));
      assert.equal((await equip(who, 'taeo', id)).status, 200); const worn = G.farmingFingerprint(saved(who)); assert.notEqual(worn, initial); assert.equal((await awaken(who, id)).status, 200); assert.notEqual(G.farmingFingerprint(saved(who)), worn);
      const gear = G.clone(saved(who).equipment); assert.equal((await act(who, { kind: 'team', team: ['sua', 'harin', 'taeo'] })).status, 200); assert.equal((await act(who, { kind: 'preset-apply', slot: 0, equipment: { inventory: {}, equipped: {} } })).status, 200); assert.deepEqual(saved(who).equipment, gear);
      const state = saved(who), hero = state.battle.heroes.find(h => h.id === 'taeo'); assert.equal(hero.atk, G.stats('taeo', state.units.taeo, state).atk); assert.equal(hero.max, G.stats('taeo', state.units.taeo, state).hp);
      const before = JSON.stringify(state); G.simulateFarmingStage(state, G.farmingCandidates(state)[0]); assert.equal(JSON.stringify(state), before, 'analysis cannot award or consume actual gear');
    });

    await test('All resulting server saves validate and reconnect preserves equipment without leaking private receipts', async () => {
      for (const record of t.sqlite.prepare('SELECT payload FROM school_saves').all()) assert.ok(G.validate(JSON.parse(record.payload)));
      const who = await account('privacy'), id = item(saved(who), 'charm', 'SR'); fund(who, id, 2, 3); await equip(who, 'sua', id); const before = saved(who).equipment;
      const again = (await t.login('equipment-security-privacy')).data, read = await call(again, 'state'); assert.equal(read.status, 200); assert.deepEqual(read.data.state.equipment, before); assert.ok(!('receipts' in read.data.state)); assert.ok(!JSON.stringify(read.data.state).includes(who.token)); assert.deepEqual(t.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    });
    console.log(`${passed} equipment server/security checks passed`);
  } finally { Date.now = realNow; crypto.getRandomValues = realRandom; t.sqlite.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
