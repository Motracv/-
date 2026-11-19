const fs=require('node:fs'),path=require('node:path'),fixture=require('./roster-render-fixture.cjs');
(async()=>{
 const {G,window:W,canvas}=await fixture(),out='/workspace/outputs/roster-remake';fs.mkdirSync(out,{recursive:true});
 const cv=canvas(1400,1120),c=cv.getContext('2d');c.fillStyle='#1c2b40';c.fillRect(0,0,cv.width,cv.height);
 G.HEROES.forEach((h,i)=>{const x=140+(i%5)*280,y=220+Math.floor(i/5)*280;
  c.fillStyle='#b4c5d522';c.fillRect(x-85,y+2,170,1);
  W.SchoolArt.hero(c,h.id,x,y,3.7,{reduced:true,time:0,kazuaActive:false});
  c.fillStyle='#f1e8d5';c.font='18px sans-serif';c.textAlign='center';c.fillText(h.id+' · '+h.rarity,x,y+36);
 });fs.writeFileSync(path.join(out,'in-game-roster.png'),cv.toBuffer('image/png'));
 for(let k=0;k<30;k++){
  const cv=canvas(960,540),c=cv.getContext('2d'),t=k/10;c.fillStyle='#182b40';c.fillRect(0,0,960,540);
  const ids=['geonu','nari','harin','siu','yuna','lumi'];
  ids.forEach((id,i)=>{const x=160+i%3*320,y=240+Math.floor(i/3)*270,phase=t%3,f=phase<1?{time:t}:phase<2?{time:t,attackAge:(phase-1)*.8}:{time:t,casting:true,castAge:phase-2};
   W.SchoolArt.hero(c,id,x,y,3.6,f);c.fillStyle='#e7f2ff';c.textAlign='center';c.font='16px sans-serif';c.fillText(id,x,y+24);
  });fs.writeFileSync(path.join(out,`motion-${String(k).padStart(2,'0')}.png`),cv.toBuffer('image/png'));
 }
 console.log('Production roster contact sheet and 30 motion frames written.');
})().catch(e=>{console.error(e);process.exitCode=1});
