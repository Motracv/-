/* Presentation-only state. Never changes HP, damage, timers or a saved battle. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SchoolCombatFeedback=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const clamp=n=>Math.max(0,Math.min(1,n));
  // Only replay events already confirmed by the server. A poll may contain
  // several 250ms turns; backdating all of them made short shots disappear and
  // every HP change arrive in the same paint. This bounded queue preserves
  // simultaneous server turns and spreads different turns over at most 650ms.
  function createSnapshotTimeline({limit=160,spreadMs=650,staleMs=2200}={}){
    let id=null,battle=null,seq=0,received=0,anchor=0,live=false,queue=[],painted=null;
    const eventLife=e=>e.breath&&['cast','dragon','osia-breath-cancel'].includes(e.kind)?4750:e.id==='horas'&&e.kind==='cast'?2600:e.kind==='hyeokjin-mode'?Math.max(staleMs,Math.min(3500,e.duration||0)):staleMs;
    const clock=now=>battle?anchor+(live?Math.max(0,now-received):0):0;
    function clear(){id=null;battle=null;seq=0;received=anchor=0;live=false;queue=[];painted=null;}
    function suspend(){queue=[];painted=null;}
    function accept(next,key,now,{active=true,hidden=false}={}){
      if(!next||!Number.isFinite(now)||!Number.isFinite(next.elapsed)){clear();return [];}
      const changed=id!==key||!battle,oldTime=clock(now),oldElapsed=battle?.elapsed??0;
      const resuming=hidden||!changed&&(now-received>staleMs||next.elapsed<oldElapsed);
      // Joining an existing battle never replays the combat that happened away.
      const initial=changed&&next.elapsed>1000;
      if(changed||resuming){queue=[];seq=initial||resuming?next.seq:0;painted=null;}
      id=key;battle=next;anchor=active&&!changed&&!resuming?Math.max(next.elapsed,oldTime):next.elapsed;received=now;live=active;
      const fresh=(next.events||[]).filter(e=>e.seq>seq&&Number.isFinite(e.t)&&e.t>=next.elapsed-staleMs).sort((a,b)=>a.t-b.t||a.seq-b.seq);
      seq=Math.max(seq,next.seq||0);
      queue=queue.filter(e=>now-e.shown<eventLife(e));
      if(fresh.length&&!hidden&&!initial&&!resuming){
        const first=fresh[0].t,last=fresh[fresh.length-1].t,tail=queue[queue.length-1];
        const start=Math.min(now+spreadMs,Math.max(now,tail?.shown>now?tail.shown+Math.min(120,Math.max(0,first-tail.t)):now));
        const span=Math.min(Math.max(0,last-first),Math.max(0,now+spreadMs-start));
        queue.push(...fresh.map(e=>({...e,shown:start+(last>first?(e.t-first)/(last-first)*span:0)})));
      }
      // A finished result must never show a still-living visual copy of a unit.
      if(!active)for(const e of queue)e.shown=Math.min(now,e.shown);
      queue=queue.slice(-limit);return queue;
    }
    function events(now){
      if(painted!==null&&now-painted>staleMs)queue=[];
      painted=now;queue=queue.filter(e=>now-e.shown<eventLife(e));return queue;
    }
    function view(now){
      if(!battle)return null;
      const waiting=queue.filter(e=>e.shown>now);
      if(!waiting.length)return battle;
      const bossPending=waiting.reduce((sum,e)=>sum+(e.kind==='hit'?Math.max(0,e.amount||0):0),0),deltas=new Map();
      for(const e of waiting)if(e.kind==='hurt'||e.kind==='heal'){
        const key=e.team+':'+e.id;deltas.set(key,(deltas.get(key)||0)+(e.kind==='hurt'?1:-1)*Math.max(0,e.amount||0));
      }
      // Work backwards from the newest confirmed HP. No simulated damage,
      // randomness, combat timers or account state are modified here.
      return {...battle,boss:{...battle.boss,hp:Math.min(battle.boss.max,battle.boss.hp+bossPending)},teams:battle.teams.map((team,ti)=>({...team,units:team.units.map(u=>({...u,hp:team.withdrawn?u.hp:Math.max(0,Math.min(u.max,u.hp+(deltas.get(ti+':'+u.id)||0)))}))}))};
    }
    return {accept,events,view,clock,clear,suspend};
  }
  const basicMs=id=>({horas:1180,lava:1000,spica:850})[id]||650;
  const castMs=id=>({horas:2450,lava:1800,osia:1650,spica:1600,ryusion:1400})[id]||1300;
  function hyeokjinPresentation(unit,team,events,now,time,blocked=false){
    if(unit?.id!=='hyeokjin')return unit;
    if(blocked||unit.hp<=0||unit.stunUntil>time)return {...unit,hyeokjin:{...unit.hyeokjin,mode:'idle',modeUntil:time,cast:null}};
    const e=events.findLast(e=>e.id==='hyeokjin'&&e.team===team&&e.shown<=now&&['hyeokjin-mode','hyeokjin-cancel'].includes(e.kind));
    if(!e)return unit;
    if(e.kind==='hyeokjin-cancel')return {...unit,hyeokjin:{...unit.hyeokjin,mode:'idle',modeUntil:time,cast:null}};
    const age=now-e.shown,duration=Math.min(3500,e.duration||0);if(age>=duration)return unit;
    const began=time-age;return {...unit,hyeokjin:{...unit.hyeokjin,mode:e.mode,began,modeUntil:began+duration,impactAt:began+(e.impactDelay||0),used:unit.hyeokjin?.used||e.awakened||e.mode==='transform',cast:null}};
  }
  function kazuaPresentation(unit,team,events,now,frame={}){
    if(unit?.id!=='kazua'||unit.hp<=0)return frame;
    const shot=events.findLast(e=>e.kind==='kazua-shot'&&e.team===team&&e.shown<=now&&['pistol','bazooka'].includes(e.mode)&&now-e.shown<(e.mode==='bazooka'?1500:550));
    return shot?{...frame,kazuaMode:shot.mode,kazuaAge:(now-shot.shown)/1000}:frame;
  }
  const numberCache=new WeakMap();
  const hash=s=>{let n=2166136261;for(const ch of String(s))n=Math.imul(n^ch.charCodeAt(0),16777619);return n>>>0;};
  function numbers(effects,time,{format='campaign',limit=96}={}) {
    const stamp=e=>format==='campaign'?e.time:(format==='arena'?e.t:e.shown)/1000;
    const shotKey=e=>`${e.team??e.side??''}:${e.from||e.id}:${stamp(e)}`;
    const shots=new Map();for(const e of effects)if(e.kind==='kazua-shot')shots.set(shotKey(e),e.mode);
    const output=[];
    for(const e of effects){
      if(!(e.amount>0)||!Number.isFinite(e.amount))continue;
      const type=['heal','enemy-heal'].includes(e.kind)?'heal':e.kind==='shield'?'shield':(format==='arena'?['attack','skill']:['hit','hurt']).includes(e.kind)?'damage':null;
      if(!type)continue;const at=stamp(e);if(!Number.isFinite(at)||time<at||time-at>1.8)continue;
      const from=e.from||e.id,mode=e.kazuaMode||e.mode||shots.get(shotKey(e));
      const rapid=from==='kazua'&&type==='damage'&&e.kind!=='hurt'&&['fire','red'].includes(mode);
      let cached=numberCache.get(e);const cacheKey=format+':'+mode;
      if(!cached||cached.key!==cacheKey){
        const count=rapid&&Number.isSafeInteger(e.amount)?Math.min(e.amount,mode==='red'?25:10):1;
        const base=Math.floor(e.amount/count),remainder=e.amount-base*count;
        const to=format==='campaign'?e.to:format==='arena'?`${e.toSide}:${e.target}`:e.kind==='hit'?'boss':`${e.team??0}:${e.id}`;
        const seed=hash(`${e.battleId||''}:${e.seq??e.t??e.time}:${from}:${to}`);
        cached={key:cacheKey,parts:Array.from({length:count},(_,i)=>{
          const amount=count===1?e.amount:base+(i<remainder?1:0),word=amount.toLocaleString('en-US');
          return {to,from,type,side:format==='campaign'?e.side:e.kind==='hurt'?'hero':'enemy',time:at+(rapid?i*(mode==='red'?.02:.05):0),amount,count:1,critical:!!(e.critical||e.crit),heavy:!!(e.skill||e.bossSkill||e.kind==='skill'),counter:!!e.counter,lane:seed%3,stack:rapid?i%5:0,rapid,text:type==='heal'?`+${word}`:type==='shield'?`방어 ${word}`:word};
        })};numberCache.set(e,cached);
      }
      for(const n of cached.parts)if(time>=n.time&&time-n.time<(n.rapid?.82:1.2))output.push(n);
    }
    output.sort((a,b)=>a.time-b.time);
    if(output.length<=limit)return output;
    // Under heavy load coalesce the oldest visible labels by recipient/type;
    // retain their exact amounts, instead of discarding or inventing damage.
    const groups=new Map();let cursor=0;
    while(cursor<output.length&&output.length-cursor+groups.size>limit){
      const n=output[cursor++],key=n.to+':'+n.type;let g=groups.get(key);if(!g)groups.set(key,g={...n,rapid:false,stack:0,amount:0,count:0});g.amount+=n.amount;g.count++;g.time=Math.max(g.time,n.time);g.critical ||= n.critical;
    }
    return [...groups.values()].map(n=>({...n,text:(n.type==='heal'?'+':n.type==='shield'?'방어 ':'')+n.amount.toLocaleString('en-US')})).concat(output.slice(cursor));
  }
  function drawNumbers(c,effects,time,position,{format='campaign',scale=1,reduced=false,limit=96}={}){
    for(const n of numbers(effects,time,{format,limit})){
      const p=position(n.to);if(!p)continue;const age=time-n.time,life=n.rapid?.82:1.2;
      const x=p.x+([0,-12,12][n.lane]+(n.rapid?(n.stack%2?3:-3):0))*scale;
      const y=(p.numberY??p.y-62*scale)-(n.stack*12+n.lane*9+age*(reduced?7:25))*scale;
      c.save();c.globalAlpha*=Math.min(1,age/.035+.45,(life-age)/.28);
      const pop=reduced?1:1+Math.max(0,1-age/.14)*(n.critical?.16:.08);c.translate(x,Math.max(16*scale,y));c.scale(pop,pop);
      const color=n.type==='heal'?'#99ffd0':n.type==='shield'?'#a3dcff':n.side==='hero'?'#ff9eac':n.critical?'#ffda77':n.heavy?'#ffeabb':'#fff9ed';
      globalThis.SchoolArt?.combatNumber(c,n.text,0,0,(n.rapid?11:n.critical?16:n.type==='heal'?14:12)*scale,color,n.critical);c.restore();
    }
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
  return Object.freeze({basicMs,castMs,hyeokjinPresentation,numbers,drawNumbers,createHealthTracker,drawHealth,createSnapshotTimeline,kazuaPresentation});
});
