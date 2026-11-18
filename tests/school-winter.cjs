const assert = require('node:assert/strict');
const G = require('../school/engine.js');
const NOW = Date.parse('2026-11-18T12:00:00+09:00');
let passed = 0;
const test = (name, run) => { run(); passed++; console.log('PASS', name); };
function make(team = ['harin'], seed = 287) {
  const s = G.create(NOW, seed);
  for (const id of team) s.units[id] = {level:1,xp:0,stars:0,shards:0};
  if (JSON.stringify(team)!==JSON.stringify(s.team)) G.action(s,{kind:'team',team},NOW);
  for (const h of s.battle.heroes) h.hp=h.max=10000;
  for (const e of s.battle.enemies) {e.hp=e.max=100000; e.atk=1;}
  return s;
}
function reject(s, input, now = s.at) {
  const before=G.clone(s);assert.throws(()=>G.action(s,input,now));assert.deepEqual(s,before);
}
test('Critical probability is public and actual critical damage has a deterministic icon event',()=>{
  assert.deepEqual(G.CRITICAL,{chance:.12,multiplier:1.5});
  assert.equal(G.stats('harin',{level:1,stars:0}).critChance,.12);
  const a=make(),b=G.clone(a);a.battle.heroes[0].critChance=1;b.battle.heroes[0].critChance=0;
  G.advance(a,a.at+1000);G.advance(b,b.at+1000);
  const hit=a.events.findLast(e=>e.kind==='hit'&&e.from==='harin');
  const normal=b.events.findLast(e=>e.kind==='hit'&&e.from==='harin');
  assert.equal(hit.critical,true);assert.equal(hit.impact,'critical');assert.equal(normal.critical,false);
  assert.ok(hit.amount>normal.amount);assert.ok(Math.abs(hit.amount-normal.amount*1.5)<=1);
  assert.equal(G.damageReport(a).totals.damage,hit.amount);assert.equal(G.damageReport(a).totals.criticals,1);
});
test('Delayed water skills preserve their critical result across reload until the actual impact',()=>{
  const a=make(['osia']);a.battle.heroes[0].critChance=1;a.battle.heroes[0].energy=4;
  G.advance(a,a.at+1000);assert.ok(a.battle.osiaCast.targets.every(t=>t.critical));
  const b=G.clone(a);G.advance(a,a.at+500);G.advance(b,b.at+500);assert.deepEqual(a,b);
  const hits=a.events.filter(e=>e.kind==='hit'&&e.from==='osia');assert.equal(hits.length,3);assert.ok(hits.every(e=>e.critical&&e.skill));
  assert.equal(G.damageReport(a).totals.damage,hits.reduce((sum,e)=>sum+e.amount,0));
});
test('Damage report records actual HP loss, excludes overkill and resets on a new battle',()=>{
  const s=make();s.battle.enemies.forEach(e=>e.hp=0);s.battle.enemies[0].hp=2;
  G.advance(s,s.at+1000);assert.equal(G.damageReport(s).totals.damage,2);
  G.advance(s,s.at+2000);assert.equal(G.damageReport(s).totals.damage,0);
  const old=G.clone(s);delete old.battle.damage;assert.equal(G.damageReport(old).totals.damage,0);assert.ok(G.validate(old));
});
test('Three tank and three healer combinations are achievable, separate, and display exact multipliers',()=>{
  const s=make(['taeo','geonu','doyoon','sua','nari','lava']);
  const combo=G.partySynergies(s);assert.deepEqual(combo.counts,{tank:3,damage:0,healer:3});
  assert.deepEqual(combo.active.map(a=>a.id),['tank','healer']);assert.equal(combo.incomingMultiplier,.85);assert.equal(combo.healMultiplier,1.2);assert.equal(combo.damageMultiplier,1);
  assert.ok(Math.abs(s.battle.heroes[0].defense-(1-.72*.85))<1e-12);
  assert.ok(s.battle.heroes.every(h=>h.healMultiplier===1.2));
  const two=G.partySynergies({team:['taeo','geonu']});assert.equal(two.incomingMultiplier,1);
  const duplicates=G.partySynergies({team:['taeo','taeo','taeo']});assert.equal(duplicates.counts.tank,1);
});
test('Three damage roles improve outgoing damage without raising healer output',()=>{
  const s=make(['harin','yuna','minjae','sua']);assert.equal(G.partySynergies(s).damageMultiplier,1.15);
  const a=G.clone(s),b=G.clone(s);for(const h of b.battle.heroes)h.damageMultiplier=1;
  G.advance(a,a.at+1000);G.advance(b,b.at+1000);
  const actual=a.events.findLast(e=>e.kind==='hit'&&e.from==='harin').amount;
  const normal=b.events.findLast(e=>e.kind==='hit'&&e.from==='harin').amount;
  assert.ok(actual>normal);assert.equal(s.battle.heroes[3].healMultiplier,1);
});
test('Three healer synergy increases actual healing and reports capped real healing',()=>{
  const s=make(['sua','nari','lava']);
  for(const h of s.battle.heroes){h.hp=100;h.energy=G.BY_ID[h.id].cooldown-1;}
  G.advance(s,s.at+1000);
  const heals=s.events.filter(e=>e.kind==='heal'&&e.from==='sua');assert.equal(heals.length,3);
  assert.equal(heals[0].amount,Math.round(8*2.2*1.2));
  const row=G.damageReport(s).rows.find(r=>r.id==='sua');assert.equal(row.healing,heals.reduce((sum,e)=>sum+e.amount,0));
});
test('Later ordinary monsters use melee, ranged and healer skills; early enemies keep the beginner rules',()=>{
  const s=make(['taeo','geonu','harin','yuna','sua','nari']);s.best=60;
  G.action(s,{kind:'stage',stage:1,mode:'farm'},s.at);assert.ok(s.battle.enemies.every(e=>!e.monsterSkill));
  G.action(s,{kind:'stage',stage:16,mode:'farm'},s.at);
  for(const h of s.battle.heroes){h.hp=h.max=10000;h.atk=1;}
  for(const e of s.battle.enemies){e.hp=500;e.max=10000;e.atk=2;e.nextSkillAt=1000;}
  const back=s.battle.heroes[5];back.hp=500;
  G.advance(s,s.at+1000);
  const skills=s.events.filter(e=>e.kind==='monster-skill');assert.deepEqual(skills.map(e=>e.role).sort(),['healer','melee','ranged']);
  assert.deepEqual(skills.find(e=>e.role==='ranged').targets,[back.id]);
  const heal=s.events.find(e=>e.kind==='enemy-heal');assert.ok(heal.amount>0);assert.ok(s.battle.enemies.every(e=>e.hp<=e.max));
});
test('Winter projection does not mutate legacy saves; invalid exchange never invents balances',()=>{
  const s=make();delete s.winter;const original=G.clone(s),info=G.winterInfo(s,NOW);
  assert.equal(info.active,true);assert.equal(info.snowflakes,0);assert.equal(info.items.length,2);assert.deepEqual(s,original);assert.ok(G.validate(s));
  reject(s,{kind:'winter-exchange',item:'gold',snowflakes:999999,cost:0});
  reject(s,{kind:'winter-exchange',item:'constructor'});
});
test('Winter exchanges charge exact snowflakes, retain limits after reload and reject forged rewards',()=>{
  const s=make();s.winter.snowflakes=s.winter.earned=1000;const start={gold:s.gold,gems:s.gems};
  for(let i=0;i<30;i++)G.action(s,{kind:'winter-exchange',item:'gold',gold:1e9,cost:0},s.at);
  assert.equal(s.gold,start.gold+30000);assert.equal(s.winter.snowflakes,700);reject(s,{kind:'winter-exchange',item:'gold'});
  const loaded=G.clone(s);for(let i=0;i<15;i++)G.action(loaded,{kind:'winter-exchange',item:'gems',gems:1e9},loaded.at);
  assert.equal(loaded.gems,start.gems+1500);assert.equal(loaded.winter.snowflakes,400);reject(loaded,{kind:'winter-exchange',item:'gems'});
  assert.ok(G.winterInfo(loaded).items.every(item=>item.remaining===0));assert.ok(G.validate(loaded));
  reject(s,{kind:'winter-exchange',item:'gems'},G.WINTER_EVENT.startsAt-1);
});
test('Snowflakes come from won battles; offline and repeat tower clears do not award more',()=>{
  const s=make();s.seed=1;s.battle.enemies.forEach(e=>e.hp=0);G.advance(s,s.at+500);assert.equal(s.winter.snowflakes,1);
  const before=s.winter.snowflakes;G.advance(s,s.at+3600000);assert.equal(s.winter.snowflakes,before);
  const tower=make();G.action(tower,{kind:'activity',mode:'tower',floor:1},tower.at);tower.seed=1;tower.battle.enemies.forEach(e=>e.hp=0);G.advance(tower,tower.at+500);assert.equal(tower.winter.snowflakes,1);
  G.action(tower,{kind:'activity',mode:'tower',floor:1},tower.at);tower.seed=1;tower.battle.enemies.forEach(e=>e.hp=0);G.advance(tower,tower.at+500);assert.equal(tower.winter.snowflakes,1);
});
test('Winter save counters reject negative, fractional, infinite and over-limit values',()=>{
  for(const value of [-1,.5,Infinity,NaN]){const s=make();s.winter.snowflakes=value;assert.equal(G.validate(s),false);}
  const s=make();s.winter.exchanges.gems=16;assert.equal(G.validate(s),false);
  const a=make();a.winter.earned=-1;assert.equal(G.validate(a),false);
});
test('The previous update code is disabled and HORAS_CELEBRATION grants 2000 of each currency without expiry',()=>{
  const s=make(),before=G.clone(s);reject(s,{kind:'redeem',code:'MAJORUPDATE'});const r=G.action(s,{kind:'redeem',code:' horas_celebration ',gold:1e9,gems:1e9},Date.parse('2100-01-01T00:00:00Z'));
  assert.equal(r.expiresAt,null);assert.equal(s.gems,before.gems+2000);assert.equal(s.gold,before.gold+2000);assert.deepEqual(s.units,before.units);
  reject(s,{kind:'redeem',code:'HORAS_CELEBRATION'});assert.ok(G.validate(G.clone(s)));
});
test('Legacy claimed names cost 3000 gems and first name choice remains free',()=>{
  const s=make();delete s.nameChanges;s.commanderName='기존 단장';s.gems=2999;assert.equal(G.commanderNameInfo(s).cost,3000);reject(s,{kind:'rename',name:'새로운 단장',cost:0});
  s.gems=3000;G.action(s,{kind:'rename',name:'새로운 단장'},s.at);assert.equal(s.gems,0);assert.equal(s.nameChanges,2);reject(s,{kind:'rename',name:'새로운 단장'});
  const fresh=make();delete fresh.nameChanges;fresh.gems=0;G.action(fresh,{kind:'rename',name:'첫 단장'},fresh.at);assert.equal(fresh.gems,0);assert.equal(fresh.nameChanges,1);
});
console.log(`${passed} winter update engine checks passed`);
