/* Shared student sprites. Presentation only; no timers, damage or save writes. */
window.SchoolRosterArt=(()=>{
  'use strict';
  const GROUPS=[['geonu','nari','harin','seoyun'],['taeo','yuna','minjae','sua'],['jiho','siu','doyoon','ian','lumi']];
  const sheets=[],heroes=new Map(),TAU=Math.PI*2;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  GROUPS.forEach((group,i)=>group.forEach((id,row)=>heroes.set(id,{sheet:i,row})));
  const ready=Promise.all(GROUPS.map((_,i)=>new Promise(resolve=>{
    const image=new Image(),entry=sheets[i]={image,loaded:false},timer=setTimeout(()=>resolve(false),7000);
    image.onload=()=>{entry.loaded=true;clearTimeout(timer);resolve(true);window.dispatchEvent(new Event('school-art-ready'));};
    image.onerror=()=>{clearTimeout(timer);resolve(false);};
    image.src=`school/assets/roster-remake/students-${'abc'[i]}.webp?v=roster1`;
  })));
  const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
  function motion(frame={}){
    if(frame.dead||frame.stunned||frame.frozen)return {pose:0,dx:0,lean:0,stretch:1,kind:'idle',age:0};
    const cast=!!frame.casting,basic=frame.attack||Number.isFinite(frame.attackAge)&&frame.attackAge>=0&&frame.attackAge<.8;
    const kind=cast?'skill':basic?'basic':'idle',age=cast?finite(frame.castAge,finite(frame.motion?.age,.3)):basic?finite(frame.attackAge,.25):0;
    if(kind==='idle')return {pose:0,dx:0,lean:0,stretch:1,kind,age};
    const length=cast?1.1:.8,p=clamp(age/length),pulse=Math.sin(p*Math.PI);
    const pose=frame.reduced?(cast?3:2):cast?(p<.2?1:p<.82?3:0):p<.22?1:p<.66?2:p<.86?1:0;
    return {pose,kind,age,dx:frame.reduced?0:(p<.2?-1.5:2.2)*pulse,lean:frame.reduced?0:(cast?-.02:.04)*pulse,stretch:frame.reduced?1:1-pulse*.016};
  }
  function spark(c,x,y,r){c.beginPath();c.moveTo(x-r,y);c.lineTo(x,y-r);c.lineTo(x+r,y);c.lineTo(x,y+r);c.closePath();c.fill();}
  function effects(c,id,move,frame){
    if(move.kind==='idle'||frame.dead||frame.frozen||frame.stunned)return;
    const h=window.SchoolRPG.BY_ID[id],skill=move.kind==='skill',age=move.age,duration=skill?1.1:.8;
    if(age<.1||age>=duration)return;
    const p=clamp((age-.1)/(duration-.1)),pulse=Math.sin(p*Math.PI),color=h.color;
    c.save();c.globalAlpha*=frame.reduced?.65:Math.min(.85,pulse+.1);c.lineWidth=skill?1.1:.8;c.strokeStyle=color;c.fillStyle=color;
    if(h.weapon==='sword'){
      const a=frame.reduced?.5:p,r=skill?20:13;
      c.beginPath();c.arc(11,-24,r,-1.5+a*.5,1.1+a*.8);c.stroke();
      c.strokeStyle='#fff2d1';c.lineWidth=.45;c.beginPath();c.arc(11,-24,r-1,-1.4+a*.5,.7+a*.8);c.stroke();
    }else if(h.weapon==='shield'){
      const r=skill?19:12;
      c.beginPath();c.moveTo(9-r*.6,-34);c.lineTo(9+r*.6,-34);c.lineTo(9+r*.7,-23);c.lineTo(9,-9);c.lineTo(9-r*.7,-23);c.closePath();
      c.globalAlpha*=.24;c.fill();c.globalAlpha/=.24;c.stroke();
    }else if(h.weapon==='bow'){
      c.beginPath();c.moveTo(17,-26);c.lineTo(skill?37:30,-26);c.lineTo(skill?33:26,-29);c.moveTo(skill?37:30,-26);c.lineTo(skill?33:26,-23);c.stroke();
    }else if(h.weapon==='heal'){
      for(let i=0;i<(frame.reduced?2:4);i++){const x=-12+i*8,y=-8-(frame.reduced?.5:(p+i*.18)%1)*27;c.fillRect(x-1,y-3,2,6);c.fillRect(x-3,y-1,6,2);}
      if(skill){c.beginPath();c.ellipse(0,-1,17,4,0,0,TAU);c.stroke();}
    }else if(h.weapon==='flag'){
      for(let i=0;i<(skill?3:1);i++){c.beginPath();c.arc(5,-28,7+i*4+(frame.reduced?2:p*6),-.7,.7);c.stroke();}
    }else{
      const r=skill?17:8;c.beginPath();c.ellipse(2,-21,r,r*.45,0,0,TAU);c.stroke();
      for(let i=0;i<(frame.reduced?3:5);i++){const a=i*TAU/5+(frame.reduced?0:p*1.4);spark(c,2+Math.cos(a)*r,-21+Math.sin(a)*r*.65,skill?1.8:1.2);}
    }
    c.restore();
  }
  function draw(c,id,x,y,scale=2,frame={}){
    const entry=heroes.get(id),sheet=entry&&sheets[entry.sheet];
    if(!sheet?.loaded||![x,y,scale].every(Number.isFinite)||scale<=0)return false;
    const move=motion(frame);
    c.save();c.translate(x,y);c.scale(scale*(frame.flip?-1:1),scale);c.imageSmoothingEnabled=false;
    if(frame.dead){c.globalAlpha*=.4;c.rotate(-Math.PI/2);}
    c.translate(move.dx,0);c.transform(1,0,move.lean,move.stretch,0,0);
    c.drawImage(sheet.image,move.pose*256,entry.row*256,256,256,-32,-58,64,64);
    effects(c,id,move,frame);c.restore();return true;
  }
  return Object.freeze({ready,has:id=>heroes.has(id),assetsReady:id=>!!sheets[heroes.get(id)?.sheet]?.loaded,draw,motion,ids:Object.freeze([...heroes.keys()])});
})();
