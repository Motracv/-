"use strict";
window.SchoolArt = (() => {
  const portraits = new Map(), frontPortraits = new Map(), osiaPoses = new Map(), lavaPoses = new Map(), lavaSources = new Map(), combatLabels = new Map(), S = SchoolRPG;
  let lavaPosePixels = 0, combatLabelPixels = 0;
  const healthTrackers = new WeakMap();
  window.addEventListener('school-art-ready',()=>{portraits.clear();frontPortraits.clear();});
  const spicaImage=new Image(),spicaPortraitImage=new Image(),spicaPoses=new Map();
  const SPICA_FRAMES=Array.from({length:8},(_,i)=>[i%4*384,Math.floor(i/4)*384,384,384,192,356]);
  let spicaLoaded=false,spicaPortraitLoaded=false;
  const spicaReady=Promise.all([[spicaImage,'combat-horas.webp'],[spicaPortraitImage,'portrait.webp']].map(([image,file])=>new Promise(resolve=>{
    const timer=setTimeout(()=>resolve(false),5000);
    image.onload=()=>{if(image===spicaImage){spicaLoaded=true;spicaPoses.clear();}else spicaPortraitLoaded=true;clearTimeout(timer);resolve(true);window.dispatchEvent(new Event('school-art-ready'));};
    image.onerror=()=>{clearTimeout(timer);resolve(false);};image.src=image===spicaImage?'school/assets/roster-remake/spica.webp?v=roster1':`school/assets/spica/${file}?v=spica1`;
  })));
  const osiaImage = new Image(), osiaFrontImage = new Image(), lavaImage = new Image();
  const osiaFrontSources = new Map();
  let osiaLoaded = false, osiaFrontLoaded = false, lavaLoaded = false;
  const osiaReady = new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 5000);
    osiaImage.onload = () => { osiaLoaded = true; clearTimeout(timer); portraits.delete("osia"); frontPortraits.delete("osia"); osiaPoses.clear(); resolve(true); window.dispatchEvent(new Event("school-art-ready")); };
    osiaImage.onerror = () => { clearTimeout(timer); resolve(false); };
  });
  const osiaFrontReady = new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 5000);
    osiaFrontImage.onload = () => { osiaFrontLoaded = true; clearTimeout(timer); frontPortraits.delete("osia"); osiaFrontSources.clear(); resolve(true); window.dispatchEvent(new Event("school-art-ready")); };
    osiaFrontImage.onerror = () => { clearTimeout(timer); resolve(false); };
  });
  const lavaReady = new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 5000);
    lavaImage.onload = () => { lavaLoaded = true; clearTimeout(timer); portraits.delete("lava"); frontPortraits.delete("lava"); lavaPoses.clear(); lavaPosePixels = 0; resolve(true); window.dispatchEvent(new Event("school-art-ready")); };
    lavaImage.onerror = () => { clearTimeout(timer); resolve(false); };
  });
  const lavaFanImage = new Image();
  let lavaFanLoaded = false;
  const lavaFanReady = new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 5000);
    lavaFanImage.onload = () => { lavaFanLoaded = true; lavaPoses.clear(); lavaPosePixels=0; clearTimeout(timer); resolve(true); window.dispatchEvent(new Event("school-art-ready")); };
    lavaFanImage.onerror = () => { clearTimeout(timer); resolve(false); };
  });
  // Horas sources are optional at boot and independently recover after a slow
  // request. The combat atlas has fixed feet across twelve authored key poses.
  const horasImage = new Image(), horasPortraitImage = new Image(), horasCutinImage = new Image();
  const horasPoses = new Map(), horasPortraitSources = new Map(), horasFxSources = new Map();
  const horasWarmPending = new Map(), horasWarmQueue = [], horasMaterialized = new WeakSet();
  let horasWarmScheduled = false;
  let horasLoaded = false, horasPortraitLoaded = false, horasCutinLoaded = false, horasPosePixels = 0, horasCutinSource = null;
  const horasReady = Promise.all([
    new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), 5000);
      horasImage.onload = () => { horasLoaded = true; clearTimeout(timer); horasPoses.clear(); horasPosePixels = 0; portraits.delete('horas'); resolve(true); window.dispatchEvent(new Event('school-art-ready')); };
      horasImage.onerror = () => { clearTimeout(timer); resolve(false); };
    }),
    new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), 5000);
      horasPortraitImage.onload = () => { horasPortraitLoaded = true; clearTimeout(timer); horasPortraitSources.clear(); frontPortraits.delete('horas'); resolve(true); window.dispatchEvent(new Event('school-art-ready')); };
      horasPortraitImage.onerror = () => { clearTimeout(timer); resolve(false); };
    }),
    new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), 5000);
      horasCutinImage.onload = () => { horasCutinLoaded = true; horasCutinSource = null; clearTimeout(timer); void warmHorasSource('face'); resolve(true); window.dispatchEvent(new Event('school-art-ready')); };
      horasCutinImage.onerror = () => { clearTimeout(timer); resolve(false); };
    }),
  ]).then(async result => { await Promise.all([horasFxReady, warmHorasSource('face')]); return result; });
  const horasFxReady = Promise.resolve().then(warmHorasEffects);
  horasImage.src = 'school/assets/horas/combat.webp?v=horas1';
  horasPortraitImage.src = 'school/assets/horas/portrait.webp?v=horas1';
  horasCutinImage.src = 'school/assets/horas/cutin.webp?v=horas1';
  const ready = Promise.all([osiaReady, lavaReady, lavaFanReady, osiaFrontReady, horasFxReady, window.SchoolRyusion?.ready,spicaReady,window.SchoolKazuaArt?.ready,window.SchoolHyeokjinArt?.ready,window.SchoolOsiaWeaponArt?.ready,window.SchoolOsiaBreathArt?.ready,window.SchoolRosterArt?.ready]).then(async ([osia, lava]) => { if(horasCutinLoaded)await warmHorasSource('face'); return osia && lava; });
  osiaImage.src = "school/assets/roster-remake/osia.webp?v=roster1";
  osiaFrontImage.src = "school/assets/osia-front.webp?v=osia-look1";
  lavaImage.src = "school/assets/lava.png?v=lava1";
  lavaFanImage.src = "school/assets/roster-remake/lava.webp?v=roster1";
  function rect(c, color, x, y, w, h) { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); }
  // Fine details use a half-pixel art grid. They are drawn directly into the
  // display-sized canvas, rather than enlarging a 480px raster afterwards.
  function detail(c, color, x, y, w, h) { c.fillStyle = color; c.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, w, h); }
  const shades = new Map();
  function shade(color, amount) {
    const key = color + amount;
    if (!shades.has(key)) { const n = parseInt(color.slice(1), 16); shades.set(key, '#' + [n >> 16, n >> 8 & 255, n & 255].map(v => Math.max(0, Math.min(255, v + amount)).toString(16).padStart(2, '0')).join('')); }
    return shades.get(key);
  }
  const clamp01 = value => Math.max(0, Math.min(1, value));
  // Android WebViews predating Array.findLast must still paint every frame.
  // Keep this local: the renderer must not change built-in array prototypes.
  function lastEffect(effects, matches) {
    for (let i = effects.length - 1; i >= 0; i--) if (matches(effects[i])) return effects[i];
  }
  // Keep the current scenery at display resolution, not a 480px enlargement.
  // Weak ownership releases it with the battle canvas; a resize replaces it.
  let backgrounds = new WeakMap();
  // Panoramic battlefields are optional, static assets. A slow/failed image
  // keeps the existing procedural scene usable and never blocks game boot.
  const battlefieldImages = new Map();
  let battlefieldRevision = 0;
  const battlefieldsReady = Promise.all(['classroom', 'garden', 'snow'].map(name => new Promise(resolve => {
    const image = new Image(), entry = {image, loaded:false};
    battlefieldImages.set(name, entry);
    const timer = setTimeout(() => resolve(false), 5000);
    image.onload = () => { entry.loaded = true; battlefieldRevision++; clearTimeout(timer); resolve(true); };
    image.onerror = () => { clearTimeout(timer); resolve(false); };
    image.src = `school/assets/battlefields/${name}.webp?v=battlefield1`;
  })));
  const sprites = new Map();
  let spritePixels = 0, fontRevision = 0;
  const SPRITE_PIXEL_LIMIT = 2 * 1024 * 1024;
  document.fonts?.ready.then(() => { fontRevision++; });
  document.fonts?.addEventListener('loadingdone', () => { fontRevision++; });
  const partyFront = [{x:228,y:216},{x:160,y:216},{x:92,y:216},{x:202,y:137},{x:134,y:137},{x:66,y:137}];
  const partySmall = [{x:173,y:208},{x:115,y:181},{x:68,y:221}];
  const enemyPlaces = [{x:325,y:207},{x:384,y:180},{x:425,y:225}];
  // Movement is expressed in logical battle pixels and consumes the shared
  // simulation clock, so changing battle speed never desynchronises a pose.
  function castingMotion(id, stage, age, reduced = false) {
    if(id==="ryusion")return window.SchoolRyusion.motion(stage,age,reduced);
    if(id==='spica'){
      const p=clamp01(age/1.6),wave=reduced?0:Math.sin(p*Math.PI);
      return {dx:age>.85?wave*3:-wave*1.5,dy:age<.85?-wave*2:0,lean:reduced?0:wave*(age>.85?.025:-.015),stretch:1+wave*.012,cloth:wave,pose:reduced?6:age<.12?0:age<.45?4:age<.85?5:age<1.3?6:age<1.6?7:0,stage,age,reduced};
    }
    if (reduced) return {dx:0, dy:0, lean:0, stretch:1, cloth:0, pose:stage === 1 ? 2 : 1, stage, age, reduced};
    if (age < 0) return {dx:0, dy:0, lean:0, stretch:1.025, cloth:0, pose:1, stage, age, reduced};
    const progress = clamp01(age / (id === "lava" ? 1.35 : stage === 4 ? 1.65 : 1.05));
    const spring = Math.sin(progress * Math.PI), release = clamp01((age - .15) / .45);
    let dx = 0, dy = 0, lean = 0, stretch = 1, cloth = 0, pose = age < .4 ? 1 : 2;
    if (id === "lava") {
      // Keep the original character's silhouette intact while easing into
      // the cast. The wind effects carry the larger movement.
      const p = clamp01(age / 1.8), ease = p * p * (3 - 2 * p), breath = Math.sin(p * Math.PI);
      dx = Math.sin(ease * Math.PI) * (stage === 1 ? 5 : -3);
      dy = -breath * (stage === 2 ? 5 : 2);
      lean = Math.sin(p * Math.PI * 2) * .035;
      cloth = breath * 1.35; stretch = 1 + breath * .012;
      pose = p < .28 ? 1 : 2;
    } else if (stage === 1) { dx = Math.sin(release * Math.PI) * 17 - Math.sin(clamp01(age / .2) * Math.PI) * 3; dy = age < .2 ? 4 * Math.sin(age / .2 * Math.PI) : -spring * 2; lean = -.12 * Math.sin(progress * Math.PI); stretch = age < .2 ? .93 : 1; }
    else if (stage === 2) { dx = Math.sin(progress * Math.PI * 2) * 10; dy = -spring * 9; lean = .2 * Math.sin(progress * Math.PI * 2); pose = age < .28 ? 2 : age < .62 ? 1 : 2; }
    else if (stage === 3) { dy = -Math.sin(clamp01(age / .9) * Math.PI) * 28; dx = spring * 4; stretch = dy < -6 ? 1.06 : .95; lean = -.055; pose = age < .5 ? 1 : 2; }
    else { dy = -Math.sin(clamp01(age / 1.2) * Math.PI) * 18; dx = Math.sin(clamp01(age / 1.6) * Math.PI) * 11; lean = age < .5 ? .035 : -.09 * spring; stretch = 1.025; pose = age < .55 ? 1 : 2; }
    return {dx,dy,lean,stretch,cloth,pose,stage,age,reduced};
  }
  // Hand magic is transient and separate from the atlas. It shares the actor's
  // transform (including mirroring) and never covers the face or survives stun.
  function osiaHandMagic(c, pose, frame) {
    if(frame.dead||frame.frozen||frame.stunned)return;
    const casting=!!frame.casting,age=casting?frame.motion?.age:frame.attackAge;
    const basic=Number.isFinite(age)&&age>=0&&age<.32&&!casting;
    if(!casting&&!basic&&!frame.attack&&!frame.ready)return;
    if(pose!==1&&pose!==2)return;
    const t=Number.isFinite(age)?Math.max(0,age):0;
    const fade=pose===1?1:casting?1-clamp01((t-.4)/.35):1-clamp01(t/.32);
    if(fade<=0)return;
    const x=pose===1?4.7:14.5,y=pose===1?-25.2:-27;
    const turn=frame.reduced?0:t*8,r=pose===1?1.8+clamp01(t/.35)*.6:1.9;
    c.save();c.globalAlpha*=fade*.85;
    // A short water ribbon wraps the palm, then the projectile carries it away.
    c.strokeStyle='#5ccfe7';c.lineWidth=.65;c.beginPath();
    c.ellipse(x,y,r+1.1,r*.55,-.25,turn,turn+Math.PI*1.35);c.stroke();
    waterOrb(c,x,y,r);
    if(!frame.reduced){
      const a=turn+Math.PI;
      detail(c,'#c5faff',x+Math.cos(a)*(r+1.4),y+Math.sin(a)*(r*.7),.65,.65);
    }
    c.restore();
  }
  function osia(c, x, y, scale, frame) {
    window.SchoolOsiaWeaponArt?.spear(c,x,y,scale,frame);
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale * (frame.flip ? -1 : 1), scale);
    if (frame.dead) { c.globalAlpha = .4; c.rotate(-Math.PI / 2); }
    rect(c, "#26333b35", -8, 1 + (frame.shadowY || 0), 17, 2);
    if (frame.motion) c.transform(1, 0, frame.motion.lean, frame.motion.stretch, 0, 0);
    if (osiaLoaded) {
      const basic=Number.isFinite(frame.attackAge)&&frame.attackAge>=0;
      const tile = osiaImage.naturalWidth / 3, pose = frame.pose ?? (frame.osiaSpearAge>=0&&frame.osiaSpearAge<.3?1:frame.casting?2:basic?(frame.attackAge<.32?2:frame.attackAge<.6?5:frame.ready?1:0):frame.attack?2:frame.ready?1:0);
      // Six square cells (3 columns × 2 rows); first row is idle/gather/release.
      // All poses share foot anchors; portrait art is separate from combat.
      // Downsample each atlas cell once at the required display density; do
      // not repeatedly sample a large source PNG on the battle render path.
      const transform=c.getTransform(),density=Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d)),resolution=density>4?6:density>2?4:2;
      const key=pose+":"+resolution;let sprite=osiaPoses.get(key);
      if(!sprite){sprite=document.createElement("canvas");sprite.width=sprite.height=44*resolution;const sc=sprite.getContext("2d");sc.imageSmoothingEnabled=false;sc.drawImage(osiaImage,(pose%3)*tile,Math.floor(pose/3)*tile,tile,tile,0,0,sprite.width,sprite.height);osiaPoses.set(key,sprite);}
      c.save();c.translate(-1,-2.1);c.scale(1.1,1.1);
      if(Number.isFinite(frame.osiaBreathAge)&&frame.osiaBreathAge>=0&&window.SchoolOsiaBreathArt&&!frame.dead&&!frame.stunned&&!frame.frozen)window.SchoolOsiaBreathArt.caster(c,sprite,frame.osiaBreathAge,frame.reduced);
      else{c.drawImage(sprite,-21,-40,44,44);osiaHandMagic(c,pose,frame);}
      c.restore();
    } else {
      // Small, right-facing fallback when the optional art file cannot load.
      c.translate(0, -7);
      rect(c, "#293b5d", -8, -33, 15, 16); rect(c, "#6e91cd", -7, -32, 14, 13);
      rect(c, "#f3cda7", 1, -28, 7, 9); rect(c, "#f3cda7", 7, -25, 3, 3); rect(c, "#263851", 6, -27, 2, 3);
      rect(c, "#97b5e5", -5, -31, 12, 3); rect(c, "#5578ae", -8, -27, 5, 12); rect(c, "#e7a66f", -6, -35, 6, 5); rect(c, "#ffd499", -4, -37, 3, 6);
      rect(c, "#f5df7f", -5, -22, 3, 6); rect(c, "#f5df7f", 7, -22, 2, 5);
      rect(c, "#252c3c", -4, -18, 11, 11); rect(c, "#f9f2e9", -3, -17, 10, 9); rect(c, "#56ad8c", 4, -16, 2, 4);
      rect(c, "#f3cda7", 7, -15, frame.attack ? 10 : 3, 4); rect(c, "#343543", -6, -9, 15, 8); rect(c, "#f4efea", -6, -5, 15, 1); rect(c, "#f4efea", -6, -3, 15, 1);
      rect(c, "#f8f3f1", -4, -1, 4, 5); rect(c, "#f8f3f1", 3, -1, 4, 5); rect(c, "#785039", -4, 3, 5, 7); rect(c, "#785039", 3, 3, 5, 7); rect(c, "#a5754c", -3, 3, 3, 5); rect(c, "#a5754c", 4, 3, 3, 5);
    }
    c.restore();
  }
  function fan(c, x, y, open = true) {
    c.save(); c.translate(x, y);
    if (open) {
      rect(c, "#6a4332", -9, -12, 18, 5); rect(c, "#6a4332", -11, -10, 22, 5);
      rect(c, "#d8eaf0", -8, -11, 16, 9); rect(c, "#eff8f2", -10, -9, 20, 4);
      for (let i = -2; i <= 2; i++) { c.strokeStyle = "#b98d58"; c.lineWidth = .5; c.beginPath(); c.moveTo(0, 1); c.lineTo(i * 4, -10 + Math.abs(i)); c.stroke(); }
      rect(c, "#83adbb", -5, -7, 7, 1); rect(c, "#83adbb", -2, -5, 7, 1);
    } else { rect(c, "#76503b", -1, -12, 3, 13); detail(c, "#f5db9c", 0, -11, 1, 11); }
    rect(c, "#6b4834", -1, 0, 2, 5); rect(c, "#e6c16f", -1, 3, 2, 1); c.restore();
  }
  // Use the approved source art for battle, portraits and cut-ins alike.
  // Only the load-failure fallback below is constructed from simple shapes.
  function lavaFigure(c, time = 0, frame = {}, front = false) {
    const motion = frame.motion, reduced = motion?.reduced || frame.reduced;
    const age = Math.max(0, motion?.age ?? frame.attackAge ?? 0);
    const casting = !!frame.casting, passive = !!frame.passive;
    const p = clamp01(age / (casting ? 1.8 : passive ? 1.45 : .85));
    const ease = p * p * (3 - 2 * p), wave = Math.sin(ease * Math.PI);
    const idle = reduced ? 0 : Math.sin(time * 1.8) * .45;
    if (lavaLoaded) {
      const transform = c.getTransform(), density = Math.max(Math.hypot(transform.a, transform.b), Math.hypot(transform.c, transform.d));
      const resolution = density > 4 ? 6 : density > 2 ? 4 : 2;
      let source = lavaSources.get(resolution);
      const width = 44 * 631 / 1260;
      if (!source) {
        source = document.createElement('canvas'); source.width = Math.ceil(width * resolution); source.height = 44 * resolution;
        const sc = source.getContext('2d'); sc.imageSmoothingEnabled = false;
        sc.drawImage(lavaImage, 245, 91, 631, 1260, 0, 0, source.width, source.height);
        lavaSources.set(resolution, source);
      }
      const active = casting || passive || frame.attackAge != null;
      const gesture = reduced ? 0 : active ? wave : 0;
      c.save();
      c.translate(gesture * (casting ? .6 : passive ? -.35 : 1.1), active ? -gesture * .6 : 0);
      c.rotate(gesture * (casting ? -.025 : passive ? -.018 : .045));
      c.drawImage(source, -width / 2, -41, width, 44);
      c.restore();
      return;
    }
    const arm = reduced ? -.3 : casting ? -.95 + ease * 1.8 : passive ? -.45 - wave * .8 : frame.attackAge != null && p < 1 ? -.9 + ease * 2.15 : .15 + idle * .1;
    const skirt = reduced ? 0 : Math.sin(time * 2.2) * .45 + wave * .75;
    // Hair behind neck, loose ritual trousers and embroidered old shoes.
    rect(c,"#395269",-8,-41,16,17);rect(c,"#70aac5",-7,-40,14,16);
    rect(c,"#dadfd1",-7,-8,6,11);rect(c,"#f6f0d8",-6,-7,4,9);rect(c,"#dadfd1",2,-8,6,11);rect(c,"#f6f0d8",3,-7,4,9);
    detail(c,"#7f8f9b",-5,-4,1,7);detail(c,"#7f8f9b",4,-4,1,7);
    rect(c,"#343c48",-8,2,8,3);rect(c,"#343c48",2,2,9,3);detail(c,"#c5a072",-7,2,6,1);detail(c,"#c5a072",3,2,6,1);
    // Full red chima with layered hem and narrow gold embroidery.
    rect(c,"#65353d",-10+skirt,-17,20,17);rect(c,"#a63e50",-9+skirt,-16,18,15);
    rect(c,"#c65a62",-8+skirt,-16,4,14);rect(c,"#872f46",3+skirt,-15,4,14);
    detail(c,"#e19678",-8+skirt,-15,1,12);detail(c,"#e4bd85",-9+skirt,-2,18,1);
    rect(c,"#5b6039",-8,-29,16,14);rect(c,"#a7ad55",-7,-28,14,12);rect(c,"#c8cd7b",-7,-28,4,11);
    rect(c,"#e3c88a",-2,-28,6,2);rect(c,"#b17c49",0,-26,3,3);rect(c,"#eddbac",-1,-27,3,1);
    detail(c,"#f0d795",-6,-17,13,1);rect(c,"#83424a",2,-17,2,8);rect(c,"#d7935e",4,-17,3,3);
    // Far sleeve opens slightly as the fan is raised.
    c.save();c.translate(-7,-27);c.rotate(reduced?0:-.12-wave*.25);
    rect(c,"#59663f",-4,0,6,12);rect(c,"#a6b567",-3,1,4,10);rect(c,"#e9c8aa",-2,10,4,3);c.restore();
    // The head is kept rigid to avoid the old rubber-sheet distortion.
    c.save();c.translate(front?0:1,idle*.3);
    rect(c,"#f0cdb1",-6,-39,12,12);rect(c,"#dba98f",-4,-29,9,2);
    rect(c,"#9bcedf",-8,-42,16,7);rect(c,"#c1e5ed",-5,-43,10,3);
    rect(c,"#84bcd4",-8,-37,3,9);rect(c,"#8bc2d7",5,-38,3,7);rect(c,"#a6d9e7",-3,-39,5,6);
    detail(c,"#e0f3f3",-5,-41,7,1);detail(c,"#5b8da9",-8,-34,1,7);
    const eyeY=-33, blink=frame.blink;
    rect(c,"#2d4353",front?-4:0,eyeY,2,blink?1:2);rect(c,"#2d4353",front?3:5,eyeY,2,blink?1:2);
    if(!blink){detail(c,"#eef7ef",front?-4:0,eyeY,1,.5);detail(c,"#eef7ef",front?3:5,eyeY,1,.5);}
    detail(c,"#b98379",front?-1:3,-29,2,.5);c.restore();
    // Near arm really swings from the shoulder; hand and fan stay attached.
    c.save();c.translate(front?7:8,-26);c.rotate(arm);
    rect(c,"#59663f",-1,-1,8,12);rect(c,"#b8c470",0,0,6,10);rect(c,"#d9dca0",0,1,2,8);
    rect(c,"#f0cdb1",2,9,4,4);detail(c,"#f8e5c7",3,9,2,1);
    c.translate(4,11);c.rotate(-.95 + (casting?wave*.22:0));c.scale(.8,.8);fan(c,0,0,casting||passive||frame.attackAge!=null||front);c.restore();
    if(passive){c.save();c.globalAlpha=.5*wave;c.strokeStyle="#d7f3d6";c.lineWidth=.6;c.beginPath();c.ellipse(0,-15,16,23,0,-1,4.5);c.stroke();c.restore();}
  }
  // All approved key poses keep their original time proportions, fitted into
  // one basic-attack simulation second. No queue or gameplay state is needed.
  const LAVA_FAN_SEQUENCE = [0,0,1,2,3,4,5,6,7,8,9,0];
  const LAVA_FAN_ENDS = [100,200,300,400,480,550,640,770,920,1080,1240,1400];
  function lavaFanPose(age) {
    const elapsed = age * 1400;
    for (let i = 0; i < LAVA_FAN_ENDS.length; i++) if (elapsed < LAVA_FAN_ENDS[i]) return LAVA_FAN_SEQUENCE[i];
    return 0;
  }
  function lava(c, x, y, scale, frame) {
    c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale*(frame.flip?-1:1),scale);
    if(frame.dead){c.globalAlpha=.4;c.rotate(-Math.PI/2);}
    rect(c,"#26333b35",-10,1+(frame.shadowY||0),21,2);
    if(frame.motion)c.transform(1,0,frame.motion.lean,frame.motion.stretch,0,0);
    const transform=c.getTransform(),density=Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d));
    const resolution=density>4?6:density>2?4:2;
    const poseReduced=!!frame.reduced||!!frame.motion?.reduced;
    const basicAge=Number.isFinite(frame.basicAttackAt)&&Number.isFinite(frame.time)?frame.time-frame.basicAttackAt:frame.attackAge;
    const fanAttack=lavaFanLoaded&&!poseReduced&&!frame.dead&&!frame.casting&&!frame.passive&&basicAge>=0&&basicAge<1;
    const kind=fanAttack?"fan":frame.casting?"skill":frame.passive?"passive":frame.attackAge!=null?"attack":"idle";
    const duration=kind==="skill"?1.8:kind==="passive"?1.45:.85,steps=kind==="skill"?18:kind==="idle"?(lavaLoaded?1:8):12;
    const rawAge=frame.motion?.age??frame.attackAge??0;
    // Limb poses are a fixed tiny atlas. Position/lean still interpolate each
    // rendered frame, but identical pixel poses do not submit 70+ draw calls.
    const step=fanAttack?lavaFanPose(basicAge):poseReduced?0:kind==="idle"?Math.floor(((frame.time||0)%(Math.PI*2/1.8))/(Math.PI*2/1.8)*steps):Math.min(steps,Math.max(0,Math.floor(rawAge/duration*steps)));
    const key=fanAttack?`${resolution}:fan:${step}`:`${resolution}:${kind}:${step}:${+!!frame.blink}:${+poseReduced}`;
    const width=72,height=64,anchorX=32,anchorY=52;
    let sprite=lavaPoses.get(key);
    if(!sprite){
      sprite=document.createElement("canvas");sprite.width=width*resolution;sprite.height=height*resolution;
      const sc=sprite.getContext("2d");sc.imageSmoothingEnabled=false;sc.scale(resolution,resolution);sc.translate(anchorX,anchorY);
      const age=step/steps*duration,poseTime=kind==="idle"?step/steps*Math.PI*2/1.8:age;
      if(lavaFanLoaded){
        // All states share the approved model, including idle and healing.
        // Keep the existing wind-up/release timing and continuous lean.
        const unit=44/340,pose=frame.dead||frame.stunned||frame.frozen?0:fanAttack?step:kind==='idle'?0:poseReduced?5:[1,2,3,4,5,6,7,8,9][Math.min(8,Math.floor(step/steps*9))];
        sc.drawImage(lavaFanImage,(pose%5)*384,Math.floor(pose/5)*384,384,384,-192*unit,-356*unit,384*unit,384*unit);
      }else lavaFigure(sc,poseTime,{...frame,motion:frame.motion?{...frame.motion,age}:undefined,attackAge:kind==="idle"?undefined:age},false);
      while(lavaPoses.size&&lavaPosePixels+sprite.width*sprite.height>3*1024*1024){const oldest=lavaPoses.keys().next().value,old=lavaPoses.get(oldest);lavaPosePixels-=old.width*old.height;lavaPoses.delete(oldest);}
      lavaPoses.set(key,sprite);lavaPosePixels+=sprite.width*sprite.height;
    }else{lavaPoses.delete(key);lavaPoses.set(key,sprite);}
    c.drawImage(sprite,-anchorX,-anchorY,width,height);
    c.restore();
  }
  const HORAS_ATLAS = Object.freeze({columns:4, rows:3, width:384, height:352, footX:192, footY:328, bodyHeight:300});
  const HORAS_ORBS = [{x:-29,y:-22},{x:-31,y:-37},{x:-23,y:-49},{x:-9,y:-54},{x:5,y:-49}];
  const HORAS_PETALS = Array.from({length:12},(_,i)=>({angle:i*2.39996323,reach:23+(i%4)*10,lift:12+(i%3)*9,turn:i*.71}));
  // Four fixed, reusable effect sources (<2 MiB RGBA in total). Glows and
  // detailed flower geometry are rasterized once, never blurred per frame.
  function horasFx(kind) {
    let image=horasFxSources.get(kind);if(image)return image;
    image=document.createElement('canvas');image.dataset.horasFx=kind;const size=kind==='seal'?512:kind==='bloom'?384:kind==='beam'?96:128;
    image.width=size;image.height=kind==='beam'?256:size;
    const p=image.getContext('2d'),mid=size/2;p.translate(mid,image.height/2);
    if(kind==='beam'){
      const g=p.createLinearGradient(-mid,0,mid,0);g.addColorStop(0,'#ed7bc700');g.addColorStop(.22,'#ee92d461');g.addColorStop(.4,'#ffcae9dc');g.addColorStop(.48,'#fff6eaff');g.addColorStop(.52,'#fff6eaff');g.addColorStop(.6,'#ffcae9dc');g.addColorStop(.78,'#ee92d461');g.addColorStop(1,'#ed7bc700');p.fillStyle=g;p.fillRect(-mid,-128,size,256);
    }else{
      const g=p.createRadialGradient(0,0,0,0,0,mid);g.addColorStop(0,kind==='seal'?'#22122abf':kind==='glow'?'#fff8e8f0':'#ffd4ed7d');g.addColorStop(.22,kind==='seal'?'#4e214a96':'#ffc5e878');g.addColorStop(.55,kind==='seal'?'#61315c6b':'#ef89c72a');g.addColorStop(1,'#e581ca00');p.fillStyle=g;p.fillRect(-mid,-mid,size,size);
      if(kind==='seal'||kind==='bloom'){
        const radius=mid*.83;p.lineWidth=kind==='seal'?3.6:2.2;p.strokeStyle='#ffdbcbd9';
        if(kind==='seal')for(const ratio of [1,.91]){p.beginPath();p.arc(0,0,radius*ratio,0,Math.PI*2);p.stroke();}
        if(kind==='seal'){
          p.beginPath();for(let i=0;i<=5;i++){const a=-Math.PI/2+(i*2%5)*Math.PI*2/5;i?p.lineTo(Math.cos(a)*radius*.92,Math.sin(a)*radius*.92):p.moveTo(Math.cos(a)*radius*.92,Math.sin(a)*radius*.92);}p.strokeStyle='#ffd9cc78';p.stroke();
          for(let i=0;i<20;i++){const a=i*Math.PI/10;p.beginPath();p.moveTo(Math.cos(a)*radius*.98,Math.sin(a)*radius*.98);p.lineTo(Math.cos(a)*radius*1.04,Math.sin(a)*radius*1.04);p.stroke();}
        }
        for(let i=0;i<5;i++){
          p.save();p.rotate(i*Math.PI*2/5);p.beginPath();p.moveTo(0,0);p.bezierCurveTo(-radius*.55,-radius*.34,-radius*.36,-radius*.76,0,-radius*.9);p.bezierCurveTo(radius*.36,-radius*.76,radius*.55,-radius*.34,0,0);
          if(kind==='bloom'){const petal=p.createLinearGradient(0,0,0,-radius);petal.addColorStop(0,'#fff9ee');petal.addColorStop(.25,'#ffe5f4e8');petal.addColorStop(.65,'#f8a6d3b8');petal.addColorStop(1,'#d977ba80');p.fillStyle=petal;}else p.fillStyle='#ea86c75c';
          p.fill();if(kind==='seal'){p.lineWidth=7;p.strokeStyle='#bd509b';p.stroke();p.lineWidth=3.6;}p.strokeStyle='#ffe4ef';p.stroke();p.beginPath();p.moveTo(0,-radius*.08);p.lineTo(0,-radius*.76);p.strokeStyle='#fff4d6bb';p.stroke();p.restore();
        }
        if(kind==='seal')for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;horasStar(p,Math.cos(a)*radius,Math.sin(a)*radius,8);}
        blossom(p,0,0,mid*.15,0,true);
      }
    }
    horasFxSources.set(kind,image);return image;
  }
  function horasGlow(c,x,y,r,alpha=1){c.save();c.globalAlpha*=alpha;c.imageSmoothingEnabled=true;c.drawImage(horasFx('glow'),x-r,y-r,r*2,r*2);c.restore();}
  function horasFaceSource(){
    if(!horasCutinLoaded)return null;
    if(!horasCutinSource){horasCutinSource=document.createElement('canvas');horasCutinSource.width=500;horasCutinSource.height=350;horasCutinSource.getContext('2d').drawImage(horasCutinImage,60,80,500,350,0,0,500,350);}
    return horasCutinSource;
  }
  // Canvas painting is deferred by Chromium. Materialize each small source in
  // its own idle task while the existing boot screen is up, rather than making
  // the first real ultimate flush four cold gradients on the battle rAF.
  function scheduleHorasWarm(){
    if(horasWarmScheduled||!horasWarmQueue.length)return;
    horasWarmScheduled=true;
    const run=()=>{horasWarmScheduled=false;horasWarmQueue.shift()();scheduleHorasWarm();};
    if(window.requestIdleCallback&&!document.hidden)window.requestIdleCallback(run,{timeout:120});else setTimeout(run,0);
  }
  function warmHorasSource(kind){
    if(horasWarmPending.has(kind))return horasWarmPending.get(kind);
    const promise=new Promise(resolve=>{horasWarmQueue.push(()=>{
      try{const source=kind==='face'?horasFaceSource():horasFx(kind);if(source&&!horasMaterialized.has(source)){source.getContext('2d').getImageData(0,0,source.width,source.height);horasMaterialized.add(source);}}
      catch{/* The normal lazy draw path remains available after context loss. */}
      finally{horasWarmPending.delete(kind);resolve();}
    });});
    horasWarmPending.set(kind,promise);scheduleHorasWarm();return promise;
  }
  function warmHorasEffects(){return Promise.all(['glow','seal','bloom','beam'].map(warmHorasSource));}
  function horasLabel(c,text,x,y,size=9){const mirrored=c.getTransform().a<0;c.save();c.translate(x,y);if(mirrored)c.scale(-1,1);c.font=`${size}px Galmuri, monospace`;c.textAlign='center';c.fillStyle='#ffe4ed';c.fillText(text,0,0);c.restore();}
  function blossom(c,x,y,r=4,rotation=0,bright=false) {
    c.save();c.translate(x,y);c.rotate(rotation);
    c.fillStyle=bright?'#fff5ee':'#ffc2e6';
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;c.beginPath();c.ellipse(Math.cos(a)*r*.48,Math.sin(a)*r*.48,r*.39,r*.6,a-Math.PI/2,0,Math.PI*2);c.fill();}
    rect(c,'#ffe7a3',-r*.14,-r*.14,r*.28,r*.28);c.restore();
  }
  function horasStar(c,x,y,r,rotation=0){
    c.save();c.translate(x,y);c.rotate(rotation);c.fillStyle='#fff2bb';c.beginPath();
    for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?r*.23:r;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();c.restore();
  }
  // Pose changes have distinct anticipation, acceleration and recovery beats.
  // This is presentation time only: damage, cooldowns and network clocks never pause.
  function horasMotion(frame) {
    const m={pose:0,x:0,y:0,lean:0,sx:1,sy:1,trail:0,cloth:0};
    if(frame.dead)return m;
    const ease=t=>{t=clamp01(t);return 1-(1-t)*(1-t)*(1-t);};
    const mix=(a,b,t)=>a+(b-a)*t,cast=frame.horasCastAge,age=frame.attackAge,second=frame.horasBasicPose===2;
    if(Number.isFinite(cast)&&cast>=0&&cast<2.45){
      let t=cast;
      // A short held release pose gives the impact weight without dropping frames.
      if(t>=1.5&&t<1.565)t=1.5;
      if(t<.28){const p=ease(t/.28);Object.assign(m,{pose:7,x:-3*p,y:2*p,lean:-.075*p,sx:1+.035*p,sy:1-.045*p});}
      else if(t<.82){const p=ease((t-.28)/.54);Object.assign(m,{pose:8,x:mix(-3,-1,p),y:mix(2,-5,p),lean:mix(-.075,-.025,p),sy:1+.025*p});}
      else if(t<1.38){const p=ease((t-.82)/.56);Object.assign(m,{pose:9,x:mix(-1,1.5,p),y:mix(-5,-10,p),lean:-.04,sy:1.035});}
      else if(t<1.5){const p=ease((t-1.38)/.12);Object.assign(m,{pose:10,x:mix(1.5,7,p),y:mix(-10,-1,p),lean:mix(-.04,.14,p),sx:1+.035*p,sy:1-.045*p,trail:1-p*.4});}
      else if(t<1.9){const p=clamp01((t-1.565)/.335);Object.assign(m,{pose:10,x:mix(7,3,ease(p)),y:Math.sin(p*Math.PI)*2.1-1*(1-p),lean:.14*(1-p),sx:1+.045*Math.sin(p*Math.PI),sy:1-.07*Math.sin(p*Math.PI)});}
      else{const p=ease((t-1.9)/.55);Object.assign(m,{pose:t<2.27?6:0,x:3*(1-p),y:-Math.sin(p*Math.PI)*.7,lean:.025*Math.sin(p*Math.PI)});}
      m.cloth=Math.sin(t*7-.7)*(t<1.5?1:Math.max(0,(2.45-t)/.95));
    }else if(Number.isFinite(age)&&age>=0&&age<1.18){
      const first=second?4:1;
      if(age<.18){const p=ease(age/.18);Object.assign(m,{pose:first,x:-2.6*p,y:1.1*p,lean:-.07*p,sx:1-.025*p,sy:1-.025*p});}
      else if(age<.34){const p=ease((age-.18)/.16);Object.assign(m,{pose:first+1,x:mix(-2.6,second?3.5:6,p),y:mix(1.1,second?-3.5:-.8,p),lean:mix(-.07,second?-.065:.10,p),trail:Math.sin(p*Math.PI)*.55});}
      else{const p=ease((age-.34)/.84),wave=Math.sin(p*Math.PI);Object.assign(m,{pose:age<.91?first+2:0,x:(second?3.5:6)*(1-p),y:(second?-3.5:-.8)*(1-p)-wave*.6,lean:(second?-.065:.10)*(1-p),sy:1+.018*wave});}
      m.cloth=Math.sin(age*8-1)*(1-clamp01((age-.35)/.83));
    }else if(frame.hit){m.pose=11;m.x=-1.5;}
    else m.y=0;
    if(frame.reduced)return {...m,x:0,y:0,lean:0,sx:1,sy:1,trail:0,cloth:0};
    return m;
  }
  function horasPose(frame) { return horasMotion(frame).pose; }
  function horas(c,x,y,scale,frame={}){
    if(window.SchoolHorasSkinArt?.active(frame.skin)){window.SchoolHorasSkinArt.hero(c,x,y,scale,frame);return;}
    c.save();c.translate(x,y);c.scale(scale*(frame.flip?-1:1),scale);
    if(frame.dead){c.globalAlpha*=.4;c.rotate(-Math.PI/2);}
    rect(c,'#26333b35',-9,1+(frame.shadowY||0),20,2);
    const cast=frame.horasCastAge,active=Number.isFinite(cast)&&cast>=0&&cast<2.45,age=frame.attackAge,attack=Number.isFinite(age)&&age>=0&&age<1.18;
    const wave=frame.reduced||frame.dead||!active&&!attack?0:Math.sin(clamp01((active?cast:age)/(active?1.5:1.05))*Math.PI);
    const merge=active?clamp01((cast-.22)/.63):0,stacks=frame.dead?0:active&&cast<1?5:Math.min(5,Math.max(0,frame.horasStacks||0));
    // The stack halo is behind her back, not a screen HUD effect. During the
    // fusion the same five visible orbs converge into her cupped hands.
    for(let i=0;i<stacks;i++){
      const p=HORAS_ORBS[i],t=active?merge*merge:0,bob=frame.reduced||active?0:Math.sin((frame.time||0)*2+i)*.65;
      const spin=frame.reduced?0:active?cast*3.5:(frame.time||0)*.24,
        orbitX=p.x+(active?Math.sin(spin+i*1.25)*7:Math.sin(spin+i)*1.3),orbitY=p.y+(active?Math.cos(spin+i*1.25)*5:0);
      const xx=orbitX+(11-orbitX)*t,yy=orbitY+(-27-orbitY)*t+bob;
      c.save();c.globalAlpha*=active?1-merge*.4:.82;
      if(active&&!frame.reduced){c.strokeStyle='#f6c7df55';c.lineWidth=.65;c.beginPath();c.moveTo(p.x,p.y);c.quadraticCurveTo(p.x-5,p.y-12,xx,yy);c.stroke();}
      horasGlow(c,xx,yy,active?8:5.5,.72);c.strokeStyle='#ffe0d6';c.lineWidth=.55;c.beginPath();c.arc(xx,yy,active?4:3.5,0,Math.PI*2);c.stroke();
      blossom(c,xx,yy,active?3.1:2.5,(frame.reduced?0:(frame.time||0)*.2)+i);c.restore();
    }
    const motion=horasMotion(frame),pose=motion.pose;
    c.translate(motion.x,motion.y);c.rotate(motion.lean);c.scale(motion.sx,motion.sy);
    if(!frame.reduced&&!frame.dead&&(active||attack)){
      // Small trailing strokes sit behind the existing long ponytail and ribbons.
      c.save();c.lineCap='round';c.strokeStyle='#db8dbd';c.lineWidth=1.6;
      c.beginPath();c.moveTo(-7,-35);c.bezierCurveTo(-20,-34,-13-motion.cloth*3,-17,-20-motion.cloth*2,-15);c.stroke();
      c.strokeStyle='#bfc9ee';c.lineWidth=1.2;c.beginPath();c.moveTo(-5,-20);c.bezierCurveTo(-13,-16,-16-motion.cloth*3,-8,-24-motion.cloth*2,-9);c.stroke();c.restore();
    }
    if(horasLoaded){
      const transform=c.getTransform(),density=Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d));
      const resolution=density>4?6:density>2?4:2,key=`${pose}:${resolution}`;
      let source=horasPoses.get(key);
      const unit=44/HORAS_ATLAS.bodyHeight,w=HORAS_ATLAS.width*unit,h=HORAS_ATLAS.height*unit;
      if(!source){
        source=document.createElement('canvas');source.width=Math.ceil(w*resolution);source.height=Math.ceil(h*resolution);
        const sc=source.getContext('2d');sc.imageSmoothingEnabled=false;
        const cw=horasImage.naturalWidth/HORAS_ATLAS.columns,ch=horasImage.naturalHeight/HORAS_ATLAS.rows;
        sc.drawImage(horasImage,pose%4*cw,Math.floor(pose/4)*ch,cw,ch,0,0,source.width,source.height);
        while(horasPoses.size&&horasPosePixels+source.width*source.height>2*1024*1024){const k=horasPoses.keys().next().value,old=horasPoses.get(k);horasPosePixels-=old.width*old.height;horasPoses.delete(k);}
        horasPoses.set(key,source);horasPosePixels+=source.width*source.height;
      }
      if(motion.trail&&!frame.reduced){c.save();c.globalAlpha*=motion.trail*.22;c.drawImage(source,-HORAS_ATLAS.footX*unit-3,3-HORAS_ATLAS.footY*unit+1,w,h);c.restore();}
      c.drawImage(source,-HORAS_ATLAS.footX*unit,3-HORAS_ATLAS.footY*unit,w,h);
    }else{
      // A recognisable, readable fallback while optional art is loading.
      rect(c,'#a45591',-11,-38,13,30);rect(c,'#f1a3d2',-10,-39,11,28);
      rect(c,'#d28ab8',-8,-41,17,16);rect(c,'#ffe5e1',-3,-36,12,11);rect(c,'#f7b4df',-7,-41,15,9);
      polygon(c,'#f1abd5',[[-8,-39],[-10,-47],[-1,-42]]);polygon(c,'#f1abd5',[[3,-41],[10,-46],[9,-36]]);
      rect(c,'#654764',5,-32,2,3);rect(c,'#c4d5ff',5,-32,1,1);
      polygon(c,'#b9c5f3',[[-5,-25],[8,-25],[13,-9],[-10,-9]]);rect(c,'#e4ecff',-4,-24,11,10);
      polygon(c,'#d6ddff',[[-1,-24],[-10,-29],[-11,-20],[-1,-21],[9,-27],[12,-19],[-1,-21]]);
      const hand=attack?7+wave*8:7;rect(c,'#cbd7ff',hand,-24,8,9);rect(c,'#ffe8e7',hand+5,-25,4,3);
      rect(c,'#f5efff',-5,-9,4,10);rect(c,'#f5efff',4,-9,4,10);rect(c,'#a5cfce',-6,0,7,3);rect(c,'#a5cfce',3,0,8,3);
    }
    if(active&&cast<1.48){const coreY=cast<.92?-27:-27-clamp01((cast-.92)/.56)*18;c.save();c.globalAlpha*=.45+merge*.5;horasGlow(c,11,coreY,6+merge*8,.9);blossom(c,11,coreY,2+merge*4,frame.reduced?0:cast*.35,true);c.restore();}
    c.restore();
  }
  function horasIllustration(c,x,y,w,h){
    if(!horasPortraitLoaded){horas(c,x,y+h-3,Math.min(w/50,h/48),{reduced:true});return;}
    const transform=c.getTransform(),density=Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d)),resolution=density>4?6:density>2?4:2;
    const ratio=horasPortraitImage.naturalWidth/horasPortraitImage.naturalHeight,height=Math.min(h,w/ratio),width=height*ratio;
    const key=`${Math.ceil(width*resolution)}:${Math.ceil(height*resolution)}`;
    let image=horasPortraitSources.get(key);
    if(!image){image=document.createElement('canvas');image.width=Math.ceil(width*resolution);image.height=Math.ceil(height*resolution);const sc=image.getContext('2d');sc.imageSmoothingEnabled=true;sc.imageSmoothingQuality='high';sc.drawImage(horasPortraitImage,0,0,image.width,image.height);if(horasPortraitSources.size>=5)horasPortraitSources.delete(horasPortraitSources.keys().next().value);horasPortraitSources.set(key,image);}
    c.save();c.imageSmoothingEnabled=true;c.drawImage(image,x-width/2,y+(h-height),width,height);c.restore();
  }
  function horasSeal(c,x,y,r,age,reduced=false){
    c.save();c.translate(x,y);c.scale(1,.57);c.rotate(reduced?0:age*.12);c.imageSmoothingEnabled=true;c.drawImage(horasFx('seal'),-r,-r,r*2,r*2);c.restore();
  }
  function horasCutin(c,age,reduced=false){
    if(reduced||!Number.isFinite(age)||age<.58||age>1.16)return;
    const enter=clamp01((age-.58)/.13),leave=clamp01((1.16-age)/.15);
    c.save();c.globalAlpha*=Math.min(enter,leave)*.96;
    const bounds=sceneBounds(c.canvas);rect(c,'#1a102a38',bounds.x,bounds.y,bounds.width,bounds.height);
    c.translate((1-enter)*-32+(1-leave)*12,0);
    c.beginPath();c.moveTo(0,46);c.lineTo(309,14);c.lineTo(282,101);c.lineTo(0,131);c.closePath();c.clip();
    rect(c,'#21142ef5',0,0,320,140);horasGlow(c,100,70,112,.45);
    c.strokeStyle='#f4b3dd40';c.lineWidth=.7;for(let i=0;i<6;i++){c.beginPath();c.moveTo(0,51+i*16);c.lineTo(320,8+i*16);c.stroke();}
    // Cache the face crop, preserving the original heterochromia and design.
    if(horasCutinLoaded){
      c.save();c.imageSmoothingEnabled=true;c.drawImage(horasFaceSource(),2-enter*3,11,190,133);c.restore();
    }else horasIllustration(c,88,4,165,220);
    rect(c,'#24162bd6',171,26,141,76);
    c.textAlign='left';c.font='8px Galmuri, monospace';c.fillStyle='#f9c6df';c.fillText('UR · 호라스',177,48);
    c.font='18px Galmuri, monospace';c.fillStyle='#fff2d9';c.fillText('벚꽃의식',174,74);
    c.font='6.5px Galmuri, monospace';c.fillStyle='#eec9e4';c.fillText('다섯 별빛, 하나의 운명',177,88);
    c.strokeStyle='#ffe4c9';c.lineWidth=1.2;c.beginPath();c.moveTo(0,47);c.lineTo(309,15);c.moveTo(0,130);c.lineTo(282,100);c.stroke();c.restore();
  }
  function horasCoopEffects(c,{unit,events,now,source,targets,scale=1,reduced=false,economy=false,frozen=false,time=0,viewport}){
    if(!window.SchoolHorasSkinArt?.active(unit?.skin)||unit.hp<=0||frozen||unit.stunUntil>time)return;
    const base={source,targets,scale,reduced,economy,time:now/1000,viewport};
    const cast=events.findLast(e=>e.id==='horas'&&e.kind==='cast'&&now>=e.shown&&now-e.shown<1500);
    if(cast)window.SchoolHorasSkinArt.effects(c,{...base,kind:'cast',age:(now-cast.shown)/1000});
    for(const e of events){const age=(now-e.shown)/1000;if(e.id!=='horas'||!['hit','immune','miss'].includes(e.kind)||age<0||age>1.5)continue;
      window.SchoolHorasSkinArt.effects(c,{...base,kind:e.skill||e.kind==='miss'?'impact':'basic',age:e.skill||e.kind==='miss'?age:age+.18,pose:unit.basicPose||1,missed:e.kind!=='hit'});
    }
  }
  function horasVisualEffects(c,battle,effects,positions,time,reduced=false,economy=false,interpolation=0,skipCutin=false){
    const source=positions.horas;if(!source)return;
    const caster=battle.heroes?.find(h=>h.id==='horas'),pending=caster?.hp<=0?null:battle.horasCast;
    const impact=lastEffect(effects,e=>e.kind==='horas-impact'&&time>=e.time&&time-e.time<1.2);
    const castEvent=lastEffect(effects,e=>e.kind==='horas-cast'&&time>=e.time&&(pending?e.castId===pending.id:impact?.castId===e.castId));
    const cast=pending||castEvent,scale=Math.max(.6,Math.min(2,battle.horasEffectScale||1));
    const age=pending?Math.max(0,(battle.elapsed-pending.began)/1000+interpolation):castEvent?time-castEvent.time:-1;
    const targetId=cast?.targetId||impact?.targetId,target=positions[targetId];
    if(window.SchoolHorasSkinArt?.active(caster?.skin)){
      if(caster.hp<=0||caster.stunUntil>battle.elapsed)return;
      const options={source,time,actorScale:battle.horasActorScale||(battle.heroes.length>3?1.3:1.8),scale,reduced,economy,flip:false,viewport:{width:c.canvas.width,height:c.canvas.height}};
      if(target&&age>=0&&age<1.5)window.SchoolHorasSkinArt.effects(c,{...options,kind:'cast',age,targets:[target]});
      for(const e of effects){const a=time-e.time;if(a<0)continue;
        if(e.kind==='horas-basic'&&a<1.18&&positions[e.to])window.SchoolHorasSkinArt.effects(c,{...options,kind:'basic',age:a,pose:e.pose,targets:[positions[e.to]]});
        if(e.kind==='horas-impact'&&a<1.5&&positions[e.targetId]){
          const ids=[e.targetId,...(e.targets||[]).map(t=>typeof t==='string'?t:t.id)];
          window.SchoolHorasSkinArt.effects(c,{...options,kind:'impact',age:a,missed:e.missed,targets:[...new Set(ids)].map(id=>positions[id]).filter(Boolean)});
          if(e.missed)horasLabel(c,'빗나감',positions[e.targetId].x,positions[e.targetId].y-79*scale-a*6,9*scale);
        }
      }
      return;
    }
    if(pending&&target&&age>=0&&age<1.5){
      const rise=clamp01((age-.82)/.5),skyY=Math.max(64*scale,target.y-141*scale),radius=(30+rise*39)*scale;
      c.save();c.globalAlpha*=Math.min(1,age*5);
      // Only this designated target receives the large reticle and sky seal.
      c.strokeStyle='#f8c1e2';c.lineWidth=1*scale;c.beginPath();c.ellipse(target.x,target.y+1,(20+rise*17)*scale,(5+rise*5)*scale,0,0,Math.PI*2);c.stroke();
      if(!reduced){c.strokeStyle='#ffebc58c';c.beginPath();c.moveTo(target.x-45*scale,target.y+1);c.lineTo(target.x-30*scale,target.y+1);c.moveTo(target.x+30*scale,target.y+1);c.lineTo(target.x+45*scale,target.y+1);c.stroke();}
      if(age>.82){horasGlow(c,target.x,skyY,radius*1.18,.3);horasSeal(c,target.x,skyY,radius,age,reduced);horasStar(c,target.x,skyY,5*scale,reduced?0:age*.4);}
      if(age>.95&&!reduced&&!economy){const p=clamp01((age-.95)/.45),x=source.x+17+(target.x-source.x-17)*p,y=source.y-48+(skyY-source.y+48)*p-Math.sin(p*Math.PI)*32*scale;horasGlow(c,x,y,8*scale,.65);blossom(c,x,y,4*scale,age,true);}
      c.restore();
    }
    for(const e of effects){
      const a=time-e.time;if(a<0)continue;
      if(e.kind==='horas-basic'&&a<.9){
        const to=positions[e.to];if(!to)continue;
        const p=clamp01((a-.18)/.4),f=1-clamp01((a-.65)/.25),direction=e.pose===2?-1:1;
        c.save();c.globalAlpha*=f;c.strokeStyle='#edacd9';c.lineWidth=2;
        if(a>.15&&a<.48){c.save();c.globalAlpha*=Math.sin(clamp01((a-.15)/.33)*Math.PI);c.beginPath();c.ellipse(source.x+11,source.y-35,e.pose===2?24:20,e.pose===2?19:11,direction*.35,-1.8+direction*a*3,.5+direction*a*3);c.stroke();c.restore();}
        if(a>.18){const x=source.x+16+(to.x-source.x-16)*p,y=source.y-36+(to.y-29-source.y+36)*p-Math.sin(p*Math.PI)*9*direction;horasStar(c,x,y,4.4,reduced?0:a*3);if(!reduced)for(let i=1;i<(economy?2:4);i++)blossom(c,x-i*5,y+Math.sin(i+a*5)*3,1.7,a+i);}
        c.restore();
      }else if(e.kind==='horas-impact'&&a<1.2){
        const p=positions[e.targetId];if(!p)continue;
        const hitX=p.x+(e.missed?36*scale:0),skyY=Math.max(64*scale,p.y-141*scale),fade=1-clamp01((a-.55)/.65);
        c.save();c.globalAlpha*=fade;
        horasSeal(c,hitX,skyY,69*scale,a+1.5,reduced);
        if(a<.46){const strength=1-clamp01(a/.46),beam=(reduced?22:e.missed?30:42+Math.sin(clamp01(a/.25)*Math.PI)*15)*scale;c.save();c.globalAlpha*=strength*(e.missed?.58:1);c.imageSmoothingEnabled=true;c.drawImage(horasFx('beam'),hitX-beam,skyY,beam*2,p.y-skyY);if(!e.missed){c.fillStyle='#fff6e4';c.fillRect(hitX-2.6*scale,skyY,5.2*scale,p.y-skyY);c.fillStyle='#ffdef0b3';c.fillRect(hitX-7*scale,skyY,1.1*scale,p.y-skyY);c.fillRect(hitX+6*scale,skyY,1.1*scale,p.y-skyY);}c.restore();}
        if(!reduced&&a<.5){c.save();c.globalAlpha*=.5*(1-a/.5);c.strokeStyle='#e7b8db';c.lineWidth=.8;c.beginPath();c.ellipse(source.x+5,source.y+2,8+a*27,2+a*6,0,0,Math.PI*2);c.stroke();c.restore();}
        if(e.missed){
          // A miss falls in empty space. No blossom impact, splash, ground
          // shockwave or new mark may visually imply that the enemy was hit.
          horasLabel(c,'빗나감',p.x,p.y-79*scale-a*6,9*scale);
        }else{
          const bloom=(reduced?43:22+clamp01((a-.025)/.28)*55)*scale,spread=(reduced?42:24+clamp01(a/.7)*43)*scale;
          horasGlow(c,hitX,p.y-21*scale,bloom*1.25,.8);
          c.save();c.imageSmoothingEnabled=true;c.globalAlpha*=reduced?.6:Math.min(1,a*16+.15)*.83;c.drawImage(horasFx('bloom'),hitX-bloom,p.y-bloom*1.65,bloom*2,bloom*2);c.restore();
          c.strokeStyle='#ffdaf0';c.lineWidth=1.5*scale;c.beginPath();c.ellipse(hitX,p.y+1,spread,spread*.24,0,0,Math.PI*2);c.stroke();
          c.strokeStyle='#ffedbe9c';c.lineWidth=.7*scale;c.beginPath();c.ellipse(hitX,p.y+1,spread*.77,spread*.18,0,0,Math.PI*2);c.stroke();
          if(!reduced)for(let i=0,n=economy?6:12;i<n;i++){const v=HORAS_PETALS[i],reach=(8+a*v.reach)*scale,x=hitX+Math.cos(v.angle)*reach,y=p.y-22*scale+Math.sin(v.angle)*reach*.45-Math.sin(clamp01(a/1.2)*Math.PI)*v.lift*scale;c.save();c.translate(x,y);c.rotate(v.turn+a*.7);c.fillStyle=i%3?'#ffc5e4':'#ffefce';c.beginPath();c.ellipse(0,0,3.1*scale,1.3*scale,0,0,Math.PI*2);c.fill();c.restore();}
          for(const entry of e.targets||[]){const id=typeof entry==='string'?entry:entry.id;if(id===e.targetId)continue;const q=positions[id];if(q){c.save();c.globalAlpha*=.48;c.strokeStyle='#fbb5e0';c.lineWidth=.7*scale;c.beginPath();c.ellipse(q.x,q.y,(9+a*13)*scale,(3+a*3)*scale,0,0,Math.PI*2);c.stroke();blossom(c,q.x,q.y-24*scale,3.5*scale,a);c.restore();}}
        }
        c.restore();
      }else if(e.kind==='hit'&&e.from==='horas'&&e.stunBonus&&a<.7){
        const p=positions[e.to];if(!p)continue;c.save();c.globalAlpha*=1-a/.7;
        c.font='8px Galmuri, monospace';c.textAlign='left';rect(c,'#48253ce8',p.x+10,p.y-53,33,13);blossom(c,p.x+15,p.y-47,2.4);c.fillStyle='#ffe9cd';c.fillText('×1.5',p.x+20,p.y-43);c.restore();
      }else if(e.kind==='horas-refund'&&a<.9){
        const from=positions[e.to];if(!from)continue;
        c.save();c.globalAlpha*=1-clamp01((a-.6)/.3);
        for(let i=0;i<Math.min(2,e.amount??2);i++){const p=reduced?1:clamp01((a-i*.09)/.65),x=from.x+(source.x-20-from.x)*p,y=from.y-45+(source.y-44-from.y+45)*p-Math.sin(p*Math.PI)*(18+i*9);blossom(c,x,y,4,a+i);}
        c.restore();
      }
    }
    for(const enemy of battle.enemies||[]){if(enemy.hp<=0||!enemy.horasMark||(enemy.horasMark.until||0)<=battle.elapsed||impact?.missed&&enemy.horasMark.castId===impact.castId)continue;const p=positions[enemy.id];if(!p)continue;c.save();const y=p.y-(enemy.boss?122:84)*scale-((enemy.stunUntil||0)>battle.elapsed?23*scale:0);c.globalAlpha=.9;horasGlow(c,p.x,y,11*scale,.48);blossom(c,p.x,y,7*scale,reduced?0:time*.18);c.restore();}
    if(!skipCutin&&!battle.skipHorasCutin&&pending)horasCutin(c,age,reduced);
  }
  function osiaFigure(c, time = 0, frame = {}) {
    const reduced = !!frame.reduced, breath = reduced ? 0 : Math.sin(time * 1.6) * .4;
    if (frame.charge !== undefined) {
      // The dragon cut-in uses the actual right-facing combat art: gather,
      // then release. Never replace Osia's face/clothes with a block figure.
      const phase = clamp01(frame.charge), pose = reduced ? 1 : phase < .18 ? 0 : phase < .64 ? 1 : 2;
      osia(c, reduced ? 0 : Math.sin(phase * Math.PI) * 1.5, breath, 1.6, {pose,reduced});
      return;
    }
    if (osiaFrontLoaded) {
      const transform = c.getTransform(), density = Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d));
      const resolution = density > 4 ? 6 : density > 2 ? 4 : 2, height = 66, width = height * osiaFrontImage.naturalWidth / osiaFrontImage.naturalHeight;
      let source = osiaFrontSources.get(resolution);
      if (!source) {
        source = document.createElement('canvas'); source.width = Math.ceil(width*resolution); source.height = height*resolution;
        const sc = source.getContext('2d'); sc.imageSmoothingEnabled = false;
        sc.drawImage(osiaFrontImage,0,0,source.width,source.height); osiaFrontSources.set(resolution,source);
      }
      // A small whole-pose breath preserves the restored front-view artwork.
      c.drawImage(source,-width/2,-62+breath,width,height);
    } else {
      // Keep the detailed original visible if the new portrait is slow/offline.
      osia(c,0,breath,1.6,{pose:0,reduced});
    }
  }
  function recruitPortrait(c,id,time=0,reduced=false){
    const w=c.canvas.width,h=c.canvas.height;c.save();c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;
    const z=Math.min(w/62,h/86),breath=reduced?0:Math.sin(time*1.6)*.6;
    c.translate(w/2,h*.88);c.scale(z,z);
    if(id==="hyeokjin")hero(c,id,0,breath,1.95,{time,reduced});
    else if(id==="kazua")window.SchoolKazuaArt?.illustration(c,0,-76+breath,62,80);
    else if(id==="ryusion")window.SchoolRyusion.illustration(c,0,-76+breath,62,80);
    else if(id==='spica'&&spicaPortraitLoaded){const ratio=spicaPortraitImage.naturalWidth/spicaPortraitImage.naturalHeight,height=80;c.drawImage(spicaPortraitImage,-height*ratio/2,-76,height*ratio,height);}
    else if(id==="horas")horasIllustration(c,0,-76+breath,62,80);
    else if(id==="osia")osiaFigure(c,time,{reduced,blink:!reduced&&time%5>4.85});
    else if(id==="lava"){c.translate(-3,0);c.scale(1.38,1.38);lavaFigure(c,time,{reduced,blink:!reduced&&time%5>4.85},true);}
    else hero(c,id,0,breath,1.4,{blink:!reduced&&time%5>4.85});
    c.restore();
  }
  function frontPortrait(id){
    if(!frontPortraits.has(id)){const canvas=document.createElement("canvas");canvas.width=248;canvas.height=344;recruitPortrait(canvas.getContext("2d"),id,0,true);frontPortraits.set(id,canvas.toDataURL());}
    return frontPortraits.get(id);
  }
  // The feet remain planted: one cheap transform per actor, no animated
  // canvases or ever-growing frame cache. Different cadences avoid a chorus
  // of identical movement, while static portraits remain perfectly still.
  function idleBreath(id,frame={}){
    if(id==='hyeokjin')return null;
    if(id==='kazua'&&frame.kazuaActive!==false&&frame.kazuaMode&&frame.kazuaMode!=='idle')return null;
    if(!Number.isFinite(frame.time)||frame.reduced||frame.dead||frame.frozen||frame.stunned||frame.hit||frame.attack||frame.casting||frame.passive||frame.motion||Number.isFinite(frame.attackAge)&&frame.attackAge>=0||Number.isFinite(frame.horasCastAge)&&frame.horasCastAge>=0)return null;
    let seed=0;for(let i=0;i<id.length;i++)seed=(seed*31+id.charCodeAt(i))>>>0;
    const breath=(Math.sin(frame.time*(1.4+(seed%5)*.08)+(seed%17)*.35)+1)*.5;
    return {x:1+breath*.007,y:1+breath*.018};
  }
  function spica(c,x,y,scale,frame={}){
    c.save();c.translate(x,y);c.scale(scale*(frame.flip?-1:1),scale);
    if(frame.dead)c.globalAlpha*=.42;
    rect(c,'#1b334333',-10,1,21,2);
    const age=Number.isFinite(frame.attackAge)?frame.attackAge:frame.attack?.3:0,attack=!!frame.attack||Number.isFinite(frame.attackAge)&&frame.attackAge>=0&&frame.attackAge<.85;
    const basicPose=frame.reduced?2:age<.18?1:age<.52?2:age<.78?3:0;
    const pose=Math.max(0,Math.min(7,Math.trunc(frame.dead?7:frame.hit?0:frame.pose??(frame.casting?5:attack?basicPose:0))));
    if(frame.motion)c.transform(1,0,frame.motion.lean||0,frame.motion.stretch||1,0,0);
    if(frame.dead)c.transform(1,0,-.14,.8,0,0);
    else if(frame.hit&&!frame.reduced)c.transform(1,0,-.065,.98,0,0);
    if(spicaLoaded){
      const transform=c.getTransform(),density=Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d)),res=density>4?6:density>2?4:2,key=pose+':'+res;
      const cell=SPICA_FRAMES[pose];
      let source=spicaPoses.get(key);if(!source){source=document.createElement('canvas');source.width=64*res;source.height=Math.round(source.width*cell[3]/cell[2]);const sc=source.getContext('2d');sc.imageSmoothingEnabled=false;sc.drawImage(spicaImage,cell[0],cell[1],cell[2],cell[3],0,0,source.width,source.height);spicaPoses.set(key,source);}
      // Poses were drawn with different hand extensions. Align measured feet,
      // not cell centers, so switching between haste and slow never teleports.
      const unit=46/340;
      c.drawImage(source,-cell[4]*unit,-cell[5]*unit,cell[2]*unit,cell[3]*unit);
    }else{
      // Right-facing, deliberately modest pixel fallback matching the supplied
      // indigo hair, pale tips, black choker and slate winter dress.
      const ink='#24324b',dark='#405675',cloth='#6d879b',pale='#dceef5',skin='#e3e1dc',gesture=frame.reduced?0:Math.sin(clamp01(age/.85)*Math.PI);
      rect(c,ink,-10,-42,20,20);rect(c,'#5473ad',-9,-41,18,17);rect(c,'#88a4ce',-7,-42,12,3);
      rect(c,dark,-8,-24,17,24);rect(c,cloth,-7,-23,15,21);rect(c,'#8ba7b6',-7,-23,5,19);
      rect(c,'#bacbd0',-9,-4,20,5);detail(c,'#d2e1df',-9,-3,19,1);rect(c,'#3e4c60',-7,0,8,3);rect(c,'#3e4c60',3,0,8,3);
      rect(c,skin,-4,-36,12,13);rect(c,skin,8,-32,3,4);rect(c,'#b7c4d3',-2,-25,9,2);rect(c,ink,-3,-23,11,2);
      rect(c,'#4b68a0',-9,-41,18,6);rect(c,'#3f568c',-10,-36,5,13);rect(c,'#6382b5',-5,-38,6,7);rect(c,'#435c98',4,-38,6,5);
      rect(c,pale,-9,-27,6,10);rect(c,'#accde0',-8,-28,4,8);rect(c,pale,7,-29,5,12);rect(c,'#bfdde9',8,-27,3,8);
      rect(c,ink,5,-32,3,frame.blink?1:2);detail(c,'#a4dce9',6,-32,1,1);detail(c,'#b58f99',5,-26,3,.5);
      c.save();c.translate(7,-21);c.rotate(frame.casting?-.65:attack?-.3-gesture*.75:.15);rect(c,dark,-1,-1,6,15);rect(c,cloth,0,0,4,12);rect(c,skin,0,11,5,4);c.restore();
      c.save();c.translate(-7,-21);c.rotate(frame.casting?.75:.12);rect(c,dark,-4,-1,6,14);rect(c,cloth,-3,0,4,11);rect(c,skin,-3,10,4,4);c.restore();
      if(frame.casting){c.strokeStyle='#b9eaff';c.lineWidth=.7;c.beginPath();c.ellipse(0,-12,21,8,0,0,Math.PI*2);c.stroke();}
    }
    c.restore();
  }
  function hero(c, id, x, y, scale = 2, frame = {}) {
    if(frame.dead||frame.frozen||frame.stunned)frame={...frame,time:0,reduced:true,attack:false,attackAge:undefined,basicAttackAt:undefined,casting:false,motion:undefined,passive:false,horasCastAge:-1};
    const breath=idleBreath(id,frame);
    if(breath){c.save();c.translate(x,y);c.scale(breath.x,breath.y);c.translate(-x,-y);}
    try{drawHero(c,id,x,y,scale,frame);}finally{if(breath)c.restore();}
  }
  function drawHero(c, id, x, y, scale = 2, frame = {}) {
    if(window.SchoolRosterArt?.draw(c,id,x,y,scale,frame))return;
    // Animated actors must receive the live frame, never the generic idle sprite cache.
    if (id === "osia" || id === "lava" || id === "horas" || id === "ryusion" || id==='spica' || id==='kazua' || id==='hyeokjin') { heroShape(c, id, x, y, scale, frame); return; }
    const transform = c.getTransform(), density = Math.max(Math.hypot(transform.a, transform.b), Math.hypot(transform.c, transform.d)) * scale;
    const resolution = density > 6 ? 8 : density > 4 ? 6 : density > 2 ? 4 : 2;
    const key = `${id}:${+!!frame.attack}:${+!!frame.blink}:${resolution}`;
    let sprite = sprites.get(key);
    if (!sprite) {
      sprite = document.createElement("canvas"); sprite.width = 56 * resolution; sprite.height = 56 * resolution;
      const sc = sprite.getContext("2d"); sc.scale(resolution, resolution); sc.imageSmoothingEnabled = false;
      heroShape(sc, id, 25, 49, 1, {attack:frame.attack,blink:frame.blink});
      while (sprites.size && spritePixels + sprite.width * sprite.height > SPRITE_PIXEL_LIMIT) {
        const oldest = sprites.keys().next().value, old = sprites.get(oldest);
        spritePixels -= old.width * old.height; sprites.delete(oldest);
      }
      sprites.set(key, sprite); spritePixels += sprite.width * sprite.height;
    } else { sprites.delete(key); sprites.set(key, sprite); }
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale * (frame.flip ? -1 : 1), scale);
    if (frame.dead) { c.globalAlpha *= .4; c.rotate(-Math.PI / 2); }
    c.drawImage(sprite, -25, -49, 56, 56); c.restore();
  }
  function hyeokjinFrame(unit,time){return window.SchoolHyeokjinArt?.frame(unit,time)||{};}
  function kazuaFrame(unit,time,sampledTime=time){
    const q=unit.kazua;if(unit.id!=='kazua')return {};
    // A pistol/bazooka pauses the current belt. Resume its actual phase instead
    // of restarting the whole 2-second reload every time a weapon is swapped.
    const age=q&&q.mode===q.phase&&Number.isFinite(q.phaseMs)?q.phaseMs/1000+Math.max(0,Math.min(.5,(time-sampledTime)/1000)):(time-(q?.modeSince||0))/1000;
    return {kazuaMode:q?.mode||'idle',kazuaAge:Math.max(0,age),kazuaLastStand:Math.max(0,((q?.power||1)-1)/.8)};
  }
  function kazuaCampaignVisual(unit,battle,effects,time,interpolation=0){
    if(!unit)return {frame:{},targets:[]};
    let frame=kazuaFrame(unit,battle.elapsed+interpolation*1000,battle.elapsed);
    if(unit.hp<=0||battle.phase!=='fight'||unit.stunUntil>battle.elapsed)return {frame,targets:[]};
    // Fast-forward steps can finish a short weapon swap before the next paint.
    // The most recent shot supplies both the pose and its actual hit targets.
    // A killed target must not move that shot onto the next living monster.
    const shot=lastEffect(effects,e=>e.kind==='kazua-shot'&&e.from==='kazua'&&(!e.battleId||e.battleId===battle.id)&&time>=e.time&&time-e.time<1.5);
    const age=shot?time-shot.time:Infinity,active=age<(shot?.mode==='bazooka'?1.5:.55);
    if(active&&frame.kazuaMode!=='red'&&['pistol','bazooka'].includes(shot.mode))frame={...frame,kazuaMode:shot.mode,kazuaAge:age};
    const targets=active&&shot.mode===frame.kazuaMode?(shot.targets||[]).map(id=>battle.enemies.find(e=>e.id===id)).filter(Boolean):battle.enemies.filter(e=>e.hp>0);
    return {frame,targets};
  }
  function heroShape(c, id, x, y, scale = 2, frame = {}) {
    if(id==='hyeokjin'&&window.SchoolHyeokjinArt){window.SchoolHyeokjinArt.hero(c,x,y,scale,frame);return;}
    if(id==='kazua'&&window.SchoolKazuaArt){window.SchoolKazuaArt.hero(c,x,y,scale,frame);return;}
    if(id==='spica'){spica(c,x,y,scale,frame);return;}
    if(id==="ryusion"){window.SchoolRyusion.draw(c,x,y,scale,frame);return;}
    if (id === "osia") { osia(c, x, y, scale, frame); return; }
    if (id === "lava") { lava(c, x, y, scale, frame); return; }
    if (id === "horas") { horas(c, x, y, scale, frame); return; }
    const h = S.BY_ID[id], index = S.HEROES.indexOf(h), dead = frame.dead;
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale * (frame.flip ? -1 : 1), scale);
    if (dead) { c.globalAlpha = .4; c.rotate(-Math.PI / 2); }
    const skin = index % 3 === 0 ? "#efc69a" : "#f4d6b3", dark = "#263340", boot = "#3b3840";
    rect(c, "#26333b35", -9, -1, 20, 3);
    if (["ian", "lumi", "siu"].includes(id)) { rect(c, dark, -10, -21, 6, 19); rect(c, h.color, -9, -20, 3, 16); }
    if (["yuna", "seoyun", "nari", "lumi"].includes(id)) rect(c, h.hair, -8, -30, 16, 18);
    rect(c, dark, -7, -16, 14, 15); rect(c, h.outfit, -6, -18, 13, 14);
    rect(c, "#f0e7d2", -4, -18, 8, 4); rect(c, h.color, -1, -16, 3, 8);
    rect(c, dark, -8, -19, 3, 13); rect(c, h.outfit, -7, -18, 3, 10);
    rect(c, skin, -7, -9, 3, 3); rect(c, dark, 5, -18, 4, 11); rect(c, h.outfit, 5, -17, 3, 8); rect(c, skin, 6, -9, 3, 4);
    rect(c, "#444e5a", -5, -5, 4, 6); rect(c, "#394451", 2, -5, 4, 6);
    rect(c, boot, -6, 0, 6, 3); rect(c, boot, 2, 0, 6, 3);
    detail(c, shade(h.outfit, 23), -6, -17.5, 1, 10); detail(c, shade(h.outfit, -22), 4.5, -14, 1.5, 9);
    detail(c, "#fff3d8", -3.5, -17.5, 2.5, 1); detail(c, "#fff3d8", 1.5, -17.5, 2, 1);
    detail(c, "#e6c77e", 1, -12.5, 1, 1); detail(c, "#e6c77e", 1, -9.5, 1, 1);
    detail(c, "#1b273b66", -4, -6.5, 8, 1); detail(c, "#657381", -4.5, -4, 1, 4);
    detail(c, "#74777c", -5.5, .5, 4, .5); detail(c, "#74777c", 2.5, .5, 3.5, .5);
    rect(c, dark, -7, -31, 14, 15); rect(c, skin, -6, -29, 12, 11); rect(c, "#d9a47e", -5, -20, 10, 3);
    rect(c, h.hair, -7, -32, 14, 6); rect(c, h.hair, -7, -28, 3, 7); rect(c, h.hair, 4, -28, 3, 4);
    rect(c, h.hair, -5, -34, 10, 3); rect(c, h.hair, -1, -29, 3, 4);
    if (id === "harin" || id === "seoyun") { rect(c, h.hair, -10, -30, 5, 13); rect(c, h.color, -9, -28, 4, 3); }
    if (id === "nari") { rect(c, h.hair, -10, -27, 4, 13); rect(c, h.hair, 7, -27, 4, 13); rect(c, "#e9c883", -10, -18, 4, 2); }
    if (id === "yuna") { rect(c, h.color, -10, -32, 4, 4); rect(c, "#efdab1", -6, -31, 3, 2); }
    if (id === "sua") { rect(c, "#f4edda", -8, -33, 16, 5); rect(c, "#c87b86", -1, -34, 3, 6); rect(c, "#c87b86", -3, -32, 7, 2); }
    if (id === "minjae") { rect(c, dark, -6, -26, 5, 4); rect(c, dark, 2, -26, 5, 4); rect(c, "#9ed9d7", -5, -25, 3, 2); rect(c, "#9ed9d7", 3, -25, 3, 2); rect(c, dark, -1, -25, 3, 1); }
    else { rect(c, dark, -4, -25, 2, frame.blink ? 1 : 3); rect(c, dark, 3, -25, 2, frame.blink ? 1 : 3); rect(c, "#e4ac91", -5, -22, 2, 1); }
    detail(c, shade(h.hair, 26), -5, -32, 7, 1); detail(c, shade(h.hair, 12), -5.5, -30.5, 2, 1);
    detail(c, shade(h.hair, -23), -7, -26, 1, 4); detail(c, "#fff0d9", -.5, -25, 1, 3);
    detail(c, "#b67d69", -.5, -20.5, 2.5, .5);
    if (!frame.blink && id !== "minjae") { detail(c, "#fff9ec", -3.5, -25, .5, 1); detail(c, "#fff9ec", 3.5, -25, .5, 1); }
    if (id === "jiho") { rect(c, "#313b47", -10, -28, 4, 8); rect(c, h.color, -9, -27, 2, 6); rect(c, "#313b47", -7, -35, 15, 3); }
    if (id === "geonu") { rect(c, "#3f4b43", -8, -34, 17, 7); rect(c, "#d5c8a4", -1, -34, 3, 7); }
    if (id === "siu" || id === "lumi") { rect(c, h.outfit, -11, -33, 24, 3); rect(c, h.outfit, -7, -37, 15, 5); rect(c, h.outfit, -4, -42, 9, 6); rect(c, "#f2d18d", -5, -35, 12, 2); rect(c, h.color, 0, -42, 3, 3); }
    if (id === "ian") { rect(c, "#eacb72", -7, -29, 14, 2); rect(c, "#f6e9b1", -2, -32, 3, 5); }
    const reach = frame.attack ? 5 : 0;
    if (h.weapon === "sword") { rect(c, dark, 10 + reach, -27, 3, 23); rect(c, "#dfdfd0", 11 + reach, -26, 1, 17); rect(c, "#e9bd66", 7 + reach, -9, 8, 3); rect(c, "#735449", 10 + reach, -6, 3, 6); }
    if (h.weapon === "shield") { rect(c, "#253b40", 5, -21, 14, 18); rect(c, "#b7c4ae", 6, -20, 12, 15); rect(c, h.color, 8, -18, 8, 11); rect(c, "#e5d5a8", 11, -17, 2, 8); }
    if (h.weapon === "bow") { rect(c, "#8c623b", 11 + reach, -28, 3, 23); rect(c, "#e5ba71", 14 + reach, -25, 3, 17); rect(c, "#f0dec1", 10 + reach, -27, 1, 21); }
    if (h.weapon === "staff") { rect(c, "#775946", 12, -31, 3, 33); rect(c, h.color, 9, -35, 9, 7); rect(c, "#fff0c9", 11, -34, 4, 3); }
    if (h.weapon === "heal") { rect(c, "#614c4c", 6, -15, 12, 11); rect(c, "#f0dfb9", 7, -14, 10, 9); rect(c, h.color, 11, -13, 2, 7); rect(c, h.color, 9, -11, 6, 2); }
    if (h.weapon === "flag") { rect(c, "#6f5140", 12, -34, 2, 35); rect(c, h.color, 14, -34, 12, 10); rect(c, "#ead9a9", 17, -31, 5, 3); }
    if (h.weapon === "shield") { detail(c, "#ecedcd", 6.5, -19, .5, 12); detail(c, "#6c846f", 17, -19, .5, 12); for (const [bx, by] of [[7,-19],[16,-19],[7,-7],[16,-7]]) detail(c, "#f6d78e", bx, by, .5, .5); }
    if (h.weapon === "staff") { detail(c, "#d4a679", 12, -29, .5, 27); detail(c, "#fffce6", 10, -34, 1, 1); detail(c, "#28334077", 16, -33, 1, 3); }
    if (h.weapon === "sword") { detail(c, "#fff9df", 11 + reach, -25, .5, 14); detail(c, "#b48c53", 10 + reach, -4, 3, .5); }
    c.restore();
  }
  function rosterPortrait(id,skin) { return portrait(id,skin); }
  function portrait(id,skin,density=1) {
    if(id==='horas'&&window.SchoolHorasSkinArt?.active(skin))return window.SchoolHorasSkinArt.portrait();
    const key=id+':'+density;if(portraits.has(key))return portraits.get(key);
    // One framed image shared by the codex, combat cards and formation UI.
    // Measure the body and weapon together so no head or shield is clipped.
    const raw=document.createElement("canvas");raw.width=256*density;raw.height=320*density;
    const c=raw.getContext("2d");c.imageSmoothingEnabled=false;hero(c,id,128*density,285*density,3*density,{time:0,reduced:true});
    const rw=raw.width,rh=raw.height,pixels=c.getImageData(0,0,rw,rh).data;let left=rw,right=-1,top=rh,bottom=-1;
    for(let y=0;y<rh;y++)for(let x=0;x<rw;x++)if(pixels[(y*rw+x)*4+3]>20){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    const canvas=document.createElement("canvas");canvas.width=160*density;canvas.height=192*density;const out=canvas.getContext("2d");out.imageSmoothingEnabled=false;
    if(right>=left){const w=right-left+1,h=bottom-top+1,k=Math.min(140*density/w,172*density/h),dw=Math.round(w*k),dh=Math.round(h*k);out.drawImage(raw,left,top,w,h,Math.round((160*density-dw)/2),180*density-dh,dw,dh);}
    const url=canvas.toDataURL();portraits.set(key,url);return url;
  }
  function towerBoss(c, theme, time, reduced) {
    const pulse=reduced?0:Math.sin(time*2)*2;
    const poly=(color,points)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
    if(theme==='library'){
      // A living grimoire with floating pages, not a recoloured humanoid.
      poly('#261c40',[[-23,-40],[0,-35],[23,-40],[24,-8],[0,-3],[-24,-8]]);
      poly('#bd8c74',[[-21,-38],[-2,-33],[-2,-6],[-21,-11]]);poly('#f0d9ac',[[2,-33],[21,-38],[21,-11],[2,-6]]);
      rect(c,'#57435e',-2,-35,4,32);for(let i=0;i<5;i++)rect(c,'#856773',5,-30+i*4,12,1);
      rect(c,'#16182c',-16,-24,10,5);rect(c,'#eee0ff',-14,-24,6,2);rect(c,'#56265d',6,-25,11,5);rect(c,'#db8bf5',8,-25,7,2);
      for(const side of [-1,1]){c.save();c.translate(side*31,-25+side*pulse);c.rotate(side*.2);rect(c,'#675c91',-7,-11,14,20);rect(c,'#eee1bf',-5,-9,10,16);for(let i=0;i<3;i++)rect(c,'#8c758f',-3,-6+i*4,6,1);c.restore();}
      poly('#c391e8',[[0,-57],[5,-49],[0,-41],[-5,-49]]);
    }else if(theme==='garden'){
      for(const side of [-1,1]){c.strokeStyle='#294b3d';c.lineWidth=7;c.beginPath();c.moveTo(side*7,-8);c.bezierCurveTo(side*35,-11,side*31,-35,side*20,-50);c.stroke();for(let i=0;i<4;i++)poly('#91ad68',[[side*(15+i*4),-9-i*9],[side*(31+i),-14-i*9],[side*(19+i*4),-21-i*8]]);}
      poly('#283d3d',[[-17,-37],[0,-51],[18,-35],[15,-11],[0,1],[-16,-13]]);poly('#6b8362',[[-13,-34],[0,-46],[13,-32],[10,-13],[0,-3],[-11,-15]]);
      poly('#e78baf',[[0,-39],[9,-29],[0,-16],[-9,-29]]);poly('#ffd1b4',[[0,-35],[4,-29],[0,-23],[-4,-29]]);
      rect(c,'#172a30',-12,-34,6,3);rect(c,'#172a30',6,-34,6,3);for(const x of [-20,-10,8,18])rect(c,'#3b5945',x,-4,7,7);
    }else if(theme==='clock'){
      rect(c,'#302c39',-20,-41,40,34);rect(c,'#bf8e48',-17,-39,34,29);rect(c,'#f0d18c',-13,-36,26,23);
      for(const [x,y] of [[-1,-34],[-1,-17],[-11,-27],[9,-27]])rect(c,'#544252',x,y,3,3);
      c.save();c.translate(0,-25);c.rotate(reduced?.5:time*.45);rect(c,'#394455',-1,-9,2,11);rect(c,'#394455',0,-1,8,2);c.restore();
      rect(c,'#664e45',-13,-11,9,11);rect(c,'#664e45',6,-11,9,11);rect(c,'#f1c679',-17,-2,14,5);rect(c,'#f1c679',5,-2,14,5);
      for(const side of [-1,1]){rect(c,'#785840',side<0?-30:21,-34,10,20);rect(c,'#ddbb70',side<0?-28:23,-32,6,15);rect(c,'#4c4051',side<0?-32:22,-16,12,8);}
      rect(c,'#715946',-5,-51,10,10);rect(c,'#e8d18c',-9,-53,18,5);rect(c,'#86d2de',-6,-44,12,3);
    }else if(theme==='astral'){
      c.strokeStyle='#a7a2ed';c.lineWidth=2;c.beginPath();c.ellipse(0,-28,30,12,reduced?.3:time*.4,0,Math.PI*2);c.stroke();
      poly('#262b5b',[[0,-62],[17,-35],[11,-15],[0,-2],[-13,-17],[-18,-37]]);poly('#7979d3',[[0,-58],[13,-35],[0,-27],[-14,-36]]);poly('#b8d9ff',[[0,-58],[0,-27],[-14,-36]]);poly('#6262bb',[[0,-27],[13,-35],[9,-16],[0,-6]]);poly('#c5a9f5',[[-14,-36],[0,-27],[0,-6],[-10,-18]]);
      rect(c,'#22224a',-7,-33,14,5);rect(c,'#fcdbfa',-5,-32,10,2);
      for(const side of [-1,1])poly('#9faee9',[[side*29,-44+pulse],[side*35,-36+pulse],[side*29,-27+pulse],[side*24,-36+pulse]]);
    }else{
      rect(c,'#27384c',-20,-39,40,34);rect(c,'#8298aa',-17,-37,34,29);rect(c,'#d5ddce',-14,-35,8,25);rect(c,'#4e687e',7,-35,9,27);
      rect(c,'#263b50',-13,-56,26,22);rect(c,'#adbfbd',-10,-53,20,17);rect(c,'#2d4256',-9,-46,18,4);rect(c,'#f9cb75',-6,-45,12,1);
      for(const side of [-1,1]){rect(c,'#31455c',side<0?-29:20,-40,10,31);rect(c,'#c2ac72',side<0?-27:22,-38,6,5);rect(c,'#506b80',side<0?-14:6,-7,10,10);}
      poly('#303e50',[[-39,-37],[-24,-40],[-10,-35],[-13,-13],[-25,-5],[-37,-16]]);poly('#bbaa79',[[-36,-34],[-25,-37],[-13,-33],[-16,-16],[-25,-9],[-34,-18]]);rect(c,'#6a7e83',-27,-32,4,19);
    }
  }
  function activityBoss(c, enemy, x, y, frame) {
    const kind = frame.activity.kind, bob = frame.reduced ? 0 : Math.sin((frame.time || 0) * 2) * 2;
    c.save(); c.translate(Math.round(x), Math.round(y + bob)); c.scale(2.45,2.45);
    rect(c,"#162b3d45",-21,1,43,3);
    if(kind==='tower'&&enemy.towerTrait){towerBoss(c,enemy.towerTrait,frame.time||0,frame.reduced);c.restore();return;}
    if (kind === "daily") {
      // The storehouse guardian is a walking brass-bound supply chest.
      rect(c,"#3c5c62",-23,-35,46,33);rect(c,"#947a48",-20,-33,40,29);rect(c,"#c4a35e",-18,-31,36,24);
      for (let plank=0;plank<4;plank++) { detail(c,"#e8c87c",-17,-30+plank*6,34,.5); detail(c,"#7e623c",-18,-25+plank*6,36,.5); }
      rect(c,"#4e6a6b",-22,-34,5,31);rect(c,"#4e6a6b",17,-34,5,31);rect(c,"#d7bc72",-20,-34,2,30);rect(c,"#d7bc72",19,-34,2,30);
      rect(c,"#405b5a",-24,-42,48,10);rect(c,"#c2a05c",-21,-40,42,6);rect(c,"#f0d991",-19,-40,38,1);
      rect(c,"#e9c778",-5,-24,10,13);rect(c,"#5b5942",-2,-22,4,5);rect(c,"#5b5942",-1,-18,2,5);
      for (const side of [-1,1]) { rect(c,"#324c53",side<0?-30:23,-28,8,21);rect(c,"#6f9691",side<0?-28:24,-26,5,16);rect(c,"#d4be7b",side<0?-27:25,-24,2,2);rect(c,"#324c53",side<0?-16:8,-3,9,7);rect(c,"#7e9b8d",side<0?-15:9,-2,7,3); }
      rect(c,"#283c43",-14,-30,8,4);rect(c,"#283c43",7,-30,8,4);detail(c,"#eff8bd",-12,-30,3,1);detail(c,"#eff8bd",9,-30,3,1);
    } else if (kind === "weekly") {
      // A sealed headmaster spirit floats above its torn academic robes.
      rect(c,"#39283f",-20,-35,40,34);rect(c,"#5d456a",-17,-34,34,31);rect(c,"#8e6d91",-15,-31,5,27);rect(c,"#42364e",10,-31,7,28);
      for (let hem=0;hem<6;hem++) rect(c,"#5d456a",-17+hem*6,-3,4,6+hem%2*3);
      rect(c,"#c7b88f",-4,-34,8,29);detail(c,"#f0d994",-2,-32,1,25);rect(c,"#b68b59",-10,-28,20,2);
      rect(c,"#332d44",-12,-55,24,24);rect(c,"#b7c8be",-10,-53,20,19);rect(c,"#d8e5cc",-7,-51,12,7);
      rect(c,"#453d52",-8,-45,7,5);rect(c,"#453d52",3,-45,7,5);detail(c,"#9ce8df",-6,-44,3,1);detail(c,"#9ce8df",5,-44,3,1);rect(c,"#6b7773",-3,-36,7,2);
      rect(c,"#2a2a3e",-18,-57,36,5);rect(c,"#4e3c59",-11,-63,23,7);detail(c,"#d1b473",-16,-57,32,1);rect(c,"#d3b572",9,-55,1,14);rect(c,"#e9c875",7,-43,5,5);
      for (let link=0;link<5;link++) { const lx=-28+link*13; rect(c,"#b1ada1",lx,-23+link%2*3,6,2);rect(c,"#dcd0af",lx+1,-22+link%2*3,1,4); }
    } else {
      rect(c,"#263b52",-17,-39,34,36);rect(c,"#93b3bb",-14,-37,28,32);rect(c,"#d5e3da",-12,-35,8,27);rect(c,"#5e8397",6,-35,8,29);
      rect(c,"#294354",-12,-54,25,19);rect(c,"#cfddd5",-10,-52,21,16);rect(c,"#55778c",-9,-46,19,3);rect(c,"#e5f5cf",-6,-45,13,1);
      rect(c,"#c4d9cb",-20,-39,8,7);rect(c,"#c4d9cb",13,-39,8,7);rect(c,"#294354",-12,-4,8,8);rect(c,"#294354",5,-4,8,8);
      c.strokeStyle="#b7d9c3";c.lineWidth=1.2;c.beginPath();c.ellipse(0,-29,28,9,frame.reduced?.3:(frame.time||0)*.8,0,Math.PI*2);c.stroke();
      rect(c,"#e5e5b3",24,-51,2,47);rect(c,"#7ea3a9",21,-18,8,3);rect(c,"#e8f5ce",23,-51,4,4);
    }
    c.restore();
  }
  function campaignBoss(c, enemy, x, y, frame = {}) {
    c.save(); c.translate(Math.round(x), Math.round(y)); const z = enemy.boss ? 2.7 : 1.7; c.scale(z, z);
    const palettes = [["#477d68", "#9dc497"], ["#6c627e", "#b9a6c7"], ["#796247", "#d1ba85"], ["#4d7651", "#91af64"], ["#666b79", "#a1a4ab"], ["#5c5379", "#ba9dd6"], ["#6c91ad", "#c0e0e7"], ["#48485f", "#8f86a4"], ["#557d80", "#a4d3c6"], ["#526e6c", "#92b89a"], ["#76895c", "#d4df9c"], ["#8d6572", "#e2ccd3"]];
    const [edge, body] = palettes[enemy.kind] || palettes[0]; rect(c, "#20302b35", -13, 0, 27, 3);
    if (enemy.kind === 2) { rect(c, edge, -23, -23, 14, 8); rect(c, body, -21, -22, 11, 5); rect(c, edge, 10, -23, 14, 8); rect(c, body, 11, -22, 11, 5); }
    rect(c, edge, -13, -18, 27, 15); rect(c, edge, -10, -25, 21, 22); rect(c, edge, -6, -29, 13, 5);
    rect(c, body, -11, -17, 23, 12); rect(c, body, -8, -24, 17, 19); rect(c, body, -5, -27, 11, 5);
    detail(c, shade(body, 24), -7.5, -23, 1, 5); detail(c, shade(body, 18), -10, -16, 1, 8);
    detail(c, shade(body, -17), -9, -5.5, 20, 1.5); detail(c, shade(body, -13), 9, -21, 1.5, 15);
    detail(c, shade(body, 12), -4, -26, 7, .5); detail(c, "#ffffff55", -4.5, -22.5, 2, .5);
    rect(c, "#ffffff38", -6, -24, 5, 3); rect(c, "#292d3c", -6, -17, 4, 5); rect(c, "#292d3c", 4, -17, 4, 5);
    rect(c, "#fff7ce", -5, -17, 1, 2); rect(c, "#fff7ce", 5, -17, 1, 2); rect(c, edge, -1, -8, 4, 2);
    if (enemy.kind === 1 || enemy.kind === 5) { rect(c, body, -11, -4, 5, 5); rect(c, body, 0, -5, 5, 6); rect(c, body, 9, -4, 3, 5); }
    if (enemy.kind === 3) { rect(c, "#b99a5b", -17, -22, 6, 3); rect(c, "#b99a5b", 12, -23, 7, 3); rect(c, body, -18, -26, 5, 4); }
    if (enemy.kind === 4) { rect(c, edge, -18, -18, 7, 17); rect(c, edge, 12, -18, 7, 17); rect(c, "#b9d9d4", -5, -23, 12, 4); detail(c, "#e1f1e0", -4, -22.5, 9, .5); for (const bx of [-15, 15]) { detail(c, "#cbd1ca", bx, -15, 1, 1); detail(c, "#303d4d", bx, -5, 1, 1); } for (let i = 0; i < 3; i++) detail(c, edge, -3 + i * 3, -5, 1.5, .5); }
    if (enemy.kind === 6) { for (const [ix,iy] of [[-9,-27],[-2,-32],[6,-28]]) { rect(c,"#719fbd",ix,iy,5,8); rect(c,"#e5f7f4",ix+1,iy+1,1,5); } detail(c,"#effbff",-7,-10,16,.5); }
    if (enemy.kind === 7) { rect(c,"#484457",-12,-3,25,4); for (let i=0;i<5;i++) rect(c,"#716779",-12+i*6,0,3,4-i%2); rect(c,"#e6c1a6",-5,-16,2,1); rect(c,"#e6c1a6",5,-16,2,1); }
    if (enemy.kind === 8) { rect(c,"#68806f",-4,-33,9,8); rect(c,"#e1ca86",-3,-32,7,2); rect(c,"#dff4d7",-8,-23,2,7); detail(c,"#eaffed",-5,-23,7,.5); }
    if (enemy.kind === 9) { rect(c,"#647c6c",-15,-16,4,12); rect(c,"#b5c5a0",-15,-15,2,2); rect(c,"#738b70",12,-13,5,10); detail(c,"#cce0ad",-7,-6,4,1); }
    if (enemy.kind === 10) { rect(c,"#e8e7b8",-17,-19,6,2); rect(c,"#e8e7b8",12,-13,9,2); rect(c,"#9ebd8b",-19,-15,7,1); rect(c,"#edf3cf",9,-25,8,1); }
    if (enemy.kind === 11) { rect(c,"#fff0da",-11,-29,6,11); rect(c,"#fff0da",7,-29,6,11); rect(c,"#bd6c6c",-9,-28,2,6); rect(c,"#bd6c6c",9,-28,2,6); detail(c,"#b76469",-7,-13,3,1); detail(c,"#b76469",6,-13,3,1); }
    if (enemy.boss) { rect(c, "#86663c", -12, -32, 26, 6); rect(c, "#ebc86e", -10, -33, 22, 5); for (const px of [-10, 0, 9]) rect(c, "#ebc86e", px, -38, 3, 8); rect(c, "#f7e3a0", 0, -32, 3, 3); }
    c.restore();
  }
  const ENEMY_APPEARANCES = [
    ["chalk", "eraser", "pencil"], ["clock", "locker", "mop"], ["book", "scroll", "ink"],
    ["plant", "can", "rake"], ["ball", "dumbbell", "whistle"], ["telescope", "globe", "crane"],
    ["frostbell", "snowman", "cone"], ["uniform", "desk", "board"], ["flask", "scope", "magnet"],
    ["bucket", "pipe", "umbrella"], ["windsock", "compass", "kite"], ["shrinebell", "talisman", "foxmask"],
    ["plaster","mirror","restorer"], ["constellation","inverted_scope","chart"], ["clockguard","pendulum","tuner"],
  ].map(row => Object.freeze(row));
  Object.freeze(ENEMY_APPEARANCES);
  function enemyVariant(enemy, stage = 1, wave = 1, index = 0) {
    if (Number.isInteger(enemy.variant) && enemy.variant >= 0 && enemy.variant < 3) return enemy.variant;
    return ((Math.max(1, stage) - 1 + Math.max(1, wave) - 1 + index) % 3 + 3) % 3;
  }
  function polygon(c, color, points) {
    c.fillStyle = color; c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(Math.round(x),Math.round(y)) : c.moveTo(Math.round(x),Math.round(y))); c.closePath(); c.fill();
  }
  function pixelDisc(c, color, x, y, radius, squash = 1) {
    c.fillStyle = color;
    for (let row = -Math.ceil(radius); row <= radius; row += 2) {
      const half = Math.round(Math.sqrt(Math.max(0, radius * radius - row * row)));
      c.fillRect(Math.round(x - half), Math.round(y + row * squash), half * 2, Math.max(1, 2 * squash));
    }
  }
  function prism(c, x, y, width, height, color, edge = "#2c3949", depth = 3) {
    polygon(c, shade(color, -28), [[x+width,y],[x+width+depth,y-depth],[x+width+depth,y+height-depth],[x+width,y+height]]);
    polygon(c, shade(color, 30), [[x,y],[x+depth,y-depth],[x+width+depth,y-depth],[x+width,y]]);
    rect(c, edge, x, y, width, height); rect(c, color, x+1, y+1, width-2, height-2);
    detail(c, shade(color, 40), x+1.5,y+2,1,height-4); detail(c, shade(color,-22),x+width-3,y+2,1,height-3);
  }
  function monsterEyes(c, x, y, color = "#fff5c6", blink = false, angry = false) {
    for (const ex of [x - 5, x + 3]) {
      rect(c,"#243041",ex-1,y-1,5,blink ? 2 : 6); if (!blink) { rect(c,color,ex,y,2,3); detail(c,"#ffffff",ex,y,.5,1); }
      if (angry) detail(c,"#263142",ex-1,y-2,5,1);
    }
  }
  function schoolMonster(c, type, pose) {
    if(window.SchoolExpansionArt?.monster(c,type,pose))return;
    const {time:t, attack:a, blink, swing, accent, boss} = pose;
    const ink = "#293744", paper = "#f1e3b8", gold = "#d4ae63", blue = "#8bbed0", leaf = "#91b785", red = "#c27368";
    // All objects share a half-pixel detail grid, but retain their own silhouette,
    // material, articulated part and natural school-world source.
    if (type === "chalk") {
      polygon(c,"#608b89",[[-17,-2],[-16,-12],[-11,-19],[-7,-22],[0,-31],[7,-26],[13,-17],[17,-7],[14,0]]);
      polygon(c,"#bed7bb",[[-14,-4],[-13,-12],[-8,-18],[-3,-20],[1,-27],[6,-24],[11,-15],[14,-7],[10,-3]]);
      rect(c,"#e6edce",-6,-20,4,8); detail(c,"#f9ffe3",-5,-20,1,5); monsterEyes(c,-2,-15,"#fff4b8",blink,a>.4);
      for(let i=0;i<3;i++){c.save();c.translate(-11+i*10,-5+Math.sin(t*3+i)*1.5);c.rotate((i-1)*.2);prism(c,-2,-7,4,8,i===1?"#ebc5aa":"#ecedda", "#769b93",1);c.restore();}
      detail(c,"#739a83",-6,-5,13,1); detail(c,"#eff6df",6,-21,2,2);
    } else if (type === "eraser") {
      for(const [x,y] of [[-12,0],[8,0]]){rect(c,ink,x,-4,6,6);rect(c,"#c59f77",x+1,-4,4,4);}
      prism(c,-17,-26,32,22,"#b47a73",ink,4); rect(c,"#c1b18c",-16,-13,30,7); detail(c,"#e9d3ab",-15,-12,27,1);
      rect(c,ink,-15,-14-a*3,28,5+a*4); for(let i=0;i<6;i++) rect(c,paper,-14+i*5,-14-a*3,2,3);
      monsterEyes(c,-3,-24,"#d9efda",blink,a>.4); detail(c,"#e9a799",-12,-25,8,2);
    } else if (type === "pencil") {
      for(const side of [-1,1]) { polygon(c,ink,[[side*4,-10],[side*8,-3],[side*12,-1],[side*12,2],[side*4,1],[side*1,-8]]); polygon(c,"#b88755",[[side*3,-23],[side*12,-20+side*swing],[side*16,-26],[side*17,-24],[side*14,-16+side*swing],[side*5,-18]]); }
      polygon(c,ink,[[-6,-33],[-6,-8],[0,-1],[7,-9],[7,-33],[2,-40]]);polygon(c,"#d8b55e",[[-4,-31],[-4,-9],[1,-4],[5,-10],[5,-31]]);
      rect(c,"#f6d988",-3,-31,2,20);rect(c,"#a77845",3,-31,2,21);polygon(c,paper,[[-4,-33],[2,-39],[5,-33]]);rect(c,ink,1,-40,2,3);
      rect(c,"#c47871",-5,-10,11,6);rect(c,"#e0c69a",-5,-12,11,3);monsterEyes(c,-1,-25,"#fff7d9",blink,a>.4);
      polygon(c,"#d58b6b",[[-6,-30],[-11,-35],[-10,-25]]);polygon(c,"#d58b6b",[[7,-31],[11,-36],[11,-26]]);
    } else if (type === "clock" || type === "compass") {
      const compass=type==="compass";pixelDisc(c,ink,0,-21,17);pixelDisc(c,compass?"#b99561":"#778b92",0,-22,15);pixelDisc(c,paper,-1,-23,12);
      for(let i=0;i<12;i++){const ang=i*Math.PI/6;rect(c,"#756e5b",Math.sin(ang)*10-1,-23+Math.cos(ang)*10,1,2);}
      if(compass){polygon(c,"#b86962",[[0,-34],[-4,-22],[1,-15],[4,-23]]);polygon(c,"#759eac",[[0,-34],[0,-23],[1,-15],[4,-23]]);}
      else{rect(c,"#514f55",-1,-31,2,10);rect(c,"#514f55",-1,-23,8,2);rect(c,gold,-5,-4,10,3);rect(c,"#8b7252",-1,-3,2,7);pixelDisc(c,gold,Math.sin(t*4)*4,4,3);}
      rect(c,"#fff6d9",-9,-31,4,2);monsterEyes(c,-2,-21,compass?"#95e5e1":"#a8d8dd",blink,a>.4);
      if(compass){for(const side of [-1,1])polygon(c,blue,[[side*15,-25],[side*24,-18+swing],[side*18,-18],[side*21,-12+swing],[side*14,-15]]);rect(c,gold,-4,-42,8,5);}
    } else if (type === "locker") {
      for(const x of [-11,6]){rect(c,ink,x,-3,6,6);rect(c,"#849496",x+1,-3,4,4);}
      prism(c,-12,-39,24,36,"#819a96",ink,5);rect(c,"#506f76",-9,-35,18,9);for(let i=0;i<3;i++) detail(c,"#a9c0b3",-8,-34+i*3,15,1);
      prism(c,-11-a*6,-25,22,19,"#8aa39c",ink,2);monsterEyes(c,-3,-23,"#e4e8b0",blink,a>.4);
      rect(c,"#344952",6-a*6,-17,2,7);rect(c,"#dfc774",5-a*6,-16,2,2);for(let i=0;i<4;i++)rect(c,paper,-9+i*5,-8-a*2,2,3);
      for(const side of [-1,1]){rect(c,ink,side<0?-18:14,-24,5,14);rect(c,"#829a8c",side<0?-17:15,-23,3,10);}
    } else if (type === "mop" || type === "rake") {
      const rake=type==="rake";c.save();c.rotate(Math.sin(t*2)*.07-a*.18);prism(c,-2,-43,4,33,"#b69b6a",ink,1);rect(c,"#f0d7a5",-1,-42,1,26);
      if(rake){rect(c,ink,-15,-15,30,5);rect(c,"#8b9c8a",-14,-14,28,2);for(let i=0;i<6;i++){rect(c,ink,-14+i*5,-12,3,12+(i%2));rect(c,"#b9c1a1",-13+i*5,-11,1,9);}polygon(c,"#c4a36c",[[-10,-28],[0,-34],[11,-29],[3,-27],[-8,-27]]);}
      else{polygon(c,"#6c8494",[[-10,-16],[-14,-10],[-17,0],[-8,-2],[-3,3],[2,-1],[8,2],[17,-1],[13,-14]]);for(let i=0;i<7;i++)rect(c,i%2?"#c8d7cc":"#94b3b2",-12+i*4,-13+Math.sin(t*5+i)*1.5,3,12-i%3);rect(c,"#b9af86",-10,-17,22,4);}
      monsterEyes(c,-2,rake?-17:-12,"#fff5ba",blink,a>.4);c.restore();
    } else if (type === "book") {
      const flap=Math.sin(t*6)*5+a*8;
      for(const side of [-1,1]){polygon(c,"#665673",[[0,-23],[side*13,-31-flap],[side*25,-24-flap],[side*20,-7],[side*10,-10],[0,-13]]);polygon(c,paper,[[side*2,-23],[side*13,-28-flap],[side*22,-23-flap],[side*18,-10],[side*10,-13],[side*2,-15]]);for(let i=0;i<3;i++)polygon(c,"#b6a885",[[side*4,-21+i*3],[side*14,-24-flap+i*3],[side*17,-22-flap+i*3],[side*5,-19+i*3]]);}
      rect(c,"#ad795e",-3,-26,6,15);monsterEyes(c,-2,-18,"#f6df9f",blink,a>.4);polygon(c,red,[[0,-10],[0,4],[4,0],[7,2],[4,-11]]);
    } else if (type === "scroll" || type === "talisman") {
      const talisman=type==="talisman",w=talisman?16:26;
      polygon(c,ink,[[-w/2,-36],[w/2,-36],[w/2-1,-7],[w/2+5+swing,-2],[3,3],[-w/2,-3]]);polygon(c,talisman?"#e9c47d":paper,[[-w/2+1,-34],[w/2-1,-34],[w/2-2,-7],[w/2+2+swing,-2],[3,1],[-w/2+1,-4]]);
      if(talisman){rect(c,"#ad6258",-2,-32,3,22);for(const [dx,dy,dw] of [[-5,-29,10],[-4,-23,8],[-5,-17,10],[-4,-12,7]])rect(c,"#ad6258",dx,dy,dw,2);rect(c,"#b25f57",-9,-38,19,4);polygon(c,"#e8dfbd",[[-10,-14],[-21,-18-swing],[-16,-11],[-24,-6],[-10,-9]]);}
      else{for(const y of [-37,-5]){prism(c,-16,y,32,5,"#a58a61",ink,2);rect(c,"#f4d3a0",-15,y+1,29,1);}for(let i=0;i<4;i++)rect(c,"#ae9a79",-9,-28+i*5,18-i%2*4,1);}
      monsterEyes(c,-2,-23,talisman?"#f7f1c9":"#afdbdf",blink,a>.4);
    } else if (type === "ink" || type === "dumbbell") {
      const dumb=type==="dumbbell";for(const side of [-1,1])for(let i=0;i<3;i++)polygon(c,ink,[[side*7,-13+i*4],[side*(17+i),-18+i*6+swing],[side*(22-i),-8+i*5],[side*(20-i),-6+i*5],[side*(15+i),-14+i*6+swing],[side*7,-10+i*4]]);
      if(dumb){rect(c,"#7d8792",-18,-17,37,5);rect(c,"#d4d5c8",-15,-17,29,1);for(const x of [-19,11]){prism(c,x,-26,10,23,"#6f7e85",ink,3);detail(c,"#b8c6bd",x+2,-23,2,14);}}
      else{pixelDisc(c,"#393d59",0,-17,13);pixelDisc(c,"#5d6083",-2,-18,10);prism(c,-7,-33,14,9,"#9c8d98",ink,2);rect(c,"#d2bf9d",-6,-31,12,2);rect(c,"#e5dabb",-7,-22,13,10);detail(c,"#67577c",-4,-20,7,6);}
      monsterEyes(c,-3,-17,dumb?"#e9c68c":"#c6d3fc",blink,a>.4);
    } else if (type === "plant") {
      for(const side of [-1,1]){polygon(c,"#526e5f",[[side*3,-17],[side*11,-22],[side*14,-34-swing],[side*11,-35-swing],[side*8,-25],[side*1,-22]]);polygon(c,leaf,[[side*9,-27],[side*20,-34-swing],[side*21,-27-swing],[side*11,-23]]);}
      polygon(c,ink,[[-14,-18],[14,-18],[10,-1],[-9,-1]]);polygon(c,"#be8a65",[[-12,-16],[12,-16],[8,-3],[-7,-3]]);rect(c,"#dfad79",-14,-19,28,5);detail(c,"#f5ce9b",-11,-17,18,1);monsterEyes(c,-2,-13,"#f4efc6",blink,a>.4);
      rect(c,"#65916b",-2,-34,4,16);pixelDisc(c,"#aa727e",0,-34,8);pixelDisc(c,"#e3ba77",0,-34,4);rect(c,"#f8dd9c",-1,-36,2,2);
    } else if (type === "can" || type === "bucket") {
      const bucket=type==="bucket";
      if(bucket){for(const side of [-1,1])for(let i=0;i<2;i++)polygon(c,ink,[[side*9,-7],[side*(17+i*4),-10+Math.sin(t*5+i)*2],[side*(22+i*4),-2],[side*(20+i*4),1],[side*(15+i*4),-7],[side*9,-4]]);}
      else{polygon(c,ink,[[-11,-21],[-22,-28],[-28,-26],[-25,-22],[-18,-20],[-13,-10]]);polygon(c,"#93bca4",[[-12,-19],[-22,-25],[-24,-25],[-16,-18],[-12,-13]]);prism(c,11,-27,10,18,"#8aa897",ink,2);rect(c,"#293744",13,-24,6,11);}
      polygon(c,ink,[[-14,-27],[14,-27],[11,-1],[-10,-1]]);polygon(c,bucket?"#7eacb5":"#9cb59b",[[-12,-24],[12,-24],[9,-3],[-8,-3]]);rect(c,"#bfd1bd",-14,-28,28,5);detail(c,"#edf2d8",-11,-27,21,1);detail(c,"#c6ddcb",-8,-22,2,15);monsterEyes(c,-2,-18,"#f5e7a9",blink,a>.4);
      if(bucket){c.strokeStyle="#b5c9bc";c.lineWidth=2;c.beginPath();c.arc(0,-23,10,Math.PI,Math.PI*2);c.stroke();rect(c,"#7c9979",5,-30,6,4);rect(c,"#c6d095",7,-32,2,3);}
    } else if (type === "ball" || type === "globe") {
      const globe=type==="globe";pixelDisc(c,ink,0,-21,17);pixelDisc(c,globe?"#6a9fad":"#cc9761",0,-22,15);pixelDisc(c,globe?"#8cb8c0":"#dfb37b",-3,-24,10);
      if(globe){for(const [xx,yy,ww,hh] of [[-9,-30,7,5],[0,-27,8,6],[-5,-19,5,8]])polygon(c,"#a6bb86",[[xx,yy],[xx+ww,yy-2],[xx+ww+1,yy+hh],[xx+2,yy+hh+2]]);c.strokeStyle=gold;c.lineWidth=2;c.beginPath();c.ellipse(0,-22,22,8,-.55,0,Math.PI*2);c.stroke();prism(c,-6,-4,12,5,"#a88e61",ink,2);}
      else{rect(c,"#81593f",-1,-36,2,30);rect(c,"#81593f",-14,-23,28,2);for(const side of [-1,1])polygon(c,"#81593f",[[side*8,-34],[side*5,-29],[side*4,-18],[side*10,-9],[side*8,-10],[side*2,-18],[side*3,-29],[side*6,-35]]);for(const side of [-1,1]){rect(c,ink,side<0?-13:6,-4,7,5);rect(c,paper,side<0?-13:6,-4,6,2);}}
      detail(c,"#f4e1b1",-9,-31,4,2);monsterEyes(c,-2,-22,"#e6f4d8",blink,a>.4);
    } else if (type === "whistle") {
      prism(c,-12,-29,21,17,"#bba776",ink,4);prism(c,8,-25,13,8,"#cdb886",ink,2);pixelDisc(c,ink,-4,-17,10);pixelDisc(c,gold,-4,-18,8);pixelDisc(c,"#e8ce8d",-5,-20,5);
      polygon(c,"#accbbd",[[-10,-8],[-15,-1],[-7,-3],[-2,2],[5,-3],[9,0],[12,-8]]);monsterEyes(c,-4,-24,"#f3ead5",blink,a>.4);
      c.strokeStyle="#7b887d";c.lineWidth=1.5;c.beginPath();c.arc(-7,-34,7,Math.PI,Math.PI*2);c.stroke();for(let i=0;i<2;i++)detail(c,"#e1edcf",-20-i*5,-20+i*5,3,1);
    } else if (type === "telescope") {
      for(const side of [-1,1])polygon(c,ink,[[0,-17],[side*12,1],[side*15,1],[side*4,-18]]);rect(c,"#a98b68",-1,-17,3,19);
      c.save();c.translate(0,-27);c.rotate(-.25+Math.sin(t*2)*.08-a*.12);prism(c,-18,-7,32,14,"#8396ab",ink,4);prism(c,-23,-10,8,20,"#c6b27a",ink,3);rect(c,"#3d667f",-23,-7,3,13);detail(c,"#b0e8e5",-22,-6,1,6);prism(c,14,-3,8,7,"#bca478",ink,2);monsterEyes(c,-3,-5,"#fff1b4",blink,a>.4);c.restore();
      polygon(c,"#bdacd1",[[8,-21],[20,-25-swing],[16,-17],[23,-15],[9,-14]]);
    } else if (type === "crane" || type === "kite") {
      const kite=type==="kite";const flap=Math.sin(t*5)*6;
      if(kite){polygon(c,ink,[[0,-40],[-23,-19-flap],[0,-8],[24,-23+flap]]);polygon(c,"#9ab6b2",[[0,-37],[-20,-20-flap],[0,-11],[0,-22]]);polygon(c,"#e1ba86",[[0,-37],[0,-22],[0,-11],[21,-23+flap]]);rect(c,"#e7dbb6",-1,-35,2,22);}
      else{polygon(c,ink,[[-19,-29-flap],[-6,-20],[5,-23],[19,-39+flap],[16,-14],[1,-7],[-12,-12]]);polygon(c,paper,[[-17,-26-flap],[-5,-18],[3,-20],[17,-35+flap],[14,-15],[0,-9],[-10,-13]]);polygon(c,"#b5c7c8",[[-4,-18],[4,-21],[13,-15],[0,-10]]);polygon(c,ink,[[-8,-17],[-15,-33],[-20,-29],[-17,-29],[-13,-12]]);polygon(c,paper,[[-9,-17],[-15,-31],[-18,-29],[-14,-15]]);}
      polygon(c,"#8fb4b9",[[0,-9],[5,-2],[0,3],[6,6],[3,8],[-3,3],[1,-2],[-3,-8]]);monsterEyes(c,-2,-22,"#baedf0",blink,a>.4);
    } else if (type === "frostbell" || type === "shrinebell") {
      const frost=type==="frostbell";rect(c,ink,-3,-40,6,9);rect(c,gold,-1,-39,2,7);polygon(c,ink,[[-6,-33],[-12,-24],[-13,-11],[-17,-7],[-17,-3],[17,-3],[17,-7],[13,-11],[12,-24],[6,-33]]);
      polygon(c,frost?"#a3cbd3":"#bb965f",[[-5,-31],[-10,-23],[-11,-10],[-14,-6],[14,-6],[11,-10],[10,-23],[5,-31]]);rect(c,frost?"#d5eff0":"#e7c884",-15,-7,30,3);detail(c,frost?"#f2fff5":"#ffdfa0",-7,-27,2,15);pixelDisc(c,gold,Math.sin(t*4)*3,-1,3);monsterEyes(c,-2,-22,"#eef7dc",blink,a>.4);
      if(frost){for(let i=0;i<3;i++)polygon(c,"#e5f4e5",[[-10+i*9,-29],[-7+i*9,-39-i%2*4],[-4+i*9,-29]]);}else{rect(c,red,-5,-37,10,4);polygon(c,paper,[[2,-35],[13,-32],[10,-26],[17,-23],[14,-18],[8,-25],[9,-30],[1,-32]]);}
    } else if (type === "snowman") {
      pixelDisc(c,"#88abbc",0,-12,14);pixelDisc(c,"#e0ece4",-1,-14,12);pixelDisc(c,"#92b2bd",0,-32,10);pixelDisc(c,"#e7f1e7",-1,-33,8);
      rect(c,"#a76f78",-9,-25,19,5);rect(c,"#ce9995",-8,-25,16,2);polygon(c,"#a76f78",[[7,-24],[15,-18+swing],[14,-8+swing],[9,-10],[10,-18],[4,-22]]);polygon(c,"#d8a877",[[-3,-31],[-12,-28],[-3,-28]]);monsterEyes(c,-1,-36,"#bddae7",blink,a>.4);for(let i=0;i<2;i++)rect(c,ink,-2,-17+i*7,3,3);
      rect(c,"#69818c",-8,-44,17,6);rect(c,"#586c79",-11,-39,22,3);for(const side of [-1,1])polygon(c,"#8f826e",[[side*10,-17],[side*21,-22+swing],[side*22,-20+swing],[side*11,-14]]);
    } else if (type === "cone") {
      prism(c,-16,-4,32,6,"#698b98",ink,3);polygon(c,ink,[[-12,-5],[-5,-37],[5,-37],[12,-5]]);polygon(c,"#95c8cf",[[-9,-6],[-3,-35],[3,-35],[9,-6]]);polygon(c,"#edf4dc",[[-7,-13],[-5,-20],[5,-20],[7,-13]]);monsterEyes(c,-1,-28,"#e8d2a7",blink,a>.4);polygon(c,"#d9f2f1",[[-2,-37],[2,-46],[7,-38],[4,-34]]);detail(c,"#ecffff",-2,-33,1,6);
    } else if (type === "uniform") {
      for(const x of [-9,3]){prism(c,x,-12,7,13,"#566779",ink,2);rect(c,"#abb7ac",x,-1,8,3);}
      polygon(c,ink,[[-8,-32],[-15,-28],[-19,-14],[-13,-11],[-9,-18],[-10,-10],[10,-10],[9,-18],[15,-12],[19,-16],[15,-29],[7,-32]]);polygon(c,"#747c8e",[[-7,-30],[-12,-27],[-15,-16],[-12,-16],[-7,-22],[-7,-12],[8,-12],[7,-29]]);polygon(c,paper,[[-6,-31],[0,-25],[6,-31],[4,-23],[-4,-23]]);rect(c,"#a28077",-1,-25,3,11);
      prism(c,-9,-43,18,12,"#7b8490",ink,3);rect(c,"#292f46",-7,-40,14,6);monsterEyes(c,-1,-39,"#c4d9df",blink,a>.4);rect(c,"#abb7ac",-10,-44,22,3);polygon(c,gold,[[14,-31],[17,-44],[19,-31],[18,-16],[15,-16]]);
    } else if (type === "desk") {
      for(const x of [-14,9]){prism(c,x,-14,5,16,"#7e918f",ink,2);rect(c,"#b5c0ae",x+1,-13,1,10);}
      prism(c,-20,-25,39,9,"#b78f60",ink,5);prism(c,-15,-17,29,9,"#987856",ink,3);monsterEyes(c,-3,-22,"#e6efc8",blink,a>.4);rect(c,ink,-12,-11,23,3+a*3);for(let i=0;i<5;i++)rect(c,paper,-11+i*5,-11,2,3);rect(c,"#c7b185",-15,-26,19,2);prism(c,3,-30,10,5,"#a9b7a1",ink,2);
    } else if (type === "board") {
      for(const x of [-12,8]){rect(c,ink,x,-9,5,12);rect(c,"#9b8668",x+1,-9,3,10);}
      prism(c,-17,-37,33,29,"#a38b60",ink,3);rect(c,"#3e6d66",-14,-34,27,22);detail(c,"#5a8678",-13,-33,25,1);monsterEyes(c,-3,-27,"#dfe6ba",blink,a>.4);
      polygon(c,"#a5c4aa",[[3,-34],[0,-28],[4,-25],[-2,-20],[4,-13],[1,-19],[8,-25],[3,-29],[6,-34]]);rect(c,"#dddfb9",-11,-17,9,1);rect(c,"#dddfb9",-11,-14,7,1);rect(c,"#b99e74",-20,-11,39,3);rect(c,paper,5,-12,7,2);
    } else if (type === "flask") {
      polygon(c,ink,[[-7,-40],[7,-40],[6,-25],[17,-10],[15,0],[-15,0],[-17,-10],[-6,-25]]);polygon(c,"#a9c9c0",[[-5,-37],[5,-37],[4,-24],[14,-9],[12,-3],[-12,-3],[-14,-9],[-4,-24]]);polygon(c,"#83b3a0",[[-9,-19],[10,-19],[14,-8],[11,-4],[-11,-4],[-13,-9]]);rect(c,"#d6ecd1",-9,-16,2,8);rect(c,"#dee3bc",-8,-41,16,5);detail(c,"#f9f9df",-7,-40,12,1);monsterEyes(c,-1,-15,"#f5e59a",blink,a>.4);
      for(let i=0;i<3;i++){const yy=-19-((t*7+i*8)%16);rect(c,"#c8efd3",-3+i*3,yy,2,2);}detail(c,"#ecf4db",-4,-35,1,9);
    } else if (type === "scope") {
      prism(c,-15,-5,32,7,"#789595",ink,3);polygon(c,ink,[[6,-7],[14,-14],[15,-29],[8,-36],[4,-31],[8,-25],[6,-17],[0,-11]]);polygon(c,"#a2b9ae",[[7,-9],[11,-15],[12,-27],[8,-32],[7,-30],[10,-25],[8,-15],[3,-11]]);prism(c,-13,-20,23,5,"#879f9c",ink,2);pixelDisc(c,gold,8,-22,4);
      c.save();c.translate(-6,-32);c.rotate(-.25-a*.15);prism(c,-5,-12,10,24,"#9dbdbb",ink,3);rect(c,blue,-6,9,12,3);detail(c,"#eef4d6",-3,-9,1,15);monsterEyes(c,-1,-4,"#e5df9f",blink,a>.4);c.restore();
    } else if (type === "magnet") {
      polygon(c,ink,[[-17,-34],[-5,-34],[-5,-16],[-2,-12],[3,-12],[6,-16],[6,-34],[18,-34],[18,-14],[12,-4],[-9,-4],[-17,-13]]);polygon(c,"#ad787a",[[-15,-32],[-7,-32],[-7,-15],[-2,-9],[4,-9],[8,-15],[8,-32],[16,-32],[16,-15],[10,-6],[-8,-6],[-15,-14]]);rect(c,"#d4d7c3",-15,-33,8,9);rect(c,"#9ebac1",8,-33,8,9);detail(c,"#e8ada4",-14,-21,2,7);monsterEyes(c,-1,-16,"#eef3b9",blink,a>.4);
      for(const side of [-1,1]){polygon(c,gold,[[side*20,-28],[side*25,-22],[side*21,-20],[side*25,-14],[side*18,-20],[side*22,-23]]);rect(c,ink,side<0?-11:5,-4,7,5);}
    } else if (type === "pipe") {
      const wiggle=Math.sin(t*5)*4;polygon(c,ink,[[-19,-20],[-19,-10],[-10,-3],[11,-3],[19,-10],[19,-24],[12,-31],[7,-31],[7,-21],[11,-19],[11,-12],[-7,-12],[-10,-15],[-10,-20]]);polygon(c,"#79a1a6",[[-17,-18],[-17,-11],[-9,-5],[10,-5],[17,-11],[17,-23],[11,-29],[9,-29],[9,-23],[13,-20],[13,-10],[-8,-10],[-12,-14],[-12,-18]]);prism(c,-22,-25+wiggle,15,9,"#a8bdb2",ink,2);monsterEyes(c,-16,-22+wiggle,"#e7d59b",blink,a>.4);rect(c,"#d1c59c",-8,-6,4,5);detail(c,"#bcddd2",12,-21,2,8);
    } else if (type === "umbrella") {
      rect(c,"#928566",-1,-27,2,26);polygon(c,"#8e856c",[[-1,-3],[-1,2],[6,5],[11,1],[10,-3],[8,-3],[8,0],[5,2],[2,0],[2,-4]]);polygon(c,ink,[[0,-43],[-7,-38],[-18,-29],[-22,-22],[-10,-24],[0,-20],[10,-24],[22,-22],[17,-30],[7,-39]]);polygon(c,"#779caa",[[0,-40],[-6,-36],[-18,-25],[-10,-27],[0,-23],[10,-27],[18,-25],[6,-36]]);polygon(c,"#a3c5c4",[[0,-40],[-6,-36],[-10,-27],[0,-23]]);detail(c,"#d6e9d3",-1,-40,1,14);monsterEyes(c,-1,-30,"#eee1b2",blink,a>.4);polygon(c,"#8aaeb9",[[-10,-20],[-13,-15],[-9,-13]]);
    } else if (type === "windsock") {
      prism(c,-14,-42,3,43,"#b5a17b",ink,1);polygon(c,ink,[[-11,-38],[4,-37],[19,-32+swing],[22,-17+swing],[9,-20],[-1,-17],[-12,-22]]);polygon(c,"#b7c799",[[-10,-36],[3,-35],[17,-30+swing],[19,-20+swing],[9,-23],[-2,-20],[-10,-24]]);polygon(c,"#e5d3a4",[[1,-35],[6,-34],[8,-23],[2,-21]]);monsterEyes(c,-4,-31,"#f6e4b2",blink,a>.4);for(let i=0;i<3;i++)polygon(c,"#a4c1ae",[[18,-29+i*4+swing],[28,-27+i*4-swing],[22,-24+i*4],[18,-26+i*4]]);prism(c,-19,-2,13,5,"#858e77",ink,2);
    } else if (type === "foxmask") {
      polygon(c,ink,[[-15,-40],[-5,-33],[5,-33],[16,-40],[13,-15],[5,-7],[0,-4],[-7,-9],[-14,-18]]);polygon(c,"#ecded1",[[-12,-36],[-5,-30],[5,-30],[13,-36],[10,-16],[4,-9],[0,-7],[-6,-11],[-11,-19]]);polygon(c,"#b27877",[[-11,-33],[-7,-26],[-10,-23]]);polygon(c,"#b27877",[[11,-33],[7,-26],[10,-23]]);monsterEyes(c,-1,-23,"#d6a87d",blink,a>.4);polygon(c,"#a96f72",[[-10,-17],[-4,-15],[-8,-12]]);polygon(c,"#a96f72",[[9,-17],[3,-15],[7,-12]]);rect(c,ink,-1,-13,3,2);
      polygon(c,red,[[-6,-8],[-12,-2],[-5,0],[-10,7],[-2,3],[0,-6]]);polygon(c,paper,[[6,-8],[12,-2],[5,1],[12,6],[4,4],[0,-6]]);
    }
    if (boss) { rect(c,"#8c6e48",-11,-45,23,5);rect(c,"#e8c77a",-10,-46,21,4);for(const xx of [-10,0,9])rect(c,"#edce83",xx,-50,3,7);detail(c,"#fff2bd",0,-45,2,2); }
    // A few restrained motes link mundane school objects to their enchantment.
    for(let i=0;i<2;i++){const xx=21+Math.sin(t*1.7+i*3)*4,yy=-33+((t*5+i*11)%24);detail(c,accent,xx,yy,i?1:1.5,1);}
  }
  let damageSurface=null;
  const tintedSprites=new WeakMap();
  function hitSprite(c,image,args,age){
    c.drawImage(image,...args);if(!(age>=0&&age<.2)||!image.naturalWidth)return;
    let tint=tintedSprites.get(image);if(!tint){tint=document.createElement('canvas');tint.width=image.naturalWidth;tint.height=image.naturalHeight;const p=tint.getContext('2d');p.drawImage(image,0,0);p.globalCompositeOperation='source-atop';p.fillStyle='#ff5266';p.fillRect(0,0,tint.width,tint.height);tintedSprites.set(image,tint);}
    c.save();c.globalAlpha*=.38*(1-age/.2);c.drawImage(tint,...args);c.restore();
  }
  function monster(c,enemy,x,y,frame={}){
    if(window.SchoolEnemyArt?.draw(c,enemy,x,y,frame))return;
    const age=frame.hitAge??(frame.hit?.06:1);
    if(!(age>=0&&age<.2)){monsterBody(c,enemy,x,y,frame);return;}
    if(!damageSurface){damageSurface=document.createElement('canvas');damageSurface.width=damageSurface.height=512;}
    const p=damageSurface.getContext('2d');p.setTransform(1,0,0,1,0,0);p.clearRect(0,0,512,512);p.save();p.scale(2,2);monsterBody(p,enemy,128,225,frame);p.restore();
    p.globalCompositeOperation='source-atop';p.fillStyle=`rgba(255,70,90,${.32*(1-age/.2)})`;p.fillRect(0,0,512,512);p.globalCompositeOperation='source-over';
    c.drawImage(damageSurface,x-128,y-225,256,256);
  }
  function monsterBody(c, enemy, x, y, frame = {}) {
    const rawZone=Number.isInteger(enemy.kind)?enemy.kind:0,zone=Math.max(0,Math.min(19,rawZone>=20?rawZone-20:rawZone));
    if(rawZone>=20)enemy={...enemy,kind:zone};
    const variant = enemyVariant(enemy, frame.stage, frame.wave, frame.index);
    const type = ENEMY_APPEARANCES[Math.min(zone,14)][variant], reduced=!!frame.reduced;
    const dead=enemy.hp<=0, deathAge=Number.isFinite(frame.deathAge)?Math.max(0,frame.deathAge):dead?1:0;
    if(dead && deathAge>=.78)return;
    const t = reduced || frame.stunned ? 0 : frame.time || 0, attackAge=frame.attackAge ?? (frame.attack?0.12:1), hitAge=frame.hitAge ?? (frame.hit?0.06:1);
    const attack=reduced||dead||frame.stunned?0:Math.sin(clamp01(attackAge/.43)*Math.PI), recoil=reduced||dead?0:Math.sin(clamp01(hitAge/.32)*Math.PI);
    const spawn=Number.isFinite(frame.spawnAge)?clamp01(frame.spawnAge/.38):1, fall=dead?clamp01(deathAge/.65):0;
    const z=enemy.boss?2.45:1.55, floating=["clock","book","scroll","whistle","globe","crane","frostbell","umbrella","compass","kite","shrinebell","talisman","foxmask","mirror","restorer","constellation","inverted_scope","chart","pendulum","tuner"].includes(type);
    const idle=reduced||dead||frame.stunned?0:Math.sin(t*3.3+variant*1.8), leap=attack*(floating?4:3);
    const dx=-attack*11+recoil*5,dy=(floating?-3:0)+idle*(floating?2:.7)-leap+(dead&&!reduced?fall*13:0);
    const accent=["#daedc4","#dfd3ba","#dcc8e8","#d8edb5","#efcf9a","#d7d7f4","#e0f6ee","#d5c7de","#c4ead7","#bfdce1","#e4efbc","#f0d6cc","#edb9ff","#9fddff","#f9cd89"][Math.min(zone,14)];
    c.save();c.translate(Math.round(x),Math.round(y));
    const opacity=dead?1-fall:reduced?1:spawn;
    c.globalAlpha*=Math.max(0,opacity);c.fillStyle="#2535442c";c.beginPath();c.ellipse(1,4,enemy.boss?36:22,enemy.boss?7:4,0,0,Math.PI*2);c.fill();
    c.fillStyle="#25354425";c.beginPath();c.ellipse(-2,3,enemy.boss?24:14,enemy.boss?4:2,0,0,Math.PI*2);c.fill();
    c.translate(dx,dy-(reduced?0:(1-spawn)*9));
    if(!reduced)c.transform(1+(floating?0:idle*.025)-attack*.035,0,attack*.035-recoil*.035,1-(floating?0:idle*.018)-fall*.24,0,0);
    if(enemy.boss&&frame.activity){activityBoss(c,enemy,0,0,{...frame,time:t,hit:false});}
    else if(zone>=15&&window.SchoolAscensionArt){c.scale(enemy.boss?1.5:1.1,enemy.boss?1.5:1.1);window.SchoolAscensionArt.monster(c,zone,{time:t,attack,variant,boss:enemy.boss,reduced});}
    else if(enemy.boss&&zone>=12&&zone<=14&&window.SchoolExpansionArt){c.scale(2.1,2.1);window.SchoolExpansionArt.monster(c,['portrait','orrery','bellwarden'][zone-12],{time:t,attack,swing:Math.sin(t*3)*2});}
    else if(enemy.boss){campaignBoss(c,enemy,0,0,{hit:false});}
    else{c.scale(z,z);schoolMonster(c,type,{time:t,attack,blink:Math.sin(t*.65+zone+variant)> .995,swing:Math.sin(t*4+variant)*2+attack*4,accent,boss:enemy.boss});}
    if(hitAge>=0&&hitAge<.23&&!reduced){c.strokeStyle="#fff0c9";c.lineWidth=1.1;c.beginPath();c.moveTo(-15,-33);c.lineTo(-7,-36);c.moveTo(10,-22);c.lineTo(17,-26);c.stroke();}
    c.restore();
    if(dead&&deathAge<.78){c.save();c.globalAlpha=(1-clamp01(deathAge/.78))*.85;
      for(let i=0;i<(reduced?3:8);i++){const angle=i*Math.PI/4,spread=reduced?8:5+deathAge*32,px=x+Math.cos(angle)*spread,py=y-22-Math.sin(angle)*spread-deathAge*9;rect(c,i%3?accent:"#fff2c4",px,py,2+i%2,2+i%2);}c.restore();}
    if(!dead&&hitAge>=0&&hitAge<.24){c.save();c.globalAlpha=(1-hitAge/.24)*.85;for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;rect(c,i%2?accent:"#fff6d3",x-10+Math.cos(a)*(8+hitAge*30),y-29+Math.sin(a)*(8+hitAge*30),2,2);}c.restore();}
  }
  function snow(c, time, strength = 1) {
    for (let i = 0; i < 36 * strength; i++) {
      const x = (i * 71 + Math.sin(time * .45 + i) * 8 + 490) % 480, y = (i * 37 + time * (7 + i % 4)) % 280;
      rect(c, i % 3 ? "#edf8f0bb" : "#ffffff", x, y, i % 4 === 0 ? 2 : 1, 1);
    }
  }
  // A single-point floor replaces the old screen-aligned checkerboard. It is
  // painted only into scenery caches, so depth adds no combat-frame workload.
  function perspectiveFloor(c,color,{snowy=false,wood=false,vanishX=246,vanishY=103}={}){
    c.save();rect(c,color,0,153,480,127);
    const light=c.createLinearGradient(0,153,0,280);light.addColorStop(0,snowy?'#f1fcff4a':'#fbf1d91b');light.addColorStop(.5,'#ffffff00');light.addColorStop(1,'#11233824');c.fillStyle=light;c.fillRect(0,153,480,127);
    const rows=[153,159,168,181,200,227,265,280],spread=wood?64:82;
    const xAt=(x,y)=>vanishX+(x-vanishX)*(y-vanishY)/(280-vanishY);
    c.lineWidth=.65;c.strokeStyle=snowy?'#577b8d36':wood?'#4d40323b':'#324d5038';
    for(let x=-330;x<=810;x+=spread){c.beginPath();c.moveTo(xAt(x,153),153);c.lineTo(x,280);c.stroke();}
    for(let r=1;r<rows.length-1;r++){const y=rows[r];c.beginPath();c.moveTo(0,y);c.lineTo(480,y);c.stroke();c.strokeStyle=snowy?'#fcffff53':'#fff0cd18';c.beginPath();c.moveTo(0,y+1);c.lineTo(480,y+1);c.stroke();c.strokeStyle=snowy?'#577b8d36':wood?'#4d40323b':'#324d5038';}
    // Alternating quiet tile lights show the receding planes without a noisy
    // checker texture. The floor remains clear behind all six combatants.
    c.fillStyle=snowy?'#ffffff14':'#f7e6c10b';
    for(let r=0;r<rows.length-1;r++)for(let x=-330+((r%2)*spread);x<810;x+=spread*2){const a=rows[r]+1,b=rows[r+1]-1;c.beginPath();c.moveTo(xAt(x,a)+1,a);c.lineTo(xAt(x+spread,a)-1,a);c.lineTo(xAt(x+spread,b)-1,b);c.lineTo(xAt(x,b)+1,b);c.closePath();c.fill();}
    const edge=c.createLinearGradient(0,0,480,0);edge.addColorStop(0,'#1023382e');edge.addColorStop(.18,'#10233800');edge.addColorStop(.82,'#10233800');edge.addColorStop(1,'#1023382e');c.fillStyle=edge;c.fillRect(0,153,480,127);c.restore();
  }
  function depthAtmosphere(c,width,height){
    // Foreground occlusion and a softly lit distance give painted maps the
    // same stage depth. No blur, filter or per-frame gradient allocation.
    c.save();c.setTransform(1,0,0,1,0,0);const shade=c.createLinearGradient(0,0,0,height);shade.addColorStop(0,'#1020301a');shade.addColorStop(.45,'#d7f1e708');shade.addColorStop(.72,'#10203000');shade.addColorStop(1,'#10203035');c.fillStyle=shade;c.fillRect(0,0,width,height);c.restore();
  }
  function paintedDepth(c,width,height,name,image,sw,sh){
    // These paintings already contain accurate perspective. Project light
    // onto their existing floor instead of drawing a second, conflicting grid.
    // Account for cover-cropping so the vanishing point never slides on mobile.
    const ratio=width/sw,left=(image.naturalWidth-sw)/2,top=(image.naturalHeight-sh)/2;
    const vx=(image.naturalWidth*.5-left)*ratio,vy=(image.naturalHeight*(name==='classroom'?.34:name==='garden'?.4:.43)-top)*ratio;
    const horizon=Math.max(height*.2,Math.min(height*.58,vy)),bottom=height;
    c.save();c.setTransform(1,0,0,1,0,0);
    const light=c.createLinearGradient(0,horizon,0,bottom);light.addColorStop(0,name==='classroom'?'#fff3cf00':'#c9f7ff00');light.addColorStop(.38,name==='classroom'?'#ffe3a51e':'#d5f9ff1a');light.addColorStop(1,'#ffffff00');
    c.fillStyle=light;c.beginPath();c.moveTo(vx-width*.025,horizon);c.lineTo(vx+width*.035,horizon);c.lineTo(width*.88,bottom);c.lineTo(width*.12,bottom);c.closePath();c.fill();
    // A separate near-ground plane and inward-facing corner shadows frame
    // the party. The bright distant center stays open behind battle effects.
    const near=c.createLinearGradient(0,height*.83,0,bottom);near.addColorStop(0,'#10273c00');near.addColorStop(1,'#10273c29');c.fillStyle=near;c.fillRect(0,height*.83,width,height*.17);
    c.fillStyle=name==='classroom'?'#281c1c12':'#102b351c';
    for(const side of [0,1]){const edge=side?width:0,inner=side?width*.94:width*.06;c.beginPath();c.moveTo(edge,horizon);c.lineTo(edge,bottom);c.lineTo(inner,bottom);c.lineTo(vx+(edge-vx)*.82,height*.67);c.closePath();c.fill();}
    c.restore();
  }
  function newBackground(c, zone, time, still = false) {
    const snowy = zone === 6 || zone === 11, outdoor = snowy || zone === 10;
    const walls = ["#9ab3c1", "#555963", "#6c8587", "#485f67", "#9eafa0", "#768da5"], color = walls[zone - 6] || walls[0];
    rect(c, color, 0, 0, 480, 280);
    if (outdoor) {
      rect(c, zone === 10 ? "#bacdb4" : "#bfd4dc", 0, 40, 480, 50); rect(c, zone === 10 ? "#d8ddba" : "#d7e4e2", 0, 90, 480, 60);
      for (let i = 0; i < 7; i++) { const x = i * 80 - 32; rect(c, snowy ? "#8fa6b5" : "#8fa38b", x, 94 - i % 3 * 12, 100, 57); rect(c, snowy ? "#c6d8dc" : "#afc1a1", x + 22, 87 - i % 3 * 12, 55, 12); }
      if (zone === 6) {
        rect(c, "#7d8f9b", 54, 56, 342, 92); rect(c, "#dbe6df", 49, 51, 352, 8); rect(c, "#9daeb2", 57, 61, 336, 84);
        for (let row = 0; row < 2; row++) for (let col = 0; col < 12; col++) { const x = 67 + col * 27, y = 69 + row * 33; rect(c, "#637f90", x, y, 18, 24); rect(c, "#b4d4d7", x + 2, y + 2, 14, 19); detail(c, "#e0ede5", x + 8, y + 1, 1, 22); detail(c, "#e0ede5", x + 1, y + 11, 16, .5); }
        rect(c, "#758697", 207, 116, 35, 32); rect(c, "#e1e9dc", 205, 113, 39, 4);
      } else {
        // The boundary and snow shrine share the school spirit gate motif.
        const gate = zone === 11 ? "#ae6458" : "#70856a", light = zone === 11 ? "#df9e7e" : "#bec59a";
        for (const x of [205, 338]) { rect(c, "#445758", x - 3, 69, 15, 84); rect(c, gate, x, 69, 10, 83); detail(c, light, x + 1, 71, 1, 79); }
        rect(c, "#445758", 190, 62, 170, 12); rect(c, gate, 191, 62, 168, 8); rect(c, light, 197, 61, 156, 2); rect(c, gate, 200, 86, 151, 7);
        if (zone === 11) { rect(c, "#eaf4ee", 188, 58, 174, 4); rect(c, "#d6e8e2", 201, 84, 150, 2); }
        for (let ribbon = 0; ribbon < 5; ribbon++) { const x = 227 + ribbon * 24, offset = Math.round(Math.sin(time * 2 + ribbon) * 2); rect(c, "#e9e5bf", x, 94, 2, 17); rect(c, "#f7f2d3", x + offset, 110, 6, 4); rect(c, "#dedbbb", x + offset + 3, 114, 4, 5); }
        for (const x of [77, 419]) { rect(c, "#78847e", x, 117, 8, 28); rect(c, "#596f70", x - 7, 112, 22, 6); rect(c, "#a6b4a5", x - 4, 96, 16, 16); rect(c, "#e8dcb1", x - 1, 100, 10, 9); rect(c, "#586c6e", x - 9, 92, 26, 5); if (snowy) rect(c, "#eaf4ed", x - 10, 90, 28, 3); }
      }
      for (const [x,h] of [[12,50],[144,35],[453,53]]) { rect(c, "#6c7776", x + 8, 147 - h, 5, h); for (let level = 0; level < 3; level++) { rect(c, "#6d8c85", x - 7 + level * 4, 106 - h / 3 + level * 13, 38 - level * 7, 12); if (snowy) rect(c, "#e3eeea", x - 5 + level * 4, 104 - h / 3 + level * 13, 32 - level * 7, 4); } }
    } else {
      for (let y = 26; y < 156; y += 24) { detail(c, "#263f4629", 0, y, 480, 1); for (let x = (y % 48 ? 0 : 28); x < 480; x += 56) detail(c, "#263f4629", x, y, 1, 24); }
      rect(c, "#34464c", 0, 17, 480, 7); detail(c, "#a1b1aa", 0, 18, 480, 1); rect(c, "#3d4e50", 0, 143, 480, 12);
      if (zone === 7) {
        for (const x of [31, 118]) { rect(c, "#343c4a", x, 43, 59, 76); rect(c, "#82929b", x + 4, 47, 51, 68); rect(c, "#bec6ba", x + 8, 51, 19, 25); rect(c, "#abbcb9", x + 31, 51, 19, 25); rect(c, "#827152", x - 4, 82, 67, 8); rect(c, "#a48c64", x - 3, 84, 65, 1); rect(c, "#746249", x + 8, 62, 8, 52); }
        rect(c, "#313e48", 275, 44, 81, 101); rect(c, "#6b766d", 280, 48, 71, 96); rect(c, "#a7ae90", 284, 54, 63, 24); rect(c, "#485c62", 289, 58, 53, 16); detail(c, "#c3b787", 337, 101, 2, 9);
        rect(c, "#c1b07a", 282, 93, 67, 4); for (let i = 0; i < 6; i++) rect(c, "#5c5141", 287 + i * 11, 93, 3, 4);
        for (const [x,y] of [[211,49],[393,79],[189,117]]) { detail(c, "#2d394255", x, y, 1, 10); detail(c, "#2d394255", x - 3, y + 10, 4, 1); detail(c, "#2d394255", x - 3, y + 11, 1, 9); }
      } else if (zone === 8) {
        for (const x of [28, 124, 220]) { rect(c, "#425b61", x, 55, 69, 72); rect(c, "#294b54", x + 4, 59, 61, 62); detail(c, "#adc7b7", x + 2, 57, 1, 66); for (let row = 0; row < 2; row++) { rect(c, "#9b9875", x + 4, 85 + row * 34, 61, 3); for (let j = 0; j < 4; j++) { const px = x + 10 + j * 13, py = 66 + row * 34; rect(c, "#bdd9c5", px + 2, py, 3, 5); rect(c, ["#8ab2c4","#b0c980","#b79bc7","#d3b087"][j], px, py + 5, 7, 11); detail(c, "#e4f5df", px + 1, py + 6, 1, 6); } } }
        rect(c, "#3e5758", 352, 62, 66, 68); rect(c, "#82a8a5", 357, 67, 56, 58); rect(c, "#b4d6c5", 365, 76, 39, 39); rect(c, "#87b8ac", 369, 80, 31, 31); rect(c, "#cef1c6", 377, 85, 15, 21); detail(c, "#f0f8d9", 379, 87, 2, 11);
        rect(c, "#858f73", 20, 132, 428, 8); rect(c, "#b1ad83", 18, 130, 432, 3); rect(c, "#4d665f", 42, 140, 8, 14); rect(c, "#4d665f", 417, 140, 8, 14);
      } else {
        for (const x of [28, 177, 326]) { rect(c, "#304a53", x, 51, 107, 99); rect(c, "#54757a", x + 7, 57, 93, 89); rect(c, "#253f4d", x + 15, 69, 77, 75); for (let r = 0; r < 6; r++) detail(c, "#687f7c", x + 18, 78 + r * 11, 71, 1); }
        rect(c, "#506d67", 0, 35, 480, 9); detail(c, "#a2aea0", 0, 36, 480, 1); for (const x of [48, 214, 391]) { rect(c, "#354d4d", x, 31, 6, 18); detail(c, "#a3af9a", x + 1, 33, 1, 13); }
        if (!still) for (let i = 0; i < 7; i++) { const x = i * 67 + 21, drip = (time * 18 + i * 23) % 97; rect(c, "#9bd2c178", x, 53 + drip, 1, 4); }
      }
    }
    const floor = snowy ? "#d6e3e2" : zone === 7 ? "#73756c" : zone === 8 ? "#82978d" : zone === 9 ? "#507d81" : "#a1b28b";
    perspectiveFloor(c,floor,{snowy,vanishX:zone===11?272:246}); rect(c, snowy ? "#ecf3e9" : "#b2c0a466", 0, 151, 480, 3);
    if (zone === 9 && !still) for (let i = 0; i < 20; i++) { const x = (i * 53 + time * 8) % 480, y = 162 + i * 17 % 111; detail(c, "#bcdfce77", x, y, 13 + i % 4 * 5, .5); }
    if (zone === 10) { if (!still) for (let i = 0; i < 15; i++) { const x = (i * 49 + time * 32) % 510 - 20, y = 35 + i * 19 % 199; rect(c, "#edf1d65c", x, y, 11 + i % 4 * 7, 1); } for (let i=0;i<13;i++) { const x=i*41; rect(c,"#718d64",x,147,2,8); rect(c,"#afc585",x+2,149,2,6); } }
    if (snowy) { for (let i = 0; i < 16; i++) { const x = i * 33 + 5, y = 166 + i * 29 % 107; detail(c, "#f4f9ef", x, y, 9, .5); } if (!still) snow(c, time); }
    rect(c, "#27424c18", 0, 263, 480, 17);
  }
  function towerRoom(c,activity){
    const theme=S.towerEncounter(activity.floor),id=activity.theme||theme.id;
    const palette={armory:['#344656','#63798b','#c5aa76'],library:['#352b49','#725476','#d5b180'],garden:['#243f43','#527575','#b3dba6'],clock:['#40383f','#8b715a','#ecd49a'],astral:['#222b50','#57679b','#bfd1f6']}[id];
    rect(c,palette[0],0,0,480,154);
    for(let i=0;i<5;i++){const inset=i*34;rect(c,palette[1],inset,18+i*11,6,136-i*11);rect(c,palette[1],474-inset,18+i*11,6,136-i*11);detail(c,palette[2],inset,18+i*11,480-2*inset,1);}
    if(id==='library'){
      for(const x of [16,92,315,391]){rect(c,'#221f35',x,44,69,106);for(let row=0;row<3;row++){rect(c,'#a18363',x,76+row*32,69,3);for(let book=0;book<8;book++){const h=18+(book*7+row)%10;rect(c,['#866674','#607c92','#8b8971','#b28c6e'][book%4],x+4+book*8,76+row*32-h,5,h);detail(c,'#e1c898',x+4+book*8,72+row*32,5,1);}}}
      rect(c,'#6f4d72',210,65,61,85);rect(c,'#c4a878',214,69,53,3);
    }else if(id==='garden'){
      for(const x of [18,113,288,383]){rect(c,'#6babb2',x,42,77,101);rect(c,'#a3c8c4',x+4,46,69,54);rect(c,'#376568',x+36,42,4,100);rect(c,'#376568',x,91,77,4);rect(c,'#537253',x+4,111,69,33);for(let i=0;i<6;i++){rect(c,'#3d603e',x+i*12,117-i%3*9,11,30);rect(c,'#96b78b',x+3+i*12,114-i%3*9,6,6);}}
      for(let i=0;i<20;i++)rect(c,i%3?'#47684c':'#8ead74',i*25,18+i%3*7,30,10);
    }else if(id==='clock'){
      for(const [x,y,r] of [[76,88,34],[239,91,45],[401,88,34]]){c.fillStyle='#b69a62';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.fillStyle='#e4d5ad';c.beginPath();c.arc(x,y,r-5,0,Math.PI*2);c.fill();c.strokeStyle='#5d4b53';c.lineWidth=3;c.beginPath();c.moveTo(x-r*.4,y);c.lineTo(x,y);c.lineTo(x+r*.3,y-r*.55);c.stroke();for(let n=0;n<12;n++)rect(c,'#655454',x+Math.sin(n*Math.PI/6)*(r-10),y+Math.cos(n*Math.PI/6)*(r-10),2,3);}
    }else if(id==='astral'){
      rect(c,'#192443',121,36,238,114);for(let n=0;n<42;n++){const x=130+n*43%217,y=45+n*17%95;rect(c,n%4?'#a3c4ed':'#f8e4b2',x,y,n%4?1:2,2);}
      c.strokeStyle='#899dcc';c.lineWidth=2;c.beginPath();c.arc(240,94,42,0,Math.PI*2);c.moveTo(121,94);c.lineTo(359,94);c.moveTo(240,36);c.lineTo(240,150);c.stroke();
      for(const side of [46,411]){rect(c,'#4c587e',side,60,24,90);rect(c,'#a2b6d8',side+8,57,8,22);}
    }else{
      for(const x of [32,120,302,390]){rect(c,'#202d3b',x,57,60,88);rect(c,'#8c7b60',x,61,60,5);for(let j=0;j<3;j++){rect(c,'#a3bac3',x+10+j*17,73,3,53);rect(c,'#d8bc7b',x+5+j*17,110,13,4);}rect(c,'#9a8566',x,133,60,5);}
      rect(c,'#776744',213,71,54,74);rect(c,'#ddc086',220,78,40,56);rect(c,'#465c70',225,84,30,42);
    }
    rect(c,'#172536ee',142,44,196,29);c.font='9px Galmuri, monospace';c.textAlign='center';c.fillStyle='#f3e7c6';c.fillText(`${theme.name} · ${activity.floor}층`,240,57);c.font='6px Galmuri, monospace';c.fillStyle='#d3e0ed';c.fillText(theme.trait,240,68);c.textAlign='left';
    return {armory:'#64717d',library:'#79677c',garden:'#648276',clock:'#8d7967',astral:'#596c91'}[id];
  }
  function activityBackground(c, activity, time, reduced, still = false) {
    const kind = activity.kind;
    rect(c, kind === "daily" ? "#796b54" : kind === "weekly" ? "#414154" : "#394d5e", 0, 0, 480, 280);
    if (kind === "daily") {
      rect(c,"#9f9270",0,27,480,123);rect(c,"#554f43",0,18,480,9);detail(c,"#c6b68c",0,28,480,1);
      for (let y=40;y<150;y+=23) { detail(c,"#75694d66",0,y,480,1);for(let x=y%2?15:45;x<480;x+=60)detail(c,"#75694d66",x,y,1,23); }
      for (const x of [17,108,199]) { rect(c,"#524b3d",x,56,79,91);for(let row=0;row<2;row++){rect(c,"#ae8b54",x+3,91+row*43,73,4);detail(c,"#dfbc77",x+3,91+row*43,73,1);for(let box=0;box<3;box++){const bx=x+8+box*22,by=65+row*43;rect(c,"#735d3f",bx,by,18,24);rect(c,"#b0965d",bx+1,by+1,16,21);detail(c,"#dbc289",bx+2,by+2,14,.5);rect(c,"#e1d1a0",bx+7,by+6,5,7);detail(c,"#8a7758",bx+8,by+8,3,.5);}} }
      rect(c,"#536866",314,42,130,107);rect(c,"#81938b",320,48,118,101);rect(c,"#b7bc9e",328,56,102,92);rect(c,"#596c65",338,65,82,83);
      c.strokeStyle="#c3c9a4";c.lineWidth=3;c.beginPath();c.arc(379,106,25,0,Math.PI*2);c.stroke();rect(c,"#d4cd9b",377,88,4,36);rect(c,"#d4cd9b",361,104,36,4);rect(c,"#e6d8a2",375,102,8,8);
      rect(c,"#3d524a",334,33,92,14);c.font="8px Galmuri, monospace";c.fillStyle="#eadbad";c.fillText("방과 후 보급고",345,46);
    } else if (kind === "weekly") {
      rect(c,"#5a5263",0,25,480,126);for(const x of [17,151,306,448]){rect(c,"#343645",x,27,12,127);detail(c,"#9a8977",x+1,28,1,123);}
      for(const x of [39,174]){rect(c,"#2d344b",x,42,97,96);rect(c,"#8a879b",x+6,48,85,82);rect(c,"#50627e",x+11,53,75,72);rect(c,"#c2c9bd",x+22,59,26,27);rect(c,"#50627e",x+17,56,24,24);rect(c,"#35364a",x+44,48,4,82);detail(c,"#bcafa0",x+7,94,81,1);rect(c,"#6c3e54",x-5,36,14,104);rect(c,"#6c3e54",x+89,36,14,104);detail(c,"#b47a79",x-3,39,2,96);}
      rect(c,"#292f3c",334,43,85,102);rect(c,"#78556a",339,48,75,92);rect(c,"#ab8990",342,51,69,2);rect(c,"#4e3b51",346,58,61,76);
      rect(c,"#645041",298,125,154,20);rect(c,"#a3835a",293,122,164,5);detail(c,"#ddbc86",296,122,157,1);rect(c,"#e3d8ad",317,112,31,9);detail(c,"#8b897c",321,115,21,.5);
      c.strokeStyle="#c2b08b88";c.lineWidth=1;for(let i=0;i<4;i++){c.beginPath();c.moveTo(308+i*33,42);c.lineTo(449-i*31,141);c.stroke();}
      rect(c,"#bca981",368,72,17,24);rect(c,"#634950",371,76,11,17);c.font="8px Galmuri, monospace";c.fillStyle="#efdaa3";c.fillText("封",372,88);
    } else {
      towerRoom(c,activity);
    }
    const towerFloor={armory:'#64717d',library:'#79677c',garden:'#648276',clock:'#8d7967',astral:'#596c91'}[activity.theme||S.towerEncounter(activity.floor).id];
    const floor = kind === "daily" ? "#a18b62" : kind === "weekly" ? "#676477" : towerFloor;
    perspectiveFloor(c,floor,{wood:kind==='daily'||kind==='tower'&&activity.theme==='library',vanishX:kind==='weekly'?374:249});detail(c,"#c4c6a0",0,151,480,2);
    if(kind === "weekly"){c.save();c.fillStyle='#705365';c.strokeStyle='#c3a67b';c.lineWidth=1;c.beginPath();c.moveTo(340,153);c.lineTo(405,153);c.lineTo(463,280);c.lineTo(247,280);c.closePath();c.fill();c.stroke();c.restore();}
    if (!still) for(let i=0;i<15;i++){const x=(i*71+(reduced?0:Math.sin(time*.4+i)*9)+480)%480,y=(i*29+(reduced?0:time*3))%250;rect(c,kind==="weekly"?"#d3b9e73d":"#e9edba3d",x,y,1,1);}
    rect(c,"#152d3520",0,263,480,17);
  }
  function background(c, stage, time, still = false) {
    if(window.SchoolAscensionArt?.background(c,S.chapter(stage),480,280))return;
    if(window.SchoolExpansionArt?.background(c,S.chapter(stage),480,280))return;
    const zone = S.visualChapter(stage), outdoor = zone === 3 || zone === 5;
    if (zone >= 6) { newBackground(c, zone, time, still); return; }
    const wall = ["#d9c6a1", "#c5c6ab", "#bdab92", "#8cab83", "#b6b6a1", "#626e8d"][zone];
    rect(c, wall, 0, 0, 480, 280);
    // Layered colour bands and small masonry details keep the scenery readable
    // at QHD without introducing a blur filter or stretching a low-res bitmap.
    if (!outdoor) {
      rect(c, shade(wall, 10), 0, 0, 480, 15); rect(c, shade(wall, -8), 0, 129, 480, 8);
      for (let y = 31; y < 132; y += 18) for (let x = 7 + y % 11; x < 480; x += 47) detail(c, "#fff8dc20", x, y, 7, .5);
    }
    if (outdoor) {
      const sky = zone === 5 ? ["#3d456b", "#61698e", "#9897ad"] : ["#9fc6bd", "#c3d5b4", "#e5dcaf"];
      for (let i = 0; i < 3; i++) rect(c, sky[i], 0, i * 47, 480, 48);
      if (zone === 5) { for (let i = 0; i < 24; i++) rect(c, "#e8dfb8", (i * 73 + 27) % 480, (i * 31 + 11) % 117, 2, 2); rect(c, "#e9dfbc", 360, 26, 29, 29); rect(c, sky[0], 353, 20, 24, 25); }
      else { rect(c, "#efe2a1", 390, 24, 31, 31); for (let i = 0; i < 4; i++) { const x = (i * 135 + time * 1.5) % 560 - 60; rect(c, "#e9e7c9", x, 26 + i * 20, 68, 11); rect(c, "#e9e7c9", x + 13, 17 + i * 20, 32, 12); } }
      for (let i = 0; i < 13; i++) { const x = i * 40, by = 108 - (i % 3) * 15; rect(c, zone === 5 ? "#48516b" : "#658978", x, by, 35, 50);
        if (zone === 5) for (let wy = by + 6; wy < 135; wy += 9) for (let wx = x + 5; wx < x + 30; wx += 8) detail(c, (wx + wy) % 3 ? "#a8b7b07d" : "#edda9f9c", wx, wy, 3, 4);
        else { rect(c, "#749b78", x - 5, by - 4, 28, 16); rect(c, "#8cae86", x, by - 8, 16, 8); for (let leaf = 0; leaf < 4; leaf++) detail(c, "#bad09b", x + leaf * 5, by + (leaf % 2) * 3, 2, .5); }
      }
      rect(c, zone === 5 ? "#555f75" : "#62775c", 0, 137, 480, 13); rect(c, "#b7b69b", 0, 136, 480, 4);
      for (let i = 0; i < 10; i++) { rect(c, "#8a947d", i * 55, 116, 5, 26); detail(c, "#cbd1b0", i * 55, 116, 1, 26); }
      detail(c, zone === 5 ? "#c3c8d0" : "#cbd1b0", 0, 119, 480, 1); detail(c, "#d4d8b3", 0, 136, 480, .5);
      if (zone === 3) {
        rect(c, "#927750", 209, 119, 72, 5); rect(c, "#ae9365", 207, 113, 76, 5); rect(c, "#bba16c", 207, 107, 76, 4); rect(c, "#536453", 214, 124, 4, 14); rect(c, "#536453", 272, 124, 4, 14);
        for (let i = 0; i < 14; i++) { const x = i * 34 + 4, y = 142 + (i % 3); detail(c, "#dcd9a9", x, y, 2, .5); detail(c, "#ebc2a3", x + 6, y - 3, 2, 2); detail(c, "#729567", x + 6.5, y, .5, 4); }
      }
    } else {
      rect(c, "#6c6555", 0, 16, 480, 5); rect(c, "#a08f70", 0, 22, 480, 3);
      for (const wx of [24, 105]) {
        rect(c, "#716b58", wx - 3, 35, 72, 83); rect(c, "#e6ddb4", wx, 38, 66, 77);
        rect(c, zone === 2 ? "#94b0aa" : "#9dbfb1", wx + 3, 41, 60, 68);
        rect(c, "#b5cba9", wx + 3, 80, 60, 29); rect(c, "#e5d4a2", wx + 30, 38, 4, 77); rect(c, "#e5d4a2", wx, 71, 66, 4);
        rect(c, "#827359", wx - 6, 115, 78, 5);
        detail(c, "#fff4cf", wx, 38, 66, 1); detail(c, "#f2e7bd", wx, 38, 1, 77); detail(c, "#546d6666", wx + 3, 42, 1, 67);
        for (let i = 0; i < 4; i++) { const tx = wx + 5 + i * 14, ty = 88 + (i % 2) * 5; rect(c, "#9db69a", tx, ty, 11, 18); rect(c, "#abc5a5", tx + 2, ty - 4, 7, 9); }
        // Glints stay inside each glass pane, with opaque pixel edges.
        detail(c, "#eff4db66", wx + 7, 46, 3, 18); detail(c, "#eff4db44", wx + 11, 46, 1, 11);
        detail(c, "#eff4db66", wx + 38, 46, 3, 18); detail(c, "#eff4db44", wx + 42, 46, 1, 11);
        rect(c, "#e5d4a2", wx + 30, 38, 4, 77); rect(c, "#e5d4a2", wx, 71, 66, 4);
        detail(c, "#fff4d0", wx + 30, 38, .5, 77); detail(c, "#fff4d0", wx, 71, 66, .5); detail(c, "#7f806b", wx + 28, 88, 1.5, 5);
        detail(c, "#c1ad83", wx - 6, 115, 78, 1); detail(c, "#4e514531", wx - 3, 120, 72, 2);
      }
      if (zone === 2) {
        for (const sx of [207, 300, 390]) { rect(c, "#745e47", sx, 38, 73, 105); rect(c, "#554d3f", sx + 5, 43, 63, 90); detail(c, "#c5a67c", sx + 1, 39, 1, 103); for (let row = 0; row < 3; row++) { for (let j = 0; j < 8; j++) { const bx = sx + 8 + j * 7, by = 48 + row * 28; rect(c, ["#8d6d5d", "#909c7b", "#c7b17a", "#7e92a0"][(j + row) % 4], bx, by, 5, 21 - (j % 3) * 2); detail(c, "#f0d9a6", bx + 1, by + 3, 3, .5); detail(c, "#f0d9a6", bx + 1, by + 14, 3, .5); detail(c, "#ffffff22", bx, by, .5, 18); } rect(c, "#8e7351", sx + 3, 71 + row * 28, 67, 4); detail(c, "#c7a87c", sx + 3, 71 + row * 28, 67, .5); } }
      } else if (zone === 1) {
        // A hallway has lockers and a notice board instead of a classroom board.
        for (let i = 0; i < 6; i++) { const lx = 210 + i * 23; rect(c, "#687f75", lx, 52, 22, 84); rect(c, i % 2 ? "#9bab8e" : "#aab69a", lx + 1, 53, 20, 81); detail(c, "#d4dabb", lx + 2, 54, .5, 78); detail(c, "#657467", lx + 17, 89, 1, 5); for (let r = 0; r < 3; r++) detail(c, "#778e78", lx + 5, 60 + r * 3, 10, .5); detail(c, "#f2e3b8", lx + 8, 78, 6, 3); }
        rect(c, "#96734d", 372, 49, 83, 65); rect(c, "#c6ad7c", 375, 52, 77, 59);
        for (const [px,py,pw,ph,col] of [[380,58,27,28,"#f5e7be"],[412,58,31,18,"#d4e1bd"],[414,82,28,21,"#e2c8ab"]]) { rect(c,col,px,py,pw,ph); detail(c,"#8d8e7355",px+4,py+7,pw-8,.5); detail(c,"#8d8e7355",px+4,py+11,pw-11,.5); detail(c,"#9d624b",px+pw/2,py+1,1.5,1.5); }
      } else if (zone === 4) {
        // Gym wall panelling, a basketball hoop and a compact school scoreboard.
        for (let wx = 198; wx < 480; wx += 15) { rect(c, "#b99b73", wx, 33, 14, 104); detail(c, "#d1b48a", wx, 33, .5, 103); detail(c, "#9f825f", wx + 13, 33, .5, 103); }
        rect(c, "#5d6b66", 260, 29, 6, 17); rect(c, "#786d57", 232, 44, 68, 47); rect(c, "#efe4c6", 234, 46, 64, 43); rect(c, "#c06e4f", 250, 64, 32, 1); rect(c, "#c06e4f", 250, 64, 1, 21); rect(c, "#c06e4f", 281, 64, 1, 21); rect(c, "#c06e4f", 250, 84, 32, 1);
        rect(c, "#80563e", 251, 87, 30, 3); rect(c, "#d9875d", 252, 87, 28, 1);
        for (let net = 0; net < 6; net++) { detail(c, "#f0e8cc", 253 + net * 5, 91, .5, 12); detail(c, "#ded6ba", 255 + net * 4, 103, .5, 6); } detail(c, "#f0e8cc", 253, 96, 26, .5); detail(c, "#f0e8cc", 256, 104, 21, .5);
        rect(c, "#4f5c4c", 358, 46, 92, 42); rect(c, "#293f3d", 360, 48, 88, 38); c.fillStyle = "#d7d9b5"; c.font = "6px Galmuri, monospace"; c.fillText("HOME    SCHOOL    AWAY", 365, 58); c.fillStyle = "#e8c16e"; c.font = "14px Galmuri, monospace"; c.fillText("24   :   16", 367, 77);
        for (const bx of [387, 415]) { rect(c, "#6e7a6c", bx, 108, 20, 29); rect(c, "#9aa080", bx + 2, 111, 16, 24); detail(c, "#c7c6a0", bx + 3, 112, 1, 22); }
      } else {
        rect(c, "#6e614b", 207, 39, 182, 88); rect(c, "#3b6456", 213, 45, 170, 75); rect(c, "#b7bf97", 227, 57, 62, 2); rect(c, "#b7bf97", 227, 65, 105, 2); rect(c, "#b7bf97", 227, 73, 80, 2);
        c.fillStyle = "#d4d8b4"; c.font = "11px Galmuri, monospace"; c.fillText("방과 후 모험부", 227, 101);
        rect(c, "#9d8460", 202, 125, 193, 5); rect(c, "#c5bca0", 347, 122, 13, 3);
        rect(c, "#776a57", 419, 42, 34, 34); rect(c, "#ede2bf", 423, 46, 26, 26); rect(c, "#675d50", 435, 51, 2, 12); rect(c, "#675d50", 435, 60, 9, 2);
        detail(c, "#b8a477", 208, 40, 180, .5); detail(c, "#829d7c", 214, 46, 168, .5); detail(c, "#244d433b", 214, 118, 168, 1.5);
        for (let i = 0; i < 6; i++) detail(c, "#e1ddad", 226 + i * 4, 83, 2, .5);
        rect(c, "#c6ab77", 418, 91, 36, 37); rect(c, "#f1e2bc", 420, 93, 32, 32); detail(c, "#ab7460", 425, 99, 22, 2);
        for (let r = 0; r < 4; r++) for (let col = 0; col < 5; col++) detail(c, r === 2 && col === 2 ? "#b2785c" : "#b6b394", 425 + col * 4.5, 105 + r * 4, 2, 1.5);
      }
      rect(c, "#a49b7c", 0, 137, 480, 13); rect(c, "#796c53", 0, 148, 480, 6);
      detail(c, "#d6c7a0", 0, 137, 480, 1); detail(c, "#514f412e", 0, 151, 480, 2);
    }
    const floor = outdoor ? (zone === 5 ? "#7e8490" : "#a5ae87") : "#b2946a";
    perspectiveFloor(c,floor,{wood:!outdoor,vanishX:zone===4?240:250});
    if (zone === 4) { detail(c, "#f2e6b594", 11, 164, 458, 1); detail(c, "#f2e6b594", 240, 164, 1, 116); detail(c, "#f2e6b594", 12, 164, 1, 116); detail(c, "#f2e6b594", 468, 164, 1, 116); c.save(); c.strokeStyle = "#f2e6b594"; c.lineWidth = .8; c.beginPath(); c.ellipse(240, 227, 47, 26, 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
    if (!outdoor) { rect(c, "#f8e8b21a", 29, 155, 63, 20); rect(c, "#f8e8b218", 35, 175, 68, 20); rect(c, "#f8e8b214", 42, 195, 74, 20); rect(c, "#f8e8b21a", 111, 155, 60, 20); rect(c, "#f8e8b218", 118, 175, 66, 20); }
    rect(c, "#2b3d3420", 0, 260, 480, 20);
    if (!outdoor) { rect(c, "#806b4d", 13, 238, 32, 27); rect(c, "#d1b578", 9, 230, 41, 10); detail(c, "#f1d39a", 10, 231, 38, 1); detail(c, "#5a523b", 13, 241, 32, 1); detail(c, "#b89a68", 15, 242, 1, 21); rect(c, "#68795d", 22, 218, 22, 11); rect(c, "#a2ab7e", 29, 208, 13, 15); rect(c, "#697c60", 14, 213, 16, 9); detail(c, "#c3cb8c", 30, 210, 6, 1); detail(c, "#b5c185", 16, 214, 5, .5); detail(c, "#435b48", 27, 220, 2, 9); }
    if (!still) for (let i = 0; i < 10; i++) { const x = (i * 59 + Math.sin(time * .15 + i) * 15 + 32) % 480, y = (i * 19 + time * 3) % 235; rect(c, "#fff1c745", x, y, 2, 2); }
  }
  function weather(c, battle, time) {
    const zone = S.visualChapter(battle.stage), kind = battle.activity?.kind;
    if (kind) {
      for (let i = 0; i < 15; i++) { const x = (i * 71 + Math.sin(time * .4 + i) * 9 + 480) % 480, y = (i * 29 + time * 3) % 250; rect(c, kind === "weekly" ? "#d3b9e73d" : "#e9edba3d", x, y, 1, 1); }
    } else if (zone < 6) {
      for (let i = 0; i < 10; i++) { const x = (i * 59 + Math.sin(time * .15 + i) * 15 + 32) % 480, y = (i * 19 + time * 3) % 235; rect(c, "#fff1c745", x, y, 2, 2); }
    } else if (zone === 6 || zone === 11) snow(c, time);
    else if (zone === 9) {
      for (let i = 0; i < 7; i++) rect(c, "#9bd2c178", i * 67 + 21, 53 + (time * 18 + i * 23) % 97, 1, 4);
      for (let i = 0; i < 20; i++) detail(c, "#bcdfce77", (i * 53 + time * 8) % 480, 162 + i * 17 % 111, 13 + i % 4 * 5, .5);
    } else if (zone === 10) {
      for (let i = 0; i < 15; i++) rect(c, "#edf1d65c", (i * 49 + time * 32) % 510 - 20, 35 + i * 19 % 199, 11 + i % 4 * 7, 1);
    }
  }
  function scenery(c, battle, extendedParty, time, reduced) {
    const width = c.canvas.width, height = c.canvas.height;
    const key = `${S.chapter(battle.stage)}:${battle.activity?.kind || "story"}:${battle.activity?.floor || 0}:${+extendedParty}:${fontRevision}:${window.SchoolExpansionArt?.revision||0}:${window.SchoolAscensionArt?.revision||0}`;
    let cached = backgrounds.get(c.canvas);
    if (!cached || cached.width !== width || cached.height !== height || cached.key !== key) {
      const layer = document.createElement("canvas"); layer.width = width; layer.height = height;
      const sc = layer.getContext("2d", {alpha:false}); sc.setTransform(width / 480, 0, 0, height / 280, 0, 0);
      sc.imageSmoothingEnabled = false;
      if (extendedParty) { sc.translate(-36, -42); sc.scale(1.15, 1.15); }
      if (battle.activity) activityBackground(sc, battle.activity, 0, true, true);
      else background(sc, battle.stage, 0, true);
      if(!battle.activity&&battle.stage>S.NORMAL_MAX_STAGE){sc.save();sc.setTransform(1,0,0,1,0,0);sc.fillStyle='#35183b45';sc.fillRect(0,0,width,height);sc.restore();}
      depthAtmosphere(sc,width,height);
      cached = {key, width, height, layer}; backgrounds.set(c.canvas, cached);
    }
    c.drawImage(cached.layer, 0, 0, 480, 280);
    c.save(); if (extendedParty) { c.translate(-36, -42); c.scale(1.15, 1.15); }
    weather(c, battle, reduced ? 0 : time); c.restore();
  }
  function panoramicViewport(canvas) {
    const scale = Math.min(canvas.width / 480, canvas.height / 280);
    return {scale, x:(canvas.width - 480 * scale) / 2, y:(canvas.height - 280 * scale) / 2};
  }
  function panoramicScenery(c, battle, extendedParty, time, reduced, view) {
    const width = c.canvas.width, height = c.canvas.height, zone = S.chapter(battle.stage);
    const baseZone=S.visualChapter(battle.stage);
    const imageName = !battle.activity && ([0,1,2].includes(baseZone) ? 'classroom' : baseZone === 3 ? 'garden' : baseZone === 6 ? 'snow' : null);
    const picture = imageName && battlefieldImages.get(imageName);
    const key = `panorama:${zone}:${battle.activity?.kind || 'story'}:${battle.activity?.floor || 0}:${+extendedParty}:${fontRevision}:${battlefieldRevision}:${window.SchoolExpansionArt?.revision||0}:${window.SchoolAscensionArt?.revision||0}`;
    let cached = backgrounds.get(c.canvas);
    if (!cached || cached.width !== width || cached.height !== height || cached.key !== key) {
      const layer = document.createElement('canvas'); layer.width = width; layer.height = height;
      const sc = layer.getContext('2d', {alpha:false}); sc.imageSmoothingEnabled = false;
      if(!battle.activity&&window.SchoolAscensionArt?.background(sc,zone,width,height)){}
      else if(!battle.activity&&window.SchoolExpansionArt?.background(sc,zone,width,height)){}
      else if (picture?.loaded) {
        const image = picture.image, ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const sw = width / ratio, sh = height / ratio;
        sc.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, 0, 0, width, height);
        paintedDepth(sc,width,height,imageName,image,sw,sh);
      } else {
        // Only scenery may stretch to fill the wide viewport. Sprites, damage
        // numbers and every skill effect use a separate uniform transform.
        sc.setTransform(width / 480, 0, 0, height / 280, 0, 0);
        if (extendedParty) { sc.translate(-36, -42); sc.scale(1.15, 1.15); }
        if (battle.activity) activityBackground(sc, battle.activity, 0, true, true);
        else background(sc, battle.stage, 0, true);
      }
      if(!battle.activity&&battle.stage>S.NORMAL_MAX_STAGE){sc.save();sc.setTransform(1,0,0,1,0,0);sc.fillStyle='#35183b45';sc.fillRect(0,0,width,height);sc.restore();}
      depthAtmosphere(sc,width,height);
      cached = {key, width, height, layer}; backgrounds.set(c.canvas, cached);
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(cached.layer, 0, 0);
    c.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    c.save(); if (extendedParty && !picture?.loaded) { c.translate(-36, -42); c.scale(1.15, 1.15); }
    weather(c, battle, reduced ? 0 : time); c.restore();
  }
  function sceneBounds(canvas) {
    if (canvas.dataset?.layout !== 'panorama') return {x:0,y:0,width:480,height:280};
    const view = panoramicViewport(canvas);
    return {x:-view.x/view.scale,y:-view.y/view.scale,width:canvas.width/view.scale,height:canvas.height/view.scale};
  }
  function makeDragon() {
    const dragon = document.createElement("canvas"); dragon.width = 104; dragon.height = 72;
    const dc = dragon.getContext("2d");
    const spine = [[8,60],[16,63],[25,59],[29,51],[25,43],[20,36],[24,27],[34,24],[44,29],[49,37],[55,43],[64,39],[68,31],[64,23],[64,16],[71,12],[80,15]];
    for (const [size, color] of [[13,"#196ca5"],[9,"#249dd5"],[5,"#6cdced"]]) {
      for (let j = 1; j < spine.length; j++) { const a = spine[j - 1], b = spine[j]; for (let t = 0; t <= 1; t += .12) rect(dc, color, a[0] + (b[0] - a[0]) * t - size / 2, a[1] + (b[1] - a[1]) * t - size / 2, size, size); }
    }
    for (const [x,y] of [[20,40],[32,22],[48,29],[58,42],[63,19]]) { rect(dc,"#b0f5fa",x-3,y-5,4,7); rect(dc,"#6bd9ee",x-5,y-8,3,4); }
    rect(dc,"#186d9f",70,7,18,15); rect(dc,"#35b7e1",71,7,17,12); rect(dc,"#87e9f3",74,7,13,4);
    rect(dc,"#197aa9",84,14,16,8); rect(dc,"#64dbed",84,14,15,5); rect(dc,"#bdfbfa",94,14,5,3);
    rect(dc,"#18769f",81,22,15,4); rect(dc,"#85e6f2",82,22,14,2); rect(dc,"#eafffb",86,19,3,4);
    rect(dc,"#dcffff",82,11,5,3); rect(dc,"#185681",86,11,2,2);
    rect(dc,"#a3f4f6",70,0,3,9); rect(dc,"#6cdbef",67,0,4,3); rect(dc,"#bdfbfa",78,2,3,7); rect(dc,"#60c9eb",80,0,3,3);
    for (const [x,y] of [[62,7],[59,12],[61,17]]) { rect(dc,"#5acdeb",x,y,11,3); rect(dc,"#a6f1f7",x-3,y-2,5,2); }
    rect(dc,"#b0f6fa",94,20,9,2); rect(dc,"#b0f6fa",101,21,2,7); rect(dc,"#8eeaf5",97,27,6,2);
    return dragon;
  }
  let dragon = null;
  const dragonSprite = () => dragon || (dragon = makeDragon());
  // A restored main canvas may share a GPU context with cached canvases.
  // Rebuild their pixels lazily; decoded source images and portrait URLs stay.
  function resetRenderCache() {
    labelMeasure=null;
    backgrounds = new WeakMap();
    osiaPoses.clear(); osiaFrontSources.clear(); lavaPoses.clear(); lavaSources.clear(); spicaPoses.clear(); sprites.clear(); combatLabels.clear(); horasPoses.clear(); horasPortraitSources.clear(); horasFxSources.clear(); horasCutinSource=null;
    lavaPosePixels = spritePixels = combatLabelPixels = horasPosePixels = 0;
    void warmHorasEffects();if(horasCutinLoaded)void warmHorasSource('face');
    dragon = null; window.SchoolOsiaWeaponArt?.reset();
  }
  function waterOrb(c, x, y, radius) {
    if(!Number.isFinite(radius)||radius<=0)return;
    // Scale all facets with the orb: fixed-width blocks inverted at small sizes.
    const r=radius;
    c.save();c.translate(x,y);c.scale(r,r);
    const facet=(color,s,dy)=>{
      c.fillStyle=color;c.beginPath();c.moveTo(-s*.42,dy-s);
      c.lineTo(s*.42,dy-s);c.lineTo(s,dy-s*.42);c.lineTo(s,dy+s*.42);
      c.lineTo(s*.42,dy+s);c.lineTo(-s*.42,dy+s);c.lineTo(-s,dy+s*.42);
      c.lineTo(-s,dy-s*.42);c.closePath();c.fill();
    };
    facet('#17679e',1,0);facet('#37b7db',.84,-.03);facet('#89eef5',.54,-.22);
    c.fillStyle='#e9ffff';c.fillRect(-.4,-.62,.4,.2);c.fillRect(-.54,-.46,.18,.24);
    c.fillStyle='#a9f6ff';c.fillRect(.47,.12,.17,.28);
    c.restore();
  }
  function waterBurst(c, p, age, reduced, size = 1, economy = false) {
    if(age<0||age>=.65)return;
    const progress=age/.65,spread=(reduced?15:7+progress*31)*size;
    c.save(); c.globalAlpha *= (1-progress)*(1-progress);
    c.strokeStyle='#a1f4fa';c.lineWidth=1.5*size;c.beginPath();
    c.ellipse(p.x,p.y-34,spread,spread*.65,0,0,Math.PI*2);c.stroke();
    for(let i=0,n=reduced?4:economy?6:9;i<n;i++){
      const a=i*Math.PI*2/n,dx=Math.cos(a),dy=Math.sin(a),r=spread*(i%2?.85:1.15);
      const x=p.x+dx*r,y=p.y-34+dy*r*.7+(reduced?0:progress*progress*12*size),length=(4-progress*2)*size,width=1.5*size;
      c.fillStyle=i%2?'#cffaff':'#49c8e6';c.beginPath();c.moveTo(x+dx*length,y+dy*length);
      c.lineTo(x-dy*width,y+dx*width);c.lineTo(x-dx*length*.6,y-dy*length*.6);
      c.lineTo(x+dy*width,y-dx*width);c.closePath();c.fill();
    }
    c.restore();
  }
  function waterDragon(c, source, targets, age, reduced, economy = false) {
    const destination = Math.min(453, Math.max(...targets.map(p=>p.x)) + 24);
    c.save();
    if(reduced){
      c.globalAlpha=.85; c.drawImage(dragonSprite(),age<1?source.x+20:150,44,age<1?145:300,age<1?100:208);
      for(const p of targets)rect(c,"#80e5f0",p.x-22,p.y-10,44,6);
    }else{
      // 0-.5s: the summoning pool opens; .5-1s: the body uncoils and rushes right.
      const summon=Math.min(1,age/.5),rush=Math.max(0,Math.min(1,(age-.5)/.5)),impact=Math.max(0,age-1);
      c.globalAlpha=Math.min(1,summon*2)*Math.max(0,1-impact/.8);
      for(let ring=0;ring<(economy?1:3);ring++){
        c.strokeStyle=["#187ba5","#45cee5","#c3ffff"][ring];c.lineWidth=4-ring;c.beginPath();c.ellipse(source.x+18,source.y-4-ring*4,18+summon*27-ring*5,5+summon*8,0,0,Math.PI*2);c.stroke();
      }
      const nose=source.x+108+(destination-source.x-108)*(rush*rush),headY=179-summon*43-Math.sin(rush*Math.PI)*33;
      // Animated pixel segments bend independently instead of moving a static dragon image.
      for(let i=23;i>=0;i--){
        const x=source.x+18+(nose-96-source.x-18)*(1-i/24),y=headY-8+Math.sin(i*.5-age*10)*(12+i*.65)+i*1.6;
        const size=Math.max(4,(28-i*.8)*summon);
        rect(c,"#176799",x-size/2,y-size/2,size,size);rect(c,"#2aafd5",x-size/2+3,y-size/2+2,Math.max(2,size-5),Math.max(2,size-4));
        rect(c,"#83edf4",x-size/2+4,y-size/2+3,Math.max(2,size-8),Math.max(2,size*.27));
        if(i%4===0&&i<20){rect(c,"#b9ffff",x-2,y-size/2-8,4,10);rect(c,"#60daed",x-5,y-size/2-10,4,5);}
      }
      c.drawImage(dragonSprite(),63,0,41,32,Math.round(nose-123),Math.round(headY-57),123,96);
      for(let i=0;i<(economy?5:13);i++){const x=source.x+26+(i*43+age*185)%Math.max(40,nose-source.x-10),y=166+Math.sin(i+age*8)*28;rect(c,"#94edf5",x,y,7+12*rush,3);}
      if(age>=.5)for(let i=0;i<(economy?7:17);i++){const x=source.x+30+i*(economy?45:19);if(x>nose)break;const y=227+Math.sin(i*.7-age*10)*8;rect(c,"#188bc4aa",x,y,22,18);rect(c,"#82e7f1",x,y-2,15,4);}
      if(age>=1){
        for(const p of targets){waterBurst(c,p,impact,false,2,economy);c.strokeStyle="#d3ffff";c.lineWidth=3;c.beginPath();c.ellipse(p.x,p.y-34,12+impact*65,10+impact*45,0,0,Math.PI*2);c.stroke();}
      }
    }
    c.restore();
  }
  function waterEffects(c, effects, positions, time, reduced, pending, cinematic, economy = false, divine = false) {
    for (const e of effects) {
      if (e.from !== "osia") continue;
      if (e.kind === "skill-stage" && e.stage === 4 && cinematic?.castId === e.castId && !cinematic.nonBlocking) continue;
      const rawAge = time - e.time;
      const age = !e.breath && pending && pending.id === e.castId ? Math.min(rawAge, e.impactDelay / 1000 - .001) : rawAge;
      const source = positions.osia; if (!source || age < 0) continue;
      if(divine&&e.kind==='osia-drowning'){
        const p=positions[e.to||e.target];if(p)window.SchoolOsiaWeaponArt?.drowning(c,{source,target:p,age,reduced,economy});
      }
      if (e.kind === "skill-stage" && age < (e.breath ? 4.75 : e.stage === 4 ? 1.8 : 1.1)) {
        const targets=e.targets.map(id=>positions[id]).filter(Boolean);if(!targets.length)continue;
        const motion=reduced?.3:age,impactAge=age-e.impactDelay/1000;
        c.save();
        if(e.stage===1){
          for(const p of targets){
            if(age<.5){const progress=reduced?1:Math.min(1,age/.5),x=source.x+23+(p.x-source.x-23)*progress,y=source.y-41+(p.y-source.y+7)*progress-Math.sin(progress*Math.PI)*22;waterOrb(c,x,y,19);if(!reduced){rect(c,"#8eeaf3",x-40,y-3,16,5);rect(c,"#d1ffff",x-56,y-1,10,2);}}
            else {waterOrb(c,p.x,p.y-34,Math.max(6,22-impactAge*24));waterBurst(c,p,impactAge,reduced,1.3,economy);}
          }
        } else if(e.stage===2){
          c.globalAlpha=age<.5?.6+age*.8:Math.max(0,1-impactAge/.65);
          for(const p of targets){
            for(let ring=0;ring<(economy?2:4);ring++){c.strokeStyle=["#176ba1","#229dce","#5bdaed","#cbffff"][ring];c.lineWidth=4-ring*.5;c.beginPath();c.ellipse(p.x,p.y-21-ring*13,34-ring*5,12,-motion*6,0,Math.PI*2);c.stroke();}
            for(let i=0,n=economy?4:12;i<n;i++){const a=i*Math.PI*2/n+motion*13;rect(c,"#92f0f9",p.x+Math.cos(a)*37,p.y-42+Math.sin(a)*31,4,6);}
          }
        } else if(e.stage===3){
          for(const p of targets){
            const height=reduced?100:age<.5?16+age*180:106-Math.max(0,impactAge)*75;
            c.globalAlpha=age<.8?1:Math.max(0,(1.1-age)/.3);
            rect(c,"#197aaccc",p.x-21,p.y-height,42,height);rect(c,"#2cbbdfcc",p.x-15,p.y-height-8,30,height+8);rect(c,"#a5f8ff",p.x-5,p.y-height-14,9,height+12);rect(c,"#efffff",p.x-2,p.y-height-14,3,height+10);
            for(let i=0;i<6;i++){const spread=(i-2.5)*13;rect(c,"#75e3f4",p.x+spread,p.y-height+Math.abs(spread)*.5-motion*22,5,9);}rect(c,"#c7ffff",p.x-27,p.y-2,54,4);
          }
        } else if(divine&&window.SchoolOsiaWeaponArt){
          const target=targets.reduce((a,b)=>b.x>a.x?b:a,targets[0]);
          window.SchoolOsiaWeaponArt.dragon(c,{source,target,age,reduced,economy,breath:!!e.breath,layer:e.breath?'front':undefined});
        } else waterDragon(c,source,targets,age,reduced,economy);
        c.restore();
        c.save();c.font="11px Galmuri, monospace";c.textAlign="center";
        const label=`스킬 ${e.stage}/4 · ${e.name}${e.breath?(age<.9?" 소환":age<2?" 흡기":age<4.3?" 브레스":" 잔류 물결"):e.stage===4?(age<.5?" 소환":age<1?" 돌진":" 명중!"):""}`,width=c.measureText(label).width+24;
        rect(c,"#153c55ed",240-width/2,13,width,23);rect(c,"#8beaff",240-width/2,35,width,2);c.fillStyle="#d4fbff";c.fillText(label,240,29);c.restore();
      }
      if(e.kind==="hit"&&!e.skill&&age<.65){
        const p=positions[e.to];if(!p)continue;
        if(age<.3){const progress=reduced?1:Math.min(1,age/.3),x=source.x+17+(p.x-source.x-17)*progress,y=source.y-38+(p.y-source.y+4)*progress-Math.sin(progress*Math.PI)*13;waterOrb(c,x,y,9);}
        else waterBurst(c,p,age-.3,reduced,.7,economy);
      }
    }
  }
  function windRing(c, x, y, age, reduced, size = 1, economy = false) {
    c.save(); c.globalAlpha *= Math.max(0, 1 - age / 1.15);
    const turn = reduced ? 0 : age * 2.8;
    for (let ring = 0; ring < (economy?1:3); ring++) {
      c.strokeStyle = ["#87bda8", "#c5e9ba", "#f0f7d5"][ring]; c.lineWidth = 2 - ring * .4;
      c.beginPath(); c.ellipse(x, y - 15 - ring * 15 * size, (24 - ring * 3) * size, 6 * size, -.16, turn + ring, turn + ring + 4.7); c.stroke();
    }
    for (let i = 0,n=economy?3:7; i < n; i++) { const a = i * Math.PI * 2/n + turn, px = x + Math.cos(a) * 24 * size, py = y - 26 + Math.sin(a) * 22 * size; rect(c, i % 2 ? "#eff3c4" : "#a7d3a9", px, py, 4, 1); detail(c, "#d7f5c8", px + 1, py - 1, 1, 3); }
    c.restore();
  }
  function windShield(c, x, y, color, alpha = 1, size = 1) {
    c.save(); c.globalAlpha *= alpha; c.translate(x, y - 29); c.scale(size, size);
    c.fillStyle = color + "30"; c.strokeStyle = color; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-20,-22); c.lineTo(0,-29); c.lineTo(20,-22); c.lineTo(18,8); c.lineTo(9,21); c.lineTo(0,27); c.lineTo(-9,21); c.lineTo(-18,8); c.closePath(); c.fill(); c.stroke();
    detail(c, "#f7ffdf", -10, -15, 1, 14); detail(c, "#f7ffdf", -9, -16, 10, 1); c.restore();
  }
  function windRibbon(c, source, target, age, reduced, power = 1, economy = false) {
    const progress = reduced ? 1 : clamp01(age / .55), sx = source.x + 17, sy = source.y - 38, tx = target.x, ty = target.y - 30;
    const bend = (target.x > source.x ? -1 : 1) * 30 * power;
    c.save(); c.globalAlpha *= Math.max(0, 1 - Math.max(0, age - .55) / .65);
    for (let trail = economy?0:2; trail >= 0; trail--) {
      c.strokeStyle = ["#ecffd2", "#bde9b9", "#70b8a6"][trail]; c.lineWidth = (3 - trail * .6) * power; c.beginPath();
      const start = Math.max(0, progress - .5 - trail * .08);
      for (let n = 0,segments=economy?8:18; n <= segments; n++) { const t = start + (progress - start) * n / segments, x = sx + (tx - sx) * t, y = sy + (ty - sy) * t + Math.sin(t * Math.PI) * bend + trail * 3; if (n) c.lineTo(x,y); else c.moveTo(x,y); }
      c.stroke();
    }
    const x = sx + (tx - sx) * progress, y = sy + (ty - sy) * progress + Math.sin(progress * Math.PI) * bend;
    rect(c,"#efffd9",x-3,y-2,7,3);rect(c,"#a4d9ad",x-1,y-4,3,7); c.restore();
  }
  function lavaCutin(c, event, age, reduced) {
    // This is a short visual accent on the existing skill event, not a new
    // cinematic game state. Enemy attacks and healing continue underneath it.
    if (reduced || age < 0 || age >= 1.15) return false;
    const enter = clamp01(age / .23), leave = clamp01((1.15 - age) / .28), stage = event.stage;
    c.save(); c.globalAlpha *= Math.min(enter, leave);
    c.translate(268 + (1 - enter) * 25 - (1 - leave) * 12, 0);
    c.beginPath(); c.rect(10, 42, 194, 56); c.clip();
    rect(c, "#132c36ee", 10, 42, 194, 56); rect(c, stage === 1 ? "#416e64" : "#4d626e", 12, 44, 190, 52);
    for (let i = 0; i < 7; i++) { const x = 12 + (i * 36 + age * 70) % 230; rect(c, i % 2 ? "#dbefbd27" : "#c1e8e53a", x, 46 + i * 7, 35 + i * 4, 1); }
    c.save();c.translate(40,121);c.scale(1.7,1.7);lavaFigure(c,age,{casting:true,motion:{age,reduced:false}},true);c.restore();
    c.save(); c.translate(70, 84); c.rotate(-.6 + enter * .6 + age * .8); c.scale(1.1, 1.1); fan(c, 0, 0); c.restore();
    c.textAlign = "left"; c.font = "7px Galmuri, monospace"; c.fillStyle = "#d0ebc1"; c.fillText("바람의 무당 · 라바", 86, 57);
    c.font = "11px Galmuri, monospace"; c.fillStyle = "#122d39"; c.fillText(event.name, 87, 75); c.fillStyle = "#fff5c8"; c.fillText(event.name, 86, 74);
    c.font = "7px Galmuri, monospace"; c.fillStyle = "#e0efcd"; c.fillText(stage === 1 ? "아군 전체 회복 · 방어막" : "위급한 아군 집중 회복", 86, 88);
    detail(c, "#bdecc9", 12, 43, 190, 1); detail(c, "#e7edba", 12, 96, 190, 1); c.restore();
    return true;
  }
  function lavaEffects(c, effects, positions, time, reduced, economy = false) {
    for (const e of effects) {
      if (e.from !== "lava") continue;
      const age = time - e.time; if (age < 0 || age > 1.8) continue;
      const source = positions.lava;
      if (e.kind === "lava-skill") {
        const targets = (e.targets || []).map(id => positions[id]).filter(Boolean);
        c.save();
        if (source) {
          const swing = reduced ? -.35 : -2.1 + clamp01(age / 1.45) * 3.4, radius = e.stage === 1 ? 37 : 47;
          c.save(); c.globalAlpha = Math.max(0, 1 - age / 1.8);
          for (let ring = 0; ring < (economy?1:3); ring++) { c.strokeStyle = ["#6baea3", "#c5edd0", "#f4ffda"][ring]; c.lineWidth = 6 - ring * 1.8; c.beginPath(); c.ellipse(source.x + 5, source.y - 34, radius - ring * 4, radius * .7 - ring * 3, -.3, swing, swing + 2.4); c.stroke(); }
          c.restore();
          if (e.stage === 2) { c.save(); c.globalAlpha = Math.max(0, 1 - age / 1.15); for (let wing = -1; wing <= 1; wing += 2) for (let feather = 0; feather < (economy?2:4); feather++) { c.strokeStyle = feather % 2 ? "#d0f4c7" : "#8ac6af"; c.lineWidth = 2; c.beginPath(); c.moveTo(source.x,source.y-27); c.quadraticCurveTo(source.x+wing*(32+feather*8),source.y-65-feather*5,source.x+wing*(44+feather*8),source.y-37-feather*6); c.stroke(); } c.restore(); }
        }
        for (const p of targets) {
          if (source && p !== source) windRibbon(c, source, p, age, reduced, e.stage === 2 ? 1.2 : .8,economy);
          windRing(c, p.x, p.y, age, reduced, e.stage === 2 ? 1.3 : 1,economy);
          if (e.stage === 1 && age < 1.1) windShield(c, p.x, p.y, "#b8e8c5", Math.max(0, 1 - age / 1.1), 1);
          if (e.stage === 2) {
            const glow = Math.max(0, 1 - age / 1.15); c.globalAlpha = glow;
            rect(c, "#d3eebe66", p.x - 14, p.y - 74, 28, 76); rect(c, "#f1f6cd88", p.x - 5, p.y - 74, 10, 76);
            rect(c, "#f8ffda", p.x - 3, p.y - 59, 6, 24); rect(c, "#f8ffda", p.x - 12, p.y - 50, 24, 6);
          }
        }
        c.globalAlpha = Math.max(0, Math.min(1, (1.8 - age) * 3));
        if (!lavaCutin(c, e, age, reduced)) {
          c.font = "10px Galmuri, monospace"; c.textAlign = "center";
          const label = `라바 · ${e.name}`, width = c.measureText(label).width + 20;
          rect(c, "#375548ee", 240 - width / 2, 39, width, 21); detail(c, "#d9edb6", 240 - width / 2, 59, width, 1); c.fillStyle = "#eff8d5"; c.fillText(label, 240, 53);
        }
        c.restore();
      } else if (e.kind === "guard") {
        const p = positions[e.to]; if (!p) continue;
        windShield(c, p.x, p.y, "#b7e1ad", Math.max(0, 1 - age / 1.25));
        if (e.passive === "ten-hits") { c.save(); c.font = "9px Galmuri, monospace"; c.textAlign = "center"; rect(c,"#3b594be8",p.x-32,p.y-86,64,16); c.fillStyle="#e5f5c9"; c.fillText("바람의 가호",p.x,p.y-75); c.restore(); }
      } else if (e.kind === "rescue") {
        const p = positions[e.to]; if (!p) continue;
        c.save(); c.globalAlpha = Math.max(0, 1 - age / 1.3); windRing(c, p.x, p.y, Math.min(age, 1), reduced, 1.8,economy);
        for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = reduced ? 38 : 18 + age * 45; rect(c, "#fff1b2", p.x + Math.cos(a) * r, p.y - 35 + Math.sin(a) * r, 3, 3); }
        c.font = "10px Galmuri, monospace"; c.textAlign = "center"; rect(c, "#68563de8", p.x - 41, p.y - 98, 82, 19); c.fillStyle = "#fff1c2"; c.fillText("생명의 바람", p.x, p.y - 85); c.restore();
      } else if (e.kind === "hit" && !e.skill && age < .85 && source) {
        const target = positions[e.to]; if (!target) continue;
        windRibbon(c, source, target, Math.min(.55, age * .9), reduced, .45,economy);
      }
    }
  }
  function osiaCinematic(c, state, time, effects, reduced) {
    const active = state.battle.cinematic, event = lastEffect(effects, e => e.kind === "cinematic" && e.from === "osia" && (!active || e.castId === active.castId));
    const duration = (event?.duration || active?.duration || S.OSIA_CINEMATIC_MS) / 1000, age = event ? time - event.time : active ? 0 : -1;
    if (age < 0 || !active && age >= duration || !active && !event) return;
    const enter = reduced ? 1 : Math.min(1, age / .12), offset = reduced ? 0 : (1 - enter) * -45;
    const bounds = sceneBounds(c.canvas);
    const divine=window.SchoolOsiaWeaponArt?.equipped(state.battle.heroes.find(h=>h.id==='osia'));
    // The short title beat leaves the actual summoning and dragon anatomy
    // visible; combat continues while the nonblocking cast is in flight.
    if(divine&&age>=.30)return;
    const cutinAlpha=c.globalAlpha*(divine?Math.max(0,1-Math.max(0,age-.18)/.12):1);
    c.save();c.globalAlpha=cutinAlpha;c.save();
    rect(c, "#081c32b8", bounds.x, bounds.y, bounds.width, bounds.height);
    c.beginPath(); c.rect(bounds.x, 61, bounds.width, 143); c.clip(); c.translate(offset, 0);
    rect(c, "#123a55f5", bounds.x - 50, 62, bounds.width + 100, 141); rect(c, "#1a5671", bounds.x, 69, bounds.width, 126);
    for (let i = 0; i < 15; i++) { const x = reduced ? i * 41 : (i * 41 + age * 230) % 550 - 50; rect(c, i % 2 ? "#75d8e741" : "#b6f6f12e", x, 78 + i * 8, 65 + i % 4 * 21, 2); }
    c.globalAlpha = cutinAlpha*(divine?.8:.42);if(divine)window.SchoolOsiaWeaponArt.portrait(c,465,122,255);else c.drawImage(dragonSprite(), 278, 69, 195, 135);c.globalAlpha = cutinAlpha;
    // Charge and release use the original illustrated poses and identity.
    const charge=reduced?.65:clamp01(age/duration);
    c.save();c.translate(80+(reduced?0:charge*10),234);c.scale(2.55,2.55);
    osiaFigure(c,age,{charge,reduced,blink:false});c.restore();
    const orbX=102+charge*40,orbY=153-Math.sin(charge*Math.PI)*19;
    c.save();c.globalAlpha=cutinAlpha*(.4+Math.sin(charge*Math.PI)*.5);waterOrb(c,orbX,orbY,9+charge*8);c.restore();
    if(!reduced)for(let i=0;i<6;i++){const angle=i*Math.PI/3-age*2.5;rect(c,"#d2ffff",orbX+Math.cos(angle)*(23-charge*8),orbY+Math.sin(angle)*(18-charge*6),2,3);}
    c.textAlign = "left"; c.font = "11px Galmuri, monospace"; c.fillStyle = "#9ee8ed"; c.fillText("물의 용왕  OSIA", 174, 99);
    const title=divine?'용왕의 권능 · 용의 신수':'용왕의 권능 · 거대 수룡';
    c.font = "17px Galmuri, monospace"; c.fillStyle = "#062b43"; c.fillText(title, 175, 132); c.fillStyle = "#f4ffef"; c.fillText(title, 174, 131);
    c.font = "9px Galmuri, monospace"; c.fillStyle = "#bee6e7"; c.fillText(divine?'UR 전용 무기 · 신수 강림':'궁극기 발동', 175, 155);
    c.restore(); detail(c, "#adf4ed", bounds.x, 61, bounds.width, 1.5); detail(c, "#87c7dc", bounds.x, 202, bounds.width, 1.5);c.restore();
  }
  function criticalMark(c,x,y,size=1){
    c.save();c.translate(Math.round(x),Math.round(y));c.scale(size,size);
    // A pixel impact-star and diagonal split, readable without a CRIT label.
    for(const [color,pad]of[["#59354a",1],["#ffc24a",0]]){
      rect(c,color,-2-pad,-8-pad,4+pad*2,16+pad*2);rect(c,color,-8-pad,-2-pad,16+pad*2,4+pad*2);
      rect(c,color,-5-pad,-5-pad,10+pad*2,10+pad*2);
    }
    for(let i=0;i<6;i++)rect(c,"#fff5bd",-5+i*2,5-i*2,3,2);
    rect(c,"#f87546",2,3,3,3);c.restore();
  }
  function frostCrystal(c,x,y,r,turn=0){
    c.save();c.translate(x,y);c.rotate(turn);c.lineWidth=Math.max(.7,r*.1);c.strokeStyle='#d9f7ff';c.beginPath();
    for(let i=0;i<6;i++){const a=i*Math.PI/3,dx=Math.cos(a),dy=Math.sin(a);c.moveTo(0,0);c.lineTo(dx*r,dy*r);c.moveTo(dx*r*.6,dy*r*.6);c.lineTo(dx*r*.45-dy*r*.22,dy*r*.45+dx*r*.22);c.moveTo(dx*r*.6,dy*r*.6);c.lineTo(dx*r*.45+dy*r*.22,dy*r*.45-dx*r*.22);}c.stroke();c.restore();
  }
  // Read the authoritative buff deadline, not the short-lived hit/event queue.
  // This survives reconnects and merges multiple casters into one field.
  function spicaFieldUntil(units){
    let until=0;for(const unit of units||[])if(Number.isFinite(unit.hasteUntil))until=Math.max(until,unit.hasteUntil);return until;
  }
  const SPICA_SNOW=Array.from({length:36},(_,i)=>({x:(i*.61803398875)%1,y:(i*.41421356237)%1,depth:.55+(i%5)*.16,phase:i*2.399963}));
  function spicaBlizzard(c,area,elapsed,until,reduced=false,economy=false){
    const duration=(S.SPICA_RULES?.hasteMs||6000)/1000,remaining=(until-elapsed)/1000;
    if(!Number.isFinite(remaining)||remaining<=0||remaining>duration||!area||area.width<=0||area.height<=0)return 0;
    const age=duration-remaining,fade=Math.min(1,.3+age*2,remaining/.65),time=reduced?0:elapsed/1000;
    const count=reduced?8:economy?18:36,unit=Math.min(2,Math.max(.7,area.width/480));
    c.save();c.beginPath();c.rect(area.x,area.y,area.width,area.height);c.clip();c.translate(area.x,area.y);c.globalAlpha*=fade;
    // Thin ice wash plus bounded wind ribbons leave enemy tells and HP readable.
    c.fillStyle='#c1eaff0b';c.fillRect(0,0,area.width,area.height);
    if(!reduced){
      c.strokeStyle='#bce9ff38';c.lineWidth=1.2*unit;
      c.beginPath();for(let i=0;i<3;i++){const y=area.height*(.22+i*.27)+Math.sin(time*.9+i*2)*10*unit;c.moveTo(-20,y+12*unit);c.bezierCurveTo(area.width*.28,y-24*unit,area.width*.6,y+24*unit,area.width+20,y-18*unit);}c.stroke();
      c.strokeStyle='#d8f6ff62';c.lineWidth=.85*unit;c.beginPath();
      for(let i=0;i<count;i++){const p=SPICA_SNOW[i],x=(p.x*area.width+time*57*p.depth)%(area.width+20)-10,y=(p.y*area.height+time*17*p.depth+Math.sin(time*.8+p.phase)*5*unit+area.height) % area.height;c.moveTo(x-7*p.depth*unit,y-2*unit);c.lineTo(x,y);}c.stroke();
    }
    c.fillStyle='#e3f8ffbf';
    for(let i=0;i<count;i++){
      const p=SPICA_SNOW[i],x=(p.x*area.width+time*57*p.depth)%(area.width+20)-10,y=(p.y*area.height+time*17*p.depth+Math.sin(time*.8+p.phase)*5*unit+area.height)%area.height,size=(.8+p.depth)*unit;
      c.fillRect(x,y,size,size);
      if(i%9===0||reduced&&i%3===0){c.save();c.globalAlpha*=.65;frostCrystal(c,x,y,3.1*unit,reduced?0:time*.2+p.phase);c.restore();}
    }
    c.restore();return count;
  }
  // Shared by campaign, guild raids and the duo encounter. Geometry is
  // deliberately capped at six allies and three foes; nothing persists.
  function spicaSkillEffect(c,source,allies,foes,age,reduced=false,scale=1){
    if(age<0||age>1.6||!source)return;
    const fade=clamp01((1.6-age)/.65),rise=reduced?1:clamp01(age/.65),chill=reduced?1:clamp01((age-.45)/.8);
    c.save();c.globalAlpha*=fade;c.lineWidth=1.1*scale;
    frostCrystal(c,source.x,source.y-52*scale,(6+rise*7)*scale,reduced?0:age*.28);
    for(const p of allies.slice(0,6)){
      c.strokeStyle='#b9f4ed';c.beginPath();c.ellipse(p.x,p.y-1,scale*(9+rise*12),scale*(3+rise*4),0,0,Math.PI*2);c.stroke();
      const y=p.y-(28+rise*22)*scale;c.strokeStyle='#d9fff5';
      for(let k=0;k<2;k++){c.beginPath();c.moveTo(p.x-4*scale,y+6*k*scale);c.lineTo(p.x,y-4*scale+6*k*scale);c.lineTo(p.x+4*scale,y+6*k*scale);c.stroke();}
      if(!reduced)for(let i=0;i<2;i++)rect(c,'#c7f9fa',p.x+(i?10:-12)*scale,p.y-(9+rise*35+i*7)*scale,2*scale,2*scale);
    }
    if(chill>0)for(const p of foes.slice(0,3)){
      c.save();c.globalAlpha*=chill;c.strokeStyle='#8dbff4';c.beginPath();
      const r=(13+chill*10)*scale;for(let i=0;i<=6;i++){const a=i*Math.PI/3,xx=p.x+Math.cos(a)*r,yy=p.y+Math.sin(a)*r*.3;if(!i)c.moveTo(xx,yy);else c.lineTo(xx,yy);}c.stroke();
      frostCrystal(c,p.x,p.y-42*scale,(6+chill*4)*scale,reduced?0:-age*.2);c.restore();
    }
    c.restore();
  }
  function spicaEffects(c,battle,effects,positions,time,reduced){
    for(const e of effects){if(e.from!=='spica')continue;const age=time-e.time;if(age<0||age>1.6)continue;
      if(e.kind==='spica-skill')spicaSkillEffect(c,positions.spica,(e.targets||[]).map(id=>positions[id]).filter(Boolean),(e.enemies||[]).map(id=>positions[id]).filter(Boolean),age,reduced);
      if(e.kind==='hit'&&!e.skill&&age<.65){const a=positions.spica,b=positions[e.to];if(!a||!b)continue;const p=reduced?1:clamp01(age/.4),x=a.x+12+(b.x-a.x-12)*p,y=a.y-32+(b.y-a.y)*p-Math.sin(p*Math.PI)*8;c.save();c.globalAlpha*=1-clamp01((age-.3)/.35);frostCrystal(c,x,y,4.5,reduced?0:age*2);c.restore();}
    }
    for(const u of [...battle.heroes,...battle.enemies]){if(u.hp<=0)continue;const p=positions[u.id];if(!p)continue;const buff=(u.hasteUntil||0)>battle.elapsed,slow=(u.slowUntil||0)>battle.elapsed;if(!buff&&!slow)continue;c.save();c.globalAlpha=.8;c.fillStyle=buff?'#b5f2dd':'#aacbff';c.font='bold 9px sans-serif';c.fillText(buff?'↑↑':'❄',p.x+18,p.y-39);c.restore();}
  }
  // Size the text cache using the actual drawing transform. Cooperative scenes
  // draw in a wider logical viewport than campaign; canvas.width/480 inflated
  // their text to 4x/6x, evicting still-visible amounts on every rapid-fire frame.
  let labelMeasure=null;
  const COMBAT_LABEL_PIXELS=4*1024*1024;
  function combatNumber(c,text,x,y,size,color,critical){
    const transform=c.getTransform(),density=Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d));
    const resolution=density>2?4:2;
    text=String(text);
    const key=`${text}:${size}:${color}:${+critical}:${fontRevision}:${resolution}`;
    let label=combatLabels.get(key);
    if(!label){
      labelMeasure ||= document.createElement('canvas').getContext('2d');
      labelMeasure.font=`${size}px Galmuri, monospace`;
      const textWidth=Math.ceil(labelMeasure.measureText(text).width),width=textWidth+(critical?30:8),height=size+14;
      const pixels=width*height*resolution*resolution;
      let measure;
      // Recycle an evicted surface instead of allocating a new backing store
      // for every new amount during long sessions. Live labels remain cached.
      while(combatLabels.size&&combatLabelPixels+pixels>COMBAT_LABEL_PIXELS){
        const oldest=combatLabels.keys().next().value,old=combatLabels.get(oldest);
        combatLabelPixels-=old.canvas.width*old.canvas.height;combatLabels.delete(oldest);
        measure ||= old.canvas;
      }
      measure ||= document.createElement('canvas');
      measure.width=width*resolution;measure.height=height*resolution;
      const mc=measure.getContext('2d');
      mc.scale(resolution,resolution);mc.font=`${size}px Galmuri, monospace`;mc.textAlign="left";
      const tx=critical?25:3,base=size+2;
      mc.lineJoin='round';mc.lineWidth=3.5;mc.strokeStyle='#102038';mc.strokeText(text,tx,base);mc.fillStyle='#102038';mc.fillText(text,tx+1,base+2);mc.fillStyle=color;mc.fillText(text,tx,base);
      mc.fillStyle='#ffffff45';mc.fillRect(tx,base+3,Math.min(textWidth,16),1);
      if(critical)criticalMark(mc,11,base-6,.9);
      label={canvas:measure,width,height,baseline:base,anchor:tx+textWidth/2};
      combatLabels.set(key,label);combatLabelPixels+=measure.width*measure.height;
    }else{combatLabels.delete(key);combatLabels.set(key,label);}
    c.drawImage(label.canvas,x-label.anchor,y-label.baseline,label.width,label.height);
  }
  function impactEffects(c,effects,positions,time,reduced,economy=false){
    // Hard cap even when a whole party lands AoE in the same simulation tick.
    let remaining=economy?5:12;
    for(let i=effects.length-1;i>=0&&remaining>0;i--){const e=effects[i],age=time-e.time;
      if(e.kind!=="hit"||e.from==='kazua'||e.amount<=0||age<0||age>.36)continue;
      const p=positions[e.to];if(!p)continue;remaining--;
      const critical=!!e.critical,power=critical?1.4:e.skill||e.bossSkill?1.15:.8;
      const x=p.x,y=p.y-35,spread=(reduced?9:5+age*50)*power;
      c.save();c.globalAlpha*=Math.max(0,1-age/.36);
      if(!reduced&&age<.075){rect(c,critical?"#ffe8a177":"#fff6db55",x-9*power,y-15*power,18*power,30*power);}
      const color=e.element==="ice"?'#c5eaff':e.element==="water"?"#9deaf4":critical?"#ffc35f":"#f4ddbd";
      for(let shard=0;shard<(reduced||economy?3:critical?8:5);shard++){
        const a=shard*2.399+(e.seq||0)*.2,dx=Math.cos(a),dy=Math.sin(a),length=(critical?8:5)*(1-age/.5);
        const px=x+dx*spread,py=y+dy*spread;
        rect(c,"#66513e",px-1,py-1,Math.abs(dx)*length+3,Math.abs(dy)*length+3);
        rect(c,color,px,py,Math.abs(dx)*length+1.5,Math.abs(dy)*length+1.5);
        detail(c,"#fff9e4",px,py,2,1);
      }
      if(critical){c.strokeStyle="#ffd288";c.lineWidth=1.2;c.beginPath();c.ellipse(x,y,spread*.75,spread*.5,-.4,0,Math.PI*2);c.stroke();}
      c.restore();
    }
  }
  function chapterTelegraphs(c,battle,positions,effects,time,reduced){
    for(const e of battle.enemies){
      if(e.hp<=0||!e.telegraphMs||e.skillWarnedFor!==e.nextSkillAt||battle.elapsed<e.nextSkillAt-e.telegraphMs)continue;
      const p=positions[e.id],target=positions[e.skillTarget]||p,remaining=Math.max(0,e.nextSkillAt-battle.elapsed),ratio=1-remaining/e.telegraphMs;
      c.save();c.strokeStyle=e.combatRole==='healer'?'#9effd3':'#ffd192';c.lineWidth=2;c.globalAlpha=reduced?.8:.7+Math.sin(time*10)*.2;
      c.beginPath();c.ellipse(target.x,target.y+2,24,8,0,0,Math.PI*2);c.stroke();c.globalAlpha=1;
      rect(c,'#17253dec',p.x-30,p.y-93,60,18);rect(c,e.combatRole==='healer'?'#8feac4':'#ffbd76',p.x-29,p.y-78,58*clamp01(ratio),2);
      c.font='bold 9px Galmuri,monospace';c.textAlign='center';c.fillStyle='#fff1d9';c.fillText(e.monsterSkill,p.x,p.y-82);c.restore();
    }
    for(const e of effects){if(e.kind!=='monster-interrupt'||time-e.time>1||time<e.time)continue;const p=positions[e.from];if(p)combatNumber(c,'차단!',p.x,p.y-92-(time-e.time)*8,12,'#9dfaff',false);}
  }
  function monsterSkillEffects(c,effects,positions,time,reduced){
    for(const e of effects){const age=time-e.time;if(e.kind!=="monster-skill"||age<0||age>1.1)continue;
      const source=positions[e.from];if(!source)continue;
      c.save();c.globalAlpha*=Math.max(0,1-age/1.1);
      for(const id of e.targets||[]){const p=positions[id];if(!p)continue;
        if(e.role==="guard"){windShield(c,p.x,p.y,"#a7ddff",.7,.7);}
        else if(e.role==="healer"){rect(c,"#a1e2d75c",p.x-9,p.y-66,18,63);rect(c,"#b6f6db",p.x-2,p.y-50,4,17);rect(c,"#b6f6db",p.x-8,p.y-43,16,4);}
        else if(e.role==="ranged"){
          const t=reduced?1:clamp01(age/.4),x=source.x+(p.x-source.x)*t,y=source.y-34+(p.y-source.y)*t;
          rect(c,"#9c7fb8",x-9,y-3,17,6);rect(c,"#ead0e7",x-6,y-2,11,4);rect(c,"#fff3e3",x-4,y-1,5,2);
        }else{c.strokeStyle="#edba98";c.lineWidth=3;c.beginPath();c.arc(p.x,p.y-30,reduced?19:12+age*30,-2.2,.4);c.stroke();}
      }
      c.font="9px Galmuri, monospace";c.textAlign="center";c.fillStyle="#fff0d9";c.fillText(e.name||"적 스킬",source.x,source.y-92);c.restore();
    }
  }
  function bossEffects(c, battle, positions, effects, time, reduced) {
    const warning = battle.phase === "fight" && battle.enemies.find(enemy => enemy.hp > 0 && enemy.ability && enemy.warnedFor === enemy.nextAbilityAt && enemy.nextAbilityAt - battle.elapsed <= 1000);
    if (warning) {
      c.save(); const remaining = Math.max(0, (warning.nextAbilityAt - battle.elapsed) / 1000), pulse = reduced ? .7 : .55 + Math.sin(time * 8) * .2;
      c.strokeStyle = "#eabb78"; c.fillStyle = "#cd77522a"; c.lineWidth = 1.5;
      for (const member of battle.heroes.filter(h => h.hp > 0)) { const p = positions[member.id]; c.globalAlpha = pulse; c.beginPath(); c.ellipse(p.x,p.y+3,24,8,0,0,Math.PI*2);c.fill();c.stroke(); detail(c,"#ffe1a5",p.x-1,p.y-7,2,6); detail(c,"#ffe1a5",p.x-1,p.y+1,2,2); }
      c.globalAlpha = 1; c.textAlign = "center"; c.font = "9px Galmuri, monospace";
      const label = `광역기 예고 · ${warning.ability} · ${remaining.toFixed(1)}초`, width = c.measureText(label).width + 20;
      rect(c,"#613d36ee",240-width/2,65,width,20);detail(c,"#f0bd78",240-width/2,84,width,1);c.fillStyle="#ffe8b7";c.fillText(label,240,79);c.restore();
    }
    for (const e of effects) {
      const age = time - e.time; if (e.kind !== "boss-skill" || age < 0 || age > .9) continue;
      c.save(); c.globalAlpha = Math.max(0, 1 - age / .9);
      for (const id of e.targets || []) { const p = positions[id]; if (!p) continue; const r = reduced ? 27 : 10 + age * 62; c.strokeStyle="#e29e7a";c.lineWidth=3;c.beginPath();c.ellipse(p.x,p.y-24,r,r*.7,-.2,0,Math.PI*2);c.stroke();for(let shard=0;shard<6;shard++){const a=shard*Math.PI/3;rect(c,shard%2?"#ffe0a5":"#c76f60",p.x+Math.cos(a)*r,p.y-24+Math.sin(a)*r*.7,3,5);} }
      c.textAlign="center";c.font="10px Galmuri, monospace";const label=`광역기 · ${e.name}`,width=c.measureText(label).width+22;rect(c,"#5c3435ed",240-width/2,65,width,20);c.fillStyle="#ffe0b0";c.fillText(label,240,79);c.restore();
    }
  }
  // Presentation state belongs to the canvas, never to the saved game. A new
  // wave replaces this tiny map (at most three enemies) instead of accumulating
  // old corpses, and a rewound replay starts a fresh visual lifecycle.
  const sceneLives = new WeakMap();
  function sceneLife(canvas, battle, time, effects) {
    const key = `${battle.id}:${battle.stage}:${battle.wave}:${battle.activity?.kind || "story"}:${battle.activity?.floor || 0}`;
    let scene = sceneLives.get(canvas);
    if (!scene || scene.key !== key || time < scene.lastTime - .05) {
      const fresh = battle.phase === "fight" && battle.elapsed < 500;
      scene = {key, lastTime:time, phase:battle.phase, resultAt:time-.8, bornAt:time-(fresh ? 0 : .4), enemies:new Map()};
      sceneLives.set(canvas, scene);
    }
    if (scene.phase !== battle.phase) { scene.phase = battle.phase; scene.resultAt = time; }
    scene.lastTime = time;
    for (const enemy of battle.enemies) {
      let life = scene.enemies.get(enemy.id);
      if (!life) { life = {dead:enemy.hp <= 0, diedAt:enemy.hp <= 0 ? time-.8 : null}; scene.enemies.set(enemy.id, life); }
      if (enemy.hp <= 0 && !life.dead) {
        const hit = lastEffect(effects, e => e.kind === "hit" && e.to === enemy.id);
        life.diedAt = Math.max(time-.15, hit?.time ?? time); life.dead = true;
      } else if (enemy.hp > 0 && life.dead) { life.dead = false; life.diedAt = null; }
    }
    return scene;
  }
  function draw(c, state, time, effects = [], reduced = false) {
    c.save();
    try { drawFrame(c, state, time, effects, reduced); }
    catch (error) {
      // A failed nested effect can leave several saves/clips on the stack.
      // Reset only on failure, then let the client report/retry the real error.
      c.canvas.width = c.canvas.width;
      throw error;
    } finally { c.restore(); }
  }
  function drawFrame(c, state, time, effects, reduced) {
    const panorama = c.canvas.dataset?.layout === 'panorama', view = panorama ? panoramicViewport(c.canvas) : null;
    c.setTransform(c.canvas.width / 480, 0, 0, c.canvas.height / 280, 0, 0); c.imageSmoothingEnabled = false;
    const economy=Number(c.canvas.dataset?.renderScale||1)<.8;
    const battle = state.battle, extendedParty = Math.max(battle.heroes.length, state.team?.length || 0) > 3;
    let health=healthTrackers.get(c.canvas);
    if(!health&&window.SchoolCombatFeedback){health=window.SchoolCombatFeedback.createHealthTracker();healthTrackers.set(c.canvas,health);}
    health?.begin(battle.id,time);
    const sceneTime = time;
    // A slightly closer background camera brings the floor up behind both
    // formation rows; rear allies must not appear to stand on the classroom wall.
    if (panorama) panoramicScenery(c, battle, extendedParty, sceneTime, reduced, view);
    else scenery(c, battle, extendedParty, sceneTime, reduced);
    effects = effects.filter(e => (!e.battleId || e.battleId === battle.id) && time >= e.time);
    const cancelledBreaths=new Set(effects.filter(e=>e.kind==='osia-breath-cancel').map(e=>e.castId)),osiaOwner=battle.heroes.find(h=>h.id==='osia');
    effects=effects.filter(e=>!e.breath||battle.phase==='fight'&&osiaOwner?.hp>0&&!(osiaOwner.stunUntil>battle.elapsed)&&!cancelledBreaths.has(e.castId));
    const breathEvent=lastEffect(effects,e=>e.kind==='skill-stage'&&e.breath&&time-e.time<4.75);
    if(breathEvent)window.SchoolOsiaBreathArt?.field(c,time-breathEvent.time,480,280,reduced);
    const landedCasts = new Set(effects.filter(e => e.kind === "skill-impact").map(e => e.castId));
    const landedHorasCasts = new Set(effects.filter(e => e.kind === "horas-impact").map(e => e.castId));
    effects = effects.filter(e => (e.kind !== "skill-stage" || battle.osiaCast?.id === e.castId || landedCasts.has(e.castId)) && (e.kind !== "horas-cast" || battle.horasCast?.id === e.castId || landedHorasCasts.has(e.castId)));
    // A single pass replaces repeated event scans for every combatant.
    const actors = new Map(), actor = id => { if (!actors.has(id)) actors.set(id, {}); return actors.get(id); };
    for (const event of effects) {
      const age = time - event.time;
      if (event.kind === "hit") { actor(event.to).incoming = event; actor(event.from).outgoing = event; }
      if (['monster-skill','boss-skill'].includes(event.kind)&&age<.85)actor(event.from).monsterCast=event;
      if (event.kind === 'osia-drowning' && age < .7) actor('osia').spear = event;
      if (event.kind === 'heal'||event.kind === 'enemy-heal') actor(event.to).heal=event;
      if (event.kind === "skill" && age < 1.1) {actor(event.from).casting = true;actor(event.from).skill=event;}
      if (event.kind === "skill-stage" && event.from === "osia" && age < (event.breath ? 4.75 : event.stage === 4 ? 1.8 : 1.1)) actor("osia").combo = event;
      if(event.kind==="ryusion-skill"&&age<1.4)actor("ryusion").combo=event;
      if(event.kind==="ryusion-impact"&&age<.7)actor(event.to).earthImpact=event;
      if (event.kind === "lava-skill" && age < 1.8) actor("lava").combo = event;
      if(event.kind==='spica-skill'&&age<1.6)actor('spica').combo=event;
      if (event.kind === "horas-basic" && age < 1.18) actor("horas").basic = event;
      if (event.kind === "horas-cast" && age < 1.8) actor("horas").horasCast = event;
      if (event.kind === "horas-impact" && age < .95) actor("horas").horasImpact = event;
      if ((event.kind === "guard" || event.kind === "rescue") && event.from === "lava" && age < 1.45) actor("lava").passive = event;
    }
    // Only a critical impact nudges the combat layer (never the DOM or camera
    // layout). Ordinary attack traffic cannot continuously shake the screen.
    const strongHit=lastEffect(effects,e=>e.kind==="hit"&&e.critical&&e.amount>0&&time-e.time<.16);
    const horasStrike=lastEffect(effects,e=>e.kind==='horas-impact'&&!e.missed&&time-e.time<.18&&effects.some(hit=>hit.kind==='hit'&&hit.from==='horas'&&hit.castId===e.castId&&hit.to===e.targetId&&hit.amount>0));
    if(!reduced&&!battle.cinematic){
      if(horasStrike){const age=time-horasStrike.time,decay=1-age/.18;c.translate(Math.sin(age*69)*2*decay,Math.cos(age*58)*1.1*decay);}
      else if(strongHit){const age=time-strongHit.time,decay=1-age/.16;c.translate(Math.sin(age*75)*1.4*decay,Math.cos(age*65)*.7*decay);}
    }
    const horasInterpolation = Math.max(0, Math.min(.5, time - (state.simTime || 0) / 1000));
    const gunner=battle.heroes.find(u=>u.id==='kazua'),gunVisual=kazuaCampaignVisual(gunner,battle,effects,time,horasInterpolation);
    if(battle.phase==='fight'){const h=battle.heroes.find(u=>u.id==='hyeokjin'),clock=battle.elapsed+horasInterpolation*1000;window.SchoolHyeokjinArt?.field(c,h,clock,480,280,reduced);const shake=window.SchoolHyeokjinArt?.shake(h,clock,reduced);if(shake)c.translate(shake.x,shake.y);}
    const lifecycle = sceneLife(c.canvas, battle, time, effects);
    const positions = {};
    const partyPositions = extendedParty ? partyFront : partySmall;
    const place = p => ({x:p.x,y:p.y<160?174:p.y<195?203:232+(p.y-210)*.22});
    battle.heroes.forEach((h, i) => { positions[h.id] = place(partyPositions[i] || {x:66 + (i % 3) * 68,y:137}); });
    battle.enemies.forEach((e, i) => { positions[e.id] = place(battle.boss ? { x: 375, y: 210 } : enemyPlaces[i]); });
    if(breathEvent&&window.SchoolOsiaWeaponArt){const targets=breathEvent.targets.map(id=>positions[id]).filter(Boolean);if(targets.length)window.SchoolOsiaWeaponArt.dragon(c,{source:positions.osia,target:targets.reduce((a,b)=>b.x>a.x?b:a),age:time-breathEvent.time,reduced,economy,breath:true,layer:'back'});}
    const visualPositions = {...positions};
    const items = battle.heroes.map(h => ({ ...h, side: "hero" })).concat(battle.enemies.map(e => ({ ...e, side: "enemy" }))).sort((a, b) => positions[a.id].y - positions[b.id].y);
    for (const item of items) {
      const p = positions[item.id], visual = actors.get(item.id) || {}, hit = !!visual.incoming && time - visual.incoming.time < .15, attacking = !!visual.outgoing && time - visual.outgoing.time < .25;
      const dodge=item.id==='kazua'?lastEffect(effects,e=>e.kind==='dodge'&&e.to===item.id&&time-e.time<.35):null;
      const stunned = item.hp > 0 && (item.stunUntil || 0) > battle.elapsed;
      const bounce = reduced || item.side==='hero' || item.hp <= 0 || stunned ? 0 : Math.round(Math.sin(time * 4 + p.x) * 1.5);
      const attackAge = visual.outgoing ? time - visual.outgoing.time : -1;
      // Ease the same attack distance out and back instead of snapping eight
      // pixels in one frame. Combat timing, attack poses and casts stay intact.
      const nudge = attackAge >= 0 && attackAge < .43 && !reduced && !stunned ? Math.sin(attackAge / .43 * Math.PI) * (item.side === "hero" ? 8 : -6) : 0;
      const combo = item.side === "hero" && visual.combo;
      const castAge = combo ? time - combo.time : 0;
      const motion = combo && item.hp > 0 ? combo.breath&&window.SchoolOsiaBreathArt?window.SchoolOsiaBreathArt.motion(castAge,reduced):castingMotion(item.id, combo.stage, castAge, reduced) : null;
      const recoilAge=visual.incoming?time-visual.incoming.time:1;
      const recoil=reduced?0:Math.sin(clamp01(recoilAge/.24)*Math.PI)*(visual.incoming?.critical?5:2);
      const scale = extendedParty ? (p.y<195?1.18:1.32) : 1.6, moveX = (motion ? motion.dx : ["lava","horas","kazua","hyeokjin"].includes(item.id) ? 0 : nudge) + (item.side === "hero" ? -recoil : 0), moveY = motion ? motion.dy : bounce;
      visualPositions[item.id] = {x:p.x + moveX,y:p.y + moveY};
      if (item.side === "hero") hero(c, item.id, p.x + moveX, p.y + moveY, scale, { hit, dead: item.hp <= 0, attack: attacking, pose: motion?.pose, motion, shadowY:-moveY / scale, ready: item.energy >= S.BY_ID[item.id].cooldown - 1, casting: !!combo || visual.casting, blink: Math.sin(time * .7 + p.x) > .99,
        time:sceneTime, castAge:visual.skill?time-visual.skill.time:undefined, skin:item.skin, exclusive:item.exclusive, osiaBreathAge:combo?.breath?castAge:undefined, osiaSpearAge:visual.spear?time-visual.spear.time:-1, kazuaActive:battle.phase==='fight', ...(item.id==='kazua'?gunVisual.frame:{}),...hyeokjinFrame(item,battle.elapsed+horasInterpolation*1000),...(dodge?{kazuaMode:'dodge',kazuaAge:time-dodge.time}:{}), reduced,stunned, taunting:item.id==='ryusion'&&S.ryusionGuard(battle.heroes,battle.elapsed).taunting, passive:!!visual.passive,
        horasBasicPose:visual.basic?.pose || battle.horas?.basicPose || 1, horasStacks:battle.horas?.stacks || 0,
        horasCastAge:item.id !== "horas" ? -1 : battle.horasCast ? Math.max(0,(battle.elapsed-battle.horasCast.began)/1000+horasInterpolation) : visual.horasImpact ? 1.5+time-visual.horasImpact.time : -1,
        basicAttackAt:visual.outgoing && !visual.outgoing.skill ? visual.outgoing.time : undefined,
        attackAge:item.id === "horas" ? visual.basic ? sceneTime-visual.basic.time : undefined : visual.passive ? time-visual.passive.time : visual.outgoing && !visual.outgoing.skill && time-visual.outgoing.time<(item.id === "lava" ? 1 : .85) ? time-visual.outgoing.time : undefined });
      else {
        const impact = visual.incoming, strike = visual.outgoing;
        const life = lifecycle.enemies.get(item.id), deathAge = life.diedAt == null ? undefined : time-life.diedAt;
        monster(c, item, p.x+(visual.earthImpact&&!reduced?Math.sin(clamp01((time-visual.earthImpact.time)/.7)*Math.PI)*16:0), p.y, {hit, activity:battle.activity, time:sceneTime, reduced, stunned,
          stage:battle.stage, wave:battle.wave, warning:(item.warnedFor===item.nextAbilityAt&&item.nextAbilityAt>battle.elapsed&&item.nextAbilityAt-battle.elapsed<1000)||(item.skillWarnedFor===item.nextSkillAt&&item.nextSkillAt>battle.elapsed&&item.nextSkillAt-battle.elapsed<850),casting:!!visual.monsterCast, index:battle.enemies.findIndex(e=>e.id===item.id),
          attackAge:strike ? time-strike.time : undefined, hitAge:impact ? impact.critical && time-impact.time < .065 ? .045 : time-impact.time : undefined,
          deathAge, spawnAge:time-lifecycle.bornAt});
      }
      if (item.side === "hero" && item.hp > 0 && item.shield > 0) windShield(c, p.x, p.y, "#bce8d3", .3, extendedParty ? .7 : .92);
      c.save();
      if (item.side === "enemy" && item.hp <= 0) c.globalAlpha *= 1-clamp01((time-lifecycle.enemies.get(item.id).diedAt)/.45);
      const w = item.boss ? 86 : item.side === "hero" && extendedParty ? 38 : 44, by = p.y + 8;
      const hpVisual=health?.sample(item.id,item.hp,item.max,time,reduced,visual.heal)||{ratio:Math.max(0,item.hp/item.max),trail:0,healing:0};
      window.SchoolCombatFeedback?.drawHealth(c,{x:p.x,y:by,width:w,...hpVisual,side:item.side,shield:(item.shield||0)/item.max,boss:item.boss});
      if(item.boss){c.font='bold 9px Galmuri,monospace';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#102036';const text=`${Math.ceil(item.hp).toLocaleString()} / ${Math.ceil(item.max).toLocaleString()}`;c.strokeText(text,p.x,by+20);c.fillStyle='#fff0df';c.fillText(text,p.x,by+20);}
      if (item.side === "hero") { rect(c, "#243854", p.x - w / 2, by + 10, w, 3); rect(c, item.id === "horas" ? "#f0a9df" : "#f3d188", p.x - w / 2, by + 10, w * (item.id === "horas" ? (battle.horas?.stacks || 0) / 5 : item.energy / S.BY_ID[item.id].cooldown), 3); }
      if(item.side==='enemy'&&item.campaignTrait!==undefined&&item.hp>0){
        const label=item.physicalReduction?'물리 저항':item.magicReduction?'마법 저항':item.supportShield?'보호막':item.rageCap&&!item.boss?'태엽 강화':'';
        if(label){c.font='8px Galmuri,monospace';c.textAlign='center';const tw=c.measureText(label).width;rect(c,'#14233deb',p.x-tw/2-4,p.y-70,tw+8,13);c.fillStyle=item.physicalReduction?'#ffd59c':item.magicReduction?'#b9c8ff':'#a4edee';c.fillText(label,p.x,p.y-60);}
      }
      c.restore();
    }
    const berserker=battle.heroes.find(u=>u.id==='hyeokjin');
    if(battle.phase==='fight')window.SchoolHyeokjinArt?.effects(c,{unit:berserker,time:battle.elapsed+horasInterpolation*1000,source:visualPositions.hyeokjin,targets:battle.enemies.map(e=>({...visualPositions[e.id],id:e.id})),scale:extendedParty?1.3:1.8,reduced,economy,viewport:{width:480,height:280}});
    if(gunVisual.targets.length&&!lastEffect(effects,e=>e.kind==='dodge'&&e.to==='kazua'&&time-e.time<.35))window.SchoolKazuaArt?.effects(c,{source:visualPositions.kazua,targets:gunVisual.targets.map(e=>visualPositions[e.id]),mode:gunVisual.frame.kazuaMode,age:gunVisual.frame.kazuaAge,time:sceneTime,scale:extendedParty?1.3:1.8,reduced,economy});
    waterEffects(c, effects, visualPositions, time, reduced, battle.osiaCast, battle.cinematic,economy,window.SchoolOsiaWeaponArt?.equipped(battle.heroes.find(h=>h.id==='osia')));
    lavaEffects(c, effects, visualPositions, time, reduced,economy);
    spicaEffects(c,battle,effects,visualPositions,time,reduced);
    if(battle.phase==='fight'){
      const fieldTime=battle.elapsed+Math.max(0,Math.min(500,time*1000-(state.simTime||0)));
      spicaBlizzard(c,{x:0,y:0,width:480,height:280},fieldTime,spicaFieldUntil(battle.heroes),reduced,economy);
    }
    horasVisualEffects(c,battle,effects,visualPositions,time,reduced,economy,horasInterpolation,true);
    window.SchoolRyusion?.effects(c,battle,effects,positions,time,reduced);
    monsterSkillEffects(c,effects,positions,time,reduced);
    chapterTelegraphs(c,battle,positions,effects,time,reduced);
    impactEffects(c,effects,positions,time,reduced,economy);
    bossEffects(c, battle, positions, effects, time, reduced);
    window.SchoolCombatFeedback?.drawNumbers(c,effects,time,id=>positions[id],{reduced,limit:economy?72:96});
    for (const e of effects) {
      const age = time - e.time; if (age > 1.1 || age < 0) continue;
      const p = positions[e.to] || positions[e.from]; if (!p) continue;
      c.save(); c.globalAlpha = Math.min(1, (1.1 - age) * 2);
      const y = p.y - 65 - age * 22;
      if (!window.SchoolCombatFeedback && (e.kind === "hit" || e.kind === "heal" || e.kind === "enemy-heal" || e.kind === "shield")) {
        const text = e.kind === "heal" || e.kind === "enemy-heal" ? `+${e.amount}` : e.kind === "shield" ? "방어" : `${e.amount}`;
        const pop=reduced?1:1+Math.max(0,1-age/.18)*(e.critical?.38:.13);
        c.translate(p.x,y);c.scale(pop,pop);c.translate(-p.x,-y);
        const size=e.critical ? 16 : e.skill || e.bossSkill ? 14 : 11;
        const color=e.kind === "heal" || e.kind === "enemy-heal" ? "#dbffac" : e.kind === "shield" ? "#bbdded" : e.critical ? "#ffd274" : e.bossSkill ? "#ffbd9a" : e.skill ? "#ffe5a1" : "#fff6dd";
        combatNumber(c,text,p.x,y,size,color,!!e.critical);
      }
      if (e.kind === "skill" && e.from !== "osia" && e.from !== "horas") { c.font = "9px Galmuri, monospace"; c.textAlign = "center"; const width = c.measureText(e.name).width + 14; rect(c, "#2b3d37dc", p.x - width / 2, p.y - 89 - age * 9, width, 16); c.fillStyle = "#f6df9b"; c.fillText(e.name, p.x, p.y - 77 - age * 9); }
      if (e.kind === "hit" && e.from !== "kazua" && (e.skill || e.bossSkill) && age < .3) { c.strokeStyle = e.element === "water" ? "#bafaff" : e.bossSkill ? "#ffc3a1" : "#fff3bb"; c.lineWidth = 3; c.beginPath(); c.moveTo(p.x - 18, p.y - 60); c.lineTo(p.x + 17, p.y - 19); c.stroke(); }
      if(e.kind==='dodge'){combatNumber(c,'회피',p.x,y,12,'#b8edff',false);}
      if(e.kind==='counter'&&age<.8){
        const radius=18+(reduced?8:age*55);c.strokeStyle='#a7f6ff';c.lineWidth=3*(1-age/.8);c.beginPath();c.arc(p.x,p.y-28,radius,0,Math.PI*2);c.stroke();
        c.font='bold 12px Galmuri, monospace';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#142c42';c.strokeText('반격!',p.x,p.y-101-age*10);c.fillStyle='#c1fbff';c.fillText('반격!',p.x,p.y-101-age*10);
      }
      c.restore();
    }
    // Draw control status last so the large water effect cannot hide it.
    if (battle.phase === "fight") for (const enemy of battle.enemies) {
      const remaining = ((enemy.stunUntil || 0) - battle.elapsed) / 1000;
      if (enemy.hp <= 0 || remaining <= 0) continue;
      const p = positions[enemy.id], y = p.y - (enemy.boss ? 115 : 79);
      c.save(); c.textAlign = "center"; c.font = "10px Galmuri, monospace";
      rect(c,"#26324bea",p.x-32,y,64,17); c.fillStyle="#fff0a8"; c.fillText(`기절 ${remaining.toFixed(1)}초`,p.x,y+12);
      for(let i=0;i<3;i++){const x=p.x+(i-1)*15,sy=y-9+(reduced?0:Math.sin(time*7+i*2)*2);rect(c,"#ffdd73",x-4,sy-1,9,3);rect(c,"#ffdd73",x-1,sy-4,3,9);rect(c,"#fff4bc",x-1,sy-1,3,3);}
      c.restore();
    }
    if (battle.phase === "fight") for (const member of battle.heroes) {
      const remaining = ((member.indomitableUntil || 0) - battle.elapsed) / 1000;
      if (member.hp <= 0 || remaining <= 0) continue;
      const p = positions[member.id]; windShield(c, p.x, p.y, "#f2df9f", .8, 1.07);
      c.save(); c.textAlign = "center"; c.font = "9px Galmuri, monospace"; rect(c,"#66553de8",p.x-30,p.y-79,60,16); c.fillStyle="#fff2c4"; c.fillText(`불사 ${remaining.toFixed(1)}초`,p.x,p.y-68); c.restore();
    }
    const osiaHero = battle.heroes.find(h => h.id === "osia" && h.hp > 0);
    if (osiaHero && battle.phase === "fight" && !panorama) {
      const current = battle.osiaCast, next = S.osiaSkill(state), stage = current?.stage || next.stage;
      const label = current ? `스킬 ${stage}/4 · ${S.OSIA_SKILLS[stage-1].name} 시전 중` : `다음 ${stage}/4 · ${next.name} · 충전 ${Math.max(0, S.BY_ID.osia.cooldown-osiaHero.energy)}초`;
      c.save(); c.font="9px Galmuri, monospace"; c.textAlign="left"; const width=c.measureText(label).width+59;
      rect(c,"#153c55ed",480-width-8,257,width,18);
      for(let i=1;i<=4;i++)rect(c,i===stage?"#c5ffff":"#4e7288",480-width-2+(i-1)*10,263,7,6);
      c.fillStyle="#dbffff"; c.fillText(label,480-width+43,270); c.restore();
    }
    const lavaHero = battle.heroes.find(h => h.id === "lava" && h.hp > 0);
    if (lavaHero && battle.phase === "fight" && S.lavaSkill && !panorama) {
      const next = S.lavaSkill(state), count = state.units.lava.basicHits || 0, y = osiaHero ? 237 : 257;
      const label = `라바 · 다음 ${next.stage}/2 · ${next.name} · ${Math.max(0, S.BY_ID.lava.cooldown - lavaHero.energy)}초`;
      c.save(); c.font = "8px Galmuri, monospace"; c.textAlign = "left"; const width = c.measureText(label).width + 13;
      rect(c, "#35554bed", 8, y, width, 18); c.fillStyle = "#e9f4c9"; c.fillText(label, 14, y + 11);
      for (let i = 0; i < 10; i++) rect(c, i < count ? "#d1eaa7" : "#6d8a70", 14 + i * (width - 18) / 10, y + 14, (width - 28) / 10, 1);
      c.restore();
    }
    if (battle.phase !== "fight") {
      c.save(); c.globalAlpha = reduced ? 1 : clamp01((time-lifecycle.resultAt)/.55);
      const bounds = sceneBounds(c.canvas);
      rect(c, "#243a3277", bounds.x, bounds.y, bounds.width, bounds.height); c.textAlign = "center"; c.font = "18px Galmuri, monospace"; c.fillStyle = "#fff1c8";
      const activity = battle.activity;
      c.fillText(activity ? battle.phase === "victory" ? activity.kind === "tower" ? `${activity.floor}층 돌파!` : "던전 클리어!" : "패배 · 다시 도전하세요" : battle.phase === "victory" ? (battle.boss ? "지역 클리어!" : "WAVE CLEAR") : "패배 · 다시 도전하세요", 240, 112);
      c.font = "10px Galmuri, monospace"; c.fillText(activity ? "결과에서 다음 행동을 선택하세요." : battle.phase === "victory" ? `다음 전투까지 ${Math.ceil(battle.wait)}초` : `${Math.ceil(battle.wait)}초 뒤 자동 재도전`, 240, 135); c.textAlign = "left";
      c.restore();
    }
    if(window.SchoolBattlePolish){
      if(battle.phase==='fight'){
        window.SchoolBattlePolish.speedField(c,battle.heroes,battle.enemies,battle.elapsed,480,40);
        window.SchoolBattlePolish.focus(c,effects,time*1000,480,280,reduced,shot=>battle.heroes.find(u=>u.id===shot.id)?.skin,battle.id);
      }
    }else{
    if(!battle.cinematic&&battle.phase==='fight'&&battle.horasCast&&battle.heroes.some(h=>h.id==='horas'&&h.hp>0))horasCutin(c,Math.max(0,(battle.elapsed-battle.horasCast.began)/1000+horasInterpolation),reduced);
    osiaCinematic(c, state, time, effects, reduced);
    }
  }
  return { displayPortrait:(id,skin)=>portrait(id,skin,2), horasCoopEffects,hyeokjinFrame,kazuaFrame,kazuaCampaignVisual, combatNumber, hitSprite, hero, portrait, rosterPortrait, frontPortrait, recruitPortrait, monster, enemyVariant, enemyAppearances:ENEMY_APPEARANCES, draw, resetRenderCache, ready, horasReady, horasVisualEffects, horasCutin, horasPose, spicaSkillEffect, spicaFieldUntil, spicaBlizzard, battlefieldsReady, poseForSkill:castingMotion, assetsReady: (id = 'osia') => window.SchoolRosterArt?.has(id)?window.SchoolRosterArt.assetsReady(id):id==='kazua'?!!window.SchoolKazuaArt?.assetsReady():id==='spica'?spicaLoaded:id==='spica-portrait'?spicaPortraitLoaded:id === 'ryusion' ? !!window.SchoolRyusion?.assetsReady() : id === 'horas' ? horasLoaded : id === 'horas-portrait' ? horasPortraitLoaded : id === 'horas-cutin' ? horasCutinLoaded : id === 'lava' ? lavaFanLoaded||lavaLoaded : id === 'lava-fan' ? lavaFanLoaded : id === 'osia-front' ? osiaFrontLoaded : id.startsWith('battlefield-') ? !!battlefieldImages.get(id.slice(12))?.loaded : osiaLoaded };
})();
