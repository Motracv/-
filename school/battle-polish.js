/* Shared, nonblocking skill closeups and live Spica status for every arena. */
window.SchoolBattlePolish=(()=>{
 'use strict';
 const clamp=n=>Math.max(0,Math.min(1,n));
 function latest(events,now){
  let found=null,at=-Infinity;
  for(const e of events||[]){
   const id=e.from||e.id;if(!window.SchoolRPG.BY_ID[id])continue;
   const t=e.shown??e.t??e.time*1000,age=(now-t)/1000;if(!Number.isFinite(age)||age<0||age>=.72)continue;
   const special=['osia-breath','horas-cast','spica-skill','spica-wind','ryusion-skill','lava-skill'].includes(e.kind)||e.kind==='kazua-mode'&&e.mode==='red';
   const skill=['skill-stage','cast','skill','heal','shield'].includes(e.kind)&&(!e.breath||['skill-stage','cast'].includes(e.kind))&&!['kazua','horas'].includes(id)&&(id!=='osia'||e.stage===4)&&(!['heal','shield'].includes(e.kind)||!!e.skill);
   if((special||skill)&&t>=at){found={id,age,stage:e.stage||1,name:e.name||e.skill||window.SchoolRPG.BY_ID[id].skill};at=t;}
  }
  return found;
 }
 function focus(c,events,now,w,h,reduced=false){
  const shot=latest(events,now);if(!shot)return false;
  const def=window.SchoolRPG.BY_ID[shot.id],color=({water:'#7eeaff',blossom:'#ffb6e8',ice:'#b1edff',earth:'#e5c676',wind:'#9fe5bd'})[def.element]||'#f0bc86';
  c.save();c.beginPath();c.rect(0,0,w,h);c.clip();
  const fade=clamp(shot.age/.075)*clamp((.72-shot.age)/.16);c.globalAlpha*=fade;
  if(reduced){
   c.fillStyle='#101b2de8';c.fillRect(w*.25,6,w*.5,25);c.fillStyle=color;c.textAlign='center';c.font=`bold ${Math.max(10,w/60)}px Galmuri, sans-serif`;c.fillText(`${def.name} · ${shot.name}`,w*.5,23,w*.48);c.restore();return true;
  }
  // A diagonal panel and a short 12% push-in; simulation and inputs never pause.
  c.fillStyle='#070f1a70';c.fillRect(0,0,w,h);
  c.fillStyle='#101b2deb';c.beginPath();c.moveTo(0,h*.08);c.lineTo(w*.66,0);c.lineTo(w*.48,h);c.lineTo(0,h);c.closePath();c.fill();
  c.strokeStyle=color;c.lineWidth=Math.max(1,w/400);c.beginPath();c.moveTo(0,h*.1);c.lineTo(w*.65,0);c.moveTo(0,h*.96);c.lineTo(w*.49,h*.87);c.stroke();
  for(let i=0;i<5;i++){c.globalAlpha=fade*(.1+i*.025);c.strokeStyle=color;c.beginPath();c.moveTo(0,h*(.2+i*.13));c.lineTo(w*(.25+i*.03),h*(.13+i*.13));c.stroke();}
  c.globalAlpha=fade;
  const push=1+.12*Math.sin(clamp(shot.age/.55)*Math.PI),scale=h*.81/48*push;
  window.SchoolArt.hero(c,shot.id,w*.25,h*.94,scale,{pose:2,casting:true,time:shot.age,attackAge:undefined,horasCastAge:shot.id==='horas'?.4:-1,kazuaActive:true,kazuaMode:shot.id==='kazua'?'red':undefined,kazuaAge:shot.age,motion:{lean:0,stretch:1,age:shot.age,pose:2}});
  c.textAlign='left';c.fillStyle=color;c.font=`bold ${Math.max(12,w*.026)}px Galmuri, sans-serif`;c.fillText(def.name,w*.48,h*.42,w*.47);
  c.fillStyle='#ffffff';c.font=`bold ${Math.max(15,w*.038)}px Galmuri, sans-serif`;c.fillText(shot.name,w*.48,h*.55,w*.49);
  c.fillStyle=color;c.fillRect(w*.48,h*.61,w*.37,Math.max(2,h*.009));
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
 return Object.freeze({latest,focus,speedField});
})();
