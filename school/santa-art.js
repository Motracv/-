/* Santa poses share a foot baseline; gift flight and debuffs follow server events. */
window.SchoolSantaArt=(()=>{
 'use strict';
 const sheet=new Image(),background=new Image();let loading,ready=false;
 const rects=[[20,60,350,420],[380,60,370,420],[750,60,400,420],[1160,60,376,420],[10,520,335,480],[350,520,390,480],[740,520,405,480],[1150,520,386,480]];
 const colors={frost:'#9beaff',slow:'#d5a4ff',weak:'#ffd276',burn:'#ff956a'};
 function load(){if(loading)return loading;sheet.src='school/assets/santa/atlas.png?v=santa1';background.src='school/assets/yeti/background.webp?v=yeti1';loading=Promise.all([sheet.decode(),background.decode()]).then(()=>{ready=true;return true;}).catch(()=>{loading=null;return false;});return loading;}
 function gift(c,x,y,size,color,angle=0){c.save();c.translate(x,y);c.rotate(angle);c.fillStyle='#382841';c.fillRect(-size/2-2,-size/2-2,size+4,size+4);c.fillStyle=color;c.fillRect(-size/2,-size/2,size,size);c.fillStyle='#ffedac';c.fillRect(-3,-size/2-2,6,size+4);c.fillRect(-size/2,-2,size,5);c.strokeStyle='#ffedac';c.lineWidth=3;c.beginPath();c.ellipse(-5,-size/2-3,6,3,-.5,0,Math.PI*2);c.ellipse(5,-size/2-3,6,3,.5,0,Math.PI*2);c.stroke();c.restore();}
 function draw(c,o,layer='body'){
  const {battle,time,now,floor,h,events,positions,reduced,units}=o,b=battle?.boss,cast=b?.cast;
  const size=Math.min(h*.62,280),scale=size/375,x=790,ground=floor;
  const impact=events.findLast(e=>e.kind==='impact'&&e.shown<=now&&now-e.shown<1000),age=impact?(now-impact.shown)/1000:9;
  if(layer==='body'){
   c.save();c.fillStyle='#020a1b88';c.beginPath();c.ellipse(x,ground+3,size*.37,size*.065,0,0,Math.PI*2);c.fill();
   const recoil=events.findLast(e=>e.kind==='hit'&&e.seq%7===0&&e.shown<=now&&now-e.shown<120);
   let pose=b?.hp===0?7:cast?(cast.id==='burn'?5:time<cast.at-650?1:4):age<.25?2:age<.65?3:recoil?6:0;
   if(ready){const r=rects[pose],baseline=pose<4?462:981,center=r[0]+r[2]/2;
    const sway=!reduced&&pose===0?Math.sin(now/450)*1.6:0;c.translate(x,ground-sway);c.imageSmoothingEnabled=false;c.drawImage(sheet,...r,(r[0]-center)*scale,(r[1]-baseline)*scale,r[2]*scale,r[3]*scale);
   }else{c.fillStyle='#f2e4bf';c.font='bold 18px sans-serif';c.textAlign='center';c.fillText('산타를 불러오는 중…',x,ground-90);}
   c.restore();return;
  }
  if(cast){const color=colors[cast.id],left=cast.at-time,p=Math.max(0,Math.min(1,1-left/650));
   const targets=positions.filter((_,i)=>units[i].hp>0).slice(0,cast.id==='frost'?2:cast.id==='burn'?3:6);
   for(const target of targets){c.save();c.strokeStyle=color;c.globalAlpha=.7;c.lineWidth=2;c.setLineDash([7,5]);c.beginPath();c.ellipse(target.x,target.y,42,11,0,0,Math.PI*2);c.stroke();c.restore();if(p>0){const gx=x+(target.x-x)*p,gy=ground-size*.65+(target.y-40-(ground-size*.65))*p-Math.sin(p*Math.PI)*100;
    c.save();c.strokeStyle=color;c.globalAlpha=.35;c.lineWidth=5;c.beginPath();c.moveTo(gx+25,gy-8);c.lineTo(gx+55,gy-15);c.stroke();c.restore();gift(c,gx,gy,27,color,reduced?0:-p*3);}}
  }
  if(impact){const color=colors[impact.pattern]||'#fff4b4';for(const e of events.filter(e=>e.kind==='santa-debuff'&&e.pattern===impact.pattern&&e.t===impact.t)){const p=positions[units.findIndex(u=>u.id===e.id)];if(!p)continue;c.save();c.globalAlpha=1-age;c.strokeStyle=color;c.lineWidth=4;c.beginPath();c.ellipse(p.x,p.y,15+age*80,5+age*17,0,0,Math.PI*2);c.stroke();for(let i=0;i<(reduced?4:12);i++){const a=i*2.4,r=15+age*75;c.fillStyle=i%2?color:'#fff8d1';c.fillRect(p.x+Math.cos(a)*r,p.y-30+Math.sin(a)*r*.6+age*age*25,4,8);}c.restore();}}
  units.forEach((u,i)=>{if(u.hp<=0)return;const active=u.stunUntil>time?'frost':u.santaslow>time?'slow':u.santaweak>time?'weak':u.santaburn>time?'burn':null;if(!active)return;const p=positions[i],color=colors[active];c.save();c.strokeStyle=color;c.fillStyle=color+'33';c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y-h*.13,25,h*.15,0,0,Math.PI*2);c.fill();c.stroke();c.fillStyle=color;c.font='bold 13px sans-serif';c.textAlign='center';c.fillText({frost:'빙결',slow:'공속 ↓',weak:'피해 ↓',burn:'화상'}[active],p.x,p.y-h*.31);c.restore();});
 }
 return{load,draw,background,get ready(){return ready;}};
})();
