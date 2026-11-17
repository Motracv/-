const assert=require('node:assert/strict');
const G=require('../school/engine.js');
let passed=0;
const NOW=Date.parse('2026-11-18T12:00:00+09:00');
function test(name,body){body();passed++;console.log('PASS',name);}
function state(now=NOW){const s=G.create(now,26);s.captain={level:50,xp:0};for(const u of Object.values(s.units))u.level=50;return s;}
function act(s,input){return G.action(s,input,s.at);}
function settle(s,won=true){for(const u of won?s.battle.enemies:s.battle.heroes)u.hp=0;G.advance(s,s.at+500);assert.equal(s.battle.phase,won?'victory':'defeat');assert.equal(s.activities.run.settled,true);return s.activities.lastResult;}
function amounts(s){return {gold:s.gold,gems:s.gems,xp:s.team.map(id=>s.units[id].xp),captain:G.clone(s.captain)};}
function rejectUnchanged(s,input){const old=G.clone(s);assert.throws(()=>act(s,input));assert.deepEqual(s,old);}

test('Legacy three-member saves migrate without free characters, resets, or activityInfo side effects',()=>{
 const s=state();delete s.activities;s.gold=5860;s.gems=290;s.best=30;s.stage=30;s.wave=3;s.mode='farm';
 const old=G.clone(s),info=G.activityInfo(s,s.at);assert.deepEqual(s,old);assert.equal(info.daily.keys,3);assert.equal(info.weekly.keys,2);assert.equal(info.tower.best,0);assert.equal(info.tower.nextFloor,1);assert.ok(G.validate(s));
 G.advance(s,s.at);assert.deepEqual(s.team,old.team);assert.deepEqual(s.units,old.units);assert.deepEqual(s.battle,old.battle);assert.equal(s.gold,5860);assert.equal(s.gems,290);assert.equal(s.stage,30);assert.equal(s.wave,3);assert.equal(s.activities.towerBest,0);assert.equal(s.activities.run,null);assert.ok(G.validate(s));
});

test('Formation accepts one through six owned heroes, rejects empty/duplicate/seventh slots, and persists a last-slot dragon',()=>{
 const s=state(),ids=['geonu','ian','lumi','nari','lava','osia'];assert.equal(G.MAX_TEAM,6);for(const id of ids)s.units[id]={level:50,xp:0,stars:0,shards:0};
 for(let size=1;size<=6;size++){act(s,{kind:'team',team:ids.slice(0,size)});assert.equal(s.team.length,size);assert.equal(s.battle.heroes.length,size);assert.ok(G.validate(s));}
 for(const team of [[],[...ids,'taeo'],['geonu','geonu'],['geonu','constructor'],['geonu',null]])rejectUnchanged(s,{kind:'team',team});
 for(const e of s.battle.enemies){e.hp=e.max=1000000;e.atk=0;}for(const h of s.battle.heroes){h.hp=h.max=100000;h.energy=0;}s.units.osia.nextSkill=4;
 G.advance(s,s.at+5000);assert.equal(s.battle.cinematic.resumeIndex,6);assert.ok(G.validate(s));const loaded=G.clone(s);G.advance(s,s.at+3000);for(let i=0;i<6;i++)G.advance(loaded,loaded.at+500);assert.deepEqual(loaded,s);assert.ok(s.events.some(e=>e.kind==='hit'&&e.from==='osia'&&e.stage===4));assert.ok(G.validate(s));
});

test('Daily and weekly tier unlocks and rewards match progression without mutating read-only status',()=>{
 const unlocks={daily:[0,10,20,35,50],weekly:[0,15,30,45,60]};
 for(const kind of ['daily','weekly'])for(let i=0;i<5;i++)for(const best of [...new Set([Math.max(0,unlocks[kind][i]-1),unlocks[kind][i]])]){
  const s=state();s.best=best;const old=G.clone(s),info=G.activityInfo(s,s.at)[kind],tier=info.tiers[i];assert.deepEqual(s,old);assert.equal(tier.tier,i+1);assert.equal(tier.unlocked,best>=unlocks[kind][i]);
  assert.deepEqual(tier.reward,kind==='daily'?{gold:2000+1500*i,gems:80+30*i,xp:200+100*i}:{gold:12000+6000*i,gems:600+200*i,xp:1000+400*i});
 }
 const s=state();for(const input of [{kind:'activity',mode:'other',tier:1},{kind:'activity',mode:'constructor',tier:1},{kind:'activity',mode:'daily',tier:0},{kind:'activity',mode:'daily',tier:6},{kind:'activity',mode:'daily',tier:1.5},{kind:'activity',mode:'weekly',tier:2},{kind:'activity',mode:'tower',floor:2},{kind:'activity',mode:'tower',floor:0},{kind:'activity',mode:'tower',floor:1.5},{kind:'activity',mode:'tower',floor:Number.MAX_SAFE_INTEGER+1}])rejectUnchanged(s,input);
});

