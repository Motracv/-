(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SchoolRecruitCinema = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = n => Math.max(0, Math.min(1, n));
  const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
  const ramp = (t, a, d) => ease((t - a) / d);
  const THEMES = Object.freeze({
    fire:{color:'#ffc178',second:'#fff0b3',rgb:'255,171,100',label:'화염',english:'SACRED FLAME'},
    wind: {color:'#8fffd5',second:'#f5f1b5',rgb:'143,255,213',label:'바람',english:'WIND'},
    ice: {color:'#b2e4ff',second:'#d4c8ff',rgb:'178,228,255',label:'얼음',english:'FROST'},
    earth: {color:'#ffd281',second:'#b8ffcc',rgb:'255,210,129',label:'대지',english:'EARTH'},
    dark: {color:'#c39bff',second:'#ff7eac',rgb:'195,155,255',label:'어둠',english:'ECLIPSE'},
    sword: {color:'#ffe6a2',second:'#b5e8ff',rgb:'255,230,162',label:'검의 맹세',english:'OATH'},
    shield: {color:'#96dfff',second:'#f0d38c',rgb:'150,223,255',label:'수호',english:'GUARDIAN'},
    bow: {color:'#adffb9',second:'#ffdda1',rgb:'173,255,185',label:'집중',english:'PRECISION'},
    arcane: {color:'#c8a5ff',second:'#8ee9ff',rgb:'200,165,255',label:'마력',english:'ARCANA'},
    support: {color:'#a2ffe2',second:'#ffdfa9',rgb:'162,255,226',label:'응원',english:'RESONANCE'},
    gatling: {color:'#ff957c',second:'#ffeeb8',rgb:'255,149,124',label:'탄환',english:'BARRAGE'},

    blossom: { color: '#ff9edc', second: '#75eeff', rgb: '255,148,216', label: '벚꽃', english: 'BLOSSOM' },
    water: { color: '#73e7ff', second: '#b4c1ff', rgb: '92,205,255', label: '물', english: 'WATER' },
    healing: { color: '#c9b0ff', second: '#a6ffd7', rgb: '182,154,255', label: '치유', english: 'HEALING' }
  });
  const seeds = Object.freeze(Array.from({ length: 160 }, (_, i) => ({
    angle: i * 2.399963229728653, depth: ((i * 73) % 157) / 157,
    radius: .15 + ((i * 41) % 97) / 97 * .85, size: .8 + (i % 4) * .5
  })));
  const HANDS = Object.freeze({
    horas: { pivot: [.25,.42], points: [[.06,.19],[.15,.16],[.29,.23],[.34,.35],[.31,.43],[.1,.4]] },
    osia: { pivot: [.72,.34], points: [[.78,.12],[.99,.15],[.99,.26],[.87,.36],[.69,.34],[.66,.25]] },
    nari: { pivot: [.4,.36], points: [[.17,.17],[.3,.14],[.49,.23],[.5,.34],[.36,.38],[.22,.31]] }
  });
  function handPath(c, p, rig) {
    rig.points.forEach(([x,y], i) => c[i ? 'lineTo' : 'moveTo'](p.x + p.width*x, p.y + p.height*y)); c.closePath();
  }
  function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  function circle(c, r, start = 0, end = TAU) { c.beginPath(); c.arc(0, 0, Math.max(0, r), start, end); c.stroke(); }
  function polygon(c, r, sides, angle = 0) {
    c.beginPath();
    for (let i = 0; i <= sides; i++) { const a = angle + i / sides * TAU; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    c.stroke();
  }
  function sparkle(c, x, y, r) {
    c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x + r * .12, y - r * .12, x + r * .65, y);
    c.quadraticCurveTo(x + r * .12, y + r * .12, x, y + r);
    c.quadraticCurveTo(x - r * .12, y + r * .12, x - r * .65, y);
    c.quadraticCurveTo(x - r * .12, y - r * .12, x, y - r); c.fill();
  }
  function glyph(c, element, radius, time = 0) {
    c.save(); c.lineWidth = Math.max(1.4, radius * .035); c.lineCap = 'round'; c.lineJoin = 'round';
    if (element === 'blossom') {
      for (let i = 0; i < 5; i++) {
        c.save(); c.rotate(i * TAU / 5 + time * .025);
        c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-radius * .8, -radius * .45, -radius * .52, -radius * 1.15, 0, -radius);
        c.bezierCurveTo(radius * .52, -radius * 1.15, radius * .8, -radius * .45, 0, 0); c.stroke(); c.restore();
      }
      circle(c, radius * .16); sparkle(c, 0, 0, radius * .25);
    } else if (element === 'water') {
      c.beginPath(); c.moveTo(0, -radius); c.bezierCurveTo(-radius * .25, -radius * .45, -radius * .9, -.1 * radius, -radius * .58, radius * .5);
      c.bezierCurveTo(-radius * .35, radius * 1.05, radius * .55, radius * 1.05, radius * .65, radius * .35);
      c.bezierCurveTo(radius * .8, -.15 * radius, radius * .1, -radius * .7, 0, -radius); c.stroke();
      for (let i = 0; i < 3; i++) {
        const y = radius * (.15 + i * .2); c.beginPath(); c.moveTo(-radius * .3, y);
        c.bezierCurveTo(-radius * .05, y + radius * .2, radius * .1, y - radius * .12, radius * .35, y); c.stroke();
      }
    } else if (element === 'fire') {
      c.beginPath();c.moveTo(0,-radius);c.bezierCurveTo(radius*.08,-radius*.25,radius*.7,-radius*.1,radius*.62,radius*.45);c.bezierCurveTo(radius*.5,radius*1.12,-radius*.62,radius*1.12,-radius*.66,radius*.4);c.bezierCurveTo(-radius*.7,-radius*.1,-radius*.35,-radius*.2,-radius*.33,-radius*.65);c.quadraticCurveTo(-radius*.12,-radius*.35,0,-radius);c.stroke();
      c.beginPath();c.ellipse(0,radius*.52,radius*.18,radius*.15,0,0,TAU);c.stroke();
      for(const [x,y] of [[-.27,.32],[-.1,.19],[.12,.19],[.29,.32]]){c.beginPath();c.ellipse(x*radius,y*radius,radius*.07,radius*.09,0,0,TAU);c.stroke();}
    } else if (element === 'wind') {
      for(let i=0;i<3;i++){c.save();c.rotate(i*TAU/3);c.beginPath();c.moveTo(-radius*.8,radius*.4);c.bezierCurveTo(radius*.9,radius*.5,radius,-radius*.6,radius*.2,-radius*.65);c.bezierCurveTo(-radius*.4,-radius*.7,-radius*.3,0,radius*.15,-radius*.1);c.stroke();c.restore();}
    } else if (element === 'ice') {
      for(let i=0;i<6;i++){c.save();c.rotate(i*TAU/6);line(c,0,0,0,-radius);for(const y of [.45,.72]){line(c,0,-radius*y,-radius*.2,-radius*(y+.18));line(c,0,-radius*y,radius*.2,-radius*(y+.18));}c.restore();}polygon(c,radius*.3,6);
    } else if (element === 'earth') {
      polygon(c,radius,6,Math.PI/6);for(let i=0;i<3;i++){const y=radius*(.5-i*.36);c.beginPath();c.moveTo(-radius*.5,y);c.lineTo(0,y-radius*.4);c.lineTo(radius*.5,y);c.stroke();}
    } else if (element === 'dark') {
      c.beginPath();c.arc(0,0,radius,-Math.PI*.42,Math.PI*.72);c.bezierCurveTo(-radius*.22,radius*.1,-radius*.3,-radius*.3,radius*.25,-radius*.97);c.stroke();sparkle(c,radius*.5,-radius*.05,radius*.45);circle(c,radius*1.15);
    } else if (element === 'sword') {
      c.save();c.rotate(-.35);c.beginPath();c.moveTo(0,-radius);c.lineTo(radius*.18,-radius*.66);c.lineTo(radius*.12,radius*.45);c.lineTo(-radius*.12,radius*.45);c.lineTo(-radius*.18,-radius*.66);c.closePath();c.stroke();line(c,-radius*.48,radius*.45,radius*.48,radius*.45);line(c,0,radius*.45,0,radius*.9);circle(c,radius*.06);c.restore();
    } else if (element === 'shield') {
      c.beginPath();c.moveTo(0,-radius);c.lineTo(radius*.8,-radius*.65);c.quadraticCurveTo(radius*.85,radius*.45,0,radius);c.quadraticCurveTo(-radius*.85,radius*.45,-radius*.8,-radius*.65);c.closePath();c.stroke();sparkle(c,0,-radius*.05,radius*.42);
    } else if (element === 'bow') {
      c.beginPath();c.moveTo(0,-radius);c.quadraticCurveTo(radius*1.5,0,0,radius);c.lineTo(-radius*.32,0);c.closePath();c.stroke();line(c,-radius*.8,0,radius,0);line(c,radius,0,radius*.7,-radius*.24);line(c,radius,0,radius*.7,radius*.24);
    } else if (element === 'arcane') {
      polygon(c,radius,3,-Math.PI/2);polygon(c,radius,3,Math.PI/2);circle(c,radius*.55);sparkle(c,0,0,radius*.5);
    } else if (element === 'support') {
      line(c,-radius*.55,radius,-radius*.55,-radius);c.beginPath();c.moveTo(-radius*.55,-radius);c.quadraticCurveTo(0,-radius*.7,radius*.85,-radius*.9);c.lineTo(radius*.55,-radius*.25);c.lineTo(radius*.85,radius*.35);c.quadraticCurveTo(0,radius*.5,-radius*.55,radius*.2);c.stroke();sparkle(c,0,-radius*.3,radius*.25);
    } else if (element === 'gatling') {
      circle(c,radius*.7);for(let i=0;i<6;i++){c.save();c.rotate(i*TAU/6);c.translate(radius*.42,0);circle(c,radius*.18);c.restore();}for(let i=0;i<4;i++){c.save();c.rotate(i*TAU/4);line(c,radius*.8,0,radius*1.15,0);c.restore();}
    } else {
      c.beginPath(); c.moveTo(-radius * .22, -radius * .9); c.lineTo(radius * .22, -radius * .9);
      c.lineTo(radius * .22, -radius * .22); c.lineTo(radius * .9, -radius * .22); c.lineTo(radius * .9, radius * .22);
      c.lineTo(radius * .22, radius * .22); c.lineTo(radius * .22, radius * .9); c.lineTo(-radius * .22, radius * .9);
      c.lineTo(-radius * .22, radius * .22); c.lineTo(-radius * .9, radius * .22); c.lineTo(-radius * .9, -radius * .22);
      c.lineTo(-radius * .22, -radius * .22); c.closePath(); c.stroke();
      for (const sign of [-1, 1]) { c.save(); c.scale(sign, 1); c.beginPath(); c.moveTo(radius * .48, radius * .8); c.quadraticCurveTo(radius * 1.25, radius * .35, radius * 1.05, -radius * .45); c.stroke(); c.restore(); }
    }
    c.restore();
  }
  function sigil(c, radius, time, element, detail = 1) {
    c.save(); c.rotate(time * .1); c.lineWidth = 1.4; circle(c, radius); circle(c, radius * .94);
    const ticks = detail ? 64 : 32;
    for (let i = 0; i < ticks; i++) {
      c.save(); c.rotate(i / ticks * TAU); line(c, radius * .86, 0, radius * (i % 4 === 0 ? .94 : .9), 0); c.restore();
    }
    c.rotate(-time * .25); polygon(c, radius * .82, 6); polygon(c, radius * .82, 3, Math.PI / 6);
    c.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) circle(c, radius * .72, time * .3 + i * TAU / 3, time * .3 + i * TAU / 3 + 1.25);
    c.rotate(time * .15); glyph(c, element, radius * .43, time); c.restore();
  }
  // A normalized 800×1600 actor space is shared by every rarity and pose.
  // Transparent atlas margins never affect the character's displayed height.
  function actorPlacement(frame, width, height, pose = 0) {
    const [sx, sy, sw, sh] = frame.rect;
    const bodyHeight = height * (pose === 1 ? .89 : .94);
    const stature = Number.isFinite(frame.displayScale) ? Math.max(.5, Math.min(1, frame.displayScale)) : 1;
    const scale = Math.min(bodyHeight / sh, width * .96 / sw) * stature;
    return { sx, sy, sw, sh, x: (width - sw * scale) / 2, y: height * .98 - sh * scale, width: sw * scale, height: sh * scale };
  }
  function actor(c, images, frames, width, height, pose, time, reduced = false) {
    c.clearRect(0, 0, width, height);
    const a = Math.min(3, Math.max(0, Math.floor(pose))), b = Math.min(3, a + 1), mix = ease(pose - a);
    for (const [index, alpha] of [[a, 1 - mix], [b, mix]]) {
      if (alpha <= .001) continue;
      const frame = frames[index], image = images[frame.file];
      if (!image) continue;
      const p = actorPlacement(frame, width, height, index);
      c.save(); c.globalAlpha = alpha; c.translate(width / 2, height * .96);
      c.rotate(reduced ? 0 : Math.sin(time * 1.7) * .0025);
      c.translate(-width / 2, -height * .96);
      const hand = index === 3 && !reduced ? HANDS[frame.file.split('/').at(-1).split('-')[0]] : null;
      if (hand) {
        c.save(); c.beginPath(); c.rect(0,0,width,height); handPath(c,p,hand); c.clip('evenodd');
      }
      // 64 mesh strips give the hair, shoulders and hem a continuous secondary
      // sway while the shoes stay on their fixed baseline. This is interpolated
      // each display frame, rather than stepping a whole static picture.
      const strips = reduced ? 1 : 64;
      for (let j = 0; j < strips; j++) {
        const v = j / strips, next = (j + 1) / strips;
        const sway = reduced ? 0 : Math.sin(time * 2.15 - v * 4) * Math.sin(Math.PI * v) * width * .0035;
        c.drawImage(image, p.sx, p.sy + p.sh * v, p.sw, p.sh / strips,
          p.x + sway, p.y + p.height * v, p.width, p.height * (next - v) + .5);
      }
      if (hand) {
        c.restore(); c.save();
        const px = p.x + p.width*hand.pivot[0], py = p.y + p.height*hand.pivot[1];
        c.translate(px,py); c.rotate(Math.sin(time*6.5)*.025); c.translate(-px,-py);
        c.beginPath(); handPath(c,p,hand); c.clip();
        c.drawImage(image,p.sx,p.sy,p.sw,p.sh,p.x,p.y,p.width,p.height); c.restore();
      }
      c.restore();
    }
  }
  function effects(c, width, height, time, element, rarity = 'UR', foreground = false, reduced = false) {
    c.clearRect(0, 0, width, height);
    if (reduced || time < 8.4) return;
    const theme = THEMES[element] || THEMES.blossom;
    const w = 1600, h = 1600 * height / width, unit = Math.min(w, h), x = w * .54, y = h * .46;
    const appear = ramp(time, 8.4, .8), dive = ramp(time, 10.5, 1.9), settle = ramp(time, 13, 1.5);
    const isPortal = time < 12.65, impact = ramp(time, 12.4, .15) * (1 - ramp(time, 12.75, 1.2));
    const strength = rarity === 'UR' ? 1 : rarity === 'SSR' ? .9 : .8;
    c.save(); c.scale(width / w, height / h);
    if (!foreground) {
      const darkness = appear * (1 - settle) * .96;
      c.fillStyle = `rgba(4,9,29,${darkness})`; c.fillRect(0, 0, w, h);
      const centerX = x + settle * w * .1;
      const glow = c.createRadialGradient(centerX, y, 0, centerX, y, unit * .85);
      glow.addColorStop(0, `rgba(${theme.rgb},${.3 * appear})`); glow.addColorStop(.4, `rgba(${theme.rgb},${.12 * appear})`); glow.addColorStop(1, 'transparent');
      c.fillStyle = glow; c.fillRect(0, 0, w, h);
      c.save(); c.translate(centerX, y); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = theme.color; c.fillStyle = '#fff'; c.globalAlpha = appear * (.8 - settle * .5) * (1 - .84 * dive * (1 - settle));
      c.shadowColor = theme.color; c.shadowBlur = 12 * strength;
      const radius = unit * (.27 + dive * 1.9 - settle * 1.86);
      sigil(c, radius, time * (1 + dive), element, 1);
      if (rarity === 'UR') { c.strokeStyle = theme.second; c.rotate(-time * .2); circle(c, radius * 1.15); polygon(c, radius * 1.21, 8); }
      c.shadowBlur = 0;
      if(time<14.8){
        for(let i=0;i<4;i++){c.save();c.rotate(time*(i%2?-.24:.19)+i*.8);c.scale(1,.44+i*.08);c.globalAlpha=appear*(.4-.25*settle);c.strokeStyle=i%2?theme.second:theme.color;c.lineWidth=2.8;circle(c,unit*(.34+i*.045),time*.7+i,time*.7+i+Math.PI*1.3);c.fillStyle='#fff9ff';sparkle(c,Math.cos(time*.7+i)*unit*(.34+i*.045),Math.sin(time*.7+i)*unit*(.34+i*.045),6);c.restore();}
      }
      if (time >= 10.5 && time < 12.8) {
        c.globalAlpha = .2 * dive * (1 - settle); c.strokeStyle = theme.second; c.lineWidth = 1;
        for (let i = 0; i < 24; i++) { c.save(); c.rotate(i / 24 * TAU + dive * .3); line(c,unit*.035,0,unit*2,0); c.restore(); }
        for (let i = 0; i < 10; i++) {
          const depth = (i / 10 + dive * 1.3) % 1;
          const r = unit * .025 + Math.pow(depth, 2.2) * unit * 1.7;
          c.globalAlpha = Math.sin(depth * Math.PI) * .65 * (1 - settle); c.strokeStyle = i % 2 ? theme.color : theme.second;
          c.lineWidth = 1 + depth * 2; c.save(); c.rotate(i * .2 + dive); polygon(c, r, 8); circle(c, r * .97); c.restore();
        }
      }
      c.restore();
    }
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    const count = rarity === 'UR' ? 160 : rarity === 'SSR' ? 132 : 108;
    for (let i = 0; i < count; i++) {
      const seed = seeds[i], angle = seed.angle + time * (isPortal ? .05 : .015);
      const progress = (seed.depth + time * (isPortal ? .065 + dive * .48 : .025)) % 1;
      const radius = (isPortal ? Math.pow(progress, 2) * unit * 1.6 : seed.radius * unit * .82);
      const px = x + Math.cos(angle) * radius * 1.4, py = y + Math.sin(angle) * radius;
      const visible = appear * (isPortal ? Math.sin(progress * Math.PI) : .35 + .3 * Math.sin(time * 2 + i));
      c.globalAlpha = clamp(visible) * strength * (foreground ? 1 - ramp(time, 14.4, .6) * .8 : 1);
      c.strokeStyle = i % 3 ? theme.color : theme.second; c.fillStyle = i % 3 ? '#fff5ff' : theme.second;
      if (foreground && (i % 3 === 0 || dive > .05 && !settle)) {
        const length = isPortal ? (12 + dive * 155) * progress : 12;
        c.lineWidth = seed.size * (1 + dive * .5);
        line(c, px, py, px + Math.cos(angle) * length, py + Math.sin(angle) * length);
      } else if (!foreground) {
        if (!isPortal && element === 'blossom' && i % 4 === 0) {
          c.save(); c.translate(px, py); c.rotate(time + i); c.beginPath(); c.ellipse(0, 0, 6, 2.5, .5, 0, TAU); c.fill(); c.restore();
        } else if (!isPortal && element === 'water' && i % 3 === 0) { c.lineWidth = 1; c.beginPath(); c.arc(px, py, 2 + seed.size * 2, 0, TAU); c.stroke(); }
        else sparkle(c, px, py, seed.size * 2.4);
      }
    }
    if (foreground && impact > .001) {
      c.translate(x, y); c.globalAlpha = impact * strength; c.strokeStyle = '#f9f4ff'; c.shadowColor = theme.color; c.shadowBlur = 18;
      const burst = ramp(time, 12.4, 1.25);
      for (let i = 0; i < 3; i++) { c.lineWidth = 6 - i * 1.6; circle(c, unit * (.1 + burst * (1.4 + i * .2))); }
      const flare = c.createLinearGradient(-w / 2, 0, w / 2, 0);
      flare.addColorStop(0, 'transparent'); flare.addColorStop(.4, theme.color); flare.addColorStop(.5, '#ffffff'); flare.addColorStop(.6, theme.second); flare.addColorStop(1, 'transparent');
      c.fillStyle = flare; c.fillRect(-w / 2, -3, w, 6);
      c.strokeStyle = theme.second; c.lineWidth = 2;
      for (let i = 0; i < 24; i++) { c.save(); c.rotate(i / 24 * TAU); line(c, unit * (.15 + burst * .3), 0, unit * (.35 + burst * 1.3), 0); c.restore(); }
    }
    c.restore(); c.restore();
  }
  function fitResolution(width, height, dpr = 1, budget = 2200000) {
    const scale = Math.min(2, Math.max(1, dpr), Math.sqrt(budget / Math.max(1, width * height)));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  }
  return Object.freeze({ THEMES, actor, actorPlacement, effects, fitResolution, glyph, sigil, particleLimit: seeds.length });
});
