const assert=require('node:assert/strict'),G=require('../school/engine.js');
const {startsAt:start,endsAt:end}=G.DOUBLE_REWARD_EVENT, before=start-3600000, during=start+3600000;
const test=(name,fn)=>{fn();console.log('PASS',name);};
const win=s=>{s.seed=1;for(const h of s.battle.heroes){h.atk=100000;h.hp=h.max=100000;}for(const e of s.battle.enemies){e.hp=1;e.stunUntil=1e9;}G.advance(s,s.at+1000);assert.equal(s.battle.phase,'victory');};
const totalXp=(u,need)=>u.xp+Array.from({length:u.level-1},(_,i)=>need(i+1)).reduce((a,b)=>a+b,0);

test('KST four-day window is inclusive at start, exclusive at end; fixed rewards do not change',()=>{
 assert.equal(end-start,4*86400000);
 for(const [at,m] of [[start-1,1],[start,2],[end-1,2],[end,1]]){
  assert.equal(G.eventInfo(at).multiplier,m);
  assert.deepEqual(G.rewardBonus({gold:100,xp:13,captainXp:3,snowflakes:2,gems:500,snowmen:1},at),{gold:100*m,xp:13*m,captainXp:3*m,snowflakes:2*m,gems:500,snowmen:1});
 }
 assert.equal(G.eventInfo(start-1).upcoming,true);assert.equal(G.eventInfo(end).active,false);
});
test('Campaign victory grants gold, hero XP, captain XP and snowflakes twice, exactly once',()=>{
 const a=G.create(before,1),b=G.create(during,1);win(a);win(b);
 assert.equal(b.gold-700,2*(a.gold-700));
 for(const id of a.team)assert.equal(totalXp(b.units[id],G.needXp),2*totalXp(a.units[id],G.needXp));
 assert.equal(totalXp(b.captain,G.captainNeed),2*totalXp(a.captain,G.captainNeed));
 assert(a.winter.snowflakes>0);assert.equal(b.winter.snowflakes,2*a.winter.snowflakes);
 const state=G.clone(b);G.advance(b,b.at);assert.deepEqual(b,state);assert(G.validate(b));
 const oldFarm=G.create(during);oldFarm.best=60;G.action(oldFarm,{kind:'stage',stage:1,mode:'farm'},oldFarm.at);win(oldFarm);assert.equal(oldFarm.winter.snowflakes,0);assert.equal(oldFarm.quests.repeat.waves,0);
});
test('Dungeon, tower, quest and daily projections equal actual event payouts; fixed gem rewards retained',()=>{
 for(const kind of ['daily','weekly','tower']){
  const s=G.create(during,1);s.best=60;const base=G.activityReward(kind,1,before),reward=G.activityReward(kind,1,during);
  assert.equal(reward.gold,base.gold*2);assert.equal(reward.xp,base.xp*2);assert.equal(reward.gems,base.gems);
  G.action(s,{kind:'activity',mode:kind,...(kind==='tower'?{floor:1}:{tier:1})},s.at);win(s);
  assert.equal(s.gold-700,reward.gold);assert.equal(s.gems-1800,reward.gems);assert.equal(totalXp(s.units[s.team[0]],G.needXp),reward.xp);
 }
 const s=G.create(during);s.quests.repeat.kills=75;const q=G.questBoard(s,s.at).items.find(q=>q.id==='repeat-kills'),gold=s.gold;
 const result=G.action(s,{kind:'quest',quest:q.id},s.at);assert.equal(result.gold,q.gold);assert.equal(s.gold-gold,q.gold);assert.equal(result.gems,q.gems);assert.throws(()=>G.action(s,{kind:'quest',quest:q.id},s.at));
 const daily=G.action(s,{kind:'daily'},s.at);assert.equal(daily.gold,1300);assert.equal(daily.gems,150);assert.throws(()=>G.action(s,{kind:'daily'},s.at));
 assert.equal(G.captainReward(2,during).gold,G.captainReward(2,before).gold*2);assert.equal(G.captainReward(2,during).gems,160);
});
test('Offline bank integrates only overlap, preserves earlier bank and cap, claims XP without doubling again',()=>{
 for(const boundary of [start,end]){
  const s=G.create(boundary-120000);s.best=20;s.offline={seconds:600,gold:111,xp:17,captainXp:2.125};
  const rate=G.rates(s,before),stop=boundary+120000;
  G.advance(s,stop);
  assert.equal(s.offline.seconds,840);assert.equal(s.offline.gold,111+Math.floor(rate.gold*360/60));assert.equal(s.offline.xp,17+Math.floor(rate.xp*360/60));assert.equal(s.offline.captainXp,2.125+Math.floor(rate.xp*360/60)/8);
  const bank=G.clone(s.offline),initialGold=s.gold,oldUnit=totalXp(s.units[s.team[0]],G.needXp),oldCaptain=totalXp(s.captain,G.captainNeed);
  G.action(s,{kind:'offline'},s.at);assert.equal(totalXp(s.units[s.team[0]],G.needXp)-oldUnit,bank.xp);assert.equal(totalXp(s.captain,G.captainNeed)-oldCaptain,Math.floor(bank.captainXp));assert.equal(s.gold-initialGold,bank.gold);assert.throws(()=>G.action(s,{kind:'offline'},s.at));assert(G.validate(s));
 }
 const capped=G.create(start-60000);capped.offline={seconds:G.OFFLINE_CAP-120,gold:51,xp:3,captainXp:.375};const rate=G.rates(capped,before);
 G.advance(capped,start+3600000);assert.equal(capped.offline.seconds,G.OFFLINE_CAP);assert.equal(capped.offline.gold,51+Math.floor(rate.gold*180/60));
 const full=G.clone(capped.offline);G.advance(capped,capped.at+3600000);assert.deepEqual(capped.offline,full);
 assert.equal(G.offlineRewardSeconds(start-1000,end+1000),8*86400+2);assert.equal(G.offlineRewardSeconds(start,start),0);
});
test('Coupons and snowflake exchange retain advertised amounts inside event',()=>{
 const s=G.create(during),gold=s.gold,gems=s.gems;
 G.action(s,{kind:'redeem',code:'WEEKEND_DOUBLE_REWARDS'},s.at);assert.equal(s.gems-gems,2000);assert.equal(s.gold,gold);
 G.action(s,{kind:'redeem',code:'HYUKJIN_PLEASE_STOP_ASKING'},s.at);assert.equal(s.gems-gems,2500);assert.equal(s.winter.snowflakes,50);
 assert.throws(()=>G.action(s,{kind:'redeem',code:'HYUKJIN_PLEASE_STOP_ASKING'},s.at));
 const exchanged=G.action(s,{kind:'winter-exchange',item:'gold'},s.at);assert.equal(exchanged.gold,1000);assert.equal(s.gold-gold,1000);assert.equal(s.winter.snowflakes,20);
});
test('Farming cache invalidates at event boundaries, not on every frame',()=>{
 const a=G.create(start-1),b=G.clone(a);b.at=start;assert.notEqual(G.farmingFingerprint(a),G.farmingFingerprint(b));a.at=start+1000;assert.equal(G.farmingFingerprint(a),G.farmingFingerprint(b));b.at=end;assert.notEqual(G.farmingFingerprint(a),G.farmingFingerprint(b));
});