test('Dungeon victory spends one key, confirms exact rewards once, and waits without changing the saved campaign',()=>{
 for(const kind of ['daily','weekly']){
  const s=state();s.best=60;s.stage=17;s.wave=3;s.mode='farm';s.losses=2;const campaign={stage:s.stage,wave:s.wave,mode:s.mode,best:s.best,losses:s.losses},before=amounts(s),expected=G.activityInfo(s,s.at)[kind].tiers[2].reward;
  act(s,{kind:'activity',mode:kind,tier:3,reward:{gold:1e12,gems:1e12,xp:1e12}});assert.equal(s.activities[kind].used,1);assert.equal(s.battle.activity.kind,kind);assert.equal(s.battle.activity.tier,3);assert.equal(s.battle.boss,true);
  const runId=s.activities.run.id,result=settle(s);assert.equal(result.runId,runId);assert.equal(result.won,true);assert.deepEqual(result.reward,expected);assert.equal(s.gold,before.gold+expected.gold);assert.equal(s.gems,before.gems+expected.gems);assert.deepEqual(s.team.map(id=>s.units[id].xp),before.xp.map(x=>x+expected.xp));
  const settled=amounts(s);G.advance(s,s.at+60000);assert.deepEqual(amounts(s),settled);assert.equal(s.activities[kind].used,1);assert.equal(s.activities.run.id,runId);assert.equal(s.battle.phase,'victory');assert.deepEqual(Object.fromEntries(Object.keys(campaign).map(k=>[k,s[k]])),campaign);
  act(s,{kind:'activity-exit'});assert.equal(s.activities.run,null);assert.equal(s.battle.phase,'fight');assert.equal(s.battle.activity,undefined);assert.deepEqual(Object.fromEntries(Object.keys(campaign).map(k=>[k,s[k]])),campaign);assert.equal(G.activityInfo(s,s.at)[kind].keys,(kind==='daily'?3:2)-1);assert.ok(G.validate(s));
 }
});

test('Active challenges block replacement runs and formations while allowing normal training, recruitment and speed controls',()=>{
 const s=state();act(s,{kind:'activity',mode:'daily',tier:1});for(const input of [{kind:'activity',mode:'weekly',tier:1},{kind:'activity',mode:'tower',floor:1},{kind:'team',team:['harin']},{kind:'stage',stage:1,mode:'farm'}])rejectUnchanged(s,input);
 s.gold=100000;s.gems=2000;act(s,{kind:'train',hero:'harin'});assert.equal(s.units.harin.level,51);G.action(s,{kind:'recruit',count:1},s.at,()=>.99);act(s,{kind:'speed',speed:1.5});assert.equal(s.speed,1.5);assert.equal(s.activities.run.kind,'daily');assert.equal(s.activities.run.settled,false);assert.equal(s.activities.daily.used,1);
});

test('A defeat or voluntary exit refunds the same-period entry exactly once and never grants victory rewards',()=>{
 for(const kind of ['daily','weekly'])for(const outcome of ['defeat','exit']){
  const s=state(),before=amounts(s);act(s,{kind:'activity',mode:kind,tier:1});
  if(outcome==='defeat'){const result=settle(s,false);assert.equal(result.won,false);assert.equal(result.refunded,true);assert.deepEqual(result.reward,{gold:0,gems:0,xp:0});G.advance(s,s.at+60000);act(s,{kind:'activity-exit'});}else act(s,{kind:'activity-exit'});
  assert.deepEqual(amounts(s),before);assert.equal(G.activityInfo(s,s.at)[kind].keys,kind==='daily'?3:2);assert.equal(s.activities[kind].used,0);assert.equal(s.activities.run,null);
  const bank=G.activityInfo(s,s.at)[kind].keys;try{act(s,{kind:'activity-exit'});}catch{}assert.equal(G.activityInfo(s,s.at)[kind].keys,bank);assert.deepEqual(amounts(s),before);
 }
});

