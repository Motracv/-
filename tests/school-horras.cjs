const assert = require('node:assert/strict');
const G = require('../school/engine.js');
const NOW = Date.parse('2026-11-18T12:00:00+09:00');
let passed = 0;
const test = (name, run) => { run(); passed++; console.log('PASS', name); };
function make(team = ['horas'], seed = 287) {
  const s = G.create(NOW, seed);
  for (const id of team) s.units[id] = {level:1,xp:0,stars:0,shards:0};
  G.action(s,{kind:'team',team},s.at);
  for (const h of s.battle.heroes) {h.hp=h.max=100000; h.critChance=0;}
  for (const e of s.battle.enemies) {e.hp=e.max=100000; e.atk=1;}
  return s;
}
function run(s, ms) { G.advance(s, s.at + ms); return s; }
function noAttacks(s) { for (const e of s.battle.enemies) e.stunUntil=100000; return s; }
function castReady(s, miss = false) {
  s.battle.horas.stacks=5;
  run(s,1000);
  assert(s.battle.horasCast);
  s.battle.horasCast.missed=miss;
  return s.battle.horasCast;
}
const hits = (s, skill) => s.events.filter(e=>e.kind==='hit'&&e.from==='horas'&&(skill===undefined||e.skill===skill));
const draw = (s, roll, pick=.5) => {let n=0; return G.action(s,{kind:'recruit',banner:'horas',count:1},s.at,()=>n++%2?pick:roll).results[0];};

