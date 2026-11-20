(function () {
  'use strict';
  const M = window.RecruitPreviewModel;
  const $ = id => document.getElementById(id);
  const stage = $('stage'), clock = M.createClock();
  const ease = v => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
  const ramp = (time, start, duration) => ease((time - start) / duration);
  const opacity = (node, value) => { node.style.opacity = String(Math.max(0, Math.min(1, value))); };
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery.matches, selected = 'UR', results = [], best = null;
  let ready = false, busy = false, mode = 'home', paused = false, raf = 0, revision = 0, previousPhase = '';
  let audioEnabled = false, audio = null, voices = new Set(), sounded = new Set();
  const loaded = new Map();
  stage.dataset.reduced = String(reduced);

  // All particles are pooled once. A long hold never creates new DOM elements.
  for (let i = 0; i < 20; i++) {
    const dot = document.createElement('i'); dot.className = 'mote';
    dot.style.left = ((i * 37 + 8) % 95) + '%'; dot.style.top = ((i * 19 + 12) % 94) + '%';
    dot.style.setProperty('--delay', -(i * .47) + 's'); $('ambient').append(dot);
  }
  for (let i = 0; i < 22; i++) {
    const petal = document.createElement('i'); petal.className = 'petal';
    petal.style.left = ((i * 31 + 5) % 100) + '%'; petal.style.top = ((i * 23) % 100 - 35) + '%';
    petal.style.setProperty('--delay', -(i * .53) + 's'); $('petals').append(petal);
  }

  function loadImage(url) {
    if (loaded.has(url)) return loaded.get(url);
    const promise = new Promise((resolve, reject) => {
      const image = new Image(); let settled = false;
      const timeout = setTimeout(() => finish(new Error('일러스트를 불러오는 데 시간이 걸리고 있어요.')), 30000);
      function finish(error) {
        if (settled) return; settled = true; clearTimeout(timeout);
        image.onload = image.onerror = null;
        error ? reject(error) : resolve(image);
      }
      image.onload = async () => {
        if (!image.naturalWidth) return finish(new Error('일러스트를 읽지 못했어요.'));
        try { if (image.decode) await image.decode(); finish(); }
        catch { finish(new Error('일러스트를 준비하지 못했어요.')); }
      };
      image.onerror = () => finish(new Error('일러스트 연결을 확인해 주세요.'));
      image.src = url;
    });
    loaded.set(url, promise);
    promise.catch(() => { if (loaded.get(url) === promise) loaded.delete(url); });
    return promise;
  }

  function stopSound() {
    for (const voice of voices) { try { voice.stop(); } catch {} }
    voices.clear();
  }
  function audioReady() {
    if (!audioEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audio ||= new AudioContext();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
    } catch { audio = null; }
  }
  function tone(frequency, delay, length, volume = .04, type = 'sine') {
    if (!audioEnabled || !audio || audio.state !== 'running') return;
    try {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = type; oscillator.frequency.value = frequency;
      const at = audio.currentTime + delay;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, at + length);
      oscillator.connect(gain); gain.connect(audio.destination);
      voices.add(oscillator); oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(at); oscillator.stop(at + length + .03);
    } catch { /* Audio is optional; drawing and controls always continue. */ }
  }
  function cue(key) {
    if (sounded.has(key)) return; sounded.add(key);
    if (key === 'tap1' || key === 'tap2') tone(210, 0, .14, .06, 'triangle');
    if (key === 'approach') { tone(523.25, 0, 1.2, .018); tone(783.99, .2, 1.2, .014); }
    if (key === 'reveal') [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * .11, 1.6, .035));
    if (key === 'results') [659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * .07, .55, .024));
  }
  function stop() {
    cancelAnimationFrame(raf); raf = 0; clock.pause(); stopSound();
  }
  function updateControls() {
    $('start').disabled = !ready || busy;
    $('restart').disabled = !ready || busy;
    $('pause').disabled = busy || mode !== 'playing';
    $('pause').textContent = paused ? '계속 재생' : '일시정지';
    document.querySelectorAll('[data-seek]').forEach(button => { button.disabled = !ready || busy; });
    stage.dataset.paused = String(paused || document.hidden);
  }
  function showDialogue(speaker, text, visible) {
    $('dialogue').hidden = !visible;
    if (!visible) return;
    if ($('speaker').textContent !== speaker) $('speaker').textContent = speaker;
    if ($('line').textContent !== text) $('line').textContent = text;
  }
  function resetVisuals() {
    $('home').hidden = false; $('results').hidden = true; $('continue').hidden = true; $('skip').hidden = true;
    opacity($('home'), 1);
    $('reveal').setAttribute('aria-hidden', 'true');
    $('scene').style.transform = ''; $('scene').style.opacity = '';
    $('commander').style.transform = ''; $('commander').style.opacity = '';
    $('visitor').style.transform = ''; $('reveal-art-wrap').style.transform = '';
    for (const id of ['visitor', 'visitor-aura', 'hint-badge', 'tap-rings', 'reveal', 'blackout', 'flash', 'petals']) opacity($(id), 0);
    for (const id of ['eyelid-top', 'eyelid-bottom']) $(id).style.transform = 'scaleY(0)';
    showDialogue('', '', false); $('progress').style.width = '0%'; previousPhase = '';
    stage.dataset.phase = 'home'; stage.classList.remove('portrait-reveal');
    document.querySelectorAll('[data-seek]').forEach((button, i) => button.classList.toggle('active', i === 0));
  }
  async function prepare(rarity) {
    const ticket = ++revision;
    stop(); ready = false; busy = true; mode = 'home'; paused = false; selected = rarity;
    results = M.scenario(rarity); best = M.highest(results); sounded.clear();
    resetVisuals(); stage.dataset.rarity = best.rarity;
    stage.setAttribute('aria-busy', 'true'); $('loading').hidden = false; $('retry').hidden = true;
    $('load-message').textContent = '교실과 동료의 모습을 준비하고 있어요.';
    $('start-label').textContent = '일러스트 준비 중';
    document.querySelectorAll('.rarity-controls button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rarity === rarity)));
    updateControls();
    const art = new Set(['assets/classroom.webp', 'assets/commander.webp', best.wake, best.reveal]);
    for (const hero of results) art.add(hero.profile || `../../school/assets/roster-remake/${hero.sheet}.webp`);
    try {
      await Promise.all([...art].map(loadImage));
      if (ticket !== revision) return;
      $('visitor-art').src = best.wake; $('reveal-art').src = best.reveal;
      $('visitor-art').hidden = best.id === 'horas'; $('visitor-rig').toggleAttribute('hidden', best.id !== 'horas');
      $('reveal-art').alt = `${best.name}가 웃으며 단장을 반기는 모습`;
      $('hero-rarity').textContent = $('hint-rarity').textContent = best.rarity;
      $('hero-name').textContent = best.name; $('hero-title').textContent = best.title;
      ready = true; busy = false; $('loading').hidden = true; stage.setAttribute('aria-busy', 'false');
      $('start-label').textContent = '모집 연출 보기';
      $('status').textContent = `${best.rarity} ${best.name} 시연 · 모집 연출 보기를 눌러 시작하세요.`;
      updateControls();
    } catch (error) {
      if (ticket !== revision) return;
      busy = false; stage.setAttribute('aria-busy', 'false'); $('retry').hidden = false;
      $('load-message').textContent = error.message + ' 다시 불러오기를 눌러 주세요.';
      $('status').textContent = '아직 시작하지 않았어요. 연결 후 다시 불러올 수 있어요.';
      updateControls();
    }
  }

  function draw(time, silent = false) {
    const phase = M.phaseAt(time), transition = ramp(time, M.MARKS.reveal, 1.1);
    stage.dataset.phase = phase;
    const approach = ramp(time, 3.7, 1.7), waking = time >= 5.9 && time < 8.2;
    const tap = Math.max(0, 1 - Math.abs(time - 6.45) / .32) + Math.max(0, 1 - Math.abs(time - 7.35) / .32);
    const breathing = reduced ? 0 : Math.sin(time * 1.9);
    $('home').hidden = time > .75;
    opacity($('home'), 1 - ramp(time, .15, .55));
    opacity($('commander'), ramp(time, .75, .25) * (1 - transition));
    // The desk stays grounded; the minute scale change is anchored at its base.
    $('commander').style.transform = `translateY(${reduced ? 0 : -tap * 2}px) scaleY(${1 + breathing * .0015})`;
    $('scene').style.transform = reduced ? 'none' : `scale(${1 + ramp(time, 1, 7) * .035 + ramp(time, 8.2, 1.3) * .07}) translateY(${ramp(time, 8.2, 1.3) * 1.3}%)`;
    opacity($('visitor'), approach * (1 - transition));
    $('visitor').style.transform = reduced ? 'none' : `translateX(${(1 - approach) * 15}%) translateY(${tap * 5 + breathing * .6}px) rotate(${-tap * 1.3}deg)`;
    // A separately clipped forearm rotates around the shoulder: the fingers
    // lower twice while the body and dress keep their own breathing motion.
    $('visitor-arm').setAttribute('transform', `rotate(${reduced ? 0 : -tap * 2.7 + (waking ? Math.sin(time * 4) * .2 : 0)} 390 455)`);
    opacity($('visitor-aura'), approach * (.65 + Math.sin(time * 2) * .12) * (1 - transition));
    opacity($('hint-badge'), ramp(time, 4.4, .6) * (1 - ramp(time, 8, .5)));
    opacity($('tap-rings'), tap * .7 * (reduced ? 0 : 1));
    $('tap-rings').style.transform = `scale(${1.6 - tap * .6})`;
    const black = time < .75 ? ramp(time, 0, .75) : 1 - ramp(time, 1, 1.6);
    opacity($('blackout'), black);
    let blink = 0;
    if (time >= 8.2 && time < 9.5) blink = time < 8.7 ? ramp(time, 8.2, .5) : 1 - ramp(time, 8.7, .8);
    for (const id of ['eyelid-top', 'eyelid-bottom']) $(id).style.transform = `scaleY(${reduced ? 0 : blink})`;
    opacity($('reveal'), transition);
    $('reveal').setAttribute('aria-hidden', String(time < M.MARKS.reveal));
    $('reveal-art-wrap').style.transform = reduced ? 'none' : `translateY(${(1 - transition) * 5}%) scale(${1.035 - transition * .035}) rotate(${(1 - transition) * -1.5}deg)`;
    opacity($('petals'), transition);
    const flash = time < 9.5 ? ramp(time, 9.2, .3) : 1 - ramp(time, 9.5, .65);
    opacity($('flash'), reduced ? 0 : flash * .88);
    if (time >= 10.15) {
      const count = reduced ? best.greeting.length : Math.floor((time - 10.15) * 32);
      showDialogue(best.name, best.greeting.slice(0, count), true);
    } else if (time >= 5.95 && time < 8.2) showDialogue('???', time < 6.9 ? '단장님…' : '단장님, 일어날 시간이에요.', true);
    else showDialogue('', '', false);
    $('progress').style.width = Math.min(100, time / M.MARKS.hold * 100) + '%';
    if (phase !== previousPhase) {
      previousPhase = phase;
      const label = { blackout: '천천히 눈을 감으면…', sleep: '조용한 교실. 잠든 단장.', approach: '곁으로 다가오는 낯선 기척.', wake: '누군가 단장을 깨웁니다.', opening: '천천히 고개를 들면…', reveal: '새로운 동료와의 첫 만남.', hold: '캐릭터를 감상한 뒤 화면을 눌러 전체 결과를 확인하세요.' };
      $('status').textContent = label[phase];
      const index = time < 1 ? 0 : time < 3.7 ? 1 : time < 5.9 ? 2 : time < 9.5 ? 3 : 4;
      document.querySelectorAll('[data-seek]').forEach((button, i) => button.classList.toggle('active', i === index));
    }
    if (!silent) {
      if (time >= 3.7 && time < 5) cue('approach');
      if (time >= 6.35 && time < 6.8) cue('tap1');
      if (time >= 7.25 && time < 7.7) cue('tap2');
      if (time >= 9.5) cue('reveal');
    }
  }
  function hold() {
    mode = 'hold'; clock.pause(); $('continue').hidden = false; $('skip').hidden = true;
    showDialogue(best.name, best.greeting, true); updateControls();
    $('continue').focus({ preventScroll: true });
  }
  function tick(now) {
    raf = 0;
    if (mode !== 'playing' || paused || document.hidden) return;
    const state = clock.tick(now); draw(state.time);
    if (state.phase === 'hold') { hold(); return; }
    raf = requestAnimationFrame(tick);
  }
  function play(from = 0) {
    if (!ready || busy) return;
    stop(); mode = 'playing'; paused = false; sounded.clear(); previousPhase = '';
    resetVisuals(); $('home').hidden = from > .75; $('results').hidden = true;
    $('skip').hidden = false; $('continue').hidden = true;
    clock.start(); clock.seek(reduced ? Math.max(from, 9.5) : from);
    audioReady(); draw(clock.time, true); updateControls();
    // Move focus away from controls that are about to fade beneath the scene.
    $('skip').focus({ preventScroll: true });
    if (clock.time >= M.MARKS.hold) hold(); else raf = requestAnimationFrame(tick);
  }
  function renderResults() {
    const grid = $('result-grid'); grid.replaceChildren();
    const bestIndex = results.findIndex(hero => hero.id === best.id && hero.rarity === best.rarity);
    results.forEach((hero, index) => {
      const card = document.createElement('article'); card.className = 'result-card' + (index === bestIndex ? ' best' : '');
      card.dataset.rarity = hero.rarity; card.style.setProperty('--delay', (index * .045) + 's');
      card.setAttribute('aria-label', `${hero.rarity} ${hero.name}${index === bestIndex ? ', 대표 동료' : ''}`);
      const rarity = document.createElement('span'); rarity.className = 'card-rarity'; rarity.textContent = hero.rarity;
      const picture = document.createElement('div'); picture.className = 'card-image';
      if (hero.profile) { const img = document.createElement('img'); img.src = hero.profile; img.alt = ''; picture.append(img); }
      else {
        const sprite = document.createElement('div'); sprite.className = 'card-sprite';
        sprite.style.backgroundImage = `url("../../school/assets/roster-remake/${hero.sheet}.webp")`;
        sprite.style.setProperty('--row', (hero.row / 3 * 100) + '%'); picture.append(sprite);
      }
      const name = document.createElement('span'); name.className = 'card-name'; name.textContent = hero.name;
      card.append(rarity, picture, name);
      if (index === bestIndex) { const badge = document.createElement('span'); badge.className = 'best-label'; badge.textContent = '첫 만남'; card.append(badge); }
      grid.append(card);
    });
  }
  function showResults() {
    if (!ready || busy || (mode !== 'playing' && mode !== 'hold')) return;
    stop(); mode = 'results'; paused = false; stage.dataset.phase = 'results';
    $('home').hidden = true; $('continue').hidden = true; $('skip').hidden = true; $('dialogue').hidden = true;
    for (const id of ['blackout', 'flash']) opacity($(id), 0);
    for (const id of ['eyelid-top', 'eyelid-bottom']) $(id).style.transform = 'scaleY(0)';
    renderResults(); $('results').hidden = false; $('progress').style.width = '100%';
    $('status').textContent = `시연 결과 10명 · 최고 등급 ${best.rarity} ${best.name} · 다시 재생해도 같은 결과예요.`;
    updateControls(); cue('results'); $('replay-result').focus({ preventScroll: true });
  }
  function togglePause() {
    if (mode !== 'playing') return;
    paused = !paused;
    if (paused) { stop(); $('status').textContent = '일시정지 · 계속 재생을 누르면 이어집니다.'; }
    else { previousPhase = ''; clock.resume(); audioReady(); raf = requestAnimationFrame(tick); }
    updateControls();
  }

  $('start').addEventListener('click', () => play());
  $('restart').addEventListener('click', () => play());
  $('replay-result').addEventListener('click', () => play());
  $('pause').addEventListener('click', togglePause);
  $('continue').addEventListener('click', showResults);
  $('skip').addEventListener('click', showResults);
  $('retry').addEventListener('click', () => prepare(selected));
  document.querySelectorAll('.rarity-controls button').forEach(button => button.addEventListener('click', () => {
    if (selected !== button.dataset.rarity || !ready) prepare(button.dataset.rarity);
  }));
  document.querySelectorAll('[data-seek]').forEach(button => button.addEventListener('click', () => play(Number(button.dataset.seek))));
  $('sound').addEventListener('click', () => {
    audioEnabled = !audioEnabled; $('sound').setAttribute('aria-pressed', String(audioEnabled));
    const label = audioEnabled ? '효과음 끄기' : '효과음 켜기'; $('sound').setAttribute('aria-label', label); $('sound').title = label;
    if (audioEnabled) audioReady(); else stopSound();
  });
  if (!stage.requestFullscreen) $('fullscreen').hidden = true;
  $('fullscreen').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.requestFullscreen(); }
    catch { $('status').textContent = '이 환경에서는 전체 화면이 제한돼요. 현재 화면에서도 재생할 수 있어요.'; }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; clock.pause(); stopSound(); }
    else if (mode === 'playing' && !paused) { clock.resume(); raf = requestAnimationFrame(tick); }
    updateControls();
  });
  document.addEventListener('keydown', event => {
    if (event.target.closest('button,a,input,select,textarea') || event.repeat) return;
    if (event.code === 'Space') { event.preventDefault(); if (mode === 'home') play(); else if (mode === 'hold') showResults(); else togglePause(); }
    if (event.code === 'Escape' && mode === 'playing') { event.preventDefault(); if (!paused) togglePause(); }
  });
  motionQuery.addEventListener?.('change', event => {
    reduced = event.matches; stage.dataset.reduced = String(reduced);
    if (reduced && mode === 'playing') { stop(); clock.seek(M.MARKS.hold); draw(clock.time, true); hold(); }
  });
  window.addEventListener('pagehide', () => { stop(); if (audio) audio.suspend().catch(() => {}); });
  window.addEventListener('pageshow', event => {
    if (event.persisted && mode === 'playing') { paused = true; updateControls(); $('status').textContent = '계속 재생을 눌러 이어서 볼 수 있어요.'; }
  });
  prepare('UR');
})();
