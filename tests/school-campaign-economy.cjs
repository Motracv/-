const assert=require('node:assert/strict');
const G=require('../school/engine.js');
const NOW=Date.parse('2026-11-18T12:00:00+09:00');
let passed=0;const test=(name,run)=>{run();passed++;console.log('PASS',name);};
function make(best,stage){const s=G.create(NOW,287);s.best=best;G.action(s,{kind:'stage',stage,mode:'farm'},s.at);return s;}
function win(s,boss=false){s.battle.boss=boss;s.seed=1;for(const h of s.battle.heroes){h.atk=100000;h.hp=h.max=100000;}for(const e of s.battle.enemies){e.hp=1;e.stunUntil=1e9;}G.advance(s,s.at+1000);assert.equal(s.battle.phase,'victory');}
test('First ten stages retain their normal rewards for progressing accounts; stage-based gold increases later',()=>{
 for(let stage=1;stage<=10;stage++)for(const boss of [false,true]){const s=make(stage-1,stage),r=G.campaignRewardInfo(s,stage,boss);assert.equal(r.eligible,true);assert.equal(r.multiplier,1);assert.equal(r.gold,(12+4*stage)*(boss?3:1));}
 const s=make(60,60),before=G.clone(s);assert(G.campaignRewardInfo(s,60,false).gold>(12+4*60));assert(G.campaignRewardInfo(s,55,false).eligible);assert.equal(G.campaignRewardInfo(s,54,false).eligible,false);assert.deepEqual(s,before);
});
test('Best-stage gap is measured from the actual battle; helper exposes exact reduced rewards',()=>{
 const s=make(60,1);s.stage=60;const r=G.campaignRewardInfo(s);assert.equal(r.stage,1);assert.equal(r.gap,59);assert.equal(r.eligible,false);assert.equal(r.multiplier,.05);assert.equal(r.gold,1);assert.equal(r.xp,0);assert.equal(r.captainXp,0);
 const near=make(60,55);assert.equal(G.campaignRewardInfo(near).multiplier,1);const distant=make(60,54);assert.equal(G.campaignRewardInfo(distant).multiplier,.75);
});
test('Weak-stage farming gives only reduced campaign rewards and no new quest or snowflake progress',()=>{
 for(const boss of [false,true]){const s=make(60,1);s.quests.repeat={kills:99,waves:29,bosses:9};Object.assign(s.quests.daily,{kills:49,waves:14,bosses:1});const before=G.clone(s),reward=G.campaignRewardInfo(s,1,boss);win(s,boss);
  assert.equal(s.gold,before.gold+reward.gold);assert.equal(s.gems,before.gems);assert.deepEqual(s.quests,before.quests);assert.deepEqual(s.winter,before.winter);assert.deepEqual(s.captain,before.captain);assert.deepEqual(s.units,before.units);assert.equal(s.kills,before.kills+3);assert.equal(s.events.filter(e=>e.kind==='snowflake').length,0);const event=s.events.findLast(e=>e.kind==='reward');assert.equal(event.gold,reward.gold);assert.equal(event.xp,reward.xp);assert.equal(event.eligible,false);assert(G.validate(s));
 }
});
test('Nearby farming and progression count quests normally; late-stage rewards match the published helper',()=>{
 for(const [best,stage]of [[60,55],[30,31],[0,1]]){const s=make(best,stage),before=G.clone(s),reward=G.campaignRewardInfo(s,stage,false);win(s);assert.equal(s.gold,before.gold+reward.gold);assert.deepEqual(s.quests.repeat,{kills:3,waves:1,bosses:0});assert.equal(s.quests.daily.kills,3);assert.equal(s.quests.daily.waves,1);assert(s.events.some(e=>e.kind==='reward'&&e.eligible));}
 const first=make(0,1);win(first,true);assert.equal(first.best,1);assert.equal(first.gems,1860);assert(G.questBoard(first,first.at).items.find(q=>q.id==='stage-1').ready);
});
test('Existing quest rewards, earned balances, first-clear claims and offline banks are never confiscated',()=>{
 const s=make(60,1);s.gold=987654;s.gems=12345;s.quests.repeat.kills=100;s.claimed=['stage-1'];s.offline={seconds:600,gold:400,xp:20,captainXp:0};const before=G.clone(s);G.advance(s,s.at);for(const key of ['gold','gems','quests','claimed','offline','winter','banners'])assert.deepEqual(s[key],before[key]);
 const earned=G.action(s,{kind:'quest',quest:'repeat-kills'},s.at);assert.equal(earned.gold,250);assert.equal(earned.gems,40);const beforeOffline=s.gold;G.action(s,{kind:'offline'},s.at);assert.equal(s.gold,beforeOffline+400);assert.equal(s.gems,12385);assert(s.claimed.includes('stage-1'));
});
test('Keyed dungeon and first tower rewards keep their own eligibility independent of campaign best',()=>{
 for(const mode of ['daily','weekly','tower']){const s=make(60,1);G.action(s,{kind:'activity',mode,...(mode==='tower'?{floor:1}:{tier:1})},s.at);const reward=G.activityReward(mode,1),before=[s.gold,s.gems];win(s);assert.equal(s.gold,before[0]+reward.gold);assert.equal(s.gems,before[1]+reward.gems);assert.equal(s.quests.repeat.waves,1);assert.equal(s.quests.repeat.kills,mode==='tower'?3:1);assert.equal(s.quests.repeat.bosses,0);}
});
test('Low-stage reward decisions remain deterministic across reconnect and speed1.5 simulation',()=>{
 const a=make(60,1);a.speed=1.5;const b=G.clone(a);G.advance(a,a.at+60000);for(let i=0;i<120;i++)G.advance(b,b.at+500);assert.deepEqual(a,b);assert.deepEqual(a.quests.repeat,{kills:0,waves:0,bosses:0});assert.equal(a.winter.snowflakes,0);assert(G.validate(a));
});
console.log(`${passed} campaign economy engine checks passed`);
