const assert=require('node:assert/strict'),G=require('../school/engine.js'),R=require('../school/raid-engine.js');
const NOW=Date.parse('2026-11-19T10:00Z');
const make=(ids=['hyeokjin','ryusion','lava'])=>{const s=G.create(NOW,321);s.gems=100000;for(const id of ids)s.units[id]={level:100,stars:5,xp:0,shards:0};G.action(s,{kind:'team',team:ids},s.at);return s;};
const fighter=()=>({id:'hyeokjin',hp:1000,max:1000,atk:100,energy:0});
assert.equal(G.BY_ID.hyeokjin.rarity,'UR');assert.equal(G.damageType('hyeokjin'),'physical');assert.equal(G.recruitCost('hyeokjin',1),160);assert.equal(G.recruitCost('hyeokjin',10),1600);
for(const p of [0,58,59,78,79]){const rates=G.recruitRates(p,'hyeokjin');assert.deepEqual(rates,G.recruitRates(p,'horas'));assert(Math.abs(Object.values(rates).reduce((a,b)=>a+b,0)-1)<1e-8);}
const s=make();s.banners.horas.pity=57;s.banners.hyeokjin.pity=79;const result=G.action(s,{kind:'recruit',banner:'hyeokjin',count:1},NOW,()=>.99);assert.equal(result.results[0].id,'hyeokjin');assert.equal(s.banners.hyeokjin.pity,0);assert.equal(s.banners.horas.pity,57);assert.equal(s.gems,100000-160);
s.banners.hyeokjin.pity=13;const rolls=[.004,0];const ssr=G.action(s,{kind:'recruit',banner:'hyeokjin',count:1},NOW,()=>rolls.shift()).results[0];assert.equal(G.BY_ID[ssr.id].rarity,'SSR');assert.equal(s.banners.hyeokjin.pity,14);
for(const id of ['standard','kazua','ryusion','horas'])assert.equal(G.bannerHeroRates(s,id).hyeokjin,0);
const legacy=G.create(NOW);delete legacy.banners.hyeokjin;const old=G.clone(legacy);G.advance(legacy,NOW);assert.deepEqual(legacy.units,old.units);assert.equal(legacy.gems,old.gems);assert(G.validate(legacy));
console.log('PASS independent UR pity, SSR preserves UR count, hard pity only Hyeokjin, correct prices and legacy migration');
{
 const u=fighter(),all=[u];G.hyeokjinInit(u,all);u.hp-=G.hyeokjinGuard(u,all,1000,99999);assert.equal(u.hp,1);assert.equal(u.hyeokjin.until,9000);assert(!u.hyeokjin.lastUsed);
 assert.equal(G.hyeokjinGuard(u,all,8999,9999),0);assert.equal(G.hyeokjinGuard(u,all,9000,9999),9999);assert.equal(u.hyeokjin.until,9000);
 G.hyeokjinRecord(u,1000,2000);assert.equal(u.hp,81);G.hyeokjinRecord(u,1000,2500);assert.equal(u.hp,81);G.hyeokjinRecord(u,10,3000);assert.equal(u.hp,83);assert.equal(u.hyeokjin.total,2010);
 G.hyeokjinRecord(u,9000,3000,()=>{},true);assert.equal(u.hyeokjin.total,2010);assert.equal(u.hp,161);
 const hp=u.hp;G.hyeokjinRecord(u,0,4000);assert.equal(u.hp,hp);u.hp=0;G.hyeokjinRecord(u,100,5000);assert.equal(u.hp,0);
 assert(G.validHyeokjin(u.hyeokjin));for(const value of [NaN,Infinity,-1])assert(!G.validHyeokjin({...u.hyeokjin,total:value}));
}
{
 const u=fighter(),ally={id:'lava',hp:100},all=[u,ally];G.hyeokjinInit(u,all);G.hyeokjinGuard(u,all,1000,700);ally.hp=0;
 assert.equal(G.hyeokjinGuard(u,all,2000,9999),0);assert.equal(u.hyeokjin.lastUntil,7000);assert.equal(u.hyeokjin.until,9000);G.hyeokjinRefresh(u,all,3000);assert.equal(u.hyeokjin.lastUntil,7000);
}
console.log('PASS lethal threshold protection, exact 8s expiry, once-only last survivor, independent overlapping clocks and actual-damage capped lifesteal');
function ult(count=3,blocked=false,pool=5000){const u=fighter(),enemies=Array.from({length:count},(_,i)=>({id:'e'+i,hp:1e5,max:1e5})),hits=[],events=[];G.hyeokjinInit(u,[u]);u.hp-=G.hyeokjinGuard(u,[u],1000,900);u.hyeokjin.total=pool;
 const step=t=>G.hyeokjinStep(u,[u],enemies,t,250,(e,n,d)=>{e.hp-=n;hits.push({n,...d});return n;},(kind,e)=>events.push({kind,...e}),blocked&&t>=3000);
 for(let t=2000;t<=8000;t+=250)step(t);return{u,enemies,hits,events};}
