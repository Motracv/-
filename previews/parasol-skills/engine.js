(function (root) {
  'use strict';
  const skills = [
    { name: '우산 사격', title: '섬광 잔흔', row: 2, fire: 620 },
    { name: '관통탄', title: '은월 궤적', row: 3, fire: 580 },
    { name: '부채 스킬', title: '월화 잔영', row: 4, fire: 530 }
  ];
  const targetX = [430, 530, 630];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
  function sweepPoint(x, t, offset = 0) {
    const u = 1 - t;
    return [u * u * (x + 90) + 2 * u * t * 805 + t * t * 635,
      u * u * 235 + 2 * u * t * 285 + t * t * 128 + offset];
  }
  function hitDelay(kind, x, target) {
    if (kind < 2) return Math.max(1, (targetX[target] - (x + 100)) / 2.5);
    let low = 0, high = .7;
    for (let i = 0; i < 18; i++) {
      const mid = (low + high) / 2;
      if (sweepPoint(x, mid)[0] < targetX[target]) low = mid; else high = mid;
    }
    return (low + high) * .5 * 470;
  }
  function frameAt(motion, time, loop = false) {
    const duration = motion.frames.reduce((n, f) => n + f.durationMs, 0);
    let at = loop ? Math.max(0, time) % duration : Math.max(0, time);
    for (let i = 0; i < motion.frames.length; i++) {
      if (at < motion.frames[i].durationMs) return i;
      at -= motion.frames[i].durationMs;
    }
    return 0;
  }
  class Engine {
    constructor(meta) { this.meta = meta; this.state = {}; this.reset(); }
    reset() {
      const style = this.state.style || 'trails';
      this.state = { time: 0, x: 195, facing: 1, input: 0, action: null, queue: null,
        casts: [], serial: 0, paused: false, auto: false, autoIndex: 0, nextAuto: 0,
        style, totalHits: 0, targetHits: [0, 0, 0], lastHit: [-1e6, -1e6, -1e6], used: [0, 0, 0] };
    }
    duration(row) { return this.meta.motions[row].frames.reduce((n, f) => n + f.durationMs, 0); }
    setStyle(style) { if (['trails', 'blossom'].includes(style)) this.state.style = style; }
    setInput(direction) {
      this.state.input = Math.sign(direction);
      if (direction) { this.state.auto = false; this.state.queue = null; }
    }
    setAuto(enabled) {
      const s = this.state; s.auto = !!enabled; s.queue = null; s.input = 0;
      if (enabled) { s.paused = false; s.nextAuto = s.time; }
    }
    cast(kind, manual = true) {
      if (!Number.isInteger(kind) || !skills[kind]) return false;
      const s = this.state;
      if (manual) { s.auto = false; s.input = 0; s.paused = false; }
      if (s.action) { s.queue = kind; return true; }
      s.facing = 1;
      const record = { id: ++s.serial, kind, x: s.x, start: s.time, style: s.style,
        fire: skills[kind].fire, hits: [false, false, false] };
      s.action = { type: 'cast', kind, start: s.time, id: record.id };
      s.casts.push(record); s.used[kind]++; s.queue = null;
      return true;
    }
    dodge() {
      const s = this.state;
      if (s.action?.type === 'evade') return false;
      s.auto = false; s.paused = false; s.queue = null;
      // Cancelling the wind-up must not leave an invisible projectile or a hit behind.
      if (s.action?.type === 'cast') s.casts = s.casts.filter(c => c.id !== s.action.id || s.time - c.start >= c.fire);
      const direction = s.input || s.facing;
      s.action = { type: 'evade', start: s.time, from: s.x,
        to: clamp(s.x + direction * 90, 115, 270), facing: direction };
      s.facing = direction; s.input = 0;
      return true;
    }
    advance(milliseconds) {
      if (this.state.paused || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
      let remaining = Math.min(milliseconds, 10000);
      while (remaining > 0) { const dt = Math.min(20, remaining); this.step(dt); remaining -= dt; }
    }
    step(dt) {
      const s = this.state; s.time += dt;
      if (s.action) {
        const a = s.action, age = s.time - a.start;
        if (a.type === 'evade') s.x = a.from + (a.to - a.from) * smooth((age - 180) / 400);
        const duration = this.duration(a.type === 'evade' ? 5 : skills[a.kind].row);
        if (age >= duration) { s.action = null; s.nextAuto = s.time + 460; }
      } else if (s.input) {
        s.facing = s.input; s.x = clamp(s.x + s.input * dt * .15, 115, 270);
      }
      for (const cast of s.casts) {
        const age = s.time - cast.start - cast.fire;
        for (let i = 0; i < 3; i++) {
          if (cast.kind === 0 && i !== 2) continue;
          const hitAt = hitDelay(cast.kind, cast.x, i);
          if (!cast.hits[i] && age >= hitAt) {
            cast.hits[i] = true; s.targetHits[i]++; s.totalHits++;
            s.lastHit[i] = cast.start + cast.fire + hitAt;
          }
        }
      }
      s.casts = s.casts.filter(c => s.time - c.start < c.fire + 1250).slice(-8);
      if (!s.action && s.queue !== null) { const kind = s.queue; s.queue = null; this.cast(kind, false); }
      if (!s.action && !s.input && s.auto && s.time >= s.nextAuto) {
        this.cast(s.autoIndex % 3, false); s.autoIndex++;
      }
    }
    pose() {
      const s = this.state, a = s.action;
      if (a?.type === 'cast') return { row: skills[a.kind].row, time: s.time - a.start, loop: false, facing: 1 };
      if (a?.type === 'evade') return { row: 5, time: s.time - a.start, loop: false, facing: a.facing };
      return { row: s.input ? 1 : 0, time: s.time, loop: true, facing: s.facing };
    }
  }
  const api = { Engine, skills, targetX, clamp, smooth, sweepPoint, hitDelay, frameAt };
  if (typeof module === 'object') module.exports = api; else root.ParasolEngine = api;
})(globalThis);
