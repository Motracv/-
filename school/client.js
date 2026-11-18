(() => {
  'use strict';
  const G = window.SchoolRPG, Art = window.SchoolArt, $ = id => document.getElementById(id);
  const BASE = 'https://motracv-card-room.densedormouse4.chatgpt.site';
  const SAVE = 'school-mercenaries-v8', LEGACY_SAVES = ['school-mercenaries-v7', 'school-mercenaries-v6', 'school-mercenaries-v5', 'school-mercenaries-v4', 'school-mercenaries-v3', 'school-mercenaries-v2', 'school-mercenaries-v1'], MODE = 'school-save-mode', SESSION = `card-account:${BASE}`, PENDING = 'school-pending-action';
  const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const setText = (node, value) => { if (typeof node === 'string') node = $(node); const text = String(value); if (node && node.textContent !== text) node.textContent = text; };
  const setAttr = (node, name, value) => { const text = String(value); if (node.getAttribute(name) !== text) node.setAttribute(name, text); };
  const setHidden = (node, value) => { if (node.hidden !== value) node.hidden = value; };
  const setDisabled = (node, value) => { if (node.disabled !== value) node.disabled = value; };
  const setWidth = (node, value) => { if (node.style.width !== value) node.style.width = value; };
  const toggleClass = (node, name, value) => { if (node.classList.contains(name) !== value) node.classList.toggle(name, value); };
  const fmt = n => Math.floor(n).toLocaleString('ko-KR');
  const duration = seconds => seconds >= 3600 ? `${Math.floor(seconds / 3600)}시간 ${Math.floor(seconds % 3600 / 60)}분` : `${Math.floor(seconds / 60)}분`;
  const maxTeam = () => G.MAX_TEAM || 6;
  const slotName = index => `${index + 1}번 · ${state.team.length > 3 || index >= 3 ? index < 3 ? '전열' : '후열' : ['전열','중열','후열'][index]}`;
  const formationHint = () => state.team.length > 3 ? '전열 3명을 중심으로 공격을 받아요. 수호 용병을 전열에 배치해 보세요.' : '맨 앞 용병이 주로 공격을 받아요. 전열에는 수호 용병을 추천해요.';
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const portrait = (id, cls = '') => `<img class="${cls}" src="${Art.portrait(id)}" alt="${G.BY_ID[id].name}">`;
  const rarity = id => `<span class="rarity ${G.BY_ID[id].rarity}">${G.BY_ID[id].rarity}</span>`;
  const storage = { get(key, session = false) { try { return (session ? sessionStorage : localStorage).getItem(key); } catch { return null; } }, set(key, value, session = false) { try { (session ? sessionStorage : localStorage).setItem(key, value); return true; } catch { return false; } }, remove(key, session = false) { try { (session ? sessionStorage : localStorage).removeItem(key); } catch {} } };
  let state, mode = 'guest', profile = null, token = null, revision = 0, cloudClock = null, busy = false, pending = null, connected = true;
  let tab = 'lobby', filter = 'owned', selectedHero = null, modalKind = '', lastSeq = 0, effects = [], toastTimer, sdkPromise, loginGeneration = 0;
  let confirmedActivityScope = '', confirmedActivityResult = null, dismissedActivityResult = null, selectedTiers = { daily:1, weekly:1 }, selectedTowerFloor = null, selectedDungeon = 'daily';
  let selectedBanner = storage.get('school-pickup') === 'lava' ? 'lava' : 'osia';
  let preferences; try { preferences = JSON.parse(storage.get('school-settings') || '{}'); } catch { preferences = {}; }
  preferences ||= {};
  let sound = typeof preferences.sound === 'boolean' ? preferences.sound : storage.get('school-sound') === 'on', renderKey = '', dungeonRenderKey = '', partyKey = '', lastSave = 0, lastSync = 0;
  const CLOUD_CACHE = 'school-confirmed-cloud-view';
  let cachedPowerKey = '', cachedPower = 0;
  let guestQueue = Promise.resolve(), guestTickPending = false, guestSaveFailed = false, mutexDatabase;
  let cloudBalance = null, hasCloudState = false, hasGuestState = false, clientReady = false, verifiedToken = null, sessionFingerprint = null;
  let reduced = preferences.motion ? preferences.motion === 'reduced' : matchMedia('(prefers-reduced-motion: reduce)').matches;
  let theme = preferences.theme === 'dark' ? 'dark' : 'light', operation = '', completedActionKey = '', confirmedScope = '', confirmedSeq = 0, rankingMode = 'level', rankingGeneration = 0;
  const rankingCache = new Map();
  const Presentation = window.SchoolPresentation;
  Presentation?.configure({soundEnabled:()=>sound, reducedMotion:()=>reduced, heroInfo:id=>G.BY_ID[id], portrait:id=>portrait(id,'presentation-portrait')});
  try { token = JSON.parse(storage.get(SESSION) || storage.get(SESSION, true) || 'null')?.token || null; if (token) storage.set(SESSION, JSON.stringify({token})); } catch {}
  let social, trainingHold = null, trainClickUntil = 0, lastGuestTick = 0, lastImpactSound = 0;
  let repairBattle = () => false;
  let lobby = null, worldMap = null;
  const graphics = {frames:0, lastFrame:0, lastDraw:0, failures:0, lastError:'', losses:0, recoveries:0, lost:false};
  // A fixed ring keeps frame diagnostics cheap and excludes time in menus.
  const frameTimings = new Float64Array(300 * 4);
  let timingCount = 0, previousPaint = 0, previousAnimation = null;
  function recordFrameTiming(at, cost, animation) {
    const offset = (timingCount++ % 300) * 4;
    frameTimings[offset] = at;
    frameTimings[offset + 1] = previousPaint ? at - previousPaint : 0;
    frameTimings[offset + 2] = cost;
    frameTimings[offset + 3] = previousAnimation === null ? -1 : (animation - previousAnimation) * 1000;
    previousPaint = at; previousAnimation = animation;
  }
  function frameTimingReport() {
    const count = Math.min(300,timingCount), latest = count ? frameTimings[((timingCount-1)%300)*4] : 0;
    const gaps = [], costs = []; let stalled = 0, jumps = 0;
    for (let i=0;i<count;i++) {
      const offset=i*4; if (latest-frameTimings[offset]>5000) continue;
      const gap=frameTimings[offset+1], delta=frameTimings[offset+3];
      if (gap>0) { gaps.push(gap); if (delta>=0 && delta<.01) stalled++; if (delta>gap*(state?.speed||1)+50) jumps++; }
      costs.push(frameTimings[offset+2]);
    }
    const round=n=>Math.round(n*10)/10, sum=a=>a.reduce((n,v)=>n+v,0);
    const p95=a=>a.length ? [...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*.95))] : 0;
    return {samples:costs.length,fps:round(gaps.length?1000*gaps.length/sum(gaps):0),frameGapP95:round(p95(gaps)),maxFrameGap:round(gaps.length?Math.max(...gaps):0),drawMean:round(costs.length?sum(costs)/costs.length:0),drawP95:round(p95(costs)),stalledAnimationFrames:stalled,animationJumps:jumps,motionReduced:reduced};
  }
  function clearLogin() { token = null; verifiedToken = null; storage.remove(SESSION); storage.remove(SESSION, true); }
  function stopTraining() { if (trainingHold) { trainingHold.stopped = true; clearTimeout(trainingHold.timer); } trainingHold = null; }
  function beginTraining(event, id) {
    if (event.type === 'pointerdown' && (event.button !== 0 || !event.isPrimary)) return;
    if (busy || pending || $('train-hero')?.disabled) return;
    event.preventDefault(); stopTraining(); trainClickUntil = performance.now() + 700;
    const hold = trainingHold = {id,stopped:false,timer:null};
    const next = async first => {
      const u = state.units[id];
      if (hold.stopped || modalKind !== 'hero' || selectedHero !== id || !u || u.level >= G.MAX_LEVEL || state.gold < G.trainingCost(u) || document.hidden) return stopTraining();
      const before = u.level; await act({kind:'train',hero:id});
      if (hold.stopped || state.units[id].level === before || !connected || pending) return stopTraining();
      hold.timer = setTimeout(() => next(false), first ? 450 : 180);
    }; next(true);
  }
  async function logoutAccount() {
    if (busy || pending) return toast('진행 중인 저장을 먼저 확인해 주세요.');
    stopTraining(); busy = true;
    try { if (token) await request('/api/account/logout', {}, 'account'); } catch { /* Local logout remains available offline. */ }
    clearLogin(); profile = null; sessionFingerprint = null; hasCloudState = false; cloudBalance = null; cloudClock = null; clearPending();
    storage.remove(CLOUD_CACHE, true); storage.set(MODE, 'guest'); mode = 'guest'; connected = true; effects = [];
    Presentation?.cancel(); rankingCache.clear(); social?.destroy(); social = createSocial(); closeModal();
    try { await guestUpdate(); lastSeq = state.seq; renderKey = partyKey = ''; render(); note(''); toast('로그아웃했어요. 게스트 기록으로 돌아왔어요.'); }
    catch(error) { note(error.message); } finally { busy = false; renderButtons(); }
  }
  function createSocial() { return window.SchoolSocial?.create({request,getState:()=>state,getProfile:()=>profile,isCloud:()=>mode==='cloud' && connected && verifiedToken===token,dispatch:act,openModal,toast,refresh:()=>sync(true),openAccount:accountModal,openCaptain:captainModal}); }
  function damageModal() {
    const report = G.damageReport?.(state);
    const rows = report?.rows || []; const maximum = Math.max(1,...rows.map(r=>r.damage));
    openModal('전투 기여도', `<div class="damage-report"><p>현재 전투 · 실제 피해 / 회복 / 받은 피해</p>${rows.map(r=>`<div class="damage-row">${portrait(r.id)}<div><b>${esc(G.BY_ID[r.id].name)}</b><span class="damage-meter"><i style="width:${r.damage/maximum*100}%"></i></span><small>피해 ${fmt(r.damage)} · 회복 ${fmt(r.healing)} · 받은 피해 ${fmt(r.taken)}</small></div><strong>${fmt(r.dps)}<small>DPS</small></strong></div>`).join('') || '<p>전투가 시작되면 표시돼요.</p>'}</div>`, 'damage');
  }

  // A received server timestamp is a lower bound for the current server time.
  // Keep it moving between replies; a delayed snapshot must not rewind combat.
  const serverNow = () => mode === 'cloud' && cloudClock ? cloudClock.time + Math.max(0, performance.now() - cloudClock.at) : Date.now();
  const activityInfo = () => G.activityInfo ? G.activityInfo(state, serverNow()) : null;
  const activityActive = () => !!state?.activities?.run && !state.activities.run.settled;
  const activityAwaitingConfirmation = () => !!state?.activities?.run?.settled && String(confirmedActivityResult?.runId) !== String(state.activities.run.id);
  const activityTitle = kind => kind === 'daily' ? '방과 후 보급고' : kind === 'weekly' ? '봉인된 이사장실' : '뫼비우스의 복도';
  const activityLevel = value => value.kind === 'tower' ? `${fmt(value.floor)}층` : `${value.tier}단계`;
  const resetTime = value => new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false}).format(new Date(value));
  function rememberActivityResult(source) { const result = source?.activities?.lastResult, scope = accountScope(); if (!result) confirmedActivityResult = null; else if (scope !== confirmedActivityScope || !confirmedActivityResult || result.runId !== confirmedActivityResult.runId || result.kind !== confirmedActivityResult.kind) confirmedActivityResult = G.clone(result); confirmedActivityScope = scope; }
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3400); }
  function couponMessage(message, status = '') {
    $('coupon-message').textContent = message; $('coupon-message').dataset.state = status;
  }
  function note(message, retry = false) {
    $('connection').hidden = !message;
    $('connection').textContent = message || '';
    if (retry) { const b = document.createElement('button'); b.textContent = retry === 'reload' ? '새로고침' : '다시 연결'; b.onclick = () => retry === 'reload' ? location.reload() : sync(true); $('connection').append(b); }
  }
  function play(kind, stage = 4) { Presentation?.play(kind, stage); }
  const accountScope = () => `${mode}:${profile?.id || 'guest'}`;
  function confirmedEvents(source) {
    const scope = accountScope();
    if (!clientReady || confirmedScope !== scope) { confirmedScope = scope; confirmedSeq = source.seq || 0; return; }
    const fresh = (source.events || []).filter(e => e.seq > confirmedSeq);
    confirmedSeq = Math.max(confirmedSeq, source.seq || 0);
    for (const event of fresh) {
      if (event.kind === 'defeat' && event.boss && !document.hidden && serverNow() - event.at < 6000) Presentation?.defeat({key:`${scope}:defeat:${event.seq}`,description:'보스에게 패배했어요. 딜량을 확인하고 편성을 바꿔 보세요.'});
      if (event.kind === 'captain') Presentation?.captain({level:event.level, reward:30, key:`${scope}:captain:${event.seq}`});
      if (event.kind === 'clear') { toast(`${G.stageName(event.stage)} 클리어! 보석 +60`); play('reward'); }
    }
  }
  function applyPreferences(save = false) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
    document.querySelector('meta[name="theme-color"]').content = '#152334';
    if (save) {
      if (!storage.set('school-settings', JSON.stringify({theme,motion:reduced?'reduced':'full',sound}))) toast('설정을 저장하지 못했어요. 이 화면에서만 적용됩니다.');
      storage.set('school-sound', sound ? 'on' : 'off');
    }
    refreshSound(); Presentation?.refreshPreferences();
  }
  function settingsModal() {
    openModal('설정', `<div class="settings-list"><label class="setting-row" for="setting-theme"><span><b>다크 모드</b><small>눈이 편한 차분한 어두운 화면</small></span><input id="setting-theme" type="checkbox" role="switch" ${theme === 'dark' ? 'checked' : ''}></label><label class="setting-row" for="setting-sound"><span><b>효과음</b><small>전투·모집·성장 효과음</small></span><input id="setting-sound" type="checkbox" role="switch" ${sound ? 'checked' : ''}></label><label class="setting-row" for="setting-motion"><span><b>모션 줄이기</b><small>큰 움직임과 섬광을 간단하게</small></span><input id="setting-motion" type="checkbox" role="switch" ${reduced ? 'checked' : ''}></label></div><div class="settings-links"><button class="secondary" id="settings-help">${icon('book')} 게임 안내</button><button class="secondary" id="settings-rotate">${icon('fullscreen')} 전체 화면 · 상태바</button></div><div id="school-install-controls"></div><p class="settings-note">설정은 이 브라우저에 저장됩니다.</p>`, 'settings');
    window.SchoolInstall?.renderControls?.($('school-install-controls'));
    $('settings-help').onclick = help; $('settings-rotate').onclick = () => { closeModal(); attemptLandscape(); };
    const repairs = document.createElement('div'); repairs.className = 'settings-links';
    repairs.innerHTML = '<button class="secondary" id="settings-recover">전투 화면 복구</button><button class="secondary" id="settings-diagnostics">문제 정보</button>';
    $('school-install-controls').before(repairs);
    $('settings-recover').onclick = () => { closeModal(); setTab('adventure'); Presentation?.cancel(); repairBattle(true); };
    $('settings-diagnostics').onclick = diagnosticsModal;
  }
  function diagnosticsModal() {
    const canvas = $('battle'), box = canvas?.getBoundingClientRect(), script = document.querySelector('script[src*="school/client.js"]');
    const age = value => value ? Math.round(performance.now() - value) : null;
    const report = {
      version:script ? new URL(script.src).searchParams.get('v') : 'unknown', browser:navigator.userAgent,
      viewport:[innerWidth,innerHeight,devicePixelRatio], canvas:canvas ? [canvas.width,canvas.height,Math.round(box.width),Math.round(box.height)] : null,
      app:matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches, hidden:document.hidden,
      account:{mode,connected,busy,pending:!!pending}, battle:state ? {stage:state.stage,wave:state.wave,phase:state.battle.phase,elapsed:state.battle.elapsed,simTime:state.simTime,cutin:state.battle.cinematic?.remaining || 0} : null,
      graphics:{...graphics,lastFrame:age(graphics.lastFrame),lastDraw:age(graphics.lastDraw),modal:modalKind,view:tab,covered:tab !== 'adventure' || resultPresentationBusy() || $('modal').open || !$('rotate-prompt').hidden},
      timing:frameTimingReport(),
      support:{findLast:typeof Array.prototype.findLast==='function',abortTimeout:typeof window.AbortSignal?.timeout==='function',contextLost:typeof canvas?.getContext('2d')?.isContextLost==='function'}
    };
    openModal('문제 정보', `<p class="modal-copy">멈춤이 반복되면 아래 정보를 복사해서 알려주세요. 로그인 토큰과 계정 이름은 포함하지 않아요.</p><textarea id="diagnostic-report" class="diagnostic-report" readonly aria-label="게임 문제 정보">${esc(JSON.stringify(report,null,2))}</textarea><button class="primary" id="copy-diagnostics">문제 정보 복사</button>`, 'diagnostics');
    $('copy-diagnostics').onclick = async () => {
      const input = $('diagnostic-report');
      try { await navigator.clipboard.writeText(input.value); toast('문제 정보를 복사했어요.'); }
      catch { input.focus(); input.select(); toast('선택된 내용을 길게 눌러 복사해 주세요.'); }
    };
  }
  function showBoot(message) { $('boot-message').textContent = message; }
  function finishBoot() { $('boot-screen').hidden = true; updateOrientation(); }
  function updateOrientation() {
    const portrait = matchMedia('(orientation:portrait) and (max-width:1000px)').matches;
    const show = portrait && !storage.get('school-landscape-ack', true) && $('boot-screen').hidden;
    $('rotate-prompt').hidden = !show; $('app').inert = show;
    if (!portrait) $('board-viewport').scrollLeft = 0;
  }
  function dismissRotation() { storage.set('school-landscape-ack', '1', true); $('rotate-prompt').hidden = true; $('app').inert = false; }
  function refreshFullscreen() {
    const button = $('fullscreen-button'); if (!button) return;
    const active = !!document.fullscreenElement;
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? '전체 화면 종료' : '전체 화면 · 상태바 숨기기');
    button.title = active ? '전체 화면 종료' : '전체 화면 · 상태바 숨기기';
  }
  async function attemptLandscape() {
    dismissRotation();
    let message = '';
    if (!document.fullscreenElement) {
      if (!document.documentElement.requestFullscreen) message = '이 브라우저는 전체 화면을 지원하지 않아요. Android에서는 Chrome으로 게임을 직접 열어주세요.';
      else try {
        // Must run from the user's tap. Ask the browser to hide Android's
        // navigation UI as well as its toolbar; CSS cannot hide OS system bars.
        await document.documentElement.requestFullscreen({navigationUI:'hide'});
      } catch { message = '전체 화면 전환이 차단됐어요. Chrome에서 게임을 직접 열고 다시 눌러주세요.'; }
    }
    try { if (screen.orientation?.lock) await screen.orientation.lock('landscape'); }
    catch { /* Rotation can be unavailable even after fullscreen succeeds. */ }
    refreshFullscreen(); updateOrientation();
    if (message) toast(message);
    else if (matchMedia('(orientation:portrait)').matches) toast('휴대폰을 가로로 돌려주세요. 전체 화면에서도 직접 회전할 수 있어요.');
  }
  async function toggleFullscreen() {
    if (!document.fullscreenElement) return attemptLandscape();
    try { await document.exitFullscreen(); }
    catch { toast('전체 화면을 종료하지 못했어요. 기기의 뒤로가기 또는 Esc를 눌러주세요.'); }
    refreshFullscreen(); updateOrientation();
  }
  function boardJump(where) {
    const viewport = $('board-viewport');
    viewport.scrollTo({left:where === 'party' ? viewport.scrollWidth - viewport.clientWidth : 0, behavior:reduced?'auto':'smooth'});
  }
  const yieldForPaint = () => document.hidden ? Promise.resolve() : new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  function refreshSound() { $('sound-button').classList.toggle('muted', !sound); $('sound-button').setAttribute('aria-label', `효과음 ${sound ? '끄기' : '켜기'}`); $('sound-button').setAttribute('aria-pressed', String(sound)); }
  function freshGuest() { return G.create(Date.now(), crypto.getRandomValues(new Uint32Array(1))[0]); }
  function saveStatus(status, message) {
    const el = $('save-status'); if (!el) return;
    setAttr(el, 'data-state', status); setText(el, message); setAttr(el, 'title', message);
  }
  function validSave(raw) {
    if (!raw) return null;
    try { const parsed = JSON.parse(raw); return G.validate(parsed) ? parsed : null; } catch { return null; }
  }
  function readGuestRecord() {
    let raw;
    try { raw = localStorage.getItem(SAVE); } catch { throw Error('기기 저장을 읽을 수 없습니다. 브라우저의 저장 허용을 확인하세요.'); }
    if (raw) {
      const saved = validSave(raw); if (saved) return { saved, raw };
      // Preserve the broken original. Never replace it with a fresh account.
      if (!storage.get(SAVE + '-recovery')) storage.set(SAVE + '-recovery', raw);
      const backup = validSave(storage.get(SAVE + '-backup'));
      if (backup) return { saved: backup, raw, recovered: true };
      throw Error('기기 저장을 읽지 못했습니다. 원본은 보관했습니다. 계정 메뉴에서 계정 기록을 불러올 수 있습니다.');
    }
    for (const key of LEGACY_SAVES) {
      const legacy = storage.get(key); if (!legacy) continue;
      const saved = validSave(legacy);
      if (saved) return { saved, raw: null, legacyKey: key, legacyRaw: legacy };
      if (!storage.get(SAVE + '-recovery')) storage.set(SAVE + '-recovery', legacy);
      throw Error('이전 기기 저장을 읽지 못했습니다. 원본을 유지했습니다. 계정 메뉴에서 저장을 확인하세요.');
    }
    return { saved: freshGuest(), raw: null };
  }
  function readGuest() { return readGuestRecord().saved; }
  function writeGuest(next, previousRaw, previousValid, coordinator) {
    if (JSON.stringify(next) === previousRaw) return;
    next._saveRevision = (Number.isSafeInteger(next._saveRevision) ? next._saveRevision : 0) + 1;
    next._saveCommit = Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('');
    const committed = JSON.stringify(next), journalKey = !coordinator.prior || coordinator.identity !== coordinator.prior.identity ? SAVE + '-journal:' + next._saveCommit : null;
    const journal = {before:coordinator.rollbackRaw, beforeBackup:journalKey ? storage.get(SAVE + '-backup') : null, after:committed, priorCommit:coordinator.prior?.commitId || null};
    coordinator.staged = {raw:committed, journalKey, journal};
    // The write-ahead record survives a page/transaction abort between the two
    // storage systems. A unique key cannot erase another tab's in-flight log.
    if (journalKey && !storage.set(journalKey, JSON.stringify(journal))) throw Error('안전한 자동 저장을 준비하지 못했습니다. 재화는 사용하지 않았습니다.');
    if (previousValid) storage.set(SAVE + '-backup', previousRaw);
    if (!storage.set(SAVE, committed)) throw Error('자동 저장에 실패했습니다. 재화는 사용하지 않았습니다. 저장 공간·브라우저 설정을 확인한 뒤 다시 눌러주세요.');
    storage.set(SAVE + '-backup', committed);
  }
  function guestLock(update) {
    // Web Locks alone does not flush another renderer's localStorage cache.
    // Both browser paths therefore use the same transactional committed head.
    mutexDatabase ||= new Promise((resolve, reject) => {
      let request;
      try { request = indexedDB.open('school-save-coordination', 1); }
      catch { reject(Error('안전한 기기 저장을 열지 못했습니다. 기존 기록은 유지됩니다.')); return; }
      request.onupgradeneeded = () => request.result.createObjectStore('locks');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(Error('안전한 기기 저장을 열지 못했습니다. 브라우저 저장 설정을 확인하세요.'));
    }).catch(error => { mutexDatabase = null; throw error; });
    const locked = () => mutexDatabase.then(db => new Promise((resolve, reject) => {
      const tx = db.transaction('locks', 'readwrite'), store = tx.objectStore('locks');
      let result, failure, coordinator, recoveredJournalKey;
      const read = store.get('guest');
      read.onsuccess = () => {
        try {
          const prior = read.result?.raw && validSave(read.result.raw) ? read.result : null;
          let record = readGuestRecord();
          const journalKey = record.saved._saveCommit && SAVE + '-journal:' + record.saved._saveCommit;
          const rawJournal = journalKey && (!prior || record.saved._saveIdentity !== prior.identity) && storage.get(journalKey);
          if (!record.recovered && rawJournal) {
            const journal = JSON.parse(rawJournal);
            if (journal.after === record.raw && prior?.commitId !== record.saved._saveCommit) {
              recoveredJournalKey = journalKey;
              // A prior local mirror never reached the IndexedDB commit.
              const before = (prior?.commitId || null) === journal.priorCommit ? journal.before : prior?.raw;
              if (before === null) {
                storage.remove(SAVE);
                if (storage.get(SAVE) !== null) throw Error('중단된 저장을 복구하지 못했습니다. 원본 기록을 유지합니다.');
                record = readGuestRecord();
              } else {
                const saved = validSave(before);
                if (!saved) throw Error('중단된 저장을 확인하지 못했습니다. 원본 기록을 유지합니다.');
                record = {saved, raw:before};
              }
            }
          }
          const committed = prior && validSave(prior.raw), sameIdentity = committed && record.saved._saveIdentity === prior.identity;
          // An explicit reset/seed can retain metadata but replace the contents
          // of the exact same revision. It must not resurrect the old game.
          const replaced = sameIdentity && record.saved._saveRevision >= committed._saveRevision && record.raw !== prior.raw && record.saved._saveCommit === prior.commitId;
          const sameLegacy = prior && !record.saved._saveIdentity && record.raw === prior.initialRaw &&
            (record.legacyKey || null) === (prior.initialLegacyKey || null) &&
            (record.legacyRaw || null) === (prior.initialLegacyRaw || null);
          const useCommitted = !record.recovered && !replaced && (sameIdentity || sameLegacy);
          if (useCommitted) record = {saved:committed, raw:prior.raw};
          const identity = useCommitted ? prior.identity : Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('');
          coordinator = {prior, identity, initialRaw:useCommitted ? prior.initialRaw : record.raw,
            initialLegacyKey:useCommitted ? prior.initialLegacyKey : record.legacyKey,
            initialLegacyRaw:useCommitted ? prior.initialLegacyRaw : record.legacyRaw,
            rollbackRaw:record.raw && !record.recovered ? record.raw : JSON.stringify(record.saved)};
          result = update(record, coordinator);
          if (coordinator.staged) store.put({raw:coordinator.staged.raw, identity, initialRaw:coordinator.initialRaw,
            initialLegacyKey:coordinator.initialLegacyKey, initialLegacyRaw:coordinator.initialLegacyRaw, commitId:result.next._saveCommit}, 'guest');
          else if (useCommitted && storage.get(SAVE) !== prior.raw) {
            // Mirror repair is not a new purchase or a new revision.
            if (!storage.set(SAVE, prior.raw)) throw Error('기기 저장 표시를 동기화하지 못했습니다. 기존 기록은 유지됩니다.');
          }
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => {
        if (coordinator?.staged?.journalKey) storage.remove(coordinator.staged.journalKey);
        if (recoveredJournalKey) storage.remove(recoveredJournalKey);
        resolve(result);
      };
      tx.onabort = () => {
        const error = failure || Error('기기 저장을 잠시 사용할 수 없습니다. 재화는 사용하지 않았습니다.');
        if (!coordinator?.staged) { reject(error); return; }
        // Obtain a new exclusive transaction before compensation. A later
        // successful tab may already have committed; never overwrite its head.
        try {
          const repair = db.transaction('locks', 'readwrite'), request = repair.objectStore('locks').get('guest');
          request.onsuccess = () => {
            const latest = request.result, stage = coordinator.staged;
            if (storage.get(SAVE) === stage.raw) {
              const raw = (latest?.commitId || null) === (coordinator.prior?.commitId || null) ? stage.journal.before : latest?.raw;
              if (raw && validSave(raw) && storage.set(SAVE, raw)) { storage.set(SAVE + '-backup', raw); if (stage.journalKey) storage.remove(stage.journalKey); }
              else if (raw === null) {
                storage.remove(SAVE);
                if (storage.get(SAVE) === null) {
                  if (stage.journal.beforeBackup) storage.set(SAVE + '-backup', stage.journal.beforeBackup); else storage.remove(SAVE + '-backup');
                  if (stage.journalKey) storage.remove(stage.journalKey);
                }
              }
              // If compensation itself is unavailable, retain its journal.
            } else if (stage.journalKey) storage.remove(stage.journalKey);
          };
          repair.oncomplete = repair.onabort = () => reject(error);
          repair.onerror = () => {};
        } catch { reject(error); }
      };
      tx.onerror = () => {};
    }));
    // Preserve the existing outer lock for already-open clients while all new
    // clients also share the IndexedDB head (including locks-less browsers).
    return navigator.locks ? navigator.locks.request('school-guest-save', locked) : locked();
  }
  function guestUpdate(input) {
    const update = (record, coordinator) => {
      if (mode !== 'guest') return;
      let next = G.clone(record.saved); next._saveIdentity = coordinator.identity;
      G.advance(next, Date.now());
      let result = null, actionError;
      if (input) {
        const candidate = G.clone(next);
        try { result = G.action(candidate, input); next = candidate; }
        catch (error) { error.guestAction = true; actionError = error; }
      }
      writeGuest(next, record.raw, !!record.raw && !record.recovered, coordinator);
      return {next, result, actionError, recovered:record.recovered};
    };
    const task = guestQueue.then(() => guestLock(update)).then(committed => {
      if (!committed || mode !== 'guest') return;
      const {next, result, actionError, recovered} = committed, recoveredWrite = guestSaveFailed;
      // Publish only after the exclusive transaction confirms the save.
      rememberActivityResult(next); confirmedEvents(next); state = next; hasGuestState = true; guestSaveFailed = false; lastSave = Date.now();
      saveStatus('saved', '기기 저장 완료');
      if (recovered) note('자동 저장 사본에서 기록을 복구했습니다.');
      else if (recoveredWrite) note('');
      consumeEvents(); if (clientReady) render(); if (actionError) throw actionError; return result;
    });
    guestQueue = task.catch(() => {});
    return task.catch(error => {
      if (!error.guestAction) { guestSaveFailed = true; lastSave = Date.now(); saveStatus('error', '저장 확인 필요'); note(error.message); }
      throw error;
    });
  }
  function advanceCloudPreview() {
    if (!hasCloudState) return;
    G.advance(state, serverNow());
    // Combat may be predicted, but unconfirmed currency must never look spendable.
    state.gold = cloudBalance.gold; state.gems = cloudBalance.gems;
    if (cloudBalance.winter) state.winter = G.clone(cloudBalance.winter); else delete state.winter;
  }
  async function tokenFingerprint(value) {
    if (!value) return null;
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  async function request(path, data, auth = 'school') {
    let response;
    const payload = path.startsWith('/api/school/') ? { ...data, catalogVersion: G.CATALOG_VERSION } : data || {};
    // Older Android browsers support AbortController but not AbortSignal.timeout.
    // Keep the deadline active while reading the response body as well.
    const controller = new AbortController(), deadline = setTimeout(() => controller.abort(), 14000);
    try {
      try {
        response = await fetch(BASE + path, { method: path.endsWith('/config') ? 'GET' : 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(token && auth !== 'public' ? auth === 'school' ? { 'X-Account-Session': token } : { Authorization: `Bearer ${token}` } : {}) }, ...(path.endsWith('/config') ? {} : { body: JSON.stringify(payload) }), signal: controller.signal });
      } catch { throw Error('저장 서버에 연결하지 못했습니다. 연결 후 다시 시도하세요.'); }
      let body; try { body = await response.json(); } catch { throw Error('저장 서버의 응답을 읽지 못했습니다.'); }
      if (!response.ok && !body.conflict) throw Object.assign(Error(body.error || '요청을 처리하지 못했습니다.'), { status: response.status });
      return body;
    } finally { clearTimeout(deadline); }
  }
  function applyCloud(body) {
    const at = performance.now();
    cloudClock = {time:Math.max(body.serverTime, cloudClock ? cloudClock.time + Math.max(0, at - cloudClock.at) : body.serverTime), at};
    rememberActivityResult(body.state); confirmedEvents(body.state);
    state = body.state; revision = body.revision; connected = true; hasCloudState = true;
    cloudBalance = { gold: state.gold, gems: state.gems, winter: state.winter ? G.clone(state.winter) : null };
    storage.set(CLOUD_CACHE, JSON.stringify({profile, state, revision, serverTime:body.serverTime, sessionFingerprint}), true);
    document.querySelector('.workspace').style.visibility = '';
    advanceCloudPreview(); consumeEvents(); render(); note(''); saveStatus('saved', '계정 저장 완료');
  }
  function clearPending() { pending = null; storage.remove(PENDING, true); }
  async function sendPending() {
    if (!token || verifiedToken !== token || !profile || pending?.accountId !== profile.id) throw Object.assign(Error('계정 연결을 다시 확인한 뒤 요청을 이어갑니다.'), {status:401});
    const actionKey = pending.requestId;
    const body = await request('/api/school/action', pending);
    if (body.conflict) {
      // An expired receipt can belong to an already committed action. Changing
      // its revision would turn a lost response into a second purchase.
      applyCloud(body); clearPending();
      throw Object.assign(Error('다른 기기 진행을 불러왔어요. 보유 재화와 결과를 확인한 뒤 다시 눌러주세요.'), {confirmedConflict:true});
    }
    clearPending(); applyCloud(body); completedActionKey = actionKey; return body.result;
  }
  async function sync(manual = false) {
    if (mode !== 'cloud' || busy || (!manual && document.hidden)) return;
    if (!profile || verifiedToken !== token) return useCloud();
    const checkingCoupon = pending?.action.kind === 'redeem';
    busy = true; renderButtons(); saveStatus('saving', '계정 저장 중');
    try {
      if (pending) { const result = await sendPending(); await showResult(result); }
      else applyCloud(await request('/api/school/state'));
      lastSync = Date.now();
    } catch (error) {
      if (error.confirmedConflict) { if (checkingCoupon) couponMessage(error.message, 'error'); toast(error.message); return; }
      connected = false;
      saveStatus('error', '계정 연결 대기');
      if (error.status === 401) { clearLogin(); }
      if (error.status && error.status < 500 && ![409, 426].includes(error.status)) clearPending();
      if (checkingCoupon) couponMessage(pending ? '보상 저장을 확인 중입니다. 연결되면 같은 요청을 이어 확인합니다.' : error.message, pending ? 'pending' : 'error');
      note(error.status === 426 ? error.message : error.status === 401 ? '로그인이 만료되었습니다. 계정 메뉴에서 다시 연결하세요.' : '계정 저장 연결을 기다리고 있어요. 재화 사용은 연결 후 계속됩니다.', error.status === 426 ? 'reload' : true);
      if (manual) toast(error.message);
    } finally { busy = false; renderButtons(); }
  }
  async function act(input) {
    if (busy || pending) { toast('이전 요청을 확인하고 있어요. 잠시 기다려주세요.'); return; }
    if (mode === 'cloud' && (!connected || verifiedToken !== token)) { sync(true); return; }
    busy = true; operation = input.kind; completedActionKey = crypto.randomUUID(); renderButtons(); saveStatus('saving', mode === 'cloud' ? '계정 저장 중' : '기기 저장 중');
    try {
      await yieldForPaint();
      let result;
      if (mode === 'cloud') {
        pending = { action: input, revision, requestId: crypto.randomUUID().replaceAll('-', ''), accountId: profile.id };
        if (!storage.set(PENDING, JSON.stringify(pending), true)) { pending = null; throw Error('이 브라우저는 안전한 요청 저장을 지원하지 않습니다. 일반 브라우저에서 다시 시도하세요.'); }
        result = await sendPending(); lastSync = Date.now();
      } else result = await guestUpdate(input);
      await showResult(result);
    } catch (error) {
      if (error.confirmedConflict) { if (input.kind === 'redeem') couponMessage(error.message, 'error'); toast(error.message); return; }
      if (error.status && error.status < 500 && ![409, 426].includes(error.status)) clearPending();
      if (input.kind === 'redeem') couponMessage(pending ? '보상 저장을 확인 중입니다. 연결되면 같은 요청을 이어 확인합니다.' : error.message, pending ? 'pending' : 'error');
      if (mode === 'cloud' && pending) { connected = false; saveStatus('error', '저장 결과 확인 중'); note(error.status === 426 ? error.message : '요청 결과를 확인 중입니다. 재연결 후 같은 요청을 안전하게 확인합니다.', error.status === 426 ? 'reload' : true); }
      else if (mode === 'cloud' && error.status && error.status < 500 && error.status !== 401) {
        try { applyCloud(await request('/api/school/state')); lastSync = Date.now(); }
        catch { connected = false; saveStatus('error', '계정 연결 대기'); note('계정의 최신 비용과 재화를 확인하지 못했습니다. 다시 연결해 주세요.', true); }
      }
      else if (mode === 'cloud') { connected = false; saveStatus('error', '계정 연결 대기'); note(error.message, true); }
      toast(error.message);
    } finally { busy = false; operation = ''; renderButtons(); }
  }
  async function showResult(result) {
    if (!result) return;
    if (result.kind === 'recruit') { closeModal(); operation = ''; renderButtons(); const shown = await Presentation?.recruit({results:result.results,key:`${accountScope()}:recruit:${completedActionKey}`}); if (!shown?.cancelled) reveal(result.results); }
    else if (result.kind === 'redeem') {
      const message = `${result.code} · 보석 +${fmt(result.gems)} · 코인 +${fmt(result.gold)} 수령 완료!`;
      $('coupon-code').value = ''; couponMessage(message, 'success'); toast(message); play('reward');
    }
    else if (result.kind === 'train') { if (!trainingHold) toast(`${G.BY_ID[result.hero].name} Lv.${result.level}!`); renderButtons(); play('level'); }
    else if (result.kind === 'awaken') { closeModal(); operation = ''; renderButtons(); const shown = await Presentation?.awaken({hero:result.hero,stars:result.stars,key:`${accountScope()}:awaken:${completedActionKey}`}); if (!shown?.cancelled) { toast(`${G.BY_ID[result.hero].name} ${result.stars}성 각성!`); heroDetail(result.hero); } }
    else if (result.kind === 'winter-exchange') { play('reward'); social?.refresh(); }
    else if (result.kind === 'rename') { rankingCache.clear(); toast('단장 이름을 저장했어요.'); captainModal(); }
    else if (result.kind === 'team') { closeModal(); toast(`새 편성으로 출발합니다. ${formationHint()}`); }
    else if (result.kind === 'activity') { closeModal(); setTab('adventure'); toast('던전에 입장했어요. 전투가 끝나면 결과를 확인하세요.'); }
    else if (result.kind === 'activity-exit') { closeModal(); setTab('adventure'); toast(result.result?.refunded ? '입장 열쇠를 돌려받고 모험으로 돌아왔어요.' : '모험으로 돌아왔어요.'); }
    else if (result.kind === 'speed') { toast(`전투 속도 ${result.speed.toFixed(1)}×`); }
    else if (result.kind === 'stage') { closeModal(); setTab('adventure'); toast('선택한 지역으로 출발합니다.'); }
    else if (result.kind === 'offline') { toast(`골드 +${fmt(result.reward.gold)} · 용병마다 경험치 +${fmt(result.reward.xp)}`); play('reward'); if (modalKind === 'offline') closeModal(); }
    else { toast(`골드 +${fmt(result.gold)} · 보석 +${fmt(result.gems)}`); play('reward'); }
    render();
  }
  function animationTime() {
    const running = mode === 'cloud' ? hasCloudState && connected : hasGuestState && !guestSaveFailed;
    const wall = serverNow();
    const fraction = running ? Math.min(500, Math.max(0, wall - state.at)) : 0;
    return ((state.simTime || 0) + (state.simCredit || 0) + fraction * (state.speed || 1)) / 1000;
  }
  function consumeEvents() {
    const now = animationTime();
    const events = state.events.filter(e => e.seq > lastSeq); lastSeq = state.seq;
    if (events.some(e => e.kind === 'offline')) effects = [];
    for (const e of events) {
      const eventTime = e.simAt == null ? now : e.simAt / 1000, age = Math.max(0, now - eventTime);
      if (age < 3.1 && e.kind !== 'offline') effects.push({ ...e, time: eventTime });
      if (e.kind === 'hit' && age < .5 && performance.now() - lastImpactSound > 90) { play(e.critical ? 'critical' : 'hit'); lastImpactSound = performance.now(); }
      if (e.kind === 'skill-impact' && age < .5 && e.battleId === state.battle.id) play('water', e.stage);
    }
    effects = effects.filter(e => now - e.time < 3.1 && (!e.battleId || e.battleId === state.battle.id)).slice(-90);
    const cast = state.battle.osiaCast;
    if (cast && !effects.some(e => e.kind === 'skill-stage' && e.castId === cast.id)) {
      const part = G.OSIA_SKILLS[cast.stage - 1];
      const elapsed = state.battle.elapsed - cast.began + ((cast.cinematicDuration || 0) - (state.battle.cinematic?.remaining || 0));
      const began = cast.simBegan ?? Math.max(0, (state.simTime || 0) - elapsed);
      effects.push({kind:'skill-stage',from:'osia',castId:cast.id,battleId:state.battle.id,...part,cinematicDuration:cast.cinematicDuration || 0,targets:cast.targets.map(t=>t.id),time:began/1000});
      if (state.battle.cinematic && !effects.some(e => e.kind === 'cinematic' && e.castId === cast.id))
        effects.push({kind:'cinematic',from:'osia',castId:cast.id,battleId:state.battle.id,duration:cast.cinematicDuration || G.OSIA_CINEMATIC_MS,time:began/1000});
    }
  }
  function setTab(next, repaint = true) {
    if (!['lobby', 'adventure', 'roster', 'dungeons', 'recruit', 'supplies'].includes(next)) return;
    stopTraining();
    tab = next; $('app').dataset.tab = tab;
    setHidden($('lobby-panel'), tab !== 'lobby');
    setHidden(document.querySelector('.battle-panel'), tab !== 'adventure');
    setHidden(document.querySelector('.party-panel'), tab !== 'adventure');
    setHidden(document.querySelector('.content-panel'), tab === 'lobby' || tab === 'adventure');
    for (const name of ['adventure', 'roster', 'dungeons', 'recruit', 'supplies']) $('tab-' + name).hidden = name !== tab;
    document.querySelectorAll('.bottom-nav>button').forEach(b => { const active = b.dataset.tab === tab || (tab === 'roster' && b.dataset.lobbyAction === 'codex') || (tab === 'adventure' && b.dataset.lobbyAction === 'map'); b.classList.toggle('active', active); if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.querySelector('.content-panel').scrollTop = 0; document.querySelector('.workspace').scrollTop = 0; renderKey = dungeonRenderKey = ''; if (repaint) render(); if (tab === 'lobby') $('board-viewport').scrollLeft = 0; else boardJump(tab === 'adventure' ? 'battle' : 'party');
  }
  function lobbyAction(action) {
    if (action === 'resume') {
      if (state.activities?.run?.settled) {
        if (confirmedActivityResult && !activityAwaitingConfirmation()) return showActivityResult(confirmedActivityResult);
        setTab('dungeons'); toast('던전 결과 저장을 확인하고 있어요.'); return;
      }
      setTab('adventure'); return;
    }
    if (action === 'map') return stageMap();
    if (action === 'ranking') return rankingModal('level');
    if (action === 'help') return help();
    if (action === 'codex') {
      filter = 'all';
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
      setTab('roster'); return;
    }
    if (action === 'quests') {
      setTab('supplies');
      $('quests').scrollIntoView({block:'start',behavior:'instant'}); return;
    }
    if (['recruit','supplies','dungeons'].includes(action)) setTab(action);
  }
  function panelContentKey() {
    const day = G.day(serverNow());
    if (tab === 'roster') return [tab, filter, state.team.join(','), ...Object.entries(state.units).map(([id,u]) => `${id}:${u.level}:${u.stars}`)].join('|');
    if (tab === 'recruit') { const banner = G.bannerState(state, selectedBanner); return [tab, selectedBanner, banner.pity, banner.guaranteed, G.bannerAvailable(selectedBanner, serverNow())].join('|'); }
    if (tab === 'dungeons') return tab;
    const quests = G.QUESTS.map(q => G.questValue(state,q)).join(',');
    if (tab === 'supplies') return [tab, state.best, state.stage, state.mode, state.offline.seconds, state.offline.gold, state.offline.xp, state.offline.captainXp, state.daily, day, state.claimed.join(','), quests].join('|');
    return [tab, state.best, state.stage, state.claimed.join(','), quests].join('|');
  }
  function dungeonContentKey() {
    const a = state.activities || {}, run = a.run;
    return [accountScope(),run?.kind,run?.tier,run?.floor,a.daily?.period,a.daily?.used,a.weekly?.period,a.weekly?.used,a.towerBest,run?.id,run?.settled,confirmedActivityResult?.runId,state.best,G.day(serverNow()),selectedTiers.daily,selectedTiers.weekly,selectedTowerFloor,selectedDungeon].join('|');
  }
  function render() {
    if (!state) return;
    lobby?.render(state, serverNow());
    setText($('gold'), fmt(state.gold)); setText($('gems'), fmt(state.gems));
    setText($('captain-level'), `Lv.${state.captain.level}`);
    setText($('captain-name-label'), state.commanderName === '새내기 단장' ? '이름 정하기' : state.commanderName || '단장');
    setAttr($('captain-button'), 'aria-label', `${state.commanderName || '단장'} Lv.${state.captain.level} · 이름과 랭킹`);
    setWidth($('captain-xp'), `${state.captain.level >= G.CAPTAIN_MAX_LEVEL ? 100 : state.captain.xp / G.captainNeed(state.captain.level) * 100}%`);
    setText($('account-label'), mode === 'cloud' ? '계정 저장' : '게스트'); toggleClass($('account-button'), 'cloud', mode === 'cloud');
    const activity = state.battle.activity;
    setText('stage-number', activity ? `${activityLevel(activity)}${state.activities?.run?.settled && !activityAwaitingConfirmation() ? ' · 결과 보기' : ''}` : G.stageName(state.battle.stage));
    setText('stage-name', activity ? activityTitle(activity.kind) : G.CHAPTERS[G.chapter(state.battle.stage)]);
    const elapsedSeconds = Math.floor(Math.max(0, state.battle.elapsed || 0) / 1000);
    setText('battle-clock', `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`);
    setHidden(document.querySelector('.battle-mode-controls'), !!activity);
    setText($('battle-map').querySelector('span'), activity ? state.activities?.run?.settled ? '결과' : '던전' : '지도');
    setText('wave-label', activity ? activity.kind === 'tower' ? `CORRIDOR · ${fmt(activity.floor)}F` : `BOSS · ${activityLevel(activity)}` : state.battle.boss ? 'BOSS · ' + G.BOSSES[G.chapter(state.battle.stage)] : `WAVE ${state.battle.wave} / 4`);
    toggleClass($('wave-label'), 'boss', !!state.battle.boss);
    renderBossHUD(); social?.refresh();
    const synergy = G.partySynergies?.(state); const synergyText = synergy?.active.map(x=>x.name).join(' · ');
    if ($('party-count')) $('party-count').title = synergyText || '같은 역할 3명 편성 시 파티 보너스';
    if ($('party-synergies')) setText('party-synergies', synergyText || '수호·딜러·치유 3명 → 파티 보너스');
    const powerKey = state.team.map(id => `${id}:${state.units[id].level}:${state.units[id].stars}`).join('|');
    if (powerKey !== cachedPowerKey) { cachedPowerKey = powerKey; cachedPower = G.power(state); }
    setText('power', `전투력 ${fmt(cachedPower)}`);
    let battleStatus = activity ? state.activities?.run?.settled ? activityAwaitingConfirmation() ? '결과 저장 확인 중…' : '전투 종료 · 위 지역 이름을 눌러 결과 확인' : '던전 도전 중' : state.mode === 'farm' ? '반복 사냥' : state.battle.phase === 'defeat' ? '재도전 준비' : '자동 전투';
    const osia = state.battle.heroes.find(h => h.id === 'osia' && h.hp > 0);
    if (osia && state.battle.phase === 'fight') {
      const cast = state.battle.osiaCast, next = G.osiaSkill(state);
      battleStatus = cast ? `오시아 스킬 ${cast.stage}/4 · ${G.OSIA_SKILLS[cast.stage-1].name} 시전 중` : `오시아 다음 ${next.stage}/4 · ${next.name} · 충전 ${Math.max(0, G.BY_ID.osia.cooldown - osia.energy)}초`;
    }
    setText('battle-status', battleStatus);
    const pk = state.team.join('|');
    setText($('party-count'), `${state.team.length} / ${maxTeam()}`);
    if (pk !== partyKey) {
      partyKey = pk;
      $('party').innerHTML = Array.from({length:maxTeam()}, (_, i) => {
        const id = state.team[i];
        return id ? `<button class="party-card" data-hero="${id}" data-rarity="${G.BY_ID[id].rarity}" aria-label="${G.BY_ID[id].name} 육성·교체">${portrait(id)}<span class="party-cooldown" aria-hidden="true"></span><span class="party-skill" aria-hidden="true"></span><span class="party-shield" hidden></span><span class="party-info"><b>${G.BY_ID[id].name}</b><small></small><span class="party-hp" role="progressbar" aria-label="${G.BY_ID[id].name} 체력" aria-valuemin="0" aria-valuemax="100"><i></i></span></span><span class="party-energy" role="progressbar" aria-label="${G.BY_ID[id].name} 스킬 충전" aria-valuemin="0" aria-valuemax="100"><i></i></span></button>` : `<button class="party-card empty" data-tab="roster" aria-label="${i + 1}번 빈자리, 출전 용병 추가"><span class="empty-slot-mark" aria-hidden="true">+</span><span class="party-info"><b>빈자리</b><small>용병 추가</small></span></button>`;
      }).join('');
    }
    document.querySelectorAll('.party-card[data-hero]').forEach(el => {
      const id = el.dataset.hero, h = state.battle.heroes.find(h => h.id === id), u = state.units[id], def = G.BY_ID[id];
      const fallen = !!h && h.hp <= 0, casting = id === 'osia' && !!state.battle.osiaCast && !fallen;
      const hp = h ? Math.max(0, Math.min(100, h.hp / h.max * 100)) : 100;
      const energy = h && !fallen ? Math.max(0, Math.min(100, h.energy / def.cooldown * 100)) : 0;
      const seconds = Math.ceil(Math.max(0, def.cooldown - (h?.energy || 0)));
      const next = id === 'osia' ? G.osiaSkill(state) : id === 'lava' ? G.lavaSkill(state) : null;
      const step = casting ? state.battle.osiaCast.stage : next?.stage;
      const skill = casting ? G.OSIA_SKILLS[step - 1].name : next?.name || def.skill;
      const charge = fallen ? '✕' : !h || state.battle.phase !== 'fight' ? '대기' : casting ? '시전' : seconds ? String(seconds) : '준비';
      setText(el.querySelector('small'), `Lv.${u.level} · ${def.role}`);
      setWidth(el.querySelector('.party-hp i'), `${hp}%`); setAttr(el.querySelector('.party-hp'), 'aria-valuenow', String(Math.round(hp)));
      setWidth(el.querySelector('.party-energy i'), `${energy}%`); setAttr(el.querySelector('.party-energy'), 'aria-valuenow', String(Math.round(energy)));
      setText(el.querySelector('.party-cooldown'), charge); setText(el.querySelector('.party-skill'), step ? `${step}/${id === 'osia' ? 4 : 2}` : '');
      const shield = Math.max(0, h?.shield || 0); setHidden(el.querySelector('.party-shield'), !shield || fallen); setText(el.querySelector('.party-shield'), `◆ ${fmt(shield)}`);
      toggleClass(el, 'fallen', fallen); toggleClass(el, 'casting', casting); toggleClass(el, 'ready', !fallen && !!h && state.battle.phase === 'fight' && !casting && seconds === 0);
      const status = fallen ? '전투불능' : charge === '대기' ? '다음 전투 대기' : casting ? `${skill} 시전 중` : `${skill} · 충전 ${seconds}초 (전투 시간)`;
      setAttr(el, 'aria-label', `${def.name} Lv.${u.level} · 체력 ${Math.round(hp)}% · ${status}${shield ? ` · 보호막 ${fmt(shield)}` : ''} · 눌러서 육성`);
      setAttr(el, 'title', `${def.name} · ${status}`);
    });
    setText($('offline-summary'), state.offline.seconds ? `${duration(state.offline.seconds)} · 골드 ${fmt(state.offline.gold)} 수령 가능` : '자리를 비워도 최대 8시간까지');
    const key = panelContentKey();
    if (key !== renderKey) {
      renderKey = key;
      if (tab === 'adventure') renderChapters();
      if (tab === 'roster') renderRoster();
      if (tab === 'recruit') {
        const banner = G.BANNERS[selectedBanner], progress = G.bannerState(state, selectedBanner);
        setText($('pity-left'), G.RECRUIT_PITY.hard - progress.pity); setText($('pity-count'), `${progress.pity} / ${G.RECRUIT_PITY.hard}`); setWidth($('pity-bar'), `${progress.pity / G.RECRUIT_PITY.hard * 100}%`);
        setText($('next-ssr-chance'), `다음 SSR ${Math.round(G.recruitRates(progress.pity).SSR * 100)}%`);
        setText($('pity-phase'), progress.pity >= G.RECRUIT_PITY.soft - 1 ? '확률 상승 적용 중' : '60회째부터 매회 +1%p');
        setText($('banner-status'), progress.guaranteed ? `다음 SSR은 ${G.BY_ID[banner.featured].name} 확정` : `SSR 등장 시 ${G.BY_ID[banner.featured].name} 50% · 픽뚫 후 다음 SSR 확정`);
        setText($('banner-deadline'), banner.limited ? (G.bannerAvailable(selectedBanner, serverNow()) ? '11월 20일 23:59까지 · 한국 시간' : '종료된 픽업입니다. 상시 오시아 픽업을 선택해 주세요.') : '상시 픽업 · 배너별 확정 누적 별도 보관');
        document.querySelectorAll('[data-banner]').forEach(button => setAttr(button, 'aria-pressed', String(button.dataset.banner === selectedBanner)));
      }
      if (tab === 'supplies') renderSupplies();

    }
    if (tab === 'dungeons') {
      const dungeonKey = dungeonContentKey();
      if (dungeonKey !== dungeonRenderKey && renderDungeons() !== false) dungeonRenderKey = dungeonContentKey();
    }
    setHidden($('recruit-dot'), state.gems < 900);
    setHidden($('supply-dot'), !(state.offline.seconds || state.daily < G.day(serverNow()) || G.QUESTS.some(q => !state.claimed.includes(q.id) && G.questValue(state, q) >= q.goal)));
    renderButtons();
    maybeShowActivityResult();
  }
  function renderButtons() {
    setHidden($('operation-status'), !operation || !busy);
    setText($('operation-message'), ({recruit:'동료 모집 중',awaken:'각성 저장 중',train:'훈련 저장 중',activity:'던전 입장 중',rename:'이름 저장 중',redeem:'보상 확인 중'})[operation] || '저장 확인 중');
    setAttr($('app'), 'aria-busy', String(busy));
    if (!state) return; const blocked = busy || !!pending || (mode === 'guest' && !hasGuestState) || (mode === 'cloud' && !connected);
    worldMap?.update(state, blocked || !!state.battle.activity);
    document.querySelectorAll('[data-battle-mode]').forEach(button => {
      setDisabled(button, blocked || !!state.battle.activity);
      setAttr(button, 'aria-pressed', String(button.dataset.battleMode === state.mode));
    });
    document.querySelectorAll('[data-confirm-battle-mode]').forEach(button => setDisabled(button, blocked || !!state.battle.activity));
    const bannerClosed = !G.bannerAvailable(selectedBanner, serverNow());
    setDisabled($('recruit-one'), blocked || bannerClosed || state.gems < 100); setDisabled($('recruit-ten'), blocked || bannerClosed || state.gems < 900);
    document.querySelectorAll('[data-speed]').forEach(button => { setDisabled(button, blocked); setAttr(button, 'aria-pressed', String(Number(button.dataset.speed) === (state.speed || 1))); });
    setDisabled($('claim-offline'), blocked || !state.offline.seconds);
    setDisabled($('claim-daily'), blocked || state.daily >= G.day(serverNow()));
    setDisabled($('redeem-code'), blocked || !$('coupon-code').value.trim());
    setText($('redeem-code'), pending?.action.kind === 'redeem' ? '확인 중…' : '보상 받기');
    document.querySelectorAll('[data-slot]').forEach(button => { setDisabled(button, blocked || activityActive()); });
    if ($('remove-hero')) setDisabled($('remove-hero'), blocked || activityActive() || state.team.length <= (G.MIN_TEAM || 1));
    document.querySelectorAll('[data-action]').forEach(b => { setDisabled(b, blocked || b.dataset.unavailable === 'true'); });
    document.querySelectorAll('[data-activity-mode]').forEach(button => { setDisabled(button, blocked || activityActive() || activityAwaitingConfirmation() || button.dataset.unavailable === 'true'); });
    document.querySelectorAll('[data-activity-result]').forEach(button => setDisabled(button, blocked || activityAwaitingConfirmation() || resultPresentationBusy()));
    document.querySelectorAll('[data-activity-exit]').forEach(button => { setDisabled(button, blocked || activityAwaitingConfirmation()); });
    document.querySelectorAll('[data-activity-tier], #tower-floor').forEach(input => setDisabled(input, blocked));
    if ($('save-commander-name')) setDisabled($('save-commander-name'), blocked);
    setDisabled($('stage-button'), blocked || !!state.battle.activity);
    if ($('formation-status')) setText($('formation-status'), activityActive() ? '던전 도전 중에는 편성을 바꿀 수 없어요. 던전에서 도전을 마친 뒤 편성하세요.' : `${formationHint()} 편성을 바꾸면 현재 전투를 다시 시작합니다.`);

    if (modalKind === 'hero' && selectedHero && state.units[selectedHero]) {
      const u = state.units[selectedHero]; const train = $('train-hero'), awaken = $('awaken-hero');
      if (train) setDisabled(train, blocked || u.level >= G.MAX_LEVEL || state.gold < G.trainingCost(u));
      if (awaken) setDisabled(awaken, blocked || u.stars >= 5 || u.shards < G.awakeningCost(u));
      const st = G.stats(selectedHero, u), cost = G.trainingCost(u), shards = G.awakeningCost(u);
      if ($('hero-level')) {
        setText($('hero-level'), u.level); setText($('hero-hp'), fmt(st.hp)); setText($('hero-atk'), fmt(st.atk));
        setText($('hero-gold'), fmt(state.gold)); setText($('hero-xp'), u.level === G.MAX_LEVEL ? '최대 레벨' : `경험치 ${fmt(u.xp)} / ${fmt(G.needXp(u.level))}`);
        setText($('train-cost'), u.level === G.MAX_LEVEL ? '최대 레벨' : `골드 ${fmt(cost)}`);
        setText($('awaken-cost'), u.stars === 5 ? '최대 각성' : `조각 ${fmt(shards)} / 보유 ${fmt(u.shards)}`);
        setText($('hero-stars'), `각성 ${u.stars} / 5성`); setText($('hero-shards'), `조각 ${fmt(u.shards)}개`);
        setText($('training-status'), pending ? '이전 요청의 저장을 확인하고 있어요.' : busy ? '저장 확인 중…' : mode === 'cloud' && !connected ? '서버에 다시 연결하면 육성할 수 있어요.' : u.level === G.MAX_LEVEL ? '최대 레벨에 도달했어요.' : state.gold < cost ? `훈련에 골드 ${fmt(cost - state.gold)}가 더 필요해요.` : `꾹 누르면 연속 훈련 · Lv.${u.level + 1} · 골드 ${fmt(cost)}`);
      }
    }
  }
  function renderBossHUD() {
    const boss = state.battle.enemies.find(enemy => enemy.boss && enemy.hp > 0) || state.battle.enemies.find(enemy => enemy.boss);
    setHidden($('boss-hud'), !boss);
    toggleClass(document.querySelector('.battle-panel'), 'has-boss', !!boss);
    if (!boss) return;
    setText($('boss-name'), boss.name);
    setText($('boss-hp'), `${fmt(Math.max(0, boss.hp))} / ${fmt(boss.max)}`);
    const percent = Math.max(0, Math.min(100, boss.hp / boss.max * 100));
    setWidth($('boss-fill'), `${percent}%`); setAttr($('boss-track'), 'aria-valuenow', String(Math.round(percent)));
    const remaining = Math.max(0, Math.ceil(((boss.nextAbilityAt || 0) - state.battle.elapsed) / 1000));
    const ability = typeof boss.ability === 'string' ? boss.ability : boss.ability?.name;
    setText($('boss-warning'), state.battle.phase !== 'fight' ? (state.battle.phase === 'victory' ? '보스 격파' : '도전 종료') : ability && remaining <= 3 ? `${ability} · ${remaining ? `${remaining}초 뒤 전체 공격` : '공격 준비'}` : '');
    setHidden($('boss-warning'), !$('boss-warning').textContent);
  }
  function rewardText(reward) {
    const values = [];
    if (reward?.gold) values.push(`골드 ${fmt(reward.gold)}`);
    if (reward?.gems) values.push(`보석 ${fmt(reward.gems)}`);
    if (reward?.xp) values.push(`용병 경험치 ${fmt(reward.xp)}`);
    return values.join(' · ') || '이미 클리어한 층 · 추가 보상 없음';
  }
  function resultActions(result, info) {
    if (!result) return '';
    const mode = result.kind, level = mode === 'tower' ? `data-floor="${result.floor}"` : `data-tier="${result.tier}"`;
    const unavailable = mode !== 'tower' && (!info?.[mode] || info[mode].keys <= 0);
    const next = mode === 'tower' && result.won && result.floor < info.tower.maxFloor && Number.isSafeInteger(result.floor + 1) ? `<button class="primary" data-activity-mode="tower" data-floor="${result.floor + 1}">다음 층 도전</button>` : '';
    return `${next}<button class="secondary" data-activity-mode="${mode}" ${level} data-unavailable="${unavailable}">${unavailable ? '열쇠 충전 대기' : '재도전'}</button><button class="secondary" data-activity-exit>모험 복귀</button>`;
  }
  function captainModal() {
    const captain = state.captain, maxed = captain.level >= G.CAPTAIN_MAX_LEVEL, need = G.captainNeed(captain.level);
    openModal('내 단장', `<section class="captain-profile"><span class="crest" aria-hidden="true">校</span><div><h3 id="commander-display-name">${esc(state.commanderName || '새내기 단장')}</h3><p>단장 <strong>Lv.${captain.level}</strong> / ${G.CAPTAIN_MAX_LEVEL}</p></div></section><div class="captain-progress"><span><b>${maxed ? '최대 레벨' : '다음 레벨까지'}</b><span>${maxed ? 'MAX' : `${fmt(captain.xp)} / ${fmt(need)} XP`}</span></span><progress value="${maxed ? 1 : captain.xp}" max="${maxed ? 1 : need}" aria-label="단장 경험치"></progress></div><div class="captain-stats"><span><small>보유 용병</small>${Object.keys(state.units).length}</span><span><small>최고 지역</small>${G.stageName(Math.max(1,state.best))}</span><span><small>복도 기록</small>${fmt(activityInfo()?.tower.best || 0)}층</span></div><div class="ranking-tabs"><button class="secondary" data-ranking="level">${icon('trophy')} 단장 랭킹</button><button class="secondary" data-ranking="tower">${icon('dungeon')} 복도 랭킹</button></div><form id="captain-name-form" class="captain-name-form"><label for="commander-name">단장 이름</label><div class="captain-name-controls"><input id="commander-name" name="name" value="${esc(state.commanderName || '')}" maxlength="24" autocomplete="nickname" placeholder="2~12글자" aria-describedby="name-message"><button class="primary" id="save-commander-name" type="submit">${G.commanderNameInfo?.(state).cost ? '3,000 보석으로 변경' : '이름 확정'}</button></div><p id="name-message" role="status">첫 이름은 무료 · 변경은 보석 3,000개. 계정 이름은 중복될 수 없어요. ${mode === 'cloud' ? '이 이름이 공개 랭킹에 표시됩니다.' : '게스트 이름은 이 기기에 저장됩니다.'}</p></form><p class="detail-note">전투와 방치 보상으로 단장 경험치를 얻어요. 레벨업마다 보석 30개!</p>`, 'captain');
    $('captain-name-form').onsubmit = event => {
      event.preventDefault(); const name = G.normalizeCommanderName($('commander-name').value);
      if (!name) { $('name-message').textContent = '이름은 2~12글자로 입력해 주세요. 특수문자는 _와 -만 사용할 수 있어요.'; return; }
      if (busy || pending) { $('name-message').textContent = '이전 요청을 저장하고 있어요. 잠시 기다려주세요.'; return; }
      act({kind:'rename',name});
    };
    renderButtons();
  }
  async function rankingModal(next = 'level', refresh = false) {
    rankingMode = next === 'tower' ? 'tower' : 'level'; const requestedMode = rankingMode, generation = ++rankingGeneration;
    const scope = accountScope(), cacheKey = `${scope}:${requestedMode}`;
    openModal('용병단 랭킹', `<div class="ranking-tabs"><button class="secondary ${requestedMode === 'level' ? 'active' : ''}" data-ranking="level" aria-pressed="${requestedMode === 'level'}">${icon('trophy')} 단장 레벨</button><button class="secondary ${requestedMode === 'tower' ? 'active' : ''}" data-ranking="tower" aria-pressed="${requestedMode === 'tower'}">${icon('dungeon')} 복도 기록</button></div><div id="ranking-content" aria-live="polite"><p class="ranking-notice"><span class="loading-spinner" aria-hidden="true"></span> 랭킹을 불러오고 있어요.</p></div><div class="ranking-footer"><span id="ranking-updated"></span><button class="text-button" id="refresh-ranking">새로고침</button></div>`, 'rankings');
    $('refresh-ranking').onclick = () => rankingModal(requestedMode, true);
    const cached = rankingCache.get(cacheKey);
    try {
      let data;
      if (!refresh && cached && Date.now() - cached.at < 60000) data = cached.data;
      else {
        $('refresh-ranking').disabled = true;
        data = await request('/api/school/rankings', {mode:requestedMode}, mode === 'cloud' ? 'school' : 'public');
        rankingCache.set(cacheKey, {at:Date.now(),data});
      }
      if (generation !== rankingGeneration || modalKind !== 'rankings' || scope !== accountScope()) return;
      const score = entry => requestedMode === 'tower' ? `${fmt(entry.floor)}층` : `Lv.${fmt(entry.level)}`;
      $('ranking-content').innerHTML = `${data.me ? `<div class="ranking-mine" id="ranking-me">내 순위 <b>${fmt(data.me.rank)}위</b> · ${esc(data.me.name)} · ${score(data.me)}</div>` : `<p class="ranking-notice">${mode === 'guest' ? 'Google 계정의 용병단이 랭킹에 등록됩니다. 게스트도 랭킹을 볼 수 있어요.' : requestedMode === 'tower' ? '복도를 1층 이상 클리어하면 기록이 올라가요.' : '계정의 저장 기록을 확인한 뒤 다시 확인해 주세요.'}</p>`}<ol class="ranking-list">${data.entries.map(entry => `<li class="ranking-row ${entry.isMe ? 'mine' : ''}"><span>${fmt(entry.rank)}</span><b>${esc(entry.name)}</b><small>${score(entry)}</small></li>`).join('')}</ol>${!data.entries.length ? '<p class="ranking-notice">아직 등록된 기록이 없어요. 첫 기록에 도전해 보세요!</p>' : ''}`;
      $('ranking-updated').textContent = `상위 ${data.limit || 50}명 · 총 ${fmt(data.total)}명 · ${new Date(data.updatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 갱신`;
    } catch (error) {
      if (generation === rankingGeneration && modalKind === 'rankings') $('ranking-content').innerHTML = `<p class="ranking-notice" role="alert">${esc(error.message)}<br>새로고침을 눌러 다시 확인해 주세요.</p>`;
    } finally { if (generation === rankingGeneration && $('refresh-ranking')) $('refresh-ranking').disabled = false; }
  }
  function renderDungeons() {
    const info = activityInfo();
    if (!info) { $('dungeon-cards').textContent = '던전 정보를 불러오고 있어요.'; return; }
    $('dungeon-keys').innerHTML = ['daily', 'weekly'].map(kind => `<span class="key-chip"><b>${kind === 'daily' ? '일일' : '주간'} 열쇠</b> <span id="${kind}-keys">${info[kind].keys}</span> / ${info[kind].cap}</span>`).join('');
    $('dungeon-reset').textContent = `${selectedDungeon === 'tower' ? '열쇠 없이 도전 · 층별 첫 클리어 보상' : `다음 충전 ${resetTime(info[selectedDungeon].resetAt)} · 한국 시간`}`;
    const run = info.run, result = run?.settled && String(confirmedActivityResult?.runId) === String(run.id) ? confirmedActivityResult : null;
    $('dungeon-current').hidden = !run;
    $('dungeon-current').innerHTML = !run ? '' : `<div class="run-summary"><h3>${activityTitle(run.kind)} · ${activityLevel(run)}</h3><p>${run.settled ? result ? `${result.won ? '클리어' : '도전 종료'} · ${result.won ? rewardText(result.reward) : result.refunded ? '입장 열쇠 반환 완료' : '보상 없음'}` : '결과 저장 확인 중… 연결되면 결과를 확인할 수 있어요.' : '도전 중이에요. 전투 화면에서 보스의 특수 공격을 확인하세요.'}</p><div class="run-actions">${run.settled ? result ? `<button class="primary" data-activity-result>결과 보기</button>${resultActions(result, info)}` : '<button class="secondary" disabled>저장 확인 중…</button>' : `<button class="primary" data-tab="adventure">전투 보기</button><button class="secondary" data-activity-exit>${run.kind === 'tower' ? '도전 중단 · 모험 복귀' : '포기 · 열쇠 반환'}</button>`}</div></div>`;
    if ($('tower-floor') === document.activeElement) return false;
    $('dungeon-selectors').innerHTML = ['daily','weekly','tower'].map(kind => `<button class="dungeon-choice ${kind}" data-dungeon="${kind}" aria-pressed="${selectedDungeon === kind}" aria-label="${activityTitle(kind)} 선택"><img src="school/assets/dungeon-${kind}.png?v=school-adventure1" alt="" loading="lazy"><span><b>${kind === 'daily' ? '보급고' : kind === 'weekly' ? '이사장실' : '뫼비우스'}</b><small>${kind === 'daily' ? '일일 던전' : kind === 'weekly' ? '주간 던전' : '끝없는 복도'}</small></span></button>`).join('');
    let cards = ['daily', 'weekly'].map(kind => {
      const item = info[kind], chosen = item.tiers.find(tier => tier.tier === selectedTiers[kind]) || item.tiers[0];
      selectedTiers[kind] = chosen.tier;
      const unavailable = !chosen.unlocked || item.keys <= 0;
      return `<article class="dungeon-card" ${selectedDungeon === kind ? '' : 'hidden'}><h3>${esc(item.name)}</h3><p>${kind === 'daily' ? '매일 골드와 보석을 모아요.' : '강력한 보스에게 도전하세요.'}</p><label class="dungeon-tier" for="${kind}-tier">도전 단계<select id="${kind}-tier" data-activity-tier="${kind}">${item.tiers.map(tier => `<option value="${tier.tier}" ${tier.tier === chosen.tier ? 'selected' : ''} ${tier.unlocked ? '' : 'disabled'}>${tier.tier}단계${tier.unlocked ? '' : tier.unlockBest ? ` · ${G.stageName(tier.unlockBest)} 클리어 후` : ' · 잠김'}</option>`).join('')}</select></label><div class="dungeon-reward">승리 보상 · ${rewardText(chosen.reward)}</div><div class="dungeon-meta"><small>입장 1개 · 패배·포기 시 반환</small><small>${kind === 'daily' ? '매일 00:00' : '월요일 00:00'} 충전</small></div><div class="dungeon-actions"><button class="primary" id="${kind}-enter" data-activity-mode="${kind}" data-tier="${chosen.tier}" data-unavailable="${unavailable}">${!chosen.unlocked ? '아직 잠긴 단계' : item.keys <= 0 ? '열쇠 충전 대기' : '열쇠 1개로 도전'}</button></div></article>`;
    }).join('');
    const floor = Number.isSafeInteger(selectedTowerFloor) && selectedTowerFloor >= 1 && selectedTowerFloor <= info.tower.nextFloor ? selectedTowerFloor : info.tower.nextFloor;
    selectedTowerFloor = floor;
    cards += `<article class="dungeon-card tower-card" ${selectedDungeon === 'tower' ? '' : 'hidden'}><h3>${esc(info.tower.name)}</h3><p>한 층씩 올라가는 무한 도전</p><div class="dungeon-meta"><b>최고 ${fmt(info.tower.best)}층</b><small>열쇠 없이 무제한 도전</small></div><label class="tower-floor" for="tower-floor">도전할 층<input id="tower-floor" type="number" inputmode="numeric" min="1" max="${info.tower.nextFloor}" value="${floor}" step="1"></label><div class="dungeon-reward">${floor > info.tower.best ? `첫 클리어 · ${rewardText(info.tower.reward)}` : '클리어한 층은 골드·보석·경험치를 다시 지급하지 않아요.'}</div><div class="dungeon-actions"><button class="primary" id="tower-enter" data-activity-mode="tower" data-floor="${floor}">${fmt(floor)}층 도전</button></div></article>`;
    $('dungeon-cards').innerHTML = cards;
  }
  function enterActivity(button) {
    const kind = button.dataset.activityMode;
    if (!['daily', 'weekly', 'tower'].includes(kind)) return;
    const input = {kind:'activity', mode:kind};
    if (kind === 'tower') input.floor = Number(button.dataset.floor || $('tower-floor')?.value);
    else input.tier = Number(button.dataset.tier || selectedTiers[kind]);
    act(input);
  }
  function showActivityResult(result) {
    if (!result || !state.activities?.run?.settled || String(result.runId) !== String(state.activities.run.id) || activityAwaitingConfirmation() || busy || pending || resultPresentationBusy()) return;
    if (mode === 'cloud' && (!connected || verifiedToken !== token)) return;
    const info = activityInfo(), heading = result.won ? '도전 성공!' : result.reason === 'exit' ? '도전 중단' : '다음 도전을 준비해요';
    const refund = result.refunded ? '입장 열쇠를 돌려받았어요.' : result.won || result.kind === 'tower' ? '' : '충전 기간이 바뀐 경우 새 열쇠 수량을 유지해요.';
    openModal(result.won ? '던전 클리어' : '던전 결과', `<div class="dungeon-result ${result.won ? '' : 'is-defeat'}"><h3>${heading}</h3><p>${activityTitle(result.kind)} · ${activityLevel(result)}</p><div class="reward-tokens">${result.won ? (result.reward.gold || result.reward.gems || result.reward.xp ? ['gold','gems','xp'].filter(key => result.reward[key]).map(key => `<span>${key === 'gold' ? '골드' : key === 'gems' ? '보석' : '용병 경험치'} +${fmt(result.reward[key])}</span>`).join('') : '<span>클리어한 층 · 추가 보상 없음</span>') : '<span>이번 도전 보상 없음</span>'}</div><p>${refund}</p><small>결과와 보상은 저장되었어요.</small><div class="run-actions">${resultActions(result, info)}</div></div>`, 'dungeon-result');
    $('modal').dataset.activityResult = activityResultKey(result);
    renderButtons(); if (result.won) play('reward');
  }
  const activityResultKey = result => `${accountScope()}:${result.runId}`;
  const resultPresentationBusy = () => !!Presentation?.busy || !!$('school-presentation')?.open;
  function pendingResultNotice(result) {
    let notice = $('pending-activity-result');
    if (!result || !$('modal').open || modalKind === 'dungeon-result') { notice?.remove(); return; }
    const key = activityResultKey(result);
    if (notice?.dataset.resultKey === key) return;
    notice?.remove(); notice = document.createElement('section'); notice.id = 'pending-activity-result'; notice.className = 'run-summary'; notice.dataset.resultKey = key;
    notice.setAttribute('role', 'status');
    notice.innerHTML = `<b>${esc(activityTitle(result.kind))} · ${activityLevel(result)} ${result.won ? '클리어' : '도전 종료'}</b><p>결과가 저장되었어요.</p><button class="primary full" data-activity-result>${result.kind === 'tower' && result.won ? '결과 보기 · 다음 층으로' : '결과 보기'}</button>`;
    // Keep the open form and its values intact; the result remains reachable.
    $('modal-content').prepend(notice); setDisabled(notice.querySelector('button'), busy || !!pending || resultPresentationBusy());
  }
  function maybeShowActivityResult() {
    const result = confirmedActivityResult, run = state?.activities?.run;
    if (!run?.settled || !result || String(run.id) !== String(result.runId) || activityAwaitingConfirmation() || (mode === 'cloud' && (!connected || verifiedToken !== token))) { pendingResultNotice(null); return; }
    const key = activityResultKey(result);
    if (key === dismissedActivityResult || ($('modal').open && modalKind === 'dungeon-result' && $('modal').dataset.activityResult === key)) { pendingResultNotice(null); return; }
    if ($('modal').open) { pendingResultNotice(result); return; }
    if (busy || pending || resultPresentationBusy() || !$('boot-screen').hidden || !$('rotate-prompt').hidden || document.hidden) return;
    showActivityResult(result);
  }
  function dungeonHelp() {
    openModal('던전 이용 안내', '<div class="modal-copy"><p><strong>입장과 열쇠</strong><br>일일 던전은 매일 한국 시간 00:00에 3개, 주간 던전은 매주 월요일 00:00에 2개로 충전됩니다. 남은 열쇠는 이월되지 않아요.</p><p>입장할 때 열쇠 1개를 사용합니다. 패배하거나 포기하면 돌려받으며, 이미 새 충전 기간이 시작됐다면 새 수량을 유지합니다. 자동으로 다음 던전에 입장하거나 열쇠를 사용하지 않습니다.</p><p><strong>뫼비우스의 복도</strong><br>열쇠 없이 다음 층 또는 클리어한 층에 도전할 수 있어요. 층별 첫 클리어 보상은 한 번만 받고, 재도전에서는 모든 재화·경험치 보상이 없습니다.</p><p><strong>편성과 자리 비움</strong><br>모험과 같은 용병을 최대 6명 편성합니다. 도전 중에는 편성과 모험 지역을 바꿀 수 없으니 먼저 도전을 마치거나 포기해 주세요. 90초 넘게 자리를 비우면 도전 전투는 멈추고 모험 기준 방치 보상만 적립됩니다.</p></div>', 'dungeon-help');
  }
  function renderChapters() {
    document.querySelector('.chapter-stamp').innerHTML = `${G.chapter(state.stage) + 1}<br><small>CHAPTER</small>`;
    $('chapter-list').innerHTML = G.CHAPTERS.map((name, i) => {
      const complete = Math.min(5, Math.max(0, state.best - i * 5)), unlocked = state.best >= i * 5;
      return `<button class="chapter-item ${G.chapter(state.stage) === i ? 'current' : ''} ${unlocked ? '' : 'locked'}" data-map="${i}"><span class="chapter-num">0${i + 1}</span><span class="chapter-copy"><b>${name}</b><small>${unlocked ? `${complete} / 5 지역 클리어` : `${i}-5 클리어 후 개방`}</small></span><span class="chapter-end">${complete === 5 ? '✓' : unlocked ? '→' : '잠김'}</span></button>`;
    }).join('');
    if ($('adventure-quests')) $('adventure-quests').innerHTML = G.QUESTS.filter(q => !state.claimed.includes(q.id)).slice(0, 2).map(q => {
      const value = Math.min(q.goal, G.questValue(state, q));
      return `<button class="adventure-quest" data-tab="supplies"><span>${q.name}<small>${value} / ${q.goal}</small></span><progress value="${value}" max="${q.goal}" aria-label="${q.name}"></progress></button>`;
    }).join('') || '<p class="detail-note">모든 모험 목표를 달성했어요.</p>';
  }
  function renderRoster() {
    $('roster-count').textContent = `${Object.keys(state.units).length} / ${G.HEROES.length}`;
    const list = G.HEROES.filter(h => filter === 'all' || state.units[h.id]).sort((a, b) => Number(!!state.units[b.id]) - Number(!!state.units[a.id]) || ({SSR:3, SR:2, R:1}[b.rarity] - {SSR:3, SR:2, R:1}[a.rarity]));
    $('roster').innerHTML = list.map(h => { const u = state.units[h.id]; return `<button class="hero-card ${h.rarity} ${u ? '' : 'unowned'}" data-hero="${h.id}">${rarity(h.id)}${state.team.includes(h.id) ? '<span class="equipped">출전</span>' : ''}${portrait(h.id, 'portrait')}<b>${h.name}</b><small>${u ? `Lv.${u.level} · ` : ''}${h.role}</small><span class="stars">${u ? '★'.repeat(u.stars) + '☆'.repeat(5 - u.stars) : '미보유'}</span></button>`; }).join('');
  }
  function renderSupplies() {
    $('coupon-announcement').textContent = '새 코드: LAVA_DEBUT · 보석/골드 각 1,000 / THANK_YOU · 각 500. 11월 20일 23:59 한국 시간까지.';
    $('offline-detail').innerHTML = state.offline.seconds ? `<b>${duration(state.offline.seconds)}의 모험</b><br>골드 ${fmt(state.offline.gold)} · 용병마다 경험치 ${fmt(state.offline.xp)}` : '90초 넘게 자리를 비우면<br>다시 돌아올 때 보상을 모아 드려요.';
    const rate = G.rates(state); $('offline-rate').textContent = `분당 골드 ${rate.gold} · 용병 경험치 ${rate.xp} / 최고 클리어 지역 기준`;
    $('claim-daily').textContent = state.daily >= G.day(serverNow()) ? '수령 완료' : '받기';
    $('quests').innerHTML = G.QUESTS.map(q => { const value = Math.min(q.goal, G.questValue(state, q)), done = state.claimed.includes(q.id); return `<div class="quest ${done ? 'done' : ''}"><div class="quest-info"><b>${q.name}</b><small>${q.desc} · 골드 ${fmt(q.gold)} / 보석 ${q.gems}</small><div class="quest-progress">${value} / ${q.goal}</div></div><button class="secondary" data-action="quest" data-quest="${q.id}" data-unavailable="${done || value < q.goal}">${done ? '완료' : '받기'}</button></div>`; }).join('');
  }
  function openModal(title, html, kind = '') {
    worldMap?.destroy(); worldMap = null;
    $('modal').classList.toggle('world-map-modal', kind === 'map');
    loginGeneration++; modalKind = kind; delete $('modal').dataset.activityResult; $('modal-title').textContent = title; $('modal-content').innerHTML = html;
    if (!$('modal').open) $('modal').showModal(); $('modal').scrollTop = 0;
    if (kind !== 'dungeon-result') maybeShowActivityResult();
  }
  function closeModal(dismissResult = false) {
    if (dismissResult === true && modalKind === 'dungeon-result') dismissedActivityResult = $('modal').dataset.activityResult || null;
    worldMap?.destroy(); worldMap = null; $('modal').classList.remove('world-map-modal');
    stopTraining(); delete $('modal').dataset.activityResult; $('modal').close(); modalKind = ''; loginGeneration++; queueMicrotask(maybeShowActivityResult);
  }
  function heroDetail(id) {
    const h = G.BY_ID[id], u = state.units[id]; if (!h) return; selectedHero = id;
    const st = G.stats(id, u || {level:1, stars:0});
    const skills = `<details class="hero-skills" ${u ? '' : 'open'}><summary>스킬 · 패시브</summary><div class="skill-box"><b>${h.skill} <span>· ${h.cooldown}초 충전</span></b>${h.desc}</div>${h.passive ? `<div class="skill-box passive-box"><b>패시브 · ${h.passive}</b>${h.passiveDesc}</div>` : ''}${h.passive2 ? `<div class="skill-box passive-box"><b>패시브 · ${h.passive2}</b>${h.passive2Desc}</div>` : ''}</details>`;
    openModal(u ? '용병 육성' : '용병 정보', `<div class="hero-management"><div class="hero-detail-header">${portrait(id, 'detail-portrait')}<div>${rarity(id)}<h3>${h.name}</h3><p>${h.club} · ${h.role}</p>${h.element === 'water' ? '<p class="hero-element">Osia · 물고기 종족 · 물 속성</p>' : h.element === 'wind' ? '<p class="hero-element">Lava · 남성 · 인간 · 바람 속성</p>' : ''}</div></div><div class="hero-stat-grid"><div><small>레벨</small><b id="hero-level">${u ? u.level : 1}</b><small>/ ${G.MAX_LEVEL}</small></div><div><small>체력</small><b id="hero-hp">${fmt(st.hp)}</b></div><div><small>공격력</small><b id="hero-atk">${fmt(st.atk)}</b></div></div><p class="detail-note">치명타 ${Math.round((st.critChance || .12)*100)}% · 피해 ${(st.critMultiplier || 1.5)}배</p>${u ? `<div class="hero-wallet">보유 골드 <b id="hero-gold">${fmt(state.gold)}</b><span id="hero-xp"></span></div><div class="detail-actions"><button class="primary" id="train-hero">레벨업 · 꾹 누르기<small id="train-cost"></small></button><button class="secondary" id="awaken-hero">각성<small id="awaken-cost"></small></button></div><p class="upgrade-feedback" id="training-status" role="status"></p><div class="detail-note"><span id="hero-stars"></span> · <span id="hero-shards"></span><br>훈련·각성 능력치는 다음 전투부터 적용됩니다.</div><button class="secondary full" id="change-hero">용병 교체 · 보유 동료 보기</button>${skills}<h3 class="stage-title">출전 위치</h3><div class="slot-buttons">${Array.from({length:maxTeam()}, (_, i) => { const member = state.team[i]; return `<button data-slot="${i}" class="${member === id ? 'selected' : ''} ${member ? '' : 'empty'}">${member ? portrait(member) : '<span class="empty-slot-mark" aria-hidden="true">+</span>'}${slotName(i)}<br>${member ? G.BY_ID[member].name : '빈자리에 추가'}</button>`; }).join('')}</div>${state.team.includes(id) ? `<button class="text-button remove-hero-action" id="remove-hero">출전에서 빼기</button>` : ''}<p class="detail-note" id="formation-status">전열이 공격을 더 자주 받습니다. 편성을 바꾸면 현재 전투를 다시 시작합니다.</p>` : `${skills}<p class="detail-note">아직 만나지 못한 용병입니다.</p><button class="primary full" id="to-recruit">모집에서 만나기 →</button>`}</div>`, 'hero');
    if (u) {
      $('train-hero').style.touchAction = 'none'; $('train-hero').style.userSelect = 'none';
      $('train-hero').onpointerdown = event => beginTraining(event,id);
      $('train-hero').oncontextmenu = event => event.preventDefault();
      $('train-hero').onclick = event => { if (performance.now() < trainClickUntil || event.detail > 0) return; act({kind:'train',hero:id}); };
      $('train-hero').onkeydown = event => { if (['Enter',' '].includes(event.key) && !event.repeat) beginTraining(event,id); };
      $('train-hero').onkeyup = event => { if (['Enter',' '].includes(event.key)) { event.preventDefault(); stopTraining(); } }; $('awaken-hero').onclick = () => act({kind:'awaken', hero:id});
      $('change-hero').onclick = () => { closeModal(); filter = 'owned'; setTab('roster'); };
      document.querySelectorAll('[data-slot]').forEach(b => { b.onclick = () => {
        const index = Math.min(Number(b.dataset.slot), state.team.length), team = [...state.team], old = team.indexOf(id);
        if (old === index) { toast('이미 이 위치에 출전 중이에요.'); return; }
        if (index === team.length) { if (old >= 0) team.splice(old, 1); team.push(id); }
        else { if (old >= 0) team[old] = team[index]; team[index] = id; }
        act({kind:'team', team});
      }; });
      if ($('remove-hero')) $('remove-hero').onclick = () => act({kind:'team', team:state.team.filter(member => member !== id)});
    } else $('to-recruit').onclick = () => { if (id === 'osia' || id === 'lava') { selectedBanner = id; storage.set('school-pickup', id); } closeModal(); setTab('recruit'); };
    renderButtons();
  }
  function changeBattleMode(nextMode) {
    if (!['progress', 'farm'].includes(nextMode) || state.mode === nextMode || busy || pending || state.battle.activity) return;
    const stage = state.battle.stage, label = nextMode === 'farm' ? '자동 반복' : '자동 진행';
    openModal('사냥 방식 변경', `<div class="modal-copy"><p><strong>${G.stageName(stage)} · ${esc(G.CHAPTERS[G.chapter(stage)])}</strong></p><p>${label}으로 변경하면 이 지역의 <strong>첫 웨이브부터 다시 시작</strong>해요.</p><p>${nextMode === 'farm' ? '지역을 클리어해도 같은 지역에서 계속 사냥해요.' : '지역을 클리어하면 다음 지역으로 도전해요.'}</p></div><button class="primary full" data-confirm-battle-mode="${nextMode}" data-confirm-stage="${stage}">${label}으로 시작</button>`, 'battle-mode');
    renderButtons();
  }
  function stageMap() {
    if (state.battle.activity) { setTab('dungeons'); toast('던전에서 모험 복귀를 누른 뒤 지도를 열어주세요.'); return; }
    openModal('학교 모험 지도', '<div id="world-map-root"></div>', 'map');
    if (!window.SchoolWorldMap) { $('world-map-root').innerHTML = '<p class="modal-copy">지도를 불러오지 못했어요. 연결을 확인하고 게임을 새로고침해 주세요.</p>'; return; }
    worldMap = window.SchoolWorldMap.render($('world-map-root'), {
      state, blocked:busy || !!pending || (mode === 'cloud' && !connected),
      onSelect:(stage, selectedMode) => act({kind:'stage',stage,mode:selectedMode})
    });
    renderButtons();
  }
  function reveal(results) {
    openModal('새로운 만남', `<p class="reveal-caption">${results.some(r => r.fresh) ? '용병단에 새로운 친구가 찾아왔어요.' : '동료의 조각을 모아 더 강하게 각성하세요.'}</p><div class="result-grid ${results.length === 1 ? 'single' : ''}">${results.map((r, i) => `<div class="result-card ${G.BY_ID[r.id].rarity}" style="animation-delay:${reduced ? 0 : i * .085}s">${rarity(r.id)}<img src="${Art.frontPortrait ? Art.frontPortrait(r.id) : Art.portrait(r.id)}" alt="${esc(G.BY_ID[r.id].name)}"><b>${G.BY_ID[r.id].name}</b><small>${r.fresh ? 'NEW · 첫 만남' : `조각 +${r.shards}`}</small></div>`).join('')}</div><button class="primary full result-close" id="reveal-done">용병 확인하기 →</button><p class="detail-note" style="text-align:center">결과는 이미 저장되었어요. 창을 닫아도 사라지지 않아요.</p>`, 'reveal');
    $('reveal-done').onclick = () => { closeModal(); setTab('roster'); };
    $('modal-content').querySelector('.result-grid').onclick = e => e.currentTarget.classList.add('skip');
  }
  function ratesModal() {
    const banner = G.BANNERS[selectedBanner], progress = G.bannerState(state, selectedBanner);
    const rates = G.recruitRates(progress.pity), heroRates = G.bannerHeroRates(state, selectedBanner);
    const percent = n => `${Number((n * 100).toFixed(4))}%`;
    const rows = ['SSR', 'SR', 'R'].map(grade => {
      const pool = G.HEROES.filter(h => h.rarity === grade && (grade !== 'SSR' || h.id === banner.featured || ['osia','ian','lumi'].includes(h.id)));
      return `<tr><td>${grade} · ${pool.length}명</td><td>${percent(rates[grade])}</td><td>${pool.map(h => `${h.name} ${percent(heroRates[h.id])}`).join('<br>')}</td></tr>`;
    }).join('');
    openModal('모집 확률 안내', `<div class="modal-copy"><p><strong>${banner.name}</strong><br>1회 보석 100개 / 10회 900개.</p><table class="probability-table"><thead><tr><th>등급</th><th>다음 1회</th><th>용병별 실제 확률</th></tr></thead><tbody>${rows}</tbody></table><p>현재 누적 ${progress.pity}회 · <strong>다음 ${progress.pity + 1}회째 확률</strong>입니다. ${progress.guaranteed ? `다음 SSR은 <strong>${G.BY_ID[banner.featured].name} 확정</strong>입니다.` : `SSR이 나오면 <strong>50%는 ${G.BY_ID[banner.featured].name}</strong>, 나머지 50%는 다른 상시 SSR입니다.`}</p><p>메인 이외의 SSR을 얻으면 <strong>그 배너의 다음 SSR은 메인 확정</strong>입니다. 메인을 얻으면 다시 50:50이 됩니다. 두 배너의 누적 횟수와 메인 보장은 각각 저장됩니다.</p><p>기본 확률 SSR ${percent(G.RECRUIT_RATES.SSR)} · SR ${percent(G.RECRUIT_RATES.SR)} · R ${percent(G.RECRUIT_RATES.R)}. SSR 미획득 기준 <strong>${G.RECRUIT_PITY.soft}회째 ${percent(G.recruitRates(G.RECRUIT_PITY.soft - 1).SSR)}</strong>부터 매회 1%p씩 올라 ${G.RECRUIT_PITY.hard - 1}회째 ${percent(G.recruitRates(G.RECRUIT_PITY.hard - 2).SSR)}, <strong>${G.RECRUIT_PITY.hard}회째 SSR 확정</strong>입니다. 증가분은 R에서 차감합니다. SSR 획득 시 누적만 0으로 초기화됩니다.</p><p>단일·10회 모집 모두 한 번씩 계산합니다. 10회의 앞 9명에 SR 이상이 없고 마지막 결과가 R이면 SR로 올립니다. SSR 천장을 먼저 적용합니다.</p><p>라바는 <strong>2026년 11월 20일 23:59(한국 시간)까지</strong> 한정 배너에서만 나옵니다. 오시아 상시 배너에서는 나오지 않습니다. 이미 얻은 라바는 종료 후에도 사용할 수 있습니다.</p><p>중복 시 R 조각 5개 / SR 10개 / SSR 20개. 최대 5성까지 각성할 수 있습니다. 표의 소수점은 반올림하여 합계가 조금 다를 수 있습니다.</p></div>`, 'rates');
  }
  function help() {
    openModal('학교용병단 안내', `<div class="modal-copy"><p><strong>방과 후, 작은 용병들의 큰 모험.</strong><br>안뜰의 용병을 눌러 육성하고, 모험 지도에서 구역과 지역을 골라 출발하세요. 전투는 자동! 용병을 모으고 키워 ${G.CHAPTERS.length}개 구역, ${G.MAX_STAGE}개 지역을 탐험하세요.</p><ul><li>전투 속도 1.0×·1.5×를 선택할 수 있습니다. 방치 보상은 실제 경과 시간을 따릅니다.</li><li>최대 6명의 용병이 자동으로 싸웁니다. 1~3명은 맨 앞 용병이, 4~6명은 전열 3명이 주로 공격을 받아요. 전열에는 수호 용병을 추천해요.</li><li>승리하면 출전 용병이 경험치를 얻어요. 골드로 훈련하면 바로 1레벨 성장합니다.</li><li>지역마다 일반 전투 3번, 보스 1번. 처음 클리어하면 보석 60개!</li><li>3번 연속 패배하면 이전 지역을 반복합니다. 용병을 키우고 지도에서 다시 도전하세요.</li><li>90초 넘게 자리를 비우면 최대 8시간의 보상을 모읍니다. 보급소에서 받아 주세요.</li><li>던전은 일일 열쇠 3개·주간 열쇠 2개로 도전합니다. 패배·포기하면 입장 열쇠가 돌아옵니다.</li><li>뫼비우스의 복도는 열쇠 없이 도전하며 층별 첫 클리어 때만 보상을 받습니다.</li><li>단장은 최대 Lv.${G.CAPTAIN_MAX_LEVEL}까지 성장하며, 레벨업마다 보석 30개를 받아요. 단장 버튼에서 이름을 정하고 레벨·복도 랭킹을 볼 수 있습니다. Google 계정에 저장한 기록과 게임 안에서 정한 이름만 공개됩니다.</li><li>기본 SSR 확률은 ${Number((G.RECRUIT_RATES.SSR * 100).toFixed(2))}%입니다. 픽업별 확률과 확정 횟수는 모집 화면의 확률 안내에서 확인하세요.</li><li>가로 화면에서는 전장과 용병을 함께 볼 수 있어요. 세로에서는 좌우로 밀어 이동하세요. 설정에서 다크 모드·효과음·모션을 바꿀 수 있고, 모집·각성·단장 성장 연출은 바로 건너뛸 수 있습니다.</li><li>매일 한국 시간 0시에 일일 보급이 갱신됩니다.</li></ul><p>게스트는 이 브라우저에, 로그인은 계정에 저장합니다. <strong>게스트와 계정 진행은 별도</strong>이며 합쳐지지 않습니다. 기기 데이터를 지우면 게스트 기록은 사라집니다.</p><p>이 게임의 단장 레벨과 재화는 기존 카드게임과 별개입니다.</p><p><a href="privacy.html" target="_blank" rel="noopener">개인정보·계정 안내</a> · <a href="game.html">기존 카드게임</a></p></div>`, 'help');
  }
  async function sdk() {
    if (window.google?.accounts?.id) return;
    if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
      const timer = setTimeout(() => { script.remove(); sdkPromise = null; reject(Error('Google 로그인 버튼을 불러오지 못했습니다.')); }, 12000);
      script.onload = () => { clearTimeout(timer); resolve(); }; script.onerror = () => { clearTimeout(timer); script.remove(); sdkPromise = null; reject(Error('Google 로그인에 연결하지 못했습니다.')); }; document.head.append(script);
    }); return sdkPromise;
  }
  async function useCloud() {
    if (busy) return false; busy = true; renderButtons(); saveStatus('saving', '계정 불러오는 중');
    let loaded = false; const connectingToken = token;
    try {
      const identity = await request('/api/account/me', {}, 'account');
      const body = await request('/api/school/state');
      const fingerprint = await tokenFingerprint(connectingToken);
      if (!connectingToken || connectingToken !== token) throw Error('로그인 계정이 바뀌었습니다. 다시 연결하세요.');
      Presentation?.cancel(); confirmedScope = '';
      profile = identity.profile; mode = 'cloud'; storage.set(MODE, 'cloud'); effects = []; lastSeq = body.state.seq;
      verifiedToken = connectingToken; sessionFingerprint = fingerprint;
      try { const saved = JSON.parse(storage.get(PENDING, true) || 'null'); pending = saved?.accountId === profile.id ? saved : null; if (!pending) storage.remove(PENDING, true); } catch { clearPending(); }
      applyCloud(body); closeModal(); toast('계정의 학교용병단을 불러왔어요.'); lastSync = Date.now(); loaded = true;
    } catch (error) {
      if (error.status === 401) { clearLogin(); }
      connected = false; saveStatus('error', '계정 연결 대기'); lastSync = Date.now();
      note(error.status === 426 ? error.message : error.status === 401 ? '로그인이 만료되었습니다. 계정 메뉴에서 다시 로그인해 주세요.' : '계정 기록을 불러오지 못했습니다. 계정 메뉴에서 다시 연결해 주세요.', error.status === 426 ? 'reload' : true);
      toast(error.message); const status = $('login-message'); if (status) status.textContent = error.message;
    } finally { busy = false; renderButtons(); }
    if (loaded && pending) sync(true);
    return loaded;
  }
  async function accountModal() {
    openModal('내 용병단 저장', `<div class="modal-copy"><p>${mode === 'cloud' ? '<strong>Google 계정에 저장 중입니다.</strong><br>다른 기기에서도 같은 계정으로 이어 할 수 있어요.' : '<strong>지금은 이 브라우저에 저장 중입니다.</strong><br>Google 계정을 연결하면 기기를 바꿔도 이어 할 수 있어요.'}</p><div class="account-box"><span>${mode === 'cloud' ? '계정 용병단' : '게스트 용병단'}<br>단장 Lv.${state.captain.level}</span><b>${Object.keys(state.units).length}명 보유</b></div><p>게스트와 계정 기록은 따로 유지됩니다. 로그인 시 계정 기록을 불러오며 게스트 기록은 이 기기에 남습니다.</p><p>카드게임과 로그인은 공유하고, 성장 기록은 각각 저장합니다.</p></div><div id="account-controls"></div><div id="login-message" class="login-message" role="status"></div><p class="detail-note"><a href="privacy.html" target="_blank" rel="noopener">개인정보 및 계정 삭제 안내</a></p>`, 'account');
    if (mode === 'cloud') {
      $('account-controls').innerHTML = `<div class="account-actions"><button class="secondary" id="cloud-refresh">저장 확인</button><button class="secondary" id="guest-return">게스트로 전환</button><button class="secondary" id="logout-account">로그아웃</button>${!connected || !token ? '<button class="primary" id="cloud-login-again">다시 로그인</button>' : ''}</div>`;
      if ($('cloud-login-again')) $('cloud-login-again').onclick = prepareGoogle;
      $('logout-account').onclick = logoutAccount;
      $('cloud-refresh').onclick = async () => { await sync(true); if (connected) toast('계정 저장을 확인했습니다.'); };
      $('guest-return').onclick = async () => {
        if (busy || pending) { toast('진행 중인 요청을 먼저 확인해 주세요.'); return; }
        const prior = { profile, state, hasCloudState, cloudBalance, connected };
        busy = true; renderButtons();
        Presentation?.cancel(); confirmedScope = ''; rankingCache.clear();
        mode = 'guest'; profile = null; storage.set(MODE, 'guest'); effects = []; connected = true; hasCloudState = false; cloudBalance = null;
        try { await guestUpdate(); lastSeq = state.seq; document.querySelector('.workspace').style.visibility = ''; note(''); closeModal(); renderKey = partyKey = ''; render(); toast('이 기기의 게스트 기록으로 돌아왔어요.'); }
        catch (error) { mode = 'cloud'; profile = prior.profile; state = prior.state; hasCloudState = prior.hasCloudState; cloudBalance = prior.cloudBalance; connected = prior.connected; storage.set(MODE, 'cloud'); saveStatus(connected ? 'saved' : 'error', connected ? '계정 저장 완료' : '계정 연결 대기'); toast(error.message); }
        finally { busy = false; renderButtons(); }
      };
      return;
    }
    if (token) { $('account-controls').innerHTML = '<button class="primary full" id="existing-account">로그인된 계정으로 이어하기 →</button><button class="text-button history-button" id="different-account">다른 Google 계정으로 연결</button>'; const logout = document.createElement('button'); logout.id='logout-account'; logout.className='secondary full'; logout.textContent='로그아웃'; logout.onclick=logoutAccount; $('account-controls').append(logout); $('existing-account').onclick = useCloud; $('different-account').onclick = () => prepareGoogle(); }
    else prepareGoogle();
  }
  async function prepareGoogle() {
    const version = ++loginGeneration; $('account-controls').innerHTML = '<div id="google-host" class="login-host"></div>'; $('login-message').textContent = 'Google 로그인 버튼을 준비하고 있어요.';
    try {
      const config = await request('/api/account/config');
      if (!config.enabled) throw Error('현재 계정 로그인을 준비 중입니다. 게스트로 먼저 플레이할 수 있어요.');
      const [, challenge] = await Promise.all([sdk(), request('/api/account/challenge')]);
      if (version !== loginGeneration || modalKind !== 'account') return;
      google.accounts.id.initialize({ client_id: config.clientId, nonce: challenge.nonce, auto_select: false, callback: async response => {
        if (version !== loginGeneration || busy) return;
        busy = true; $('login-message').textContent = '계정을 확인하고 있어요.'; renderButtons();
        try {
          const result = await request('/api/account/google', { credential: response.credential, nonce: challenge.nonce });
          token = result.token; verifiedToken = null; profile = null; pending = null; connected = false;
          // Keep the pending storage receipt untouched until the new identity is verified.
          if (mode === 'cloud') { hasCloudState = false; cloudBalance = null; document.querySelector('.workspace').style.visibility = 'hidden'; $('gold').textContent = $('gems').textContent = '—'; }
          storage.set(SESSION, JSON.stringify({token}), true);
          if (!storage.set(SESSION, JSON.stringify({token}))) throw Error('계정 세션을 저장할 수 없습니다. 브라우저의 저장 허용을 확인하세요.');
          busy = false; await useCloud();
        } catch (error) { if ($('login-message')) $('login-message').textContent = error.message; toast(error.message); busy = false; await prepareGoogle(); }
        finally { busy = false; renderButtons(); }
      } });
      google.accounts.id.renderButton($('google-host'), { type:'standard', theme:'outline', size:'large', text:'signin_with', locale:'ko', width:Math.min(320, $('modal-content').clientWidth) });
      $('login-message').textContent = 'Google로 로그인하면 계정의 모험 기록을 불러옵니다.';
    } catch (error) { if (version === loginGeneration && $('login-message')) $('login-message').textContent = error.message; }
  }
  function bind() {
    lobby = window.SchoolLobby?.create($('lobby-party'), {game:G, art:Art});
    social = createSocial();
    if ($('friends-button')) $('friends-button').onclick = () => social?.openFriends();
    if ($('arena-button')) $('arena-button').onclick = () => social?.openArena();
    if ($('winter-button')) $('winter-button').onclick = () => social?.openWinter();
    if ($('fullscreen-button')) $('fullscreen-button').onclick = toggleFullscreen;
    document.addEventListener('fullscreenchange', () => { refreshFullscreen(); updateOrientation(); });
    refreshFullscreen();
    for (const name of ['pointerup','pointercancel','blur']) window.addEventListener(name, () => { if (trainingHold) trainClickUntil = performance.now()+700; stopTraining(); });
    document.addEventListener('pointermove', event => { if (!trainingHold) return; const rect = $('train-hero')?.getBoundingClientRect(); if (!rect || event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) stopTraining(); });
    document.addEventListener('click', e => {
      const target = e.target.closest('button'); if (!target || target.disabled) return;
      if (target.dataset.tab) { setTab(target.dataset.tab); if (!['adventure','lobby'].includes(target.dataset.tab)) boardJump('party'); }
      if (target.dataset.lobbyAction) lobbyAction(target.dataset.lobbyAction);
      if (target.dataset.battleMode) changeBattleMode(target.dataset.battleMode);
      if (target.dataset.confirmBattleMode && !state.battle.activity) act({kind:'stage', stage:Number(target.dataset.confirmStage), mode:target.dataset.confirmBattleMode});
      if (target.dataset.boardJump) boardJump(target.dataset.boardJump);
      if (target.dataset.dungeon) { selectedDungeon = target.dataset.dungeon; dungeonRenderKey = ''; render(); }
      if (target.dataset.ranking) rankingModal(target.dataset.ranking);
      if (target.dataset.hero) heroDetail(target.dataset.hero);
      if (target.dataset.banner && G.BANNERS[target.dataset.banner]) { selectedBanner = target.dataset.banner; storage.set('school-pickup', selectedBanner); renderKey = ''; render(); }
      if (target.dataset.activityMode) enterActivity(target);
      if (target.hasAttribute('data-activity-exit')) act({kind:'activity-exit'});
      if (target.hasAttribute('data-activity-result')) showActivityResult(confirmedActivityResult);
      if (target.dataset.speed) act({kind:'speed', speed:Number(target.dataset.speed)});
      if (target.dataset.map !== undefined) stageMap();
      if (target.dataset.filter) { filter = target.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === filter)); renderKey = ''; render(); }
      if (target.dataset.action === 'quest') act({kind:'quest', quest:target.dataset.quest});
    });
    document.addEventListener('change', event => {
      const target = event.target;
      if (target.id === 'setting-theme') { theme = target.checked ? 'dark' : 'light'; applyPreferences(true); }
      if (target.id === 'setting-sound') { sound = target.checked; applyPreferences(true); play('tap'); }
      if (target.id === 'setting-motion') { reduced = target.checked; applyPreferences(true); }
      if (target.dataset.activityTier) { selectedTiers[target.dataset.activityTier] = Number(target.value); renderKey = ''; render(); }
      if (target.id === 'tower-floor') {
        const info = activityInfo(), floor = Number(target.value);
        if (!Number.isSafeInteger(floor) || floor < 1 || floor > info.tower.nextFloor) { toast(`1~${fmt(info.tower.nextFloor)}층을 선택해 주세요.`); target.value = selectedTowerFloor || info.tower.nextFloor; return; }
        selectedTowerFloor = floor; renderKey = '';
        $('tower-enter').dataset.floor = String(floor); $('tower-enter').textContent = `${fmt(floor)}층 도전`;
        document.querySelector('.tower-card .dungeon-reward').textContent = floor > info.tower.best ? `첫 클리어 · ${rewardText(info.tower.reward)}` : '클리어한 층은 골드·보석·경험치를 다시 지급하지 않아요.';
      }
    });
    $('dungeon-help').onclick = dungeonHelp;
    $('sound-button').onclick = () => { sound = !sound; applyPreferences(true); play('tap'); };
    $('battle-settings').onclick = settingsModal;
    $('settings-button').onclick = settingsModal; $('continue-landscape').onclick = dismissRotation; $('rotate-screen').onclick = attemptLandscape;
    $('tower-ranking-button').onclick = () => rankingModal('tower');
    window.addEventListener('resize', updateOrientation);
    $('account-button').onclick = accountModal; $('help-button').onclick = help; $('captain-button').onclick = captainModal;
    $('modal-close').onclick = () => closeModal(true);
    $('modal').addEventListener('cancel', event => { event.preventDefault(); closeModal(true); });
    $('modal').addEventListener('close', () => {
      stopTraining();
      if ($('modal').open) return;
      if (modalKind === 'dungeon-result') dismissedActivityResult = $('modal').dataset.activityResult || null;
      worldMap?.destroy(); worldMap = null; $('modal').classList.remove('world-map-modal');
      delete $('modal').dataset.activityResult; modalKind = ''; loginGeneration++; queueMicrotask(maybeShowActivityResult);
    });
    document.addEventListener('close', event => { if (event.target.id === 'school-presentation') queueMicrotask(maybeShowActivityResult); }, true);
    $('modal').addEventListener('click', e => { const r = $('modal').getBoundingClientRect(); if (e.target === $('modal') && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) closeModal(true); });
    $('stage-button').onclick = stageMap;
    $('feature-osia-button').onclick = () => heroDetail('osia');
    $('feature-lava-button').onclick = () => heroDetail('lava');
    $('battle-stage').onclick = () => state.activities?.run?.settled && confirmedActivityResult && !activityAwaitingConfirmation() ? showActivityResult(confirmedActivityResult) : state.battle.activity ? setTab('dungeons') : stageMap();
    $('battle-map').onclick = () => $('battle-stage').click();
    $('offline-strip').onclick = () => setTab('supplies'); $('claim-offline').onclick = () => act({kind:'offline'}); $('claim-daily').onclick = () => act({kind:'daily'});
    $('recruit-one').onclick = () => act({kind:'recruit', count:1, banner:selectedBanner}); $('recruit-ten').onclick = () => act({kind:'recruit', count:10, banner:selectedBanner}); $('rates-button').onclick = ratesModal;
    $('coupon-code').addEventListener('input', () => { couponMessage(''); renderButtons(); });
    $('coupon-form').addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || pending) { couponMessage('이전 요청의 저장을 확인하고 있어요. 잠시 기다려주세요.'); return; }
      if (mode === 'cloud' && (!connected || verifiedToken !== token)) { couponMessage('계정에 다시 연결한 뒤 코드를 입력해 주세요.', 'error'); sync(true); return; }
      const code = $('coupon-code').value.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{1,32}$/.test(code)) { couponMessage('영문 코드와 숫자, _ 또는 -를 입력해 주세요.', 'error'); return; }
      $('coupon-code').value = code; couponMessage('코드와 보상을 확인 중…');
      await act({kind:'redeem', code});
    });
    $('log-button').onclick = damageModal; $('log-button').setAttribute('aria-label','전투 딜량 확인'); $('log-button').title = '전투 기여도';
    $('history-button').onclick = () => openModal('최근 모집 기록', state.history.length ? state.history.map(r => `<div class="history-row">${portrait(r.id)}${rarity(r.id)}<b>${G.BY_ID[r.id].name}</b><small>${r.fresh ? '첫 만남' : `조각 +${r.shards}`}</small></div>`).join('') : '<p class="modal-copy">아직 모집한 용병이 없어요.</p>', 'history');
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopTraining();
      if (mode === 'guest') guestUpdate().catch(() => {});
      else if (!document.hidden) sync(true);
    });
    // Visible guest changes are already committed; these checkpoints cover the
    // fractional elapsed time without relying on an unload promise succeeding.
    window.addEventListener('pagehide', () => { if (mode === 'guest') guestUpdate().catch(() => {}); });
    window.addEventListener('pageshow', () => { if (mode === 'guest') guestUpdate().catch(() => {}); else sync(true); });
    window.addEventListener('online', () => sync(true));
    window.addEventListener('school-art-ready', () => { lobby?.invalidate(); renderKey = partyKey = ''; $('feature-osia').src = Art.portrait('osia'); $('feature-lava').src = Art.portrait('lava'); render(); if (modalKind === 'hero' && ['osia','lava'].includes(selectedHero)) heroDetail(selectedHero); });
    window.addEventListener('storage', e => { if (e.key === SESSION && !e.newValue) { clearLogin(); connected = mode !== 'cloud'; if (mode === 'cloud') { note('다른 창에서 로그아웃했어요. 계정 메뉴에서 다시 로그인할 수 있어요.'); renderButtons(); } } if (e.key === SAVE && mode === 'guest' && !busy) guestUpdate().catch(() => {}); });
  }
  async function boot() {
    applyPreferences();
    const wantsCloud = storage.get(MODE) === 'cloud';
    showBoot(wantsCloud ? '계정 기록을 확인하고 있어요' : '기기에 저장된 모험을 불러와요');
    if (wantsCloud) {
      mode = 'cloud'; connected = false;
      try {
        sessionFingerprint = await tokenFingerprint(token);
        const cache = JSON.parse(storage.get(CLOUD_CACHE, true) || 'null');
        // Server views deliberately omit private action receipts.
        if (sessionFingerprint && cache?.sessionFingerprint === sessionFingerprint && cache?.profile?.id && cache.state && G.validate({ ...cache.state, receipts: [] })) {
          rememberActivityResult(cache.state); profile = cache.profile; state = cache.state; revision = cache.revision; hasCloudState = true;
          cloudBalance = { gold: state.gold, gems: state.gems, winter: state.winter ? G.clone(state.winter) : null }; lastSeq = state.seq;
        }
      } catch {}
      if (!state) { state = freshGuest(); document.querySelector('.workspace').style.visibility = 'hidden'; $('gold').textContent = $('gems').textContent = '—'; }
      saveStatus('saving', '계정 불러오는 중');
    } else {
      try { await guestUpdate(); lastSeq = state.seq; }
      catch (error) {
        // Keep account/recovery controls available while preserving the original.
        state = freshGuest(); document.querySelector('.workspace').style.visibility = 'hidden';
        $('gold').textContent = $('gems').textContent = '—'; note(error.message);
      }
    }
    showBoot('용병과 전장을 준비하고 있어요');
    await Art.ready;
    $('feature-osia').src = Art.portrait('osia'); $('feature-lava').src = Art.portrait('lava'); $('recruit-count').textContent = '상시 오시아 · 한정 라바';
    clientReady = true; bind(); setTab('lobby', false); refreshSound(); renderButtons();
    if (!guestSaveFailed && (!wantsCloud || hasCloudState)) render();
    if (wantsCloud) {
      showBoot('서버의 최신 기록을 확인하고 있어요');
      if (token) await useCloud(); else { saveStatus('error', '로그인 필요'); note('계정 기록을 이어 하려면 계정 메뉴에서 Google로 로그인하세요. 게스트 기록으로 자동 전환하지 않습니다.'); }
    }
    finishBoot();
    setInterval(() => {
      if (document.hidden || !state) return;
      if (mode === 'guest' && Date.now() - lastGuestTick >= 250 && !busy && !guestTickPending && (!guestSaveFailed || Date.now() - lastSave > 2000)) {
        lastGuestTick = Date.now(); guestTickPending = true; guestUpdate().then(() => { document.querySelector('.workspace').style.visibility = ''; }).catch(() => {}).finally(() => { guestTickPending = false; });
      }
      // Saving serializes account actions, not the deterministic combat preview.
      // Only confirmed balances are spendable; applyCloud reconciles the result.
      if (mode === 'cloud' && hasCloudState && connected) { advanceCloudPreview(); consumeEvents(); render(); }
      if (mode === 'cloud' && token && Date.now() - lastSync > 3000) { lastSync = Date.now(); sync(); }
    }, 250);
    let canvas = $('battle'), ctx = canvas.getContext('2d', {alpha:false, desynchronized:true});
    let nextDrawAt = 0, drawInterval = 0, canvasSizeDirty = true, canvasDpr = 0;
    let rasterScale = 1, previousRaf = 0, sampleStarted = 0, sampleFrames = 0, slowFrames = 0, drawCost = 0, drawSamples = 0, lastScaleChange = 0;
    let frameId = 0, recoveryTimer = 0, retryDrawAt = 0, failedDraws = 0, recoveryTried = false;
    const resizeObserver = window.ResizeObserver ? new ResizeObserver(() => { canvasSizeDirty = true; }) : null;
    function recoveryNotice(message) {
      setHidden($('battle-recovery'), !message);
      if (message) setText('battle-recovery-message', message);
    }
    function recordDrawingError(error) {
      graphics.failures++;
      graphics.lastError = `${error.name || 'Error'}: ${error.message || '그리기 실패'}`.slice(0,240);
    }
    function resetDrawing() {
      try { Art.resetRenderCache?.(); } catch (error) { recordDrawingError(error); }
      canvasSizeDirty = true; nextDrawAt = 0; retryDrawAt = 0; previousRaf = 0;
      previousPaint = 0; previousAnimation = null;
      if (ctx) ctx.imageSmoothingEnabled = false;
    }
    function trackCanvas(target) {
      resizeObserver?.observe(target);
      target.addEventListener('contextlost', event => {
        if (target !== canvas) return;
        // Unlike WebGL, cancelling a 2D contextlost event prevents restoration.
        graphics.lost = true; graphics.losses++;
        recoveryNotice('전투 화면을 복구하고 있어요.');
        clearTimeout(recoveryTimer);
        recoveryTimer = setTimeout(() => { if (graphics.lost && !document.hidden) repairBattle(); }, 1800);
      });
      target.addEventListener('contextrestored', () => {
        if (target !== canvas) return;
        clearTimeout(recoveryTimer); graphics.lost = false; graphics.recoveries++;
        resetDrawing(); // Offscreen sprite/background surfaces may have been lost too.
      });
    }
    repairBattle = (manual = false) => {
      if (document.hidden) return false;
      clearTimeout(recoveryTimer);
      const replacement = canvas.cloneNode(false), nextContext = replacement.getContext('2d', {alpha:false});
      if (!nextContext) { recoveryNotice('전투 화면을 열지 못했어요. 문제 정보를 확인해 주세요.'); return false; }
      resizeObserver?.unobserve(canvas); canvas.replaceWith(replacement); canvas = replacement; ctx = nextContext;
      graphics.lost = false; graphics.recoveries++; failedDraws = 0; recoveryTried = true;
      trackCanvas(canvas); resetDrawing();
      cancelAnimationFrame(frameId); frameId = requestAnimationFrame(animate);
      recoveryNotice('전투 화면을 다시 그리고 있어요.');
      if (manual) toast('전투 화면을 다시 준비했어요.');
      return true;
    };
    $('recover-battle').onclick = () => repairBattle(true);
    trackCanvas(canvas);
    function fitBattleCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!canvasSizeDirty && canvasDpr === dpr) return true;
      const box = canvas.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) return false;
      // Panoramic battles use the full visible canvas; the art layer keeps
      // characters uniformly scaled. Legacy surfaces retain their 12:7 fit.
      const panorama = canvas.dataset.layout === 'panorama';
      const fitWidth = panorama ? box.width : Math.min(box.width, box.height * 12 / 7);
      const width = Math.max(1, Math.round(Math.min(fitWidth * dpr * rasterScale, 2880)));
      const height = Math.max(1, Math.round(panorama ? width * box.height / box.width : width * 7 / 12));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width; canvas.height = height; if (ctx) ctx.imageSmoothingEnabled = false;
      }
      canvasDpr = dpr; canvasSizeDirty = false; return true;
    }
    window.addEventListener('resize', () => { canvasSizeDirty = true; });
    window.visualViewport?.addEventListener('resize', () => { canvasSizeDirty = true; });
    function resumeDrawing() {
      if (document.hidden) return;
      canvasSizeDirty = true; nextDrawAt = 0; previousRaf = 0;
      previousPaint = 0; previousAnimation = null;
      if (graphics.lost || ctx?.isContextLost?.()) repairBattle();
      cancelAnimationFrame(frameId); frameId = requestAnimationFrame(animate);
    }
    window.addEventListener('pageshow', resumeDrawing);
    document.addEventListener('visibilitychange', resumeDrawing);
    document.addEventListener('fullscreenchange', () => { canvasSizeDirty = true; });
    function animate(time) {
      frameId = requestAnimationFrame(animate); graphics.lastFrame = performance.now();
      if (document.hidden || tab !== 'adventure' || resultPresentationBusy() || $('modal').open || !$('rotate-prompt').hidden) { nextDrawAt = 0; previousRaf = 0; previousPaint = 0; previousAnimation = null; sampleStarted = 0; sampleFrames = slowFrames = drawCost = drawSamples = 0; return; }
      if (graphics.lost || time < retryDrawAt) return;
      if (previousRaf && time - previousRaf < 300) { sampleFrames++; if (time - previousRaf > 25) slowFrames++; }
      previousRaf = time; sampleStarted ||= time;
      if (time - sampleStarted >= 2000 && sampleFrames > 12) {
        const burden = slowFrames / sampleFrames, meanDraw = drawCost / Math.max(1,drawSamples);
        const nextScale = burden > .22 || meanDraw > 9 ? Math.max(.6,rasterScale*.85) : burden < .04 && meanDraw < 5 && time-lastScaleChange > 12000 ? Math.min(1,rasterScale+.05) : rasterScale;
        if (nextScale !== rasterScale) { rasterScale = nextScale; canvasSizeDirty = true; lastScaleChange = time; canvas.dataset.renderScale = rasterScale.toFixed(2); }
        sampleStarted = time; sampleFrames = slowFrames = drawCost = drawSamples = 0;
      }
      // Reduced motion removes flashes and large movements, not smooth timing.
      const interval = 1000 / 60;
      if (interval !== drawInterval) { drawInterval = interval; nextDrawAt = 0; }
      if (time + .25 < nextDrawAt) return;
      // Carry the cadence across 90/144Hz refreshes, but never replay missed frames.
      nextDrawAt = !nextDrawAt || time - nextDrawAt > interval * 4 ? time + interval : nextDrawAt + Math.max(1, Math.floor((time - nextDrawAt) / interval) + 1) * interval;
      if (fitBattleCanvas()) {
        const began = performance.now();
        try {
          if (!ctx || ctx.isContextLost?.()) throw Error('전투 화면의 그래픽 연결이 끊겼어요.');
          // The 250ms UI timer can run just before a 500ms combat step. Waiting
          // for its next tick then pins animationTime at the step boundary for
          // up to 250ms. Catch up only due steps before painting, without DOM
          // work or network requests; confirmed balances stay clamped as usual.
          if (mode === 'cloud' && hasCloudState && connected && serverNow()-state.at >= 500) { advanceCloudPreview(); consumeEvents(); }
          const visualTime = animationTime();
          Art.draw(ctx, state, visualTime, effects, reduced);
          graphics.frames++; graphics.lastDraw = performance.now(); failedDraws = 0; recoveryTried = false;
          recordFrameTiming(graphics.lastDraw, graphics.lastDraw-began, visualTime);
          recoveryNotice(''); drawCost += performance.now()-began; drawSamples++;
        } catch (error) {
          recordDrawingError(error); failedDraws++;
          retryDrawAt = time + 1000;
          recoveryNotice('전투 화면 오류 · 설정에서 문제 정보를 확인할 수 있어요.');
          if (!recoveryTried && failedDraws === 1) { recoveryTried = true; queueMicrotask(() => repairBattle()); }
        }
      }
    }
    frameId = requestAnimationFrame(animate);
  }
  boot().catch(error => { $('boot-screen').hidden = true; $('rotate-prompt').hidden = true; $('app').inert = false; saveStatus('error', '저장 확인 필요'); note(error.message || '게임을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.', 'reload'); console.error(error); });
})();
