const assert = require('node:assert/strict');
const G = require('../school/engine.js');
let passed = 0;
function test(name, body) { body(); passed++; console.log('PASS', name); }
function run(s, seconds) { for (let i = 0; i < seconds; i++) G.advance(s, s.at + 1000); }
test('Automatic combat wins, grants XP, unlocks stages and stays deterministic across reload', () => {
  const a = G.create(1000, 287), b = G.clone(a); run(a, 120); G.advance(b, 61000); const c = G.clone(b); G.advance(c, 121000);
  assert.deepEqual(a, c); assert.ok(a.best >= 1); assert.ok(a.units.harin.level > 1); assert.ok(a.gold > 700); assert.ok(a.gems > 1800);
});
test('Offline rewards cap at eight hours, never skip stages, and cannot be claimed twice', () => {
  const s = G.create(1000); const best = s.best; G.advance(s, 1000 + 48 * 3600000);
  assert.equal(s.offline.seconds, 28800); assert.equal(s.offline.gold, 9600); assert.equal(s.best, best);
  G.advance(s, s.at + 9 * 3600000); assert.equal(s.offline.seconds, 28800);
  const before = s.gold, reward = G.action(s, {kind:'offline'}); assert.equal(s.gold, before + reward.reward.gold);
  const snapshot = G.clone(s); assert.throws(() => G.action(s, {kind:'offline'})); assert.deepEqual(s, snapshot);
});
test('Exactly 90 seconds simulate battle; longer absences bank rewards; backward clocks give nothing', () => {
  const a = G.create(1000), b = G.create(1000); G.advance(a, 91000); G.advance(b, 92000);
  assert.equal(a.offline.seconds, 0); assert.equal(b.offline.seconds, 91);
  const old = G.clone(b); G.advance(b, 0); assert.deepEqual(b, old);
});
test('SSR pity triggers on the fortieth miss and resets; 10 pulls guarantee SR+', () => {
  const s = G.create(1000); s.gems = 5000; for (let i = 0; i < 39; i++) G.action(s, {kind:'recruit',count:1}, 1000, () => .9);
  assert.equal(s.pity, 39); const result = G.action(s, {kind:'recruit',count:1},1000, () => .9);
  assert.equal(G.BY_ID[result.results[0].id].rarity, 'SSR'); assert.equal(s.pity, 0);
  const t = G.create(1000), ten = G.action(t, {kind:'recruit',count:10},1000, () => .9);
  assert.equal(ten.results.length, 10); assert.equal(t.gems, 900); assert.equal(ten.results.filter(r => G.BY_ID[r.id].rarity !== 'R').length, 1);
});
test('Boundary rolls use the documented 4/26/70 probabilities and every hero is obtainable', () => {
  const obtained = new Set();
  for (const [roll, rarity] of [[0,'SSR'],[.039999,'SSR'],[.04,'SR'],[.299999,'SR'],[.3,'R'],[.999999,'R']]) {
    const pool = G.HEROES.filter(h => h.rarity === rarity);
    for (let j = 0; j < pool.length; j++) { const s = G.create(1000), values = [roll,(j+.5)/pool.length]; const r = G.action(s,{kind:'recruit',count:1},1000,()=>values.shift()); assert.equal(G.BY_ID[r.results[0].id].rarity,rarity); obtained.add(r.results[0].id); }
  }
  assert.equal(obtained.size,13); assert.ok(obtained.has('osia'));
});
test('Duplicates award shards and awakening spends exact shards without consuming the hero', () => {
  const s = G.create(1000); s.gems = 1000; G.action(s,{kind:'recruit',count:1},1000,()=>.9); G.action(s,{kind:'recruit',count:1},1000,()=>.9); G.action(s,{kind:'recruit',count:1},1000,()=>.9);
  const id='jiho'; assert.equal(s.units[id].shards,10); const old = G.stats(id,s.units[id]); G.action(s,{kind:'awaken',hero:id}); assert.equal(s.units[id].shards,0); assert.equal(s.units[id].stars,1); assert.ok(G.stats(id,s.units[id]).hp > old.hp);
  const copy=G.clone(s); assert.throws(()=>G.action(s,{kind:'awaken',hero:id})); assert.deepEqual(s,copy);
});
test('Illegal costs, locked stages, unknown heroes and duplicate teams do not mutate progress', () => {
  const s=G.create(1000); s.gold=0;s.gems=0;
  for(const intent of [{kind:'train',hero:'harin'},{kind:'recruit',count:10},{kind:'recruit',count:-1},{kind:'train',hero:'constructor'},{kind:'stage',stage:30,mode:'progress'},{kind:'team',team:['harin','harin','sua']},{kind:'team',team:['taeo','harin','lumi']},{kind:'reward',gold:100000}]) { const old=G.clone(s);assert.throws(()=>G.action(s,intent));assert.deepEqual(s,old); }
});
test('Training costs and level caps; team swaps start a fresh battle and never duplicate a hero',()=>{
  const s=G.create(1000); const cost=G.trainingCost(s.units.harin); G.action(s,{kind:'train',hero:'harin'});assert.equal(s.gold,700-cost);assert.equal(s.units.harin.level,2);
  G.action(s,{kind:'team',team:['harin','taeo','sua']});assert.equal(s.battle.heroes[0].max,G.stats('harin',s.units.harin).hp);
  s.units.harin.level=60; assert.throws(()=>G.action(s,{kind:'train',hero:'harin'}));
});
test('Each of thirteen heroes performs their automatic skill; damage and healing stay bounded',()=>{
  for(const hero of G.HEROES){
    const s=G.create(1000,21);s.units[hero.id]={level:1,xp:0,stars:0,shards:0};s.team=[hero.id,...['taeo','harin','sua'].filter(id=>id!==hero.id)].slice(0,3);
    G.action(s,{kind:'stage',stage:1,mode:'farm'});
    for(const e of s.battle.enemies){e.hp=e.max=100000;e.atk=1;} for(const h of s.battle.heroes)h.hp=Math.floor(h.max*.75);
    run(s,8);assert.ok(s.events.some(e=>e.kind==='skill'&&e.from===hero.id),hero.id);
    assert.ok(s.battle.heroes.every(h=>h.hp>=0&&h.hp<=h.max&&h.shield>=0));
    if(hero.role==='치유') assert.ok(s.events.some(e=>e.kind==='heal'&&e.from===hero.id));
    if(hero.role==='수호') assert.ok(s.events.some(e=>e.kind==='guard'&&e.to===hero.id));
  }
});
test('Osia is a permanent SSR, can be drawn by natural roll or pity, and duplicates awaken normally',()=>{
  const s=G.create(1000); const old=G.clone(s); assert.ok(G.validate(old));
  const values=[.01,.99,.01,.99];const roll=()=>values.shift();
  const first=G.action(s,{kind:'recruit',count:1},1000,roll);assert.equal(first.results[0].id,'osia');assert.equal(first.results[0].fresh,true);
  const second=G.action(s,{kind:'recruit',count:1},1000,roll);assert.equal(second.results[0].id,'osia');assert.equal(second.results[0].shards,20);
  G.action(s,{kind:'awaken',hero:'osia'});assert.equal(s.units.osia.stars,1);assert.equal(s.units.osia.shards,10);
  s.pity=39;const forced=G.action(s,{kind:'recruit',count:1},1000,()=>.99);assert.equal(forced.results[0].id,'osia');assert.equal(forced.results[0].pity,true);assert.equal(s.pity,0);
  G.action(s,{kind:'team',team:['taeo','osia','sua']});G.action(s,{kind:'train',hero:'osia'});assert.equal(s.units.osia.level,2);assert.ok(G.validate(G.clone(s)));
  assert.equal(G.HEROES.filter(h=>h.rarity==='SSR').length,3);assert.equal(G.RECRUIT_RATES.SSR,.04);
});
test('Osia hits each living enemy once at 220% on the fifth second; water events survive save/reload',()=>{
  const s=G.create(1000,26);s.units.osia={level:1,xp:0,stars:0,shards:0};G.action(s,{kind:'team',team:['taeo','osia','sua']});
  for(const e of s.battle.enemies){e.hp=e.max=100000;e.atk=1;}run(s,4);
  assert.ok(!s.events.some(e=>e.kind==='skill'&&e.from==='osia'));
  const loaded=G.clone(s);run(s,1);run(loaded,1);assert.deepEqual(s,loaded);
  const hits=s.events.filter(e=>e.from==='osia'&&e.kind==='hit'&&e.skill);assert.equal(hits.length,3);assert.equal(new Set(hits.map(e=>e.to)).size,3);
  assert.ok(hits.every(e=>e.element==='water'&&e.amount>=40&&e.amount<=73));assert.ok(s.events.some(e=>e.kind==='skill'&&e.from==='osia'&&e.name==='용왕의 해일'));
  assert.equal(s.battle.heroes.find(h=>h.id==='osia').energy,0);
});
test('Korean midnight daily reset and one-time quests cannot pay twice',()=>{
  const s=G.create(1000), time=Date.UTC(2026,10,17,14,59,59);G.action(s,{kind:'daily'},time);assert.throws(()=>G.action(s,{kind:'daily'},time));G.action(s,{kind:'daily'},time+1000);
  s.best=1;G.action(s,{kind:'quest',quest:'first'});assert.throws(()=>G.action(s,{kind:'quest',quest:'first'}));assert.throws(()=>G.action(s,{kind:'quest',quest:'graduation'}));
});
test('Three failed bosses fall back even when normal waves between bosses were won',()=>{
  const s=G.create(1000);s.best=1;s.stage=2;s.wave=4;
  for(let i=0;i<3;i++){
    if(i){s.battle.phase='fight';s.battle.boss=false;s.battle.enemies.forEach(e=>e.hp=0);run(s,1);run(s,3);}
    s.battle.phase='fight';s.battle.boss=true;s.battle.heroes.forEach(h=>h.hp=0);run(s,1);
  }
  assert.equal(s.mode,'farm');assert.equal(s.stage,1);
});
test('Long simulations remain finite and preserve combat, economy and progression bounds',()=>{
  for(let seed=1;seed<=25;seed++){
    const s=G.create(1000,seed);run(s,3600);
    assert.ok(G.validate(s));assert.ok(s.best>5&&s.best<30);assert.ok(s.gold>=0&&s.gems>=0);assert.ok(s.events.length<=50);assert.ok(s.logs.length<=14);
    assert.ok(s.battle.heroes.concat(s.battle.enemies).every(h=>Number.isFinite(h.hp)&&h.hp>=0&&h.hp<=h.max));
  }
});
console.log(`${passed} school engine checks passed`);
