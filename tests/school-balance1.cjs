// 12 seeds, 60s, Lv100/A5, best compatible gear/A5, five supports, 800k-HP targets.
// Physical immunity and encounter-specific counters are intentionally separate tests.
const assert=require('node:assert/strict'),G=require('../school/engine.js');
const output=[];for(const count of [1,3])for(const scenario of ["normal","stunned","alone"])for(const id of G.HEROES.map(h=>h.id)){
 let damage=0,seconds=0;for(let seed=1;seed<=12;seed++){
  const s=G.create(1000,seed*4919);const team=[...['taeo','geonu','doyoon','nari','sua','jiho'].filter(k=>k!==id).slice(0,5),id];for(const k of team)s.units[k]={level:100,stars:5,xp:0,shards:0};
  for(const slot of G.GEAR_SLOTS){const items=G.GEAR.filter(g=>g.slot===slot&&(!g.owner||g.owner===id));const best=items.sort((a,b)=>(b.owner===id?10:0)+(b.atk||0)+(b.starAtk||0)*5-((a.owner===id?10:0)+(a.atk||0)+(a.starAtk||0)*5))[0];s.equipment.inventory[best.id]={count:1,stars:5};(s.equipment.equipped[id]||={})[slot]=best.id;}
  G.action(s,{kind:'team',team},s.at);const u=s.battle.heroes.find(u=>u.id===id);if(scenario==="wounded"&&id==='hyeokjin')u.hp=Math.round(u.max*.15);
  s.battle.enemies=Array.from({length:count},(_,i)=>({id:'dummy'+i,name:'허수아비',hp:800000,max:800000,atk:0,boss:false,nextBasic:Infinity,stunUntil:scenario==="stunned"?999999:0}));
  if(scenario==='alone'){u.kazua={clock:0,phase:'fire',phaseMs:0,mode:'fire',modeSince:0,volley:0,skillUntil:0,nextPistol:5000,nextBazooka:15000,nextRed:20000,credit:0,power:1,initial:team};for(const ally of s.battle.heroes)if(ally.id!==id)ally.hp=0;if(id==='hyeokjin')u.hp=u.max*.15;}
  for(let step=0;step<120&&s.battle.phase==='fight';step++){const seq=s.seq;G.advance(s,s.at+500);for(const e of s.events.filter(e=>e.seq>seq))if(e.kind==='hit'&&e.from===id)damage+=e.amount;seconds+=.5;}
 }
 output.push({id,count,scenario,damage:Math.round(damage/12),seconds:seconds/12});
}
for(const scenario of ['normal','stunned','alone'])for(const count of [1,3]){
 const rows=output.filter(r=>r.count===count&&r.scenario===scenario).sort((a,b)=>b.damage-a.damage);
 assert(rows.every(r=>r.seconds===60&&Number.isFinite(r.damage)));
 if(scenario==='alone')assert.equal(rows[0].id,'kazua');else assert.deepEqual(rows.slice(0,4).map(r=>r.id),['hyeokjin','horas','osia','kazua']);
 console.log('PASS '+scenario+' / '+count+' targets: '+rows.slice(0,6).map(r=>r.id+' '+r.damage).join(', '));
}
