(() => {
  'use strict';
  const G = window.SchoolRPG, Art = window.SchoolArt, $ = id => document.getElementById(id);
  const BASE = 'https://motracv-card-room.densedormouse4.chatgpt.site';
  const SAVE = 'school-mercenaries-v6', LEGACY_SAVES = ['school-mercenaries-v5', 'school-mercenaries-v4', 'school-mercenaries-v3', 'school-mercenaries-v2', 'school-mercenaries-v1'], MODE = 'school-save-mode', SESSION = `card-account:${BASE}`, PENDING = 'school-pending-action';
  const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => Math.floor(n).toLocaleString('ko-KR');
  const duration = seconds => seconds >= 3600 ? `${Math.floor(seconds / 3600)}시간 ${Math.floor(seconds % 3600 / 60)}분` : `${Math.floor(seconds / 60)}분`;
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const portrait = (id, cls = '') => `<img class="${cls}" src="${Art.portrait(id)}" alt="${G.BY_ID[id].name}">`;
  const rarity = id => `<span class="rarity ${G.BY_ID[id].rarity}">${G.BY_ID[id].rarity}</span>`;
  const storage = { get(key, session = false) { try { return (session ? sessionStorage : localStorage).getItem(key); } catch { return null; } }, set(key, value, session = false) { try { (session ? sessionStorage : localStorage).setItem(key, value); return true; } catch { return false; } }, remove(key, session = false) { try { (session ? sessionStorage : localStorage).removeItem(key); } catch {} } };
  let state, mode = 'guest', profile = null, token = null, revision = 0, offset = 0, busy = false, pending = null, connected = true;
  let tab = 'adventure', filter = 'owned', selectedHero = null, modalKind = '', lastSeq = 0, effects = [], toastTimer, sdkPromise, loginGeneration = 0;
  let selectedBanner = storage.get('school-pickup') === 'lava' ? 'lava' : 'osia';
  let sound = storage.get('school-sound') === 'on', audio, renderKey = '', partyKey = '', lastSave = 0, lastSync = 0;
  const CLOUD_CACHE = 'school-confirmed-cloud-view';
  let guestQueue = Promise.resolve(), guestTickPending = false, guestSaveFailed = false, mutexDatabase;
  let cloudBalance = null, hasCloudState = false, hasGuestState = false, clientReady = false, verifiedToken = null, sessionFingerprint = null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { token = JSON.parse(storage.get(SESSION, true) || 'null')?.token || null; } catch {}

  function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3400); }
  function couponMessage(message, status = '') {
    $('coupon-message').textContent = message; $('coupon-message').dataset.state = status;
  }
  function note(message, retry = false) {
    $('connection').hidden = !message;
    $('connection').textContent = message || '';
    if (retry) { const b = document.createElement('button'); b.textContent = retry === 'reload' ? '새로고침' : '다시 연결'; b.onclick = () => retry === 'reload' ? location.reload() : sync(true); $('connection').append(b); }
  }
  function play(kind, stage = 4) {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(() => {});
      const frequencies = kind === 'water' ? [[392], [440, 587], [523, 659, 784], [196, 392, 587, 784, 1175]][stage - 1] : kind === 'rare' ? [440, 554, 659, 880] : kind === 'reward' ? [523, 659, 784] : kind === 'level' ? [392, 523, 659] : [440];
      frequencies.forEach((hz, i) => { const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + i * .09; osc.type = 'triangle'; osc.frequency.value = hz; gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.045, t + .01); gain.gain.exponentialRampToValueAtTime(.001, t + .18); osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + .2); });
    } catch {}
  }
  function refreshSound() { $('sound-button').classList.toggle('muted', !sound); $('sound-button').setAttribute('aria-label', `효과음 ${sound ? '끄기' : '켜기'}`); $('sound-button').setAttribute('aria-pressed', String(sound)); }
  function freshGuest() { return G.create(Date.now(), crypto.getRandomValues(new Uint32Array(1))[0]); }
  function saveStatus(status, message) {
    const el = $('save-status'); if (!el) return;
    el.dataset.state = status; el.textContent = message;
    el.title = message;
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
      if (saved) return { saved, raw: null };
      if (!storage.get(SAVE + '-recovery')) storage.set(SAVE + '-recovery', legacy);
      throw Error('이전 기기 저장을 읽지 못했습니다. 원본을 유지했습니다. 계정 메뉴에서 저장을 확인하세요.');
    }
    return { saved: freshGuest(), raw: null };
  }
  function readGuest() { return readGuestRecord().saved; }
  function writeGuest(next, previousRaw) {
    const current = JSON.stringify(next);
    if (current === previousRaw) return;
    next._saveRevision = (Number.isSafeInteger(next._saveRevision) ? next._saveRevision : 0) + 1;
    if (validSave(previousRaw)) storage.set(SAVE + '-backup', previousRaw);
    if (!storage.set(SAVE, JSON.stringify(next))) throw Error('자동 저장에 실패했습니다. 재화는 사용하지 않았습니다. 저장 공간·브라우저 설정을 확인한 뒤 다시 눌러주세요.');
    storage.set(SAVE + '-backup', JSON.stringify(next));
  }
  function guestLock(update) {
    if (navigator.locks) return navigator.locks.request('school-guest-save', update);
    // IndexedDB's exclusive transaction coordinates tabs on older browsers too.
    mutexDatabase ||= new Promise((resolve, reject) => {
      const request = indexedDB.open('school-save-coordination', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('locks');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { mutexDatabase = null; reject(Error('안전한 기기 저장을 열지 못했습니다. 브라우저 저장 설정을 확인하세요.')); };
    });
    return mutexDatabase.then(db => new Promise((resolve, reject) => {
      const tx = db.transaction('locks', 'readwrite'); let result, completed = false, failure;
      tx.objectStore('locks').get('guest').onsuccess = () => {
        try { result = update(); completed = true; } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => completed ? resolve(result) : reject(failure || Error('기기 저장을 잠시 사용할 수 없습니다. 다시 시도하세요.'));
    }));
  }
  function guestUpdate(input) {
    const update = () => {
      if (mode !== 'guest') return;
      const record = readGuestRecord(), next = record.saved;
      G.advance(next, Date.now());
      let result = null, actionError;
      if (input) try { result = G.action(next, input); } catch (error) { error.guestAction = true; actionError = error; }
      // Commit first: displayed rewards and successful actions are always durable.
      const recoveredWrite = guestSaveFailed;
      writeGuest(next, record.raw); state = next; hasGuestState = true; guestSaveFailed = false; lastSave = Date.now();
      saveStatus('saved', '기기 저장 완료');
      if (record.recovered) note('자동 저장 사본에서 기록을 복구했습니다.');
      else if (recoveredWrite) note('');
      consumeEvents(); if (clientReady) render(); if (actionError) throw actionError; return result;
    };
    const task = guestQueue.then(() => guestLock(update));
    guestQueue = task.catch(() => {});
    return task.catch(error => {
      if (!error.guestAction) { guestSaveFailed = true; lastSave = Date.now(); saveStatus('error', '저장 확인 필요'); note(error.message); }
      throw error;
    });
  }
  function advanceCloudPreview() {
    if (!hasCloudState) return;
    G.advance(state, Date.now() + offset);
    // Combat may be predicted, but unconfirmed currency must never look spendable.
    state.gold = cloudBalance.gold; state.gems = cloudBalance.gems;
  }
  async function tokenFingerprint(value) {
    if (!value) return null;
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  async function request(path, data, auth = 'school') {
    let response;
    const payload = path.startsWith('/api/school/') ? { ...data, catalogVersion: G.CATALOG_VERSION } : data || {};
    try {
      response = await fetch(BASE + path, { method: path.endsWith('/config') ? 'GET' : 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(token ? auth === 'school' ? { 'X-Account-Session': token } : { Authorization: `Bearer ${token}` } : {}) }, ...(path.endsWith('/config') ? {} : { body: JSON.stringify(payload) }), signal: AbortSignal.timeout(14000) });
    } catch { throw Error('저장 서버에 연결하지 못했습니다. 연결 후 다시 시도하세요.'); }
    let body; try { body = await response.json(); } catch { throw Error('저장 서버의 응답을 읽지 못했습니다.'); }
    if (!response.ok && !body.conflict) throw Object.assign(Error(body.error || '요청을 처리하지 못했습니다.'), { status: response.status });
    return body;
  }
  function applyCloud(body) {
    state = body.state; revision = body.revision; offset = body.serverTime - Date.now(); connected = true; hasCloudState = true;
    cloudBalance = { gold: state.gold, gems: state.gems };
    storage.set(CLOUD_CACHE, JSON.stringify({profile, state, revision, serverTime:body.serverTime, sessionFingerprint}), true);
    document.querySelector('.workspace').style.visibility = '';
    advanceCloudPreview(); consumeEvents(); render(); note(''); saveStatus('saved', '계정 저장 완료');
  }
  function clearPending() { pending = null; storage.remove(PENDING, true); }
  async function sendPending() {
    if (!token || verifiedToken !== token || !profile || pending?.accountId !== profile.id) throw Object.assign(Error('계정 연결을 다시 확인한 뒤 요청을 이어갑니다.'), {status:401});
    const body = await request('/api/school/action', pending);
    if (body.conflict) {
      // An expired receipt can belong to an already committed action. Changing
      // its revision would turn a lost response into a second purchase.
      applyCloud(body); clearPending();
      throw Object.assign(Error('다른 기기 진행을 불러왔어요. 보유 재화와 결과를 확인한 뒤 다시 눌러주세요.'), {confirmedConflict:true});
    }
    clearPending(); applyCloud(body); return body.result;
  }
  async function sync(manual = false) {
    if (mode !== 'cloud' || busy || (!manual && document.hidden)) return;
    if (!profile || verifiedToken !== token) return useCloud();
    const checkingCoupon = pending?.action.kind === 'redeem';
    busy = true; renderButtons(); saveStatus('saving', '계정 저장 중');
    try {
      if (pending) { const result = await sendPending(); showResult(result); }
      else applyCloud(await request('/api/school/state'));
      lastSync = Date.now();
    } catch (error) {
      if (error.confirmedConflict) { if (checkingCoupon) couponMessage(error.message, 'error'); toast(error.message); return; }
      connected = false;
      saveStatus('error', '계정 연결 대기');
      if (error.status === 401) { token = null; verifiedToken = null; storage.remove(SESSION, true); }
      if (error.status && error.status < 500 && ![409, 426].includes(error.status)) clearPending();
      if (checkingCoupon) couponMessage(pending ? '보상 저장을 확인 중입니다. 연결되면 같은 요청을 이어 확인합니다.' : error.message, pending ? 'pending' : 'error');
      note(error.status === 426 ? error.message : error.status === 401 ? '로그인이 만료되었습니다. 계정 메뉴에서 다시 연결하세요.' : '계정 저장 연결을 기다리고 있어요. 재화 사용은 연결 후 계속됩니다.', error.status === 426 ? 'reload' : true);
      if (manual) toast(error.message);
    } finally { busy = false; renderButtons(); }
  }
  async function act(input) {
    if (busy || pending) { toast('이전 요청을 확인하고 있어요. 잠시 기다려주세요.'); return; }
    if (mode === 'cloud' && (!connected || verifiedToken !== token)) { sync(true); return; }
    busy = true; renderButtons(); saveStatus('saving', mode === 'cloud' ? '계정 저장 중' : '기기 저장 중');
    try {
      let result;
      if (mode === 'cloud') {
        pending = { action: input, revision, requestId: crypto.randomUUID().replaceAll('-', ''), accountId: profile.id };
        if (!storage.set(PENDING, JSON.stringify(pending), true)) { pending = null; throw Error('이 브라우저는 안전한 요청 저장을 지원하지 않습니다. 일반 브라우저에서 다시 시도하세요.'); }
        result = await sendPending(); lastSync = Date.now();
      } else result = await guestUpdate(input);
      showResult(result);
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
    } finally { busy = false; renderButtons(); }
  }
  function showResult(result) {
    if (!result) return;
    if (result.kind === 'recruit') { reveal(result.results); play(result.results.some(r => G.BY_ID[r.id].rarity === 'SSR') ? 'rare' : 'reward'); }
    else if (result.kind === 'redeem') {
      const message = `${result.code} · 보석 +${fmt(result.gems)} · 코인 +${fmt(result.gold)} 수령 완료!`;
      $('coupon-code').value = ''; couponMessage(message, 'success'); toast(message); play('reward');
    }
    else if (result.kind === 'train') { toast(`${G.BY_ID[result.hero].name} Lv.${result.level}!`); heroDetail(result.hero); play('level'); }
    else if (result.kind === 'awaken') { toast(`${G.BY_ID[result.hero].name} ${result.stars}성 각성!`); heroDetail(result.hero); play('rare'); }
    else if (result.kind === 'team') { closeModal(); toast('새 편성으로 출발합니다. 맨 앞 용병이 주로 공격을 받아요.'); }
    else if (result.kind === 'speed') { toast(`전투 속도 ${result.speed.toFixed(1)}×`); }
    else if (result.kind === 'stage') { closeModal(); setTab('adventure'); toast('선택한 지역으로 출발합니다.'); }
    else if (result.kind === 'offline') { toast(`골드 +${fmt(result.reward.gold)} · 용병마다 경험치 +${fmt(result.reward.xp)}`); play('reward'); if (modalKind === 'offline') closeModal(); }
    else { toast(`골드 +${fmt(result.gold)} · 보석 +${fmt(result.gems)}`); play('reward'); }
    render();
  }
  function animationTime() {
    const running = mode === 'cloud' ? hasCloudState && connected : hasGuestState && !guestSaveFailed;
    const wall = Date.now() + (mode === 'cloud' ? offset : 0);
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
      if (e.kind === 'clear') { toast(`${G.stageName(e.stage)} 클리어! 보석 +60`); play('reward'); }
      if (e.kind === 'captain') { toast(`단장 레벨 ${e.level}! 보석 +30`); play('level'); }
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
  function setTab(next) {
    if (!['adventure', 'roster', 'recruit', 'supplies'].includes(next)) return;
    tab = next; $('app').dataset.tab = tab;
    for (const name of ['adventure', 'roster', 'recruit', 'supplies']) $('tab-' + name).hidden = name !== tab;
    document.querySelectorAll('.bottom-nav>button').forEach(b => { const active = b.dataset.tab === (tab === 'roster' ? 'adventure' : tab); b.classList.toggle('active', active); if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.querySelector('.content-panel').scrollTop = 0; document.querySelector('.workspace').scrollTop = 0; renderKey = ''; render();
  }
  function render() {
    if (!state) return;
    $('gold').textContent = fmt(state.gold); $('gems').textContent = fmt(state.gems);
    $('captain-level').textContent = `Lv.${state.captain.level}`;
    $('captain-xp').style.width = `${state.captain.level === 50 ? 100 : state.captain.xp / G.captainNeed(state.captain.level) * 100}%`;
    $('account-label').textContent = mode === 'cloud' ? '계정 저장' : '게스트'; $('account-button').classList.toggle('cloud', mode === 'cloud');
    $('stage-number').textContent = G.stageName(state.battle.stage); $('stage-name').textContent = G.CHAPTERS[G.chapter(state.battle.stage)];
    $('wave-label').textContent = state.battle.boss ? 'BOSS · ' + G.BOSSES[G.chapter(state.battle.stage)] : `WAVE ${state.battle.wave} / 4`;
    $('wave-label').classList.toggle('boss', state.battle.boss);
    $('power').textContent = `전투력 ${fmt(G.power(state))}`;
    $('battle-status').textContent = state.mode === 'farm' ? '반복 사냥 중 · 지도를 열어 다음 지역에 도전' : state.battle.phase === 'defeat' ? '다시 도전 중 · 용병을 훈련해 보세요.' : '자동 전투 · 승리할 때마다 경험치를 받아요.';
    const osia = state.battle.heroes.find(h => h.id === 'osia' && h.hp > 0);
    if (osia && state.battle.phase === 'fight') {
      const cast = state.battle.osiaCast, next = G.osiaSkill(state);
      $('battle-status').textContent = cast ? `오시아 스킬 ${cast.stage}/4 · ${G.OSIA_SKILLS[cast.stage-1].name} 시전 중` : `오시아 다음 ${next.stage}/4 · ${next.name} · 충전 ${Math.max(0, G.BY_ID.osia.cooldown - osia.energy)}초`;
    }
    const pk = state.team.join('|');
    if (pk !== partyKey) { partyKey = pk; $('party').innerHTML = state.team.map(id => `<button class="party-card" data-hero="${id}" aria-label="${G.BY_ID[id].name} 상세 정보">${portrait(id)}<span class="party-info"><b>${G.BY_ID[id].name}</b><small></small><span class="party-hp"><i></i></span></span></button>`).join(''); }
    document.querySelectorAll('.party-card').forEach(el => { const id = el.dataset.hero, h = state.battle.heroes.find(h => h.id === id), u = state.units[id]; el.querySelector('small').textContent = `Lv.${u.level} · ${G.BY_ID[id].role}`; el.querySelector('i').style.width = `${h ? Math.max(0, h.hp / h.max) * 100 : 100}%`; el.classList.toggle('fallen', !!h && h.hp <= 0); });
    $('offline-summary').textContent = state.offline.seconds ? `${duration(state.offline.seconds)} · 골드 ${fmt(state.offline.gold)} 수령 가능` : '자리를 비워도 최대 8시간까지';
    const key = JSON.stringify([tab, filter, state.units, state.team, state.best, state.stage, state.mode, state.offline, state.claimed, state.daily, state.pulls, state.banners, state.pity, selectedBanner, G.bannerAvailable(selectedBanner, Date.now() + (mode === 'cloud' ? offset : 0)), state.captain.level]);
    if (key !== renderKey) {
      renderKey = key;
      if (tab === 'adventure') renderChapters();
      if (tab === 'roster') renderRoster();
      if (tab === 'recruit') {
        const banner = G.BANNERS[selectedBanner], progress = G.bannerState(state, selectedBanner);
        $('pity-left').textContent = G.RECRUIT_PITY.hard - progress.pity; $('pity-count').textContent = `${progress.pity} / ${G.RECRUIT_PITY.hard}`; $('pity-bar').style.width = `${progress.pity / G.RECRUIT_PITY.hard * 100}%`;
        $('next-ssr-chance').textContent = `다음 SSR ${Math.round(G.recruitRates(progress.pity).SSR * 100)}%`;
        $('pity-phase').textContent = progress.pity >= G.RECRUIT_PITY.soft - 1 ? '확률 상승 적용 중' : '60회째부터 매회 +1%p';
        $('banner-status').textContent = progress.guaranteed ? `다음 SSR은 ${G.BY_ID[banner.featured].name} 확정` : `SSR 등장 시 ${G.BY_ID[banner.featured].name} 50% · 픽뚫 후 다음 SSR 확정`;
        $('banner-deadline').textContent = banner.limited ? (G.bannerAvailable(selectedBanner, Date.now() + (mode === 'cloud' ? offset : 0)) ? '11월 20일 23:59까지 · 한국 시간' : '종료된 픽업입니다. 상시 오시아 픽업을 선택해 주세요.') : '상시 픽업 · 배너별 확정 누적 별도 보관';
        document.querySelectorAll('[data-banner]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.banner === selectedBanner)));
      }
      if (tab === 'supplies') renderSupplies();
    }
    $('recruit-dot').hidden = state.gems < 900;
    $('supply-dot').hidden = !(state.offline.seconds || state.daily < G.day(Date.now() + offset) || G.QUESTS.some(q => !state.claimed.includes(q.id) && G.questValue(state, q) >= q.goal));
    renderButtons();
  }
  function renderButtons() {
    if (!state) return; const blocked = busy || !!pending || (mode === 'guest' && !hasGuestState) || (mode === 'cloud' && !connected);
    const bannerClosed = !G.bannerAvailable(selectedBanner, Date.now() + (mode === 'cloud' ? offset : 0));
    $('recruit-one').disabled = blocked || bannerClosed || state.gems < 100; $('recruit-ten').disabled = blocked || bannerClosed || state.gems < 900;
    document.querySelectorAll('[data-speed]').forEach(button => { button.disabled = blocked; button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === (state.speed || 1))); });
    $('claim-offline').disabled = blocked || !state.offline.seconds;
    $('claim-daily').disabled = blocked || state.daily >= G.day(Date.now() + offset);
    $('redeem-code').disabled = blocked || !$('coupon-code').value.trim();
    $('redeem-code').textContent = pending?.action.kind === 'redeem' ? '확인 중…' : '보상 받기';
    document.querySelectorAll('[data-action]').forEach(b => { b.disabled = blocked || b.dataset.unavailable === 'true'; });
    if (modalKind === 'hero' && selectedHero && state.units[selectedHero]) {
      const u = state.units[selectedHero]; const train = $('train-hero'), awaken = $('awaken-hero');
      if (train) train.disabled = blocked || u.level >= G.MAX_LEVEL || state.gold < G.trainingCost(u);
      if (awaken) awaken.disabled = blocked || u.stars >= 5 || u.shards < G.awakeningCost(u);
      const st = G.stats(selectedHero, u), cost = G.trainingCost(u), shards = G.awakeningCost(u);
      if ($('hero-level')) {
        $('hero-level').textContent = u.level; $('hero-hp').textContent = fmt(st.hp); $('hero-atk').textContent = fmt(st.atk);
        $('hero-gold').textContent = fmt(state.gold); $('hero-xp').textContent = u.level === G.MAX_LEVEL ? '최대 레벨' : `경험치 ${fmt(u.xp)} / ${fmt(G.needXp(u.level))}`;
        $('train-cost').textContent = u.level === G.MAX_LEVEL ? '최대 레벨' : `골드 ${fmt(cost)}`;
        $('awaken-cost').textContent = u.stars === 5 ? '최대 각성' : `조각 ${fmt(shards)} / 보유 ${fmt(u.shards)}`;
        $('hero-stars').textContent = `각성 ${u.stars} / 5성`; $('hero-shards').textContent = `조각 ${fmt(u.shards)}개`;
        $('training-status').textContent = pending ? '이전 요청의 저장을 확인하고 있어요.' : busy ? '저장 확인 중…' : mode === 'cloud' && !connected ? '서버에 다시 연결하면 육성할 수 있어요.' : u.level === G.MAX_LEVEL ? '최대 레벨에 도달했어요.' : state.gold < cost ? `훈련에 골드 ${fmt(cost - state.gold)}가 더 필요해요.` : `훈련하면 Lv.${u.level + 1} · 골드 ${fmt(cost)} 사용`;
      }
    }
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
    $('offline-detail').innerHTML = state.offline.seconds ? `<b>${duration(state.offline.seconds)}의 모험</b><br>골드 ${fmt(state.offline.gold)} · 용병마다 경험치 ${fmt(state.offline.xp)}` : '90초 넘게 자리를 비우면<br>다시 돌아올 때 보상을 모아 드려요.';
    const rate = G.rates(state); $('offline-rate').textContent = `분당 골드 ${rate.gold} · 용병 경험치 ${rate.xp} / 최고 클리어 지역 기준`;
    $('claim-daily').textContent = state.daily >= G.day(Date.now() + offset) ? '수령 완료' : '받기';
    $('quests').innerHTML = G.QUESTS.map(q => { const value = Math.min(q.goal, G.questValue(state, q)), done = state.claimed.includes(q.id); return `<div class="quest ${done ? 'done' : ''}"><div class="quest-info"><b>${q.name}</b><small>${q.desc} · 골드 ${fmt(q.gold)} / 보석 ${q.gems}</small><div class="quest-progress">${value} / ${q.goal}</div></div><button class="secondary" data-action="quest" data-quest="${q.id}" data-unavailable="${done || value < q.goal}">${done ? '완료' : '받기'}</button></div>`; }).join('');
  }
  function openModal(title, html, kind = '') {
    loginGeneration++; modalKind = kind; $('modal-title').textContent = title; $('modal-content').innerHTML = html;
    if (!$('modal').open) $('modal').showModal(); $('modal').scrollTop = 0;
  }
  function closeModal() { $('modal').close(); modalKind = ''; loginGeneration++; }
  function heroDetail(id) {
    const h = G.BY_ID[id], u = state.units[id]; if (!h) return; selectedHero = id;
    const st = G.stats(id, u || {level:1, stars:0});
    const skills = `<details class="hero-skills" ${u ? '' : 'open'}><summary>스킬 · 패시브</summary><div class="skill-box"><b>${h.skill} <span>· ${h.cooldown}초 충전</span></b>${h.desc}</div>${h.passive ? `<div class="skill-box passive-box"><b>패시브 · ${h.passive}</b>${h.passiveDesc}</div>` : ''}${h.passive2 ? `<div class="skill-box passive-box"><b>패시브 · ${h.passive2}</b>${h.passive2Desc}</div>` : ''}</details>`;
    openModal(u ? '용병 육성' : '용병 정보', `<div class="hero-management"><div class="hero-detail-header">${portrait(id, 'detail-portrait')}<div>${rarity(id)}<h3>${h.name}</h3><p>${h.club} · ${h.role}</p>${h.element === 'water' ? '<p class="hero-element">Osia · 물고기 종족 · 물 속성</p>' : h.element === 'wind' ? '<p class="hero-element">Lava · 남성 · 인간 · 바람 속성</p>' : ''}</div></div><div class="hero-stat-grid"><div><small>레벨</small><b id="hero-level">${u ? u.level : 1}</b><small>/ ${G.MAX_LEVEL}</small></div><div><small>체력</small><b id="hero-hp">${fmt(st.hp)}</b></div><div><small>공격력</small><b id="hero-atk">${fmt(st.atk)}</b></div></div>${u ? `<div class="hero-wallet">보유 골드 <b id="hero-gold">${fmt(state.gold)}</b><span id="hero-xp"></span></div><div class="detail-actions"><button class="primary" id="train-hero">1레벨 훈련<small id="train-cost"></small></button><button class="secondary" id="awaken-hero">각성<small id="awaken-cost"></small></button></div><p class="upgrade-feedback" id="training-status" role="status"></p><div class="detail-note"><span id="hero-stars"></span> · <span id="hero-shards"></span><br>훈련·각성 능력치는 다음 전투부터 적용됩니다.</div><button class="secondary full" id="change-hero">용병 교체 · 보유 동료 보기</button>${skills}<h3 class="stage-title">출전 위치</h3><div class="slot-buttons">${state.team.map((member, i) => `<button data-slot="${i}" class="${member === id ? 'selected' : ''}">${portrait(member)}${i === 0 ? '전열' : i === 1 ? '중열' : '후열'} · ${G.BY_ID[member].name}</button>`).join('')}</div><p class="detail-note">전열이 공격을 더 자주 받습니다. 편성을 바꾸면 현재 전투를 다시 시작합니다.</p>` : `${skills}<p class="detail-note">아직 만나지 못한 용병입니다.</p><button class="primary full" id="to-recruit">모집에서 만나기 →</button>`}</div>`, 'hero');
    if (u) {
      $('train-hero').onclick = () => act({kind:'train', hero:id}); $('awaken-hero').onclick = () => act({kind:'awaken', hero:id});
      $('change-hero').onclick = () => { closeModal(); filter = 'owned'; setTab('roster'); };
      document.querySelectorAll('[data-slot]').forEach(b => { b.onclick = () => { const index = Number(b.dataset.slot), team = [...state.team], old = team.indexOf(id); if (old === index) { toast('이미 이 위치에 출전 중이에요.'); return; } if (old >= 0) team[old] = team[index]; team[index] = id; act({kind:'team', team}); }; });
    } else $('to-recruit').onclick = () => { if (id === 'osia' || id === 'lava') { selectedBanner = id; storage.set('school-pickup', id); } closeModal(); setTab('recruit'); };
    renderButtons();
  }
  function stageMap() {
    openModal('학교 모험 지도', `<p class="modal-copy">열린 지역을 골라 반복 사냥하거나, 다음 지역에 도전하세요.</p><br>${G.CHAPTERS.map((name, i) => `<h3 class="stage-title">${i + 1}. ${name}</h3><div class="stage-grid">${Array.from({length:5}, (_, j) => { const n = i * 5 + j + 1; return `<button class="stage-tile ${n <= state.best ? 'cleared' : ''} ${n === state.stage ? 'current' : ''}" data-stage="${n}" ${n > state.best + 1 ? 'disabled' : ''}>${G.stageName(n)}${n <= state.best ? ' ✓' : ''}</button>`; }).join('')}</div>`).join('')}<button class="primary full" id="next-stage">${state.best === G.MAX_STAGE ? '최종 지역 반복하기' : `${G.stageName(state.best + 1)}부터 자동 도전`} →</button>`, 'map');
    document.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => act({kind:'stage', stage:Number(b.dataset.stage), mode:'farm'}));
    $('next-stage').onclick = () => act({kind:'stage', stage:Math.min(G.MAX_STAGE, state.best + 1), mode:'progress'});
  }
  function reveal(results) {
    openModal('새로운 만남', `<p class="reveal-caption">${results.some(r => r.fresh) ? '용병단에 새로운 친구가 찾아왔어요.' : '동료의 조각을 모아 더 강하게 각성하세요.'}</p><div class="result-grid ${results.length === 1 ? 'single' : ''}">${results.map((r, i) => `<div class="result-card ${G.BY_ID[r.id].rarity}" style="animation-delay:${reduced ? 0 : i * .085}s">${rarity(r.id)}${portrait(r.id)}<b>${G.BY_ID[r.id].name}</b><small>${r.fresh ? 'NEW · 첫 만남' : `조각 +${r.shards}`}</small></div>`).join('')}</div><button class="primary full result-close" id="reveal-done">용병 확인하기 →</button><p class="detail-note" style="text-align:center">결과는 이미 저장되었어요. 창을 닫아도 사라지지 않아요.</p>`, 'reveal');
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
    openModal('모집 확률 안내', `<div class="modal-copy"><p><strong>${banner.name}</strong><br>1회 보석 100개 / 10회 900개.</p><table class="probability-table"><thead><tr><th>등급</th><th>다음 1회</th><th>용병별 실제 확률</th></tr></thead><tbody>${rows}</tbody></table><p>현재 누적 ${progress.pity}회 · <strong>다음 ${progress.pity + 1}회째 확률</strong>입니다. ${progress.guaranteed ? `다음 SSR은 <strong>${G.BY_ID[banner.featured].name} 확정</strong>입니다.` : `SSR이 나오면 <strong>50%는 ${G.BY_ID[banner.featured].name}</strong>, 나머지 50%는 다른 상시 SSR입니다.`}</p><p>메인 이외의 SSR을 얻으면 <strong>그 배너의 다음 SSR은 메인 확정</strong>입니다. 메인을 얻으면 다시 50:50이 됩니다. 두 배너의 누적 횟수와 메인 보장은 각각 저장됩니다.</p><p>기본 확률 SSR 4% · SR 26% · R 70%. SSR 미획득 기준 <strong>60회째 5%</strong>부터 매회 1%p씩 올라 79회째 24%, <strong>80회째 SSR 확정</strong>입니다. 증가분은 R에서 차감합니다. SSR 획득 시 누적만 0으로 초기화됩니다.</p><p>단일·10회 모집 모두 한 번씩 계산합니다. 10회의 앞 9명에 SR 이상이 없고 마지막 결과가 R이면 SR로 올립니다. SSR 천장을 먼저 적용합니다.</p><p>라바는 <strong>2026년 11월 20일 23:59(한국 시간)까지</strong> 한정 배너에서만 나옵니다. 오시아 상시 배너에서는 나오지 않습니다. 이미 얻은 라바는 종료 후에도 사용할 수 있습니다.</p><p>중복 시 R 조각 5개 / SR 10개 / SSR 20개. 최대 5성까지 각성할 수 있습니다. 표의 소수점은 반올림하여 합계가 조금 다를 수 있습니다.</p></div>`, 'rates');
  }
  function help() {
    openModal('학교용병단 안내', `<div class="modal-copy"><p><strong>방과 후, 작은 용병들의 큰 모험.</strong><br>전투는 자동! 용병을 모으고 키워 ${G.CHAPTERS.length}개 구역, ${G.MAX_STAGE}개 지역을 탐험하세요.</p><ul><li>전투 속도 1.0×·1.5×를 선택할 수 있습니다. 방치 보상은 실제 경과 시간을 따릅니다.</li><li>3명의 용병이 매초 싸우고 자동으로 스킬을 씁니다. 전열에는 수호 용병을 추천해요.</li><li>승리하면 출전 용병이 경험치를 얻어요. 골드로 훈련하면 바로 1레벨 성장합니다.</li><li>지역마다 일반 전투 3번, 보스 1번. 처음 클리어하면 보석 60개!</li><li>3번 연속 패배하면 이전 지역을 반복합니다. 용병을 키우고 지도에서 다시 도전하세요.</li><li>90초 넘게 자리를 비우면 최대 8시간의 보상을 모읍니다. 보급소에서 받아 주세요.</li><li>매일 한국 시간 0시에 일일 보급이 갱신됩니다.</li></ul><p>게스트는 이 브라우저에, 로그인은 계정에 저장합니다. <strong>게스트와 계정 진행은 별도</strong>이며 합쳐지지 않습니다. 기기 데이터를 지우면 게스트 기록은 사라집니다.</p><p>이 게임의 단장 레벨과 재화는 기존 카드게임과 별개입니다.</p><p><a href="privacy.html" target="_blank" rel="noopener">개인정보·계정 안내</a> · <a href="game.html">기존 카드게임</a></p></div>`, 'help');
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
      profile = identity.profile; mode = 'cloud'; storage.set(MODE, 'cloud'); effects = []; lastSeq = body.state.seq;
      verifiedToken = connectingToken; sessionFingerprint = fingerprint;
      try { const saved = JSON.parse(storage.get(PENDING, true) || 'null'); pending = saved?.accountId === profile.id ? saved : null; if (!pending) storage.remove(PENDING, true); } catch { clearPending(); }
      applyCloud(body); closeModal(); toast('계정의 학교용병단을 불러왔어요.'); lastSync = Date.now(); loaded = true;
    } catch (error) {
      if (error.status === 401) { token = null; verifiedToken = null; storage.remove(SESSION, true); }
      connected = false; saveStatus('error', '계정 연결 대기'); lastSync = Date.now();
      note('계정 기록을 불러오지 못했습니다. 계정 메뉴에서 다시 연결해 주세요.', true);
      toast(error.message); const status = $('login-message'); if (status) status.textContent = error.message;
    } finally { busy = false; renderButtons(); }
    if (loaded && pending) sync(true);
    return loaded;
  }
  async function accountModal() {
    openModal('내 용병단 저장', `<div class="modal-copy"><p>${mode === 'cloud' ? '<strong>Google 계정에 저장 중입니다.</strong><br>다른 기기에서도 같은 계정으로 이어 할 수 있어요.' : '<strong>지금은 이 브라우저에 저장 중입니다.</strong><br>Google 계정을 연결하면 기기를 바꿔도 이어 할 수 있어요.'}</p><div class="account-box"><span>${mode === 'cloud' ? '계정 용병단' : '게스트 용병단'}<br>단장 Lv.${state.captain.level}</span><b>${Object.keys(state.units).length}명 보유</b></div><p>게스트와 계정 기록은 따로 유지됩니다. 로그인 시 계정 기록을 불러오며 게스트 기록은 이 기기에 남습니다.</p><p>카드게임과 로그인은 공유하고, 성장 기록은 각각 저장합니다.</p></div><div id="account-controls"></div><div id="login-message" class="login-message" role="status"></div><p class="detail-note"><a href="privacy.html" target="_blank" rel="noopener">개인정보 및 계정 삭제 안내</a></p>`, 'account');
    if (mode === 'cloud') {
      $('account-controls').innerHTML = `<div class="account-actions"><button class="secondary" id="cloud-refresh">저장 확인</button><button class="secondary" id="guest-return">게스트로 전환</button>${!connected || !token ? '<button class="primary" id="cloud-login-again">다시 로그인</button>' : ''}</div>`;
      if ($('cloud-login-again')) $('cloud-login-again').onclick = prepareGoogle;
      $('cloud-refresh').onclick = async () => { await sync(true); if (connected) toast('계정 저장을 확인했습니다.'); };
      $('guest-return').onclick = async () => {
        if (busy || pending) { toast('진행 중인 요청을 먼저 확인해 주세요.'); return; }
        const prior = { profile, state, hasCloudState, cloudBalance, connected };
        busy = true; renderButtons();
        mode = 'guest'; profile = null; storage.set(MODE, 'guest'); effects = []; connected = true; hasCloudState = false; cloudBalance = null;
        try { await guestUpdate(); lastSeq = state.seq; document.querySelector('.workspace').style.visibility = ''; note(''); closeModal(); renderKey = partyKey = ''; render(); toast('이 기기의 게스트 기록으로 돌아왔어요.'); }
        catch (error) { mode = 'cloud'; profile = prior.profile; state = prior.state; hasCloudState = prior.hasCloudState; cloudBalance = prior.cloudBalance; connected = prior.connected; storage.set(MODE, 'cloud'); saveStatus(connected ? 'saved' : 'error', connected ? '계정 저장 완료' : '계정 연결 대기'); toast(error.message); }
        finally { busy = false; renderButtons(); }
      };
      return;
    }
    if (token) { $('account-controls').innerHTML = '<button class="primary full" id="existing-account">로그인된 계정으로 이어하기 →</button><button class="text-button history-button" id="different-account">다른 Google 계정으로 연결</button>'; $('existing-account').onclick = useCloud; $('different-account').onclick = () => prepareGoogle(); }
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
          if (!storage.set(SESSION, JSON.stringify({token}), true)) throw Error('계정 세션을 저장할 수 없습니다. 브라우저의 저장 허용을 확인하세요.');
          busy = false; await useCloud();
        } catch (error) { if ($('login-message')) $('login-message').textContent = error.message; toast(error.message); busy = false; await prepareGoogle(); }
        finally { busy = false; renderButtons(); }
      } });
      google.accounts.id.renderButton($('google-host'), { type:'standard', theme:'outline', size:'large', text:'signin_with', locale:'ko', width:Math.min(320, $('modal-content').clientWidth) });
      $('login-message').textContent = 'Google로 로그인하면 계정의 모험 기록을 불러옵니다.';
    } catch (error) { if (version === loginGeneration && $('login-message')) $('login-message').textContent = error.message; }
  }
  function bind() {
    document.addEventListener('click', e => {
      const target = e.target.closest('button'); if (!target || target.disabled) return;
      if (target.dataset.tab) setTab(target.dataset.tab);
      if (target.dataset.hero) heroDetail(target.dataset.hero);
      if (target.dataset.banner && G.BANNERS[target.dataset.banner]) { selectedBanner = target.dataset.banner; storage.set('school-pickup', selectedBanner); renderKey = ''; render(); }
      if (target.dataset.speed) act({kind:'speed', speed:Number(target.dataset.speed)});
      if (target.dataset.map !== undefined) stageMap();
      if (target.dataset.filter) { filter = target.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === filter)); renderKey = ''; render(); }
      if (target.dataset.action === 'quest') act({kind:'quest', quest:target.dataset.quest});
    });
    $('sound-button').onclick = () => { sound = !sound; storage.set('school-sound', sound ? 'on' : 'off'); refreshSound(); play('tap'); };
    $('account-button').onclick = accountModal; $('help-button').onclick = help; $('captain-button').onclick = help;
    $('modal-close').onclick = closeModal; $('modal').addEventListener('cancel', () => { modalKind = ''; loginGeneration++; });
    $('modal').addEventListener('click', e => { const r = $('modal').getBoundingClientRect(); if (e.target === $('modal') && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) closeModal(); });
    $('stage-button').onclick = stageMap;
    $('feature-osia-button').onclick = () => heroDetail('osia');
    $('feature-lava-button').onclick = () => heroDetail('lava');
    $('battle-stage').onclick = stageMap;
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
    $('log-button').onclick = () => openModal('모험 기록', `<ul class="log-list">${state.logs.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`, 'logs');
    $('history-button').onclick = () => openModal('최근 모집 기록', state.history.length ? state.history.map(r => `<div class="history-row">${portrait(r.id)}${rarity(r.id)}<b>${G.BY_ID[r.id].name}</b><small>${r.fresh ? '첫 만남' : `조각 +${r.shards}`}</small></div>`).join('') : '<p class="modal-copy">아직 모집한 용병이 없어요.</p>', 'history');
    document.addEventListener('visibilitychange', () => {
      if (mode === 'guest') guestUpdate().catch(() => {});
      else if (!document.hidden) sync(true);
    });
    // Visible guest changes are already committed; these checkpoints cover the
    // fractional elapsed time without relying on an unload promise succeeding.
    window.addEventListener('pagehide', () => { if (mode === 'guest') guestUpdate().catch(() => {}); });
    window.addEventListener('pageshow', () => { if (mode === 'guest') guestUpdate().catch(() => {}); else sync(true); });
    window.addEventListener('online', () => sync(true));
    window.addEventListener('school-art-ready', () => { renderKey = partyKey = ''; $('feature-osia').src = Art.portrait('osia'); $('feature-lava').src = Art.portrait('lava'); render(); if (modalKind === 'hero' && ['osia','lava'].includes(selectedHero)) heroDetail(selectedHero); });
    window.addEventListener('storage', e => { if (e.key === SAVE && mode === 'guest' && !busy) guestUpdate().catch(() => {}); });
  }
  async function boot() {
    const wantsCloud = storage.get(MODE) === 'cloud';
    if (wantsCloud) {
      mode = 'cloud'; connected = false;
      try {
        sessionFingerprint = await tokenFingerprint(token);
        const cache = JSON.parse(storage.get(CLOUD_CACHE, true) || 'null');
        // Server views deliberately omit private action receipts.
        if (sessionFingerprint && cache?.sessionFingerprint === sessionFingerprint && cache?.profile?.id && cache.state && G.validate({ ...cache.state, receipts: [] })) {
          profile = cache.profile; state = cache.state; revision = cache.revision; hasCloudState = true;
          cloudBalance = { gold: state.gold, gems: state.gems }; lastSeq = state.seq;
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
    await Art.ready;
    $('feature-osia').src = Art.portrait('osia'); $('feature-lava').src = Art.portrait('lava'); $('recruit-count').textContent = '상시 오시아 · 한정 라바';
    clientReady = true; bind(); refreshSound(); renderButtons();
    if (!guestSaveFailed && (!wantsCloud || hasCloudState)) render();
    if (wantsCloud) {
      if (token) await useCloud(); else { saveStatus('error', '로그인 필요'); note('계정 기록을 이어 하려면 계정 메뉴에서 Google로 로그인하세요. 게스트 기록으로 자동 전환하지 않습니다.'); }
    }
    setInterval(() => {
      if (document.hidden || !state) return;
      if (mode === 'guest' && !busy && !guestTickPending && (!guestSaveFailed || Date.now() - lastSave > 2000)) {
        guestTickPending = true; guestUpdate().then(() => { document.querySelector('.workspace').style.visibility = ''; }).catch(() => {}).finally(() => { guestTickPending = false; });
      }
      if (mode === 'cloud' && !busy && hasCloudState && connected) { advanceCloudPreview(); consumeEvents(); render(); }
      if (mode === 'cloud' && token && Date.now() - lastSync > 3000) { lastSync = Date.now(); sync(); }
    }, 250);
    const canvas = $('battle'), ctx = canvas.getContext('2d');
    let previous = 0, canvasSizeDirty = true, canvasDpr = 0;
    function fitBattleCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!canvasSizeDirty && canvasDpr === dpr) return true;
      const box = canvas.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) return false;
      // Match the actual painted area, including object-fit's letterboxing.
      // Render details/text at screen resolution instead of enlarging 480px.
      const fitWidth = Math.min(box.width, box.height * 12 / 7);
      const width = Math.max(1, Math.round(Math.min(fitWidth * dpr, 2880)));
      const height = Math.max(1, Math.round(width * 7 / 12));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width; canvas.height = height; ctx.imageSmoothingEnabled = false;
      }
      canvasDpr = dpr; canvasSizeDirty = false; return true;
    }
    if (window.ResizeObserver) new ResizeObserver(() => { canvasSizeDirty = true; }).observe(canvas);
    window.addEventListener('resize', () => { canvasSizeDirty = true; });
    window.visualViewport?.addEventListener('resize', () => { canvasSizeDirty = true; });
    function animate(time) {
      requestAnimationFrame(animate);
      if (document.hidden || tab !== 'adventure' && innerWidth <= 650 || time - previous < (reduced ? 120 : 32)) return;
      previous = time; if (fitBattleCanvas()) Art.draw(ctx, state, animationTime(), effects, reduced);
    }
    requestAnimationFrame(animate);
  }
  boot().catch(error => { saveStatus('error', '저장 확인 필요'); note(error.message || '게임을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.'); console.error(error); });
})();
