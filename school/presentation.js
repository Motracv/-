/* Confirmed-result presentation only. This module never reads or writes rewards. */
(function (root) {
  'use strict';
  let config = {}, overrides = {}, audio, master, dialog, current, sequence = 0, scheduled = false, impactNoise, lastImpact = -1;
  const queue = [], known = new Map(), voices = new Set(), springs = new WeakMap();
  const motionQuery = root.matchMedia?.('(prefers-reduced-motion: reduce)');
  const soundEnabled = () => overrides.sound ?? Boolean(config.soundEnabled?.());
  const soundVolume = () => {const v=config.soundVolume?.();return Number.isFinite(v)?Math.max(0,Math.min(1,v)):1;};
  const reduced = () => overrides.reduced ?? (typeof config.reducedMotion === 'function' ? Boolean(config.reducedMotion()) : Boolean(motionQuery?.matches || document.documentElement.dataset.motion === 'reduced'));
  const alive = job => current === job && !job.finished;
  const node = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
  function info(id) { return config.heroInfo?.(id) || { id, name: String(id || '용병'), rarity: 'R' }; }
  function unlockAudio() {
    if (!soundEnabled()) return;
    try {
      const Context = root.AudioContext || root.webkitAudioContext;
      if (!Context) return;
      if (!audio || audio.state === 'closed') { audio = new Context(); master = audio.createGain(); master.gain.value = .55 * soundVolume(); master.connect(audio.destination); }
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
    if (kind === 'UR') {
      [261.63,392,523.25,659.25,783.99,1046.5,1318.51,1567.98].forEach((hz,i)=>tone(hz,i*.09,.4,.032,'sine',owner));
      [523.25,659.25,783.99].forEach(hz=>tone(hz,.75,1,.025,'triangle',owner));
      tone(1567.98,1.02,.7,.022,'sine',owner); return;
    }
    if (kind === 'blossom-charge') { [392,523.25,659.25,783.99,1046.5].forEach((hz,i)=>tone(hz,i*.12,.25,.019,'sine',owner)); return; }
    if (kind === 'blossom') { tone(130.81,0,.25,.045,'triangle',owner); [523.25,783.99,1046.5].forEach((hz,i)=>tone(hz,i*.045,.35,.025,'sine',owner)); return; }
    if (kind === 'blossom-refund') { tone(783.99,0,.15,.018,'sine',owner); tone(1046.5,.1,.25,.018,'sine',owner); return; }
    if (kind === 'blossom-miss') { tone(659.25,0,.14,.013,'sine',owner); tone(392,.08,.2,.012,'sine',owner); return; }
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
    job.recruitScene?.destroy();
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
    if (kind === 'captain') data = { ...data, level: Math.max(1, Number(data.level) || 1), gems: Math.max(0, Number(data.gems ?? data.reward) || 0), gold: Math.max(0, Number(data.gold) || 0) };
    const listener = { key, resolve }, scope = String(data.scope ?? (key?.includes(':captain:') ? key.split(':captain:')[0] : ''));
    const pendingCaptain = kind === 'captain' && queue.find(job => job.kind === 'captain' && job.scope === scope);
    if (pendingCaptain) {
      pendingCaptain.data.level = Math.max(pendingCaptain.data.level, Number(data.level) || 1);
      pendingCaptain.data.gems += data.gems; pendingCaptain.data.gold += data.gold; pendingCaptain.listeners.push(listener);
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
    if (id === 'spica') {
      const image=node('img','spica-illustration');image.src='school/assets/spica/portrait.webp?v=spica1';image.alt='설녀 스피카';art.append(image);
    } else if (id === 'ryusion') {
      const image=node('img','horas-illustration');image.src='school/assets/ryusion/portrait.png?v=ryusion1';image.alt='류시온';art.append(image);
    } else if (id === 'horas') {
      const image = node('img', 'horas-illustration'); image.src = 'school/assets/horas/portrait.webp?v=horas1'; image.alt = '호라스'; art.append(image);
    } else if (job && root.SchoolArt?.recruitPortrait) {
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
    delete d.dataset.cinematic;
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
    const { level, gems, gold } = job.data, rewards = [gems ? `보석 +${gems.toLocaleString()}` : '', gold ? `골드 +${gold.toLocaleString()}` : ''].filter(Boolean);
    const ui = shell(job, '단장 레벨 UP!', `단장 Lv.${level}${rewards.length ? ` · ${rewards.join(' · ')}` : ''}`, 'captain');
    const crest = node('div', 'presentation-captain-crest'), wings = node('span', 'captain-laurel', '❮ ❯');
    crest.append(wings, node('span', 'captain-medal', '★'), node('small', '', '단장'), node('strong', '', `Lv.${level}`));
    ui.scene.append(crest);
    const rewardNode = node('div', 'presentation-captain-reward');
    for (const [currency, amount, label, icon] of [['gems', gems, '보석', '◆'], ['gold', gold, '골드', '●']]) if (amount) {
      const item = node('span', `captain-reward-${currency}`, `${icon} ${label} +${amount.toLocaleString()}`); item.dataset.currency = currency; rewardNode.append(item);
    }
    if (!rewards.length) rewardNode.textContent = '용병단이 한 걸음 더 성장했어요';
    ui.scene.append(rewardNode);
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
    const newStar=result.querySelector(`[data-star="${stars}"]`);newStar.style.visibility='hidden';
    result.hidden = true; ui.scene.append(left, right, result);
    play('fusion', 4, job.id);
    await Promise.all([move(job, left, [{ opacity: 0, transform: 'translate(calc(-50% - 100px),-50%) perspective(600px) rotateY(35deg) scale(.75)' }, { opacity: 1, transform: 'translate(calc(-50% - 90px),-50%) perspective(600px) rotateY(20deg) scale(.83)', offset: .3 }, { opacity: 0, transform: 'translate(-50%,-50%) perspective(600px) rotateY(-80deg) scale(.2)' }], 780), move(job, right, [{ opacity: 0, transform: 'translate(calc(-50% + 100px),-50%) perspective(600px) rotateY(-35deg) scale(.75)' }, { opacity: 1, transform: 'translate(calc(-50% + 90px),-50%) perspective(600px) rotateY(-20deg) scale(.83)', offset: .3 }, { opacity: 0, transform: 'translate(-50%,-50%) perspective(600px) rotateY(80deg) scale(.2)' }], 780)]);
    if (!alive(job)) return;
    left.remove(); right.remove(); result.hidden = false; ui.dialog.dataset.phase = 'fused'; particles(job, ui.scene, '#fbd57e', 22);
    newStar.classList.add('new-star');
    const ring=node('div','awakening-shockwave');ui.scene.append(ring);move(job,ring,[{opacity:1,transform:'translate(-50%,-50%) scale(.1)'},{opacity:0,transform:'translate(-50%,-50%) scale(2.2)'}],850);
    await move(job, result, [{ opacity: 0, transform: 'translate(-50%,-50%) perspective(600px) rotateY(-30deg) scale(.4)' }, { opacity: 1, transform: 'translate(-50%,-50%) perspective(600px) rotateY(0) scale(1.12)', offset: .55 }, { opacity: 1, transform: 'translate(-50%,-50%) perspective(600px) rotateY(0) scale(1)' }], 520);
    if (!alive(job)) return;
    ui.dialog.dataset.phase='star-born';
    const born=node('div','awakening-born-star','★');ui.scene.append(born);
    await move(job,born,[{opacity:0,transform:'translate(-50%,-50%) scale(.05) rotate(-160deg)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.2) rotate(8deg)',offset:.7},{opacity:1,transform:'translate(-50%,-50%) scale(1) rotate(0)'}],650);
    if(!alive(job))return;play('captain',4,job.id);
    const target=newStar.getBoundingClientRect(),scene=ui.scene.getBoundingClientRect(),dx=target.left+target.width/2-scene.left-scene.width/2,dy=target.top+target.height/2-scene.top-scene.height/2;
    await move(job,born,[{opacity:1,transform:'translate(-50%,-50%) scale(1)'},{opacity:1,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.14)`}],500);
    if(!alive(job))return;born.remove();newStar.style.visibility='';particles(job,ui.scene,'#fff2b8',18);
    await move(job,newStar,[{opacity:1,transform:'scale(2.5)'},{opacity:1,transform:'scale(.85)',offset:.65},{opacity:1,transform:'scale(1)'}],400);
    if (!alive(job)) return;
    ui.dialog.dataset.phase = 'revealed'; await delay(job, 600);
  }
  // This scene presents an already committed recruitment result. Its phases
  // own only DOM/WAAPI/audio; skip, account cancellation and reload cannot pull
  // another hero or grant the same reward twice.
  async function horasRecruitSequence(job) {
    const ui = shell(job, '벚꽃이 이끈 운명', 'UR · 호라스 · 벚꽃의식', 'UR');
    ui.dialog.dataset.cinematic = 'horas';
    ui.dialog.dataset.phase = 'constellation';
    const sky = node('div', 'ur-cinematic-sky');
    const horizon = node('div', 'ur-cinematic-horizon');
    const orbit = node('div', 'ur-cinematic-orbit');
    const constellation = node('div', 'ur-cinematic-constellation');
    constellation.innerHTML = '<svg viewBox="0 0 300 300" fill="none"><circle cx="150" cy="150" r="138"/><circle cx="150" cy="150" r="114" stroke-dasharray="2 10"/><path d="M150 25 224 251 31 111 269 111 76 251Z"/><path d="M150 25 269 111 224 251 76 251 31 111Z"/><path class="ur-seal-flower" d="M150 150C98 108 111 51 150 84C189 51 202 108 150 150ZM150 150C174 88 231 83 212 130C254 155 204 187 150 150ZM150 150C216 154 238 206 188 202C177 250 131 213 150 150ZM150 150C167 214 125 253 111 205C62 212 80 158 150 150ZM150 150C96 189 45 160 86 132C63 87 121 88 150 150Z"/></svg>';
    const core = node('i', 'ur-cinematic-core');
    orbit.append(constellation, core);
    const orbs = [];
    for (let i = 0; i < 5; i++) {
      const orb = node('i', 'ur-cinematic-orb', '✧');
      orb.dataset.orb = i + 1;
      const angle = i * 72 - 90;
      orb.dataset.start = `translate(-50%,-50%) rotate(${angle}deg) translateX(var(--ur-orbit-radius)) rotate(${-angle}deg)`;
      orb.style.transform = orb.dataset.start;
      orbit.append(orb); orbs.push(orb);
    }
    const glow = node('div', 'ur-cinematic-glow');
    const portrait = node('div', 'ur-cinematic-portrait'); portrait.dataset.hero = 'horas';
    const illustration = node('img', 'ur-cinematic-illustration'); illustration.src = 'school/assets/horas/portrait.webp?v=horas1'; illustration.alt = ''; illustration.decoding = 'async'; portrait.append(illustration);
    const copy = node('div', 'ur-cinematic-copy');
    const rarity = node('div', 'ur-cinematic-rarity', 'UR');
    const name = node('strong', 'ur-cinematic-name', '호라스');
    copy.append(node('small', 'ur-cinematic-eyebrow', '벚꽃이 이끈 운명'), rarity, name, node('span', 'ur-cinematic-skill', '벚꽃의식'), node('p', 'ur-cinematic-line', '별빛을 모아, 운명을 피우다.'));
    const flash = node('div', 'ur-cinematic-flash');
    ui.scene.append(sky, horizon, orbit, glow, portrait, copy, flash);
    if (!reduced()) {
      play('blossom-charge', 4, job.id);
      await Promise.all([
        move(job, constellation, [{ opacity: 0, transform: 'translate(-50%,-50%) rotate(-24deg) scale(.72)' }, { opacity: .85, transform: 'translate(-50%,-50%) rotate(0) scale(1)' }], 550),
        ...orbs.map((orb, i) => move(job, orb, [{ opacity: 0, transform: `${orb.dataset.start} scale(.3)` }, { opacity: 1, transform: `${orb.dataset.start} scale(1)` }], 350, i * 50)),
      ]);
      if (!alive(job)) return;
      ui.dialog.dataset.phase = 'fusion';
      await Promise.all([
        ...orbs.map(orb => move(job, orb, [{ opacity: 1, transform: `${orb.dataset.start} scale(1)` }, { opacity: 1, transform: 'translate(-50%,-50%) scale(.35)' }], 550)),
        move(job, core, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.2)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.8)' }], 550),
        move(job, constellation, [{ opacity: .85, transform: 'translate(-50%,-50%) rotate(0) scale(1)' }, { opacity: .75, transform: 'translate(-50%,-50%) rotate(36deg) scale(.9)' }], 550),
      ]);
      if (!alive(job)) return;
      ui.dialog.dataset.phase = 'opening';
      play('blossom', 4, job.id);
      orbs.forEach(orb => orb.remove());
      await Promise.all([
        move(job, core, [{ opacity: 1, transform: 'translate(-50%,-50%) scale(1.8)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(9)' }], 360),
        move(job, flash, [{ opacity: 0 }, { opacity: .65, offset: .3 }, { opacity: 0 }], 360),
        move(job, constellation, [{ opacity: .75, transform: 'translate(-50%,-50%) rotate(36deg) scale(.9)' }, { opacity: .22, transform: 'translate(-50%,-50%) rotate(48deg) scale(1.45)' }], 360),
      ]);
      if (!alive(job)) return;
    } else {
      orbit.hidden = true;
    }
    ui.dialog.dataset.phase = 'revealed';
    play('UR', 4, job.id);
    if (!reduced()) {
      // Fourteen composited petals, with no per-frame JS or animated filters.
      for (let i = 0; i < 14; i++) {
        const petal = node('i', 'ur-cinematic-petal');
        petal.style.left = `${9 + (i * 23) % 84}%`; petal.style.top = `${5 + (i * 17) % 60}%`;
        petal.style.setProperty('--petal-size', `${6 + i % 4 * 2}px`); ui.scene.append(petal);
        void move(job, petal, [{ opacity: 0, transform: `translate(-30px,-30px) rotate(${i * 31}deg) scale(.6)` }, { opacity: .8, offset: .2, transform: `translate(0,0) rotate(${i * 31 + 20}deg) scale(1)` }, { opacity: 0, transform: `translate(${45 + i % 3 * 30}px,${50 + i % 4 * 23}px) rotate(${i * 31 + 130}deg) scale(.8)` }], 1900, i * 25).then(() => petal.remove());
      }
    }
    await Promise.all([
      move(job, portrait, [{ opacity: 0, transform: 'translate(42px,15px) scale(1.08)' }, { opacity: 1, transform: 'translate(0,0) scale(1)' }], 700),
      move(job, copy, [{ opacity: 0, transform: 'translate(-22px,8px)' }, { opacity: 1, transform: 'translate(0,0)' }], 600, 100),
      move(job, glow, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1)' }], 700),
    ]);
    if (!alive(job)) return;
    await delay(job, 1350);
  }
  async function hyeokjinRecruitSequence(job){
    const ui=shell(job,'내가 지켜온 모든 것','UR · 서혁진','UR');ui.dialog.dataset.cinematic='hyeokjin';
    const art=node('img','hyeok-recruit-art');art.src='school/assets/hyeokjin/pickup.webp?v=hyeokjin1';art.alt='서혁진, 붉은 대검과 어둠의 각성';
    const seal=node('div','hyeok-recruit-seal','지켜온 맹세'),copy=node('div','hyeok-recruit-copy');copy.append(node('b','','UR · 서혁진'),node('p','','쓰러질 수 없어. 아직 지켜야 할 것이 남았으니까.'));
    ui.scene.append(art,seal,copy);play('pull',4,job.id);
    await move(job,seal,[{opacity:0,transform:'translate(-50%,-50%) scale(.7)'},{opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.7},{opacity:0,transform:'translate(-50%,-50%) scale(1.2)'}],900);
    if(!alive(job))return;seal.remove();ui.dialog.dataset.phase='revealed';play('UR',4,job.id);particles(job,ui.scene,'#ff83b0',20);
    await Promise.all([move(job,art,[{opacity:0,transform:'scale(1.07)'},{opacity:1,transform:'scale(1)'}],650),move(job,copy,[{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'translateY(0)'}],550)]);
    if(alive(job))await delay(job,1500);
  }
  async function recruitSequence(job) {
    const results = Array.isArray(job.data.results) ? job.data.results : [];
    if (!results.length) return;
    const ranking = { UR: 4, SSR: 3, SR: 2, R: 1 };
    const lead = results.reduce((best, entry) => (ranking[info(entry.id).rarity] || 1) > (ranking[info(best.id).rarity] || 1) ? entry : best, results[0]);
    const hero = info(lead.id), grade = ['UR', 'SSR', 'SR'].includes(hero.rarity) ? hero.rarity : 'R';
    if (root.SchoolRecruitScene?.available(lead.id)) {
      const d=ensureDialog(); d.dataset.kind='recruit'; d.dataset.grade=grade; d.dataset.cinematic='awakening';
      const cues={approach:'pull',tap1:'tap',tap2:'tap',sigil:'blossom-charge',dive:'fusion',reveal:grade};
      job.recruitScene=root.SchoolRecruitScene.create(d,{hero,reduced:reduced(),play:key=>play(cues[key]||'reward',4,job.id),stopSound:()=>stopVoices(job.id)});
      d.showModal();
      const result=await job.recruitScene.done;
      if(alive(job))finish(job,{skipped:!!result.skipped,cancelled:!!result.cancelled,fallback:!!result.fallback});
      return;
    }
    if (grade === 'UR' && lead.id === 'hyeokjin') { await hyeokjinRecruitSequence(job); return; }
    if (grade === 'UR' && lead.id === 'horas') { await horasRecruitSequence(job); return; }
    const ui = shell(job, grade === 'UR' ? '벚꽃이 이끈 운명' : grade === 'SSR' ? '눈부신 운명의 만남' : grade === 'SR' ? '특별한 동료의 등장' : '새로운 만남', `${grade} · ${hero.name}`, grade);
    if(job.data.source==='winter-exchange'){ui.dialog.dataset.cinematic='spica';ui.dialog.querySelector('.presentation-kicker').textContent='겨울이 맺어 준 인연';ui.title.textContent='설원의 숨결 · 스피카';}
    const gate = node('div', 'presentation-gate'); gate.append(node('span', 'gate-seal', lead.id==='spica'?'❄':grade === 'UR' ? '❀' : grade === 'SSR' ? '✦' : grade === 'SR' ? '◇' : '✧'));
    if (grade === 'UR') for (let i=0;i<5;i++) { const orb=node('i','ur-gate-orb','❀'); orb.style.setProperty('--orb-angle', `${i*72-90}deg`); gate.append(orb); }
    const heroCard = portraitCard(lead.id, 0, 'recruit-featured', job); heroCard.hidden = true;
    const gradeBadge = node('div', 'presentation-grade', grade); gradeBadge.hidden = true; ui.scene.append(gate, heroCard, gradeBadge);
    play('pull', 4, job.id);
    const intro = grade === 'UR' ? 1100 : grade === 'SSR' ? 720 : grade === 'SR' ? 480 : 220;
    await move(job, gate, grade === 'UR' ? [{opacity:0,transform:'translate(-50%,-50%) rotate(-18deg) scale(.4)'},{opacity:1,transform:'translate(-50%,-50%) rotate(0) scale(1)',offset:.45},{opacity:1,transform:'translate(-50%,-50%) rotate(12deg) scale(.72)',offset:.83},{opacity:0,transform:'translate(-50%,-50%) rotate(18deg) scale(1.8)'}] : grade === 'SSR' ? [{ opacity: 0, transform: 'translate(-50%,-50%) perspective(500px) rotateY(80deg) scale(.25)' }, { opacity: 1, transform: 'translate(-50%,-50%) perspective(500px) rotateY(-15deg) scale(1.1)', offset: .7 }, { opacity: .3, transform: 'translate(-50%,-50%) perspective(500px) rotateY(0) scale(1.6)' }] : [{ opacity: 0, transform: 'translate(-50%,-50%) rotate(-90deg) scale(.2)' }, { opacity: 1, transform: 'translate(-50%,-50%) rotate(0) scale(1)', offset: .65 }, { opacity: 0, transform: 'translate(-50%,-50%) rotate(35deg) scale(1.4)' }], intro);
    if (!alive(job)) return;
    gate.remove(); heroCard.hidden = false; gradeBadge.hidden = false; ui.dialog.dataset.phase = 'revealed';
    play(grade === 'R' ? 'reward' : grade, 4, job.id);
    if (grade !== 'R') particles(job, ui.scene, grade === 'UR' ? '#ffb7da' : grade === 'SSR' ? '#ffdf83' : '#c8afff', grade === 'UR' ? 24 : grade === 'SSR' ? 28 : 18);
    await Promise.all([move(job, heroCard, [{ opacity: 0, transform: 'translate(-50%,-50%) perspective(600px) rotateY(-90deg) scale(.4)' }, { opacity: 1, transform: 'translate(-50%,-50%) perspective(600px) rotateY(8deg) scale(1.1)', offset: .65 }, { opacity: 1, transform: 'translate(-50%,-50%) perspective(600px) rotateY(0deg) scale(1)' }], grade === 'SSR' ? 620 : 440), move(job, gradeBadge, [{ opacity: 0, transform: 'translate(-50%,0) scale(2.2)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1)' }], 480)]);
    if (!alive(job)) return;
    await delay(job, grade === 'UR' ? 1700 : grade === 'SSR' ? 1300 : grade === 'SR' ? 850 : 320);
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
    if(master)master.gain.value=.55 * soundVolume();
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
