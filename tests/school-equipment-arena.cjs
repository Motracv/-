const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { fixture } = require('./account-fixture.cjs');
const G = require('../school/engine.js');

(async () => {
  assert.ok(G.GEAR && G.snapshotEquipment, 'Equipment engine must be available');
  const { simulateArena } = await import('../online/arena.mjs');
  const weapon = G.GEAR.find(item => item.rarity === 'SSR' && item.slot === 'weapon');
  const armor = G.GEAR.find(item => item.rarity === 'SSR' && item.slot === 'armor');
  const charm = G.GEAR.find(item => item.rarity === 'SSR' && item.slot === 'charm');
  const unused = G.GEAR.find(item => item.rarity === 'R' && item.slot === 'weapon');
  assert.ok(weapon && armor && charm && unused);
  const team = ['taeo', 'geonu', 'doyoon', 'horas', 'osia', 'lava'];
  const saved = (members = team, level = 50, stars = 3) => {
    const s = G.create(1); s.team = members;
    for (const id of members) s.units[id] = { level, stars, xp: 0, shards: 0 };
    return s;
  };
  function addGear(s, stars = 0) {
    s.units.harin ||= { level: 1, stars: 0, xp: 0, shards: 0 };
    s.equipment = {
      inventory: { [weapon.id]: { count: 27, stars }, [armor.id]: { count: 19, stars }, [charm.id]: { count: 15, stars }, [unused.id]: { count: 777, stars: 0 } },
      equipped: { horas: { weapon: weapon.id, armor: armor.id, charm: charm.id }, osia: { weapon: weapon.id }, harin: { weapon: unused.id } },
    };
  }
  let passed = 0;
  const test = async (name, run) => { await run(); passed++; console.log('PASS', name); };
  await test('All 29 pre-equipment arena fixtures remain byte-for-byte unchanged', () => {
    const originals = [saved(['taeo', 'geonu', 'doyoon', 'osia', 'lava', 'nari']), saved(['geonu', 'ian', 'osia', 'lumi', 'nari', 'lava'])];
    const hash = createHash('sha256').update(JSON.stringify(Array.from({ length: 29 }, (_, index) => simulateArena(G, originals, ['a', 'b'], index + 1)))).digest('hex');
    assert.equal(hash, '2677356553a2fafae3d974b1960ddbbf16ef90704b6f4e30663afd6484b2bc7b');
    const bare = [saved(), saved()], unusedOnly = G.clone(bare);
    unusedOnly[0].equipment = { inventory: { [weapon.id]: { count: 99, stars: 1 } }, equipped: {} };
    assert.deepEqual(simulateArena(G, unusedOnly, ['a', 'b'], 42), simulateArena(G, bare, ['a', 'b'], 42));
  });
  await test('Arena uses equipped stats and copies only the worn formation loadout into replay snapshots', () => {
    const a = saved(), b = saved(); addGear(a, 1);
    const before = JSON.stringify(a), snapshot = G.snapshotEquipment(a, a.team);
    const match = simulateArena(G, [a, b], ['a', 'b'], 193);
    assert.equal(JSON.stringify(a), before); assert.deepEqual(match.teams[0].equipment, snapshot); assert.equal(match.teams[1].equipment, undefined);
    assert.deepEqual(Object.keys(snapshot.inventory).sort(), [weapon.id, armor.id, charm.id].sort());
    assert.equal(snapshot.inventory[weapon.id].count, 2); assert.equal(snapshot.inventory[armor.id].count, 1); assert.equal(snapshot.inventory[charm.id].count, 1);
    assert.equal(snapshot.equipped.harin, undefined); assert.equal(snapshot.inventory[unused.id], undefined);
    for (let side = 0; side < 2; side++) for (const unit of match.teams[side].units) {
      const source = [a, b][side], expected = G.stats(unit.id, source.units[unit.id], source);
      assert.equal(unit.atk, expected.atk); assert.equal(unit.max, expected.hp * 3);
    }
    assert.ok(match.teams[0].units.find(unit => unit.id === 'horas').atk > match.teams[1].units.find(unit => unit.id === 'horas').atk);
    const sealed = JSON.stringify(match);
    a.equipment.inventory[weapon.id].stars = 0; a.equipment.equipped.horas = {};
    assert.equal(JSON.stringify(match), sealed, 'source loadout changes must not mutate a completed replay');
  });

  const t = await fixture(), realNow = Date.now;
  let now = Date.parse('2026-11-19T12:00:00+09:00'); Date.now = () => now;
  const call = (who, path, data = {}) => t.call('/api/school/' + path, { catalogVersion: G.CATALOG_VERSION, ...data }, null, who ? { 'X-Account-Session': who.token } : {});
  const api = (who, kind, data = {}) => call(who, 'social', { kind, ...data });
  const row = who => t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id = ?').get(who.profile.id);
  const patch = (who, fn) => { const s = JSON.parse(row(who).payload); fn(s); assert.equal(G.validate(s), true); t.sqlite.prepare('UPDATE school_saves SET payload = ? WHERE account_id = ?').run(JSON.stringify(s), who.profile.id); };
  const getSave = who => JSON.parse(row(who).payload);
  const people = [];
  try {
    for (let index = 0; index < 3; index++) {
      const who = (await t.login('equipment-arena-' + index)).data; let current = await call(who, 'state');
      patch(who, s => { s.team = team; for (const id of team) s.units[id] = { level: 50, stars: 3, xp: 0, shards: 0 }; });
      current = await call(who, 'action', { revision: current.data.revision, requestId: `equipment-name-${index}-0001`, action: { kind: 'rename', name: `장비단장${index}` } }); assert.equal(current.status, 200);
      const registered = await api(who, 'season_register', { seasonId: 1 }); assert.equal(registered.status, 200); assert.equal(registered.data.me.defense.equipment, undefined);
      people.push(who);
    }
    const [a, b, c] = people;
    const legacyPower = G.power(getSave(b));
    patch(a, s => addGear(s)); patch(b, s => addGear(s));
    let friendMatch, seasonMatch;
    await test('Friendly power and accepted matches use real equipped server stats without leaking either inventory', async () => {
      let result = await api(a, 'friend_request', { name: '장비단장1' }); assert.equal(result.status, 200); const friend = result.data.requests.outgoing[0].id;
      assert.equal((await api(b, 'friend_accept', { id: friend })).status, 200);
      result = await api(a, 'state'); assert.equal(result.status, 200); assert.equal(result.data.friends[0].power, G.power(getSave(b))); assert.ok(result.data.friends[0].power > legacyPower);
      assert.ok(!JSON.stringify(result.data).includes('equipment')); assert.ok(!JSON.stringify(result.data).includes(unused.id));
      result = await api(a, 'arena_invite', { id: friend, requestId: 'equipment-friendly-invite1' }); const id = result.data.invites.outgoing[0].id;
      const saves = [row(a).payload, row(b).payload];
      result = await api(b, 'arena_accept', { id, equipment: { inventory: { [weapon.id]: { count: 1, stars: 999 } } } }); assert.equal(result.status, 200); friendMatch = result.data.match;
      assert.deepEqual([row(a).payload, row(b).payload], saves);
      for (let side = 0; side < 2; side++) {
        const source = getSave([a, b][side]); assert.deepEqual(friendMatch.teams[side].equipment, G.snapshotEquipment(source, source.team));
        assert.equal(friendMatch.teams[side].equipment.inventory[weapon.id].count, 2);
        assert.equal(friendMatch.teams[side].equipment.inventory[unused.id], undefined);
      }
      assert.deepEqual((await api(a, 'arena_match', { id })).data.match.events, friendMatch.events);
    });
    await test('Legacy defense keeps its original power and bare stats until explicit registration', async () => {
      patch(a, s => addGear(s, 1)); patch(b, s => addGear(s, 1));
      const before = await api(a, 'season_state'); assert.equal(before.status, 200);
      assert.ok(before.data.me.attackPower > before.data.me.defense.power); assert.equal(before.data.me.defense.equipment, undefined);
      const peer = before.data.candidates.find(peer => peer.id === b.profile.id); assert.ok(peer); assert.equal(peer.power, legacyPower);
      const result = await api(a, 'season_attack', { seasonId: 1, targetId: b.profile.id, requestId: 'equipment-season-legacy01', equipment: { inventory: {} }, power: 1, winner: 0 }); assert.equal(result.status, 200); seasonMatch = result.data.match;
      assert.deepEqual(seasonMatch.teams[0].equipment, G.snapshotEquipment(getSave(a), team)); assert.equal(seasonMatch.teams[1].equipment, undefined);
      for (const unit of seasonMatch.teams[1].units) assert.equal(unit.max, G.stats(unit.id, getSave(b).units[unit.id]).hp * 3);
      const registered = await api(b, 'season_register', { seasonId: 1, equipment: { inventory: { [weapon.id]: { stars: 999, count: 999 } } } }); assert.equal(registered.status, 200);
      assert.equal(registered.data.me.defense.power, G.power(getSave(b)));
      assert.deepEqual(registered.data.me.defense.equipment, G.snapshotEquipment(getSave(b), team));
      const persisted = JSON.parse(t.sqlite.prepare('SELECT defense FROM school_season_entries WHERE season = 1 AND account_id = ?').get(b.profile.id).defense);
      assert.deepEqual(Object.keys(persisted).sort(), ['equipment', 'team', 'units']); assert.equal(persisted.equipment.inventory[unused.id], undefined); assert.equal(persisted.units.harin, undefined);
    });
    await test('Registered gear is immutable for later replays; public defender stats use that snapshot, not new bag state', async () => {
      const captured = JSON.parse(t.sqlite.prepare('SELECT defense FROM school_season_entries WHERE season = 1 AND account_id = ?').get(b.profile.id).defense);
      patch(b, s => { s.equipment.equipped = {}; s.equipment.inventory[weapon.id].stars = 0; });
      const attack = await api(c, 'season_attack', { seasonId: 1, targetId: b.profile.id, requestId: 'equipment-season-snapshot2' }); assert.equal(attack.status, 200);
      assert.deepEqual(attack.data.match.teams[1].equipment, captured.equipment);
      for (const unit of attack.data.match.teams[1].units) {
        const expected = G.stats(unit.id, captured.units[unit.id], captured);
        assert.equal(unit.max, expected.hp * 3); assert.equal(unit.atk, expected.atk);
      }
      const replay = await api(b, 'season_match', { id: attack.data.match.id }); assert.equal(replay.status, 200); assert.deepEqual(replay.data.match.teams, attack.data.match.teams); assert.deepEqual(replay.data.match.events, attack.data.match.events);
      const oldSeason = await api(a, 'season_match', { id: seasonMatch.id }); assert.deepEqual(oldSeason.data.match.teams, seasonMatch.teams);
      const oldFriend = await api(a, 'arena_match', { id: friendMatch.id }); assert.deepEqual(oldFriend.data.match.teams, friendMatch.teams);
      assert.equal((await api(a, 'season_match', { id: seasonMatch.id, catalogVersion: G.CATALOG_VERSION - 1 })).status, 426);
    });
    console.log(`${passed} equipment/arena checks passed`);
  } finally { Date.now = realNow; t.sqlite.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