test('Key refills follow Korean midnight/Monday with no rollover or refund into a new period',()=>{
 const boundaries={daily:Date.parse('2026-11-19T00:00:00+09:00'),weekly:Date.parse('2026-11-23T00:00:00+09:00')};
 for(const [kind,resetAt]of Object.entries(boundaries)){
  const s=state(resetAt-1000),cap=kind==='daily'?3:2;act(s,{kind:'activity',mode:kind,tier:1});const before=G.activityInfo(s,resetAt-1);assert.equal(before[kind].keys,cap-1);assert.equal(before[kind].resetAt,resetAt);
  assert.equal(G.activityInfo(s,resetAt)[kind].keys,cap);G.advance(s,resetAt);act(s,{kind:'activity-exit'});assert.equal(s.activities[kind].used,0);assert.equal(G.activityInfo(s,s.at)[kind].keys,cap);assert.equal(s.activities.lastResult.refunded,false);
  act(s,{kind:'activity',mode:kind,tier:1});assert.equal(G.activityInfo(s,s.at)[kind].keys,cap-1);act(s,{kind:'activity-exit'});assert.equal(G.activityInfo(s,s.at)[kind].keys,cap);
  const future=resetAt+21*86400000;assert.equal(G.activityInfo(s,future)[kind].keys,cap);
 }
 assert.equal(G.week(Date.parse('2026-11-22T23:59:59+09:00'))+1,G.week(Date.parse('2026-11-23T00:00:00+09:00')));
});

test('Daily and weekly keys exhaust only through successful entries and do not auto-spend after battle',()=>{
 for(const kind of ['daily','weekly']){
  const s=state(),cap=kind==='daily'?3:2;for(let i=0;i<cap;i++){act(s,{kind:'activity',mode:kind,tier:1});settle(s);assert.equal(G.activityInfo(s,s.at)[kind].keys,cap-i-1);}
  rejectUnchanged(s,{kind:'activity',mode:kind,tier:1});G.advance(s,s.at+30000);assert.equal(G.activityInfo(s,s.at)[kind].keys,0);assert.equal(s.activities[kind].used,cap);assert.equal(s.battle.phase,'victory');
 }
});

test('Tower floors unlock in order, give first-clear rewards once, and award nothing for repeat clears',()=>{
 const s=state(),before=amounts(s);rejectUnchanged(s,{kind:'activity',mode:'tower',floor:2});act(s,{kind:'activity',mode:'tower',floor:1});const firstId=s.activities.run.id,first=settle(s);assert.equal(first.firstClear,true);assert.deepEqual(first.reward,{gold:105,gems:10,xp:0});assert.equal(s.activities.towerBest,1);assert.equal(s.gold,before.gold+105);assert.equal(s.gems,before.gems+10);assert.deepEqual(s.team.map(id=>s.units[id].xp),before.xp);assert.deepEqual(s.captain,before.captain);
 const paid=amounts(s);G.advance(s,s.at+60000);assert.deepEqual(amounts(s),paid);act(s,{kind:'activity',mode:'tower',floor:1});assert.notEqual(s.activities.run.id,firstId);const duplicate=settle(s);assert.equal(duplicate.firstClear,false);assert.deepEqual(duplicate.reward,{gold:0,gems:0,xp:0});assert.deepEqual(amounts(s),paid);
 rejectUnchanged(s,{kind:'activity',mode:'tower',floor:3});act(s,{kind:'activity',mode:'tower',floor:2});settle(s,false);assert.equal(s.activities.towerBest,1);assert.deepEqual(amounts(s),paid);act(s,{kind:'activity',mode:'tower',floor:2});const loaded=G.clone(s);for(const e of s.battle.enemies)e.hp=0;for(const e of loaded.battle.enemies)e.hp=0;G.advance(s,s.at+500);G.advance(loaded,loaded.at+500);assert.deepEqual(loaded,s);assert.equal(s.activities.towerBest,2);assert.equal(s.gold,paid.gold+110);assert.equal(G.activityInfo(s,s.at).tower.nextFloor,3);assert.equal(s.activities.daily.used,0);assert.equal(s.activities.weekly.used,0);
});

test('Offline time banks campaign rewards without resolving an active challenge or modifying its keys',()=>{
 const s=state();s.best=30;act(s,{kind:'activity',mode:'daily',tier:1});const battle=G.clone(s.battle),run=G.clone(s.activities.run),before=amounts(s);G.advance(s,s.at+11*3600000);assert.deepEqual(s.battle,battle);assert.deepEqual(s.activities.run,run);assert.equal(s.offline.seconds,28800);assert.equal(s.offline.gold,Math.floor(G.rates(s).gold*28800/60));assert.deepEqual(amounts(s),before);assert.equal(s.best,30);assert.equal(s.activities.daily.used,1);
});

test('Very high tower floors remain finite and invalid saved activity counters are rejected',()=>{
 const s=state();s.activities.towerBest=G.MAX_TOWER_FLOOR-1;act(s,{kind:'activity',mode:'tower',floor:G.MAX_TOWER_FLOOR});assert.ok(G.validate(s));assert.ok(s.battle.enemies.every(e=>Number.isFinite(e.hp)&&e.hp>0&&Number.isFinite(e.atk)&&e.atk>0));assert.ok(Object.values(G.activityInfo(s,s.at).tower.reward).every(Number.isSafeInteger));
 G.advance(s,s.at+1000);assert.ok(G.validate(s));assert.ok(s.battle.heroes.every(h=>Number.isFinite(h.hp)&&h.hp>=0));
 for(const change of [a=>a.daily.used=4,a=>a.weekly.used=-1,a=>a.daily.period=NaN,a=>a.towerBest=G.MAX_TOWER_FLOOR+1,a=>a.run={id:1,kind:'tower',floor:1,settled:'yes'}]){const invalid=state();change(invalid.activities);assert.equal(G.validate(invalid),false);}
});

