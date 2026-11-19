/* Kazua presentation only. All damage, timing and target selection stay in the engine. */
window.SchoolKazuaArt = (() => {
  'use strict';

  const ASSETS = Object.freeze({
    combat: 'school/assets/kazua/combat.webp?v=kazua1',
    portrait: 'school/assets/kazua/portrait.webp?v=kazua1',
    pickup: 'school/assets/kazua/pickup.webp?v=kazua1'
  });
  const atlas = new Image(), illustrationImage = new Image();
  let atlasLoaded = false, illustrationLoaded = false, portraitCache = null;
  const TAU = Math.PI * 2, UNIT = 48 / 318;
  const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
  const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;

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
    load(illustrationImage, ASSETS.portrait, () => { illustrationLoaded = true; })
  ]);

  function modeFor(frame = {}) {
    if (frame.dead || frame.frozen || frame.stunned) return 'idle';
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
    const tick = Math.floor(age * 18);
    // A brief upright recoil settles into the firing stance. Bullet cadence is
    // conveyed by the tracers, not by rapidly swapping a character's silhouette.
    const pose = mode === 'fire' ? (!reduced && age < .085 ? 2 : 1)
      : mode === 'reload' ? 3 : mode === 'pistol' ? 4
      : mode === 'bazooka' ? 5 : mode === 'red' ? 6 : mode === 'dodge' ? 7 : 0;
    const kick = reduced ? 0 : mode === 'fire' || mode === 'red' ? -(tick % 2) * .65
      : mode === 'pistol' ? -Math.sin(clamp(age / .3) * Math.PI) * 1.3
      : mode === 'bazooka' ? -Math.sin(clamp(age / .45) * Math.PI) * 2
      : mode === 'dodge' ? -Math.sin(clamp(age / .6) * Math.PI) * 4 : 0;
    return { mode, age, pose, dx: kick, dy: 0, reduced };
  }

  function drawPose(c, pose) {
    const f = FRAMES[clamp(Math.trunc(pose), 0, FRAMES.length - 1)];
    c.drawImage(atlas, f[0], f[1], f[2], f[3], -f[4] * UNIT, -f[3] * UNIT, f[2] * UNIT, f[3] * UNIT);
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
    if (atlasLoaded) drawPose(c, move.pose); else fallback(c);
    if (mode === 'reload' && !reduced) {
      // Falling empty casing; the reload remains readable even on a tiny sprite.
      const p = (Math.max(0, age) * 1.4) % 1;
      c.fillStyle = '#d9b567'; c.fillRect(5 + p * 4, -18 + p * p * 19, 1, 2);
    }
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

  function spark(c, x, y, size, color, alpha = 1) {
    if (size <= 0 || alpha <= 0) return;
    c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.fillStyle = color;
    c.beginPath(); c.moveTo(-size, 0); c.lineTo(-size * .24, -size * .22);
    c.lineTo(0, -size); c.lineTo(size * .22, -size * .22); c.lineTo(size, 0);
    c.lineTo(size * .22, size * .22); c.lineTo(0, size); c.lineTo(-size * .24, size * .22); c.closePath(); c.fill();
    c.restore();
  }

  function curvePoint(ax, ay, bx, by, cx, cy, t) {
    const u = 1 - t;
    return [u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by];
  }

  function tracer(c, sx, sy, tx, ty, curve, phase, red, width, alpha) {
    const cx = (sx + tx) / 2, cy = (sy + ty) / 2 + curve;
    const head = curvePoint(sx, sy, tx, ty, cx, cy, phase);
    const tail = curvePoint(sx, sy, tx, ty, cx, cy, Math.max(0, phase - .24));
    const middle = curvePoint(sx, sy, tx, ty, cx, cy, Math.max(0, phase - .12));
    c.save(); c.globalAlpha *= alpha; c.lineCap = 'round';
    c.strokeStyle = red ? '#ff335e' : '#ffad35'; c.lineWidth = width * 2.7;
    c.beginPath(); c.moveTo(tail[0], tail[1]); c.quadraticCurveTo(middle[0], middle[1], head[0], head[1]); c.stroke();
    c.strokeStyle = red ? '#fff0dd' : '#fff9d4'; c.lineWidth = width;
    c.stroke();
    c.fillStyle = '#fffbed'; c.fillRect(head[0] - width, head[1] - width, width * 2, width * 2);
    c.restore();
  }

  /** Capped tracer rendering: visible streaks cross the field in 55–75 ms, without projectile allocation.
   * source/targets are field foot positions; optional aimY overrides target chest height.
   * Pass active fire/red continuously, and pistol/bazooka with age since that event.
   */
  function effects(c, options = {}) {
    const source = options.source;
    if (!source || !Number.isFinite(source.x) || !Number.isFinite(source.y)) return;
    const targets = (Array.isArray(options.targets) ? options.targets : []).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y)).slice(0, 6);
    if (!targets.length) return;
    const mode = options.mode || 'fire';
    if (!['fire', 'red', 'pistol', 'bazooka'].includes(mode)) return;
    const scale = clamp(finite(options.scale, 1), .25, 4), age = Math.max(0, finite(options.age)), time = finite(options.time, age);
    const reduced = !!options.reduced, economy = !!options.economy, red = mode === 'red', direction = options.flip ? -1 : 1;
    const sx = source.x + direction * 21 * scale, sy = source.y - (mode === 'pistol' || mode === 'bazooka' ? 28 : 18) * scale;
    const point = target => [target.x, Number.isFinite(target.aimY) ? target.aimY : target.y - 24 * scale];
    c.save();
    if (mode === 'bazooka') {
      if (age > .8) { c.restore(); return; }
      const primary = targets[0], [tx, ty] = point(primary), arrival = .12;
      if (age < arrival) tracer(c, sx, sy, tx, ty, -7 * scale, clamp(age / arrival), false, 2.4 * scale, .95);
      else {
        const p = clamp((age - arrival) / .68), radius = (9 + p * 27) * scale;
        c.globalAlpha *= (1 - p) * .85;
        c.strokeStyle = '#ffa747'; c.lineWidth = (2.5 - p * 1.5) * scale;
        c.beginPath(); c.ellipse(tx, primary.y - 3 * scale, radius * 1.3, radius * .3, 0, 0, TAU); c.stroke();
        spark(c, tx, ty, radius * (1 - p * .45), '#ff934b', .75);
        spark(c, tx, ty, radius * .53 * (1 - p), '#fff7d9');
        if (!reduced) for (let i = 0, n = economy ? 6 : 10; i < n; i++) {
          const a = i * 2.399, distance = (10 + p * 34) * scale;
          c.fillStyle = i % 3 ? '#ffc16b' : '#fff1cf';
          c.fillRect(tx + Math.cos(a) * distance, ty + Math.sin(a) * distance * .7 + p * p * 9 * scale, 2 * scale, 3 * scale);
        }
        for (let i = 1; i < targets.length; i++) { const [x, y] = point(targets[i]); spark(c, x, y, (7 + p * 4) * scale, '#ffbb73', .65); }
      }
      c.restore(); return;
    }
    if (mode === 'pistol') {
      if (age > .4) { c.restore(); return; }
      const [tx, ty] = point(targets[0]);
      if (age < .09) tracer(c, sx, sy, tx, ty, 0, clamp(age / .055), false, 1.4 * scale, 1 - age * 3);
      if (age < .13) spark(c, sx, sy, 7 * scale, '#fff0c3', 1 - age / .13);
      spark(c, tx, ty, (10 - age * 18) * scale, '#fff2bc', 1 - age / .4);
      c.restore(); return;
    }
    const count = reduced ? (red ? 3 : 1) : economy ? (red ? 7 : 3) : red ? 13 : 6;
    const period = red ? .075 : .055;
    // A few faint complete arcs explain the homing route; the bright tips stay fast.
    if (red && !reduced) {
      c.save(); c.globalAlpha *= .12; c.strokeStyle = '#ff547e'; c.lineWidth = .8 * scale;
      for (let i = 0; i < Math.min(economy ? 2 : 3, targets.length); i++) {
        const [tx, ty] = point(targets[i]), bend = (i % 2 ? 1 : -1) * (35 + i * 13) * scale;
        c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo((sx + tx) / 2, (sy + ty) / 2 + bend, tx, ty); c.stroke();
      }
      c.restore();
    }
    for (let i = 0; i < count; i++) {
      const target = targets[red ? i % targets.length : 0], [tx, ty] = point(target);
      const phase = reduced ? .83 : (Math.max(0, time) / period + i * .381966) % 1;
      const offset = red ? Math.sin(i * 2.41) * (35 + i * 3) * scale : ((i % 3) - 1) * 2 * scale;
      tracer(c, sx, sy + (i % 2) * 1.5 * scale, tx, ty + (i % 3 - 1) * 2 * scale, offset, phase, red, (red ? 1.05 : .85) * scale, reduced ? .55 : .85);
    }
    const muzzle = reduced ? 4 : 6 + (Math.floor(time * 30) % 3);
    spark(c, sx, sy, muzzle * scale, red ? '#ffc2cb' : '#ffda7c', .9);
    spark(c, sx + direction * 2 * scale, sy, muzzle * .5 * scale, '#fffbed');
    for (let i = 0; i < (red ? targets.length : 1); i++) {
      const [tx, ty] = point(targets[i]), beat = reduced ? .5 : (time * 21 + i * .27) % 1;
      spark(c, tx, ty, (4 + (1 - beat) * 5) * scale, red ? '#ff8097' : '#ffe2a1', .7);
      spark(c, tx, ty, (2 + (1 - beat) * 2) * scale, '#fff8e7', .9);
    }
    if (!reduced && !economy) for (let i = 0; i < 3; i++) {
      const p = (time * 5 + i / 3) % 1;
      c.fillStyle = '#d8ac5a';
      c.fillRect(source.x + (6 - p * 10) * direction * scale, source.y - (19 - p * p * 17) * scale, 2.4 * scale, 1.3 * scale);
    }
    c.restore();
  }

  return Object.freeze({
    ready, hero, draw: hero, portrait, illustration, effects, motion, modeFor,
    assets: ASSETS, frames: FRAMES,
    assetsReady: () => atlasLoaded && illustrationLoaded
  });
})();