const a=ult();assert.equal(a.events.filter(e=>e.kind==='hyeokjin-mode'&&e.mode==='ultimate').length,1);const burst=a.hits.filter(h=>h.ultimate);assert.equal(burst.length,3);assert.deepEqual(burst.map(h=>h.n),[2100,450,450]);assert(burst.every(h=>h.fixed));assert.equal(ult(1).hits.filter(h=>h.ultimate)[0].n,3000);assert.equal(ult(1,false,0).hits.filter(h=>h.ultimate).length,0);assert.equal(ult(3,true).hits.filter(h=>h.ultimate).length,0);assert(ult(3,true).events.some(e=>e.kind==='hyeokjin-cancel'));
console.log('PASS one ultimate, 3000% cap, 70/30 split or full solo damage, zero-pool suppression and interrupted cast cancellation');
for(const speed of [1,1.5]){
 const a=make();a.speed=speed;for(const h of a.battle.heroes)h.hp=h.max=1e7;for(const e of a.battle.enemies){e.hp=e.max=1e9;e.atk=1;}
 a.battle.heroes[0].hp=1e6;const b=G.clone(a);G.advance(a,NOW+20000);for(let i=0;i<40;i++)G.advance(b,b.at+500);assert.deepEqual(a,b);assert(G.validate(a));assert(a.battle.heroes[0].hyeokjin.used);assert(a.events.some(e=>e.kind==='hyeokjin-impact'));
}
const immune=R.create(G,[{account:'one',save:make(['hyeokjin'])}],NOW,1);R.advance(G,immune,NOW+15000);assert.equal(immune.damage,0);assert(immune.events.some(e=>e.kind==='immune'));assert.equal(immune.teams[0].units[0].hyeokjin.total,0);
const raid=R.create(G,[{account:'one',save:make()},{account:'two',save:make()}],NOW,1),enc={physical:true,duration:90000,bossAct(){}};for(const t of raid.teams){t.units[0].hp=Math.floor(t.units[0].max*.15);}const copy=G.clone(raid);R.advance(G,raid,NOW+20000,enc);for(let t=250;t<=20000;t+=250)R.advance(G,copy,NOW+t,enc);assert.deepEqual(raid,copy);assert(raid.teams.every(t=>t.units[0].damage>0));assert.equal(R.HP-raid.boss.hp,raid.damage);
const frozen=R.create(G,[{account:'a',save:make(['hyeokjin'])}],NOW,1);frozen.teams[0].frozen={at:0};R.advance(G,frozen,NOW+10000,enc);assert.equal(frozen.damage,0);
console.log('PASS campaign save/reconnect/1.5× parity, guild physical immunity, duo exact shared damage and freeze stops attacks');
(async()=>{const {simulateArena}=await import('../online/arena.mjs');const teams=[make(['hyeokjin','taeo']),make(['horas','kazua','osia'])],r=simulateArena(G,teams,['A','B'],55);assert.deepEqual(r,simulateArena(G,teams,['A','B'],55));assert(r.events.some(e=>e.kind==='hyeokjin-mode'));assert(r.final.flat().every(u=>Number.isFinite(u.hp)&&u.hp>=0));assert(r.events.filter(e=>e.kind==='hyeokjin-mode'&&e.mode==='ultimate').length<=1);assert(r.damage[0].find(u=>u.id==='hyeokjin').damage>0);console.log('PASS deterministic arena replay with finite HP, actual damage and at most one ultimate');})().catch(e=>{console.error(e);process.exitCode=1;});
