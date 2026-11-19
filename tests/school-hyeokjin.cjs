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
function ult(count=3,blocked=false,pool=10000){const u=fighter(),enemies=Array.from({length:count},(_,i)=>({id:'e'+i,hp:1e5,max:1e5})),hits=[],events=[];G.hyeokjinInit(u,[u]);u.hp-=G.hyeokjinGuard(u,[u],1000,900);u.hyeokjin.total=pool;
 const step=t=>G.hyeokjinStep(u,[u],enemies,t,250,(e,n,d)=>{e.hp-=n;hits.push({n,...d});return n;},(kind,e)=>events.push({kind,...e}),blocked&&t>=3000);
 for(let t=2000;t<=8000;t+=250)step(t);return{u,enemies,hits,events};}
const a=ult();assert.equal(a.events.filter(e=>e.kind==='hyeokjin-mode'&&e.mode==='ultimate').length,1);const burst=a.hits.filter(h=>h.ultimate);assert.equal(burst.length,3);assert.deepEqual(burst.map(h=>h.n),[8400,1800,1800]);assert(burst.every(h=>h.fixed));assert.equal(ult(1).hits.filter(h=>h.ultimate)[0].n,12000);assert.equal(ult(1,false,0).hits.filter(h=>h.ultimate)[0].n,2000);assert.equal(ult(3,true).hits.filter(h=>h.ultimate).length,0);assert(ult(3,true).events.some(e=>e.kind==='hyeokjin-cancel'));
console.log('PASS one ultimate, 12000% cap, 70/30 split or full solo damage, minimum 2000% strike without previous hits and interrupted cast cancellation');
// Cleave must stop at three living enemies; execution remains strictly single-target.
for(const [mode,expected] of [['basic',[660,230,230]],['recovery',[900,400,400]],['black',[900,900,900]]]){
 const u=fighter(),enemies=Array.from({length:5},(_,i)=>({id:'e'+i,hp:10000,max:10000})),hits=[];
 const q=G.hyeokjinInit(u,[u]);q.mode=mode;q.began=1000;q.modeUntil=2500;q.cast={mode,at:2000,amount:0,targets:enemies.map(e=>e.id),done:false,awakened:false};
 G.hyeokjinStep(u,[u],enemies,2000,250,(e,n)=>{hits.push(n);e.hp-=n;return n;});assert.equal(hits.length,expected.length);assert(hits.every((n,i)=>Math.abs(n-expected[i])<1e-8));assert.equal(enemies[4].hp,10000);
 G.hyeokjinStep(u,[u],enemies,2250,250,()=>assert.fail('same cast dealt damage twice'));
}
console.log('PASS stronger primary/cleave damage, three-target limit and no duplicate impact');
// A six-hit execution is serialized mid-combo; no re-target, extra full damage or heal farming.
function executionFixture(low=false){const u=fighter(),enemies=[{id:'one',max:100000,hp:low?30000:100000},{id:'two',max:100000,hp:100000}];const q=G.hyeokjinInit(u,[u]);q.mode='execution';q.began=1000;q.modeUntil=3200;q.cast={mode:'execution',at:1500,amount:0,targets:['one'],tick:0,done:false,awakened:false};return{u,enemies,hits:[],heals:[]};}
function executionStep(f,time,blocked=false){G.hyeokjinStep(f.u,[f.u],f.enemies,time,250,(e,n,d)=>{const actual=Math.min(e.hp,n);e.hp-=actual;f.hits.push({amount:actual,tick:d.comboTick,to:e.id});return actual;},(kind,e)=>{if(kind==='heal')f.heals.push(e);},blocked);}
for(const low of [false,true]){const f=executionFixture(low);executionStep(f,1499);assert.equal(f.hits.length,0);executionStep(f,1500);assert.equal(f.hits.length,1);const copy=G.clone(f);for(let t=1750;t<=2750;t+=250){executionStep(f,t);executionStep(copy,t);}assert.deepEqual(f,copy);assert.equal(f.hits.length,6);assert.deepEqual(f.hits.map(h=>h.tick),[0,1,2,3,4,5]);assert(Math.abs(f.hits.reduce((n,h)=>n+h.amount,0)-(low?2100:1400))<1e-8);assert.equal(f.enemies[1].hp,100000);assert(G.validHyeokjin(f.u.hyeokjin));executionStep(f,3000);assert.equal(f.hits.length,6);}
for(const stop of ['stun','death','target-death']){const f=executionFixture();executionStep(f,1500);if(stop==='death')f.u.hp=0;if(stop==='target-death')f.enemies[0].hp=0;executionStep(f,1750,stop==='stun');assert.equal(f.hits.length,1);assert.equal(f.enemies[1].hp,100000);}
{const f=executionFixture();f.u.hp=500;f.enemies[0].hp=100;executionStep(f,1500);executionStep(f,2000);assert.equal(f.heals.length,1);assert.equal(f.u.hp,650);assert.equal(f.hits.length,1);}
{const f=executionFixture();for(const value of [-1,6.1,Infinity])assert(!G.validHyeokjin({...f.u.hyeokjin,cast:{...f.u.hyeokjin.cast,tick:value}}));}
console.log('PASS six timed X hits, preserved total damage, replay/save parity, one kill heal, locked target and interruption cancellation');
for(const speed of [1,1.5]){
 const a=make();a.speed=speed;for(const h of a.battle.heroes)h.hp=h.max=1e7;for(const e of a.battle.enemies){e.hp=e.max=1e9;e.atk=1;}
 a.battle.heroes[0].hp=1e6;const b=G.clone(a);G.advance(a,NOW+20000);for(let i=0;i<40;i++)G.advance(b,b.at+500);assert.deepEqual(a,b);assert(G.validate(a));assert(a.battle.heroes[0].hyeokjin.used);assert(a.events.some(e=>e.kind==='hyeokjin-impact'));
}
const immune=R.create(G,[{account:'one',save:make(['hyeokjin'])}],NOW,1);R.advance(G,immune,NOW+15000);assert.equal(immune.damage,0);assert(immune.events.some(e=>e.kind==='immune'));assert.equal(immune.teams[0].units[0].hyeokjin.total,0);
const raid=R.create(G,[{account:'one',save:make()},{account:'two',save:make()}],NOW,1),enc={physical:true,duration:90000,bossAct(){}};for(const t of raid.teams){t.units[0].hp=Math.floor(t.units[0].max*.15);}const copy=G.clone(raid);R.advance(G,raid,NOW+20000,enc);for(let t=250;t<=20000;t+=250)R.advance(G,copy,NOW+t,enc);assert.deepEqual(raid,copy);assert(raid.teams.every(t=>t.units[0].damage>0));assert.equal(R.HP-raid.boss.hp,raid.damage);
const frozen=R.create(G,[{account:'a',save:make(['hyeokjin'])}],NOW,1);frozen.teams[0].frozen={at:0};R.advance(G,frozen,NOW+10000,enc);assert.equal(frozen.damage,0);
console.log('PASS campaign save/reconnect/1.5× parity, guild physical immunity, duo exact shared damage and freeze stops attacks');
(async()=>{const {simulateArena}=await import('../online/arena.mjs');const teams=[make(['hyeokjin','taeo']),make(['horas','kazua','osia'])],r=simulateArena(G,teams,['A','B'],55);assert.deepEqual(r,simulateArena(G,teams,['A','B'],55));assert(r.events.some(e=>e.kind==='hyeokjin-mode'));assert(r.final.flat().every(u=>Number.isFinite(u.hp)&&u.hp>=0));assert(r.events.filter(e=>e.kind==='hyeokjin-mode'&&e.mode==='ultimate').length<=1);assert(r.damage[0].find(u=>u.id==='hyeokjin').damage>0);console.log('PASS deterministic arena replay with finite HP, actual damage and at most one ultimate');})().catch(e=>{console.error(e);process.exitCode=1;});
