const assert=require('node:assert/strict'),G=require('../school/engine.js');
const now=Date.parse('2026-11-19T03:00Z'),act=(s,a,rng)=>G.action(s,a,s.at,rng),make=()=>G.create(now,661);
function reject(s,a){const before=G.clone(s);assert.throws(()=>act(s,a));assert.deepEqual(s,before);}
function full(s){s.captain.level=20;s.gems=100000;for(const h of G.HEROES)s.units[h.id]={level:1,xp:0,stars:5,shards:0};}
const s=make();assert(G.validate(s));assert.equal(G.shardInfo(s).unlocked,false);reject(s,{kind:'shard-refine'});full(s);
for(const [roll,rarity] of [[.02,'SR'],[0,'SSR']]){const draws=[roll,0];const result=act(s,{kind:'recruit',count:1,banner:'osia'},()=>draws.shift());assert.deepEqual(result.results[0].converted,{rarity,count:10});assert.equal(result.results[0].shards,0);assert.equal(s.units[result.results[0].id].shards,0);assert.equal(s.shardExchange[rarity],10);}
const lv19=make();full(lv19);lv19.captain.level=19;let rolls=[.02,0];const r=act(lv19,{kind:'recruit',count:1,banner:'osia'},()=>rolls.shift());assert(!r.results[0].converted);assert.equal(lv19.units[r.results[0].id].shards,10);lv19.captain.level=20;act(lv19,{kind:'shard-recycle',hero:r.results[0].id});assert.equal(lv19.shardExchange.SR,10);
const ur=make();full(ur);ur.banners.horas.pity=79;rolls=[.99,0];const h=act(ur,{kind:'recruit',count:1,banner:'horas'},()=>rolls.shift());assert.equal(h.results[0].id,'horas');assert.equal(ur.units.horas.shards,30);assert(!h.results[0].converted);
s.shardExchange={SR:500,SSR:100};const before=G.clone(s);act(s,{kind:'shard-refine',count:5,reward:999999});assert.deepEqual(s.shardExchange,{SR:250,SSR:125});assert.equal(s.gems,before.gems);assert.equal(s.gold,before.gold);
delete s.units.lava;assert(!G.shardInfo(s).choices.includes('lava'));const wallet=G.clone(s.shardExchange);reject(s,{kind:'shard-select',hero:'lava',count:2});assert.deepEqual(s.shardExchange,wallet);
// Legacy banked shards remain available upon first recruitment, but cannot be bought again.
s.heroShards={lava:10};reject(s,{kind:'shard-select',hero:'lava'});s.banners.standard.guarantees=0;s.banners.standard.guaranteed=false;rolls=[0,.999];const first=act(s,{kind:'recruit',count:1,banner:'osia'},()=>rolls.shift());assert.equal(first.results[0].id,'lava');assert.equal(s.units.lava.shards,10);assert(!s.heroShards.lava);assert(G.shardInfo(s).choices.includes('lava'));act(s,{kind:'shard-select',hero:'lava',count:2});assert.equal(s.units.lava.shards,20);assert.equal(s.shardExchange.SSR,105);

for(const hero of ['spica','horas','taeo','__proto__'])reject(s,{kind:'shard-select',hero});
for(const count of [0,-1,.5,101,'1',Infinity])reject(s,{kind:'shard-refine',count});
s.units.osia.shards=45;act(s,{kind:'shard-recycle',hero:'osia',count:2});assert.equal(s.units.osia.shards,5);assert.equal(s.shardExchange.SSR,125);reject(s,{kind:'shard-recycle',hero:'osia'});
const chain=make();full(chain);chain.shardExchange={SR:0,SSR:40};act(chain,{kind:'shard-select',hero:'osia',count:4});act(chain,{kind:'shard-recycle',hero:'osia'});assert.equal(chain.shardExchange.SSR,10,'round trip cannot mint currency');
assert(G.validate(JSON.parse(JSON.stringify(s))));for(const bad of [{SR:-1,SSR:0},{SR:0.1,SSR:0},{SR:1},{SR:0,SSR:Infinity},{SR:0,SSR:0,UR:1}])assert(!G.validate({...s,shardExchange:bad}));
console.log('PASS Lv.20 gate, full-awaken SR/SSR conversion, level-19/UR preservation, exact batches, unowned rejection, owned selection, legacy banking/first recruitment, allowlist, invalid inputs, leftovers, no recycling arbitrage, save validation');
function tower(floor,id='taeo'){
 const s=make();s.units[id]={level:40,xp:0,stars:0,shards:0};s.team=[id];s.activities.towerBest=floor-1;act(s,{kind:'activity',mode:'tower',floor});
 return s;
}
for(let n=1;n<=25;n++){const s=tower(n);assert.equal(s.battle.boss,n%5===0);assert.equal(s.battle.activity.theme,G.TOWER_THEMES[Math.floor((n-1)/5)].id);assert(s.battle.enemies.every(e=>e.towerTrait===s.battle.activity.theme));assert(G.validate(s));}
assert.equal(G.towerEncounter(26).id,G.towerEncounter(1).id);
for(const [floor,hero,type,reduction] of [[5,'taeo','physical',.35],[5,'lumi','magic',0],[10,'taeo','physical',0],[10,'lumi','magic',.35],[25,'lumi','magic',.15]]){
 const reduced=tower(floor,hero),plain=G.clone(reduced);plain.battle.enemies[0].physicalReduction=plain.battle.enemies[0].magicReduction=0;
 for(const s of [plain,reduced]){s.battle.enemies[0].hp=s.battle.enemies[0].max=1e8;G.advance(s,now+1000);}
 const get=s=>s.events.find(e=>e.kind==='hit'&&e.from===hero);assert.equal(get(reduced).amount,Math.max(1,Math.round(get(plain).amount*(1-reduction))));assert.equal(get(reduced).damageType,type);
}
const garden=tower(15);const e=garden.battle.enemies[0];e.hp=e.max/2;e.stunUntil=7000;G.advance(garden,now+6500);assert(!garden.events.some(e=>e.kind==='enemy-heal'));G.advance(garden,now+7000);assert(garden.events.some(x=>x.kind==='enemy-heal'&&x.amount===Math.round(e.max*.02)));
for(const floor of [5,10,15,20,25]){const fine=tower(floor),coarse=G.clone(fine);for(let t=500;t<=9000;t+=500)G.advance(fine,now+t);G.advance(coarse,now+9000);assert.deepEqual(coarse,fine);}
console.log('PASS five zones/unique boss themes, physical/magic damage resistance, delayed regeneration during stun, bounded floor rotation and deterministic reconnect');
