const assert=require('node:assert/strict'),G=require('../school/engine.js');
const NOW=Date.parse('2026-11-18T12:00:00+09:00'),MIDNIGHT=Date.parse('2026-11-19T00:00:00+09:00');
const ready=()=>{const s=G.create(NOW,7);s.winter.snowflakes=s.winter.earned=10000;s.winter.snowmen=s.winter.snowmenEarned=10;return s;};
const seq=(...values)=>()=>{assert(values.length,'unexpected entropy read');return values.shift();};
function rejected(s,action,now=NOW,rng=()=>.5){const before=G.clone(s);assert.throws(()=>G.action(s,action,now,rng));assert.deepEqual(s,before);}

assert.equal(G.CATALOG_VERSION,25);
const legacy=G.create(NOW);delete legacy.winter.daily;assert(G.validate(legacy));const wallet=[legacy.gold,legacy.gems,legacy.winter.snowflakes];G.advance(legacy,NOW);assert.deepEqual([legacy.gold,legacy.gems,legacy.winter.snowflakes],wallet);assert.equal(G.winterInfo(legacy,NOW).snowmen,0);
for(const [input,index,type,amount] of [[0,0,'gems',10000],[.000999,0,'gems',10000],[.001,1,'gems',1000],[.010999,1,'gems',1000],[.011,2,'gems',100],[.09999,2,'gems',100],[.45,4,'gold',2600],[.99999,4,'gold',7800]]){
 const s=ready(),before=[s.gold,s.gems],r=G.action(s,{kind:'winter-spin',index:0,amount:1e12,cost:0},NOW,seq(input,input>.9?.99999:0));
 assert.equal(r.index,index);assert.equal(r.reward.type,type);assert.equal(r.reward.amount,amount);assert.equal(s.winter.snowmen,9);assert.equal(s.winter.spins,1);assert.equal(s[type],before[type==='gold'?0:1]+amount);assert(G.validate(s));
}
for(const [gradeRoll,rarity] of [[0,'R'],[.6999,'R'],[.70,'SR'],[.9499,'SR'],[.95,'SSR'],[.9999,'SSR']]){
 const s=ready(),r=G.action(s,{kind:'winter-spin'},NOW,seq(.1,gradeRoll,.9999));assert.equal(r.index,3);assert.equal(r.reward.rarity,rarity);assert.equal(s.equipment.inventory[r.reward.item].count,1);assert(!G.GEAR_BY_ID[r.reward.item].owner);assert.equal(s.winter.snowmen,9);assert(G.validate(s));
}
assert.equal(G.WINTER_ROULETTE.length,5);assert.equal(G.WINTER_ROULETTE.reduce((n,r)=>n+Math.round(r.chance*10000),0),10000);
for(const mutate of [s=>s.gold=Number.MAX_SAFE_INTEGER-7000,s=>s.gems=Number.MAX_SAFE_INTEGER-9000,s=>s.equipment.inventory.chalk_star={count:G.GEAR_MAX_COUNT,stars:0},s=>s.winter.snowmen=0]){
 const s=ready();mutate(s);let draws=0;rejected(s,{kind:'winter-spin'},NOW,()=>{draws++;return 0;});assert.equal(draws,0);
}
for(const n of [-1,1.5,Infinity,NaN]){const s=ready();s.winter.snowmen=n;assert(!G.validate(s));}
const inconsistent=ready();inconsistent.winter.spins=1;assert(!G.validate(inconsistent));
console.log('PASS old-save migration, exact five roulette boundaries, gear pool, forged rewards, ticket consumption and pre-roll overflow rejection');

const event=ready(),before={pulls:event.pulls,banners:G.clone(event.banners),history:G.clone(event.history),gems:event.gems};
event.heroShards={spica:7};const acquired=G.action(event,{kind:'winter-exchange',item:'spica',cost:0,hero:'horas'},NOW);
assert.equal(acquired.hero,'spica');assert.equal(acquired.fresh,true);assert.equal(event.winter.snowflakes,5000);assert.equal(event.units.spica.shards,7);assert.equal(event.units.spica.level,1);assert(event.winter.spicaClaimed);assert.equal(event.heroShards.spica,undefined);
assert.deepEqual({pulls:event.pulls,banners:event.banners,history:event.history,gems:event.gems},before);assert(G.validate(event));rejected(event,{kind:'winter-exchange',item:'spica'},MIDNIGHT);
assert.equal(G.winterInfo(event,MIDNIGHT).items.find(x=>x.id==='spica').remaining,0);
for(const banner of Object.keys(G.BANNERS))assert.equal(G.bannerHeroRates(event,banner).spica,0);
const short=ready();short.winter.snowflakes=4999;rejected(short,{kind:'winter-exchange',item:'spica'});
console.log('PASS one-time 5000-flake Spica unlock, owned shard transfer, no pity/history changes and no daily reset or gacha leak');

