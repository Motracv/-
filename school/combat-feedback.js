/* Presentation-only state. Never changes HP, damage, timers or a saved battle. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SchoolCombatFeedback=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const clamp=n=>Math.max(0,Math.min(1,n));
  function numbers(effects,time) {
    const groups=new Map();
    for(const e of effects){
      const age=time-e.time;
      if(age<0||age>=1.55||!['hit','heal','enemy-heal','shield'].includes(e.kind)||!(e.amount>0))continue;
      const type=e.kind==='hit'?'damage':e.kind==='shield'?'shield':'heal',key=`${e.battleId}:${e.to}:${type}:${e.time}`;
      let g=groups.get(key);
      if(!g){g={to:e.to,type,side:e.side,time:e.time,amount:0,count:0,critical:false,heavy:false,counter:false};groups.set(key,g);}
      g.amount+=e.amount;g.count++;g.critical ||= !!e.critical;g.heavy ||= !!e.skill||!!e.bossSkill;g.counter ||= !!e.counter;
    }
    const lanes=new Map();
    return [...groups.values()].slice(-36).map(g=>{const lane=(lanes.get(g.to)||0)%3;lanes.set(g.to,lane+1);const amount=g.amount.toLocaleString('en-US');return {...g,lane,text:g.type==='heal'?`+${amount}`:g.type==='shield'?`방어 ${amount}`:amount};});
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
  function drawHealth(c,{x,y,width=40,ratio=1,trail=ratio,healing=0,side='hero',shield=0,boss=false}){
    const h=boss?8:6,left=Math.round(x-width/2),top=Math.round(y),r=clamp(ratio),color=side==='enemy'?'#f27c8c':r<.25?'#ffae78':healing>0?'#a3ffd2':'#76e5b0';
    c.save();c.fillStyle='#0d1930';c.fillRect(left-2,top-2,width+4,h+4);c.fillStyle='#637b94';c.fillRect(left-1,top-1,width+2,h+2);c.fillStyle='#243449';c.fillRect(left,top,width,h);
    c.fillStyle='#f3d6a0';c.fillRect(left,top,width*Math.max(r,clamp(trail)),h);c.fillStyle=color;c.fillRect(left,top,width*r,h);c.fillStyle='#ffffff65';c.fillRect(left,top,width*r,1);
    c.fillStyle='#15364366';for(let i=1;i<4;i++)c.fillRect(left+width*i/4,top+1,1,h-1);
    if(shield>0){c.fillStyle='#b0e5ff';c.fillRect(left,top-4,width*clamp(shield),2);}
    if(healing>0&&r>0){c.globalAlpha*=clamp(healing);c.fillStyle='#e5fff5';c.fillRect(left+width*r-1,top-1,2,h+2);c.fillRect(left+width+5,top+1,2,6);c.fillRect(left+width+3,top+3,6,2);}
    c.restore();
  }
  return Object.freeze({numbers,createHealthTracker,drawHealth});
});
