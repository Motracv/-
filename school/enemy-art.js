/* Illustrated school enemies: four authored poses with a shared foot anchor. */
window.SchoolEnemyArt=(()=>{
 'use strict';
 const M=window.SchoolEnemyManifest,images=new Map(),clamp=n=>Math.max(0,Math.min(1,n));
 const ready=Promise.all(Object.entries(M.sheets).map(([id,s])=>new Promise(resolve=>{const im=new Image();im.onload=()=>{images.set(id,im);resolve(true);window.dispatchEvent(new Event('school-art-ready'));};im.onerror=()=>resolve(false);im.src='school/assets/enemy-remake/'+s.file+'?v=overhaul1';})));
 function family(enemy,frame){
  if(frame.activity?.kind==='tower')return M.mappings.tower[frame.activity.theme]||'armory-lord';
  if(frame.activity&&enemy.boss)return M.mappings.activities[frame.activity.kind]||'headmaster';
  const zone=Math.max(0,Math.min(24,Number(enemy.kind)||0));return (enemy.boss?M.mappings.campaignBoss:M.mappings.campaignRegular)[zone];
 }
 function draw(c,enemy,x,y,f={}){
  const id=family(enemy,f),def=M.families[id],im=def&&images.get(def.sheet);if(!im)return false;
  const dead=enemy.hp<=0,death=Math.max(0,f.deathAge??(dead?1:0));if(dead&&death>=.7)return true;
  const attack=f.attackAge??9,hit=f.hitAge??9,stopped=f.reduced||f.stunned||dead,time=f.time||0;
  const cast=!!f.casting,warning=!!f.warning;
  const pose=dead||f.stunned?0:cast?3:warning||attack>=0&&attack<.1?1:attack>=.1&&attack<.65?2:0;
  const height=enemy.boss?112:66,scale=height/def.bodyHeight,cell=M.cell;
  const recoil=stopped?0:Math.sin(clamp(hit/.26)*Math.PI)*5,lunge=stopped?0:Math.sin(clamp(attack/.65)*Math.PI)*(enemy.boss?13:9);
  const bounce=stopped?0:Math.sin(time*3.4+(Number(f.index)||0))*1.1,spawn=f.spawnAge===undefined?1:clamp(f.spawnAge/.32);
  c.save();c.translate(Math.round(x),Math.round(y));c.globalAlpha*=dead?1-clamp(death/.7):f.reduced?1:spawn;
  c.fillStyle='#0c183b55';c.beginPath();c.ellipse(0,2,height*.28,height*.065,0,0,Math.PI*2);c.fill();
  if(warning&&!dead){c.strokeStyle='#ffd18c';c.lineWidth=1.3;c.beginPath();c.ellipse(0,0,height*.35,height*.1,0,0,Math.PI*2);c.stroke();}
  c.translate(recoil-lunge,bounce+(dead&&!f.reduced?death*14:0));if(dead&&!f.reduced)c.rotate(-death*.16);
  const args=[pose*cell,def.row*cell,cell,cell,-def.foot[0]*scale,-def.foot[1]*scale,cell*scale,cell*scale];
  c.drawImage(im,...args);
  if(hit>=0&&hit<.16){c.save();c.globalAlpha*=.6*(1-hit/.16);c.globalCompositeOperation='lighter';c.drawImage(im,...args);c.restore();}
  if(!stopped&&attack>=.1&&attack<.42){const t=(attack-.1)/.32;c.save();c.globalAlpha*=1-t;c.strokeStyle=enemy.boss?'#e5a9ff':'#bcecff';c.lineWidth=enemy.boss?2.4:1.5;c.beginPath();c.arc(-height*.25,-height*.43,height*(.25+t*.18),Math.PI*.65,Math.PI*1.4);c.stroke();c.restore();}
  c.restore();return true;
 }
 return {draw,family,ready};
})();
