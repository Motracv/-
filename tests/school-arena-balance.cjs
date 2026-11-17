const assert = require('node:assert/strict');
const G = require('../school/engine.js');
const teams = {
  mixed: ['geonu','ian','osia','lumi','nari','lava'],
  fortress: ['taeo','geonu','doyoon','sua','nari','lava'],
  bulwark: ['taeo','geonu','doyoon','ian','osia','lumi'],
  magic: ['geonu','minjae','siu','osia','lumi','lava'],
};
function save(team) {
  const s=G.create(1000);s.team=team;
  for(const id of team)s.units[id]={level:100,stars:5,xp:0,shards:0};
  return s;
}
(async()=>{
  const {simulateArena}=await import('../online/arena.mjs');
  const reports=[];
  for(const [left,right] of [['mixed','mixed'],['fortress','fortress'],['mixed','fortress'],['bulwark','fortress'],['magic','bulwark']]) {
    const report={left,right,wins:[0,0],draws:0,timeouts:0,totalMs:0,maxEvents:0};
    for(let sample=1;sample<=100;sample++) {
      const saves=[save(teams[left]),save(teams[right])];
      const battle=simulateArena(G,saves,[left,right],sample*9973);
      if(battle.winner===-1)report.draws++;else report.wins[battle.winner]++;
      report.timeouts+=+(battle.durationMs===90000);report.totalMs+=battle.durationMs;report.maxEvents=Math.max(report.maxEvents,battle.events.length);
      assert.ok(battle.durationMs>0&&battle.durationMs<=90000);
      assert.equal(battle.rules.healing,.75);assert.equal(battle.rules.shieldHealth,'original');
      assert.equal(battle.rules.vitality,3);assert.equal(battle.rules.overtimeAt,45);assert.equal(battle.rules.rewards,false);
      for(const [side,units] of battle.final.entries())for(const unit of units){
        const max=G.stats(unit.id,saves[side].units[unit.id]).hp*3;
        assert.ok(Number.isFinite(unit.hp)&&unit.hp>=0&&unit.hp<=max);
        assert.ok(Number.isFinite(unit.shield)&&unit.shield>=0&&unit.shield<=max*.6);
      }
      if(battle.durationMs===90000&&battle.final.every(side=>side.some(unit=>unit.hp>0))){
        const ratios=battle.final.map((side,index)=>side.reduce((sum,unit)=>sum+unit.hp/(G.stats(unit.id,saves[index].units[unit.id]).hp*3),0)/side.length);
        const expected=Math.abs(ratios[0]-ratios[1])<.0001?-1:ratios[0]>ratios[1]?0:1;
        assert.equal(battle.winner,expected);
      }
      for(const event of battle.events.filter(event=>event.kind==='shield'&&['taeo','geonu','doyoon'].includes(event.from)&&event.amount>0)) {
        const base=G.stats(event.from,saves[event.side].units[event.from]).hp;
        assert.ok(event.amount<=Math.round(base*.25),'PvP vitality must not triple HP-based shields');
      }
    }
    // Broad regressions, not promises of tournament balance. Mirror teams must
    // not give the challenger a fixed win or an endless healing stalemate.
    if(left===right){assert.ok(report.wins.every(wins=>wins>=15&&wins<=85));assert.ok(report.timeouts<80);}
    if(left==='bulwark'&&right==='fortress')assert.ok(report.wins[0]>=20,'Three tanks and damage dealers need a viable defensive-team counter');
    reports.push({...report,averageSeconds:report.totalMs/100000});
  }
  console.log(JSON.stringify(reports,null,2));
  console.log('PASS 500 deterministic max-level arena matchups: finite results, PvP rules, bounded mirrors, defensive-team counter');
})().catch(error=>{console.error(error);process.exitCode=1;});
