/* Kazua presentation only. All damage, timing and target selection stay in the engine. */
window.SchoolKazuaArt = (() => {
  'use strict';

  const ASSETS = Object.freeze({
    combat: 'school/assets/kazua/combat.webp?v=kazua1',
    basic: 'school/assets/kazua/basic-motion.webp?v=kazua-motion1',
    portrait: 'school/assets/kazua/portrait.webp?v=kazua1',
    pickup: 'school/assets/kazua/pickup.webp?v=kazua1'
  });
  const atlas = new Image(), basicAtlas = new Image(), illustrationImage = new Image();
  let atlasLoaded = false, basicLoaded = false, illustrationLoaded = false, portraitCache = null;
  const TAU = Math.PI * 2, UNIT = 48 / 318;
  const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
  const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
  const fract = n => n - Math.floor(n), ease = n => { const p=clamp(n);return p*p*(3-2*p); };
  const FIRE_START = .12, HIP = -12;

  // [source x, source y, width, height, foot anchor x relative to crop].
  // Every source uses the same pixel-to-world ratio; leaning does not resize the gun.
  // Feet were measured individually because the source atlas has generous cell margins.
  const FRAMES = Object.freeze([
    [24, 180, 275, 318, 141],
    [328, 225, 289, 272, 141],
    [645, 202, 287, 295, 132],
    [962, 202, 269, 296, 141],
    [20, 781, 292, 266, 133],
    [340, 783, 269, 263, 134],
    [641, 783, 287, 263, 136],
    [957, 806, 276, 240, 142]
  ].map(frame => Object.freeze(frame)));

  // Measured anchors from basic-motion.json; one shared scale, never resized per pose.
  // [crop x,y,w,h, foot x,y, muzzle x,y, barrel-face x,y].
  const BASIC_UNIT = 48 / 382;
  const BASIC_FRAMES = Object.freeze([[14,96,351,382,173,381,350,242,331,242],[395,117,353,361,176,360,353,219,334,219],[786,103,347,375,169,374,346,230,327,230],[1167,116,349,362,172,361,349,220,330,220],[16,596,349,362,171,361,348,225,329,225],[393,598,357,360,178,359,357,222,336,222],[778,595,355,363,177,362,354,226,335,226],[1160,598,356,360,179,359,356,222,337,222]].map(Object.freeze));

  function load(image, path, done) {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), 7000);
      image.onload = () => {
        done();
        portraitCache = null;
        clearTimeout(timer);
        resolve(true);
        window.dispatchEvent(new Event('school-art-ready'));
      };
      image.onerror = () => { clearTimeout(timer); resolve(false); };
      image.src = path;
    });
  }
  const ready = Promise.all([
    load(atlas, ASSETS.combat, () => { atlasLoaded = true; }),
    load(basicAtlas, ASSETS.basic, () => { basicLoaded = true; }),
    load(illustrationImage, ASSETS.portrait, () => { illustrationLoaded = true; })
  ]);

  function modeFor(frame = {}) {
    if (frame.dead || frame.frozen || frame.stunned || frame.kazuaActive === false) return 'idle';
    let mode = frame.kazuaMode || frame.mode || frame.motion?.mode;
    if (mode === 'ultimate' || mode === 'red-bullets') mode = 'red';
    if (mode === 'attack' || mode === 'firing') mode = 'fire';
    if (['idle', 'fire', 'reload', 'pistol', 'bazooka', 'red', 'dodge'].includes(mode)) return mode;
    if (frame.casting) return 'red';
    if (frame.attack || Number.isFinite(frame.attackAge) && frame.attackAge >= 0 && frame.attackAge < .8) return 'fire';
    return 'idle';
  }

  function motion(mode, age = 0, reduced = false) {
    age = Math.max(0, finite(age));
    const firing = mode === 'fire' || mode === 'red', cycle=fract(Math.max(0,age-FIRE_START)*20);
    // Fast attack / damped return, shared with the muzzle. Only the upper body
    // absorbs recoil; the boots do not slide across the floor with every shot.
    const impulse = reduced || !firing ? 0 : Math.exp(-cycle*7)*(1-Math.exp(-cycle*36))*ease(age/.18);
    const pose = mode === 'fire' ? 1
      : mode === 'reload' ? 3 : mode === 'pistol' ? 4
      : mode === 'bazooka' ? 5 : mode === 'red' ? 6 : mode === 'dodge' ? 7 : 0;
    const kick = reduced ? 0 : mode === 'pistol' ? -Math.sin(clamp(age / .3) * Math.PI) * 1.3
      : mode === 'bazooka' ? -Math.sin(clamp(age / .45) * Math.PI) * 1.4
      : mode === 'dodge' ? -Math.sin(clamp(age / .6) * Math.PI) * 4 : 0;
    const basicPose=mode==='fire'?(reduced?2:age<.06?0:age<FIRE_START?1:[2,3,4,3][Math.floor((age-FIRE_START)*7)%4])
      :mode==='reload'?(reduced?6:age<.2?4:age<.65?5:age<1.3?6:age<1.8?7:1):mode==='idle'?0:-1;
    return { mode, age, pose, basicPose, dx: kick, dy: 0, reduced,
      lean:impulse*(mode==='red'?.06:.045), compression:-impulse*.012, recoil:impulse };
  }

  function drawPose(c, pose) {
    const f = FRAMES[clamp(Math.trunc(pose), 0, FRAMES.length - 1)];
    c.drawImage(atlas, f[0], f[1], f[2], f[3], -f[4] * UNIT, -f[3] * UNIT, f[2] * UNIT, f[3] * UNIT);
  }

  function actorSource(move){
    if(basicLoaded&&move.basicPose>=0){const f=BASIC_FRAMES[move.basicPose];return {image:basicAtlas,x:f[0],y:f[1],width:f[2],height:f[3],footX:f[4],footY:f[5],unit:BASIC_UNIT};}
    const f=FRAMES[move.pose];
    return {image:atlas,x:f[0],y:f[1],width:f[2],height:f[3],footX:f[4],footY:f[3],unit:UNIT};
  }
  function drawActor(c,move){
    const f=actorSource(move),cut=Math.round(f.footY+HIP/f.unit);
    const slice=(from,to)=>c.drawImage(f.image,f.x,f.y+from,f.width,to-from,-f.footX*f.unit,(from-f.footY)*f.unit,f.width*f.unit,(to-from)*f.unit);
    if(!move.lean&&!move.compression){slice(0,f.height);return;}
    slice(cut,f.height);
    c.save();c.translate(0,HIP);c.transform(1,0,move.lean,1+move.compression,0,0);c.translate(0,-HIP);
    slice(0,cut+1);c.restore();
  }

  function barrel(c,move){
    if(!['fire','red'].includes(move.mode)||move.age<FIRE_START)return;
    const p=muzzle(move.mode,move.age,move.reduced),spin=move.reduced?0:move.age*TAU*12;
    const f=basicLoaded&&move.basicPose>=0?BASIC_FRAMES[move.basicPose]:null;
    const ox=f?(f[8]-f[6])*BASIC_UNIT:-.5,oy=f?(f[9]-f[7])*BASIC_UNIT:0,rx=f?1.7:.9,ry=f?3.25:2.7;
    c.save();c.translate(p.x-move.dx+ox+move.lean*oy,p.y-move.dy+oy*(1+move.compression));
    // Rotating bores and hot rims are attached to the muzzle, not the screen.
    c.fillStyle='#26232c';c.beginPath();c.ellipse(0,0,rx,ry,0,0,TAU);c.fill();
    for(let i=0;i<6;i++){
      const a=spin+i*TAU/6,x=Math.cos(a)*rx*.73,y=Math.sin(a)*ry*.78;
      c.fillStyle=move.mode==='red'?'#ff7882':'#bea17c';c.fillRect(x-.25,y-.45,.65,.9);
      c.fillStyle='#151623';c.fillRect(x-.16,y-.28,.3,.56);
    }
    c.restore();
  }

  function fallback(c) {
    c.fillStyle = '#242331'; c.fillRect(-7, -28, 15, 26);
    c.fillStyle = '#171a25'; c.fillRect(-9, -3, 9, 3); c.fillRect(4, -3, 10, 3);
    c.fillStyle = '#f0bd9f'; c.fillRect(-5, -40, 13, 13);
    c.fillStyle = '#9c2634'; c.fillRect(-8, -46, 18, 10); c.fillRect(-9, -38, 6, 8);
    c.fillStyle = '#e8dce0'; c.fillRect(-4, -27, 7, 9);
    c.fillStyle = '#363743'; c.fillRect(-1, -23, 21, 9);
    c.fillStyle = '#9b95a3'; c.fillRect(11, -22, 12, 2); c.fillRect(11, -17, 12, 2);
    c.fillStyle = '#bb9252'; c.fillRect(-1, -21, 3, 9);
  }

  function survivorAura(c, time, strength, reduced) {
    c.save();
    c.globalAlpha *= .3 + strength * .3;
    c.strokeStyle = '#ff5277'; c.lineWidth = .7;
    c.beginPath(); c.ellipse(0, -1, 15 + strength * 3, 3.4, 0, 0, TAU); c.stroke();
    const count = reduced ? 3 : 8;
    for (let i = 0; i < count; i++) {
      const phase = reduced ? (i + 1) / 4 : (time * .55 + i * .137) % 1;
      const x = Math.sin(i * 2.4) * (10 + phase * 5), y = -4 - phase * 44;
      c.fillStyle = i % 2 ? '#ff4b70' : '#ffd3d8';
      c.fillRect(x, y, .8, reduced ? 1.5 : 1.5 + phase * 2);
    }
    c.restore();
  }

  /** Foot-anchored actor. The main SchoolArt wrapper supplies ordinary idle breathing. */
  function hero(c, x, y, scale = 2, frame = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale) || scale <= 0) return;
    const mode = modeFor(frame), time = finite(frame.time), reduced = !!(frame.reduced || frame.dead || frame.frozen || frame.stunned);
    const age = finite(frame.kazuaAge, finite(frame.motion?.age, finite(frame.attackAge, time)));
    const move = motion(mode, age, reduced), lastStand = clamp(finite(frame.kazuaLastStand, finite(frame.lastStand)));
    c.save(); c.translate(x, y); c.scale(scale * (frame.flip ? -1 : 1), scale);
    c.imageSmoothingEnabled = false;
    if (frame.dead) { c.globalAlpha *= .4; c.transform(1, 0, -.22, .7, 0, 0); }
    if (lastStand > 0 && !frame.dead) survivorAura(c, time, lastStand, reduced);
    // Standalone previews can opt in. Avoid stacking with SchoolArt's shared breath.
    if (frame.breathe && mode === 'idle' && !reduced) {
      const breath = (Math.sin(time * 1.7 + .4) + 1) * .5;
      c.scale(1 + breath * .006, 1 + breath * .017);
    }
    c.translate(move.dx, move.dy);
    if (mode === 'dodge' && !reduced && age < .35 && atlasLoaded) {
      c.save(); c.globalAlpha *= .16 * (1 - age / .35); c.translate(6, 0); drawPose(c, 0); c.restore();
    }
    if (atlasLoaded || basicLoaded && move.basicPose>=0) {drawActor(c,move);barrel(c,move);} else fallback(c);

    c.restore();
  }

  function portrait() {
    if (portraitCache) return portraitCache;
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 192;
    hero(canvas.getContext('2d'), 80, 180, 3.35, { reduced: true });
    portraitCache = canvas.toDataURL();
    return portraitCache;
  }

  /** x is the horizontal center; y is the top; the illustration sits on y + h. */
  function illustration(c, x, y, w, h) {
    if (!illustrationLoaded) { hero(c, x, y + h, Math.min(w / 43, h / 48), { reduced: true }); return; }
    const ratio = Math.min(w / illustrationImage.naturalWidth, h / illustrationImage.naturalHeight);
    const width = illustrationImage.naturalWidth * ratio, height = illustrationImage.naturalHeight * ratio;
    c.save(); c.imageSmoothingEnabled = true;
    c.drawImage(illustrationImage, x - width / 2, y + h - height, width, height);
    c.restore();
  }

  function curvePoint(ax, ay, bx, by, cx, cy, t) {
    const u = 1 - t;
    return [u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by];
  }

  // Small cached light sprites: no per-frame blur, gradient, image crop or particle timers.
  const lightTextures = new Map();
  function light(c,x,y,r,red,alpha=1){
    if(r<=0||alpha<=0)return;
    const key=red?'red':'gold';let tile=lightTextures.get(key);
    if(!tile){tile=document.createElement('canvas');tile.width=tile.height=64;const t=tile.getContext('2d'),g=t.createRadialGradient(32,32,1,32,32,32);
      g.addColorStop(0,red?'#fff2e9df':'#fff5cce0');g.addColorStop(.18,red?'#ff5f737a':'#ffb03983');g.addColorStop(.5,red?'#e82b4930':'#ed6b1929');g.addColorStop(1,'#dc461000');t.fillStyle=g;t.fillRect(0,0,64,64);lightTextures.set(key,tile);}
    c.save();c.globalAlpha*=alpha;c.globalCompositeOperation='lighter';c.drawImage(tile,x-r,y-r,r*2,r*2);c.restore();
  }

  // The actor and every renderer use this very same transformed attachment point.
  function muzzle(mode,age=0,reduced=false){
    const m=motion(mode,age,reduced),p=poseMuzzle(m),dy=p.y-HIP;
    return {x:p.x+m.lean*dy+m.dx,y:HIP+dy*(1+m.compression)+m.dy};
  }
  function poseMuzzle(m){
    if(basicLoaded&&m.basicPose>=0){const f=BASIC_FRAMES[m.basicPose];return {x:(f[6]-f[4])*BASIC_UNIT,y:(f[7]-f[5])*BASIC_UNIT};}
    // Measured from the actual front bore, in foot-relative world coordinates.
    return m.mode==='pistol'?{x:24,y:-28.5}:m.mode==='bazooka'?{x:21,y:-33.5}
      :m.mode==='red'?{x:21.5,y:-18.2}:{x:21.5,y:-17.7};
  }

  function muzzleFlash(c,x,y,direction,scale,red,beat,reduced){
    const power=reduced?.42:.65+Math.exp(-beat*6)*.35;
    light(c,x,y,(red?23:20)*scale,red,power*.8);
    c.save();c.translate(x,y);c.scale(direction*scale,scale);
    const length=(red?18:14)*(reduced?.65:.8+Math.exp(-beat*7)*.5),width=(red?4.5:3.4)*power;
    // A directional powder blast, not a magic star or a full-screen flash.
    c.fillStyle=red?'#ff4b5cb8':'#ff8e26c9';c.beginPath();c.moveTo(-1,-width*.55);c.lineTo(4,-width*1.2);c.lineTo(7,-width*.55);c.lineTo(length,0);c.lineTo(7,width*.55);c.lineTo(3,width*1.1);c.lineTo(-1,width*.45);c.closePath();c.fill();
    c.fillStyle='#fff5cf';c.beginPath();c.moveTo(-.8,-width*.4);c.lineTo(4,-width*.45);c.lineTo(length*.76,0);c.lineTo(4,width*.45);c.lineTo(-.8,width*.3);c.closePath();c.fill();
    c.fillStyle='#fffef3';c.fillRect(-1,-1,4,2);
    if(!reduced){c.globalAlpha*=.25;c.strokeStyle=red?'#ff9b97':'#ffe3a4';c.lineWidth=.55;c.beginPath();c.ellipse(4,0,1.7,width*1.4,0,0,TAU);c.stroke();}
    c.restore();
  }

  function tracer(c,sx,sy,tx,ty,curve,phase,red,width,alpha,tailLength=.32){
    if(phase<0||alpha<=0)return;
    const cx=(sx+tx)/2,cy=(sy+ty)/2+curve,p=clamp(phase),end=Math.max(0,p-tailLength);
    if(p<=end)return;
    // Needle-shaped, tapered afterimage. Rounded constant-width strokes look
    // like slow laser rods at gameplay size, so the tail and tip narrow to zero.
    const segments=red?6:3;
    c.save();c.globalAlpha*=alpha;
    for(let layer=0;layer<3;layer++){
      const thickness=width*[2.1,1,.34][layer];
      c.fillStyle=layer===0?(red?'#ff45602d':'#ffb23830'):layer===1?(red?'#ff687c':'#ffd681'):'#fffef1';
      c.beginPath();
      for(const side of [1,-1])for(let n=0;n<=segments;n++){
        const u=side===1?n/segments:1-n/segments,t=end+(p-end)*u,pt=curvePoint(sx,sy,tx,ty,cx,cy,t);
        const dx=2*((1-t)*(cx-sx)+t*(tx-cx)),dy=2*((1-t)*(cy-sy)+t*(ty-cy)),length=Math.max(.001,Math.hypot(dx,dy));
        const taper=u===0||u===1?0:Math.sin(u*Math.PI)*(.4+u*.9),r=thickness*taper*side;
        const x=pt[0]-dy/length*r,y=pt[1]+dx/length*r;
        if(side===1&&n===0)c.moveTo(x,y);else c.lineTo(x,y);
      }
      c.closePath();c.fill();
    }
    c.restore();
  }

  function impact(c,x,y,phase,scale,red,direction,reduced,economy,seed=0){
    const p=clamp(phase),fade=1-p;
    if(fade<=0)return;
    light(c,x,y,(red?20:15)*scale,red,fade*.9);
    c.save();c.translate(x,y);c.scale(scale,scale);c.globalAlpha*=fade;
    if(p<.44||reduced){
      c.fillStyle=red?'#ff858cbf':'#ffba60cb';c.beginPath();
      for(let n=0;n<12;n++){const a=n*TAU/12+seed*.57,r=(n%2?2:7)*(1-p*.35);if(!n)c.moveTo(Math.cos(a)*r,Math.sin(a)*r);else c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();
      c.fillStyle='#fffde5';c.fillRect(-1.5,-3.5,3,7);c.fillRect(-3.5,-1,7,2);
    }
    if(!reduced){
      c.lineWidth=.7;c.strokeStyle=red?'#ffacb5':'#ffe3a5';c.beginPath();c.ellipse(0,0,2+p*12,3+p*9,0,0,TAU);c.stroke();
      const count=economy?4:7;
      for(let i=0;i<count;i++){
        const a=i*2.399+seed*.71,speed=7+(i%3)*4,r=2+p*speed;
        const dx=Math.cos(a)*r-direction*p*3,dy=Math.sin(a)*r*.65+p*p*5;
        c.strokeStyle=i%3?'#ffd17e':'#fff9dd';c.lineWidth=i%3?.9:1.3;
        c.beginPath();c.moveTo(dx,dy);c.lineTo(dx+Math.cos(a)*(3-p*2),dy+Math.sin(a)*(3-p*2));c.stroke();
      }
    }
    c.restore();
  }

  function casings(c,source,scale,direction,age,red,economy){
    const count=economy?2:5;
    for(let i=0;i<count;i++){
      const p=fract(age*3.3+i/count),x=source.x+direction*(3-p*15)*scale,y=source.y+(-18-p*10+p*p*27)*scale;
      c.save();c.translate(x,y);c.rotate(direction*(p*8+i));c.globalAlpha*=1-p*.7;
      c.fillStyle='#6c421e';c.fillRect(-1.6*scale,-.7*scale,3.2*scale,1.4*scale);
      c.fillStyle=red?'#ffb878':'#f7ce79';c.fillRect(-1.5*scale,-.6*scale,2.6*scale,.8*scale);c.restore();
    }
  }

  // A short white-hot core opens into a fireball and a low, rolling shockwave.
  // Every fragment is derived from age: no particle arrays or frame-time writes.
  function bombardment(c,x,y,age,scale,reduced,economy,seed){
    if(age<0||age>1.12)return;
    const p=age/1.12,fade=1-p,burst=Math.min(1,age/.13),r=(8+burst*23+p*12)*scale;
    light(c,x,y-8*scale,r*1.7,false,fade*(reduced?.42:.85));
    c.save();c.translate(x,y);c.globalAlpha*=fade;
    c.strokeStyle='#ffd99a';c.lineWidth=(1.8-p)*scale;
    c.beginPath();c.ellipse(0,12*scale,(8+p*62)*scale,(3+p*16)*scale,0,0,TAU);c.stroke();
    const lobes=economy||reduced?2:4;
    for(let i=0;i<lobes;i++){
      const a=i*2.399+seed,dx=Math.cos(a)*r*.35,dy=-p*26*scale+Math.sin(a)*r*.3;
      c.fillStyle=p>.48?'#433b4d9c':'#be381bdc';c.beginPath();c.ellipse(dx,dy,r*(.6-i*.055),r*(.67-i*.045),0,0,TAU);c.fill();
      if(p<.52){c.fillStyle=p<.14?'#fff8cf':'#ffad37';c.beginPath();c.ellipse(dx,dy+3*scale,r*.39*(1-p),r*.55*(1-p),0,0,TAU);c.fill();}
    }
    if(!reduced){
      const count=economy?4:8;
      for(let i=0;i<count;i++){
        const a=i*2.399+seed,dist=(5+burst*18+p*(24+i%3*12))*scale;
        const dx=Math.cos(a)*dist,dy=Math.sin(a)*dist*.65+p*p*34*scale;
        c.strokeStyle=i%2?'#ffb358':'#fff4bf';c.lineWidth=(i%3?1:1.8)*scale;
        c.beginPath();c.moveTo(dx,dy);c.lineTo(dx-Math.cos(a)*7*scale*fade,dy-Math.sin(a)*7*scale*fade);c.stroke();
      }
    }
    c.restore();
  }

  /** Instant-looking ballistics: 35 ms transit, short afterimage and deterministic
   * shot scheduling. At most 7 tracer paths, 6 impacts and 5 shells per frame.
   * No simulation writes; damage remains grouped by the server's 500 ms volleys.
   */
  function effects(c,options={}){
    const source=options.source;
    if(!source||!Number.isFinite(source.x)||!Number.isFinite(source.y))return;
    const targets=(Array.isArray(options.targets)?options.targets:[]).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)).slice(0,6);
    if(!targets.length)return;
    const mode=options.mode||'fire';if(!['fire','red','pistol','bazooka'].includes(mode))return;
    const scale=clamp(finite(options.scale,1),.25,4),age=Math.max(0,finite(options.age)),reduced=!!options.reduced,economy=!!options.economy,red=mode==='red',direction=options.flip?-1:1;
    const attachment=muzzle(mode,age,reduced),sx=source.x+direction*attachment.x*scale,sy=source.y+attachment.y*scale;
    const point=target=>[target.x,Number.isFinite(target.aimY)?target.aimY:target.y-24*scale];
    if(mode==='bazooka'){
      if(age>1.5)return;const [tx,ty]=point(targets[0]),arrival=.12;
      if(age<arrival){
        const p=age/arrival,pt=curvePoint(sx,sy,tx,ty,(sx+tx)/2,(sy+ty)/2-14*scale,p);
        tracer(c,sx,sy,tx,ty,-14*scale,p,false,3.4*scale,1,.48);
        light(c,pt[0],pt[1],15*scale,false,.85);
        c.save();c.translate(pt[0],pt[1]);c.rotate(Math.atan2(ty-sy,tx-sx));
        c.fillStyle='#fff3c4';c.fillRect(-6*scale,-1.4*scale,10*scale,2.8*scale);c.restore();
        muzzleFlash(c,sx,sy,direction,scale*1.8,false,age/arrival,reduced);
      }
      // A visible wave of secondary detonations follows the first direct hit.
      // These are cosmetic; one authoritative area hit still determines damage.
      for(let i=0;i<targets.length;i++){
        const [x,y]=point(targets[i]);
        bombardment(c,x,y,age-arrival-i*.045,scale*(reduced?.65:i===0?1.1:.82),reduced,economy,i*.71);
      }
      if(!reduced&&targets.length<3)for(let i=0;i<2;i++)bombardment(c,tx+(i?1:-1)*26*scale,ty+8*scale,age-.29-i*.1,scale*.7,false,true,i+3);
      return;
    }
    if(mode==='pistol'){
      if(age>.55)return;const [tx,ty]=point(targets[0]);
      if(age<.095)tracer(c,sx,sy,tx,ty,0,Math.min(1,age/.018),false,2*scale,1-age/.095,.85);
      if(age<.14)muzzleFlash(c,sx,sy,direction,scale*1.65,false,age/.14,reduced);
      if(age>=.018){
        const p=(age-.018)/.532;impact(c,tx,ty,p,scale*1.9,false,direction,reduced,economy);
        if(!reduced&&p<.55){
          c.save();c.translate(tx,ty);c.rotate(Math.atan2(ty-sy,tx-sx));c.globalAlpha*=1-p/.55;
          c.fillStyle='#fff4d2';c.beginPath();c.moveTo(-15*scale,0);c.lineTo(0,-1.3*scale);c.lineTo(23*scale,0);c.lineTo(0,1.3*scale);c.closePath();c.fill();
          c.strokeStyle='#ffe6aa';c.lineWidth=.8*scale;c.beginPath();c.ellipse(p*7*scale,0,(2+p*10)*scale,(6+p*19)*scale,0,0,TAU);c.stroke();c.restore();
        }
      }
      return;
    }
    if(age<FIRE_START)return;
    const fireAge=age-FIRE_START,period=red?.02:.05,flight=red?.055:.035,linger=red?.03:.025;
    const shot=Math.floor(fireAge/period),beat=fract(fireAge/period);
    muzzleFlash(c,sx,sy,direction,scale,red,reduced?.6:beat,reduced);
    if(reduced){
      const [tx,ty]=point(targets[0]);tracer(c,sx,sy,tx,ty,red?-24*scale:0,.86,red,.85*scale,.35,.1);
      for(let i=0;i<(red?targets.length:1);i++){const [x,y]=point(targets[i]);impact(c,x,y,.4,scale*.8,red,direction,true,true,i);}
      return;
    }
    const count=economy?(red?4:2):(red?7:3);
    for(let n=0;n<count;n++){
      const index=shot-n,elapsed=fireAge-index*period;
      if(index<0||elapsed<0||elapsed>flight+linger)continue;
      const target=targets[red?index%targets.length:0],[tx,ty]=point(target),offset=Math.sin(index*2.399)*1.8*scale;
      const bend=red?Math.sin(index*1.73)*(28+index%3*13)*scale:offset*.4;
      const alpha=elapsed<=flight?.95:(1-(elapsed-flight)/linger)*.65;
      tracer(c,sx,sy,tx,ty+offset,bend,Math.min(1,elapsed/flight),red,(red?1.15:1)*scale,alpha,red?.3:.42);
    }
    const hitCount=red?targets.length:1;
    for(let i=0;i<hitCount;i++){
      // Impacts follow the emission stream instead of hovering as permanent stars.
      const interval=period*(red?targets.length:2),offset=red?i*period:0,elapsed=fireAge-flight-offset;
      if(elapsed<0)continue;const hitIndex=Math.floor(elapsed/interval),p=fract(elapsed/interval),[tx,ty]=point(targets[i]);
      impact(c,tx+Math.sin(hitIndex*2.4+i)*2*scale,ty+Math.cos(hitIndex*1.6+i)*2*scale,p,scale,red,direction,false,economy,hitIndex+i);
    }
    casings(c,source,scale,direction,fireAge,red,economy);
    // Thin heat wisps are local to the barrel; their light never obscures the HUD.
    if(!economy&&fireAge>1.4){c.save();c.globalAlpha=.16;c.strokeStyle=red?'#ffc5bc':'#ffe0b6';c.lineWidth=.6*scale;
      for(let i=0;i<2;i++){const x=sx-direction*(3+i*5)*scale;c.beginPath();c.moveTo(x,sy-3*scale);c.quadraticCurveTo(x+Math.sin(fireAge*5+i)*3*scale,sy-9*scale,x-2*scale,sy-15*scale);c.stroke();}c.restore();}
  }

  return Object.freeze({
    ready, hero, draw: hero, portrait, illustration, effects, motion, modeFor, muzzle,
    assets: ASSETS, frames: FRAMES, basicFrames: BASIC_FRAMES,
    assetsReady: () => atlasLoaded && basicLoaded && illustrationLoaded
  });
})();
