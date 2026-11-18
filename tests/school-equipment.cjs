const assert=require('node:assert/strict');
const G=require('../school/engine.js');
const NOW=Date.parse('2026-11-18T12:00:00+09:00');let passed=0;
const test=(name,run)=>{run();passed++;console.log('PASS',name);},make=()=>G.create(NOW,287),act=(s,input,options)=>G.action(s,input,s.at,()=>0,options);
function reject(s,input){const before=G.clone(s);assert.throws(()=>act(s,input));assert.deepEqual(s,before);}
function add(s,id,count=1,stars=0){s.equipment.inventory[id]={count,stars};}
function enter(s,kind,value=1){if(kind==='tower')s.activities.towerBest=Math.max(0,value-1);else s.best=60;act(s,{kind:'activity',mode:kind,...(kind==='tower'?{floor:value}:{tier:value})});}
function finish(s,rng=()=>0,preview=false){for(const e of s.battle.enemies)e.hp=0;G.advance(s,s.at+500,{gearRng:rng,preview});assert.equal(s.battle.phase,'victory');return s.activities.lastResult;}
test('Twelve equipment types and old-save migration never grant free items or rewrite already-paid results',()=>{
 const s=make();assert.equal(G.CATALOG_VERSION,24);assert.equal(G.GEAR.length,12);for(const rarity of ['R','SR','SSR'])assert.deepEqual(G.GEAR.filter(d=>d.rarity===rarity).map(d=>d.slot),['weapon','armor','charm']);
 enter(s,'daily');finish(s);delete s.equipment;delete s.activities.lastResult.gearDrops;const before=G.clone(s);assert(G.validate(s));assert.equal(G.equipmentInfo(s).items.filter(i=>i.count).length,0);assert.deepEqual(s,before);G.advance(s,s.at);assert.deepEqual(s.equipment,{inventory:{},equipped:{}});assert.deepEqual(s.activities,before.activities);for(const key of ['gold','gems','units','banners','presets','captain','quests','winter'])assert.deepEqual(s[key],before[key]);assert(G.validate(s));
});
test('Three slots share copies correctly, swapping frees the previous item, and changes do not reset or heal the current battle',()=>{
 const s=make();add(s,'chalk_star',2);add(s,'rift_baton');add(s,'apprentice_cape');const battle=G.clone(s.battle),money=[s.gold,s.gems];
 act(s,{kind:'gear-equip',hero:'harin',item:'chalk_star'});act(s,{kind:'gear-equip',hero:'taeo',item:'chalk_star'});assert.deepEqual(G.equipmentInfo(s).items.find(i=>i.id==='chalk_star').wearers,['harin','taeo']);reject(s,{kind:'gear-equip',hero:'sua',item:'chalk_star'});reject(s,{kind:'gear-equip',hero:'harin',item:'chalk_star'});
 act(s,{kind:'gear-equip',hero:'harin',item:'rift_baton'});assert.equal(G.equipmentInfo(s).items.find(i=>i.id==='chalk_star').free,1);act(s,{kind:'gear-equip',hero:'sua',item:'chalk_star'});act(s,{kind:'gear-equip',hero:'harin',item:'apprentice_cape'});assert.deepEqual(s.battle,battle);assert.deepEqual([s.gold,s.gems],money);act(s,{kind:'gear-unequip',hero:'harin',slot:'weapon'});assert(!s.equipment.equipped.harin.weapon);assert.equal(G.equipmentInfo(s).items.find(i=>i.id==='rift_baton').free,1);assert(G.validate(s));
});
test('Every item and hero pair conserves a single physical copy across rejected duplication and explicit transfer',()=>{
 let pairs=0;
 for(const item of G.GEAR)for(const owner of G.HEROES){
  const s=make();for(const hero of G.HEROES)s.units[hero.id]={level:1,xp:0,stars:0,shards:0};add(s,item.id);act(s,{kind:'gear-equip',hero:owner.id,item:item.id});
  const held=G.equipmentInfo(s).items.find(entry=>entry.id===item.id);assert.equal(held.count,1);assert.equal(held.free,0);assert.equal(held.materials,0);assert.deepEqual(held.wearers,[owner.id]);reject(s,{kind:'gear-awaken',item:item.id});
  for(const receiver of G.HEROES){if(receiver.id===owner.id)continue;pairs++;
   reject(s,{kind:'gear-equip',hero:receiver.id,item:item.id});assert(G.validate(s));assert.equal(s.equipment.inventory[item.id].count,1);assert.deepEqual(s.equipment.equipped,{[owner.id]:{[item.slot]:item.id}});
   const moved=G.clone(s);act(moved,{kind:'gear-unequip',hero:owner.id,slot:item.slot});assert.equal(G.equipmentInfo(moved).items.find(entry=>entry.id===item.id).free,1);act(moved,{kind:'gear-equip',hero:receiver.id,item:item.id});
   assert.equal(moved.equipment.inventory[item.id].count,1);assert.deepEqual(moved.equipment.equipped,{[receiver.id]:{[item.slot]:item.id}});reject(moved,{kind:'gear-equip',hero:owner.id,item:item.id});reject(moved,{kind:'gear-awaken',item:item.id});assert(G.validate(moved));
  }
 }
 assert.equal(pairs,G.GEAR.length*G.HEROES.length*(G.HEROES.length-1));console.log('Single-copy coverage:',G.GEAR.length,'items;',G.HEROES.length,'heroes;',pairs,'ordered pairs');
});
test('Global type awakening uses only unused identical copies and keeps every equipped copy plus one unworn base',()=>{
 const s=make();add(s,'dawn_staff',11);act(s,{kind:'gear-equip',hero:'taeo',item:'dawn_staff'});act(s,{kind:'gear-equip',hero:'harin',item:'dawn_staff'});let count=11;
 for(const cost of [1,1,2,2,3]){const info=G.equipmentInfo(s).items.find(i=>i.id==='dawn_staff');assert.equal(info.awakenCost,cost);const result=act(s,{kind:'gear-awaken',item:'dawn_staff',cost:0});count-=cost;assert.equal(result.cost,cost);assert.equal(result.count,count);assert.equal(s.equipment.inventory.dawn_staff.count,count);assert.equal(G.equipmentInfo(s).items.find(i=>i.id==='dawn_staff').wearers.length,2);}
 assert.equal(count,2);assert.equal(s.equipment.inventory.dawn_staff.stars,5);reject(s,{kind:'gear-awaken',item:'dawn_staff'});assert.equal(G.equipmentBonus(s,'taeo').atk,G.equipmentBonus(s,'harin').atk);assert(G.validate(s));
 const spare=make();add(spare,'chalk_star',2);act(spare,{kind:'gear-awaken',item:'chalk_star'});assert.deepEqual(spare.equipment.inventory.chalk_star,{count:1,stars:1});reject(spare,{kind:'gear-awaken',item:'chalk_star'});
});
test('Gear adds percentages before final rounding; max SSR set is 9% attack and 14% HP with no other stat changes',()=>{
 const s=make();s.units.harin={level:80,xp:0,stars:3,shards:0};const before=G.stats('harin',s.units.harin);for(const id of ['dawn_staff','guardian_robe','dawn_brooch']){add(s,id,1,5);act(s,{kind:'gear-equip',hero:'harin',item:id});}
 const bonus=G.equipmentBonus(s,'harin'),stats=G.stats('harin',s.units.harin,s),hero=G.BY_ID.harin;assert(Math.abs(bonus.atk-.09)<1e-12);assert(Math.abs(bonus.hp-.14)<1e-12);assert.equal(stats.atk,Math.round((hero.atk+79*3)*1.45*1.09));assert.equal(stats.hp,Math.round((hero.hp+79*14)*1.45*1.14));for(const k of ['defense','critChance','critMultiplier'])assert.equal(stats[k],before[k]);
 const oldBattle=G.clone(s.battle);act(s,{kind:'gear-unequip',hero:'harin',slot:'charm'});assert.deepEqual(s.battle,oldBattle);act(s,{kind:'gear-equip',hero:'harin',item:'dawn_brooch'});act(s,{kind:'stage',stage:1,mode:'farm'});assert.equal(s.battle.heroes.find(h=>h.id==='harin').atk,stats.atk);assert.equal(s.battle.heroes.find(h=>h.id==='harin').max,stats.hp);
 for(const h of G.HEROES){const u={level:33,stars:2};assert.deepEqual(G.stats(h.id,u),G.stats(h.id,u,{equipment:{inventory:{},equipped:{}}}));}assert.deepEqual(G.gearBonus('constructor'),{atk:0,hp:0});
});
test('Unknown heroes/items, mismatched slots, forged counts/stars and malformed inventories are rejected atomically',()=>{
 const s=make();add(s,'chalk_star',2);for(const input of [{kind:'gear-equip',hero:'horas',item:'chalk_star'},{kind:'gear-equip',hero:'harin',item:'constructor'},{kind:'gear-equip',hero:'harin',item:'dawn_staff'},{kind:'gear-equip',hero:'harin',item:'chalk_star',slot:'armor'},{kind:'gear-equip',hero:'harin',item:'chalk_star',stars:5},{kind:'gear-awaken',item:'chalk_star',count:999},{kind:'gear-awaken',item:'constructor'},{kind:'gear-unequip',hero:'harin',slot:'weapon'},{kind:'gear-spawn',item:'chalk_star'}])reject(s,input);
 for(const mutate of [v=>v.equipment=null,v=>v.equipment.inventory=[],v=>v.equipment.inventory.chalk_star.count=0,v=>v.equipment.inventory.chalk_star.count=1e9+1,v=>v.equipment.inventory.chalk_star.count=.5,v=>v.equipment.inventory.chalk_star.stars=6,v=>v.equipment.equipped.horas={weapon:'chalk_star'},v=>v.equipment.equipped.harin={armor:'chalk_star'},v=>v.equipment.equipped.harin={weapon:'dawn_staff'},v=>{v.equipment.inventory.chalk_star.count=1;v.equipment.equipped={harin:{weapon:'chalk_star'},taeo:{weapon:'chalk_star'}};}]){const invalid=G.clone(s);mutate(invalid);assert.equal(G.validate(invalid),false);}
});
test('Active dungeon locks every equipment mutation while pure previews remain read-only',()=>{
 const s=make();add(s,'chalk_star',3);act(s,{kind:'gear-equip',hero:'harin',item:'chalk_star'});enter(s,'daily');const before=G.clone(s);assert(G.equipmentInfo(s).locked);assert(!G.equipmentInfo(s).items.find(i=>i.id==='chalk_star').canAwaken);for(const input of [{kind:'gear-equip',hero:'taeo',item:'chalk_star'},{kind:'gear-unequip',hero:'harin',slot:'weapon'},{kind:'gear-awaken',item:'chalk_star'}])reject(s,input);G.stats('harin',s.units.harin,s);G.snapshotEquipment(s);assert.deepEqual(s,before);
 act(s,{kind:'activity-exit'});act(s,{kind:'gear-awaken',item:'chalk_star'});assert.equal(s.equipment.inventory.chalk_star.stars,1);
});
test('Daily and weekly odds honor every tier, rarity boundary and uniform slot; only newly settled wins draw',()=>{
 const expected={daily:[[80,18,2],[74,23,3],[68,27,5],[62,31,7],[55,35,10]],weekly:[[60,34,6],[52,40,8],[45,45,10],[38,49,13],[30,55,15]]};
 for(const kind of ['daily','weekly'])for(let tier=1;tier<=5;tier++){
  const info=G.equipmentDropInfo(kind,tier);assert.deepEqual(Object.values(info.rates),expected[kind][tier-1].map(x=>x/100));assert.equal(info.count,kind==='daily'?1:2);
  for(const [roll,rarity]of [[0,'R'],[info.rates.R,'SR'],[info.rates.R+info.rates.SR,'SSR']])for(let slot=0;slot<3;slot++){
   const s=make();enter(s,kind,tier);let n=0;const rng=()=>n++%2?(slot+.5)/3:roll;const result=finish(s,rng);assert.equal(n,info.count*2);assert.equal(result.gearDrops.length,info.count);for(const drop of result.gearDrops){assert.equal(G.GEAR_BY_ID[drop.item].rarity,rarity);assert.equal(G.GEAR_BY_ID[drop.item].slot,G.GEAR_SLOTS[slot]);assert.equal(drop.count,1);}
   const paid=G.clone(s);G.advance(s,s.at+500,{gearRng:()=>{throw Error('rerolled settled loot');}});assert.deepEqual(s.equipment,paid.equipment);assert.deepEqual(s.activities,paid.activities);assert(G.validate(s));
  }
 }
});
test('First tower bosses drop once; normal floors, repeated clears, defeat, exit, campaign and offline never drop',()=>{
 for(const [floor,rates]of [[5,[.8,.18,.02]],[20,[.8,.18,.02]],[25,[.68,.27,.05]],[50,[.68,.27,.05]],[55,[.6,.33,.07]],[100,[.6,.33,.07]],[105,[.55,.35,.1]]]){const s=make();enter(s,'tower',floor);assert.deepEqual(Object.values(G.equipmentDropInfo('tower',floor).rates),rates);assert.equal(finish(s).gearDrops.length,1);const bag=G.clone(s.equipment);act(s,{kind:'activity',mode:'tower',floor});assert.equal(finish(s,()=>{throw Error('repeat draw');}).gearDrops.length,0);assert.deepEqual(s.equipment,bag);}
 const normal=make();enter(normal,'tower',1);assert.equal(finish(normal,()=>{throw Error('ordinary tower drop');}).gearDrops.length,0);
 for(const lose of ['exit','defeat']){const s=make();enter(s,'daily');if(lose==='exit')act(s,{kind:'activity-exit'});else{for(const h of s.battle.heroes)h.hp=0;G.advance(s,s.at+500,{gearRng:()=>{throw Error('defeat drop');}});}assert.deepEqual(s.equipment,{inventory:{},equipped:{}});}
 const s=make();for(const e of s.battle.enemies)e.hp=0;G.advance(s,s.at+500,{gearRng:()=>{throw Error('campaign drop');}});G.advance(s,s.at+3600000,{gearRng:()=>{throw Error('offline drop');}});act(s,{kind:'offline'});assert.deepEqual(s.equipment,{inventory:{},equipped:{}});
});
test('Secure loot ignores client-visible battle seed, guest loot is deterministic, and cloud preview awards nothing',()=>{
 const s=make();enter(s,'daily');const preview=G.clone(s),a=G.clone(s),b=G.clone(s);b.seed=1;const one=finish(a,()=>0),two=finish(b,()=>0);assert.deepEqual(one.gearDrops,two.gearDrops);assert.equal(one.gearDrops[0].item,'chalk_star');
 finish(preview,()=>{throw Error('preview RNG');},true);assert.equal(preview.activities.lastResult.gearPending,true);assert.deepEqual(preview.activities.lastResult.gearDrops,[]);assert.deepEqual(preview.equipment,s.equipment);
 const guest=G.clone(s),loaded=G.clone(s);guest.battle.enemies.forEach(e=>e.hp=0);loaded.battle.enemies.forEach(e=>e.hp=0);G.advance(guest,guest.at+500);G.advance(loaded,loaded.at+500);assert.deepEqual(guest,loaded);
 const clean=make();enter(clean,'daily');const seed=clean.seed;finish(clean,()=>0);assert.notEqual(clean.seed,seed);assert(G.validate(clean));
});
test('Immutable drop snapshots survive later awakening, cap overflow and malformed result validation',()=>{
 const s=make();add(s,'chalk_star',2,2);enter(s,'weekly');const r=finish(s);assert.deepEqual(r.gearDrops,[{item:'chalk_star',count:1,duplicate:true,stars:2},{item:'chalk_star',count:1,duplicate:true,stars:2}]);const shown=G.clone(r.gearDrops);act(s,{kind:'gear-awaken',item:'chalk_star'});assert.deepEqual(s.activities.lastResult.gearDrops,shown);assert.deepEqual(s.events.findLast(e=>e.kind==='activity-result').gearDrops,shown);
 const full=make();add(full,'chalk_star',1e9,5);enter(full,'daily');assert.deepEqual(finish(full).gearDrops,[{item:'chalk_star',count:0,duplicate:true,stars:5,overflow:true}]);assert.equal(full.equipment.inventory.chalk_star.count,1e9);assert(G.validate(full));
 for(const drop of [{item:'unknown',count:1,duplicate:false,stars:0},{item:'chalk_star',count:999,duplicate:false,stars:0},{item:'chalk_star',count:1,duplicate:false,stars:6}]){const bad=G.clone(s);bad.activities.lastResult.gearDrops=[drop];assert.equal(G.validate(bad),false);}
});
test('Snapshots disclose only selected worn gear and farming cache changes only when current team stats do',()=>{
 const s=make();s.units.harin.level=40;s.units.taeo.level=40;add(s,'chalk_star',10,2);add(s,'dawn_staff',123,5);act(s,{kind:'gear-equip',hero:'harin',item:'chalk_star'});act(s,{kind:'gear-equip',hero:'taeo',item:'chalk_star'});const snapshot=G.snapshotEquipment(s,['harin']);assert.deepEqual(snapshot,{inventory:{chalk_star:{count:1,stars:2}},equipped:{harin:{weapon:'chalk_star'}}});const before=G.clone(s);const key=G.farmingFingerprint(s);s.equipment.inventory.chalk_star.count++;s.equipment.inventory.dawn_staff.stars=4;assert.equal(G.farmingFingerprint(s),key);s.equipment.inventory.chalk_star.stars++;assert.notEqual(G.farmingFingerprint(s),key);assert.equal(G.power(s)>G.power({...s,equipment:{inventory:{},equipped:{}}}),true);assert.deepEqual(before.equipment.inventory.dawn_staff,{count:123,stars:5});
});
console.log(`${passed} equipment engine checks passed`);
