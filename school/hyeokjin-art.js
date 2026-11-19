/* Foot-anchored sprite playback. Damage remains entirely in the shared engine. */
window.SchoolHyeokjinArt=(()=>{
  "use strict";
  const DATA={"version":2,"name":"서혁진","facing":"right","timeUnit":"milliseconds","forms":{"normal":{"image":"normal.png","width":1254,"height":1254,"frames":[{"x":0,"y":0,"w":314,"h":314,"pivot":{"x":157,"y":296},"bounds":{"left":72,"top":51,"right":286,"bottom":295}},{"x":314,"y":0,"w":313,"h":314,"pivot":{"x":157,"y":296},"bounds":{"left":71,"top":43,"right":285,"bottom":295}},{"x":627,"y":0,"w":314,"h":314,"pivot":{"x":157,"y":296},"bounds":{"left":72,"top":37,"right":286,"bottom":295}},{"x":941,"y":0,"w":313,"h":314,"pivot":{"x":157,"y":296},"bounds":{"left":72,"top":50,"right":285,"bottom":295}},{"x":0,"y":314,"w":314,"h":313,"pivot":{"x":157,"y":296},"bounds":{"left":72,"top":52,"right":286,"bottom":295}},{"x":314,"y":314,"w":313,"h":313,"pivot":{"x":157,"y":296},"bounds":{"left":76,"top":46,"right":285,"bottom":295}},{"x":627,"y":314,"w":314,"h":313,"pivot":{"x":157,"y":294},"bounds":{"left":81,"top":52,"right":286,"bottom":293}},{"x":941,"y":314,"w":313,"h":313,"pivot":{"x":157,"y":296},"bounds":{"left":74,"top":45,"right":285,"bottom":295}},{"x":0,"y":627,"w":314,"h":314,"pivot":{"x":157,"y":295},"bounds":{"left":70,"top":51,"right":285,"bottom":294}},{"x":314,"y":627,"w":313,"h":314,"pivot":{"x":157,"y":295},"bounds":{"left":13,"top":56,"right":232,"bottom":294}},{"x":627,"y":627,"w":314,"h":314,"pivot":{"x":157,"y":295},"bounds":{"left":34,"top":50,"right":239,"bottom":294}},{"x":941,"y":627,"w":313,"h":314,"pivot":{"x":157,"y":295},"bounds":{"left":37,"top":26,"right":253,"bottom":294}},{"x":0,"y":941,"w":314,"h":313,"pivot":{"x":157,"y":293},"bounds":{"left":68,"top":58,"right":297,"bottom":292}},{"x":314,"y":941,"w":313,"h":313,"pivot":{"x":157,"y":293},"bounds":{"left":35,"top":79,"right":311,"bottom":292}},{"x":627,"y":941,"w":314,"h":313,"pivot":{"x":157,"y":292},"bounds":{"left":47,"top":69,"right":306,"bottom":291}},{"x":941,"y":941,"w":313,"h":313,"pivot":{"x":157,"y":295},"bounds":{"left":71,"top":52,"right":285,"bottom":294}}],"animations":{"idle":{"frames":[0,1,2,3,2,1],"durations":[240,180,180,240,180,180],"loop":true},"walk":{"frames":[4,5,6,7],"durations":[140,120,140,120],"loop":true},"attack":{"frames":[8,9,10,11,12,13,14,15,0],"durations":[160,180,180,140,60,90,180,310,500],"loop":true,"hitIndex":4}}},"awakened":{"image":"awakened.png","width":1254,"height":1254,"frames":[{"x":0,"y":0,"w":314,"h":314,"pivot":{"x":157,"y":284},"bounds":{"left":54,"top":75,"right":280,"bottom":283}},{"x":314,"y":0,"w":313,"h":314,"pivot":{"x":157,"y":284},"bounds":{"left":54,"top":70,"right":280,"bottom":283}},{"x":627,"y":0,"w":314,"h":314,"pivot":{"x":157,"y":284},"bounds":{"left":54,"top":68,"right":280,"bottom":283}},{"x":941,"y":0,"w":313,"h":314,"pivot":{"x":157,"y":284},"bounds":{"left":54,"top":74,"right":279,"bottom":283}},{"x":0,"y":314,"w":314,"h":313,"pivot":{"x":157,"y":282},"bounds":{"left":65,"top":69,"right":285,"bottom":281}},{"x":314,"y":314,"w":313,"h":313,"pivot":{"x":157,"y":282},"bounds":{"left":68,"top":63,"right":285,"bottom":281}},{"x":627,"y":314,"w":314,"h":313,"pivot":{"x":157,"y":282},"bounds":{"left":68,"top":62,"right":284,"bottom":281}},{"x":941,"y":314,"w":313,"h":313,"pivot":{"x":157,"y":282},"bounds":{"left":74,"top":65,"right":284,"bottom":281}},{"x":0,"y":627,"w":314,"h":314,"pivot":{"x":157,"y":283},"bounds":{"left":54,"top":76,"right":283,"bottom":282}},{"x":314,"y":627,"w":313,"h":314,"pivot":{"x":157,"y":284},"bounds":{"left":65,"top":76,"right":274,"bottom":283}},{"x":627,"y":627,"w":314,"h":314,"pivot":{"x":157,"y":284},"bounds":{"left":45,"top":63,"right":246,"bottom":283}},{"x":941,"y":627,"w":313,"h":314,"pivot":{"x":157,"y":284},"bounds":{"left":73,"top":26,"right":245,"bottom":283}},{"x":0,"y":941,"w":314,"h":313,"pivot":{"x":157,"y":283},"bounds":{"left":54,"top":76,"right":298,"bottom":282}},{"x":314,"y":941,"w":313,"h":313,"pivot":{"x":157,"y":283},"bounds":{"left":50,"top":90,"right":309,"bottom":282}},{"x":627,"y":941,"w":314,"h":313,"pivot":{"x":157,"y":283},"bounds":{"left":53,"top":87,"right":303,"bottom":282}},{"x":941,"y":941,"w":313,"h":313,"pivot":{"x":157,"y":283},"bounds":{"left":55,"top":78,"right":285,"bottom":282}}],"animations":{"idle":{"frames":[0,1,2,3,2,1],"durations":[240,180,180,240,180,180],"loop":true},"walk":{"frames":[4,5,6,7],"durations":[140,120,140,120],"loop":true},"attack":{"frames":[8,9,10,11,12,13,14,15,0],"durations":[120,140,140,110,50,80,150,210,400],"loop":true,"hitIndex":4}}}},"sheets":{"skills-a":{"image":"skills-a.png","width":1254,"height":1254,"renderScale":1.4,"frames":[{"x":0,"y":0,"w":314,"h":314,"pivot":{"x":157,"y":257},"bounds":{"left":75,"top":97,"right":229,"bottom":256}},{"x":314,"y":0,"w":313,"h":314,"pivot":{"x":157,"y":257},"bounds":{"left":83,"top":98,"right":268,"bottom":256}},{"x":627,"y":0,"w":314,"h":314,"pivot":{"x":157,"y":257},"bounds":{"left":77,"top":92,"right":245,"bottom":256}},{"x":941,"y":0,"w":313,"h":314,"pivot":{"x":157,"y":257},"bounds":{"left":82,"top":95,"right":235,"bottom":256}},{"x":0,"y":314,"w":314,"h":313,"pivot":{"x":157,"y":248},"bounds":{"left":81,"top":74,"right":236,"bottom":245}},{"x":314,"y":314,"w":313,"h":313,"pivot":{"x":157,"y":248},"bounds":{"left":76,"top":94,"right":229,"bottom":245}},{"x":627,"y":314,"w":314,"h":313,"pivot":{"x":157,"y":248},"bounds":{"left":74,"top":77,"right":231,"bottom":244}},{"x":941,"y":314,"w":313,"h":313,"pivot":{"x":157,"y":248},"bounds":{"left":79,"top":107,"right":245,"bottom":243}},{"x":0,"y":627,"w":314,"h":314,"pivot":{"x":157,"y":231},"bounds":{"left":82,"top":76,"right":245,"bottom":226}},{"x":314,"y":627,"w":313,"h":314,"pivot":{"x":157,"y":231},"bounds":{"left":67,"top":77,"right":223,"bottom":226}},{"x":627,"y":627,"w":314,"h":314,"pivot":{"x":157,"y":231},"bounds":{"left":54,"top":75,"right":216,"bottom":226}},{"x":941,"y":627,"w":313,"h":314,"pivot":{"x":157,"y":231},"bounds":{"left":57,"top":79,"right":252,"bottom":227}},{"x":0,"y":941,"w":314,"h":313,"pivot":{"x":157,"y":220},"bounds":{"left":74,"top":81,"right":257,"bottom":216}},{"x":314,"y":941,"w":313,"h":313,"pivot":{"x":157,"y":220},"bounds":{"left":73,"top":76,"right":253,"bottom":216}},{"x":627,"y":941,"w":314,"h":313,"pivot":{"x":157,"y":220},"bounds":{"left":64,"top":81,"right":239,"bottom":215}},{"x":941,"y":941,"w":313,"h":313,"pivot":{"x":157,"y":220},"bounds":{"left":75,"top":87,"right":227,"bottom":216}}]},"skills-b":{"image":"skills-b.png","width":1254,"height":1254,"renderScale":1.4,"frames":[{"x":0,"y":0,"w":314,"h":314,"pivot":{"x":157,"y":268},"bounds":{"left":90,"top":130,"right":252,"bottom":265}},{"x":314,"y":0,"w":313,"h":314,"pivot":{"x":157,"y":268},"bounds":{"left":67,"top":104,"right":210,"bottom":264}},{"x":627,"y":0,"w":314,"h":314,"pivot":{"x":157,"y":268},"bounds":{"left":79,"top":86,"right":209,"bottom":254}},{"x":941,"y":0,"w":313,"h":314,"pivot":{"x":157,"y":268},"bounds":{"left":74,"top":72,"right":219,"bottom":258}},{"x":0,"y":314,"w":314,"h":313,"pivot":{"x":157,"y":250},"bounds":{"left":101,"top":61,"right":247,"bottom":251}},{"x":314,"y":314,"w":313,"h":313,"pivot":{"x":157,"y":250},"bounds":{"left":72,"top":121,"right":246,"bottom":251}},{"x":627,"y":314,"w":314,"h":313,"pivot":{"x":157,"y":250},"bounds":{"left":66,"top":120,"right":239,"bottom":250}},{"x":941,"y":314,"w":313,"h":313,"pivot":{"x":157,"y":250},"bounds":{"left":81,"top":120,"right":238,"bottom":248}},{"x":0,"y":627,"w":314,"h":314,"pivot":{"x":157,"y":226},"bounds":{"left":91,"top":88,"right":242,"bottom":222}},{"x":314,"y":627,"w":313,"h":314,"pivot":{"x":157,"y":226},"bounds":{"left":88,"top":79,"right":214,"bottom":223}},{"x":627,"y":627,"w":314,"h":314,"pivot":{"x":157,"y":226},"bounds":{"left":81,"top":61,"right":223,"bottom":223}},{"x":941,"y":627,"w":313,"h":314,"pivot":{"x":157,"y":226},"bounds":{"left":78,"top":58,"right":225,"bottom":225}},{"x":0,"y":941,"w":314,"h":313,"pivot":{"x":157,"y":218},"bounds":{"left":92,"top":97,"right":232,"bottom":216}},{"x":314,"y":941,"w":313,"h":313,"pivot":{"x":157,"y":218},"bounds":{"left":72,"top":68,"right":244,"bottom":217}},{"x":627,"y":941,"w":314,"h":313,"pivot":{"x":157,"y":218},"bounds":{"left":72,"top":81,"right":236,"bottom":217}},{"x":941,"y":941,"w":313,"h":313,"pivot":{"x":157,"y":218},"bounds":{"left":84,"top":68,"right":216,"bottom":216}}]}},"skills":{"recovery":{"name":"죽지 않는 청년","form":"기본형","sheet":"skills-a","frames":[0,1,2,3],"durations":[280,120,440,800],"hitIndex":1,"loop":true,"description":"대검 베기 → 붉은 기운 회수 → 자세 복귀"},"transform":{"name":"어둠의 잠식","form":"폼 체인지","sheet":"skills-a","frames":[4,5,6,7],"durations":[300,550,160,850],"loop":true,"description":"고개 숙이기 → 어둠 응축 → 각성 자세"},"black":{"name":"블랙","form":"각성형","sheet":"skills-a","frames":[8,9,10,11,12,13,14,15],"durations":[200,180,140,70,80,90,160,650],"hitIndex":4,"loop":true,"description":"허리 비틀기 → 가로 베기 → 어둠의 참격 방출"},"execution":{"name":"참수","form":"각성형","sheet":"skills-b","frames":[0,1,2,3,4,5,6,7],"durations":[220,140,140,100,60,140,240,660],"hitIndex":5,"loop":true,"description":"도약 → 대검 내려찍기 → 착지 충격"},"ultimate":{"name":"내가 지켜온 모든 것","form":"궁극기","sheet":"skills-b","frames":[8,9,10,11,12,13,14,15],"durations":[300,300,360,300,110,180,280,800],"hitIndex":5,"loop":true,"description":"기운 축적 → 대검 꽂기 → 붉은 폭발 → 버티기"}}};
  const pictures={},tinted={},loaded=new Set(),TAU=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,n));
  const sheets={...DATA.forms,...DATA.sheets};
  const ready=Promise.all(Object.entries(sheets).map(([key,sheet])=>new Promise(resolve=>{
    const img=pictures[key]=new Image(),timer=setTimeout(()=>resolve(false),7000);
    img.onload=()=>{loaded.add(key);if(typeof document!=='undefined'){const tint=document.createElement('canvas');tint.width=sheet.width;tint.height=sheet.height;const tc=tint.getContext('2d');tc.drawImage(img,0,0);tc.globalCompositeOperation='source-in';tc.fillStyle='#ff254c';tc.fillRect(0,0,tint.width,tint.height);tinted[key]=tint;}clearTimeout(timer);resolve(true);window.dispatchEvent(new Event('school-art-ready'));};
    img.onerror=()=>{clearTimeout(timer);resolve(false);};img.src='school/assets/hyeokjin/'+sheet.image+'?v=hyeokjin1';
  })));
  function frame(unit,time){
    if(unit.id!=='hyeokjin')return {};const q=unit.hyeokjin||{},active=unit.hp>0&&!(unit.stunUntil>time);
    const mode=active&&(time<q.modeUntil||q.mode==='execution'&&q.cast&&!q.cast.done)?q.mode:'idle';
    return {hyeokMode:mode,hyeokAge:Math.max(0,time-(q.began||0)),hyeokDuration:Math.max(1,(q.modeUntil||0)-(q.began||0)),hyeokHit:Math.max(0,(q.cast?.at??q.impactAt??q.began??0)-(q.began||0)),hyeokAwake:!!q.used&&time<q.until,hyeokLast:active&&time<q.lastUntil,hyeokRemaining:active?Math.max(0,Math.ceil(((time<q.lastUntil?q.lastUntil:q.until)||0)-time)/1000):0};
  }
  function pose(frame={}){
    const disabled=frame.dead||frame.frozen||frame.stunned,mode=disabled?'idle':frame.hyeokMode||'idle';
    const form=frame.hyeokAwake?'awakened':'normal',skill=DATA.skills[mode];
    const key=skill?.sheet||form,sheet=sheets[key],clip=skill||sheet.animations[mode==='basic'?'attack':mode==='walk'?'walk':'idle'];
    const duration=clip.durations.reduce((a,b)=>a+b,0);let age=frame.reduced?0:Math.max(0,mode==='idle'||mode==='walk'?(frame.time||0)*1000:frame.hyeokAge||0);
    if(mode==='idle'||mode==='walk')age%=duration;
    else{
      // Retarget authored timing to the simulation impact, preserving the wind-up and follow-through.
      const total=frame.hyeokDuration||duration,hit=frame.hyeokHit||0,sourceHit=clip.durations.slice(0,clip.hitIndex||0).reduce((a,b)=>a+b,0);
      age=hit>0&&sourceHit>0?(age<hit?age/hit*sourceHit:sourceHit+(age-hit)/Math.max(1,total-hit)*(duration-sourceHit)):age/total*duration;
      age=Math.min(duration-1,age);
      if(frame.reduced)age=sourceHit;
    }
    if(mode==='execution'&&!disabled&&!frame.reduced&&(frame.hyeokAge||0)>=(frame.hyeokHit||0)){const t=(frame.hyeokAge-frame.hyeokHit)/1000;if(t<1.5)return{key,sheet,rect:sheet.frames[clip.frames[(Math.floor(t/.125)%2)?5:4]],mode};}
    let i=0;while(i<clip.frames.length-1&&age>=clip.durations[i])age-=clip.durations[i++];
    return {key,sheet,rect:sheet.frames[clip.frames[i]],mode};
  }
  function hero(c,x,y,scale=2,f={}){
    const p=pose(f),r=p.rect,z=.16*(p.sheet.renderScale||1);
    c.save();c.translate(x,y);c.scale(scale*(f.flip?-1:1),scale);c.imageSmoothingEnabled=false;
    if(f.dead){c.globalAlpha*=.4;c.rotate(-Math.PI/2);}
    if(f.hyeokAwake&&!f.dead){
      const t=f.time||0,pulse=f.reduced?.45:.48+Math.sin(t*5)*.1;
      glow(c,0,-22,33,pulse);c.save();c.strokeStyle='#ff3257';c.lineWidth=1;c.globalAlpha=.7;c.beginPath();c.ellipse(0,-1,18,4,0,0,TAU);c.stroke();
      if(!f.reduced)for(let i=0;i<5;i++){const q=(t*.7+i/5)%1,x=Math.sin(i*2.4+t)*8,r=7+q*18;c.globalAlpha=(1-q)*.4;c.lineWidth=.7;c.beginPath();c.ellipse(x,-8-q*37,r,r*.32,-.2,0,0,TAU);c.stroke();c.globalAlpha=(1-q)*.75;c.fillStyle=i%2?'#ff3555':'#ffa382';c.fillRect(x+Math.cos(i)*r,-q*48,1.1,2.6);}
      c.restore();
    }
    if(loaded.has(p.key))c.drawImage(pictures[p.key],r.x,r.y,r.w,r.h,-r.pivot.x*z,-r.pivot.y*z,r.w*z,r.h*z);
    else if(loaded.has('normal')){const b=sheets.normal.frames[0];c.drawImage(pictures.normal,b.x,b.y,b.w,b.h,-b.pivot.x*.16,-b.pivot.y*.16,b.w*.16,b.h*.16);}
    if(f.hyeokAwake&&!f.dead&&tinted[p.key]){c.save();c.globalAlpha*=f.reduced?.12:.19+Math.sin((f.time||0)*5)*.07;c.drawImage(tinted[p.key],r.x,r.y,r.w,r.h,-r.pivot.x*z,-r.pivot.y*z,r.w*z,r.h*z);c.restore();}
    if((f.hyeokAwake||f.hyeokLast)&&!f.dead){c.font='bold 6px Galmuri,sans-serif';c.textAlign='center';c.fillStyle=f.hyeokLast?'#fff0aa':'#ffc1dc';c.strokeStyle='#160e24';c.lineWidth=2;const label=(f.hyeokLast?'책임감':'각성')+(f.hyeokRemaining?` ${Math.ceil(f.hyeokRemaining)}초`:'');c.strokeText(label,0,-46);c.fillText(label,0,-46);}
    c.restore();
  }
  // All VFX use the shared simulation clock. No hit-stop, timers or damage here.
  const mix=(a,b,p)=>a+(b-a)*p,ease=p=>1-Math.pow(1-clamp(p),3);
  let glowImage;
  function glow(c,x,y,r,alpha=1){
    if(alpha<=0||r<=0)return;
    if(!glowImage&&typeof document!=='undefined'){
      glowImage=document.createElement('canvas');glowImage.width=glowImage.height=128;
      const g=glowImage.getContext('2d'),grad=g.createRadialGradient(64,64,1,64,64,64);
      grad.addColorStop(0,'#ffebb9');grad.addColorStop(.12,'#ffb073');grad.addColorStop(.34,'#f23a47aa');grad.addColorStop(.67,'#a00f4830');grad.addColorStop(1,'#30082700');g.fillStyle=grad;g.fillRect(0,0,128,128);
    }
    c.save();c.globalAlpha*=alpha;c.globalCompositeOperation='lighter';
    if(glowImage){c.imageSmoothingEnabled=true;c.drawImage(glowImage,x-r,y-r,r*2,r*2);}
    else{c.fillStyle='#ea355a';c.globalAlpha*=.12;c.beginPath();c.ellipse(x,y,r,r,0,0,TAU);c.fill();}
    c.restore();
  }
  function phase(unit,time){
    if(!unit||unit.hp<=0||unit.stunUntil>time)return null;
    const f=frame(unit,time);if(['idle','walk'].includes(f.hyeokMode))return null;
    const age=f.hyeokAge/1000,hit=f.hyeokHit/1000,travel=Math.min(hit*.7,f.hyeokMode==='ultimate'?.42:.32),launch=hit-travel;
    return {mode:f.hyeokMode,age,hit,travel,launch,after:age-hit,flight:clamp((age-launch)/Math.max(.001,travel)),awake:f.hyeokAwake};
  }
  function field(c,units,time,w,h,reduced=false){
    const phases=(Array.isArray(units)?units:[units]).map(u=>phase(u,time)).filter(p=>p&&['transform','ultimate'].includes(p.mode));if(!phases.length)return;
    let shade=0,impact=0;for(const p of phases){shade=Math.max(shade,p.mode==='transform'?Math.sin(clamp(p.age)*Math.PI)*.3:clamp(p.age/.3)*clamp((.85-p.after)/.85)*.57);impact=Math.max(impact,p.mode==='ultimate'&&p.after>=0?clamp(1-p.after/.34):0);}
    c.save();c.globalAlpha*=shade*(reduced?.35:1);c.fillStyle='#0c0718';c.fillRect(0,0,w,h);
    if(!reduced){c.globalAlpha=shade*.7;c.fillStyle='#270e25';c.fillRect(0,0,w,h*.055);c.fillRect(0,h*.945,w,h*.055);}
    // One soft warm impact wash, no repeated flashing or simulation pause.
    if(impact){c.globalAlpha=impact*(reduced?.035:.11);c.fillStyle='#ef805d';c.fillRect(0,0,w,h);}
    c.restore();
  }
  function shake(unit,time,reduced=false){const p=phase(unit,time);if(reduced||!p||p.mode!=='ultimate'||p.after<0||p.after>.3)return{x:0,y:0};const a=(1-p.after/.3)*2.4;return{x:Math.sin(p.after*71)*a,y:Math.cos(p.after*57)*a*.5};}
  function crescent(c,x,y,r,angle,alpha=1,power=1){
    c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha*=alpha;
    c.fillStyle='#160c27';c.beginPath();c.moveTo(-r*.55,-r*1.08);c.bezierCurveTo(r*1.05,-r*.65,r*1.05,r*.65,-r*.55,r*1.08);c.bezierCurveTo(r*.15,r*.4,r*.15,-r*.4,-r*.55,-r*1.08);c.fill();
    c.fillStyle='#a71040';c.beginPath();c.moveTo(-r*.4,-r);c.bezierCurveTo(r*.96,-r*.5,r*.96,r*.5,-r*.4,r);c.bezierCurveTo(r*.39,r*.28,r*.39,-r*.28,-r*.4,-r);c.fill();
    c.globalCompositeOperation='lighter';
    for(const [width,color,a] of [[r*.18,'#d92849',.42],[r*.075,'#ff624d',.95],[Math.max(.7,r*.023),'#fff1ca',1]]){
      c.strokeStyle=color;c.lineWidth=width;c.globalAlpha=alpha*a;c.beginPath();c.moveTo(-r*.4,-r);c.bezierCurveTo(r*.93,-r*.48,r*.93,r*.48,-r*.4,r);c.stroke();
    }
    // Razor splinters follow the curved edge rather than forming an X.
    if(power>1){c.strokeStyle='#ffc6a0';c.lineWidth=Math.max(.7,r*.014);for(let i=0;i<3;i++){const yy=(i-1)*r*.52;c.beginPath();c.moveTo(r*.4,yy);c.lineTo(r*(.76+i*.09),yy-r*.18);c.stroke();}}
    c.restore();
  }
  function ribbon(c,from,to,progress,r,alpha,bend=0){
    const x=mix(from.x,to.x,progress),y=mix(from.y,to.y,progress)+Math.sin(progress*Math.PI)*bend;
    const bx=mix(from.x,x,.55),by=mix(from.y,y,.55)-r*.5;
    c.save();c.globalAlpha*=alpha;c.fillStyle='#4c102e';c.beginPath();c.moveTo(from.x,from.y);c.quadraticCurveTo(bx,by,x,y-r*.26);c.lineTo(x,y+r*.26);c.quadraticCurveTo(bx,by+r*.42,from.x,from.y);c.fill();
    c.globalCompositeOperation='lighter';for(const [w,color]of[[r*.12,'#ff453d'],[Math.max(.65,r*.025),'#ffe0a3']]){c.strokeStyle=color;c.lineWidth=w;c.beginPath();c.moveTo(from.x,from.y);c.quadraticCurveTo(bx,by,x,y);c.stroke();}c.restore();return{x,y};
  }
  function sparks(c,x,y,r,age,alpha,count,seed=0){
    c.save();c.globalCompositeOperation='lighter';c.globalAlpha*=alpha;
    for(let i=0;i<count;i++){const a=i*2.399+seed,speed=.4+(i%4)*.25,d=r*(.15+age*speed),tail=r*(.04+age*.11),sx=x+Math.cos(a)*d,sy=y+Math.sin(a)*d*.7+age*age*r*.12;c.strokeStyle=i%3?'#f45343':'#ffe3a9';c.lineWidth=i%3?1:1.5;c.beginPath();c.moveTo(sx,sy);c.lineTo(sx-Math.cos(a)*tail,sy-Math.sin(a)*tail*.7);c.stroke();}c.restore();
  }
  function sigil(c,x,y,r,age,alpha,reduced){
    c.save();c.translate(x,y);c.scale(1,.28);c.globalAlpha*=alpha;c.strokeStyle='#e94559';c.lineWidth=1.3;
    for(const radius of [r,r*.76]){c.beginPath();c.ellipse(0,0,radius,radius,0,0,TAU);c.stroke();}
    for(let i=0;i<8;i++){const a=i*TAU/8+(reduced?0:age*.4);c.beginPath();c.moveTo(Math.cos(a)*r*.83,Math.sin(a)*r*.83);c.lineTo(Math.cos(a+.11)*r*.96,Math.sin(a+.11)*r*.96);c.lineTo(Math.cos(a+.22)*r*.83,Math.sin(a+.22)*r*.83);c.stroke();}c.restore();
  }
  function impact(c,target,p,r,reduced,economy,seed){
    const age=p.after,life=p.mode==='ultimate'?.85:.5,k=clamp(age/life),alpha=(1-k)*(1-k),x=target.x,y=target.aimY??target.y-r*.65;
    if(age<0||age>life)return;
    glow(c,x,y,r*(p.mode==='ultimate'?2.5:1.5),alpha*.8);
    c.save();c.globalAlpha*=alpha;
    // A tapering wound in space, with a dark core and a hot cutting edge.
    c.translate(x,y);c.rotate(p.mode==='execution'?-.14:-.45);const length=r*(1.2+ease(k)*.7);
    c.fillStyle='#190c26';c.beginPath();c.moveTo(0,-length);c.quadraticCurveTo(r*.32,-length*.22,r*.1,0);c.quadraticCurveTo(-r*.12,length*.4,0,length);c.quadraticCurveTo(-r*.32,length*.2,-r*.12,0);c.quadraticCurveTo(r*.12,-length*.5,0,-length);c.fill();
    c.globalCompositeOperation='lighter';c.strokeStyle='#ff6a53';c.lineWidth=r*.09;c.beginPath();c.moveTo(0,-length);c.quadraticCurveTo(-r*.12,0,0,length);c.stroke();c.strokeStyle='#fff0c1';c.lineWidth=Math.max(.7,r*.023);c.stroke();c.restore();
    if(!reduced){
      sparks(c,x,y,r*2,k,alpha,economy?9:p.mode==='ultimate'?26:15,seed);
      c.save();c.globalAlpha=alpha*.65;c.strokeStyle='#e75e55';c.lineWidth=1.5;c.beginPath();c.ellipse(x,target.y,r*(.3+k*2.2),r*(.1+k*.58),0,0,TAU);c.stroke();
      // Impact fragments rise from the floor, then fall back instead of orbiting.
      c.fillStyle='#311526';for(let i=0;i<(economy?4:8);i++){const sign=i%2?-1:1,dx=sign*r*(.35+k*(i%4+1)*.32),dy=-Math.sin(k*Math.PI)*r*(.2+(i%3)*.24);c.beginPath();c.moveTo(x+dx,target.y+dy);c.lineTo(x+dx+sign*r*.09,target.y+dy-r*.16);c.lineTo(x+dx+sign*r*.16,target.y+dy+r*.06);c.fill();}c.restore();
    }
  }
  // Attack-specific shapes share only glow/particle primitives. No render-time damage.
  function bladeOrigin(source,scale,direction=1){return{x:source.x+direction*16*scale,y:source.y-29*scale};}
  function cut(c,x,y,length,angle,progress,alpha,heavy=false){
    c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha*=alpha;const end=-length+2*length*ease(progress),width=heavy?5:2.4;
    c.fillStyle='#230d29';c.beginPath();c.moveTo(-length,0);c.lineTo(end,-width*2);c.lineTo(Math.min(length,end+width*5),0);c.lineTo(end,width*2);c.closePath();c.fill();
    c.globalCompositeOperation='lighter';for(const [w,color]of[[width*3,'#c8224d'],[width*1.1,'#ff745b'],[Math.max(.6,width*.28),'#fff4d6']]){const middle=(-length+end)*.5;c.fillStyle=color;c.beginPath();c.moveTo(-length,0);c.quadraticCurveTo(middle,-w,end,0);c.quadraticCurveTo(middle,w,-length,0);c.fill();}c.restore();
  }
  function executionEffect(c,p,target,scale,reduced,economy){
    if(p.after<0||p.after>1.7)return;
    const x=target.x,y=target.aimY??target.y-24*scale;
    for(let i=0;i<6;i++){
      const age=p.after-i*.25;if(age<0||age>.4)continue;
      const alpha=clamp(1-age/.4),progress=clamp(age/.075),heavy=i===5,r=scale*(heavy?42:27+i*1.4);
      const dx=(i%2?1:-1)*(i%3)*scale*3,dy=(i%3-1)*scale*4;
      glow(c,x+dx,y+dy,r*1.8,alpha*(reduced?.12:.65));
      cut(c,x+dx,y+dy,r,-.68+(i%2)*.12,reduced?1:progress,alpha,heavy);
      cut(c,x+dx,y+dy,r,.68-(i%2)*.12,reduced?1:clamp((age-.025)/.075),alpha,heavy);
      if(!reduced){sparks(c,x+dx,y+dy,r*1.3,age*3,alpha,economy?7:15,i*.7);if(heavy){c.save();c.strokeStyle='#ffd5a4';c.lineWidth=2;c.globalAlpha=alpha;c.beginPath();c.ellipse(x,target.y,r*(.5+age*4),r*(.1+age),0,0,TAU);c.stroke();c.restore();}}
    }
  }
  function nova(c,p,source,targets,scale,viewport,reduced,economy){
    const w=viewport.width,h=viewport.height,cx=w*.54,cy=h*.5,after=p.after;
    if(after<0){
      const charge=clamp(p.age/Math.max(.1,p.hit)),r=scale*(16+charge*36);sigil(c,source.x,source.y,r,p.age,.4+charge*.5,reduced);glow(c,source.x,source.y-25*scale,r*1.5,charge*.9);
      if(!reduced)for(let i=0;i<(economy?14:26);i++){const a=i*2.399,rad=(1-charge)*w*.42+14*scale,x=source.x+Math.cos(a)*rad,y=source.y-25*scale+Math.sin(a)*rad*.5;c.save();c.globalAlpha=charge*.75;c.strokeStyle=i%3?'#dd345b':'#ffdeb0';c.lineWidth=scale*.8;c.beginPath();c.moveTo(x,y);c.lineTo(mix(x,source.x,.16),mix(y,source.y-25*scale,.16));c.stroke();c.restore();}return;
    }
    if(after>1.15)return;
    const growth=ease(after/.26),fade=Math.pow(clamp(1-after/1.15),1.35),radius=Math.hypot(w,h)*.57*growth;
    c.save();
    // A single bloom crest; its light spreads across the field instead of flickering.
    c.fillStyle='#fff0d1';c.globalAlpha=(reduced?.06:.64)*Math.exp(-after*13);c.fillRect(0,0,w,h);
    glow(c,cx,cy,Math.max(1,radius*1.15),fade*(reduced?.15:.92));
    if(!reduced){
      c.globalAlpha=fade*.7;c.fillStyle='#771b42';
      for(let i=0;i<(economy?12:22);i++){const a=i*TAU/(economy?12:22)+.14,reach=radius*(.72+(i%4)*.11);c.beginPath();c.moveTo(cx+Math.cos(a-.06)*radius*.12,cy+Math.sin(a-.06)*radius*.12);c.quadraticCurveTo(cx+Math.cos(a+.12)*reach*.6,cy+Math.sin(a+.12)*reach*.6,cx+Math.cos(a)*reach,cy+Math.sin(a)*reach);c.lineTo(cx+Math.cos(a+.055)*radius*.2,cy+Math.sin(a+.055)*radius*.2);c.fill();}
      c.globalCompositeOperation='lighter';
      for(let i=0;i<(economy?12:24);i++){const a=i*TAU/(economy?12:24),inner=radius*.19,outer=radius*(.75+(i%3)*.13);c.globalAlpha=fade*(i%2?.62:.9);c.strokeStyle=i%2?'#ff4d55':'#ffe4a9';c.lineWidth=scale*(i%3?1.4:3.1);c.beginPath();c.moveTo(cx+Math.cos(a)*inner,cy+Math.sin(a)*inner);c.lineTo(cx+Math.cos(a+.035)*outer,cy+Math.sin(a+.035)*outer);c.stroke();}
      for(let i=0;i<3;i++){const r=radius*(.52+i*.19);c.globalAlpha=fade*(.65-i*.14);c.strokeStyle=i===1?'#ffe4b2':'#ff6369';c.lineWidth=scale*(4-i);c.beginPath();c.ellipse(cx,cy,r,r*(.55+i*.18),-.08,0,TAU);c.stroke();}
      c.globalAlpha=fade*.9;c.fillStyle='#fff4d6';c.beginPath();c.ellipse(cx,cy,Math.max(1,radius*.32),Math.max(1,radius*.25),0,0,TAU);c.fill();
      c.globalAlpha=fade*.64;c.fillStyle='#ffe6a5';c.beginPath();c.ellipse(cx,cy,Math.max(1,radius*.42),Math.max(1,radius*.33),0,0,TAU);c.fill();
      // Wide horizontal glare and a narrow vertical pillar make the burst legible.
      c.globalAlpha=fade*.8;c.fillStyle='#fff1d2';c.beginPath();c.moveTo(cx-radius*1.25,cy);c.lineTo(cx,cy-scale*6);c.lineTo(cx+radius*1.25,cy);c.lineTo(cx,cy+scale*6);c.fill();
      c.beginPath();c.moveTo(cx,cy-radius*.95);c.lineTo(cx+scale*3,cy);c.lineTo(cx,cy+radius*.95);c.lineTo(cx-scale*3,cy);c.fill();
      sparks(c,cx,cy,radius*.95,after*1.2,fade,economy?20:42,.1);
    }
    c.restore();
    for(let i=0;i<targets.length;i++){
      const target=targets[i],x=target.x,y=target.aimY??target.y-24*scale,local=clamp(after/.65),a=clamp(1-after/.8);
      glow(c,x,y,scale*(28+local*24),a*.9);
      if(!reduced){sparks(c,x,y,scale*45,local,a,economy?9:18,i*.8);c.save();c.globalCompositeOperation='lighter';c.globalAlpha=a*.8;c.strokeStyle='#ffbe83';c.lineWidth=scale*1.6;c.beginPath();c.ellipse(x,target.y,scale*(14+local*40),scale*(4+local*12),0,0,TAU);c.stroke();c.restore();}
    }
  }
  function effects(c,{unit,time,source,targets=[],scale=1.8,reduced=false,economy=false,viewport={width:480,height:280}}){
    const p=phase(unit,time);if(!p||!source||![source.x,source.y].every(Number.isFinite))return;
    const ids=unit.hyeokjin?.cast?.targets,count=p.mode==='execution'?1:p.mode==='ultimate'?30:3;
    const victims=targets.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&(!v.id||!ids?.length||ids.includes(v.id))).slice(0,count),main=victims[0];
    const direction=main&&main.x<source.x?-1:1,from=bladeOrigin(source,scale,direction);c.save();
    if(p.mode==='transform'){
      const q=clamp(p.age),a=Math.sin(q*Math.PI);glow(c,source.x,source.y-24*scale,scale*(28+q*18),a*.9);sigil(c,source.x,source.y,scale*(17+q*18),p.age,a,reduced);
      if(!reduced){for(let i=0;i<(economy?3:6);i++){const theta=i*TAU/6+p.age*2,r=scale*(21-q*10);c.strokeStyle=i%2?'#ec244d':'#80214c';c.lineWidth=scale*(1+i%2);c.globalAlpha=a*.85;c.beginPath();c.moveTo(source.x+Math.cos(theta)*r,source.y);c.bezierCurveTo(from.x-r,from.y-10*scale,from.x+r,from.y-26*scale,from.x+Math.cos(theta+q)*r*.4,from.y-37*scale);c.stroke();}sparks(c,from.x,from.y,scale*55,q,a,economy?8:16);}c.restore();return;
    }
    if(!main){c.restore();return;}
    if(p.mode==='ultimate'){nova(c,p,source,victims,scale,viewport,reduced,economy);c.restore();return;}
    if(p.mode==='execution'){
      if(p.after<0){const charge=clamp(p.age/Math.max(.1,p.hit));glow(c,from.x,from.y,scale*(8+charge*14),charge*.7);}
      executionEffect(c,p,main,scale,reduced,economy);c.restore();return;
    }
    const black=p.mode==='black',basic=p.mode==='basic',to={x:main.x,y:main.aimY??main.y-24*scale},angle=Math.atan2(to.y-from.y,to.x-from.x);
    const radius=scale*(black?68:basic?10:22),progress=p.flight;
    if(p.age<p.launch){const charge=clamp(p.age/Math.max(.1,p.launch));glow(c,from.x,from.y,scale*(black?25:8)*charge,charge*.6);if(black){const r=radius*(.08+.12*charge);crescent(c,from.x,from.y,r,angle,.65*charge,1.5);}}
    if(p.age>=p.launch&&p.after<.15){
      const fade=p.after>0?1-p.after/.15:1;
      if(black){
        // The blade unfolds from its cutting edge before detaching and expanding.
        const unfold=ease(progress),r=radius*(.12+.88*unfold),x=mix(from.x,to.x,progress),y=mix(from.y,to.y,progress);
        if(!reduced){ribbon(c,from,to,progress,r,.58*fade);for(let i=economy?2:4;i>0;i--){const lag=clamp(progress-i*.045);crescent(c,mix(from.x,to.x,lag),mix(from.y,to.y,lag),radius*(.12+.88*ease(lag)),angle,fade*.12,1);}glow(c,x,y,r*1.5,fade*.7);}
        crescent(c,x,y,r,angle,fade,2);if(!reduced)sparks(c,x,y,r*.8,progress,fade*.65,economy?5:10);
      }else{
        // One small projectile on a normal attack, regardless of its cleave damage.
        const x=mix(from.x,to.x,progress),y=mix(from.y,to.y,progress);
        if(!reduced){ribbon(c,from,to,progress,radius,.55*fade);glow(c,x,y,radius*1.8,fade*.6);}
        crescent(c,x,y,radius,angle,fade,1);
      }
    }
    if(p.after>=0)for(let i=0;i<victims.length;i++)impact(c,victims[i],p,scale*(black?29:basic?9:18)*(i?.65:1),reduced,economy,i*.8);
    if(p.mode==='recovery'&&p.after>=0&&p.after<.55){const q=clamp(p.after/.55),x=mix(to.x,source.x,ease(q)),y=mix(to.y,source.y-23*scale,ease(q))-Math.sin(q*Math.PI)*28*scale;glow(c,x,y,scale*13,(1-q)*.9);if(!reduced)sparks(c,x,y,scale*17,q,1-q,7);}
    c.restore();
  }
  return Object.freeze({ready,hero,frame,pose,phase,field,shake,effects,DATA});
})();
