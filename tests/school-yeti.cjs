const assert=require('node:assert/strict'),G=require('../school/engine.js');
require('../school/raid-engine.js');const Y=require('../school/yeti-engine.js');
const now=Date.parse('2026-11-18T12:00:00+09:00');
function save(level=100,stars=5,team=['horas','osia','lava','ryusion','lumi','ian']){const s=G.create(now,7);s.team=team;for(const id of s.team)s.units[id]={level,stars,xp:0,shards:0};return s;}
const parties=[{account:'a',save:save()},{account:'b',save:save()}];
assert.throws(()=>Y.create(G,parties.slice(0,1),now,1));
const fine=Y.create(G,parties,now,37),coarse=G.clone(fine);
let freezeTime=0;for(let t=250;t<=30000;t+=250){Y.advance(G,fine,now+t);if(fine.teams.some(t=>t.frozen)){freezeTime=t;break;}}
Y.advance(G,coarse,now+freezeTime);assert.deepEqual(fine,coarse);
assert(fine.teams.some(t=>t.frozen));const index=fine.teams.findIndex(t=>t.frozen),ice=fine.teams[index].frozen;
assert.throws(()=>Y.thaw(G,fine,parties[index].account,ice.id,now+freezeTime));
assert.throws(()=>Y.thaw(G,fine,parties[1-index].account,'forged',now+freezeTime));
Y.thaw(G,fine,parties[1-index].account,ice.id,now+freezeTime);assert.equal(fine.teams[index].frozen,null);
assert.throws(()=>Y.thaw(G,fine,parties[1-index].account,ice.id,now+freezeTime));
console.log('PASS deterministic duo-only battle, ally-only thaw and stale freeze protection');
function fight(level,rescue,stars=5,team){const s=Y.create(G,[{account:'a',save:save(level,stars,team)},{account:'b',save:save(level,stars,team)}],now,12);for(let elapsed=250;elapsed<=Y.DURATION&&!s.ended;elapsed+=250){Y.advance(G,s,now+elapsed);for(let i=0;i<2;i++)if(rescue&&s.teams[i].frozen&&s.teams[i].units.some(u=>u.hp>0)&&s.teams[1-i].units.some(u=>u.hp>0)&&elapsed-s.teams[i].frozen.at>=1500&&!s.ended)Y.thaw(G,s,s.teams[1-i].account,s.teams[i].frozen.id,now+elapsed);}return s;}
const noUR=['ryusion','osia','lava','nari','lumi','ian'];
const win=fight(100,true),recommended=fight(70,true,2,noUR),neglect=fight(70,false,2,noUR),early=fight(60,true,2,noUR);
assert.equal(Y.HP,800000);assert.equal(Y.DURATION,210000);assert.equal(Y.RECOMMENDED_LEVEL,70);
assert.equal(win.outcome,'defeated');assert(win.elapsed>0&&win.elapsed<Y.DURATION);assert.equal(recommended.outcome,'defeated');assert(recommended.elapsed>win.elapsed);assert.notEqual(neglect.outcome,'defeated');assert.notEqual(early.outcome,'defeated');
assert.equal(win.damage,Y.HP);assert.equal(win.teams.reduce((n,t)=>n+t.damage,0),Y.HP);assert(win.teams.every(t=>t.thaws>0));
assert.equal(win.teams[0].units.find(u=>u.id==='ryusion').damage>0,true);
const after=G.clone(win);Y.advance(G,win,now+1e9);assert.deepEqual(win,after);
console.log('PASS 800k/210s boss; Lv70 no-UR duo wins with rescue, neglect/low growth fails, physical damage and one settlement');

const legacy=Y.create(G,parties,now,12);delete legacy.yetiRules;legacy.boss.hp=legacy.boss.max=1600000;for(const t of legacy.teams)for(const u of t.units){u.hp=u.max=1e9;u.atk=1;}
Y.advance(G,legacy,now+Y.DURATION);assert.equal(legacy.elapsed,150000);assert.equal(legacy.boss.max,1600000);assert.equal(legacy.outcome,'timeout');
assert.equal(Y.encounterRules(legacy).attack,480);assert.equal(Y.encounterRules(legacy).rage,3);
console.log('PASS already-running unsnapshotted battles retain legacy HP, duration and attack balance');

const old=G.create(now);old.winter.exchanges={gold:8,gems:4};old.winter.snowflakes=old.winter.earned=3000;
assert(G.validate(old));const before=G.clone(old);G.advance(old,now);assert.deepEqual(old.winter,before.winter);
for(let i=0;i<2;i++)G.action(old,{kind:'winter-exchange',item:'horas',shards:9999,cost:0},now);
assert.equal(old.winter.snowflakes,1000);assert.equal(old.heroShards.horas,10);assert(!old.units.horas);assert(G.validate(old));
assert.throws(()=>G.action(old,{kind:'winter-exchange',item:'horas'},now));
const midnight=Date.parse('2026-11-19T00:00:00+09:00');G.action(old,{kind:'winter-exchange',item:'horas'},midnight);assert.equal(old.heroShards.horas,15);
G.action(old,{kind:'recruit',count:1,banner:'horas'},midnight,()=>0);assert.equal(old.units.horas.shards,15);assert.equal(old.heroShards.horas,undefined);
assert(G.validate(old));
assert.deepEqual(G.publicProfile({...old,profile:{avatar:'https://bad.test'}}),{avatar:'leader',hero:old.team[0]});
console.log('PASS old save compatibility, 1000 flakes/5 shards twice per KST day, bank transfers only on real Horas draw');
