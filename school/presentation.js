/* Confirmed-result presentation only. This module never reads or writes rewards. */
(function (root) {
  'use strict';
  let config = {}, overrides = {}, audio, master, dialog, current, sequence = 0, scheduled = false, impactNoise, lastImpact = -1;
  const queue = [], known = new Map(), voices = new Set(), springs = new WeakMap();
  const motionQuery = root.matchMedia?.('(prefers-reduced-motion: reduce)');
  const soundEnabled = () => overrides.sound ?? Boolean(config.soundEnabled?.());
  const reduced = () => overrides.reduced ?? (typeof config.reducedMotion === 'function' ? Boolean(config.reducedMotion()) : Boolean(motionQuery?.matches || document.documentElement.dataset.motion === 'reduced'));
  const alive = job => current === job && !job.finished;
  const node = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
  function info(id) { return config.heroInfo?.(id) || { id, name: String(id || '용병'), rarity: 'R' }; }
  function unlockAudio() {
    if (!soundEnabled()) return;
    try {
      const Context = root.AudioContext || root.webkitAudioContext;
      if (!Context) return;
      if (!audio || audio.state === 'closed') { audio = new Context(); master = audio.createGain(); master.gain.value = .55; master.connect(audio.destination); }
      if (audio.state === 'suspended') audio.resume().catch(() => {});
    } catch {}
  }
  function tone(hz, at, duration, volume = .035, type = 'triangle', owner) {
    if (!audio || audio.state !== 'running' || !soundEnabled()) return;
    try {
      const osc = audio.createOscillator(), gain = audio.createGain();
      const start = audio.currentTime + at;
      osc.type = type; osc.frequency.setValueAtTime(hz, start);
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .012); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      osc.connect(gain); gain.connect(master);
      const voice = { owner, stop() { try { osc.stop(); } catch {} osc.disconnect(); gain.disconnect(); voices.delete(voice); } };
      osc.onended = () => { osc.disconnect(); gain.disconnect(); voices.delete(voice); };
      voices.add(voice); osc.start(start); osc.stop(start + duration + .025);
    } catch {}
  }
  function play(kind, stage = 4, owner) {
    if (!soundEnabled()) return;
    unlockAudio();
    if (kind === 'hit' || kind === 'critical') { impactSound(kind === 'critical', owner); return; }
    if (kind === 'defeat') { [220, 196, 146.83].forEach((hz, i) => tone(hz, i * .15, .32, .034, 'triangle', owner)); return; }
    if (kind === 'tap') { tone(520, 0, .055, .025, 'sine', owner); tone(780, .025, .055, .012, 'triangle', owner); return; }
    if (kind === 'captain') {
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => tone(hz, i * .105, .23, .045, 'triangle', owner));
      [523.25, 659.25, 783.99, 1046.5].forEach(hz => tone(hz, .6, .65, .026, 'sine', owner)); return;
    }
    if (kind === 'fusion') {
      [196, 246.94, 293.66, 392, 523.25, 659.25, 783.99].forEach((hz, i) => tone(hz, i * .075, .19, .034, 'triangle', owner));
      [783.99, 987.77, 1174.66].forEach(hz => tone(hz, .63, .55, .022, 'sine', owner)); return;
    }
    if (kind === 'SSR' || kind === 'rare') {
      [261.63, 392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((hz, i) => tone(hz, i * .085, .25, .038, i < 3 ? 'triangle' : 'sine', owner));
      [523.25, 659.25, 783.99].forEach(hz => tone(hz, .72, .7, .027, 'triangle', owner)); return;
    }
    if (kind === 'SR') { [293.66, 440, 587.33, 740, 880].forEach((hz, i) => tone(hz, i * .105, .3, .038, 'sine', owner)); return; }
    if (kind === 'pull') { [164.81, 220, 329.63].forEach((hz, i) => tone(hz, i * .075, .16, .025, 'triangle', owner)); return; }
    const frequencies = kind === 'water' ? [[392], [440, 587], [523, 659, 784], [196, 392, 587, 784, 1175]][Math.max(0, Math.min(3, stage - 1))] : kind === 'level' ? [392, 523, 659] : kind === 'reward' ? [523, 659, 784] : [440, 659];
    frequencies.forEach((hz, i) => tone(hz, i * .085, .2, .035, 'triangle', owner));
  }
  function impactSound(critical, owner) {
    if (!audio || audio.state !== 'running' || voices.size > 28) return;
    const now = audio.currentTime;
    if (now - lastImpact < (critical ? .055 : .09)) return;
    lastImpact = now;
    tone(critical ? 76 : 115, 0, critical ? .14 : .075, critical ? .075 : .04, 'triangle', owner);
    if (critical) tone(380, .018, .065, .024, 'square', owner);
    try {
      if (!impactNoise) {
        impactNoise = audio.createBuffer(1, Math.ceil(audio.sampleRate * .1), audio.sampleRate);
        const data = impactNoise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const source = audio.createBufferSource(), gain = audio.createGain(), filter = audio.createBiquadFilter();
      source.buffer = impactNoise; filter.type = 'lowpass'; filter.frequency.value = critical ? 3400 : 1900;
      gain.gain.setValueAtTime(critical ? .075 : .035, now); gain.gain.exponentialRampToValueAtTime(.0001, now + (critical ? .1 : .055));
      source.connect(filter); filter.connect(gain); gain.connect(master);
      const cleanup = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); voices.delete(voice); };
      const voice = {owner, stop() { try { source.stop(); } catch {} cleanup(); }};
      source.onended = cleanup; voices.add(voice); source.start(now); source.stop(now + .11);
    } catch {}
  }
  function stopVoices(owner) { for (const voice of [...voices]) if (owner === undefined || voice.owner === owner) voice.stop(); }
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = node('dialog', 'school-presentation'); dialog.id = 'school-presentation'; dialog.dataset.motion = reduced() ? 'reduced' : 'full';
    dialog.setAttribute('aria-labelledby', 'presentation-title'); dialog.setAttribute('aria-describedby', 'presentation-description');
    dialog.addEventListener('cancel', event => { event.preventDefault(); skip(); });
    dialog.addEventListener('close', () => {
      // Native close can bypass the skip button while its animations still run.
      // A queued job may already have reopened this shared dialog by the time an
      // earlier close event arrives; never dismiss that newer presentation.
      if (!dialog.open && current) skip();
    });
    dialog.addEventListener('click', event => { if (event.target.closest('[data-presentation-skip]')) skip(); });
    document.body.append(dialog); return dialog;
  }
  function trimKeys() { while (known.size > 160) { const key = known.keys().next().value; if (known.get(key).pending) break; known.delete(key); } }
  function finish(job, result = {}) {
    if (job.finished) return;
    job.finished = true;
    if (job.portraitFrame) cancelAnimationFrame(job.portraitFrame);
    for (const animation of [...job.animations]) animation.cancel();
    job.animations.clear();
    for (const timer of [...job.timers]) { clearTimeout(timer.id); timer.resolve(false); }
    job.timers.clear(); stopVoices(job.id);
    if (current === job) { dialog?.close(); current = null; }
    for (const listener of job.listeners) {
      if (listener.key) { const entry = known.get(listener.key); if (entry) entry.pending = false; }
      listener.resolve(result);
    }
    trimKeys(); schedule();
  }
  function schedule() { if (scheduled) return; scheduled = true; queueMicrotask(() => { scheduled = false; if (!current && queue.length) start(queue.shift()); }); }
  function request(kind, data = {}) {
    const key = data.key === undefined ? null : String(data.key);
    if (key && known.has(key)) return known.get(key).promise;
    let resolve; const promise = new Promise(done => { resolve = done; });
    if (key) known.set(key, { promise, pending: true });
    const listener = { key, resolve }, scope = String(data.scope ?? (key?.includes(':captain:') ? key.split(':captain:')[0] : ''));
    const pendingCaptain = kind === 'captain' && queue.find(job => job.kind === 'captain' && job.scope === scope);
    if (pendingCaptain) {
      pendingCaptain.data.level = Math.max(pendingCaptain.data.level, Number(data.level) || 1);
      pendingCaptain.data.reward += Math.max(0, Number(data.reward) || 0); pendingCaptain.listeners.push(listener);
    } else {
      queue.push({ id: ++sequence, kind, scope, data: { ...data }, listeners: [listener], animations: new Set(), timers: new Set(), finished: false });
    }
    schedule(); return promise;
  }
  function delay(job, ms) {
    if (!alive(job)) return Promise.resolve(false);
    return new Promise(resolve => { const timer = { resolve, id: setTimeout(() => { job.timers.delete(timer); resolve(alive(job)); }, reduced() ? Math.min(ms, 120) : ms) }; job.timers.add(timer); });
  }
  async function move(job, el, frames, duration, delayMs = 0) {
    if (!alive(job)) return false;
    if (reduced()) {
      const last = frames.at(-1);
      frames = [{ opacity: .2, ...(last.transform ? { transform: last.transform } : {}) }, { opacity: last.opacity ?? 1, ...(last.transform ? { transform: last.transform } : {}) }];
      duration = Math.min(140, duration); delayMs = 0;
    }
    const animation = el.animate(frames, { duration, delay: delayMs, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards' });
    job.animations.add(animation);
    try { await animation.finished; } catch {}
    return alive(job);
  }
  function portraitCard(id, stars = 0, extra = '', job) {
    const hero = info(id), card = node('div', `presentation-hero-card ${extra}`);
    card.dataset.hero = id; card.dataset.rarity = hero.rarity;
    card.append(node('span', 'presentation-rarity', hero.rarity));
    const art = node('div', 'presentation-portrait');
    if (job && root.SchoolArt?.recruitPortrait) {
      const canvas = node('canvas', 'recruit-live-portrait'); canvas.width = 248; canvas.height = 344; canvas.dataset.hero = id;
      const context = canvas.getContext('2d'); art.append(canvas);
      let nextDraw = 0;
      const draw = time => {
        if (!alive(job) || !canvas.isConnected) return;
        if (!document.hidden && time >= nextDraw) { root.SchoolArt.recruitPortrait(context, id, time / 1000, reduced()); nextDraw = time + 1000 / 24; }
        if (!reduced()) job.portraitFrame = requestAnimationFrame(draw);
      };
      root.SchoolArt.recruitPortrait(context, id, 0, reduced());
      if (!reduced()) job.portraitFrame = requestAnimationFrame(draw);
    } else if (root.SchoolArt?.frontPortrait) { const image = node('img', ''); image.src = root.SchoolArt.frontPortrait(id); image.alt = ''; art.append(image); }
    else if (config.portrait) art.innerHTML = config.portrait(id);
    else art.append(node('span', 'presentation-fallback', '✦'));
    card.append(art, node('strong', 'presentation-hero-name', hero.name));
    const starRow = node('div', 'presentation-stars');
    starRow.setAttribute('aria-label', `${stars}성`);
    for (let i = 0; i < 5; i++) { const star = node('span', i < stars ? 'filled' : '', i < stars ? '★' : '☆'); star.dataset.star = i + 1; starRow.append(star); }
    card.append(starRow); return card;
  }
  function shell(job, title, description, grade) {
    const d = ensureDialog(); d.replaceChildren(); d.dataset.kind = job.kind; d.dataset.grade = grade || ''; d.dataset.phase = 'intro';
    const rays = node('div', 'presentation-rays'); rays.setAttribute('aria-hidden', 'true');
    const panel = node('section', 'presentation-panel');
    const head = node('div', 'presentation-heading'); head.append(node('small', 'presentation-kicker', job.kind === 'captain' ? '우리 용병단의 성장' : job.kind === 'awaken' ? '새로운 힘이 깨어나요' : '운명의 문이 열려요'));
    const h = node('h2', '', title); h.id = 'presentation-title'; head.append(h);
    const p = node('p', '', description); p.id = 'presentation-description'; head.append(p);
    const scene = node('div', 'presentation-scene'); scene.setAttribute('aria-hidden', 'true');
    const foot = node('div', 'presentation-footer'), saved = node('small', '', job.kind === 'defeat' ? '육성과 편성으로 다시 도전해 보세요' : '결과는 이미 저장되었어요');
    const skipButton = node('button', 'presentation-skip', '연출 건너뛰기'); skipButton.dataset.presentationSkip = ''; skipButton.type = 'button';
    foot.append(saved, skipButton); panel.append(head, scene, foot); d.append(rays, panel); d.showModal();
    skipButton.focus({ preventScroll: true }); return { dialog: d, scene, rays, title: h, description: p };
  }
  function particles(job, scene, color, count = 18) {
    if (reduced() || !alive(job)) return;
    for (let i = 0; i < count; i++) {
      const particle = node('i', 'presentation-spark'); particle.style.setProperty('--spark', color); scene.append(particle);
      const angle = Math.PI * 2 * i / count, reach = 70 + i % 4 * 24;
      void move(job, particle, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.4)' }, { opacity: 1, offset: .2, transform: `translate(calc(-50% + ${Math.cos(angle) * reach * .5}px),calc(-50% + ${Math.sin(angle) * reach * .5}px)) scale(1)` }, { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(angle) * reach}px),calc(-50% + ${Math.sin(angle) * reach + 25}px)) rotate(${i * 37}deg) scale(.2)` }], 1050).then(() => particle.remove());
    }
  }
  async function captainSequence(job) {
    const level = Math.max(1, Number(job.data.level) || 1), reward = Math.max(0, Number(job.data.reward) || 0);
    const ui = shell(job, '단장 레벨 UP!', `단장 Lv.${level}${reward ? ` · 보석 +${reward}` : ''}`, 'captain');
    const crest = node('div', 'presentation-captain-crest'), wings = node('span', 'captain-laurel', '❮ ❯');
    crest.append(wings, node('span', 'captain-medal', '★'), node('small', '', '단장'), node('strong', '', `Lv.${level}`));
    ui.scene.append(crest);
    const rewardNode = node('div', 'presentation-captain-reward', reward ? `◆ 보석 +${reward}` : '용병단이 한 걸음 더 성장했어요'); ui.scene.append(rewardNode);
    play('captain', 4, job.id);
    particles(job, ui.scene, '#f6d46f', 24);
    await Promise.all([move(job, crest, [{ opacity: 0, transform: 'translate(-50%,-50%) perspective(600px) rotateY(-70deg) scale(.2)' }, { opacity: 1, transform: 'translate(-50%,-50%) perspective(600px) rotateY(8deg) scale(1.16)', offset: .6 }, { opacity: 1, transform: 'translate(-50%,-50%) perspective(600px) rotateY(0deg) scale(1)' }], 900), move(job, rewardNode, [{ opacity: 0, transform: 'translate(-50%,22px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], 450, 550)]);
    if (!alive(job)) return;
    ui.dialog.dataset.phase = 'revealed'; await delay(job, 800);
  }
  async function awakenSequence(job) {
    const id = job.data.hero, hero = info(id), stars = Math.min(5, Math.max(1, Number(job.data.stars) || 1));
    const ui = shell(job, '각성 성공!', `${hero.name} · ${stars - 1}성 → ${stars}성`, 'awaken');
    const left = portraitCard(id, stars - 1, 'fusion-source source-left'), right = portraitCard(id, stars - 1, 'fusion-source source-right'), result = portraitCard(id, stars, 'fusion-result');
    result.hidden = true; ui.scene.append(left, right, result);
    play('fusion', 4, job.id);
    await Promise.all([move(job, left, [{ opacity: 0, transform: 'translate(calc(-50% - 100px),-50%) perspective(600px) rotateY(35deg) scale(.75)' }, { opacity: 1, transform: 'translate(calc(-50% - 90px),-50%) perspective(600px) rotateY(20deg) scale(.83)', offset: .3 }, { opacity: 0, transform: 'translate(-50%,-50%) perspective(600px) rotateY(-80deg) scale(.2)' }], 780), move(job, right, [{ opacity: 0, transform: 'translate(calc(-50% + 100px),-50%) perspective(600px) rotateY(-35deg) scale(.75)' }, { opacity: 1, transform: 'translate(calc(-50% + 90px),-50%) perspective(600px) rotateY(-20deg) scale(.83)', offset: .3 }, { opacity: 0, transform: 'translate(-50%,-50%) perspective(600px) rotateY(80deg) scale(.2)' }], 780)]);
    if (!alive(job)) return;
    left.remove(); right.remove(); result.hidden = false; ui.dialog.dataset.phase = 'fused'; particles(job, ui.scene, '#fbd57e', 22);
    const newStar = result.querySelector(`[data-star="${stars}"]`); newStar.classList.add('new-star');
    await move(job, result, [{ opacity: 0, transform: 'translate(-50%,-50%) perspective(600px) rotateY(-30deg) scale(.4)' }, { opacity: 1, transform: 'translate(-50%,-50%) perspective(600px) rotateY(0) scale(1.12)', offset: .55 }, { opacity: 1, transform: 'translate(-50%,-50%) perspective(600px) rotateY(0) scale(1)' }], 520);
    if (!alive(job)) return;
    await move(job, newStar, [{ opacity: 0, transform: 'scale(3.4) translateY(-12px)' }, { opacity: 1, transform: 'scale(1.3)', offset: .6 }, { opacity: 1, transform: 'scale(1)' }], 440);
    if (!alive(job)) return;
    ui.dialog.dataset.phase = 'revealed'; await delay(job, 600);
  }
  async function recruitSequence(job) {
    const results = Array.isArray(job.data.results) ? job.data.results : [];
    if (!results.length) return;
    const ranking = { SSR: 3, SR: 2, R: 1 };
    const lead = results.reduce((best, entry) => (ranking[info(entry.id).rarity] || 1) > (ranking[info(best.id).rarity] || 1) ? entry : best, results[0]);
    const hero = info(lead.id), grade = ['SSR', 'SR'].includes(hero.rarity) ? hero.rarity : 'R';
    const ui = shell(job, grade === 'SSR' ? '눈부신 운명의 만남' : grade === 'SR' ? '특별한 동료의 등장' : '새로운 만남', `${grade} · ${hero.name}`, grade);
    const gate = node('div', 'presentation-gate'); gate.append(node('span', 'gate-seal', grade === 'SSR' ? '✦' : grade === 'SR' ? '◇' : '✧'));
    const heroCard = portraitCard(lead.id, 0, 'recruit-featured', job); heroCard.hidden = true;
    const gradeBadge = node('div', 'presentation-grade', grade); gradeBadge.hidden = true; ui.scene.append(gate, heroCard, gradeBadge);
    play('pull', 4, job.id);
    const intro = grade === 'SSR' ? 720 : grade === 'SR' ? 480 : 220;
    await move(job, gate, grade === 'SSR' ? [{ opacity: 0, transform: 'translate(-50%,-50%) perspective(500px) rotateY(80deg) scale(.25)' }, { opacity: 1, transform: 'translate(-50%,-50%) perspective(500px) rotateY(-15deg) scale(1.1)', offset: .7 }, { opacity: .3, transform: 'translate(-50%,-50%) perspective(500px) rotateY(0) scale(1.6)' }] : [{ opacity: 0, transform: 'translate(-50%,-50%) rotate(-90deg) scale(.2)' }, { opacity: 1, transform: 'translate(-50%,-50%) rotate(0) scale(1)', offset: .65 }, { opacity: 0, transform: 'translate(-50%,-50%) rotate(35deg) scale(1.4)' }], intro);
    if (!alive(job)) return;
    gate.remove(); heroCard.hidden = false; gradeBadge.hidden = false; ui.dialog.dataset.phase = 'revealed';
    play(grade === 'R' ? 'reward' : grade, 4, job.id);
    if (grade !== 'R') particles(job, ui.scene, grade === 'SSR' ? '#ffdf83' : '#c8afff', grade === 'SSR' ? 28 : 18);
    await Promise.all([move(job, heroCard, [{ opacity: 0, transform: 'translate(-50%,-50%) perspective(600px) rotateY(-90deg) scale(.4)' }, { opacity: 1, transform: 'translate(-50%,-50%) perspective(600px) rotateY(8deg) scale(1.1)', offset: .65 }, { opacity: 1, transform: 'translate(-50%,-50%) perspective(600px) rotateY(0deg) scale(1)' }], grade === 'SSR' ? 620 : 440), move(job, gradeBadge, [{ opacity: 0, transform: 'translate(-50%,0) scale(2.2)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1)' }], 480)]);
    if (!alive(job)) return;
    await delay(job, grade === 'SSR' ? 1300 : grade === 'SR' ? 850 : 320);
  }
  async function defeatSequence(job) {
    const ui = shell(job, '패배', String(job.data.description || '이번 전투는 여기까지'), 'defeat');
    ui.dialog.querySelector('.presentation-kicker').textContent = 'BATTLE ENDED';
    const crest = node('div', 'defeat-crest'); crest.setAttribute('aria-hidden', 'true');
    crest.innerHTML = '<svg viewBox="0 0 64 64"><path fill="currentColor" d="M12 4h12v8h8v8h8v8h8v8h8v12H44v-8h-8v-8h-8v-8h-8v-8h-8zM40 4h12v12h-8v8h-8v-8h4zM20 36h8v8h-8v8H8V40h12zM4 52h12v8H4zM48 52h12v8H48z"/></svg>';
    ui.scene.append(crest); play('defeat', 0, job.id);
    await move(job, crest, [{opacity:0,transform:'translate(-50%,-50%) scale(1.45)'},{opacity:1,transform:'translate(-50%,-50%) scale(.95)',offset:.65},{opacity:1,transform:'translate(-50%,-50%) scale(1)'}], 400);
    if (!alive(job)) return;
    ui.dialog.dataset.phase = 'revealed'; await delay(job, 1200);
  }
  async function start(job) {
    current = job;
    try { if (job.kind === 'captain') await captainSequence(job); else if (job.kind === 'awaken') await awakenSequence(job); else if (job.kind === 'defeat') await defeatSequence(job); else await recruitSequence(job); }
    catch (error) { console.warn('Presentation could not play:', error.message); }
    finally { if (alive(job)) finish(job, { skipped: false, cancelled: false }); }
  }
  function skip() { if (current) finish(current, { skipped: true, cancelled: false }); }
  function cancel() {
    const pending = queue.splice(0);
    for (const job of pending) finish(job, { skipped: true, cancelled: true });
    if (current) finish(current, { skipped: true, cancelled: true });
    stopVoices();
  }
  function refreshPreferences() {
    if (!soundEnabled()) stopVoices();
    if (dialog) dialog.dataset.motion = reduced() ? 'reduced' : 'full';
    if (reduced() && current) for (const animation of [...current.animations]) { try { animation.finish(); } catch {} }
  }
  function setPreferences(values = {}) { overrides = { ...overrides, ...values }; refreshPreferences(); }
  let pressed;
  function buttonAt(target) { return target?.closest?.('button,[role="button"]'); }
  function press(target) {
    const button = buttonAt(target);
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    unlockAudio(); springs.get(button)?.cancel(); pressed?.classList.remove('school-press-active', 'school-press-reduced'); pressed = button;
    button.classList.add('school-press-active');
    button.classList.toggle('school-press-reduced', reduced());
  }
  function release(withSound = true) {
    const button = pressed; pressed = null; if (!button) return;
    button.classList.remove('school-press-active', 'school-press-reduced');
    if (withSound) play('tap');
    if (!button.isConnected || reduced()) return;
    const animation = button.animate([{ scale: '.96' }, { scale: '1.035', offset: .48 }, { scale: '1' }], { duration: 250, easing: 'cubic-bezier(.2,.8,.2,1)' });
    springs.set(button, animation); animation.finished.catch(() => {}).finally(() => { if (springs.get(button) === animation) springs.delete(button); });
  }
  document.addEventListener('pointerdown', event => { if (event.button === 0) press(event.target); }, { passive: true });
  document.addEventListener('pointerup', () => release(), { passive: true });
  document.addEventListener('pointercancel', () => release(false), { passive: true });
  document.addEventListener('keydown', event => { if (!event.repeat && ['Enter', ' '].includes(event.key)) press(event.target); });
  document.addEventListener('keyup', event => { if (['Enter', ' '].includes(event.key)) release(); });
  root.addEventListener('blur', () => release(false));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopVoices(); });
  motionQuery?.addEventListener?.('change', refreshPreferences);
  root.SchoolPresentation = Object.freeze({ configure(options = {}) { config = { ...config, ...options }; refreshPreferences(); }, setPreferences, refreshPreferences, play, captain: data => request('captain', data), awaken: data => request('awaken', data), recruit: data => request('recruit', data), defeat: data => request('defeat', data), skip, cancel, get busy() { return Boolean(current || queue.length); } });
})(globalThis);
