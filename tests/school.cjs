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
test('SSR pity triggers on the eightieth draw and resets; 10 pulls guarantee SR+', () => {
  const s = G.create(1000); s.gems = 10000; for (let i = 0; i < 79; i++) G.action(s, {kind:'recruit',count:1}, 1000, () => .9);
  assert.equal(s.pity, 79); const result = G.action(s, {kind:'recruit',count:1},1000, () => .9);
  assert.equal(G.BY_ID[result.results[0].id].rarity, 'SSR'); assert.equal(s.pity, 0);
  const t = G.create(1000), ten = G.action(t, {kind:'recruit',count:10},1000, () => .9);
  assert.equal(ten.results.length, 10); assert.equal(t.gems, 900); assert.equal(ten.results.filter(r => G.BY_ID[r.id].rarity !== 'R').length, 1);
});
test('Soft pity starts exactly at draw 60, rises one percentage point, and caps at an SSR on 80',()=>{
  for(const [misses,expected] of [[0,.04],[39,.04],[58,.04],[59,.05],[60,.06],[69,.15],[78,.24],[79,1]]){
    const rates=G.recruitRates(misses);assert.equal(rates.SSR,expected);assert.ok(Math.abs(rates.SSR+rates.SR+rates.R-1)<1e-12);
    if(misses<79)assert.equal(rates.SR,.26);else assert.deepEqual(rates,{SSR:1,SR:0,R:0});
  }
  const s=G.create(1000);s.pity=39;G.action(s,{kind:'recruit',count:1},1000,()=>.99);assert.equal(s.pity,40);assert.ok(G.validate(s));
  for(const [misses,roll,grade] of [[58,.045,'SR'],[59,.045,'SSR'],[59,.05,'SR'],[78,.23999,'SSR'],[78,.24,'SR'],[79,.99999,'SSR']]){
    const a=G.create(1000);a.pity=misses;let n=0;const r=G.action(a,{kind:'recruit',count:1},1000,()=>++n%2?roll:.99);
    assert.equal(G.BY_ID[r.results[0].id].rarity,grade);assert.equal(r.results[0].ssrChance,G.recruitRates(misses).SSR);
  }
});
test('Ten-pulls update soft pity per slot, reset immediately on SSR, and preserve guarantees',()=>{
  const s=G.create(1000);s.pity=58;const r=G.action(s,{kind:'recruit',count:10},1000,()=>.99);
  assert.deepEqual(r.results.map(x=>x.ssrChance),[.04,.05,.06,.07,.08,.09,.10,.11,.12,.13]);assert.equal(s.pity,68);assert.ok(r.results.some(x=>G.BY_ID[x.id].rarity==='SR'));
  const hard=G.create(1000);hard.pity=78;const h=G.action(hard,{kind:'recruit',count:10},1000,()=>.99);
  assert.equal(h.results[0].ssrChance,.24);assert.equal(h.results[1].pity,true);assert.equal(h.results[1].ssrChance,1);assert.equal(h.results[2].ssrChance,.04);assert.equal(hard.pity,8);
  const reset=G.create(1000);reset.pity=59;let i=0;const q=G.action(reset,{kind:'recruit',count:10},1000,()=>++i%2?.049:.99);
  assert.equal(G.BY_ID[q.results[0].id].rarity,'SSR');assert.equal(q.results[0].ssrChance,.05);assert.ok(q.results.slice(1).every(x=>x.ssrChance===.04&&G.BY_ID[x.id].rarity==='SR'));assert.equal(reset.pity,9);
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
  s.pity=79;const forced=G.action(s,{kind:'recruit',count:1},1000,()=>.99);assert.equal(forced.results[0].id,'osia');assert.equal(forced.results[0].pity,true);assert.equal(s.pity,0);
  G.action(s,{kind:'team',team:['taeo','osia','sua']});G.action(s,{kind:'train',hero:'osia'});assert.equal(s.units.osia.level,2);assert.ok(G.validate(G.clone(s)));
  assert.equal(G.HEROES.filter(h=>h.rarity==='SSR').length,3);assert.equal(G.RECRUIT_RATES.SSR,.04);
});
function osiaBattle(boss = false) {
  const s=G.create(1000,26);s.units.osia={level:1,xp:0,stars:0,shards:0};G.action(s,{kind:'team',team:['taeo','osia','sua']});
  for(const h of s.battle.heroes){h.hp=h.id==='osia'?10000:0;h.max=10000;}
  if(boss){s.battle.boss=true;s.battle.enemies=s.battle.enemies.slice(0,1);s.battle.enemies[0].boss=true;}
  for(const e of s.battle.enemies){e.hp=e.max=100000;e.atk=1;}return s;
}
test('One Osia cast deals four progressively stronger hits at 0/.5/1/1.5s, totaling the original 220% roll',()=>{
  const s=osiaBattle();run(s,4);assert.ok(!s.events.some(e=>e.kind==='skill'&&e.from==='osia'));
  run(s,1);const cast=G.clone(s.battle.osiaCast),hits=[];
  for(let stage=1;stage<=4;stage++){
    if(stage>1)G.advance(s,s.at+500);
    const part=s.events.filter(e=>e.kind==='hit'&&e.castId===cast.id&&e.stage===stage);hits.push(part);
    assert.equal(part.length,3);assert.ok(part.every(e=>e.element==='water'&&e.at===6000+(stage-1)*500));
    assert.equal(s.events.filter(e=>e.kind==='skill'&&e.from==='osia').length,1);
    if(stage<4)assert.ok(s.battle.enemies.every(e=>!e.stunUntil));
  }
  for(const target of cast.targets){const amounts=hits.map(list=>list.find(e=>e.to===target.id).amount);assert.equal(amounts.reduce((a,b)=>a+b,0),target.total);assert.ok(amounts.every((v,i)=>i===0||v>amounts[i-1]));assert.ok(target.total>=40&&target.total<=73);}
  assert.equal(s.battle.osiaCast,undefined);assert.equal(G.BY_ID.osia.passive,'용왕의 권능');
});
test('Final water dragon stuns every surviving target including bosses for exactly 1500ms and prevents attacks',()=>{
  for(const boss of [false,true]){
    const s=osiaBattle(boss);G.advance(s,7500);assert.equal(s.battle.elapsed,6500);
    assert.ok(s.battle.enemies.every(e=>e.stunUntil===8000));
    for(const elapsed of [7000,7500]){G.advance(s,s.at+500);assert.ok(s.battle.enemies.every(e=>e.stunUntil>s.battle.elapsed));assert.equal(s.battle.elapsed,elapsed);assert.ok(!s.events.some(e=>e.kind==='hit'&&e.side==='hero'&&e.at===s.at));}
    G.advance(s,s.at+500);assert.equal(s.battle.elapsed,8000);assert.ok(s.battle.enemies.every(e=>e.stunUntil<=s.battle.elapsed));assert.equal(s.events.filter(e=>e.kind==='hit'&&e.side==='hero'&&e.at===s.at).length,boss?1:3);
  }
});
test('Mid-combo and stunned saves reload identically; large and half-second advances have identical outcomes',()=>{
  const a=osiaBattle(),b=G.clone(a);G.advance(a,a.at+5500);const loaded=G.clone(a);
  G.advance(a,a.at+1000);for(let i=0;i<2;i++)G.advance(loaded,loaded.at+500);assert.deepEqual(a,loaded);
  const stunned=G.clone(a);G.advance(a,a.at+3500);G.advance(stunned,stunned.at+3500);assert.deepEqual(a,stunned);
  for(let i=0;i<20;i++)G.advance(b,b.at+500);assert.deepEqual(a,b);
  const old=osiaBattle();G.advance(old,old.at+4000);delete old.battle.elapsed;delete old.battle.id;assert.ok(G.validate(old));G.advance(old,old.at+500);assert.equal(old.battle.elapsed,4500);assert.ok(old.battle.id);
});
test('Caster death, early victory and changing party cancel the combo instead of hitting the next wave',()=>{
  const dead=osiaBattle();run(dead,5);dead.battle.heroes.find(h=>h.id==='osia').hp=0;G.advance(dead,dead.at+500);assert.equal(dead.battle.osiaCast,undefined);assert.ok(!dead.events.some(e=>e.kind==='skill-stage'&&e.stage===2));
  const win=osiaBattle();run(win,5);win.battle.enemies.forEach(e=>e.hp=1);G.advance(win,win.at+500);assert.equal(win.battle.phase,'victory');assert.equal(win.battle.osiaCast,undefined);G.advance(win,win.at+2000);assert.ok(win.battle.enemies.every(e=>e.hp===e.max&&!e.stunUntil));
  const swap=osiaBattle();run(swap,5);const prior=swap.battle.id;G.action(swap,{kind:'team',team:['osia','taeo','sua']});assert.notEqual(swap.battle.id,prior);G.advance(swap,swap.at+500);assert.equal(swap.battle.osiaCast,undefined);assert.ok(swap.battle.enemies.every(e=>e.hp===e.max));
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
