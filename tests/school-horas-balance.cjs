// Reproducible balance samples, not a guarantee for every formation or seed.
const assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../school/engine.js');
const SEEDS=60,SECONDS=60;
const seedFor=index=>Math.imul(index,2654435761)>>>0;
function lineup(id,withOsia){
  const support=withOsia?['taeo','geonu','doyoon','osia','lava','nari','sua']:['taeo','geonu','doyoon','nari','lava','sua'];
  return [...support.filter(member=>member!==id).slice(0,5),id];
}
function saved(team,level,stars,seed){
  const state=G.create(100000,seed);for(const id of team)state.units[id]={level,stars,xp:0,shards:0};
  G.action(state,{kind:'team',team},state.at);return state;
}
function damageSample(id,level,stars,count,withOsia){
  let damage=0,casts=0,stunHits=0;
  for(let index=1;index<=SEEDS;index++){
    const state=saved(lineup(id,withOsia),level,stars,seedFor(index));
    state.battle.enemies=state.battle.enemies.slice(0,count);
    for(const enemy of state.battle.enemies){enemy.hp=enemy.max=1e8;enemy.atk=3;}
    for(let step=0;step<SECONDS*2;step++){
      const seq=state.seq;G.advance(state,state.at+500);
      for(const event of state.events.filter(event=>event.seq>seq)){
        if(event.kind==='hit'&&event.from===id){damage+=event.amount;stunHits+=+(!!event.stunBonus);}
        if(event.kind==='horas-cast')casts++;
      }
    }
  }
  return{id,level,stars,targets:count,withOsia,damage:Math.round(damage/SEEDS),casts:casts/SEEDS,stunHits:stunHits/SEEDS};
}
function campaignSample(team,level,stars,stage){
  let wins=0,totalMs=0;
  for(let index=1;index<=30;index++){
    const state=saved(team,level,stars,seedFor(index));state.best=G.MAX_STAGE;
    G.action(state,{kind:'stage',stage,mode:'farm'},state.at);
    state.wave=4;state.battle.phase='victory';state.battle.wait=0;G.advance(state,state.at+500);
    assert.equal(state.battle.wave,4);assert.equal(state.battle.phase,'fight');
    const start=state.at;
    while(state.battle.phase==='fight'&&state.at-start<150000)G.advance(state,state.at+500);
    wins+=+(state.battle.phase==='victory');totalMs+=state.at-start;
  }
  return{team,level,stars,stage,wins,samples:30,seconds:totalMs/30000};
}
(async()=>{
  const rows=[],comparisons=[];
  for(const[level,stars]of[[80,3],[100,5]]){
    for(const count of[1,3]){
      // All roster roles are sampled. Identical five support slots are used
      // for every damage dealer; a duplicate support is replaced by Sua.
      const ordinary=G.HEROES.map(hero=>damageSample(hero.id,level,stars,count,false));rows.push(...ordinary);
      const horas=ordinary.find(row=>row.id==='horas'),best=ordinary.filter(row=>row.id!=='horas').sort((a,b)=>b.damage-a.damage)[0];
      const ratio=horas.damage/best.damage;
      assert.ok(ratio>=1.08&&ratio<=1.25,`UR damage lead must be visible and bounded: ${JSON.stringify({level,stars,count,ratio,best})}`);
      comparisons.push({level,stars,targets:count,withOsia:false,horas:horas.damage,bestOther:best.id,other:best.damage,ratio});
      const combo=['horas','ian','lumi'].map(id=>damageSample(id,level,stars,count,true));rows.push(...combo);
      const main=combo.find(row=>row.id==='horas'),other=combo.filter(row=>row.id!=='horas').sort((a,b)=>b.damage-a.damage)[0];
      const comboRatio=main.damage/other.damage;assert.ok(comboRatio>1&&comboRatio<1.35);
      comparisons.push({level,stars,targets:count,withOsia:true,horas:main.damage,bestOther:other.id,other:other.damage,ratio:comboRatio});
    }
  }
  const campaign=[];
  for(const[level,stars]of[[80,3],[100,5]])for(const stage of[55,60])for(const id of['horas','ian'])campaign.push(campaignSample(['taeo','geonu','doyoon',id,'osia','lava'],level,stars,stage));
  const{simulateArena}=await import('../online/arena.mjs');
  const teams={ur:['taeo','geonu','doyoon','horas','osia','lava'],ssr:['taeo','geonu','doyoon','ian','osia','lava'],mixed:['geonu','ian','osia','lumi','nari','lava'],fortress:['taeo','geonu','doyoon','sua','nari','lava']};
  const arena=[];
  for(const pair of[['ur','ur'],['ur','ssr'],['ur','mixed'],['ur','fortress'],['ssr','mixed']]){
    const wins=[0,0];let draws=0,timeouts=0,totalMs=0;
    for(let index=1;index<=100;index++){
      const match=simulateArena(G,pair.map(name=>saved(teams[name],100,5,1)),pair,index*9973);
      if(match.winner<0)draws++;else wins[match.winner]++;timeouts+=+(match.durationMs===90000);totalMs+=match.durationMs;
      if(pair.includes('ur'))assert.equal(match.rules.horasDamageMultiplier,.78);
    }
    if(pair[0]===pair[1])assert.ok(wins.every(value=>value>=25&&value<=75));
    if(pair[1]==='ssr')assert.ok(wins[0]>=45&&wins[0]<=75);
    arena.push({pair,wins,draws,timeouts,seconds:totalMs/100000});
  }
  const result={rules:G.HORAS_RULES,seeds:SEEDS,seconds:SECONDS,description:'Five-support benchmark, one durable boss / current three-enemy encounter; Osia combo separate. Same growth investment; no expectation that every short wave or formation ranks identically.',comparisons,rows,campaign,arena};
  fs.writeFileSync(process.argv[2]||'/tmp/school-horas-balance13.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({comparisons,campaign,arena},null,2));
  console.log('PASS all-hero damage samples at two investments, Osia synergy, late-stage boss parties and 500 arena matchups');
})().catch(error=>{console.error(error);process.exitCode=1;});
