/* Yaho's approved sprite poses and warm guardian magic. No combat mutations. */
window.SchoolYahoArt=(()=>{
 'use strict';
 const sheets={},TAU=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,n));
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
 function draw(c,id,x,y,scale,frame={}){
  if(id!=='yaho'||!sheets.combat?.loaded)return false;
  c.save();c.translate(x,y);c.scale(scale*(frame.flip?-1:1),scale);c.imageSmoothingEnabled=false;
  if(frame.dead)c.globalAlpha*=.42;
  if(frame.yahoSummoned&&!frame.dead){c.save();c.globalAlpha*=.55;spirit(c,0,-28,-38,46,34);c.restore();}
  const p=pose(frame);c.drawImage(sheets.combat.image,p%4*256,Math.floor(p/4)*256,256,256,-29,-55.28,58,58);
  if(frame.casting&&!frame.dead&&!frame.stunned&&!frame.frozen){
   const age=frame.castAge||0,alpha=Math.max(0,1-age/1.8);c.globalAlpha*=alpha;
   spirit(c,frame.yahoStage===2?3:2,12,-72,20,20);
   if(frame.yahoStage===3)spirit(c,1,10,-58,58,45);
  }
  c.restore();return true;
 }
 function status(c,u,x,y,time,scale=1,masterAge=-1){
  if(u.hp<=0)return;
  const guard=u.yahoGuardUntil>time,roar=u.yahoRoarUntil>time;
  if(!guard&&!roar&&masterAge<0)return;
  c.save();c.translate(x,y);c.scale(scale,scale);
  if(guard||roar){c.strokeStyle=guard?'#ffd98d':'#ffae80';c.lineWidth=1.2;c.globalAlpha=.65;c.beginPath();c.ellipse(0,1,19,4,0,0,TAU);c.stroke();
   if(guard){c.globalAlpha=.2;c.fillStyle='#ffcd7f';c.beginPath();c.ellipse(0,-24,20,32,0,Math.PI,TAU);c.fill();}
  }
  if(masterAge>=0&&masterAge<1.8){c.globalAlpha=.7*(1-masterAge/1.8);c.strokeStyle='#baffdb';c.lineWidth=1.4;for(let i=0;i<3;i++){c.beginPath();c.ellipse(Math.sin(masterAge*5+i)*3,-12-i*14,12+i*5,4+i,Math.sin(masterAge*3+i)*.15,0,TAU);c.stroke();}}
  c.restore();
 }
 function field(c,b,positions,events,time,reduced){
  if(b.phase!=='fight')return;
  c.save();
  for(const u of b.heroes){if(u.hp<=0)continue;const p=positions[u.id];if(!p)continue;
   const guard=u.yahoGuardUntil>b.elapsed,roar=u.yahoRoarUntil>b.elapsed;
   if(guard||roar){c.strokeStyle=guard?'#ffd98d':'#ffae80';c.lineWidth=guard?1.5:1;c.globalAlpha=.6;c.beginPath();c.ellipse(p.x,p.y+1,19,4,0,0,TAU);c.stroke();
    if(guard){c.globalAlpha=.2;c.fillStyle='#ffcd7f';c.beginPath();c.ellipse(p.x,p.y-24,20,32,0,Math.PI,TAU);c.fill();}
   }
  }
  for(const e of events){const age=time-e.time;if(e.kind!=='yaho-skill'||age<0||age>2.3)continue;const p=positions.yaho;if(!p)continue;
   const alpha=Math.sin(clamp(age/2.3)*Math.PI);c.globalAlpha=alpha*.8;c.strokeStyle='#ffdca1';c.lineWidth=2;
   for(const id of e.targets||[]){const target=positions[id];if(!target)continue;c.beginPath();c.ellipse(target.x,target.y,18+(reduced?4:age*8),5+(reduced?1:age*2),0,0,TAU);c.stroke();}
   if(e.stage===3){spirit(c,1,p.x-48,p.y-130,150,112);c.fillStyle='#fff3b7';for(let i=0;i<(reduced?4:12);i++){const a=i*2.399+(reduced?0:age*.9),r=25+i*4;c.fillRect(p.x+Math.cos(a)*r,p.y-50+Math.sin(a)*r*.7,2,2);}}
  }
  const lava=b.heroes.find(h=>h.id==='lava'&&h.hp>0),yaho=b.heroes.find(h=>h.id==='yaho'&&h.hp>0);
  if(lava&&yaho){const e=events.findLast(e=>e.kind==='lava-skill'&&time-e.time<1.8),p=positions.lava;if(e&&p){c.globalAlpha=.65;c.strokeStyle='#baffdb';c.lineWidth=1.4;for(let i=0;i<3;i++){c.beginPath();c.ellipse(p.x,p.y-12-i*18,12+i*6,4+i,Math.sin(time*3+i)*.2,0,TAU);c.stroke();}}}
  c.restore();
 }
 return Object.freeze({ready,draw,field,status,pose,assetsReady:()=>!!sheets.combat?.loaded});
})();
