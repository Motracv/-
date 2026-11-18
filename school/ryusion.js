/* Ryusion's source atlas is immutable. Eight cached poses share the simulation clock. */
window.SchoolRyusion = (() => {
  'use strict';
  const atlas=new Image(),portrait=new Image(),poses=new Map();let atlasLoaded=false,portraitLoaded=false;
  const load=(image,path,done)=>new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),7000);image.onload=()=>{done();clearTimeout(timer);resolve(true);window.dispatchEvent(new Event('school-art-ready'));};image.onerror=()=>{clearTimeout(timer);resolve(false);};image.src=path;});
  const ready=Promise.all([load(atlas,'school/assets/ryusion/combat.png?v=ryusion1',()=>{atlasLoaded=true;poses.clear();}),load(portrait,'school/assets/ryusion/portrait.png?v=ryusion1',()=>{portraitLoaded=true;})]);
  const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{n=clamp(n);return n*n*(3-2*n);};
  function motion(stage,age,reduced=false){
    const a=Math.max(0,age);let pose,dx=0,dy=0;
    if(stage===1){pose=a<.18?2:a<.5?4:a<.72?3:a<1.02?1:0;dx=a<.5?-3+ease((a-.15)/.35)*35:32*(1-ease((a-.62)/.65));dy=a<.5?-Math.sin(clamp(a/.5)*Math.PI)*2:0;}
    else{pose=a<.2?5:a<.95?6:a<1.25?1:0;dy=-Math.sin(clamp(a/1.3)*Math.PI)*2;}
    return {stage,age,pose,dx:reduced?0:dx,dy:reduced?0:dy,reduced};
  }
  function poseFor(frame){
    if(frame.dead)return 7;
    if(frame.motion&&frame.motion.age>=0&&frame.motion.age<1.4)return frame.motion.pose;
    if(frame.hit)return 7;
    if(frame.taunting)return 1;
    const a=frame.attackAge;
    if(Number.isFinite(a)&&a>=0&&a<.78)return a<.15?2:a<.42?3:a<.62?1:0;
    return 0;
  }
  function source(pose){
    if(poses.has(pose))return poses.get(pose);
    const c=document.createElement('canvas');c.width=144;c.height=192;const x=c.getContext('2d');x.imageSmoothingEnabled=false;
    x.drawImage(atlas,pose%4*atlas.naturalWidth/4,Math.floor(pose/4)*atlas.naturalHeight/2,atlas.naturalWidth/4,atlas.naturalHeight/2,0,0,144,192);poses.set(pose,c);return c;
  }
  function draw(c,x,y,scale=2,frame={}){
    c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale*(frame.flip?-1:1),scale);
    if(frame.dead){c.globalAlpha*=.4;c.rotate(-Math.PI/2);}
    const a=frame.attackAge;
    if(!frame.reduced&&Number.isFinite(a)&&a>=0&&a<.7&&!frame.motion&&!frame.taunting)c.translate(Math.sin(clamp(a/.7)*Math.PI)*3,0);
    c.imageSmoothingEnabled=false;
    if(atlasLoaded)c.drawImage(source(poseFor(frame)),-24,-55,48,64);
    else{c.fillStyle='#28272b';c.fillRect(-7,-24,13,19);c.fillStyle='#694b3f';c.fillRect(-8,-37,16,16);c.fillStyle='#e8c7ab';c.fillRect(-4,-31,11,9);c.fillStyle='#b28a56';c.fillRect(6,-32,11,32);}
    if(frame.taunting&&!frame.dead){
      const pulse=frame.reduced?0:Math.sin((frame.time||0)*8),top=-66-pulse*1.3;
      c.fillStyle='#37261ee8';c.beginPath();c.moveTo(0,top-13);c.lineTo(11,top);c.lineTo(0,top+13);c.lineTo(-11,top);c.closePath();c.fill();c.strokeStyle='#ffdd8a';c.lineWidth=1.4;c.stroke();
      c.fillStyle='#fff1ae';c.fillRect(-2,top-7,4,9);c.fillRect(-2,top+5,4,3);
      c.strokeStyle='#ffcf7288';c.lineWidth=1;c.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;c.moveTo(Math.cos(a)*15,top+Math.sin(a)*15);c.lineTo(Math.cos(a)*(19+pulse),top+Math.sin(a)*(19+pulse));}c.stroke();
      barrier(c,0,-2,.85,.75);
    }
    c.restore();
  }
  function illustration(c,x,y,w,h){
    if(!portraitLoaded){draw(c,x,y+h,Math.min(w/48,h/52),{reduced:true});return;}
    const height=Math.min(h,w*portrait.naturalHeight/portrait.naturalWidth),width=height*portrait.naturalWidth/portrait.naturalHeight;
    c.save();c.imageSmoothingEnabled=true;c.drawImage(portrait,x-width/2,y+h-height,width,height);c.restore();
  }
  function barrier(c,x,y,scale=1,alpha=.6){
    c.save();c.translate(x,y-26*scale);c.scale(scale,scale);c.globalAlpha*=alpha;c.beginPath();c.moveTo(-17,-25);c.lineTo(17,-25);c.lineTo(23,-12);c.lineTo(18,15);c.lineTo(0,27);c.lineTo(-18,15);c.lineTo(-23,-12);c.closePath();c.fillStyle='#d49b4130';c.fill();c.strokeStyle='#ffe1a1';c.lineWidth=1.5;c.stroke();
    c.beginPath();c.moveTo(-7,3);c.lineTo(0,-7);c.lineTo(7,3);c.stroke();c.restore();
  }
  function effects(c,battle,events,positions,time,reduced=false){
    const source=positions.ryusion,unit=battle.heroes.find(h=>h.id==='ryusion'&&h.hp>0);if(!source)return;
    const g=window.SchoolRPG.ryusionGuard(battle.heroes,battle.elapsed);
    if(unit&&g.taunting){c.save();c.translate(source.x,source.y+3);c.scale(1,.28);c.strokeStyle='#f9c56e';c.lineWidth=3;c.beginPath();c.arc(0,0,35+(reduced?0:Math.sin(time*6)*2),0,Math.PI*2);c.stroke();c.restore();barrier(c,source.x,source.y,1,.5);}
    for(const h of battle.heroes){const p=positions[h.id];if(p&&h.hp>0&&h.earthShield>0&&battle.elapsed<h.earthShieldUntil)barrier(c,p.x,p.y,.85,.35);}
    for(const e of events){const age=time-e.time;if(age<0||age>1.2)continue;const p=positions[e.to]||source;
      if(e.kind==='ryusion-impact'){c.save();c.globalAlpha=1-clamp(age/.7);c.strokeStyle='#ffd990';c.lineWidth=3;c.beginPath();c.arc(p.x,p.y-30,8+age*44,-1.4,1.4);c.stroke();if(!reduced)for(let i=0;i<8;i++){c.fillStyle=i%2?'#b68a5b':'#f0c785';const dx=Math.cos(i*2.4)*age*34,dy=-Math.sin(i*2.4)*age*35+age*age*35;c.fillRect(p.x+dx,p.y-22+dy,3,3);}c.restore();}
      if(e.kind==='earth-guard'&&age<.85){barrier(c,p.x,p.y-(reduced?0:Math.sin(age/.85*Math.PI)*7),.7+clamp(age/.6)*.25,1-age/.85);}
      if(e.kind==='ryusion-taunt'&&age<.6){c.save();c.translate(source.x,source.y);c.scale(1,.32);c.strokeStyle='#ffdfa1';c.globalAlpha=1-age/.6;c.lineWidth=2;c.beginPath();c.arc(0,0,12+age*85,0,Math.PI*2);c.stroke();c.restore();}
      if(e.kind==='hit'&&e.redirectedFrom&&age<.3){c.save();c.strokeStyle='#ffc576';c.globalAlpha=(1-age/.3)*.6;c.lineWidth=1.5;const from=positions[e.redirectedFrom];if(from){c.beginPath();c.moveTo(from.x,from.y-24);c.lineTo(source.x+12,source.y-26);c.stroke();}c.restore();}
    }
  }
  return {ready,draw,motion,poseFor,illustration,effects,barrier,assetsReady:()=>atlasLoaded&&portraitLoaded};
})();
