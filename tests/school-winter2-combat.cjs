const assert=require('node:assert/strict'),G=require('../school/engine.js'),R=require('../school/raid-engine.js'),Y=require('../school/yeti-engine.js');
const NOW=Date.parse('2026-11-18T12:00:00+09:00');
function save(level=70,stars=2,kind='normal'){
 const s=G.create(NOW,11);s.team=['ryusion','osia','lava','nari','lumi',kind.startsWith('spica')?'spica':'ian'];
 for(const id of s.team)s.units[id]={level,stars,xp:0,shards:0};
 if(kind.endsWith('shield'))s.equipment={inventory:{earth_shield:{count:1,stars:0}},equipped:{ryusion:{weapon:'earth_shield'}}};
 return s;
}
function fight(level,kind='normal',delay=1500,seed=1){
 const b=Y.create(G,[{account:'a',save:save(level,2,kind)},{account:'b',save:save(level,2,kind)}],NOW,seed);
 for(let t=250;t<=Y.DURATION&&!b.ended;t+=250){
  Y.advance(G,b,NOW+t);
  for(let i=0;i<2;i++)if(!b.ended&&b.teams[i].frozen&&b.teams[i].units.some(u=>u.hp>0)&&b.teams[1-i].units.some(u=>u.hp>0)&&t-b.teams[i].frozen.at>=delay)Y.thaw(G,b,b.teams[1-i].account,b.teams[i].frozen.id,NOW+t);
 }
 return b;
}
(async()=>{
 assert.equal(Y.HP,800000);assert.equal(Y.DURATION,210000);assert.equal(Y.RECOMMENDED_LEVEL,70);assert.equal(Y.DIFFICULTY,'어려움');assert(Y.RULES.attack>Y.LEGACY_RULES.attack*2);
 const parties=[{account:'a',save:save()},{account:'b',save:save()}];assert.throws(()=>Y.create(G,parties.slice(0,1),NOW,1));
 const legacy=Y.create(G,parties,NOW,3);delete legacy.yetiRules;legacy.boss.hp=legacy.boss.max=1600000;
 for(const t of legacy.teams)for(const u of t.units){u.hp=u.max=1e9;u.atk=1;}
 Y.advance(G,legacy,NOW+210000);assert.equal(legacy.elapsed,150000);assert.equal(legacy.boss.max,1600000);assert.equal(legacy.outcome,'timeout');
 const frozen=G.clone(legacy);Y.advance(G,legacy,NOW+1e9);assert.deepEqual(legacy,frozen);
 console.log('PASS 800k/210s hard duo settings, double attack, old active battles retain 1.6m/150s snapshot and finish once');

 const summary={wins70:0,wins100:0,failed60:0,failedSlowRescue:0,shieldSurvivors:[],spicaSurvivors:[],clear70:[]};
 for(let seed=1;seed<=12;seed++){
  const normal=fight(70,'normal',1500,seed),high=fight(100,'normal',1500,seed),low=fight(60,'normal',1500,seed),slow=fight(70,'normal',4000,seed),abandoned=fight(70,'normal',Infinity,seed),shield=fight(70,'shield',1500,seed),spica=fight(70,'spica-shield',1500,seed);
  assert.equal(normal.outcome,'defeated');assert.equal(high.outcome,'defeated');assert.notEqual(low.outcome,'defeated');assert.notEqual(slow.outcome,'defeated');assert.notEqual(abandoned.outcome,'defeated');assert.equal(shield.outcome,'defeated');assert.equal(spica.outcome,'defeated');
  assert.equal(normal.damage,800000);assert.equal(normal.teams.reduce((n,t)=>n+t.damage,0),800000);assert(normal.elapsed>140000&&normal.elapsed<190000);assert(high.elapsed<normal.elapsed);assert(normal.teams.every(t=>t.thaws>0));
  summary.wins70++;summary.wins100++;summary.failed60++;summary.failedSlowRescue++;summary.clear70.push(normal.elapsed);summary.shieldSurvivors.push(shield.teams.flatMap(t=>t.units).filter(u=>u.hp>0).length);summary.spicaSurvivors.push(spica.teams.flatMap(t=>t.units).filter(u=>u.hp>0).length);
 }
 console.log('PASS 12 seeds: no-UR Lv70/2-star tank+two-healer wins, Lv60/late rescue fails; signature shield with and without Spica survives',JSON.stringify(summary));

 const fine=Y.create(G,[{account:'a',save:save(70,2,'spica')},{account:'b',save:save(70,2,'shield')}],NOW,33),coarse=G.clone(fine);
 for(let t=250;t<=15000;t+=250)Y.advance(G,fine,NOW+t);Y.advance(G,coarse,NOW+15000);assert.deepEqual(coarse,fine);
 assert(fine.events.some(e=>e.kind==='spica-wind'));assert(fine.teams[0].units.every(u=>u.hasteUntil>0));assert(fine.boss.slowUntil>0);
 assert.equal(G.basicAttackRate({hasteUntil:100,slowUntil:100},0),1);assert.equal(G.basicAttackRate({slowUntil:100},0,true),.925);
 console.log('PASS Spica and signature states remain deterministic across reconnect, statuses do not multiply and bosses receive half slow');

 // Isolate automatic attack timing from boss damage and skill replacement.
 const unitSave=save(70,2,'spica');unitSave.team=['spica','lumi'];const neutral={...G,basicAttackRate:()=>1},longSkill={...G,BY_ID:{...G.BY_ID,lumi:{...G.BY_ID.lumi,cooldown:999}}};
 function sample(game){const b=R.create(game,[{account:'a',save:unitSave}],NOW,12);b.boss.nextAt=b.boss.nextBasicAt=1e12;R.advance(game,b,NOW+60000);return b;}
 const buffed=sample(longSkill),normal=sample({...longSkill,basicAttackRate:()=>1});
 const basics=b=>b.events.filter(e=>e.id==='lumi'&&e.kind==='hit'&&!e.skill);assert(basics(buffed).length>basics(normal).length);
 const casts=b=>b.events.filter(e=>e.id==='spica'&&e.kind==='cast').map(e=>e.t);assert.deepEqual(casts(buffed),casts(normal));assert.equal(R.magical(G,'spica'),true);
 const shieldSave=save(70,2,'shield'),shieldBattle=R.create(G,[{account:'a',save:shieldSave}],NOW,1);shieldBattle.boss.nextAt=1e12;R.advance(G,shieldBattle,NOW+6000);
 assert(shieldBattle.events.some(e=>e.kind==='shield'&&e.skill==='대지의 맹세'));assert(shieldBattle.teams[0].units[0].shield<=shieldBattle.teams[0].units[0].max*.6);
 console.log('PASS fractional haste creates more basic attacks without extra skill charges; Spica magic and bounded signature taunt barrier');

 const {simulateArena}=await import('../online/arena.mjs');
 const a=save(70,2,'spica'),b=save();b.team[5]='jiho';b.units.jiho={level:70,stars:2,xp:0,shards:0};
 const pvp=simulateArena(G,[a,b],['a','b'],12),repeat=simulateArena(G,[a,b],['a','b'],12),flat=simulateArena(neutral,[a,b],['a','b'],12);assert.deepEqual(pvp,repeat);
 assert(pvp.events.some(e=>e.kind==='spica-wind'));const until=Math.min(pvp.durationMs,flat.durationMs),attacks=(r,side)=>r.events.filter(e=>e.t<=until&&e.kind==='attack'&&e.from==='lumi'&&e.side===side).length;
 assert(attacks(pvp,0)>=attacks(flat,0));assert(attacks(pvp,1)<=attacks(flat,1));assert(pvp.durationMs<=90000);
 const fortress=simulateArena(G,[shieldSave,b],['a','b'],12);assert(fortress.events.some(e=>e.kind==='shield'&&e.skill==='대지의 맹세'));assert(fortress.events.some(e=>e.toSide===0&&e.amount>0&&['attack','skill'].includes(e.kind)));
 for(const side of fortress.final)for(const u of side){assert(Number.isFinite(u.hp)&&u.hp>=0);assert(Number.isFinite(u.shield)&&u.shield>=0);}
 console.log('PASS PvP haste/slow and shield are deterministic, remain vulnerable and preserve bounded final states');
})().catch(e=>{console.error(e);process.exitCode=1;});
