/* Bounded raid renderer. Cached light texture; no per-frame image filters. */
window.SchoolRaidFX=(()=>{
 'use strict';
 const PI=Math.PI,clamp=n=>Math.max(0,Math.min(1,n)),mix=(a,b,t)=>a+(b-a)*t;
 let light;
 function glow(c,x,y,r,color,alpha=1){
  if(!light){light=document.createElement('canvas');light.width=light.height=96;const g=light.getContext('2d'),r=g.createRadialGradient(48,48,0,48,48,48);r.addColorStop(0,'#dfffffff');r.addColorStop(.25,'#7edaffb0');r.addColorStop(1,'#5aabff00');g.fillStyle=r;g.fillRect(0,0,96,96);}
  c.save();c.globalAlpha*=alpha;c.globalCompositeOperation='lighter';c.drawImage(light,x-r,y-r,r*2,r*2);c.fillStyle=color;c.globalAlpha*=.4;c.beginPath();c.arc(x,y,r*.14,0,PI*2);c.fill();c.restore();
 }
 function ring(c,x,y,r,color='#9ceaff',squash=.3){c.strokeStyle=color;c.beginPath();c.ellipse(x,y,r,Math.max(2,r*squash),0,0,PI*2);c.stroke();}
 function star(c,x,y,r,color,rotation=0){c.save();c.translate(x,y);c.rotate(rotation);c.fillStyle=color;c.beginPath();for(let i=0;i<8;i++){const a=i*PI/4,q=i%2?r*.3:r;c.lineTo(Math.cos(a)*q,Math.sin(a)*q);}c.closePath();c.fill();c.restore();}
 function beam(c,x,y,tx,ty,color,width=12){c.lineCap='round';for(const [k,a] of [[2.5,.12],[1,.5],[.25,1]]){c.strokeStyle=color;c.globalAlpha*=a;c.lineWidth=width*k;c.beginPath();c.moveTo(x,y);c.lineTo(tx,ty);c.stroke();c.globalAlpha/=a;}}
 function chain(c,x,y,tx,ty,bend=0,alpha=1){c.save();c.globalAlpha*=alpha;const angle=Math.atan2(ty-y,tx-x);for(let i=0;i<22;i++){const p=i/21,xx=mix(x,tx,p),yy=mix(y,ty,p)+Math.sin(p*PI)*bend;c.strokeStyle=i%2?'#ceefff':'#59b0f3';c.lineWidth=i%2?2:3;c.beginPath();c.ellipse(xx,yy,6,3,angle+(i%2?PI/4:0),0,PI*2);c.stroke();}c.restore();}
 function burst(c,x,y,age,color,count=10,scale=1){const f=clamp(age),fade=1-f;c.save();c.globalAlpha*=fade;for(let i=0;i<count;i++){const a=i*2.4,r=(14+f*55)*scale,xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*r*.6+f*f*15;star(c,xx,yy,(4-f*2)*scale,color,a);}c.lineWidth=2;ring(c,x,y,(12+f*55)*scale,color,.6);c.restore();}
 function draw(c,o){
  const {w,h,now,dt,battle,focus,events,bg,atlas,bars,reduced,units}=o;
  const t=o.visualTime??(battle?battle.elapsed+Math.min(1000,now-o.received):0),live=o.live;
  const floor=h*.88,size=Math.min(h*.74,360),scale=size*.36/49,bx=790,by=floor;
  const recent=events.filter(e=>now>=e.shown&&now-e.shown<(e.breath?4750:2000)),own=recent.filter(e=>e.team===focus),actors=new Map();
  for(const u of units)if(live&&u.breath&&!own.some(e=>e.id===u.id&&e.kind==='cast'&&e.breath))own.push({kind:'cast',id:u.id,team:focus,stage:4,breath:true,shown:now-(t-u.breath.began)});
  const breath=own.findLast(e=>e.kind==='cast'&&e.breath&&units.some(u=>u.id===e.id&&u.hp>0&&!(u.stunUntil>t))&&!own.some(x=>x.kind==='osia-breath-cancel'&&x.shown>=e.shown));
  for(const e of own){const a=actors.get(e.id)||{};a[e.kind]=e;if(['hit','immune','cast'].includes(e.kind))a.outgoing=e;actors.set(e.id,a);}
  const impact=recent.findLast(e=>e.kind==='impact'&&now-e.shown<(e.pattern==='basic'?650:1250)),cast=battle?.boss.cast;
  const age=impact?clamp((now-impact.shown)/(impact.pattern==='basic'?650:1250)):0;
  const hurtEvent=own.findLast(e=>e.kind==='hurt'&&e.pattern===impact?.pattern&&e.t===impact?.t);
  const positions=units.map((u,i)=>({x:150+(i%3)*113,y:floor-(i<3?Math.min(scale*44,h*.24):0)}));
  const target=positions[units.findIndex(u=>u.id===hurtEvent?.id)]||positions[0]||{x:260,y:floor};
  let bossX=bx,bossY=by+(live&&!reduced?Math.sin(now/400)*2:0),pose=0;
  if(cast)pose=cast.id==='guard'?4:cast.id==='rise'?2:['pull','storm','dash'].includes(cast.id)?3:1;
  if(impact){pose={basic:3,slam:1,rise:2,guard:4,dash:5,pull:3,storm:3}[impact.pattern]??0;if(!reduced){if(impact.pattern==='dash')bossX-=Math.sin(age*PI)*380;else if(impact.pattern==='basic')bossX-=Math.sin(age*PI)*24;bossY-=['rise','storm'].includes(impact.pattern)?Math.sin(age*PI)*9:0;}}
  c.save();if(!reduced&&impact&&impact.pattern!=='basic'&&age<.22){const decay=1-age/.22;c.translate(Math.sin(age*90)*3*decay,Math.cos(age*68)*1.8*decay);}
  c.fillStyle='#101d34';c.fillRect(0,0,w,h);if(bg.complete&&bg.naturalWidth)c.drawImage(bg,0,0,w,h);
  if(live){const hyeok=units.filter(u=>u.id==='hyeokjin');window.SchoolHyeokjinArt?.field(c,hyeok,t,w,h,reduced);const shake=window.SchoolHyeokjinArt?.shake(hyeok[0],t,reduced);if(shake)c.translate(shake.x,shake.y);}
  if(live&&breath){window.SchoolOsiaBreathArt?.field(c,(now-breath.shown)/1000,w,h,reduced);window.SchoolOsiaWeaponArt?.dragon(c,{source:positions[units.findIndex(u=>u.id===breath.id)],target:{x:bossX,y:bossY,aimY:bossY-size*.48},age:(now-breath.shown)/1000,reduced,economy:c.canvas.width<1000,scale:1.8,breath:true,layer:'back'});}
  // Floor warnings and energy gathering have silhouettes even with reduced motion.
  if(live&&cast){c.save();const alpha=reduced?.45:.35+Math.sin(now/130)*.12;c.globalAlpha=alpha;c.fillStyle='#246bd5';c.beginPath();c.ellipse(270,floor-8,210,Math.min(42,h*.1),0,0,PI*2);c.fill();c.lineWidth=3;ring(c,270,floor-8,210,'#ffd8a4',.17);glow(c,bossX,bossY-size*.48,size*.55,'#80cfff',.9);for(let i=0;i<5;i++){const a=now/700+i*PI*.4;star(c,bossX+Math.cos(a)*size*.3,bossY-size*.5+Math.sin(a)*size*.22,5,'#d2f6ff',a);}c.restore();}
  if(battle?.boss.guardUntil>t){c.save();glow(c,bossX,bossY-size*.44,size*.7,'#7ce4ff',.65);c.lineWidth=3;ring(c,bossX,bossY-size*.43,size*.41,'#aff4ff',1.15);ring(c,bossX,bossY-size*.43,size*.47,'#6bafff',1.05);c.restore();}
  if(atlas.complete&&atlas.naturalWidth){c.save();c.globalAlpha=o.hp===0?.35:1;SchoolArt.hitSprite(c,atlas,[pose%3*512,Math.floor(pose/3)*512,512,512,bossX-size/2,bossY-size*.93,size,size],(()=>{const e=events.findLast(e=>e.kind==='hit'&&e.amount>0&&e.shown<=now&&now-e.shown<200);return e?(now-e.shown)/1000:1;})());c.restore();}
  if(battle?.boss.stunUntil>t)for(let i=0;i<3;i++)star(c,bossX+(i-1)*16,bossY-size*.95+Math.sin(now/180+i)*4,5,'#ffea94',now/1000);
  units.forEach((u,i)=>{
   const p=positions[i],a=actors.get(u.id)||{},out=a.outgoing,outAge=out?(now-out.shown)/1000:9,castAge=a.cast?(now-a.cast.shown)/1000:9,hitAge=a.hurt?(now-a.hurt.shown)/1000:9;
   const breathAge=breath?.id===u.id?(now-breath.shown)/1000:undefined;
   const motion=breathAge>=0&&window.SchoolOsiaBreathArt?window.SchoolOsiaBreathArt.motion(breathAge,reduced):a.cast&&castAge<1.6?SchoolArt.poseForSkill(u.id,a.cast.stage||1,castAge,reduced):null;
   const dx=reduced||['kazua','hyeokjin'].includes(u.id)?0:motion?.dx||Math.sin(clamp(outAge/.65)*PI)*8;
   const recoil=reduced?0:Math.sin(clamp(hitAge/.3)*PI)*8;
   const baseKazua=SchoolArt.kazuaFrame(u,t,battle.elapsed),kazuaFrame=window.SchoolCombatFeedback?.kazuaPresentation(u,focus,events,now,baseKazua)||baseKazua;
   if(a.heal&&now-a.heal.shown<950){const f=(now-a.heal.shown)/950;c.save();c.globalAlpha=1-f;glow(c,p.x,p.y-scale*20,scale*35,'#94ffb5',.8);c.lineWidth=2;ring(c,p.x,p.y,scale*(16+f*12),'#8fffc3');for(let n=0;n<3;n++){c.fillStyle='#bcffd6';c.fillRect(p.x+(n-1)*scale*10-2,p.y-f*scale*38-n*7,4,9);c.fillRect(p.x+(n-1)*scale*10-5,p.y-f*scale*38-n*7+3,10,3);}c.restore();}
   if(u.shield>0){c.save();c.globalAlpha=.4+(a.hurt?.absorbed&&hitAge<.4?.4:0);c.strokeStyle='#b3e7ff';c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y-scale*18,scale*14,scale*22,0,0,PI*2);c.stroke();c.restore();}
   SchoolArt.hero(c,u.id,p.x+dx-recoil,p.y+(reduced?0:motion?.dy||0),scale,{exclusive:u.exclusive,osiaBreathAge:breathAge,osiaSpearAge:a['osia-drowning']?(now-a['osia-drowning'].shown)/1000:-1,kazuaActive:live,...kazuaFrame,...SchoolArt.hyeokjinFrame?.(u,t),...(a.dodge&&now-a.dodge.shown<350?{kazuaMode:'dodge',kazuaAge:(now-a.dodge.shown)/1000}:{}),attack:outAge<.65,dead:u.hp<=0,stunned:u.stunUntil>t,hit:hitAge<.2,time:now/1000,reduced,pose:motion?.pose,motion,casting:castAge<1.5,attackAge:out&&!out.skill&&outAge<1.1?outAge:undefined,basicAttackAt:out&&!out.skill?out.shown/1000:undefined,horasBasicPose:u.basicPose||1,horasStacks:u.stacks||0,horasCastAge:u.id==='horas'&&castAge<2.4?castAge:-1,taunting:u.id==='ryusion'&&SchoolRPG.ryusionGuard(units,t).taunting,passive:!!a.rescue&&now-a.rescue.shown<1200});
   if(live&&u.id==='hyeokjin')window.SchoolHyeokjinArt?.effects(c,{unit:u,time:t,source:{x:p.x+dx-recoil,y:p.y+(reduced?0:motion?.dy||0)},targets:[{x:bossX,y:bossY,aimY:bossY-size*.45}],scale,reduced,economy:c.canvas.width<1000});
   if(live&&u.id==='kazua'&&u.hp>0&&!(u.stunUntil>t)&&!(a.dodge&&now-a.dodge.shown<350))window.SchoolKazuaArt?.effects(c,{source:{x:p.x+dx-recoil,y:p.y+(reduced?0:motion?.dy||0)},targets:[{x:bossX,y:bossY,aimY:bossY-size*.45}],mode:kazuaFrame.kazuaMode||u.kazua?.mode||'idle',age:kazuaFrame.kazuaAge,time:now/1000,scale,reduced,economy:c.canvas.width<1000});
   const key=focus+':'+u.id,prior=bars.get(key)||{hp:u.hp,trail:u.hp},hpEvent=own.findLast(e=>e.id===u.id&&Number.isFinite(e.hpAfter)&&now-e.shown<1000),targetHP=hpEvent?.hpAfter??u.hp;
   prior.hp=mix(prior.hp,targetHP,Math.min(1,dt/135));prior.trail=mix(prior.trail,targetHP,Math.min(1,dt/450));bars.set(key,prior);
   const bw=Math.max(54,scale*35);window.SchoolCombatFeedback?.drawHealth(c,{x:p.x,y:p.y+5,width:bw,ratio:prior.hp/u.max,trail:prior.trail/u.max,shield:(u.shield||0)/u.max,healing:a.heal?Math.max(0,1-(now-a.heal.shown)/950):0});
   if(u.shield){c.fillStyle='#b8eaff';c.fillRect(p.x-bw/2,p.y+12,bw*clamp(u.shield/u.max),3);}
   if(u.hp>0&&u.hasteUntil>t){c.save();c.strokeStyle='#bbffe8';c.lineWidth=Math.max(1,scale*.7);for(let n=0;n<2;n++){const y=p.y-scale*(48+n*3);c.beginPath();c.moveTo(p.x-3*scale,y+2*scale);c.lineTo(p.x,y);c.lineTo(p.x+3*scale,y+2*scale);c.stroke();}c.restore();}
  });
  for(const e of own.filter(e=>e.kind==='spica-wind'&&now-e.shown<1600).slice(-1)){
   const p=positions[units.findIndex(u=>u.id==='spica')];if(p)SchoolArt.spicaSkillEffect(c,p,positions.filter((_,i)=>units[i].hp>0),[{x:bossX,y:bossY}],(now-e.shown)/1000,reduced,scale);
  }
  if(live){let until=0;for(const team of battle?.teams||[])until=Math.max(until,SchoolArt.spicaFieldUntil(team.units));SchoolArt.spicaBlizzard(c,{x:0,y:0,width:w,height:h},t,until,reduced,c.canvas.width<1000);}
  const osiaIndex=units.findIndex(u=>window.SchoolOsiaWeaponArt?.equipped(u));
  if(live&&osiaIndex>=0&&units[osiaIndex].hp>0&&!(units[osiaIndex].stunUntil>t)){
   const source=positions[osiaIndex],target={x:bossX,y:bossY,aimY:bossY-size*.48};
   for(const e of own.filter(e=>e.id==='osia'&&(e.kind==='osia-drowning'||e.kind==='cast'&&e.stage===4&&(!e.breath||e===breath))).slice(-3)){
    const opt={source,target,age:(now-e.shown)/1000,reduced,economy:c.canvas.width<1000,scale:1.8,breath:!!e.breath,layer:e.breath?'front':undefined};
    if(e.kind==='osia-drowning')window.SchoolOsiaWeaponArt.drowning(c,opt);else window.SchoolOsiaWeaponArt.dragon(c,opt);
   }
  }
  // Boss effects terminate at the actual server-selected target (including taunt).
  if(impact){const id=impact.pattern,fade=1-age;c.save();c.globalAlpha=fade;
   if(id==='basic'||id==='pull'||id==='dash'){
    const f=reduced?1:Math.min(1,age*3),tx=mix(bossX-30,target.x,f),ty=mix(bossY-size*.5,target.y-scale*25,f);
    chain(c,bossX-20,bossY-size*.5,tx,ty,-Math.sin(age*PI)*65);glow(c,tx,ty,id==='basic'?25:65,'#e0f9ff',.9);burst(c,target.x,target.y-scale*25,age,'#99e7ff',reduced?4:12,id==='basic'?.8:1.5);
    if(id==='dash'&&!reduced)for(let i=0;i<5;i++){c.strokeStyle='#bcefff';c.lineWidth=2;c.beginPath();c.moveTo(bossX+size*.3+i*18,bossY-size*.4+i*7);c.lineTo(bossX+size*.7+i*28,bossY-size*.4+i*7);c.stroke();}
   }else if(id==='slam'){
    glow(c,target.x,target.y-20,100,'#6bcfff',.9);for(let i=0;i<3;i++){c.lineWidth=5-i;ring(c,target.x,target.y,30+age*140+i*17,i%2?'#f0ffff':'#53bcff',.25);}
    for(let i=0;i<7;i++){const x=target.x+(i-3)*22;c.fillStyle=i%2?'#58b8ff':'#a0ebff';c.beginPath();c.moveTo(x-9,target.y);c.lineTo(x,target.y-(35+i%3*15)*Math.sin(age*PI));c.lineTo(x+10,target.y);c.fill();}
   }else if(id==='rise'){
    glow(c,300,floor-50,150,'#a2e5ff');for(let i=0;i<4;i++){c.lineWidth=15-i*3;c.strokeStyle=i%2?'#e3ffff':'#459eff';c.beginPath();c.arc(300,floor-20,50+i*17+age*60,PI*(.08+age*.2),PI*(1.05+age*.5));c.stroke();}burst(c,300,floor-80,age,'#ceffff',reduced?5:16,1.7);
   }else if(id==='storm'){
    glow(c,280,floor-40,230,'#62baff',.9);for(let i=0;i<4;i++){const x=140+i*95;chain(c,bossX,bossY-size*.5,x,floor-30,Math.sin(now/100+i)*70,.8);beam(c,x+25,Math.max(0,floor-h*.75),x,floor,'#8bdbff',12);ring(c,x,floor,35+age*30,'#b8faff');}burst(c,280,floor-60,age,'#ddfaff',reduced?5:16,2);
   }else{glow(c,bossX,bossY-size*.46,size*.8,'#d9faff');for(let i=0;i<3;i++){c.lineWidth=3;ring(c,bossX,bossY-size*.43,size*(.3+i*.08+age*.1),'#b7edff',1);}}
   c.restore();
  }
  // Every attack remains visible, even when a physical attack is immune.
  for(const e of own.filter(e=>e.id!=='kazua'&&['hit','immune'].includes(e.kind)&&now-e.shown<850).slice(-12)){
   const p=positions[units.findIndex(u=>u.id===e.id)];if(!p)continue;const f=clamp((now-e.shown)/850),travel=clamp(f/.4),color=e.kind==='immune'?'#c5c9df':e.id==='horas'?'#ffc3e7':e.id==='lava'?'#a0ffe1':e.id==='spica'?'#d9f6ff':'#8ee5ff';
   c.save();c.globalAlpha=1-f;const x=mix(p.x+10,bossX,travel),y=mix(p.y-scale*28,bossY-size*.5,travel);glow(c,x,y,e.skill?35:16,color,.8);c.fillStyle=color;c.fillRect(x-5,y-4,e.skill?16:10,8);if(f>.35)burst(c,bossX,bossY-size*.5,(f-.35)/.65,color,reduced?3:8,e.skill?1.5:.6);c.restore();
  }
  for(const e of own.filter(e=>e.id!=='kazua'&&e.kind==='hit'&&e.skill&&now-e.shown<1550).slice(-3)){
   const p=positions[units.findIndex(u=>u.id===e.id)];if(!p)continue;const f=clamp((now-e.shown)/1550);c.save();c.globalAlpha=1-f;
   if(e.id==='horas'){glow(c,bossX,bossY-size*.55,180,'#ffd2f1',.85);star(c,bossX,Math.max(45,bossY-size*1.1),38,'#ffe2f4',f*PI);beam(c,bossX,20,bossX,bossY-size*.4,'#ffb4ec',45);ring(c,bossX,bossY-3,70+f*55,'#ffccf0',.3);burst(c,bossX,bossY-size*.5,f,'#ffd2eb',reduced?5:18,2);}
   else if(e.id==='osia'){
    if(e.skill.includes('수룡')||e.skill.includes('신수')){if(osiaIndex<0){const headX=mix(p.x,bossX,Math.min(1,f*2)),headY=mix(p.y-scale*25,bossY-size*.5,f);for(let i=18;i>=0;i--){const x=headX-i*14,y=headY+Math.sin(f*9+i*.4)*25,r=Math.max(3,19-i*.6);glow(c,x,y,r*1.8,'#63dfff',.45);c.fillStyle=i%2?'#77d8ff':'#b2f3ff';c.beginPath();c.arc(x,y,r,0,PI*2);c.fill();}star(c,headX+12,headY-8,9,'#f2ffff',.2);beam(c,headX-8,headY-10,headX-22,headY-32,'#ecffff',4);}}
    else if(e.skill.includes('소용돌이')){for(let i=0;i<5;i++){c.lineWidth=6;ring(c,bossX,bossY-12-i*22,60-i*8+Math.sin(f*12+i)*9,'#9cecff',.25);}glow(c,bossX,bossY-55,100,'#64cdff');}
    else if(e.skill.includes('기둥')){beam(c,bossX,bossY,bossX,Math.max(10,bossY-size*1.2),'#80dcff',60);burst(c,bossX,bossY,f,'#c7faff',12,2);}
    else glow(c,bossX,bossY-size*.5,90,'#b6f8ff');
   }else burst(c,bossX,bossY-size*.4,f,'#cabaff',reduced?4:10,1.5);
   c.restore();
  }
  const numbers=own.filter(e=>['hit','heal','hurt','shield','immune','miss','dodge'].includes(e.kind)&&now-e.shown<1100).slice(-18);
  for(const e of numbers){const p=positions[units.findIndex(u=>u.id===e.id)];if(!p)continue;const f=(now-e.shown)/1100,isOut=['hit','immune','miss'].includes(e.kind),x=isOut?bossX-50+(e.seq%5)*22:p.x,y=(isOut?bossY-size*.7:p.y-scale*40)-f*27-(e.seq%2)*13;
   const word=e.kind==='dodge'?'회피':e.kind==='hurt'?(e.amount?'-'+Math.round(e.amount).toLocaleString('ko-KR'):'보호막 '+Math.round(e.absorbed).toLocaleString('ko-KR')):e.kind==='heal'?'+'+e.amount.toLocaleString('ko-KR'):e.kind==='shield'?'보호막 +'+e.amount.toLocaleString('ko-KR'):e.kind==='immune'?'물리 무효':e.kind==='miss'?'빗나감':e.amount.toLocaleString('ko-KR');
   c.save();c.globalAlpha=1-f*f;c.font=`800 ${Math.max(13,Math.min(20,h*.065))}px Pretendard, sans-serif`;c.textAlign='center';c.lineWidth=3;c.strokeStyle='#102034';c.strokeText(word,x,y);c.fillStyle=e.kind==='heal'?'#afffc5':e.kind==='hurt'&&e.amount?'#ffb0a0':e.kind==='shield'||e.absorbed?'#c6edff':e.crit?'#ffe98c':'#fff9e2';c.fillText(word,x,y);
   if(e.crit)star(c,x-30,y-6,6,'#ffeb85',.2);if(e.kind==='hurt'&&e.amount&&e.absorbed){c.font='11px Pretendard, sans-serif';c.fillStyle='#b6e7ff';c.fillText('보호막 '+e.absorbed,x,y+13);}c.restore();
  }
  if(live){window.SchoolBattlePolish?.speedField(c,units,[{...battle.boss,boss:true}],t,w,8);window.SchoolBattlePolish?.focus(c,own,now,w,h,reduced);}
  c.restore();return{effects:recent.length,hits:own.filter(e=>e.kind==='hurt').length};
 }
 return{draw};
})();
