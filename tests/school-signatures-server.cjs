const assert = require('node:assert/strict');
const { fixture } = require('./account-fixture.cjs');
const G = require('../school/engine.js');

(async () => {
  const t = await fixture(), realNow = Date.now, realRandom = crypto.getRandomValues;
  let now = Date.parse('2026-11-18T12:00:00+09:00'), sequence = 0, passed = 0;
  Date.now = () => now;
  const compiled=process.env.SCHOOL_TEST_BUNDLE?(await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default:null;
  const call = async (who, route, data = {}) => {
    if(!compiled)return t.call('/api/school/' + route, { catalogVersion: G.CATALOG_VERSION, ...data }, null, who ? { 'X-Account-Session': who.token } : {});
    const response=await compiled.fetch(new Request('https://card.example/api/school/'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://motracv.github.io',...(who?{'X-Account-Session':who.token}:{})},body:JSON.stringify({catalogVersion:G.CATALOG_VERSION,...data})}),t.env);
    return {status:response.status,data:await response.json()};
  };
  const social = (who, kind, data = {}) => call(who, 'social', { kind, ...data });
  const row = who => t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id);
  const saved = who => JSON.parse(row(who).payload);
  // Only this trusted fixture helper writes server saves. Every hostile input
  // below is submitted through the real authenticated Worker route.
  const patch = (who, change) => { const state = saved(who); change(state); assert.ok(G.validate(state), 'valid trusted equipment fixture'); t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(state), who.profile.id); };
  const key = () => 'signature-request-' + String(++sequence).padStart(6, '0');
  const intent = (who, action, requestId = key()) => ({ revision: row(who).revision, requestId, action });
  const act = (who, action) => call(who, 'action', intent(who, action));
  const account = async name => { const r = await t.login('signature-security-' + name); assert.equal(r.status, 200); const who = r.data; assert.equal((await call(who, 'state')).status, 200); return who; };
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
    await test('Authenticated current-catalog weapon intents reject obsolete clients and hostile fields',async()=>{
      const a=await account('catalog'),b=await account('other'),before=row(a),foreign=row(b);
      const request=intent(a,{kind:'weapon-recruit',banner:'horas',count:1});
      assert.equal((await call(null,'action',request)).status,401);
      assert.equal((await call(a,'action',{...request,catalogVersion:16})).status,426);
      assert.equal(row(a).payload,before.payload);
      const r=await secure(0,()=>call(a,'action',{...request,accountId:b.profile.id,action:{...request.action,cost:0,results:[{item:'lava_fan'}],pity:79,gems:1e9,equipment:{inventory:{lava_fan:{count:1e9,stars:5}}}}}));
      assert.equal(r.value.status,200);assert.equal(r.reads,1);assert.equal(r.value.data.result.cost,100);
      assert.equal(saved(a).gems,1700);assert.deepEqual(saved(a).equipment.inventory,{horas_orbit:{count:1,stars:0}});assert.equal(row(b).payload,foreign.payload);
      assert(!('receipts' in r.value.data.state));
    });
    await test('Server RNG is private, obeys selected hard pity, and shares only permanent weapon progress',async()=>{
      const a=await account('pity');patch(a,s=>{s.weaponBanners.standard.pity=78;s.banners.osia={pity:55,guaranteed:true};s.pity=55;});
      const a1=await secure(0xffffffff,()=>act(a,{kind:'weapon-recruit',banner:'osia',count:1,random:0}));assert.equal(a1.value.data.result.results[0].item,'chalk_star');assert.equal(saved(a).weaponBanners.standard.pity,79);
      const a2=await secure(0xffffffff,()=>act(a,{kind:'weapon-recruit',banner:'lava',count:1}));assert.equal(a2.value.data.result.results[0].item,'lava_fan');assert.equal(saved(a).weaponBanners.standard.pity,0);assert.equal(saved(a).weaponBanners.limited.pity,0);assert.equal(saved(a).pulls,0);assert.deepEqual(saved(a).banners.osia,{pity:55,guaranteed:true});
      const again=(await t.login('signature-security-pity')).data,r=await call(again,'state');assert.deepEqual(r.data.state.weaponHistory,saved(a).weaponHistory);assert.equal(r.data.state.gems,1600);
    });
    await test('Five concurrent duplicate requests and a new login charge exactly once with one result',async()=>{
      const a=await account('race');patch(a,s=>{s.gems=1000;s.weaponBanners.limited.pity=79;});const input=intent(a,{kind:'weapon-recruit',banner:'horas',count:10});
      const all=await Promise.all(Array.from({length:5},()=>call(a,'action',input)));assert(all.every(r=>r.status===200),JSON.stringify(all));assert(all.every(r=>JSON.stringify(r.data.result)===JSON.stringify(all[0].data.result)));
      assert.equal(saved(a).gems,0);assert.equal(saved(a).weaponPulls,10);assert.equal(total(saved(a)),10);assert.equal(saved(a).equipment.inventory.horas_orbit.count>=1,true);
      const again=(await t.login('signature-security-race')).data,r=await call(again,'action',input);assert.equal(r.status,200);assert.equal(r.data.repeated,true);assert.equal(r.data.state.weaponPulls,10);
    });
    await test('Different simultaneous requests cannot both spend the final ten-pull balance',async()=>{
      const a=await account('different');patch(a,s=>{s.gems=1000;});const requests=['osia','lava'].map(banner=>intent(a,{kind:'weapon-recruit',banner,count:10}));const r=await Promise.all(requests.map(q=>call(a,'action',q)));assert.deepEqual(r.map(x=>x.status).sort(),[200,409]);assert.equal(saved(a).gems,0);assert.equal(total(saved(a)),10);
    });
    await test('Lost commit response recovers the original weapon roll without spending or rerolling',async()=>{
      const a=await account('lost');const input=intent(a,{kind:'weapon-recruit',banner:'osia',count:1});
      const r=await secure(0,()=>loseWriteResponse(()=>call(a,'action',input)));assert.equal(r.value.status,503);assert.equal(saved(a).gems,1700);assert.equal(saved(a).equipment.inventory.osia_scepter.count,1);
      const retry=await secure(0xffffffff,()=>call(a,'action',input));assert.equal(retry.value.status,200);assert.equal(retry.value.data.repeated,true);assert.equal(retry.reads,0);assert.equal(retry.value.data.result.results[0].item,'osia_scepter');assert.equal(saved(a).weaponPulls,1);
    });
    await test('Invalid counts, IDs and insufficient currency never charge or consume RNG',async()=>{
      const a=await account('invalid');patch(a,s=>{s.gems=99;});
      for(const action of [{kind:'weapon-recruit',banner:'osia',count:1},{kind:'weapon-recruit',banner:'osia',count:10},{kind:'weapon-recruit',banner:'__proto__',count:1},{kind:'weapon-recruit',banner:'constructor',count:1},{kind:'weapon-recruit',banner:'osia',count:-1},{kind:'weapon-recruit',banner:'osia',count:'1'}]){
        const before=row(a),r=await secure(0,()=>act(a,action));assert.equal(r.value.status,400);assert.equal(r.reads,0);assert.equal(row(a).payload,before.payload);assert.equal(row(a).revision,before.revision);
      }
      patch(a,s=>{s.gems=1000;s.equipment.inventory.chalk_star={count:G.GEAR_MAX_COUNT,stars:5};});const before=row(a),r=await secure(0xffffffff,()=>act(a,{kind:'weapon-recruit',banner:'osia',count:10}));assert.equal(r.value.status,400);assert.equal(row(a).payload,before.payload);
    });
    await test('Equipped signature survives logout, only surplus copies awaken, and active battle stays sealed',async()=>{
      const a=await account('equipped');patch(a,s=>{s.units.lava={level:100,stars:5,xp:0,shards:0};s.equipment.inventory.lava_fan={count:3,stars:0};});
      assert.equal((await equip(a,'lava','lava_fan')).status,200);assert.equal((await act(a,{kind:'team',team:['lava']})).status,200);assert.equal(saved(a).battle.heroes[0].exclusive.strength,.1);const battle=G.clone(saved(a).battle);
      assert.equal((await awaken(a,'lava_fan')).status,200);assert.deepEqual(saved(a).battle,battle);assert.equal(saved(a).equipment.inventory.lava_fan.stars,1);
      const again=(await t.login('signature-security-equipped')).data;assert.equal((await call(again,'state')).data.state.equipment.equipped.lava.weapon,'lava_fan');assert.equal(G.exclusivePassive(saved(a),'lava').stars,1);
    });
    await test('Server time closes the limited weapon at the KST boundary; replay remains idempotent after closing',async()=>{
      const a=await account('expiry');now=G.WEAPON_BANNERS.horas.expiresAt-1;patch(a,s=>{s.at=now;s.weaponBanners.limited.pity=79;});const input=intent(a,{kind:'weapon-recruit',banner:'horas',count:1});assert.equal((await call(a,'action',input)).status,200);now++;
      assert.equal((await call(a,'action',input)).data.repeated,true);const before=row(a),closed=await act(a,{kind:'weapon-recruit',banner:'horas',count:1,now:now-9999999});assert.equal(closed.status,400);assert.equal(row(a).payload,before.payload);
      assert.equal((await act(a,{kind:'weapon-recruit',banner:'lava',count:1})).status,200);assert.equal((await act(a,{kind:'recruit',banner:'lava',count:1})).status,200);
    });
    console.log(`${passed} signature SQLite security groups passed`);
  }finally{Date.now=realNow;crypto.getRandomValues=realRandom;t.sqlite.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
