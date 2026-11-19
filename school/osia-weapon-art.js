/* Osia's owner-only UR weapon skin. Bounded pixel effects; simulation stays in engines. */
window.SchoolOsiaWeaponArt=(()=>{
 'use strict';
 const TAU=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,n)),mix=(a,b,t)=>a+(b-a)*t;
 const image=new Image();let loaded=false,dragonSource=null;
 const ready=new Promise(resolve=>{
  const timer=setTimeout(()=>resolve(false),5000);
  image.onload=()=>{loaded=true;dragonSource=null;clearTimeout(timer);resolve(true);window.dispatchEvent(new Event('school-art-ready'));};
  image.onerror=()=>{clearTimeout(timer);resolve(false);};
 });
 image.src='school/assets/osia/divine-dragon.webp?v=osia-ur1';
 const equipped=u=>u?.id==='osia'&&u.exclusive?.id==='osia_scepter';
 const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
 function pixel(c,color,x,y,w,h){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.max(1,w),Math.max(1,h));}
 function diamond(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.moveTo(x,y-r);c.lineTo(x+r*.45,y);c.lineTo(x,y+r);c.lineTo(x-r*.45,y);c.closePath();c.fill();}
 function ring(c,x,y,rx,ry,color,width=1){c.lineWidth=width;c.strokeStyle=color;c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);c.stroke();}
 function blade(c){
  pixel(c,'#194b77',-2,-18,4,40);pixel(c,'#e8d7a0',-1,-16,2,35);
  pixel(c,'#3e9fbe',-4,-24,8,12);pixel(c,'#b8f8ff',-2,-27,4,17);pixel(c,'#fcffe8',0,-29,1,17);
  pixel(c,'#153b64',-5,-16,10,3);pixel(c,'#e7c97b',-4,-17,8,2);pixel(c,'#f5edbf',-5,-17,2,5);pixel(c,'#f5edbf',3,-17,2,5);
  diamond(c,0,-6,4,'#176baf');diamond(c,0,-6,2,'#d1ffff');pixel(c,'#e7c97b',-2,18,4,3);
 }
 function spear(c,x,y,scale,frame={}){
  if(frame.exclusive?.id!=='osia_scepter'||frame.dead||!Number.isFinite(scale)||scale<=0)return false;
  if(Number.isFinite(frame.osiaSpearAge)&&frame.osiaSpearAge>=0&&frame.osiaSpearAge<.3)return false;
  const still=frame.reduced||frame.stunned||frame.frozen, t=still?0:Number(frame.time)||0;
  c.save();c.translate(x,y);c.scale(scale*(frame.flip?-1:1),scale);
  // The extra spear hovers behind the original sprite; it never replaces her identity.
  const sway=still?0:Math.sin(t*2.4)*1.7;
  c.save();c.translate(-13,-25+sway);c.rotate(-.3+(still?0:Math.sin(t*1.7)*.06));blade(c);c.restore();
  c.globalAlpha*=.4;ring(c,-13,-25+sway,7,13,'#a9f6ff',.65);c.globalAlpha*=.65;
  ring(c,0,1,14,3,'#80dce8',.7);
  c.restore();return true;
 }
 function sprite(){
  if(!loaded)return null;
  if(!dragonSource){dragonSource=document.createElement('canvas');dragonSource.width=600;dragonSource.height=400;const d=dragonSource.getContext('2d');d.imageSmoothingEnabled=false;d.drawImage(image,0,0,600,400);}
  return dragonSource;
 }
 function figure(c,x,y,width,flip=false){
  const art=sprite();c.save();c.translate(x,y);c.scale(flip?-1:1,1);c.imageSmoothingEnabled=false;
  if(art)c.drawImage(art,-width*.96,-width*.29,width,width*2/3);
  else{
   // A recognizable ivory/gold water-dragon silhouette remains if art is unavailable.
   for(let i=18;i>=0;i--){const xx=-i*width/22,yy=Math.sin(i*.5)*width*.07,s=Math.max(3,width*(.07-i*.002));pixel(c,i%2?'#bdf5ed':'#56b8e9',xx-s/2,yy-s/2,s,s);if(i%4===0)diamond(c,xx,yy-s/2,s*.7,'#e9d393');}
   pixel(c,'#e7fbfa',-width*.1,-width*.07,width*.11,width*.1);diamond(c,-width*.08,-width*.1,width*.07,'#f5d181');pixel(c,'#0a5385',-width*.025,-width*.04,width*.017,width*.012);
  }c.restore();
 }
 function sigil(c,x,y,size,progress,reduced,economy){
  c.save();c.globalAlpha*=.8;ring(c,x,y,size,size*.23,'#dcfafa',1.5);ring(c,x,y,size*.8,size*.18,'#decd8b',1);
  const n=economy?4:8,turn=reduced?0:progress*1.4;
  for(let i=0;i<n;i++){const a=i*TAU/n+turn;diamond(c,x+Math.cos(a)*size,y+Math.sin(a)*size*.23,3,'#faf0bc');}c.restore();
 }
 function drowning(c,o={}){
  const {source,target,reduced=false,economy=false}=o,age=Number(o.age),s=Math.max(.4,Math.min(3,Number(o.scale)||1));
  if(!valid(source)||!valid(target)||!Number.isFinite(age)||age<0||age>2.15)return false;
  const p=reduced?1:clamp(age/.3),tx=target.x,ty=Number.isFinite(target.aimY)?target.aimY:target.y-28*s,sx=source.x-13*s,sy=source.y-52*s;
  const dir=tx>=sx?1:-1,fade=1-clamp((age-1.5)/.65),alpha=c.globalAlpha;c.save();c.globalAlpha*=fade;
  if(age<.34&&!reduced){
   const x=mix(sx,tx,p),y=mix(sy,ty,p)-Math.sin(p*Math.PI)*14*s;
   for(let i=3;i>0;i--){c.globalAlpha=alpha*fade*(1-i*.2);pixel(c,'#91e6ff',x-dir*i*10*s,y+i*1.5*s,15*s,2*s);}
   c.globalAlpha=alpha*fade;c.save();c.translate(x,y);c.rotate(Math.atan2(ty-sy,tx-sx)+Math.PI/2);c.scale(s,s);blade(c);c.restore();
  }else{
   const burst=reduced?.5:clamp((age-.3)/.7),r=(13+burst*27)*s;
   ring(c,tx,ty,r,r*.85,'#b7f8ff',2*s);ring(c,tx,ty,r*.68,r*.85,'#74bddd',s);
   sigil(c,tx,target.y-2*s,(20+burst*16)*s,age,reduced,economy);
   pixel(c,'#c8f6ff',tx-1*s,ty-21*s,2*s,40*s);pixel(c,'#f9e4ac',tx-11*s,ty-1*s,22*s,2*s);
   for(let i=0,n=reduced?3:economy?5:9;i<n;i++){const a=i*TAU/n-1.1;diamond(c,tx+Math.cos(a)*r,ty+Math.sin(a)*r,3*s,i%3?'#a4eeff':'#ffe9b6');}
   c.font=`bold ${Math.max(9,11*s)}px Galmuri,monospace`;c.textAlign='center';c.lineWidth=3*s;c.strokeStyle='#133757';c.strokeText('익사',tx,ty-35*s);c.fillStyle='#c3ffff';c.fillText('익사',tx,ty-35*s);
  }c.restore();return true;
 }
 function dragon(c,o={}){
  const {source,target,reduced=false,economy=false}=o,age=Number(o.age),s=Math.max(.4,Math.min(3,Number(o.scale)||1));
  if(!valid(source)||!valid(target)||!Number.isFinite(age)||age<0||age>1.85)return false;
  const dir=target.x>=source.x?1:-1,tx=target.x,ty=Number.isFinite(target.aimY)?target.aimY:target.y-37*s;
  const charge=clamp(age/.38),rush=reduced?1:clamp((age-.25)/.58),impact=clamp((age-.83)/.8),fade=1-clamp((age-1.3)/.55);
  const width=Math.min(330*s,Math.max(185*s,Math.abs(tx-source.x)*1.1));
  const nose=mix(source.x+dir*80*s,tx+dir*28*s,rush),headY=mix(source.y-62*s,ty,rush)-(reduced?0:Math.sin(rush*Math.PI)*42*s);
  c.save();c.globalAlpha*=fade;
  sigil(c,source.x,source.y-3*s,(24+charge*18)*s,age,reduced,economy);
  if(!reduced){
   // Thin water pillars and pixel ribbons build the silhouette without a full-screen flash.
   for(let i=0,n=economy?3:7;i<n;i++){
    const p=i/(n-1),x=mix(source.x,tx,p),height=(12+Math.sin(p*Math.PI)*28)*s*charge;
    pixel(c,i%2?'#66cae75f':'#b2f2ff75',x-3*s,source.y-height,6*s,height);
    pixel(c,'#ccfbff',x-2*s,source.y-height,4*s,2*s);
   }
   for(let i=0,n=economy?4:9;i<n;i++){const x=nose-dir*(20+i*26)*s,y=headY+Math.sin(age*7+i*.65)*13*s+i*3*s;pixel(c,i%3?'#9beaff':'#f2d992',x,y,(12+charge*10)*s,2*s);}
  }
  c.save();c.globalAlpha*=Math.max(.2,charge);figure(c,nose,headY,width*(.65+charge*.35),dir<0);c.restore();
  if(age>=.75||reduced){
   const r=(18+impact*60)*s;c.save();c.globalAlpha*=1-impact*.65;
   ring(c,tx,ty,r,r*.8,'#bffaff',3*s);ring(c,tx,ty,r*.7,r,'#efdd9f',1.5*s);
   sigil(c,tx,target.y-2*s,r,age,reduced,economy);
   for(let i=0,n=reduced?4:economy?7:15;i<n;i++){const a=i*2.399963,x=tx+Math.cos(a)*r,y=ty+Math.sin(a)*r*.8;diamond(c,x,y,(3+i%3)*s,i%3?'#b5f7ff':'#ffe4ac');}
   c.restore();
  }
  c.restore();return true;
 }
 function portrait(c,x,y,width,flip=false){figure(c,x,y,width,flip);}
 function reset(){dragonSource=null;}
 return Object.freeze({ready,equipped,spear,dragon,drowning,portrait,reset,assetsReady:()=>loaded});
})();
