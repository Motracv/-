const assert=require('node:assert/strict'),fs=require('node:fs');const G=require('../school/engine.js'),Auto=require('../school/tower-auto.js'),F=require('../school/combat-feedback.js');
const now=Date.parse('2026-11-24T00:00:00Z');
const fresh=()=>G.create(now,489);
for(let stars=0;stars<=5;stars++){
 const s=fresh(),u=s.units.taeo;u.level=100;u.stars=stars;u.xp=0;s.gold=3000000;assert.equal(G.levelCap(u),100+5*stars);assert(G.validate(s));
 if(!stars){assert.throws(()=>G.action(s,{kind:'train',hero:'taeo',count:10},s.at));continue;}
 const q=G.trainingQuote(u,10),before=s.gold;G.action(s,{kind:'train',hero:'taeo',count:10},s.at);assert.equal(u.level,100+Math.min(10,5*stars));assert.equal(s.gold,before-q.cost);assert(G.validate(s));
 while(u.level<G.levelCap(u))G.action(s,{kind:'train',hero:'taeo',count:10},s.at);assert.equal(u.level,G.levelCap(u));if(stars===5)assert.equal(3000000-s.gold,2000000);
 u.level++;assert(!G.validate(s));
}
{
 const s=fresh();s.units.taeo={level:100,stars:5,xp:0,shards:0};s.gold=10000;const before=G.clone(s);assert.throws(()=>G.action(s,{kind:'train',hero:'taeo',count:10},s.at));assert.deepEqual(s,before);
}
assert.equal(G.CHAPTERS.length,25);assert.equal(G.stageName(100),'20-5');assert.equal(G.stageName(101),'하드 1-1');assert.equal(G.stageName(125),'하드 5-5');
for(let stage=71;stage<=125;stage++){
 const s=fresh();s.best=stage-1;s.stage=stage;s.wave=4;s.units.taeo={level:125,stars:5,xp:0,shards:0};G.action(s,{kind:'team',team:['taeo']},s.at);
 assert(G.validate(s));for(const e of s.battle.enemies){assert.equal(typeof e.name,'string');assert.equal(typeof e.ability,'string');assert(Number.isFinite(e.max)&&e.max>0);}
 if([100,125].includes(stage)){s.battle.enemies.forEach(e=>{e.hp=1;e.atk=0;});s.battle.heroes[0].atk=1e9;G.advance(s,s.at+12000);assert(s.best>=stage);assert.equal(s.stage,Math.min(stage+1,125));assert(G.validate(s));}
}
const p=fresh();assert.equal(p.battlePass,undefined);let info=G.passInfo(p);assert.equal(info.level,1);assert.equal(p.battlePass,undefined);const gems=p.gems;
G.action(p,{kind:'pass-quest',quest:'login'},p.at);assert.equal(p.battlePass.xp,40);const prior=G.clone(p);assert.throws(()=>G.action(p,{kind:'pass-quest',quest:'login'},p.at));assert.deepEqual(p,prior);
G.action(p,{kind:'pass-reward',level:1},p.at);assert.equal(p.gold,prior.gold+4500);assert.equal(p.gems,gems);assert.throws(()=>G.action(p,{kind:'pass-reward',level:50},p.at));assert.throws(()=>G.action(p,{kind:'pass-reward',level:1},p.at));
p.at+=86400000;G.action(p,{kind:'pass-quest',quest:'login'},p.at);assert.equal(p.battlePass.xp,80);
p.battlePass.xp=4900;const beforeGold=p.gold;for(let level=2;level<=50;level++)G.action(p,{kind:'pass-reward',level},p.at);assert.equal(p.gems,gems);assert.equal(p.battlePass.rewards.length,50);assert(p.winter.snowflakes>0);assert(Object.keys(p.equipment.inventory).every(id=>!G.GEAR_BY_ID[id].owner));assert(G.validate(p));assert(!G.passInfo(p).quests.some(q=>q.ready));
const over=G.clone(p);over.battlePass.rewards=[];const item=G.passReward(50).item;over.equipment.inventory[item]={count:G.GEAR_MAX_COUNT,stars:0};const snapshot=G.clone(over);assert.throws(()=>G.action(over,{kind:'pass-reward',level:50},over.at));assert.deepEqual(over,snapshot);
// Only newly eligible wins accrue; viewing a legacy save cannot create progress.
const fight=fresh();fight.units.taeo={level:70,stars:5,xp:0,shards:0};G.action(fight,{kind:'team',team:['taeo']},fight.at);G.advance(fight,fight.at+6000);assert(fight.battlePass.counts.kills>0);assert(G.validate(fight));
const skin=fresh();skin.units.horas={level:70,stars:3,xp:0,shards:0};assert(!G.ownsProfileAvatar(skin,'horas-after-school'));skin.redeemedCodes.push(G.SKINS.horas_after_school.receipt);assert(G.ownsProfileAvatar(skin,'horas-after-school'));assert(!G.bondInfo(skin,now,'horas').meta.skin);G.action(skin,{kind:'skin-equip',hero:'horas',skin:'horas_after_school'},now);assert.equal(G.bondInfo(skin,now,'horas').meta.skin,'horas_after_school');assert(G.bondInfo(skin,now,'horas').avatar);G.action(skin,{kind:'skin-equip',hero:'horas',skin:null},now);assert(!G.bondInfo(skin,now,'horas').meta.skin);assert(G.ownsProfileAvatar(skin,'horas-after-school'));
const a=Auto.create(),opts={scope:'A',enabled:false,result:{runId:'one',kind:'tower',won:true,floor:1},confirmed:true,blocked:false,now:0,maxFloor:100};assert.deepEqual(a.tick(opts),{stop:false});opts.enabled=true;assert.equal(a.tick(opts).remaining,3);assert.equal(a.tick({...opts,now:2000}).remaining,1);assert.deepEqual(a.tick({...opts,now:3000}),{floor:2});assert.deepEqual(a.tick({...opts,now:4000}),{waiting:true});a.acknowledge(true);assert.deepEqual(a.tick({...opts,now:4001}),{});opts.result.runId='two';assert.equal(a.tick({...opts,now:5000}).remaining,3);assert.deepEqual(a.tick({...opts,now:7000,blocked:true}),{waiting:true});assert.equal(a.tick({...opts,now:9000}).floor,2);assert.equal(a.tick({...opts,result:{...opts.result,won:false},now:10000}).stop,true);
const unit={id:'hyeokjin',hp:100,hyeokjin:{mode:'idle',modeUntil:0}},events=[{id:'hyeokjin',team:1,kind:'hyeokjin-mode',mode:'black',shown:5000,duration:1500,impactDelay:600}];const vu=F.hyeokjinPresentation(unit,1,events,5500,10000);assert.equal(vu.hyeokjin.mode,'black');assert.equal(10000-vu.hyeokjin.began,500);assert.equal(F.hyeokjinPresentation(unit,0,events,5500,10000),unit);assert.equal(F.hyeokjinPresentation(unit,1,events,5500,10000,true).hyeokjin.mode,'idle');assert.equal(unit.hyeokjin.mode,'idle');assert.equal(F.basicMs('horas'),1180);
console.log('PASS growth caps/atomic 10-level costs/exact 2M, 55 late-stage spawns/progression, free pass/daily/claim/overflow, skin ownership, confirmed tower auto and scoped motion replay');
