const assert=require('node:assert/strict');
const G=require('../school/engine.js');
const NOW=Date.parse('2026-11-18T12:00:00+09:00');
let passed=0;
const test=(name,run)=>{run();passed++;console.log('PASS',name);};
const make=()=>G.create(NOW,287), board=s=>G.questBoard(s,s.at), item=(s,id)=>board(s).items.find(q=>q.id===id);
const claim=(s,id)=>G.action(s,{kind:'quest',quest:id},s.at);
function reject(s,input,now=s.at){const old=G.clone(s);assert.throws(()=>G.action(s,input,now));assert.deepEqual(s,old);}
function win(s,boss=false){s.battle.boss=boss;s.mode='farm';for(const h of s.battle.heroes){h.atk=1000000;h.hp=h.max=1000000;}for(const e of s.battle.enemies){e.hp=1;e.stunUntil=1000000;}G.advance(s,s.at+1000);assert.equal(s.battle.phase,'victory');}
function next(s){G.action(s,{kind:'stage',stage:1,mode:'farm'},s.at);}
test('Catalog 16 preserves only current prices and new code definitions; legacy save migration never credits currency',()=>{
  assert.equal(G.CATALOG_VERSION,19);assert.deepEqual(G.RECRUIT_COST,{1:160,10:1600});
  const s=make();delete s.quests;s.kills=500000;s.pulls=10000;s.best=60;s.captain={level:50,xp:1234};s.claimed=G.QUESTS.map(q=>q.id);s.redeemedCodes=['OSIA_DEBUT','BUG_FIX','LAVA_DEBUT','THANK_YOU','MAJORUPDATE'];
  const old=G.clone(s);assert(G.validate(s));const projected=board(s);assert.equal(projected.items.length,77);assert.equal(projected.items.filter(q=>q.category==='stage'&&q.ready).length,60);assert(projected.items.filter(q=>['repeat','daily'].includes(q.category)).every(q=>q.value===0));assert.deepEqual(s,old);
  G.advance(s,s.at);for(const key of ['gold','gems','units','captain','banners','claimed','redeemedCodes'])assert.deepEqual(s[key],old[key]);assert.deepEqual(s.quests.repeat,{kills:0,waves:0,bosses:0});assert(G.validate(s));
});
test('Every stage has a once-only first-clear quest, including legacy clears, and the original seven rewards remain intact',()=>{
  const s=make();s.best=60;assert.equal(G.QUESTS.length,7);assert.deepEqual(G.QUESTS.map(q=>[q.id,q.gold,q.gems]),[['first',200,100],['recruit',300,150],['collection',500,200],['chapter',700,200],['captain',900,250],['veteran',2000,400],['graduation',5000,1000]]);
  for(let stage=1;stage<=60;stage++){const before=[s.gold,s.gems],r=claim(s,'stage-'+stage);assert.equal(r.gold,200+20*stage);assert.equal(r.gems,80);assert.equal(s.gold,before[0]+r.gold);assert.equal(s.gems,before[1]+80);reject(s,{kind:'quest',quest:'stage-'+stage});}
  assert.equal(s.claimed.filter(id=>id.startsWith('stage-')).length,60);claim(s,'first');reject(s,{kind:'quest',quest:'first'});assert(G.validate(G.clone(s)));
  const fresh=make();for(const id of ['stage-1','stage-0','stage-61','stage-01','constructor',{},null])reject(fresh,{kind:'quest',quest:id});
});
test('Only actual post-update kills and won waves increment repeat/daily progress; campaign bosses have a separate counter',()=>{
  const s=make();win(s);assert.deepEqual(s.quests.repeat,{kills:3,waves:1,bosses:0});assert.equal(s.quests.daily.kills,3);
  next(s);win(s,true);assert.deepEqual(s.quests.repeat,{kills:6,waves:2,bosses:1});assert.equal(s.best,1);
  const before=G.clone(s.quests);G.advance(s,s.at+1000);assert.deepEqual(s.quests,before);next(s);win(s,true);assert.equal(s.quests.repeat.bosses,2);assert.equal(item(s,'daily-bosses').ready,true);
  claim(s,'stage-1');next(s);win(s,true);assert.equal(item(s,'stage-1').ready,false);assert.equal(s.quests.repeat.bosses,3);
});
test('Keyed dungeons and new tower floors count, while repeated tower floors, defeat and offline banking do not',()=>{
  for(const mode of ['daily','weekly','tower']){
    const s=make();G.action(s,{kind:'activity',mode,...(mode==='tower'?{floor:1}:{tier:1})},s.at);win(s);
    assert.equal(s.quests.repeat.waves,1);assert.equal(s.quests.repeat.bosses,0);assert.equal(s.quests.repeat.kills,mode==='tower'?3:1);
    if(mode==='tower'){const before=G.clone(s.quests);G.action(s,{kind:'activity',mode,floor:1},s.at);win(s);assert.deepEqual(s.quests,before);}
  }
  const s=make(),before=G.clone(s.quests);G.advance(s,s.at+8*3600000);G.action(s,{kind:'offline'},s.at);assert.deepEqual(s.quests.repeat,before.repeat);assert.equal(s.quests.daily.kills,0);
  const lose=make();for(const h of lose.battle.heroes)h.hp=0;G.advance(lose,lose.at+1000);assert.equal(lose.battle.phase,'defeat');assert.deepEqual(lose.quests.repeat,{kills:0,waves:0,bosses:0});
});
test('Repeat claims retain overflow, limit each transaction to 100 cycles, and ignore forged client rewards',()=>{
  const s=make();s.quests.repeat={kills:10253,waves:31,bosses:11};assert.equal(item(s,'repeat-kills').cycles,100);
  const before=[s.gold,s.gems],r=G.action(s,{kind:'quest',quest:'repeat-kills',gold:1e12,gems:1e12,cycles:10000},s.at);
  assert.equal(r.cycles,100);assert.equal(r.gold,25000);assert.equal(r.gems,4000);assert.deepEqual([s.gold,s.gems],[before[0]+25000,before[1]+4000]);assert.equal(s.quests.repeat.kills,253);
  assert.equal(claim(s,'repeat-kills').cycles,2);assert.equal(s.quests.repeat.kills,53);reject(s,{kind:'quest',quest:'repeat-kills'});claim(s,'repeat-waves');claim(s,'repeat-bosses');assert.deepEqual(s.quests.repeat,{kills:53,waves:1,bosses:1});
});
test('Claim-all combines only eligible rewards atomically and cannot replay any consumed cycle',()=>{
  const s=make();s.best=2;s.quests.repeat={kills:253,waves:63,bosses:20};Object.assign(s.quests.daily,{kills:100,waves:30,bosses:4});
  const shown=board(s),before=G.clone(s),r=G.action(s,{kind:'quest-all',gold:1e12,gems:1e12},s.at);assert.equal(r.gold,shown.readyGold);assert.equal(r.gems,shown.readyGems);assert.equal(r.claimed.length,shown.readyCount);assert.equal(s.gold,before.gold+r.gold);assert.equal(s.gems,before.gems+r.gems);assert.equal(G.questReady(s,s.at),0);assert.deepEqual(s.quests.repeat,{kills:53,waves:3,bosses:0});assert.equal(s.quests.daily.claimed.length,3);reject(s,{kind:'quest-all'});
  const overflow=make();overflow.best=1;overflow.gold=Number.MAX_SAFE_INTEGER;reject(overflow,{kind:'quest-all'});assert.equal(overflow.claimed.length,0);
});
test('Daily quests roll over at Korean midnight; old-day and backward-clock claims cannot be repeated',()=>{
  const midnight=Date.parse('2026-11-19T00:00:00+09:00'),s=G.create(midnight-1000);s.quests.daily.kills=50;claim(s,'daily-kills');const before=G.clone(s);assert.equal(G.questBoard(s,midnight).items.find(q=>q.id==='daily-kills').value,0);assert.deepEqual(s,before);assert.equal(G.questBoard(s,midnight-1).resetsAt,midnight);reject(s,{kind:'quest',quest:'daily-kills'},midnight-1);
  win(s);assert.equal(s.quests.daily.day,G.day(midnight));assert.equal(s.quests.daily.kills,3);assert.deepEqual(s.quests.daily.claimed,[]);assert.equal(s.quests.repeat.kills,3);
  s.quests.daily.kills=50;claim(s,'daily-kills');reject(s,{kind:'quest',quest:'daily-kills'},midnight-86400000);assert.equal(s.quests.daily.claimed.length,1);
});
test('Counter validation rejects malformed progress and claim projections never mutate storage',()=>{
  for(const mutate of [s=>s.quests=null,s=>s.quests.version=2,s=>s.quests.repeat.kills=-1,s=>s.quests.repeat.waves=.5,s=>s.quests.repeat.bosses=Infinity,s=>s.quests.daily.kills=1000000001,s=>s.quests.daily.day=-1,s=>s.quests.daily.claimed=['repeat-kills'],s=>s.quests.daily.claimed=['daily-kills','daily-kills']]){const s=make();mutate(s);assert.equal(G.validate(s),false);}
  const s=make(),old=G.clone(s);for(let i=0;i<10;i++)G.questBoard(s,NOW+i*86400000);assert.deepEqual(s,old);
  for(const now of [NaN,Infinity,-1])reject(s,{kind:'quest-all'},now);
});
test('New collection and captain milestones are once-only and coexist with previous claimed ids',()=>{
  const s=make();for(const h of G.HEROES)s.units[h.id]={level:1,xp:0,stars:0,shards:0};s.captain.level=25;s.claimed=['collection','captain'];
  for(const id of ['collection-10','collection-15','captain-10','captain-25']){assert(item(s,id).ready);claim(s,id);reject(s,{kind:'quest',quest:id});}
  assert.equal(item(s,'collection').ready,false);assert.equal(item(s,'captain').ready,false);assert(G.validate(s));
});
test('Active codes are accepted, historical claims persist, and future redemption has no expiry',()=>{
  assert.deepEqual(Object.keys(G.COUPONS),['RYUSION_UPDATE','THANKS_FOR_PLAYING','THANKS_FOR_REPORTING','HORAS_CELEBRATION']);const s=make();s.redeemedCodes=['OSIA_DEBUT','BUG_FIX','LAVA_DEBUT','THANK_YOU','MAJORUPDATE'];
  for(const code of s.redeemedCodes)reject(s,{kind:'redeem',code});const before=[s.gold,s.gems];
  for(const code of Object.keys(G.COUPONS)){G.action(s,{kind:'redeem',code:' '+code.toLowerCase()+' ',gems:1e12,gold:1e12},Date.parse('2100-01-01'));reject(s,{kind:'redeem',code});}
  assert.deepEqual([s.gold,s.gems],[before[0]+17500,before[1]+5500]);assert.equal(s.redeemedCodes.length,9);assert(G.validate(G.clone(s)));
});
test('Captain rewards pay 160 gems plus 500+100 per new level only, including exact multi-level offline crossings',()=>{
  const s=make();s.captain.xp=G.captainNeed(1)-1;const before=[s.gold,s.gems];win(s);assert.equal(s.captain.level,2);assert.deepEqual([s.gold,s.gems],[before[0]+16+700,before[1]+160]);assert.deepEqual(s.events.filter(e=>e.kind==='captain').map(e=>[e.level,e.gold,e.gems]),[[2,700,160]]);
  const t=make();t.captain.xp=G.captainNeed(1)-1;t.offline={seconds:60,gold:0,xp:0,captainXp:1+G.captainNeed(2)+G.captainNeed(3)};const initial=G.clone(t);G.action(t,{kind:'offline'},t.at);assert.deepEqual(t.captain,{level:4,xp:0});assert.equal(t.gold,initial.gold+700+800+900);assert.equal(t.gems,initial.gems+480);assert.equal(t.events.filter(e=>e.kind==='captain').length,3);reject(t,{kind:'offline'});const paid=G.clone(t);G.advance(t,t.at);assert.deepEqual(t,paid);
  const trained=make(),captain=G.clone(trained.captain),gems=trained.gems;G.action(trained,{kind:'train',hero:'harin'},trained.at);assert.deepEqual(trained.captain,captain);assert.equal(trained.gems,gems);assert.equal(G.captainNeed(1),35);assert.equal(G.captainNeed(50),13020);
  const max=make();max.captain={level:200,xp:0};const money=[max.gold,max.gems];win(max);assert.deepEqual([max.gold,max.gems],[money[0]+16,money[1]]);assert.deepEqual(max.captain,{level:200,xp:0});
});
test('Quest progress stays deterministic through save reload and speed changes',()=>{
  const a=make();a.speed=1.5;const b=G.clone(a);G.advance(a,a.at+60000);for(let i=0;i<120;i++)G.advance(b,b.at+500);assert.deepEqual(a,b);assert(a.quests.repeat.kills>0);assert(a.quests.repeat.waves>0);assert(G.validate(a));
});
console.log(`${passed} progression engine checks passed`);