const beyondOldEnd=Date.parse('2026-11-25T12:00:00+09:00');assert(G.bannerAvailable('lava',beyondOldEnd));assert(G.bannerAvailable('osia',beyondOldEnd));assert(G.STANDARD_SSR.includes('lava'));
const saved=ready();saved.banners.osia={pity:67,guaranteed:true};saved.pity=67;saved.banners.lava={pity:79,guaranteed:true};saved.gems=5000;
const draw=G.action(saved,{kind:'recruit',banner:'lava',count:1},beyondOldEnd,seq(.999,.999));assert.equal(draw.results[0].id,'lava');assert.deepEqual(saved.banners.osia,{pity:67,guaranteed:true});assert.equal(saved.pity,67);assert.equal(saved.banners.lava.pity,0);
const last=Date.parse('2026-12-03T00:00:00+09:00');assert(G.bannerAvailable('horas',last-1));assert(!G.bannerAvailable('horas',last));saved.banners.horas={pity:79,guaranteed:false};rejected(saved,{kind:'recruit',banner:'horas',count:1},last);
console.log('PASS permanent Osia/Lava independent guaranteed pity and exact Horas limited cutoff');

const weapon=ready();weapon.gems=1000;weapon.weaponBanners.standard.pity=79;const w=G.action(weapon,{kind:'weapon-recruit',banner:'ryusion',count:1},NOW,()=>.999);
assert.equal(w.results[0].item,'earth_shield');assert.equal(weapon.gems,900);assert.equal(weapon.weaponBanners.standard.pity,0);assert.equal(G.weaponBannerState(weapon,'osia').pity,0);
const p0=G.weaponPassive('earth_shield',0),p5=G.weaponPassive('earth_shield',5);assert.equal(p0.tauntReduction,.68);assert(Math.abs(p5.tauntReduction-.72)<1e-12);assert(Math.abs(p5.shieldRatio-.12)<1e-12);assert.equal(p5.tauntShieldRatio,.05);assert.equal(G.ryusionDefense({id:'ryusion'}).tauntReduction,.6);
assert.equal(G.exclusivePassive(weapon,'harin'),null);assert.equal(G.gearBonus('earth_shield',5).hp,.12);
assert.equal(G.basicAttackRate({hasteUntil:100,slowUntil:100},0),1);assert.equal(G.basicAttackRate({slowUntil:100},0,true),.925);assert.equal(G.basicAttackRate({hasteUntil:100},100),1);
console.log('PASS Ryusion weapon exact selected guarantee/shared standard pity, bounded mitigation/shield and nonstacking tempo modifiers');

function battle(disableSpica=false){const s=G.create(NOW,2);s.units.spica={level:70,stars:0,xp:0,shards:0};s.team=['spica','harin'];G.action(s,{kind:'stage',stage:1,mode:'farm'},NOW);for(const h of s.battle.heroes){h.max=h.hp=1e8;h.atk=1;}if(disableSpica)s.battle.heroes[0].energy=-999;s.battle.enemies=[{id:'e0',max:1e8,hp:1e8,atk:1}];return s;}
function run(s){let seen=0,events=[];for(let n=1;n<=80;n++){G.advance(s,NOW+n*500);events.push(...s.events.filter(e=>e.seq>seen));seen=s.seq;}return{events,basic:events.filter(e=>e.kind==='hit'&&e.from==='harin'&&!e.skill).length,skill:events.filter(e=>e.kind==='skill'&&e.from==='harin').length,enemy:events.filter(e=>e.kind==='hit'&&e.from==='e0').length};}
const active=battle(),a=run(active),b=run(battle(true)),coarse=battle();G.advance(coarse,NOW+40000);assert.deepEqual(active,coarse);assert(G.validate(active));
assert.equal(a.basic,35);assert.equal(b.basic,32);assert.equal(a.skill,b.skill);assert.equal(a.skill,8);assert.equal(a.enemy,37);assert.equal(b.enemy,40);assert.equal(a.events.filter(e=>e.kind==='spica-skill').length,4);
assert(a.events.some(e=>e.kind==='haste'&&e.duration===6000));assert(a.events.some(e=>e.kind==='slow'&&e.duration===5000));
const expired=active.battle.heroes.find(h=>h.id==='harin');expired.hasteUntil=1;assert.equal(G.basicAttackRate(expired,active.battle.elapsed),1);
console.log('PASS actual campaign haste adds basic attacks, slow removes basic attacks, skill charges unchanged and split/reloaded clock is deterministic');