test('A boss warns before its real attack and defers damage during the dragon cut-in and stun',()=>{
 const s=state(),team=['geonu','ian','lumi','nari','lava','osia'];for(const id of team)s.units[id]={level:50,xp:0,stars:0,shards:0};act(s,{kind:'team',team});s.best=60;act(s,{kind:'activity',mode:'daily',tier:5});
 for(const h of s.battle.heroes){h.hp=h.max=1000000;h.atk=0;}const enemy=s.battle.enemies[0];enemy.hp=enemy.max=1e12;enemy.atk=100;
 G.advance(s,s.at+5000);const warning=s.events.find(e=>e.kind==='boss-warning');assert.ok(warning);assert.equal(warning.atElapsed,6000);assert.equal(warning.duration,1000);assert.equal(warning.targets.length,6);assert.ok(!s.events.some(e=>e.kind==='boss-skill'));
 s.units.osia.nextSkill=4;s.battle.heroes.find(h=>h.id==='osia').energy=4;G.advance(s,s.at+1000);assert.equal(s.battle.elapsed,6000);assert.ok(s.battle.cinematic);assert.ok(!s.events.some(e=>e.kind==='boss-skill'));const hp=s.battle.heroes.map(h=>h.hp);
 G.advance(s,s.at+G.OSIA_CINEMATIC_MS-500);assert.equal(s.battle.elapsed,6000);assert.deepEqual(s.battle.heroes.map(h=>h.hp),hp);assert.ok(!s.events.some(e=>e.kind==='boss-skill'));G.advance(s,s.at+500);
 const impact=s.events.findLast(e=>e.kind==='boss-skill');assert.ok(impact);assert.equal(impact.atElapsed,6000);assert.equal(impact.targets.length,6);assert.equal(s.events.filter(e=>e.kind==='hit'&&e.bossSkill&&e.at===impact.at).length,6);
 G.advance(s,s.at+1000);assert.equal(s.battle.elapsed,7000);assert.equal(enemy.stunUntil,8500);enemy.nextAbilityAt=8000;enemy.warnedFor=0;const sequence=s.seq;G.advance(s,s.at+1500);assert.equal(s.battle.elapsed,8500);assert.ok(!s.events.some(e=>e.seq>sequence&&e.kind==='boss-skill'));G.advance(s,s.at+500);assert.equal(s.events.findLast(e=>e.kind==='boss-skill').atElapsed,9000);
});

test('A challenge times out after 120 combat seconds at either speed and refunds once without claiming a win',()=>{
 for(const speed of [1,1.5]){
  const s=state();act(s,{kind:'activity',mode:'daily',tier:1});act(s,{kind:'speed',speed});for(const h of s.battle.heroes){h.hp=h.max=1000000;h.atk=0;}for(const e of s.battle.enemies){e.hp=e.max=1e12;e.atk=0;}
  const before=amounts(s),at=s.at;while(s.battle.phase==='fight'&&s.at-at<125000)G.advance(s,s.at+500);
  assert.equal(s.battle.elapsed,120000);assert.equal(s.at-at,120000/speed);assert.equal(s.battle.phase,'defeat');assert.equal(s.activities.lastResult.reason,'timeout');assert.equal(s.activities.lastResult.refunded,true);assert.equal(s.activities.daily.used,0);assert.deepEqual(amounts(s),before);G.advance(s,s.at+30000);assert.equal(s.activities.daily.used,0);assert.deepEqual(amounts(s),before);
 }
});

test('The new thank-you and Lava coupons award exact amounts once through the final Korean millisecond',()=>{
 const cutoff=Date.parse('2026-11-21T00:00:00+09:00');for(const[code,amount]of [['LAVA_DEBUT',1000],['THANK_YOU',500]]){
  const s=state(cutoff-1),before=amounts(s);const r=act(s,{kind:'redeem',code:' '+code.toLowerCase()+' ',gold:1e12,gems:1e12,now:cutoff+1000});assert.equal(r.gold,amount);assert.equal(r.gems,amount);assert.equal(s.gold,before.gold+amount);assert.equal(s.gems,before.gems+amount);assert.ok(s.redeemedCodes.includes(code));rejectUnchanged(s,{kind:'redeem',code});
  const expired=state(cutoff);rejectUnchanged(expired,{kind:'redeem',code,now:cutoff-1000});
 }
});
console.log(`${passed} school dungeon checks passed`);
