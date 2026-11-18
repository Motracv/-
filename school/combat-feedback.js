/* Presentation-only state. Never changes HP, damage, timers or a saved battle. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SchoolCombatFeedback=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const clamp=n=>Math.max(0,Math.min(1,n));
  function numbers(effects,time) {
    const groups=new Map();
    for(const e of effects){
      const age=time-e.time;
      if(age<0||age>=1.35||!['hit','heal','enemy-heal','shield'].includes(e.kind)||!(e.amount>0))continue;
      const type=e.kind==='hit'?'damage':e.kind==='shield'?'shield':'heal',key=`${e.battleId}:${e.to}:${type}:${e.time}`;
      let g=groups.get(key);
      if(!g){g={to:e.to,type,time:e.time,amount:0,count:0,critical:false,heavy:false,counter:false};groups.set(key,g);}
      g.amount+=e.amount;g.count++;g.critical ||= !!e.critical;g.heavy ||= !!e.skill||!!e.bossSkill;g.counter ||= !!e.counter;
    }
    const lanes=new Map();
    return [...groups.values()].map(g=>{const lane=(lanes.get(g.to)||0)%3;lanes.set(g.to,lane+1);return {...g,lane,text:g.type==='heal'?`+${g.amount}`:g.type==='shield'?`방어 ${g.amount}`:String(g.amount)};});
  }
  function createHealthTracker(){
    let battleId=null,lastTime=-Infinity;const entries=new Map();
    const value=(e,time)=>e.from+(e.to-e.from)*(1-Math.pow(1-clamp((time-e.at)/e.duration),3));
    return {
      begin(id,time){if(id!==battleId||time<lastTime||time-lastTime>2){entries.clear();battleId=id;}lastTime=time;},
      sample(id,hp,max,time,reduced=false,heal=null){
        const target=clamp(hp/Math.max(1,max));let e=entries.get(id);
        if(!e||e.max!==max){e={from:target,to:target,at:time,duration:.01,max,trail:target,trailAt:time};entries.set(id,e);}
        if(target!==e.to){const current=value(e,time);e.trail=Math.max(current,e.to);e.trailAt=time;e.from=current;e.to=target;e.at=time;e.duration=reduced?.12:target>current?.58:.23;}
        if(hp<=0){e.from=0;e.to=0;e.trail=0;}
        const ratio=value(e,time),trail=e.trail+(target-e.trail)*clamp((time-e.trailAt-.12)/.55);
        const healAge=heal?time-heal.time:Infinity;
        return {ratio,trail:Math.max(ratio,trail),healing:healAge>=0&&healAge<.7?1-healAge/.7:0};
      },
      clear(){entries.clear();battleId=null;lastTime=-Infinity;}
    };
  }
  return Object.freeze({numbers,createHealthTracker});
});
