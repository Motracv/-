const assert=require('node:assert/strict'),G=require('../school/engine.js');
const now=Date.parse('2026-11-19T10:00:00Z');
const unit=level=>({level,stars:0,xp:0,shards:0});
const record=(xp,read=[])=>({xp,read,daily:{day:G.day(now),waves:10,bosses:3,dragons:20,earned:0,claimed:[]}});
assert.deepEqual(Object.keys(G.BOND_CHARACTERS).sort(),G.HEROES.filter(h=>['SSR','UR'].includes(h.rarity)).map(h=>h.id).sort());
for(const id of Object.keys(G.BOND_CHARACTERS)){
 const s=G.create(now);s.units[id]=unit(1);s.bonds={[id]:record(650)};
 G.action(s,{kind:'bond-read',hero:id,episode:1},now);
 for(const [chapter,level] of [[2,30],[3,50],[4,70]]){
  s.units[id].level=level-1;const before=G.clone(s);
  assert.throws(()=>G.action(s,{kind:'bond-read',hero:id,episode:chapter,level:100,xp:650},now));assert.deepEqual(s,before);
  s.units[id].level=level;G.action(s,{kind:'bond-read',hero:id,episode:chapter},now);
 }
 const meta=G.BOND_CHARACTERS[id];G.action(s,{kind:'profile',avatar:meta.avatar,title:meta.title},now);assert.equal(G.publicProfile(s).avatar,meta.avatar);assert(G.validate(s));
 s.units[id].level=1;assert(G.bondInfo(s,now,id).episodes.every(e=>e.unlocked),'Legacy rewards and read chapters remain available');
 s.bonds[id]=record(0);s.profile={avatar:'leader',title:'',beta:true};assert.throws(()=>G.action(s,{kind:'profile',avatar:meta.avatar},now));assert.throws(()=>G.action(s,{kind:'bond-mission',hero:id,mission:'waves'},now));
 s.units[id].level=30;s.bonds[id].daily.earned=58;assert.equal(G.action(s,{kind:'bond-mission',hero:id,mission:'bosses'},now).xp,2);assert.equal(s.bonds[id].daily.earned,60);assert.throws(()=>G.action(s,{kind:'bond-mission',hero:id,mission:'waves'},now));assert(G.validate(s));
 const fight=G.create(now);fight.units[id]=unit(100);G.action(fight,{kind:'team',team:[id]},now);for(const e of fight.battle.enemies)e.hp=1;G.advance(fight,now+15000);assert(fight.bonds[id].xp>0,id+' earns active combat bond');
}
const s=G.create(now);s.captain.level=20;s.shardExchange={SR:0,SSR:50};
for(const id of ['ryusion','kazua']){assert(!G.shardInfo(s).choices.includes(id));assert.throws(()=>G.action(s,{kind:'shard-select',hero:id},now));s.units[id]=unit(1);assert(G.shardInfo(s).choices.includes(id));G.action(s,{kind:'shard-select',hero:id},now);assert.equal(s.units[id].shards,5);}
assert.equal(s.shardExchange.SSR,30);for(const id of ['horas','spica','__proto__']){const before=G.clone(s);assert.throws(()=>G.action(s,{kind:'shard-select',hero:id},now));assert.deepEqual(s,before);}
for(const id of ['taeo','__proto__','missing'])assert.throws(()=>G.action(s,{kind:'bond-read',hero:id,episode:1},now));
s.units.osia=unit(1);s.bonds={osia:record(650,[1,2,3,4])};s.bonds.osia.daily.earned=200;s.profile={avatar:'osia-memory',title:'osia-oath',beta:true};assert(G.validate(s));assert(G.bondInfo(s).episodes.every(e=>e.unlocked));assert.equal(G.publicProfile(s).avatar,'osia-memory');
console.log('PASS all nine companions, growth gates, retained old unlocks, per-companion daily caps, real combat gain, forged cosmetic rejection and owned pickup shard exchange');
