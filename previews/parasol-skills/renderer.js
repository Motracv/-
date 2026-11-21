(function(root){
'use strict';
const E=typeof module==='object'?require('./engine.js'):root.ParasolEngine;
const {clamp,smooth}=E;
function stroke(c,points,w,color,alpha=1){if(alpha<=0||points.length<2)return;c.save();c.globalAlpha*=clamp(alpha);c.strokeStyle=color;c.lineWidth=w;c.lineCap='butt';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.restore();}
// A tapered polygon has a defined cutting edge; only the outside glow is blurred.
function ribbon(c,points,width,color,alpha=1,glow=0){
 if(points.length<3||alpha<=0)return;const left=[],right=[];
 for(let i=0;i<points.length;i++){const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)],dx=next[0]-prev[0],dy=next[1]-prev[1],length=Math.hypot(dx,dy)||1,t=i/(points.length-1),w=width*Math.pow(Math.sin(Math.PI*t),.8)*.5;
 left.push([points[i][0]-dy/length*w,points[i][1]+dx/length*w]);right.push([points[i][0]+dy/length*w,points[i][1]-dx/length*w]);}
 c.save();c.globalAlpha*=clamp(alpha);c.fillStyle=color;c.shadowColor='#a578ff';c.shadowBlur=glow;c.beginPath();[...left,...right.reverse()].forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();c.restore();
}
function shard(c,x,y,angle,length,width,color,alpha){const dx=Math.cos(angle),dy=Math.sin(angle);c.save();c.globalAlpha*=clamp(alpha);c.fillStyle=color;c.beginPath();c.moveTo(x-dy*width,y+dx*width);c.lineTo(x+dx*length,y+dy*length);c.lineTo(x+dy*width,y-dx*width);c.closePath();c.fill();c.restore();}
function glint(c,x,y,r,a=1){shard(c,x,y,-.7,r,1.3,'#fff7ff',a);shard(c,x,y,Math.PI-.7,r,.9,'#e2b7ff',a);shard(c,x,y,.87,r*.45,.8,'#fff7ff',a);shard(c,x,y,Math.PI+.87,r*.45,.8,'#fff7ff',a);}
function impact(c,x,y,age,big=false){
 if(age<0||age>650)return;const core=Math.exp(-age/75),fade=Math.pow(1-age/650,1.6),power=big?1.25:1;
 for(let i=0;i<13;i++){const angle=i*2.39996+.3,travel=age*(.03+(i%4)*.045),px=x+Math.cos(angle)*travel,py=y+Math.sin(angle)*travel+age*age*.000045;
 const length=(18+(i*19%45))*power*(.5+.5*fade);shard(c,px,py,angle,length,(i%3?1:2)*fade,i%3?'#ffdf9d':'#dbc0ff',fade);}
 for(let i=0;i<8;i++)shard(c,x,y,i*Math.PI/4+.22,(20+(i%3)*15)*power,3*core,'#fff9ef',core);
 glint(c,x,y,42*power,core);if(age<120){c.save();c.globalAlpha=core*.24;c.fillStyle='#dcc0ff';c.shadowColor='#c8a0ff';c.shadowBlur=16;c.beginPath();c.arc(x,y,18*core,0,Math.PI*2);c.fill();c.restore();}
}
function ellipse(c,x,y,rx,ry,alpha=1){
  c.save();c.globalAlpha*=clamp(alpha);c.strokeStyle='#cfa4ff';c.lineWidth=1.5;c.shadowColor='#a678ed';c.shadowBlur=8;
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.stroke();c.restore();
}
function star(c,x,y,r,alpha=1){
  for(let i=0;i<8;i++)shard(c,x,y,i*Math.PI/4,r*(i%2?.55:1),1.2,'#f9eaff',alpha);
}
function flower(c,x,y,r,age,alpha){
  c.save();c.translate(x,y);c.rotate(age*.001);c.globalAlpha=clamp(alpha);c.strokeStyle='#e8c4ff';c.lineWidth=1;c.shadowColor='#bf8dea';c.shadowBlur=8;
  for(let i=0;i<5;i++){c.rotate(Math.PI*2/5);c.beginPath();c.ellipse(0,-r*.4,r*.23,r*.48,0,0,Math.PI*2);c.stroke();}
  c.restore();star(c,x,y,r*.4,alpha);
}
function actor(c,assets,meta,row,time,x,facing=1,alpha=1,loop=false){
  const m=meta.motions[row],f=m.frames[E.frameAt(m,time,loop)],scale=1.45*m.scale;
  c.save();c.globalAlpha*=alpha;c.translate(Math.round(x),332);c.scale(facing,1);c.imageSmoothingEnabled=false;
  c.drawImage(assets.actor,f.x,f.y,f.w,f.h,Math.round(-f.pivotX*scale),Math.round(-f.pivotY*scale),Math.round(f.w*scale),Math.round(f.h*scale));c.restore();
}
function curve(x,from,to,offset=0){const p=[];for(let i=0;i<=48;i++)p.push(E.sweepPoint(x,from+(to-from)*i/48,offset));return p;}
function crescent(c,x,y,size,alpha,rich=false){
  const p=[];for(let i=0;i<=32;i++){const a=-1.35+i/32*2.7;p.push([x+Math.cos(a)*size*.65,y+Math.sin(a)*size]);}
  ribbon(c,p,rich?11:7,'#b78aef',alpha*.5,rich?8:0);ribbon(c,p,2,'#f9eaff',alpha);
  if(rich){const q=p.map(([px,py])=>[px-8,py]);ribbon(c,q,1,'#d1a4ef',alpha*.7);}
}
function drawCast(c,cast,time){
  const age=time-cast.start-cast.fire,kind=cast.kind,mx=cast.x+100,my=204,rich=cast.style==='blossom';
  if(age<0&&age>-240){const p=1+age/240;glint(c,mx,my,4+p*7,p);const pts=[];for(let j=0;j<22;j++){const a=-1.5+j*.14+age*.006;pts.push([mx+Math.cos(a)*(12+p*6),my+Math.sin(a)*(12+p*6)]);}ribbon(c,pts,1.5,'#b88aff',p*.65);if(rich)ellipse(c,mx,my,8+p*6,15+p*8,p*.7);}
  if(age>=0&&age<120){const a=1-age/120;for(let i=0;i<5;i++)shard(c,mx,my,-.75+i*.36,18+i%3*12,2,'#fff6ff',a);glint(c,mx,my,21,a);}
  if(kind<2&&age>=0){
    const endLimit=kind===0?630:694,travel=(endLimit-mx)/2.5,end=mx+(endLimit-mx)*clamp(age/travel),fade=1-smooth((age-150)/(kind===0?300:430)),tail=mx+Math.max(0,age-travel)*.6;
    if(fade>0&&tail<end){const p=[];for(let i=0;i<=48;i++){const t=i/48;p.push([tail+(end-tail)*t,my+Math.sin(t*Math.PI)*1.2]);}
      ribbon(c,p,kind===0?9:15,'#9764d2',fade*.22,8);ribbon(c,p,kind===0?3:5,'#e2bcff',fade);ribbon(c,p,1.1,'#fffaff',fade);
      for(let k=0;k<3;k++){const offset=(k-1)*5,head=end-14-k*30,back=Math.max(mx,head-105-k*22);if(head>back)ribbon(c,[[back,my+offset],[back+(head-back)*.55,my+offset+1],[head,my+offset]],1.2,'#bc8cea',fade*(.5-k*.1));}
      if(age<travel+80)shard(c,end,my,0,kind===0?18:30,kind===0?2:4,'#fff4ff',fade);
      stroke(c,[[tail,329],[end,329]],2,'#cba3ff',fade*.13);
      if(rich)for(let k=0;k<2;k++){const points=[];for(let x=tail;x<end;x+=5)points.push([x,my+Math.sin(x*.043-age*.015+k*Math.PI)*8]);ribbon(c,points,1.5,'#d7b8fc',fade*.8);}
    }
    if(kind===1)E.targetX.forEach((x,i)=>{const a=age-E.hitDelay(kind,cast.x,i)+20;if(a>=0&&a<390)crescent(c,x-22+a*.07,my,rich?38:30,Math.pow(1-a/390,1.3),rich);});
  }else if(kind===2&&age>=0){
    for(let echo=2;echo>=0;echo--){const a=age-echo*80;if(a<0||a>920)continue;const head=clamp(a/470),tail=clamp((a-380)/540),fade=(1-smooth((a-470)/450))*[1,.42,.19][echo];if(tail>=head)continue;const pts=curve(cast.x,tail,head,echo*12);
      ribbon(c,pts,echo?5:25,echo?'#c19bed':'#a96dea',fade*(echo?.8:.34),echo?0:7);ribbon(c,pts,echo?1.5:5,'#edd1ff',fade);if(!echo)ribbon(c,pts,1.4,'#fffaff',fade);
    }
    for(let i=0;i<9;i++){const a=age-i*32;if(a<0||a>820)continue;const t=clamp(a/650),p=E.sweepPoint(cast.x,t),fade=(1-t)*.8;
      c.save();c.translate(p[0]-i*3,p[1]-12-i%3*7);c.rotate(t*4+i);c.globalAlpha=fade;c.fillStyle=i%2?'#e5b8ee':'#f7ddff';c.beginPath();c.moveTo(-5,0);c.quadraticCurveTo(0,-5,6,0);c.quadraticCurveTo(0,4,-5,0);c.fill();c.restore();
    }
    if(rich)for(let i=0;i<3;i++){const a=age-i*75;if(a>=0&&a<680){const p=clamp(a/470),point=E.sweepPoint(cast.x,p);crescent(c,point[0]-8,220,50+15*p,(1-smooth((a-330)/350))*.7,true);flower(c,point[0]+25,205,12,a,(1-p)*.7);}}
    if(age<500){const a=(1-age/500)*.3;for(let i=0;i<4;i++)stroke(c,[[cast.x-50-i*8,333-i*2],[cast.x+25+age*.1-i*8,333-i*2]],1.5,'#dfc8f9',a);}
  }
  E.targetX.forEach((x,i)=>{
    if(kind===0&&i!==2)return;
    const a=age-E.hitDelay(kind,cast.x,i),y=kind===2?232:204;
    impact(c,x,y,a,kind===0||kind===2&&i===2);
    if(rich&&a>=0&&a<780){const opacity=1-smooth(a/780);if(kind===2){flower(c,x,y,26,a,opacity);ellipse(c,x,316,20+a*.04,5+a*.008,opacity*.65);}else {star(c,x,y,(kind===0?48:28)*(1-a/1000),opacity*.7);ellipse(c,x,y,12+a*.06,12+a*.06,opacity*.5);}}
  });
}
function draw(c,assets,meta,engine){
  const s=engine.state,pose=engine.pose();c.clearRect(0,0,720,400);c.drawImage(assets.background,0,0,720,400);c.fillStyle='#0710259b';c.fillRect(0,0,720,400);
  E.targetX.forEach((x,i)=>{
    const hitAge=s.time-s.lastHit[i],pulse=hitAge>=0&&hitAge<180?1-hitAge/180:0,shake=pulse*Math.sin(hitAge*.11)*2;
    c.fillStyle='#070c1b90';c.beginPath();c.ellipse(x,319,34,5,0,0,Math.PI*2);c.fill();c.imageSmoothingEnabled=false;
    c.drawImage(assets.dummy,66,200,750,1390,Math.round(x-54+shake),116,109,202);
    if(pulse){glint(c,x,210,12,pulse*.5);}
  });
  c.fillStyle='#050a1490';c.beginPath();c.ellipse(s.x,333,47,6,0,0,Math.PI*2);c.fill();
  const action=s.action;
  if(action?.type==='cast'){
    const kind=action.kind,age=s.time-action.start-E.skills[kind].fire;
    if(kind===2&&age>-80&&age<570){const envelope=smooth((age+80)/150)*(1-smooth((age-280)/290));for(let echo=3;echo>=1;echo--){c.save();c.globalCompositeOperation='screen';actor(c,assets,meta,4,s.time-action.start-echo*95,s.x-echo*25,1,envelope*[0,.42,.26,.14][echo]);c.restore();}}
    if(kind<2&&age>=0&&age<200){c.save();c.beginPath();c.rect(s.x-10,175,145,72);c.clip();actor(c,assets,meta,kind+2,s.time-action.start-65,s.x-12,1,(1-age/200)*.22);c.restore();}
  }else if(action?.type==='evade'){
    const age=s.time-action.start;if(age>180&&age<700)for(let i=3;i>=1;i--){const t=Math.max(0,age-i*65),x=action.from+(action.to-action.from)*smooth((t-180)/400);actor(c,assets,meta,5,t,x,action.facing,.07+(3-i)*.06);}
  }
  actor(c,assets,meta,pose.row,pose.time,s.x,pose.facing,1,pose.loop);
  for(const cast of s.casts)drawCast(c,cast,s.time);
  const title=action?.type==='cast'?E.skills[action.kind].name:action?.type==='evade'?'회피':s.input?'이동':'대기';
  c.fillStyle='#081020cb';c.fillRect(0,0,720,43);c.fillStyle='#efe7ff';c.font='bold 18px Pretendard,sans-serif';c.fillText('은빛 우산 · '+title,18,28);
  c.textAlign='right';c.fillStyle='#cec0e6';c.font='13px Pretendard,sans-serif';c.fillText(s.style==='trails'?'잔상 연출':'별빛 · 꽃잎 연출',702,27);c.textAlign='left';
}
const api={draw,drawCast,actor};if(typeof module==='object')module.exports=api;else root.ParasolRenderer=api;
})(globalThis);
