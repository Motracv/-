/* Yaho's small, foot-anchored silhouette and layered fan/guardian choreography. */
window.SchoolYahoArt=(()=>{
 'use strict';
 const sheets={},TAU=Math.PI*2,SIZE=.76,clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{n=clamp(n);return n*n*(3-2*n);};
 const ready=Promise.all(['combat','spirits'].map(name=>new Promise(resolve=>{
  const image=new Image(),sheet=sheets[name]={image,loaded:false},timer=setTimeout(()=>resolve(false),7000);
  image.onload=()=>{sheet.loaded=true;clearTimeout(timer);resolve(true);window.dispatchEvent(new Event('school-art-ready'));};
  image.onerror=()=>{clearTimeout(timer);resolve(false);};image.src=`school/assets/yaho/${name}.webp?v=yaho1`;
 })));
 function pose(frame={}){
  if(frame.dead||frame.stunned||frame.frozen)return 0;
  if(frame.hit)return 11;
  if(frame.casting){const age=frame.castAge||0;if(age>1.7)return 0;return frame.yahoStage===3?9:frame.yahoStage===2?8:age<.8?6:7;}
  if(frame.walking||frame.running)return Math.floor((frame.time||0)*6)%2+2;
  if(frame.attack||Number.isFinite(frame.attackAge)&&frame.attackAge>=0&&frame.attackAge<.8)return (frame.attackAge||0)<.16?4:5;
  return frame.victory?10:frame.blink?1:0;
 }
 function spirit(c,index,x,y,w,h){const s=sheets.spirits;if(!s?.loaded)return;const iw=s.image.naturalWidth/2,ih=s.image.naturalHeight/2;c.drawImage(s.image,index%2*iw,Math.floor(index/2)*ih,iw,ih,x,y,w,h);}
 function ellipse(c,x,y,rx,ry){c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);c.stroke();}
 function spark(c,x,y,r){c.fillRect(x-r,y-.7,r*2,1.4);c.fillRect(x-.7,y-r,1.4,r*2);}
 function motion(frame={}){
  if(frame.reduced||frame.dead||frame.stunned||frame.frozen)return {x:0,y:0,lean:0,wide:1,tall:1};
  const t=frame.time||0,age=frame.attackAge||0;
  if(frame.casting){const age=frame.castAge||0,wave=Math.sin(clamp(age/1.7)*Math.PI);return {x:0,y:0,lean:frame.yahoStage===1?-.035*wave:.012*wave,wide:1+.025*wave,tall:1-.018*wave};}
  if(frame.attack||Number.isFinite(frame.attackAge)&&age>=0&&age<.8){const charge=1-ease(age/.16),strike=ease((age-.13)/.15)*(1-ease((age-.3)/.4));return {x:-1.3*charge+3.2*strike,y:0,lean:-.028*charge+.05*strike,wide:1+.025*charge,tall:1-.025*charge};}
  if(frame.walking||frame.running)return {x:0,y:-Math.abs(Math.sin(t*18))*.65,lean:Math.sin(t*18)*.02,wide:1,tall:1};
  return {x:0,y:0,lean:0,wide:1+Math.sin(t*2.2)*.004,tall:1-Math.sin(t*2.2)*.004};
 }
 function basicFx(c,age,reduced){
  if(age<.14||age>.66)return;const progress=clamp((age-.14)/.52),alpha=Math.sin(progress*Math.PI),sweep=reduced?.5:ease(progress);
  c.save();c.globalAlpha*=alpha;c.lineCap='round';
  for(let i=0;i<3;i++){c.strokeStyle=i?'#ffb365':'#fff1b2';c.lineWidth=i?1:2;c.beginPath();c.arc(0,-25,13+i*3,-1.3+sweep*.5,.1+sweep*1.5);c.stroke();}
  c.fillStyle='#ffdf91';for(let i=0;i<(reduced?2:5);i++){const x=14+sweep*18+i*2,y=-24+(i-2)*3+Math.sin(i+sweep*4)*2;spark(c,x,y,i%2?1:1.5);}
  c.restore();
 }
 function seal(c,age,stage,reduced){
  const duration=stage===3?2.1:1.8,alpha=ease(age/.16)*(1-ease((age-duration+.45)/.45));if(alpha<=0)return;
  const p=ease(age/.75),turn=reduced?0:age*.6;
  c.save();c.globalAlpha*=alpha;c.lineWidth=1.2;c.strokeStyle='#ffd483';c.fillStyle='#fff4be';
  if(stage===1){
   for(let i=0;i<3;i++){c.globalAlpha=alpha*(.8-i*.16);c.beginPath();c.arc(6,-29,12+i*7+(reduced?0:p*12),-.85,.9);c.stroke();}
   c.globalAlpha=alpha;spirit(c,2,7,-70-(reduced?0:p*3),16,16);
  }else if(stage===2){
   ellipse(c,0,-25,22,27);c.globalAlpha=alpha*.32;c.fillStyle='#ffb56d';c.beginPath();c.ellipse(0,-25,22,27,0,0,TAU);c.fill();c.globalAlpha=alpha;
   spirit(c,3,-8,-42,16,16);for(let i=0;i<6;i++){const a=i*TAU/6+turn;spark(c,Math.cos(a)*23,-25+Math.sin(a)*28,1.4);}
  }else{
   c.globalAlpha=alpha*.8;ellipse(c,14,0,34,7);ellipse(c,14,0,28,5);c.save();c.translate(14,-27);c.rotate(turn);for(let i=0;i<8;i++){c.rotate(TAU/8);spark(c,29,0,1.5);}c.restore();
   const appear=ease((age-.25)/.6),settle=reduced?0:1-appear;c.globalAlpha=alpha*appear;
   spirit(c,age<.85?0:1,5+settle*10,-70+settle*9,76,63);
  }
  c.globalAlpha=alpha*.85;c.fillStyle='#fff1be';for(let i=0;i<(reduced?2:7);i++){const a=i*2.4,travel=reduced?.5:(age*.65+i*.13)%1;spark(c,Math.cos(a)*(14+travel*16),-8-travel*43,1+(i%2)*.4);}
  c.restore();
 }
 function draw(c,id,x,y,scale,frame={}){
  if(id!=='yaho'||!sheets.combat?.loaded)return false;
  c.save();c.translate(x,y);c.scale(scale*SIZE*(frame.flip?-1:1),scale*SIZE);c.imageSmoothingEnabled=false;
  if(frame.dead)c.globalAlpha*=.42;
  const active=!frame.dead&&!frame.stunned&&!frame.frozen,age=frame.castAge||0,stage=frame.yahoStage||1;
  if(frame.yahoSummoned&&!frame.dead&&!(frame.casting&&stage===3&&age<2.1)){c.save();c.globalAlpha*=.48;const breathe=frame.reduced?0:Math.sin((frame.time||0)*1.6)*.5;spirit(c,0,-24,-42+breathe,46,37);c.restore();}
  const p=pose(frame),m=motion(frame);c.save();c.translate(m.x,m.y);c.rotate(m.lean);c.scale(m.wide,m.tall);
  c.drawImage(sheets.combat.image,p%4*256,Math.floor(p/4)*256,256,256,-29,-55.28,58,58);c.restore();
  if(active){if(frame.casting)seal(c,age,stage,frame.reduced);else if(frame.attack||Number.isFinite(frame.attackAge))basicFx(c,frame.attackAge||0,frame.reduced);}
  c.restore();return true;
 }
 function status(c,u,x,y,time,scale=1,masterAge=-1){
  if(u.hp<=0)return;if(u.id==='yaho')scale*=SIZE;
  const guard=u.yahoGuardUntil>time,roar=u.yahoRoarUntil>time;
  if(!guard&&!roar&&masterAge<0)return;
  c.save();c.translate(x,y);c.scale(scale,scale);
  if(guard||roar){c.strokeStyle=guard?'#ffd98d':'#ffae80';c.lineWidth=1.2;c.globalAlpha=.65;ellipse(c,0,1,19,4);
   if(guard){c.globalAlpha=.2;c.fillStyle='#ffcd7f';c.beginPath();c.ellipse(0,-24,20,32,0,Math.PI,TAU);c.fill();}
  }
  if(masterAge>=0&&masterAge<1.8){c.globalAlpha=.7*(1-masterAge/1.8);c.strokeStyle='#baffdb';c.lineWidth=1.4;for(let i=0;i<3;i++){c.beginPath();c.ellipse(Math.sin(masterAge*5+i)*3,-12-i*14,12+i*5,4+i,Math.sin(masterAge*3+i)*.15,0,TAU);c.stroke();}}
  c.restore();
 }
 function field(c,b,positions,events,time,reduced){
  if(b.phase!=='fight')return;
  c.save();
  for(const u of b.heroes){const p=positions[u.id];if(p)status(c,u,p.x,p.y,b.elapsed);}
  for(const e of events){const age=time-e.time;if(e.kind!=='yaho-skill'||age<0||age>2.3)continue;const p=positions.yaho;if(!p)continue;
   const alpha=Math.sin(clamp(age/2.3)*Math.PI);c.globalAlpha=alpha*.65;c.strokeStyle=e.stage===1?'#ffb77c':'#ffe6a7';c.lineWidth=1.25;
   for(const id of e.targets||[]){const target=positions[id];if(!target)continue;ellipse(c,target.x,target.y,18+(reduced?4:age*8),5+(reduced?1:age*2));
    if(id!=='yaho'&&!reduced){const phase=ease(age/.8),dx=target.x-p.x,dy=target.y-p.y;c.beginPath();c.moveTo(p.x,p.y-22);c.quadraticCurveTo(p.x+dx*.45,p.y-65,target.x,target.y-25);c.stroke();c.fillStyle='#fff4c9';spark(c,p.x+dx*phase,p.y+dy*phase-22-Math.sin(phase*Math.PI)*27,1.8);}
   }
   if(e.stage===3){c.globalAlpha=alpha*.8;ellipse(c,p.x,p.y,30+(reduced?0:age*14),7+(reduced?0:age*3));c.fillStyle='#fff3b7';for(let i=0;i<(reduced?3:8);i++){const a=i*2.399+(reduced?0:age*.9),r=25+i*4;spark(c,p.x+Math.cos(a)*r,p.y-25+Math.sin(a)*r*.5,1.5);}}
  }
  const lava=b.heroes.find(h=>h.id==='lava'&&h.hp>0),yaho=b.heroes.find(h=>h.id==='yaho'&&h.hp>0);
  if(lava&&yaho){const e=events.findLast(e=>e.kind==='lava-skill'&&time-e.time>=0&&time-e.time<1.8),p=positions.lava;if(e&&p)status(c,lava,p.x,p.y,b.elapsed,1,reduced?.4:time-e.time);}
  c.restore();
 }
 return Object.freeze({ready,draw,field,status,pose,motion,size:SIZE,assetsReady:()=>!!sheets.combat?.loaded});
})();
