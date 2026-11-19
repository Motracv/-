/* Horas: 방과 후의 성좌. Appearance only; never changes combat state or clocks. */
window.SchoolHorasSkinArt = (() => {
  'use strict';
  const ID = 'horas_after_school';
  const ASSETS = Object.freeze({
    combat: 'school/assets/horas-after-school/combat.webp?v=horas-skin1',
    portrait: 'school/assets/horas-after-school/portrait.webp?v=horas-skin1',
    cutin: 'school/assets/horas-after-school/cutin.webp?v=horas-skin1',
    metadata: 'school/assets/horas-after-school/combat.json?v=horas-skin1'
  });
  const TAU = Math.PI * 2, UNIT = 44 / 311, FLOOR = 3, BLEND = .065;
  const TIMING = Object.freeze({ basic: 1.18, release: .18, impact: 1.5, cast: 2.45 });
  const PINK = '#ff9bd8', CYAN = '#69e8f4', WHITE = '#fff4fd';
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = p => { p = clamp(p); return p * p * (3 - 2 * p); };
  const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const active = skin => loaded && (skin === ID || skin?.id === ID);
  // Source x/y/w/h, foot x/y relative to that cell. One shared scale keeps
  // head/body size unchanged through the authored poses. Frame 11 is a wink.
  const FRAMES = Object.freeze([
    [0, 0, 384, 341, 215, 316], [384, 0, 384, 341, 206.5, 316],
    [768, 0, 384, 341, 212.5, 316], [1152, 0, 384, 341, 213, 316],
    [0, 341, 384, 342, 208, 317], [384, 341, 384, 342, 212, 317],
    [768, 341, 384, 342, 214, 317], [1152, 341, 384, 342, 211.5, 317],
    [0, 683, 384, 341, 212.5, 318], [384, 683, 384, 341, 208.5, 318],
    [768, 683, 384, 341, 206, 318], [1152, 683, 384, 341, 204.5, 317]
  ].map(Object.freeze));
  const BASIC_A = Object.freeze([[0, 1], [.18, 2], [.34, 3], [.91, 0]]);
  const BASIC_B = Object.freeze([[0, 4], [.18, 5], [.34, 6], [.91, 0]]);
  const CAST = Object.freeze([[0, 7], [.28, 8], [.82, 9], [1.38, 10], [1.9, 11], [2.27, 0]]);
  const ORBS = Object.freeze([[-21, -27], [-22, -40], [-9, -49], [8, -51], [22, -43]].map(Object.freeze));
  const HANDS = Object.freeze([[262,190],[240,142],[303,120],[287,183],[271,191],[285,73],
    [282,143],[247,117],[248,121],[300,116],[301,111],[250,127]].map(Object.freeze));
  const atlas = new Image(), poses = new Map();
  let loaded = false, posePixels = 0, portraitCanvas = null, cutinCanvas = null;
  let portraitURL = null, cutinURL = null;
  const ready = new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 7000);
    atlas.onload = () => {
      loaded = atlas.naturalWidth === 1536 && atlas.naturalHeight === 1024;
      clearTimeout(timer); resolve(loaded);
      if (loaded) window.dispatchEvent(new Event('school-art-ready'));
    };
    atlas.onerror = () => { clearTimeout(timer); resolve(false); };
    atlas.src = ASSETS.combat;
  });

  function blocked(frame) { return !!(frame.dead || frame.frozen || frame.stunned || frame.horasActive === false); }
  function phase(frame = {}) {
    const none = { mode: 'idle', age: 0, pose: 0, previous: 0, blend: 1 };
    if (blocked(frame) || frame.reduced) return none;
    const cast = finite(frame.horasCastAge, -1), attack = finite(frame.attackAge, -1);
    const mode = cast >= 0 && cast < TIMING.cast ? 'cast'
      : attack >= 0 && attack < TIMING.basic ? (frame.horasBasicPose === 2 ? 'basicB' : 'basicA') : 'idle';
    if (mode === 'idle') return none;
    const age = mode === 'cast' ? cast : attack, track = mode === 'cast' ? CAST : mode === 'basicB' ? BASIC_B : BASIC_A;
    let index = 0;
    for (let i = 1; i < track.length && age >= track[i][0]; i++) index = i;
    // The blend is short enough to preserve a clear contact pose; no queued
    // tweens, timers, or replay of old poses after reconnect are involved.
    return { mode, age, pose: track[index][1], previous: index ? track[index - 1][1] : 0,
      blend: ease((age - track[index][0]) / BLEND) };
  }

  function motion(frame = {}) {
    const p = phase(frame), still = { ...p, x: 0, y: 0, lean: 0, sx: 1, sy: 1, trail: 0 };
    if (blocked(frame) || frame.reduced) return still;
    if (p.mode === 'idle') return { ...still, x: frame.hit ? -1.2 : 0,
      sy: frame.hit ? 1 : 1 + Math.sin(finite(frame.time) * 2.7) * .004 };
    const a = p.age, second = p.mode === 'basicB';
    const track = p.mode === 'cast'
      ? [[0,0,0,0,1,1],[.28,-3,2,-.075,1.035,.955],[.82,-1,-5,-.025,1,1.025],
        [1.38,1.5,-10,-.04,1,1.035],[1.5,7,-1,.14,1.035,.955],[1.565,7,-1,.14,1.035,.955],
        [1.9,3,0,0,1,1],[2.45,0,0,0,1,1]]
      : [[0,0,0,0,1,1],[.18,-2.6,1.1,-.07,.975,.975],
        [.34,second?3.5:6,second?-3.5:-.8,second?-.065:.1,1,1],[1.18,0,0,0,1,1]];
    let i = 0; while (i + 1 < track.length - 1 && a > track[i + 1][0]) i++;
    const from = track[i], to = track[i + 1], t = ease((a - from[0]) / (to[0] - from[0]));
    return { ...still, x: mix(from[1],to[1],t), y: mix(from[2],to[2],t), lean: mix(from[3],to[3],t),
      sx: mix(from[4],to[4],t), sy: mix(from[5],to[5],t), trail: 0 };
  }

  function poseSource(index, density) {
    const resolution = density > 2 ? 4 : 2, key = index + ':' + resolution;
    if (poses.has(key)) return poses.get(key);
    const f = FRAMES[index], canvas = document.createElement('canvas');
    canvas.width = Math.ceil(f[2] * UNIT * resolution); canvas.height = Math.ceil(f[3] * UNIT * resolution);
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
    c.drawImage(atlas, f[0], f[1], f[2], f[3], 0, 0, canvas.width, canvas.height);
    const pixels = canvas.width * canvas.height;
    while (poses.size && posePixels + pixels > 1024 * 1024) {
      const oldKey = poses.keys().next().value, old = poses.get(oldKey);
      posePixels -= old.width * old.height; poses.delete(oldKey);
    }
    poses.set(key, canvas); posePixels += pixels; return canvas;
  }
  function hand(frame = {}, suppliedMotion) {
    const p=phase(frame),m=motion(frame);
    if(suppliedMotion&&!blocked(frame)&&!frame.reduced){for(const key of ['x','y','lean','sx','sy'])m[key]=finite(suppliedMotion[key],m[key]);}
    const a=FRAMES[p.previous],b=FRAMES[p.pose],ha=HANDS[p.previous],hb=HANDS[p.pose];
    const x=mix((ha[0]-a[4])*UNIT,(hb[0]-b[4])*UNIT,p.blend)*m.sx;
    const y=mix(FLOOR+(ha[1]-a[5])*UNIT,FLOOR+(hb[1]-b[5])*UNIT,p.blend)*m.sy;
    return {x:m.x+x*Math.cos(m.lean)-y*Math.sin(m.lean),y:m.y+x*Math.sin(m.lean)+y*Math.cos(m.lean)};
  }
  function drawPose(c, index, density, alpha) {
    if (alpha <= 0) return;
    const f = FRAMES[index]; c.save(); c.globalAlpha *= alpha;
    c.drawImage(poseSource(index, density), -f[4] * UNIT, FLOOR - f[5] * UNIT, f[2] * UNIT, f[3] * UNIT);
    c.restore();
  }
  function star(c, x, y, r, color) {
    c.fillStyle = color; c.beginPath(); c.moveTo(x, y-r); c.lineTo(x+r*.25,y-r*.25);
    c.lineTo(x+r,y); c.lineTo(x+r*.25,y+r*.25); c.lineTo(x,y+r);
    c.lineTo(x-r*.25,y+r*.25); c.lineTo(x-r,y); c.lineTo(x-r*.25,y-r*.25); c.closePath(); c.fill();
  }
  function bloom(c, x, y, r, rotation = 0, detail = true) {
    c.save(); c.translate(x,y); c.rotate(rotation); c.lineWidth = Math.max(.45,r*.023);
    for (let i = 0; i < 5; i++) {
      c.save(); c.rotate(i*TAU/5); c.fillStyle='#ff9bd899'; c.strokeStyle='#ffd8f2';
      c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-r*.7,-r*.62,0,-r);
      c.quadraticCurveTo(r*.7,-r*.62,0,0);c.fill();c.stroke();
      if(detail){c.fillStyle='#fff4ff99';c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-r*.16,-r*.4,0,-r*.72);c.quadraticCurveTo(r*.16,-r*.4,0,0);c.fill();}
      c.restore();
    }
    c.fillStyle=CYAN;c.fillRect(-r*.13,-r*.13,r*.26,r*.26);
    c.fillStyle=WHITE;c.fillRect(-r*.055,-r*.055,r*.11,r*.11);c.restore();
  }
  function glowLine(c, path, width = 1, economy = false) {
    const layers = economy ? [[width*2,.25,PINK],[width,.9,CYAN]]
      : [[width*5,.10,PINK],[width*2,.28,CYAN],[width,.95,CYAN],[Math.max(.45,width*.28),.95,WHITE]];
    for (const [w,a,color] of layers) { c.save();c.globalAlpha*=a;c.strokeStyle=color;c.lineWidth=w;c.lineCap='round';c.beginPath();path();c.stroke();c.restore(); }
  }
  function emote(c, x, y, age, kind, reduced) {
    if(age<0||age>=1.1)return;
    const fade=clamp((1.1-age)/.22),pop=reduced?1:age<.16?mix(.7,1.06,ease(age/.16)):mix(1.06,1,ease((age-.16)/.15));
    c.save();c.translate(x,y-(reduced?0:Math.min(1.7,age*2)));c.scale(.22*pop,.22*pop);c.globalAlpha*=fade;
    c.fillStyle='#4c2d60';c.fillRect(-29,-23,58,42);c.fillRect(-33,-19,66,34);c.fillRect(-7,18,10,8);
    c.fillStyle='#fff1fc';c.fillRect(-28,-21,56,37);c.fillRect(-31,-17,62,29);c.fillRect(-6,16,7,7);
    c.fillStyle='#df75ba';c.fillRect(-16,-15,7,11);c.fillRect(9,-15,7,11);c.fillRect(-18,-5,36,20);c.fillRect(-13,-11,26,26);
    c.fillStyle='#ffb8dc';c.fillRect(-12,-4,24,17);c.fillRect(-8,-7,16,20);
    c.fillStyle='#64265c';c.fillRect(-9,0,3,4);
    if(kind==='wink'){c.fillRect(5,0,6,2);c.fillRect(8,2,3,2);}else c.fillRect(6,0,3,4);
    c.fillRect(-2,5,4,2);c.fillRect(-6,9,4,2);c.fillRect(2,9,4,2);
    c.fillStyle='#ff5e9e';c.fillRect(-14,6,4,2);c.fillRect(10,6,4,2);
    if(kind==='heart'){c.fillStyle='#f565a8';c.fillRect(20,-21,4,8);c.fillRect(25,-21,4,8);c.fillRect(22,-13,5,4);}
    else if(kind==='star'){star(c,24,-16,7,CYAN);star(c,-28,-21,5,PINK);}
    c.restore();
  }

  function hero(c, x, y, scale = 1, frame = {}, suppliedMotion) {
    if(!loaded||!active(frame.skin)||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(scale)||scale<=0)return false;
    const p=phase(frame),m=motion(frame),isBlocked=blocked(frame),reduced=!!frame.reduced;
    if(suppliedMotion&&!isBlocked&&!reduced){for(const key of ['x','y','lean','sx','sy'])m[key]=finite(suppliedMotion[key],m[key]);}
    const cast=p.mode==='cast',t=finite(frame.time),merge=cast?ease((p.age-.22)/.63):0;
    const stacks=frame.dead?0:cast&&p.age<1?5:clamp(Math.floor(finite(frame.horasStacks)),0,5);
    c.save();c.translate(x,y);c.scale(scale*(frame.flip?-1:1),scale);c.imageSmoothingEnabled=false;
    c.fillStyle='#060e273a';c.fillRect(-9,1+finite(frame.shadowY),20,2);
    if(frame.dead){c.globalAlpha*=.4;c.rotate(-Math.PI/2);}
    if(!isBlocked&&stacks>0&&(!cast||p.age<1)){
      const points=ORBS.slice(0,stacks).map(([ox,oy],i)=>[mix(ox,11,merge),mix(oy,-27,merge)+(reduced||cast?0:Math.sin(t*2+i)*.65)]);
      c.save();c.globalAlpha*=.72;c.strokeStyle=CYAN;c.lineWidth=.4;c.beginPath();
      points.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.stroke();
      points.forEach(([px,py],i)=>bloom(c,px,py,cast?3:2.5,reduced?0:t*.2+i,!frame.economy));c.restore();
    }
    c.save();c.translate(m.x,m.y);c.rotate(m.lean);c.scale(m.sx,m.sy);
    const transform=c.getTransform(),density=Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d));
    if(p.blend<1&&p.previous!==p.pose)drawPose(c,p.previous,density,1-p.blend);
    drawPose(c,p.pose,density,p.blend<1&&p.previous!==p.pose?p.blend:1);c.restore();
    if(!isBlocked&&cast&&p.age<1.48){
      const coreY=-27-clamp((p.age-.92)/.56)*18;
      c.save();c.globalAlpha*=clamp(p.age/.15)*(.45+merge*.5);bloom(c,11+m.x,coreY+m.y,2+merge*4,reduced?0:p.age*.7,!frame.economy);c.restore();
    }
    if(!isBlocked&&!reduced){
      if(cast)emote(c,17,-47,p.age-1.95,'star',false);
      else if(p.mode==='basicA'||p.mode==='basicB')emote(c,17,-47,p.age-.28,p.mode==='basicB'?'heart':'wink',false);
    }
    c.restore();return true;
  }

  function sourceCanvas(kind) {
    if(!loaded)return null;
    if(kind==='cutin'&&cutinCanvas)return cutinCanvas;
    if(kind==='portrait'&&portraitCanvas)return portraitCanvas;
    const crop=kind==='cutin'?[431,692,267,309]:[106,5,166,311];
    const canvas=document.createElement('canvas');canvas.width=crop[2];canvas.height=crop[3];
    const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(atlas,...crop,0,0,canvas.width,canvas.height);
    if(kind==='cutin')cutinCanvas=canvas;else portraitCanvas=canvas;
    return canvas;
  }
  function portrait(){if(!loaded)return '';return portraitURL||(portraitURL=sourceCanvas('portrait').toDataURL());}
  function cutin(){if(!loaded)return '';return cutinURL||(cutinURL=sourceCanvas('cutin').toDataURL());}

  function effects(c, opt = {}) {
    const source=opt.source,age=finite(opt.age,-1),kind=String(opt.kind||'').replace(/^horas-/,''),reduced=!!opt.reduced,economy=!!opt.economy;
    if(!point(source)||age<0||opt.dead||opt.frozen||opt.stunned||opt.active===false)return false;
    if(!['basic','cast','impact','fusion','emote'].includes(kind))return false;
    if(age>=(kind==='basic'?.9:kind==='cast'?1.5:kind==='impact'?1.2:kind==='emote'?1.1:1.5))return false;
    const targets=(Array.isArray(opt.targets)?opt.targets:opt.target?[opt.target]:[]).filter(point).slice(0,economy?4:8);
    const target=targets[0],scale=clamp(finite(opt.scale,1),.4,3),dir=opt.flip?-1:1;
    if(['basic','cast','impact'].includes(kind)&&!target)return false;
    c.save();
    if(kind==='basic'){
      if(age<.18){c.restore();return true;}
      const second=opt.pose===2,t=clamp((age-.18)/.4),fade=clamp((.9-age)/.25);
      const actorScale=clamp(finite(opt.actorScale,scale),.4,12),origin=hand({attackAge:age,horasBasicPose:opt.pose,reduced},opt.actorMotion);
      const sx=source.x+origin.x*actorScale*dir,sy=source.y+origin.y*actorScale,tx=target.x,ty=finite(target.aimY,target.y-29*scale);
      const bend=(second?-23:13)*scale,controlX=(sx+tx)*.5,controlY=(sy+ty)*.5+bend;
      c.globalAlpha*=fade;
      const end=t,start=Math.max(0,t-.32),at=u=>[(1-u)*(1-u)*sx+2*(1-u)*u*controlX+u*u*tx,(1-u)*(1-u)*sy+2*(1-u)*u*controlY+u*u*ty];
      glowLine(c,()=>{const a=at(start);c.moveTo(...a);for(let n=1;n<=10;n++)c.lineTo(...at(mix(start,end,n/10)));},(reduced?.9:1.7)*scale,economy||reduced);
      const endPoint=at(t);star(c,endPoint[0],endPoint[1],(reduced?2.8:4)*scale,WHITE);
      if(!reduced)for(let i=0;i<(economy?3:7);i++){const u=clamp(t-i*.045),pos=at(u);star(c,pos[0],pos[1]+Math.sin(age*8+i)*2*scale,(1.3-i*.1)*scale,i%2?CYAN:PINK);}
      if(t>=1&&!opt.missed){c.save();c.globalAlpha*=clamp((.9-age)/.32);bloom(c,tx,ty,(6+(age-.58)*16)*scale,age,!economy);c.restore();}
    }else if(kind==='cast'){
      const rise=clamp((age-.82)/.5),skyY=Math.max(30*scale,target.y-141*scale),radius=(30+rise*34)*scale;
      c.globalAlpha*=clamp(age*5);c.strokeStyle=CYAN;c.lineWidth=.8*scale;c.beginPath();c.ellipse(target.x,target.y,(20+rise*14)*scale,(5+rise*4)*scale,0,0,TAU);c.stroke();
      if(age>.82){c.save();c.globalAlpha*=clamp((age-.82)/.18)*.8;bloom(c,target.x,skyY,radius*.75,reduced?0:age*.12,!economy);c.restore();
        if(!reduced){c.strokeStyle='#69e8f480';c.lineWidth=.6*scale;c.beginPath();for(let i=0;i<=5;i++){const a=-Math.PI/2+i*TAU*2/5,x=target.x+Math.cos(a)*radius,y=skyY+Math.sin(a)*radius*.55;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}}
    }else if(kind==='impact'){
      const tx=target.x+(opt.missed?36*scale*dir:0),ty=target.y,skyY=Math.max(30*scale,ty-141*scale),fade=1-clamp((age-.55)/.65);
      c.globalAlpha*=fade;
      bloom(c,tx,skyY,(reduced?37:39+ease(age/.18)*16)*scale,reduced?0:(age+1.5)*.12,!economy);
      glowLine(c,()=>c.ellipse(tx,skyY,66*scale,18*scale,reduced?0:-age*.4,0,TAU),1*scale,economy||reduced);
      if(age<.75){const strength=clamp((.75-age)/.25);for(const [w,a,col] of [[52,.08,PINK],[29,.20,CYAN],[12,.65,CYAN],[4,.94,WHITE]]){
        c.save();c.globalAlpha*=strength*a*(reduced?.55:1)*(opt.missed?.55:1);c.fillStyle=col;c.fillRect(tx-w*scale/2,skyY,w*scale,Math.max(0,ty-skyY));c.restore();}}
      if(!opt.missed){
        bloom(c,tx,finite(target.aimY,ty-24*scale),(reduced?17:8+ease(age/.28)*22)*scale,reduced?0:age*.3,!economy);
        for(let n=0;n<(reduced?1:3);n++){const progress=clamp((age-n*.12)/.8);if(progress<=0)continue;c.save();c.globalAlpha*=1-progress;
          glowLine(c,()=>c.ellipse(tx,ty,(11+progress*70)*scale,(3+progress*16)*scale,0,0,TAU),1.1*scale,true);c.restore();}
        if(!reduced)for(let i=0;i<(economy?8:20);i++){const a=i*2.399,reach=(13+age*48+i%4*4)*scale;star(c,tx+Math.cos(a)*reach,ty-8*scale+Math.sin(a)*reach*.35-age*15*scale,(1.1+i%3)*scale,i%2?PINK:CYAN);}
        for(let i=1;i<targets.length;i++){const q=targets[i];c.save();c.globalAlpha*=.5;bloom(c,q.x,finite(q.aimY,q.y-24*scale),(6+age*6)*scale,0,false);c.restore();}
      }
    }else if(kind==='fusion'){
      c.save();c.translate(source.x,source.y);c.scale(scale*dir,scale);const gather=ease(age/.85);
      for(let i=0;i<5;i++){const p=ORBS[i];bloom(c,mix(p[0],11,gather),mix(p[1],-27,gather),2.4,reduced?0:age+i,!economy);}
      bloom(c,11,-27,2+gather*4,reduced?0:age*.6,!economy);c.restore();
    }else{c.save();c.translate(source.x,source.y);c.scale(scale*dir,scale);emote(c,17,-47,age,opt.emote||'wink',reduced);c.restore();}
    c.restore();return true;
  }
  return Object.freeze({ ID, ASSETS, ready, active, hero, draw:hero, effects, phase, motion, hand, frames:FRAMES,
    timing:TIMING, unit:UNIT, portrait, cutin, portraitSource:()=>sourceCanvas('portrait'), cutinSource:()=>sourceCanvas('cutin'),
    assetsReady:()=>loaded, cacheInfo:()=>Object.freeze({poses:poses.size,pixels:posePixels,maxPixels:1024*1024}) });
})();
