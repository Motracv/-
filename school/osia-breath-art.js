/* Approved water-breath concept, fitted to live battle coordinates. No simulation writes. */
window.SchoolOsiaBreathArt=(()=>{
 'use strict';
 const TAU=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{n=clamp(n);return n*n*(3-2*n);},frac=n=>n-Math.floor(n);
 const rules=window.SchoolRPG.OSIA_BREATH_RULES,life=(rules.windupMs+rules.breathMs+rules.recoveryMs)/1000;
 const mouths=[[348,180],[344,151],[338,104],[346,89],[318,83],[327,109],[327,113],[345,129],[344,139],[339,133],[334,133],[346,142]];
 const atlas=new Image(),water=new Image();let dragonLoaded=false,waterLoaded=false,light=null;
 const ready=Promise.all([[atlas,'breath-dragon'],[water,'breath-water']].map(([img,name])=>new Promise(resolve=>{
  const timer=setTimeout(()=>resolve(false),5000);img.onload=()=>{if(img===atlas)dragonLoaded=true;else waterLoaded=true;clearTimeout(timer);resolve(true);window.dispatchEvent(new Event('school-art-ready'));};img.onerror=()=>{clearTimeout(timer);resolve(false);};img.src=`school/assets/osia/${name}.webp?v=osia-breath1`;
 })));
 function state(age,reduced=false){
  const fire=age-rules.windupMs/1000,back=ease((age-.9)/.35),inhale=ease((age-1.25)/.6),aim=ease((age-1.85)/.15),recovery=ease((fire-2.3)/.45);
  const flow=fire>=0&&fire<2.3?ease(fire/.09)*(1-ease((fire-2.05)/.25)):0;
  let frame=age<.9?0:age<1.85?Math.min(4,Math.floor((age-.9)/.95*5)):age<2?5:fire<2.3?[6,7,8,9,8,7][Math.floor(fire/.14)%6]:recovery<.5?10:11;
  if(reduced)frame=fire<0?0:6;
  return {age,fire,back,inhale,aim,flow,recovery,frame,charge:age<2?inhale:0,fade:1-recovery,emerge:ease(age/.9),active:age>=0&&age<life};
 }
 function motion(age,reduced=false){
  const s=state(age,reduced),pose=age<.25?1:age<.9?3:age<1.65?1:age<2?4:age<4.3?2:5;
  return {pose,dx:reduced?0:s.aim*2*(1-s.recovery),dy:0,lean:reduced?0:s.flow*-.018,stretch:1,cloth:0,stage:4,age,reduced};
 }
 function glow(c,x,y,r,opacity){
  if(opacity<=0)return;
  if(!light){light=document.createElement('canvas');light.width=light.height=128;const d=light.getContext('2d'),g=d.createRadialGradient(64,64,0,64,64,64);for(const [p,color]of[[0,'#d7ffffee'],[.14,'#50d4ffd9'],[.38,'#147fffa0'],[.7,'#145aff35'],[1,'#0646ff00']])g.addColorStop(p,color);d.fillStyle=g;d.fillRect(0,0,128,128);}
  c.save();c.globalAlpha*=opacity;c.globalCompositeOperation='lighter';c.drawImage(light,x-r,y-r,r*2,r*2);c.restore();
 }
 function ring(c,x,y,rx,ry,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);c.stroke();}
 function sigil(c,x,y,r,t,reduced){
  ring(c,x,y,r,r*.2,'#a5f7ff',1.3);ring(c,x,y,r*.8,r*.15,'#e7dfa3',.6);
  for(let i=0;i<8;i++){const a=i*TAU/8+(reduced?0:t*.5);c.fillStyle=i%2?'#b5f9ff':'#efe8b0';c.fillRect(x+Math.cos(a)*r-1,y+Math.sin(a)*r*.2-1,2,2);}
 }
 function field(c,age,w,h,reduced=false){
  if(!Number.isFinite(age)||age<0||age>=life)return;
  const s=state(age,reduced);c.save();c.fillStyle='#04142a';c.globalAlpha*=(reduced?.08:.15+s.charge*.08+s.flow*.14)*s.emerge*s.fade;c.fillRect(0,0,w,h);c.restore();
  if(!reduced&&s.flow>0){const kick=(Math.exp(-s.fire*10)*1.1+Math.sin(s.fire*31)*.28)*Math.min(2,w/480);c.translate(kick,Math.sin(s.fire*27)*Math.abs(kick)*.32);}
 }
 // Distort only the two hair tips, keeping the eyes, face and feet anchored.
 function caster(c,sprite,age,reduced){
  if(reduced){c.drawImage(sprite,-21,-40,44,44);return;}
  const s=state(age),wind=(s.charge*.7+s.flow*1.1)*Math.sin(age*13),patches=[[-6.2,-32.3,4.1,8.5],[3.7,-31.6,2.8,7.5]];
  c.save();c.beginPath();c.rect(-21,-40,44,44);for(const p of patches)c.rect(...p);c.clip('evenodd');c.drawImage(sprite,-21,-40,44,44);c.restore();
  const resolution=sprite.width/44;
  for(const [x,y,w,h]of patches)for(let i=0;i<6;i++){const yy=y+i*h/6,dx=-wind*Math.sin(i/6*Math.PI)*(.4+i/6);c.drawImage(sprite,(x+21)*resolution,(yy+40)*resolution,w*resolution,h/6*resolution,x+dx,yy,w,h/6+.04);}
  const hand=motion(age).pose===2?[14.5,-27]:motion(age).pose===3?[8,-24]:[4.7,-25.2];
  if(age<4.3){c.save();c.globalAlpha*=.75;ring(c,...hand,2.8,1.3,'#b4f8ff',.55);c.fillStyle='#dbffff';c.fillRect(hand[0]-.6,hand[1]-.6,1.2,1.2);c.restore();}
 }
 function dragon(c,o={}){
  const {source,target,reduced=false,economy=false}=o,age=Number(o.age),scl=Math.max(.4,Math.min(3,Number(o.scale)||1));
  if(!source||!target||![source.x,source.y,target.x,target.y,age].every(Number.isFinite)||age<0||age>=life)return false;
  const s=state(age,reduced),dir=target.x>=source.x?1:-1,headX=source.x+dir*(58-s.back*20-s.inhale*4+s.aim*11)*scl,headY=source.y-(64+s.inhale*11-s.aim*6)*scl;
  const tx=target.x,ty=Number.isFinite(target.aimY)?target.aimY:target.y-30*scl;
  c.save();c.globalAlpha*=s.fade;
  if(o.layer!=='front'){sigil(c,source.x,source.y,40*scl*s.emerge,age,reduced);
  if(age<1.1&&!reduced){
   glow(c,source.x,source.y-25*scl,70*scl,s.emerge*.5);
   for(let k=0;k<3;k++){c.strokeStyle=k%2?'#b4faff':'#278decb0';c.lineWidth=(k%2?1.4:4)*scl;c.beginPath();for(let i=0;i<=24;i++){const q=i/24,a=q*8-age*7+k*TAU/3,x=source.x+Math.cos(a)*(34-q*18)*scl+q*25*dir*scl,y=source.y-q*85*s.emerge*scl;c.lineTo(x,y);}c.stroke();}
  }
  if(dragonLoaded){
   const fw=atlas.naturalWidth/4,fh=atlas.naturalHeight/3,[mx,my]=mouths[s.frame],sc=.56*scl,segments=reduced?1:economy?8:16;
   c.save();c.translate(headX,headY);c.scale(dir,1);c.imageSmoothingEnabled=false;
   for(let i=0;i<segments;i++){const u=i/segments,v=(i+1)/segments,emerge=reduced?1:ease((age-u*.35)/.6);if(!emerge)continue;
    const bend=q=>reduced?0:Math.sin(age*7-q*6)*(2+s.flow*1.5)*scl*Math.pow(Math.max(0,1-q/.84),1.3),a=bend(u),b=bend(v),dx=fw*sc/segments;
    c.save();c.globalAlpha*=emerge;c.transform(1,(b-a)/dx,0,1,(u*fw-mx)*sc,-my*sc+a+(1-emerge)*65*scl);c.drawImage(atlas,s.frame%4*fw+u*fw,Math.floor(s.frame/4)*fh,fw/segments,fh,0,0,dx+.1,fh*sc);c.restore();
   }c.restore();
  }else{c.save();c.globalAlpha*=s.emerge;for(let i=0;i<15;i++){c.fillStyle=i%2?'#84deef':'#2e84bd';c.fillRect(headX-dir*i*9*scl,headY+Math.sin(i*.5)*9*scl,12*scl,12*scl);}c.fillStyle='#e6faff';c.fillRect(headX-8*scl,headY-7*scl,17*scl,13*scl);c.restore();}
  if(s.charge&&!reduced){glow(c,headX,headY,35*scl,s.charge*.7);for(let i=0,n=economy?8:16;i<n;i++){const q=frac(age*1.7+i*.618),a=i*2.4,r=(1-q)*75*scl;c.fillStyle='#a9f5ff';c.fillRect(headX+Math.cos(a)*r,headY+Math.sin(a)*r*.6,2*scl,2*scl);}ring(c,headX,headY,(8+s.charge*6)*scl,22*scl,'#9bedff',scl);}
  }
  if(o.layer!=='back'&&s.flow>0){
   const dx=tx-headX,dy=ty-headY,length=Math.hypot(dx,dy)*ease(s.fire/.1),angle=Math.atan2(dy,dx);
   c.save();c.translate(headX,headY);c.rotate(angle);c.globalAlpha*=s.flow;
   if(!reduced)for(let i=0;i<4;i++)glow(c,length*(i+.4)/4,0,55*scl, .6);
   if(waterLoaded){const fw=water.naturalWidth/4,fh=water.naturalHeight/3,frame=reduced?2:Math.floor(s.fire*16)%8;c.drawImage(water,frame%4*fw,Math.floor(frame/4)*fh,fw,fh,-5*scl,-fh*.3*scl,Math.max(1,length+10*scl),fh*.6*scl);}
   else{c.strokeStyle='#399bffb0';c.lineWidth=35*scl;c.beginPath();c.moveTo(0,0);c.lineTo(length,0);c.stroke();}
   c.save();c.globalCompositeOperation='lighter';c.strokeStyle='#caffff';c.lineWidth=(reduced?2:4)*scl;c.beginPath();c.moveTo(0,0);c.lineTo(length,0);c.stroke();c.restore();
   if(!reduced)for(let k=0;k<(economy?2:3);k++){c.strokeStyle=k%2?'#d9ffffc0':'#6edaffcc';c.lineWidth=1.1*scl;c.beginPath();for(let i=0;i<=24;i++){const u=i/24;c.lineTo(u*length,Math.sin(u*13-age*19+k*TAU/3)*(3+u*10)*scl);}c.stroke();}
   c.restore();
   glow(c,tx,ty,65*scl,s.flow*(reduced?.2:.65));
   if(waterLoaded){const fw=water.naturalWidth/4,fh=water.naturalHeight/3,frame=reduced?10:8+Math.floor(s.fire*10)%4;c.save();c.globalAlpha*=s.flow*.85;c.drawImage(water,frame%4*fw,Math.floor(frame/4)*fh,fw,fh,tx-fw*.27*scl,target.y-fh*.48*scl,fw*.54*scl,fh*.48*scl);c.restore();}
   sigil(c,tx,target.y,(30+Math.min(s.fire,2)*10)*scl,age,reduced);
   if(!reduced)for(let i=0,n=economy?10:22;i<n;i++){const q=frac(s.fire*(.7+i%3*.2)+i*.618),a=i*2.4,r=(12+q*55)*scl;c.fillStyle=i%3?'#7cdfff':'#e5ffff';c.globalAlpha=s.fade*s.flow*Math.sin(q*Math.PI);c.fillRect(tx+Math.cos(a)*r,ty+Math.sin(a)*r*.6-25*q*scl+35*q*q*scl,2*scl,(2+i%3)*scl);}
  }
  c.restore();return true;
 }
 return Object.freeze({ready,state,motion,field,caster,dragon,duration:life,assetsReady:()=>dragonLoaded&&waterLoaded});
})();
