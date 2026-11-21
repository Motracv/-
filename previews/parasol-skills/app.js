(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const stage = $('#stage'), ctx = stage.getContext('2d'), video = $('#demo-video');
  const pointerInputs = new Map(), keys = new Set();
  let engine, assets, meta, ready = false, last = 0, speed = 1, view = 'play', pausedBeforeVideo = false, loadAttempt = 0;
  let renderedStatus = '', lastControlRefresh = 0;
  function image(src) {
    return new Promise((resolve, reject) => {
      const img = new Image(), timer = setTimeout(() => reject(Error('이미지 로딩 시간 초과')), 20000);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); reject(Error('이미지를 불러오지 못했습니다')); };
      img.src = src;
    });
  }
  async function manifest() {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('assets/animations.json?v=parasol1', { signal: controller.signal });
      if (!response.ok) throw Error('동작 정보를 불러오지 못했습니다');
      const data = await response.json();
      if (data.motions?.length !== 6 || data.motions.some(m => m.frames?.length !== 8)) throw Error('동작 정보가 올바르지 않습니다');
      return data;
    } finally { clearTimeout(timeout); }
  }
  async function load() {
    const attempt = ++loadAttempt; ready = false; $('#play-controls').disabled = true; $('#retry').hidden = true;
    $('#loading').hidden = false; $('#loading strong').textContent = '시연실을 준비하고 있어요';
    $('#loading p').textContent = '캐릭터와 스킬 이펙트를 불러오는 중';
    try {
      const loaded = await Promise.all([image('assets/character.png?v=parasol1'), image('assets/courtyard.webp?v=parasol1'), image('assets/dummy.png?v=parasol1'), manifest()]);
      if (attempt !== loadAttempt) return;
      assets = { actor: loaded[0], background: loaded[1], dummy: loaded[2] }; meta = loaded[3];
      engine = new ParasolEngine.Engine(meta); engine.setAuto(true); ready = true; last = 0;
      $('#play-controls').disabled = false; $('#loading').hidden = true;
      // This contains only this standalone preview's local state, never game accounts or saves.
      window.parasolDemo = { engine, assets, meta, get ready() { return ready; }, get view() { return view; } };
      if (view === 'video') engine.state.paused = true;
      updateControls();
    } catch (error) {
      if (attempt !== loadAttempt) return;
      $('#loading strong').textContent = '시연실을 불러오지 못했어요';
      $('#loading p').textContent = '연결을 확인하고 다시 불러오기를 눌러 주세요. 영상 보기로도 확인할 수 있어요.';
      $('#retry').hidden = false; $('#action-status').textContent = '불러오기 실패';
    }
  }
  function input() {
    if (!ready) return;
    const left = keys.has('KeyA') || keys.has('ArrowLeft') || [...pointerInputs.values()].includes(-1);
    const right = keys.has('KeyD') || keys.has('ArrowRight') || [...pointerInputs.values()].includes(1);
    engine.setInput((right ? 1 : 0) - (left ? 1 : 0));
    document.querySelectorAll('[data-move]').forEach(b => b.classList.toggle('held', Number(b.dataset.move) < 0 ? left : right));
  }
  function clearInput() { pointerInputs.clear(); keys.clear(); input(); }
  function useSkill(kind) { if (!ready || view !== 'play') return; clearInput(); engine.cast(kind); updateControls(); }
  function dodge() { if (!ready || view !== 'play') return; engine.dodge(); pointerInputs.clear(); keys.clear(); input(); updateControls(); }
  function updateControls() {
    if (!ready) return;
    const s = engine.state, a = s.action;
    $('#auto').setAttribute('aria-pressed', String(s.auto)); $('#auto').textContent = s.auto ? '연속 시연 중' : '연속 시연';
    $('#pause').setAttribute('aria-pressed', String(s.paused)); $('#pause').textContent = s.paused ? '재생' : '일시 정지';
    document.querySelectorAll('[data-style]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.style === s.style)));
    document.querySelectorAll('[data-skill]').forEach(b => {
      const kind = Number(b.dataset.skill); b.classList.toggle('active', a?.type === 'cast' && a.kind === kind);
      b.classList.toggle('queued', s.queue === kind);
    });
    let status = s.paused ? '일시 정지' : a?.type === 'cast' ? ParasolEngine.skills[a.kind].name + ' 시전 중' : a?.type === 'evade' ? '회피 중' : s.input ? '이동 중' : '스킬을 눌러 사용해 보세요';
    if (s.queue !== null) status += ' · 다음: ' + ParasolEngine.skills[s.queue].name;
    if (status !== renderedStatus) { $('#action-status').textContent = status; renderedStatus = status; }
    $('#hit-count').textContent = '명중 ' + s.totalHits + '회';
  }
  function tick(time) {
    if (ready && view === 'play' && !document.hidden) {
      if (last) engine.advance(Math.min(80, Math.max(0, time - last)) * speed);
      ctx.setTransform(stage.width / 720, 0, 0, stage.height / 400, 0, 0);
      ParasolRenderer.draw(ctx, assets, meta, engine);
      if (time - lastControlRefresh > 80) { updateControls(); lastControlRefresh = time; }
    }
    last = time; requestAnimationFrame(tick);
  }
  document.querySelectorAll('[data-skill]').forEach(b => b.addEventListener('click', () => useSkill(Number(b.dataset.skill))));
  document.querySelectorAll('[data-move]').forEach(b => {
    b.addEventListener('pointerdown', e => {
      if (!ready || view !== 'play' || e.button !== 0) return;
      e.preventDefault(); b.setPointerCapture(e.pointerId); pointerInputs.set(e.pointerId, Number(b.dataset.move));
      engine.state.paused = false; input(); updateControls();
    });
    const release = e => { pointerInputs.delete(e.pointerId); input(); };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(event, release);
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
  document.addEventListener('keydown', e => {
    if (!ready || view !== 'play' || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { e.preventDefault(); keys.add(e.code); engine.state.paused = false; input(); }
    const map = { Digit1: 0, Digit2: 1, Digit3: 2, KeyQ: 0, KeyE: 1, KeyR: 2 };
    if (Object.hasOwn(map, e.code)) { e.preventDefault(); if (!e.repeat) useSkill(map[e.code]); }
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) dodge(); }
  });
  document.addEventListener('keyup', e => { keys.delete(e.code); input(); });
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { last = 0; clearInput(); });
  $('#dodge').addEventListener('click', dodge);
  $('#retry').addEventListener('click', load);
  $('#auto').addEventListener('click', () => { clearInput(); engine.setAuto(!engine.state.auto); updateControls(); });
  $('#pause').addEventListener('click', () => { engine.state.paused = !engine.state.paused; clearInput(); updateControls(); });
  $('#reset').addEventListener('click', () => { clearInput(); engine.reset(); updateControls(); });
  $('#speed').addEventListener('change', e => { speed = Number(e.target.value); });
  document.querySelectorAll('[data-style]').forEach(b => b.addEventListener('click', () => { engine.setStyle(b.dataset.style); updateControls(); }));
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
    const next = b.dataset.view; if (next === view) return;
    clearInput();
    if (next === 'video') {
      if (ready) { pausedBeforeVideo = engine.state.paused; engine.state.paused = true; }
      view = next; video.play().catch(() => {});
    } else { video.pause(); view = next; if (ready) engine.state.paused = pausedBeforeVideo; last = 0; }
    $('#play-view').hidden = next !== 'play'; $('#video-view').hidden = next !== 'video';
    document.querySelectorAll('[data-view]').forEach(n => n.setAttribute('aria-pressed', String(n === b)));
  }));
  $('#fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen(); else await $('#playground').requestFullscreen();
    } catch { $('#action-status').textContent = '이 브라우저에서는 전체 화면을 사용할 수 없어요.'; }
  });
  document.addEventListener('fullscreenchange', () => { $('#fullscreen').textContent = document.fullscreenElement ? '전체 화면 종료' : '전체 화면'; });
  if (!document.fullscreenEnabled) $('#fullscreen').hidden = true;
  requestAnimationFrame(tick); load();
})();
