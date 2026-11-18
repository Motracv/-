const assert=require('node:assert/strict'),G=require('../school/engine.js');
const NOW=Date.parse('2026-11-18T08:00:00Z');
function test(name,fn){fn();console.log('PASS',name);}
function setup(team=['harin','sua','lava','osia','horas','ryusion']){
 const s=G.create(NOW,123);for(const id of team)s.units[id]={level:1,stars:0,xp:0,shards:0,nextSkill:1};G.action(s,{kind:'team',team},s.at);
 for(const h of s.battle.heroes)Object.assign(h,{hp:100000,max:100000,atk:1,energy:-1000,shield:0,defense:0});
 s.battle.enemies=[{id:'e0',name:'시험 보스',hp:1000000,max:1000000,atk:100,boss:true,ability:'전체 공격',nextAbilityAt:1000,aoeEvery:1000,aoeMultiplier:1,rageEvery:Infinity,rageStep:0}];return s;
}
function advance(s,time){const events=[];while(s.battle.elapsed<time&&s.battle.phase==='fight'){const seq=s.seq;G.advance(s,s.at+500);events.push(...s.events.filter(e=>e.seq>seq));}return events;}
test('SSR pickup uses 100/1000, independent soft/hard pity and loss guarantee, old pools unchanged',()=>{
 assert.equal(G.BY_ID.ryusion.rarity,'SSR');assert.equal(G.BY_ID.ryusion.role,'수호');assert.equal(G.HEROES.length,17);assert(!G.STANDARD_SSR.includes('ryusion'));
 const s=G.create(NOW,1);s.gems=50000;s.banners.ryusion={pity:79,guaranteed:false};const old=structuredClone(s.banners.osia);let rolls=[.999,.9];let r=G.action(s,{kind:'recruit',banner:'ryusion',count:1},NOW,()=>rolls.shift());assert(r.results[0].lostFeatured);assert.equal(s.gems,49900);assert(G.bannerState(s,'ryusion').guaranteed);assert.deepEqual(s.banners.osia,old);
 s.banners.ryusion.pity=79;r=G.action(s,{kind:'recruit',banner:'ryusion',count:10},NOW,()=>.999);assert.equal(r.results[0].id,'ryusion');assert.equal(s.gems,48900);assert(!G.bannerState(s,'ryusion').guaranteed);assert.equal(s.units.ryusion.level,1);assert.equal(G.recruitRates(59,'ryusion').SSR,.02);assert.equal(G.recruitRates(79,'ryusion').SSR,1);assert(G.validate(s));
 assert.equal(G.bannerHeroRates(s,'osia').ryusion,0);assert.equal(G.bannerHeroRates(s,'horas').ryusion,0);
});
test('English coupons pay exact gems/gold once, case-normalized; old receipts preserved',()=>{
 const s=G.create(NOW),gold=s.gold,gems=s.gems;G.action(s,{kind:'redeem',code:'ryusion_update'},NOW);G.action(s,{kind:'redeem',code:'THANKS_FOR_PLAYING'},NOW);
 assert.equal(s.gold,gold+15000);assert.equal(s.gems,gems+3000);assert.throws(()=>G.action(s,{kind:'redeem',code:'RYUSION_UPDATE'},NOW));assert(G.validate(s));
});
test('All six AoE hits redirect at 5s and 6s, expire exactly at 7s, no multipliers of victim defense',()=>{
 const s=setup();advance(s,4500);assert(!G.ryusionGuard(s.battle.heroes,4500).taunting);const otherHP=s.battle.heroes.slice(0,5).map(h=>h.hp),events=advance(s,6000),hits=events.filter(e=>e.kind==='hit'&&e.side==='hero');
 assert.equal(hits.length,12);assert(hits.every(e=>e.to==='ryusion'));assert(hits.every(e=>e.amount>=32&&e.amount<=41));assert.deepEqual(s.battle.heroes.slice(0,5).map(h=>h.hp),otherHP);assert.equal(events.filter(e=>e.kind==='ryusion-taunt').length,1);
 const after=advance(s,7000).filter(e=>e.kind==='hit'&&e.side==='hero');assert(after.some(e=>e.to==='harin'));assert(!G.ryusionGuard(s.battle.heroes,7000).taunting);
});
test('Taunt works for backline targeting; death removes interception and team mitigation',()=>{
 const s=setup();advance(s,4500);const enemy=s.battle.enemies[0];delete enemy.ability;Object.assign(enemy,{monsterSkill:'후열 저격',nextSkillAt:5000,combatRole:'ranged',skillPower:1,skillEvery:1000});
 const hits=advance(s,5000).filter(e=>e.kind==='hit'&&e.side==='hero');assert.equal(hits[0].to,'ryusion');assert(hits[0].redirectedFrom);
 s.battle.heroes.find(h=>h.id==='ryusion').hp=0;const later=advance(s,6000).filter(e=>e.kind==='hit'&&e.side==='hero');assert(later.every(e=>e.to!=='ryusion'));assert(!G.ryusionGuard(s.battle.heroes,6000).hero);
});
test('Alternating delayed charge/stun and 6-second shields, cast cancelled on death',()=>{
 const s=setup(['ryusion','harin','sua']);const r=s.battle.heroes[0];r.energy=7;const cast=advance(s,1000).find(e=>e.kind==='ryusion-skill');assert.equal(cast.stage,1);assert.equal(s.units.ryusion.nextSkill,2);assert.equal(s.battle.enemies[0].stunUntil,undefined);
 advance(s,1500);assert.equal(s.battle.enemies[0].stunUntil,3500);
 r.energy=7;advance(s,2000);assert.equal(s.battle.ryusionCast.stage,2);advance(s,2500);const amount=Math.round(r.max*.08);assert(s.battle.heroes.every(h=>h.earthShield===amount));assert.equal(s.units.ryusion.nextSkill,1);
 const h=s.battle.heroes[1];h.shield+=777;assert(!G.expireEarthShield(h,8499));assert(G.expireEarthShield(h,8500));assert.equal(h.shield,777);
 r.energy=7;advance(s,3000);r.hp=0;const last=advance(s,3500);assert(!last.some(e=>e.kind==='ryusion-impact'));assert.equal(s.battle.ryusionCast,undefined);
});
test('Earth shields consume first, renew without stacking, never remove Lava shields',()=>{
 const h={shield:50};G.addEarthShield(h,100,1000);assert.equal(h.shield,150);h.shield-=30;G.absorbEarthShield(h,30);assert.equal(h.earthShield,70);G.addEarthShield(h,100,2000);assert.equal(h.shield,150);h.shield+=40;G.expireEarthShield(h,8000);assert.equal(h.shield,90);
});
test('Lava rescue protects redirected lethal AoE once; no revives; chunked save/speed determinism',()=>{
 const s=setup(['ryusion','lava','harin']);advance(s,4500);s.battle.heroes[0].hp=1;const events=advance(s,5000);assert.equal(s.battle.heroes[0].hp,1);assert.equal(events.filter(e=>e.kind==='rescue').length,1);assert(s.battle.lavaRescueUsed);
 const a=setup(),b=structuredClone(a);G.action(a,{kind:'speed',speed:1.5},a.at);G.action(b,{kind:'speed',speed:1.5},b.at);const end=a.at+18000;while(a.at<end)G.advance(a,a.at+500);G.advance(b,end);assert.deepEqual(a,b);assert(G.validate(b));
});
test('Old saves still validate; new units receive all existing growth/equipment/formation actions',()=>{
 const s=G.create(NOW);assert(G.validate(s));s.units.ryusion={level:1,xp:0,stars:0,shards:50};s.gold=100000;G.action(s,{kind:'train',hero:'ryusion'},NOW);G.action(s,{kind:'awaken',hero:'ryusion'},NOW);assert.equal(s.units.ryusion.level,2);assert.equal(s.units.ryusion.stars,1);
 const level={level:100,stars:5};assert(G.stats('ryusion',level).hp>G.stats('geonu',level).hp);assert(G.stats('ryusion',level).atk<G.stats('geonu',level).atk);assert(G.validate(s));
});
(async()=>{const {simulateArena}=await import('../online/arena.mjs');const a=setup(['geonu','lava','osia','doyoon','sua','ryusion']),b=setup(['nari','sua','doyoon','lava','geonu','taeo']);const match=simulateArena(G,[a,b],['A','B'],19);assert.deepEqual(match,simulateArena(G,[a,b],['A','B'],19));assert(match.events.some(e=>e.kind==='ryusion-taunt'));assert(match.events.some(e=>e.kind==='ryusion-skill'));assert(match.events.some(e=>e.redirectedFrom));assert(match.events.some(e=>e.kind==='stun'&&e.from==='ryusion'));assert(match.events.some(e=>e.kind==='shield'&&e.from==='ryusion'));assert(match.final.flat().every(h=>h.hp>=0&&h.shield>=0));console.log('PASS server arena taunt, stun, shield and deterministic replay');})().catch(e=>{console.error(e);process.exitCode=1;});
