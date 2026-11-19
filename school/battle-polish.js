/* Shared, nonblocking skill closeups and live Spica status for every arena. */
window.SchoolBattlePolish=(()=>{
 'use strict';
 let skinFace=null;
 function faceImage(){if(!skinFace&&typeof Image!=='undefined'){skinFace=new Image();skinFace.src='school/assets/horas-after-school/profile.webp?v=horas-illust1';}return skinFace;}
 const clamp=n=>Math.max(0,Math.min(1,n));
 function latest(events,now){
  let found=null,at=-Infinity;
  for(const e of events||[]){
   const id=e.from||e.id;if(!window.SchoolRPG.BY_ID[id])continue;
   const t=e.shown??e.t??e.time*1000,age=(now-t)/1000;if(!Number.isFinite(age)||age<0||age>=.72)continue;
   const special=id==='horas'&&e.kind==='cast'||['osia-breath','horas-cast','spica-skill','spica-wind','ryusion-skill','lava-skill'].includes(e.kind)||e.kind==='kazua-mode'&&e.mode==='red'||e.kind==='hyeokjin-mode'&&e.mode!=='basic';
   const skill=['skill-stage','cast','skill','heal','shield'].includes(e.kind)&&(!e.breath||['skill-stage','cast'].includes(e.kind))&&!['kazua','horas','hyeokjin'].includes(id)&&(id!=='osia'||e.stage===4)&&(!['heal','shield'].includes(e.kind)||!!e.skill);
   if((special||skill)&&t>=at){found={id,age,team:e.team,side:e.side,stage:e.stage||1,name:e.name||e.skill||window.SchoolRPG.BY_ID[id].skill};at=t;}
  }
  return found;
 }
 const noticeQueues=new WeakMap();
 function queued(canvas,events,now,key){
  let state=noticeQueues.get(canvas);
  if(!state||state.key!==key||now<state.last||now-state.last>3000){state={key,last:now,current:null,queue:[],seen:new Map()};noticeQueues.set(canvas,state);}
  state.last=now;for(const [id,at] of state.seen)if(now-at>8000)state.seen.delete(id);
  for(const e of events||[]){const shot=latest([e],now);if(!shot)continue;const at=e.shown??e.t??e.time*1000;
   const identity=[e.battleId||key,shot.team??shot.side??'',shot.id,e.castId??Math.round(at/100),shot.stage].join(':');
   if(state.seen.has(identity))continue;state.seen.set(identity,now);
   if(state.queue.some(n=>n.id===shot.id&&n.team===shot.team&&n.side===shot.side&&now-n.arrived<300))continue;
   if(state.queue.length<4)state.queue.push({...shot,arrived:now});
  }
  if(state.current&&now-state.current.started>=1800)state.current=null;
  if(!state.current){state.queue=state.queue.filter(n=>now-n.arrived<6000);const next=state.queue.shift();if(next)state.current={...next,started:now};}
  return state.current?{...state.current,age:(now-state.current.started)/1000,pending:state.queue.length}:null;
 }
 function focus(c,events,now,w,h,reduced=false,appearance=()=>null,key='combat'){
  const shot=queued(c.canvas,events,now,key);if(!shot)return false;
  const def=window.SchoolRPG.BY_ID[shot.id],color=({water:'#7eeaff',blossom:'#ffb6e8',ice:'#b1edff',earth:'#e5c676',wind:'#9fe5bd',dark:'#ef8fbd'})[def.element]||'#f0bc86';
  c.save();c.beginPath();c.rect(0,0,w,h);c.clip();
  const fade=clamp(shot.age/.075)*clamp((1.8-shot.age)/.22);c.globalAlpha*=fade;
  // A compact bottom-left notice keeps the battlefield and targets visible.
  const unit=Math.min(w/480,h/280,1.6),x=8*unit;
  const panelW=156*unit,panelH=(reduced?42:56)*unit,y=h-panelH-8*unit;
  const backdrop=c.createLinearGradient(x,y,x+panelW,y);
  backdrop.addColorStop(0,'#101b2de8');backdrop.addColorStop(.28,'#101b2dcc');
  backdrop.addColorStop(.65,'#101b2d70');backdrop.addColorStop(1,'#101b2d00');
  c.fillStyle=backdrop;c.fillRect(x,y,panelW,panelH);
  c.fillStyle=color;c.fillRect(x,y,2*unit,panelH);
  if(!reduced){
   // Gently push in on the portrait only; the small panel stays anchored.
   const zoom=1+.08*(1-Math.pow(1-clamp(shot.age/.3),3));
   const image=shot.id==='horas'&&appearance(shot)==='horas_after_school'?faceImage():null;
   if(image?.complete&&image.naturalWidth){c.save();c.beginPath();c.rect(x+4*unit,y+2*unit,43*unit,panelH-4*unit);c.clip();const size=56*unit*zoom;c.drawImage(image,x+25*unit-size/2,y+panelH/2-size/2,size,size);c.restore();}
   else window.SchoolArt.hero(c,shot.id,x+25*unit,y+50*unit,zoom*unit,{skin:appearance(shot),pose:2,casting:true,time:shot.age,attackAge:undefined,horasCastAge:shot.id==='horas'?.4:-1,kazuaActive:true,kazuaMode:shot.id==='kazua'?'red':undefined,kazuaAge:shot.age,motion:{lean:0,stretch:1,age:shot.age,pose:2}});
  }
  const textX=x+(reduced?10:50)*unit,textY=y+(reduced?15:20)*unit,textW=panelW-(reduced?20:57)*unit;
  c.textAlign='left';c.fillStyle=color;c.font=`bold ${10*unit}px Galmuri, sans-serif`;c.fillText(def.name,textX,textY,textW);
  c.fillStyle='#ffffff';c.font=`bold ${11*unit}px Galmuri, sans-serif`;c.fillText(shot.name,textX,textY+17*unit,textW);
  if(shot.pending){c.font=`bold ${7*unit}px Galmuri, sans-serif`;c.fillStyle='#becfe3';c.fillText('+'+shot.pending,x+panelW-14*unit,y+9*unit);}
  c.restore();return true;
 }
 function speedField(c,allies,enemies,time,w,y=32){
  let haste=0,slow=0,boss=false;
  for(const u of allies||[])if(u.hp>0)haste=Math.max(haste,u.hasteUntil||0);
  for(const u of enemies||[])if(u.hp>0&&(u.slowUntil||0)>slow){slow=u.slowUntil;boss=!!u.boss;}
  if(haste<=time&&slow<=time)return false;
  const rules=window.SchoolRPG.SPICA_RULES,parts=[];
  if(haste>time)parts.push(`아군 기본 공속 +${Math.round(rules.haste*100)}% · ${Math.ceil((haste-time)/1000)}초`);
  if(slow>time)parts.push(`적 공속 −${rules.slow*100*(boss?rules.bossSlowScale:1)}% · ${Math.ceil((slow-time)/1000)}초`);
  const font=Math.max(9,Math.min(15,w/55)),text='스피카 · '+parts.join('  /  ');
  c.save();c.font=`bold ${font}px Galmuri, sans-serif`;c.textAlign='center';
  const width=Math.min(w-16,c.measureText(text).width+20);c.fillStyle='#10374bf0';c.fillRect((w-width)/2,y,width,font+13);c.strokeStyle='#8fe3f1';c.lineWidth=1;c.strokeRect((w-width)/2,y,width,font+13);c.fillStyle='#d5fbff';c.fillText(text,w/2,y+font+3,width-10);c.restore();return true;
 }
 faceImage();
 return Object.freeze({latest,queued,focus,speedField});
})();
