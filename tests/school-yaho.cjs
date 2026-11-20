'use strict';
const assert=require('node:assert/strict'),G=require('../school/engine.js'),R=require('../school/raid-engine.js');
const NOW=Date.parse('2026-11-20T10:00Z');
const make=(ids=['yaho','lava','taeo'])=>{const s=G.create(NOW,321);s.gems=100000;for(const id of ids)s.units[id]={level:100,stars:5,xp:0,shards:0};G.action(s,{kind:'team',team:ids},s.at);return s;};
const unit=(id='yaho',hp=1000)=>({id,hp,max:1000,atk:100,energy:0});
assert.equal(G.BY_ID.yaho.rarity,'SSR');assert.equal(G.BY_ID.yaho.element,'fire');assert.equal(G.recruitCost('yaho',1),100);assert.equal(G.recruitCost('yaho',10),1000);
for(const p of[0,58,59,78,79])assert.deepEqual(G.recruitRates(p,'yaho'),G.recruitRates(p,'ryusion'));
for(const b of Object.keys(G.BANNERS).filter(b=>b!=='yaho'))assert.equal(G.bannerHeroRates(make(),b).yaho,0,b);
{
 const s=make();s.banners.horas.pity=31;s.banners.yaho={pity:79,guaranteed:true};const r=G.action(s,{kind:'recruit',banner:'yaho',count:1},NOW,()=>.99);assert.equal(r.results[0].id,'yaho');assert.equal(s.gems,99900);assert.equal(s.banners.yaho.pity,0);assert.equal(s.banners.horas.pity,31);
 const rates=G.bannerHeroRates(make(),'yaho');assert.equal(rates.yaho,G.recruitRates(0,'yaho').SSR*.5);
 const legacy=G.create(NOW);delete legacy.banners.yaho;const old=G.clone(legacy);G.advance(legacy,NOW);assert.deepEqual(legacy.units,old.units);assert.equal(legacy.gems,old.gems);assert(G.validate(legacy));
}
console.log('PASS pickup-only acquisition, SSR costs and pity, independent progress, legacy save migration');
{
 const u=unit(),weak=unit('lava',100),dead=unit('nari',0),all=[u,weak,dead],heals=[],events=[];
 const heal=(a,n,name)=>{heals.push({id:a.id,n,name});a.hp=Math.min(a.max,a.hp+n);},emit=(kind,e)=>events.push({kind,...e});
 G.yahoBasic(u,all,heal);assert.equal(weak.hp,210);assert.equal(heals[0].name,'내가 건내준 힘');assert.equal(dead.hp,0);
 G.yahoCast(u,all,1000,heal,emit);assert.equal(weak.hp,570);assert.equal(G.yahoDamageMultiplier(weak,8999),1.35);assert.equal(G.yahoDamageMultiplier(weak,9000),1);
 G.yahoCast(u,all,7000,heal,emit);assert.equal(G.yahoProtectionMultiplier(weak,12999),.72);assert.equal(G.yahoProtectionMultiplier(weak,13000),1);
 assert.equal(G.yahoMasterMultiplier('lava',all),1.4);assert.equal(G.yahoMasterMultiplier('nari',all),1);u.hp=0;assert.equal(G.yahoMasterMultiplier('lava',all),1);const count=heals.length;G.yahoBasic(u,all,heal);assert.equal(heals.length,count);u.hp=1000;
 for(let t=500;t<=18000;t+=500)G.yahoStep(u,all,t,500,heal,emit,t<=3000);assert(!u.yaho.summoned);assert.equal(u.yaho.activeMs,15000);
 for(let t=18500;t<=40000;t+=500)G.yahoStep(u,all,t,500,heal,emit);
 assert.equal(events.filter(e=>e.stage===3).length,1);assert(!G.yahoCast(u,all,40000,heal,emit,true));assert(u.yaho.summoned);assert.equal(dead.hp,0);assert(weak.hp<=weak.max);
 u.yaho.next=2;weak.hp=500;G.yahoCast(u,all,45000,heal,emit);assert.equal(weak.hp,660);assert(Math.abs(G.yahoProtectionMultiplier(weak,52999)-.58)<1e-9);assert.equal(G.yahoProtectionMultiplier(weak,53000),1);assert.equal(events.at(-1).name,'산군의 가호');assert(G.validYaho(u));
 for(const activeMs of[-1,Infinity,NaN,18001])assert(!G.validYaho({...u,yaho:{...u.yaho,activeMs}}));
}
console.log('PASS weakest living ally healing, exact buff expiry, no stacking/resurrection, living Lava synergy, paused charge and one upgraded ultimate');
for(const speed of[1,1.5]){
 const a=make();a.speed=speed;for(const h of a.battle.heroes)h.hp=h.max=1e7;for(const e of a.battle.enemies){e.hp=e.max=1e9;e.atk=1;}
 const b=G.clone(a),ults=new Set();G.advance(a,NOW+24000);for(let i=0;i<48;i++){G.advance(b,b.at+500);for(const e of b.events)if(e.kind==='yaho-skill'&&e.stage===3)ults.add(e.seq||e.id||e.time);}assert.deepEqual(a,b);assert(G.validate(a));assert(a.battle.heroes[0].yaho.summoned);assert.equal(ults.size,1);
}
{
 const s=make();const u=s.battle.heroes[0];G.yahoInit(u).summoned=true;u.yaho.activeMs=18000;s.battle.phase='victory';s.battle.wait=.5;s.battle.boss=false;G.advance(s,s.at+500);assert(s.battle.heroes[0].yaho.summoned,'same-stage wave retains summon');
 s.battle.phase='victory';s.battle.wait=.5;s.battle.boss=true;G.advance(s,s.at+500);assert(!s.battle.heroes[0].yaho?.summoned,'new farming run resets summon');
 G.yahoInit(s.battle.heroes[0]).summoned=true;G.action(s,{kind:'team',team:['yaho','taeo']},s.at);assert(!s.battle.heroes[0].yaho?.summoned,'formation restarts battle');
}
console.log('PASS 1×/1.5× save/reconnect parity, stage-wave continuity, farming/retry resets');
const enc={physical:true,duration:90000,bossAct(){}};
{
 const r=R.create(G,[{account:'a',save:make()},{account:'b',save:make(['nari','taeo'])}],NOW,1);for(const team of r.teams)for(const u of team.units)u.hp=Math.round(u.max*.25);
 const copy=G.clone(r);R.advance(G,r,NOW+22000,enc);for(let t=250;t<=22000;t+=250)R.advance(G,copy,NOW+t,enc);assert.deepEqual(r,copy);assert(r.teams[0].units[0].yaho.summoned);assert.equal(r.events.filter(e=>e.kind==='yaho-skill'&&e.stage===3).length,1);assert(r.teams[1].units.every(u=>!u.yahoGuardUntil&&!u.yahoRoarUntil));assert(r.teams.every(t=>t.units.every(u=>u.hp>=0&&u.hp<=u.max)));assert(r.teams[0].units[0].healing>0);
 const f=R.create(G,[{account:'a',save:make(['yaho'])}],NOW,1);f.teams[0].frozen={at:0};R.advance(G,f,NOW+20000,enc);assert(!f.teams[0].units[0].yaho?.summoned);assert.equal(f.damage,0);delete f.teams[0].frozen;R.advance(G,f,NOW+38000,enc);assert(f.teams[0].units[0].yaho.summoned);
}
console.log('PASS raid/Yeti shared rules, frozen charge, exact chunk parity, team-isolated buffs and finite health');
(async()=>{const {simulateArena}=await import('../online/arena.mjs');const saves=[make(['yaho','lava','taeo']),make(['yaho','lava','taeo'])],r=simulateArena(G,saves,['A','B'],55);assert.deepEqual(r,simulateArena(G,saves,['A','B'],55));for(const side of[0,1])assert(r.events.filter(e=>e.kind==='yaho-skill'&&e.stage===3&&e.side===side).length<=1);assert(r.events.some(e=>e.kind==='yaho-skill'&&e.stage===3));assert(r.final.flat().every(u=>Number.isFinite(u.hp)&&u.hp>=0));assert(r.damage.flat().some(u=>u.id==='yaho'&&u.healing>0));console.log('PASS deterministic arena, at most one guardian per side and actual healing meters');})().catch(e=>{console.error(e);process.exitCode=1;});