test('UR hero is obtainable only from her own banner, not granted to old or new accounts',()=>{
  assert.equal(G.CATALOG_VERSION,12);assert.equal(G.BY_ID.horas.rarity,'UR');assert.equal(G.BY_ID.horas.role,'사수');
  const old=G.create(NOW);delete old.banners.horas;const units=G.clone(old.units),money=[old.gold,old.gems];
  assert(G.validate(old));G.advance(old,old.at);assert.deepEqual(old.units,units);assert.deepEqual([old.gold,old.gems],money);
  assert.deepEqual(G.bannerState(old,'horas'),{pity:0,guaranteed:false});
  for(const banner of ['osia','lava'])assert.equal(G.bannerHeroRates(old,banner).horas,0);
  assert.equal(G.bannerHeroRates(old,'horas').lava,0);
});
test('UR probability boundaries, soft 60 and hard 80 are exact and sum to one',()=>{
  for(const [pity,ur] of [[0,.003],[58,.003],[59,.013],[60,.023],[78,.203],[79,1]]){
    const odds=G.recruitRates(pity,'horas');assert.equal(odds.UR,ur);
    assert(Math.abs(Object.values(odds).reduce((a,v)=>a+v,0)-1)<1e-12);
    assert.equal(odds.SSR,pity===79?0:.01);assert.equal(odds.SR,pity===79?0:.26);
  }
  for(const [roll,grade]of [[0,'UR'],[.002999,'UR'],[.003,'SSR'],[.012999,'SSR'],[.013,'SR'],[.272999,'SR'],[.273,'R'],[.999999,'R']]){
    const s=G.create(NOW),result=draw(s,roll);assert.equal(G.BY_ID[result.id].rarity,grade);assert.equal(result.urChance,.003);assert(G.validate(s));
  }
  assert.deepEqual(G.recruitRates(79),{SSR:1,SR:0,R:0});assert.deepEqual(G.recruitRates(0),{SSR:.01,SR:.26,R:.73});
});
test('SSR does not reset UR pity and all three banner records survive switching/reload',()=>{
  const s=G.create(NOW);s.gems=20000;s.banners.osia={pity:59,guaranteed:true};s.pity=59;s.banners.lava={pity:37,guaranteed:true};s.banners.horas.pity=12;
  const others=G.clone({osia:s.banners.osia,lava:s.banners.lava});
  assert.equal(G.BY_ID[draw(s,.008).id].rarity,'SSR');assert.equal(s.banners.horas.pity,13);
  assert.deepEqual({osia:s.banners.osia,lava:s.banners.lava},others);
  const loaded=G.clone(s);loaded.banners.horas.pity=79;const result=draw(loaded,.999999);
  assert.equal(result.id,'horas');assert(result.pity&&result.guaranteed&&result.featured);assert.equal(loaded.banners.horas.pity,0);
  assert.deepEqual({osia:loaded.banners.osia,lava:loaded.banners.lava},others);assert.equal(loaded.pity,59);
});
test('UR ten-pull pity evolves per slot, exact cost, duplicates and awakening persist',()=>{
  const s=G.create(NOW);s.banners.horas.pity=78;const r=G.action(s,{kind:'recruit',banner:'horas',count:10},s.at,()=>.99);
  assert.equal(r.results[0].urChance,.203);assert.equal(r.results[1].id,'horas');assert.equal(r.results[1].pity,true);assert.equal(r.results[2].urChance,.003);assert.equal(s.banners.horas.pity,8);assert.equal(s.gems,200);
  const dupe=draw(s,0);assert.equal(dupe.shards,30);assert.equal(s.units.horas.shards,30);
  G.action(s,{kind:'awaken',hero:'horas'},s.at);assert.equal(s.units.horas.stars,1);assert.equal(s.units.horas.shards,20);
  G.action(s,{kind:'team',team:['taeo','horas','sua']},s.at);G.action(s,{kind:'train',hero:'horas'},s.at);
  assert.equal(s.units.horas.level,2);assert(G.validate(G.clone(s)));
  const normal=G.create(NOW);const ten=G.action(normal,{kind:'recruit',banner:'horas',count:10},normal.at,()=>.99);assert.equal(ten.results.filter(r=>G.BY_ID[r.id].rarity==='SR').length,1);
});
test('UR character rates list all eligible standard SSRs equally and preserve old 50:50',()=>{
  const s=G.create(NOW),r=G.bannerHeroRates(s,'horas');assert.equal(r.horas,.003);
  for(const id of G.STANDARD_SSR)assert.equal(r[id],.01/3);
  for(const grade of ['UR','SSR','SR','R'])assert(Math.abs(G.HEROES.filter(h=>h.rarity===grade).reduce((n,h)=>n+r[h.id],0)-G.recruitRates(0,'horas')[grade])<1e-12);
  s.banners.osia.guaranteed=true;assert.equal(G.bannerHeroRates(s,'osia').osia,.01);assert.equal(G.bannerHeroRates(s,'osia').horas,0);
  s.gems=99;const old=G.clone(s);assert.throws(()=>G.action(s,{kind:'recruit',banner:'horas',count:1},s.at));assert.deepEqual(s,old);
});
test('Slow basics alternate two poses every two seconds and add one stack per attack',()=>{
  const s=noAttacks(make());run(s,1000);assert.equal(hits(s,false).length,0);run(s,7000);
  const basic=s.events.filter(e=>e.kind==='horas-basic');assert.deepEqual(basic.map(e=>e.pose),[1,2,1,2]);
  assert.deepEqual(basic.map(e=>e.simAt),[2000,4000,6000,8000]);assert.equal(s.battle.horas.stacks,4);assert.equal(hits(s,false).length,4);
  run(s,2000);assert.equal(s.battle.horas.stacks,5);assert(!s.battle.horasCast);
  run(s,1000);assert(s.battle.horasCast);assert.equal(s.battle.horas.stacks,0);assert(G.validate(s));
});
test('Being hit or shield-hit gains at most one stack per second across multi-enemy attacks',()=>{
  const s=make();s.battle.heroes[0].shield=1000;run(s,1000);
  const stack=s.events.filter(e=>e.kind==='horas-stack');assert.equal(stack.length,1);assert.equal(stack[0].source,'hit');assert.equal(stack[0].amount,1);
  assert.equal(s.battle.heroes[0].hp,100000);run(s,1000);assert.equal(s.battle.horas.stacks,3); // one basic + one hit
  assert.equal(s.events.filter(e=>e.kind==='horas-stack'&&e.source==='hit').length,2);
});
test('Ritual consumes exactly five, preserves rolls through reload and impacts only after merge',()=>{
  const s=noAttacks(make()),cast=castReady(s),saved=G.clone(s),enemyHp=s.battle.enemies.map(e=>e.hp);
  assert.equal(s.battle.horas.stacks,0);assert.equal(cast.mergeMs,1000);assert.equal(cast.impactDelay,1500);
  run(s,1000);assert.deepEqual(s.battle.enemies.map(e=>e.hp),enemyHp);assert(s.battle.horasCast);
  run(s,500);run(saved,1500);assert.deepEqual(s,saved);assert(!s.battle.horasCast);
  const dealt=hits(s,true);assert.equal(dealt.length,2);assert.equal(dealt[0].to,'e0');assert(dealt[0].primary);assert.equal(dealt[1].to,'e1');assert(dealt[0].amount>dealt[1].amount*5);assert.equal(s.battle.enemies[2].hp,enemyHp[2]);
  assert.equal(s.battle.enemies[0].horasMark.until,s.battle.elapsed+6000);
});
test('A missed ritual spends the stacks but does not damage or mark any enemy',()=>{
  const s=noAttacks(make());castReady(s,true);const hp=s.battle.enemies.map(e=>e.hp);run(s,1500);
  assert.deepEqual(s.battle.enemies.map(e=>e.hp),hp);assert.equal(hits(s,true).length,0);assert(s.battle.enemies.every(e=>!e.horasMark));
  assert(s.events.some(e=>e.kind==='horas-impact'&&e.missed));assert(s.events.some(e=>e.kind==='miss'));assert.equal(s.battle.horas.stacks,0);
});
test('Exactly ten percent miss is sampled once at cast start and stored, never on reload',()=>{
  let missed=0;const total=10000;
  for(let seed=1;seed<=total;seed++){
    const s=make(['horas'],Math.imul(seed,2654435761)>>>0);s.battle.horas.stacks=5;run(s,1000);if(s.battle.horasCast.missed)missed++;
  }
  assert(Math.abs(missed/total-.1)<.035,`${missed}/${total}`);
  assert.equal(G.HORAS_RULES.missChance,.1);
});
test('Stun bonus is exactly 1.5 at the moment of impact, including the primary and splash',()=>{
  const normal=make(),stunned=G.clone(normal);castReady(normal);stunned.battle=G.clone(normal.battle);stunned.seed=normal.seed;stunned.seq=normal.seq;stunned.events=G.clone(normal.events);stunned.at=normal.at;stunned.simTime=normal.simTime;
  for(const e of normal.battle.enemies)e.stunUntil=0;
  for(const e of stunned.battle.enemies)e.stunUntil=stunned.battle.elapsed+2000;
  run(normal,1500);run(stunned,1500);
  const a=hits(normal,true),b=hits(stunned,true);assert.equal(a.length,b.length);
  for(let i=0;i<a.length;i++){assert.equal(b[i].amount,Math.round(a[i].amount*1.5));assert(b[i].stunBonus);assert(!a[i].stunBonus);}
  const expired=make();castReady(expired);expired.battle.enemies[0].stunUntil=expired.battle.elapsed+1000;run(expired,1500);assert(!hits(expired,true)[0].stunBonus);
});
test('A marked enemy killed by the ritual refunds two stacks immediately and only once',()=>{
  const s=noAttacks(make());s.battle.enemies[0].hp=1;castReady(s);run(s,1500);
  assert.equal(s.battle.enemies[0].hp,0);assert.equal(s.battle.horas.stacks,2);assert(!s.battle.enemies[0].horasMark);
  assert.equal(s.events.filter(e=>e.kind==='horas-refund').length,1);run(s,500);assert.equal(s.battle.horas.stacks,2);
});
test('Any ally kill grants marked refund, but expiry and unmarked splash kills do not',()=>{
  const s=noAttacks(make(['horas','harin']));castReady(s);run(s,1500);s.battle.enemies[0].hp=1;run(s,500);
  assert.equal(s.battle.horas.stacks,2);assert(s.events.some(e=>e.kind==='horas-refund'&&e.to==='e0'));
  const expired=noAttacks(make(['horas','harin']));expired.battle.enemies[0].hp=1;expired.battle.enemies[0].horasMark={until:500,castId:1};run(expired,1000);assert.equal(expired.battle.horas.stacks,0);
  const splash=noAttacks(make());splash.battle.enemies[1].hp=1;castReady(splash);run(splash,1500);assert.equal(splash.battle.enemies[1].hp,0);assert.equal(splash.battle.horas.stacks,0);
});
test('If the target dies during merge, the saved nearest target is used without rerolling',()=>{
  const s=noAttacks(make()),cast=castReady(s);const snapshot=G.clone(cast.targets);s.battle.enemies[0].hp=0;
  run(s,1500);const impact=s.events.find(e=>e.kind==='horas-impact');assert.equal(impact.targetId,'e1');
  const primary=hits(s,true)[0];assert.equal(primary.to,'e1');assert.equal(primary.amount,Math.round(snapshot.find(t=>t.id==='e1').amount*1.5));
  assert(s.battle.enemies[1].horasMark);assert(!s.battle.enemies[0].horasMark);assert.equal(hits(s,true)[1].to,'e2');
});
test('Death cancels pending damage, marks cannot refund a dead Horas, manual resets clear stacks',()=>{
  const s=noAttacks(make(['horas','taeo']));castReady(s);s.battle.heroes[0].hp=0;const hp=s.battle.enemies.map(e=>e.hp);run(s,1500);
  assert(!s.battle.horasCast);assert.equal(hits(s,true).length,0);assert.equal(s.battle.enemies[1].hp,hp[1]);
  s.battle.enemies[0].hp=1;s.battle.enemies[0].horasMark={until:s.battle.elapsed+6000,castId:1};run(s,1000);assert.equal(s.battle.horas.stacks,0);
  const live=noAttacks(make());live.battle.horas.stacks=4;G.action(live,{kind:'stage',stage:1,mode:'farm'},live.at);assert.equal(live.battle.horas.stacks,0);assert(!live.battle.horasCast);
});
test('Victory carries living stacks without accelerating the next basic; defeat does not carry',()=>{
  const s=make();s.battle.horas.stacks=4;s.battle.enemies.forEach(e=>e.hp=0);run(s,500);assert.equal(s.battle.phase,'victory');run(s,2000);
  assert.equal(s.battle.horas.stacks,4);assert.equal(s.battle.horas.nextBasicAt,2000);assert.equal(s.battle.elapsed,0);
  s.battle.horas.stacks=5;s.battle.heroes[0].hp=0;run(s,1000);assert.equal(s.battle.phase,'defeat');run(s,5000);assert.equal(s.battle.horas.stacks,0);
});
test('Dragon cut-in freezes Horas ritual timing and snapshot, then resumes once',()=>{
  const s=noAttacks(make(['horas','osia']));s.battle.horas.stacks=5;s.units.osia.nextSkill=4;s.battle.heroes[1].energy=4;
  run(s,1000);assert(s.battle.cinematic);const cast=G.clone(s.battle.horasCast),elapsed=s.battle.elapsed;
  run(s,1000);assert.equal(s.battle.elapsed,elapsed);assert.deepEqual(s.battle.horasCast,cast);assert(!s.battle.cinematic);assert.equal(hits(s,true).length,0);
  run(s,1500);assert.equal(s.events.filter(e=>e.kind==='horas-impact').length,1);assert(!s.battle.horasCast);assert(G.validate(s));
});
test('Fast speed, half-second reload, offline and dungeon exit keep deterministic cast resolution',()=>{
  const a=noAttacks(make());a.speed=1.5;castReady(a);const b=G.clone(a);run(a,1000);run(b,500);run(b,500);assert.deepEqual(a,b);
  const idle=noAttacks(make());castReady(idle);const pending=G.clone(idle.battle.horasCast),elapsed=idle.battle.elapsed;run(idle,3600000);assert.deepEqual(idle.battle.horasCast,pending);assert.equal(idle.battle.elapsed,elapsed);run(idle,1500);assert.equal(idle.events.filter(e=>e.kind==='horas-impact').length,1);
  const dungeon=make();G.action(dungeon,{kind:'activity',mode:'tower',floor:1},dungeon.at);dungeon.battle.enemies.forEach(e=>{e.hp=e.max=100000;e.stunUntil=100000;});castReady(dungeon);G.action(dungeon,{kind:'activity-exit'},dungeon.at);assert(!dungeon.battle.horasCast);assert.equal(dungeon.battle.horas.stacks,0);assert(G.validate(dungeon));
});
test('Invalid stack, timing, target and roll records are rejected; old records remain valid',()=>{
  const s=make();castReady(s);assert(G.validate(s));
  for(const mutate of [v=>v.battle.horas.stacks=6,v=>v.battle.horas.stacks=-1,v=>v.battle.horas.stacks=.5,v=>v.battle.horas.nextBasicAt=Infinity,v=>v.battle.horas.basicPose=3,v=>v.battle.horasCast.missed=1,v=>v.battle.horasCast.targets[0].amount=NaN,v=>v.battle.horasCast.targets[0].splashAmount=-1,v=>v.battle.horasCast.impactDelay=0,v=>v.battle.enemies[0].horasMark={until:-1,castId:1}]){const bad=G.clone(s);mutate(bad);assert.equal(G.validate(bad),false);}
  const old=G.create(NOW);delete old.banners.horas;assert(G.validate(old));const before=G.clone(old);G.horasInfo(old);assert.deepEqual(old,before);
});
test('Stacks earned during ritual wait for the minimum cast interval instead of recursion',()=>{
  const s=noAttacks(make());castReady(s);const first=s.battle.horasCast.id;
  s.battle.horas.stacks=5;run(s,2000);assert(!s.battle.horasCast);assert.equal(s.events.filter(e=>e.kind==='horas-cast').length,1);
  run(s,1000);assert(s.battle.horasCast.id>first);assert.equal(s.battle.horasCast.began,4000);assert.equal(s.battle.horas.stacks,0);
});
test('Seeded sustained combat keeps Horas strong in single-target and below the AoE specialist',()=>{
  const measure=(id,count)=>{let damage=0;for(let seed=1;seed<=40;seed++){
    const s=make(['geonu','taeo','lava','nari','osia',id],Math.imul(seed,2654435761)>>>0);
    for(const u of Object.values(s.units)){u.level=80;u.stars=3;}
    G.action(s,{kind:'stage',stage:1,mode:'farm'},s.at);s.battle.enemies=s.battle.enemies.slice(0,count);
    for(const e of s.battle.enemies){e.hp=e.max=1e8;e.atk=3;}
    run(s,60000);damage+=s.battle.damage[id]?.damage||0;
  }return damage/40;};
  const boss=measure('horas',1),ian=measure('ian',1),adds=measure('horas',3),lumi=measure('lumi',3);
  assert(boss>ian*1.02&&boss<ian*1.25,`Horas ${boss}, Ian ${ian}`);assert(adds<lumi&&adds>lumi*.7,`Horas ${adds}, Lumi ${lumi}`);
  console.log('BALANCE',JSON.stringify({level:80,stars:3,seeds:40,seconds:60,horasBoss:Math.round(boss),ianBoss:Math.round(ian),horasAdds:Math.round(adds),lumiAdds:Math.round(lumi)}));
});
console.log(`${passed} Horas combat and recruitment checks passed`);
