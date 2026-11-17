(() => {
  'use strict';
  const G = window.SchoolRPG, Art = window.SchoolArt, $ = id => document.getElementById(id);
  const BASE = 'https://motracv-card-room.densedormouse4.chatgpt.site';
  const SAVE = 'school-mercenaries-v1', MODE = 'school-save-mode', SESSION = `card-account:${BASE}`, PENDING = 'school-pending-action';
  const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => Math.floor(n).toLocaleString('ko-KR');
  const duration = seconds => seconds >= 3600 ? `${Math.floor(seconds / 3600)}시간 ${Math.floor(seconds % 3600 / 60)}분` : `${Math.floor(seconds / 60)}분`;
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const portrait = (id, cls = '') => `<img class="${cls}" src="${Art.portrait(id)}" alt="${G.BY_ID[id].name}">`;
  const rarity = id => `<span class="rarity ${G.BY_ID[id].rarity}">${G.BY_ID[id].rarity}</span>`;
  const storage = { get(key, session = false) { try { return (session ? sessionStorage : localStorage).getItem(key); } catch { return null; } }, set(key, value, session = false) { try { (session ? sessionStorage : localStorage).setItem(key, value); return true; } catch { return false; } }, remove(key, session = false) { try { (session ? sessionStorage : localStorage).removeItem(key); } catch {} } };
  let state, mode = 'guest', profile = null, token = null, revision = 0, offset = 0, busy = false, pending = null, connected = true;
  let tab = 'adventure', filter = 'owned', selectedHero = null, modalKind = '', lastSeq = 0, effects = [], toastTimer, sdkPromise, loginGeneration = 0;
  let sound = storage.get('school-sound') === 'on', audio, renderKey = '', partyKey = '', lastSave = 0, lastSync = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { token = JSON.parse(storage.get(SESSION, true) || 'null')?.token || null; } catch {}

  function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3400); }
  function note(message, retry = false) {
    $('connection').hidden = !message;
    $('connection').textContent = message || '';
    if (retry) { const b = document.createElement('button'); b.textContent = '다시 연결'; b.onclick = () => sync(true); $('connection').append(b); }
  }
  function play(kind) {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(() => {});
      const frequencies = kind === 'rare' ? [440, 554, 659, 880] : kind === 'reward' ? [523, 659, 784] : kind === 'level' ? [392, 523, 659] : [440];
      frequencies.forEach((hz, i) => { const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + i * .09; osc.type = 'triangle'; osc.frequency.value = hz; gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.045, t + .01); gain.gain.exponentialRampToValueAtTime(.001, t + .18); osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + .2); });
    } catch {}
  }
  function refreshSound() { $('sound-button').classList.toggle('muted', !sound); $('sound-button').setAttribute('aria-label', `효과음 ${sound ? '끄기' : '켜기'}`); $('sound-button').setAttribute('aria-pressed', String(sound)); }
  function freshGuest() { return G.create(Date.now(), crypto.getRandomValues(new Uint32Array(1))[0]); }
  function readGuest() {
    const raw = storage.get(SAVE);
    if (!raw) return freshGuest();
    try { const saved = JSON.parse(raw); if (G.validate(saved)) return saved; } catch {}
    storage.set(SAVE + '-recovery', raw);
    note('이전 기기 저장을 읽지 못해 복구 사본을 남겼습니다. 계정 저장이 있다면 불러오세요.');
    return freshGuest();
  }
  function writeGuest(next) {
    if (!storage.set(SAVE, JSON.stringify(next))) note('이 브라우저는 기기 저장을 막고 있습니다. 계정 저장을 이용하세요.');
  }
  async function guestUpdate(input) {
    const update = () => {
      if (mode !== 'guest') return;
      const next = readGuest(); G.advance(next, Date.now());
      const result = input ? G.action(next, input) : null;
      writeGuest(next); state = next; consumeEvents(); render(); return result;
    };
    return navigator.locks ? navigator.locks.request('school-guest-save', update) : update();
  }
  async function request(path, data, auth = 'school') {
    let response;
    try {
      response = await fetch(BASE + path, { method: path.endsWith('/config') ? 'GET' : 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(token ? auth === 'school' ? { 'X-Account-Session': token } : { Authorization: `Bearer ${token}` } : {}) }, ...(path.endsWith('/config') ? {} : { body: JSON.stringify(data || {}) }), signal: AbortSignal.timeout(14000) });
    } catch { throw Error('저장 서버에 연결하지 못했습니다. 연결 후 다시 시도하세요.'); }
    let body; try { body = await response.json(); } catch { throw Error('저장 서버의 응답을 읽지 못했습니다.'); }
    if (!response.ok && !body.conflict) throw Object.assign(Error(body.error || '요청을 처리하지 못했습니다.'), { status: response.status });
    return body;
  }
  function applyCloud(body) {
    state = body.state; revision = body.revision; offset = body.serverTime - Date.now(); connected = true;
    G.advance(state, Date.now() + offset); consumeEvents(); render(); note('');
  }
  function clearPending() { pending = null; storage.remove(PENDING, true); }
  async function sendPending() {
    let body = await request('/api/school/action', pending);
    if (body.conflict) {
      applyCloud(body); pending.revision = revision; storage.set(PENDING, JSON.stringify(pending), true);
      body = await request('/api/school/action', pending);
    }
    if (body.conflict) { applyCloud(body); clearPending(); throw Error('다른 기기에서 진행 상황이 바뀌었습니다. 다시 눌러주세요.'); }
    clearPending(); applyCloud(body); return body.result;
  }
  async function sync(manual = false) {
    if (mode !== 'cloud' || busy || (!manual && document.hidden)) return;
    busy = true; renderButtons();
    try {
      if (pending) { const result = await sendPending(); showResult(result); }
      else applyCloud(await request('/api/school/state'));
      lastSync = Date.now();
    } catch (error) {
      connected = false;
      if (error.status && error.status < 500 && error.status !== 409) clearPending();
      note(error.status === 401 ? '로그인이 만료되었습니다. 계정 메뉴에서 다시 연결하세요.' : '계정 저장 연결을 기다리고 있어요. 재화 사용은 연결 후 계속됩니다.', true);
      if (manual) toast(error.message);
    } finally { busy = false; renderButtons(); }
  }
  async function act(input) {
    if (busy || pending) { toast('이전 요청을 확인하고 있어요. 잠시 기다려주세요.'); return; }
    if (mode === 'cloud' && !connected) { sync(true); return; }
    busy = true; renderButtons();
    try {
      let result;
      if (mode === 'cloud') {
        pending = { action: input, revision, requestId: crypto.randomUUID().replaceAll('-', ''), accountId: profile.id };
        if (!storage.set(PENDING, JSON.stringify(pending), true)) { pending = null; throw Error('이 브라우저는 안전한 요청 저장을 지원하지 않습니다. 일반 브라우저에서 다시 시도하세요.'); }
        result = await sendPending(); lastSync = Date.now();
      } else result = await guestUpdate(input);
      showResult(result);
    } catch (error) {
      if (error.status && error.status < 500 && error.status !== 409) clearPending();
      if (mode === 'cloud' && pending) { connected = false; note('요청 결과를 확인 중입니다. 같은 모집을 중복 결제하지 않도록 재연결하고 있어요.', true); }
      toast(error.message);
    } finally { busy = false; renderButtons(); }
  }
  function showResult(result) {
    if (!result) return;
    if (result.kind === 'recruit') { reveal(result.results); play(result.results.some(r => G.BY_ID[r.id].rarity === 'SSR') ? 'rare' : 'reward'); }
    else if (result.kind === 'train') { toast(`${G.BY_ID[result.hero].name} Lv.${result.level}!`); heroDetail(result.hero); play('level'); }
    else if (result.kind === 'awaken') { toast(`${G.BY_ID[result.hero].name} ${result.stars}성 각성!`); heroDetail(result.hero); play('rare'); }
    else if (result.kind === 'team') { closeModal(); toast('새 편성으로 출발합니다. 맨 앞 용병이 주로 공격을 받아요.'); }
    else if (result.kind === 'stage') { closeModal(); setTab('adventure'); toast('선택한 지역으로 출발합니다.'); }
    else if (result.kind === 'offline') { toast(`골드 +${fmt(result.reward.gold)} · 용병마다 경험치 +${fmt(result.reward.xp)}`); play('reward'); if (modalKind === 'offline') closeModal(); }
    else { toast(`골드 +${fmt(result.gold)} · 보석 +${fmt(result.gems)}`); play('reward'); }
    render();
  }
  function consumeEvents() {
    const now = performance.now() / 1000;
    const events = state.events.filter(e => e.seq > lastSeq); lastSeq = state.seq;
    for (const e of events) {
      effects.push({ ...e, time: now });
      if (e.kind === 'clear') { toast(`${G.stageName(e.stage)} 클리어! 보석 +60`); play('reward'); }
      if (e.kind === 'captain') { toast(`단장 레벨 ${e.level}! 보석 +30`); play('level'); }
    }
    effects = effects.filter(e => now - e.time < 2).slice(-70);
  }
  function setTab(next) {
    if (!['adventure', 'roster', 'recruit', 'supplies'].includes(next)) return;
    tab = next; $('app').dataset.tab = tab;
    for (const name of ['adventure', 'roster', 'recruit', 'supplies']) $('tab-' + name).hidden = name !== tab;
    document.querySelectorAll('.bottom-nav>button').forEach(b => { b.classList.toggle('active', b.dataset.tab === tab); if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
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
    const pk = state.team.join('|');
    if (pk !== partyKey) { partyKey = pk; $('party').innerHTML = state.team.map(id => `<button class="party-card" data-hero="${id}" aria-label="${G.BY_ID[id].name} 상세 정보">${portrait(id)}<span class="party-info"><b>${G.BY_ID[id].name}</b><small></small><span class="party-hp"><i></i></span></span></button>`).join(''); }
    document.querySelectorAll('.party-card').forEach(el => { const id = el.dataset.hero, h = state.battle.heroes.find(h => h.id === id), u = state.units[id]; el.querySelector('small').textContent = `Lv.${u.level} · ${G.BY_ID[id].role}`; el.querySelector('i').style.width = `${h ? Math.max(0, h.hp / h.max) * 100 : 100}%`; el.classList.toggle('fallen', !!h && h.hp <= 0); });
    $('offline-summary').textContent = state.offline.seconds ? `${duration(state.offline.seconds)} · 골드 ${fmt(state.offline.gold)} 수령 가능` : '자리를 비워도 최대 8시간까지';
    const key = JSON.stringify([tab, filter, state.units, state.team, state.best, state.stage, state.mode, state.offline, state.claimed, state.daily, state.pulls, state.pity, state.captain.level]);
    if (key !== renderKey) {
      renderKey = key;
      if (tab === 'adventure') renderChapters();
      if (tab === 'roster') renderRoster();
      if (tab === 'recruit') { $('pity-left').textContent = 40 - state.pity; $('pity-count').textContent = `${state.pity} / 40`; $('pity-bar').style.width = `${state.pity / 40 * 100}%`; }
      if (tab === 'supplies') renderSupplies();
    }
    $('recruit-dot').hidden = state.gems < 900;
    $('supply-dot').hidden = !(state.offline.seconds || state.daily < G.day(Date.now() + offset) || G.QUESTS.some(q => !state.claimed.includes(q.id) && G.questValue(state, q) >= q.goal));
    renderButtons();
  }
  function renderButtons() {
    if (!state) return; const blocked = busy || !!pending || (mode === 'cloud' && !connected);
    $('recruit-one').disabled = blocked || state.gems < 100; $('recruit-ten').disabled = blocked || state.gems < 900;
    $('claim-offline').disabled = blocked || !state.offline.seconds;
    $('claim-daily').disabled = blocked || state.daily >= G.day(Date.now() + offset);
    document.querySelectorAll('[data-action]').forEach(b => { b.disabled = blocked || b.dataset.unavailable === 'true'; });
    if (modalKind === 'hero' && selectedHero && state.units[selectedHero]) {
      const u = state.units[selectedHero]; const train = $('train-hero'), awaken = $('awaken-hero');
      if (train) train.disabled = blocked || u.level >= 60 || state.gold < G.trainingCost(u);
      if (awaken) awaken.disabled = blocked || u.stars >= 5 || u.shards < G.awakeningCost(u);
    }
  }
  function renderChapters() {
    document.querySelector('.chapter-stamp').innerHTML = `${G.chapter(state.stage) + 1}<br><small>CHAPTER</small>`;
    $('chapter-list').innerHTML = G.CHAPTERS.map((name, i) => {
      const complete = Math.min(5, Math.max(0, state.best - i * 5)), unlocked = state.best >= i * 5;
      return `<button class="chapter-item ${G.chapter(state.stage) === i ? 'current' : ''} ${unlocked ? '' : 'locked'}" data-map="${i}"><span class="chapter-num">0${i + 1}</span><span class="chapter-copy"><b>${name}</b><small>${unlocked ? `${complete} / 5 지역 클리어` : `${i}-5 클리어 후 개방`}</small></span><span class="chapter-end">${complete === 5 ? '✓' : unlocked ? '→' : '잠김'}</span></button>`;
    }).join('');
  }
  function renderRoster() {
    $('roster-count').textContent = `${Object.keys(state.units).length} / 12`;
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
    openModal('용병 정보', `<div class="hero-detail-header">${portrait(id, 'detail-portrait')}<div>${rarity(id)}<h3>${h.name}</h3><p>${h.club} · ${h.role}</p></div></div><div class="hero-stat-grid"><div><small>레벨</small>${u ? u.level : 1}<small>/ 60</small></div><div><small>체력</small>${fmt(st.hp)}</div><div><small>공격력</small>${fmt(st.atk)}</div></div><div class="skill-box"><b>${h.skill} <span>· ${h.cooldown}초마다 자동 사용</span></b>${h.desc}</div>${u ? `<div class="detail-note">경험치 ${fmt(u.xp)} / ${G.needXp(u.level)} · 각성 ${u.stars} / 5성<br>각성마다 기본 능력치 +15% · 조각 ${u.shards}개 보유</div><div class="detail-actions"><button class="primary" id="train-hero">1레벨 훈련<small>${u.level >= 60 ? '최대 레벨' : `골드 ${fmt(G.trainingCost(u))}`}</small></button><button class="secondary" id="awaken-hero">각성하기<small>${u.stars >= 5 ? '최대 각성' : `조각 ${G.awakeningCost(u)}개`}</small></button></div><p class="detail-note">훈련·각성 능력치는 다음 전투부터 적용됩니다.</p><h3 class="stage-title">출전 위치 선택</h3><div class="slot-buttons">${state.team.map((member, i) => `<button data-slot="${i}" class="${member === id ? 'selected' : ''}">${portrait(member)}${i === 0 ? '전열' : i === 1 ? '중열' : '후열'} · ${G.BY_ID[member].name}</button>`).join('')}</div><p class="detail-note">전열은 적의 공격을 더 자주 받습니다. 편성을 바꾸면 현재 전투를 처음부터 시작합니다.</p>` : '<p class="detail-note">아직 만나지 못한 용병입니다. 모집에서 획득할 수 있어요.</p><button class="primary full" id="to-recruit">모집하러 가기 →</button>'}`, 'hero');
    if (u) {
      $('train-hero').onclick = () => act({kind:'train', hero:id}); $('awaken-hero').onclick = () => act({kind:'awaken', hero:id});
      document.querySelectorAll('[data-slot]').forEach(b => { b.onclick = () => { const index = Number(b.dataset.slot), team = [...state.team], old = team.indexOf(id); if (old === index) { toast('이미 이 위치에 출전 중이에요.'); return; } if (old >= 0) team[old] = team[index]; team[index] = id; act({kind:'team', team}); }; });
    } else $('to-recruit').onclick = () => { closeModal(); setTab('recruit'); };
    renderButtons();
  }
  function stageMap() {
    openModal('학교 모험 지도', `<p class="modal-copy">열린 지역을 골라 반복 사냥하거나, 다음 지역에 도전하세요.</p><br>${G.CHAPTERS.map((name, i) => `<h3 class="stage-title">${i + 1}. ${name}</h3><div class="stage-grid">${Array.from({length:5}, (_, j) => { const n = i * 5 + j + 1; return `<button class="stage-tile ${n <= state.best ? 'cleared' : ''} ${n === state.stage ? 'current' : ''}" data-stage="${n}" ${n > state.best + 1 ? 'disabled' : ''}>${G.stageName(n)}${n <= state.best ? ' ✓' : ''}</button>`; }).join('')}</div>`).join('')}<button class="primary full" id="next-stage">${state.best === 30 ? '최종 지역 반복하기' : `${G.stageName(state.best + 1)}부터 자동 도전`} →</button>`, 'map');
    document.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => act({kind:'stage', stage:Number(b.dataset.stage), mode:'farm'}));
    $('next-stage').onclick = () => act({kind:'stage', stage:Math.min(30, state.best + 1), mode:'progress'});
  }
  function reveal(results) {
    openModal('새로운 만남', `<p class="reveal-caption">${results.some(r => r.fresh) ? '용병단에 새로운 친구가 찾아왔어요.' : '동료의 조각을 모아 더 강하게 각성하세요.'}</p><div class="result-grid ${results.length === 1 ? 'single' : ''}">${results.map((r, i) => `<div class="result-card ${G.BY_ID[r.id].rarity}" style="animation-delay:${reduced ? 0 : i * .085}s">${rarity(r.id)}${portrait(r.id)}<b>${G.BY_ID[r.id].name}</b><small>${r.fresh ? 'NEW · 첫 만남' : `조각 +${r.shards}`}</small></div>`).join('')}</div><button class="primary full result-close" id="reveal-done">용병 확인하기 →</button><p class="detail-note" style="text-align:center">결과는 이미 저장되었어요. 창을 닫아도 사라지지 않아요.</p>`, 'reveal');
    $('reveal-done').onclick = () => { closeModal(); setTab('roster'); };
    $('modal-content').querySelector('.result-grid').onclick = e => e.currentTarget.classList.add('skip');
  }
  function ratesModal() {
    openModal('모집 확률 안내', `<div class="modal-copy"><p>무료 보석으로 모집합니다. <strong>1회 100개 / 10회 900개.</strong></p><table class="probability-table"><thead><tr><th>등급</th><th>기본 확률</th><th>해당 용병 1명당</th></tr></thead><tbody><tr><td>SSR · 2명</td><td>4%</td><td>2%</td></tr><tr><td>SR · 4명</td><td>26%</td><td>6.5%</td></tr><tr><td>R · 6명</td><td>70%</td><td>약 11.6667%</td></tr></tbody></table><p>SSR 없이 39회 모집했다면 <strong>다음 1회는 SSR 확정</strong>입니다. SSR 획득 시 카운트는 0으로 초기화됩니다. 단일·10회 모집 모두 함께 계산합니다.</p><p>10회 모집의 앞 9명에 SR 이상이 없고 10번째가 R일 때, 그 결과를 <strong>SR로 올려 줍니다</strong>. SSR 천장을 먼저 적용합니다.</p><p>보장으로 바뀌는 결과는 위 기본 확률과 다릅니다. 각 등급 안에서는 같은 확률로 뽑습니다.</p><p>중복 시 R 조각 5개 / SR 10개 / SSR 20개. 같은 용병의 조각으로 최대 5성까지 각성할 수 있습니다.</p></div>`, 'rates');
  }
  function help() {
    openModal('학교용병단 안내', `<div class="modal-copy"><p><strong>방과 후, 작은 용병들의 큰 모험.</strong><br>전투는 자동! 용병을 모으고 키워 6개 구역, 30개 지역을 탐험하세요.</p><ul><li>3명의 용병이 매초 싸우고 자동으로 스킬을 씁니다. 전열에는 수호 용병을 추천해요.</li><li>승리하면 출전 용병이 경험치를 얻어요. 골드로 훈련하면 바로 1레벨 성장합니다.</li><li>지역마다 일반 전투 3번, 보스 1번. 처음 클리어하면 보석 60개!</li><li>3번 연속 패배하면 이전 지역을 반복합니다. 용병을 키우고 지도에서 다시 도전하세요.</li><li>90초 넘게 자리를 비우면 최대 8시간의 보상을 모읍니다. 보급소에서 받아 주세요.</li><li>매일 한국 시간 0시에 일일 보급이 갱신됩니다.</li></ul><p>게스트는 이 브라우저에, 로그인은 계정에 저장합니다. <strong>게스트와 계정 진행은 별도</strong>이며 합쳐지지 않습니다. 기기 데이터를 지우면 게스트 기록은 사라집니다.</p><p>이 게임의 단장 레벨과 재화는 기존 카드게임과 별개입니다.</p><p><a href="privacy.html" target="_blank" rel="noopener">개인정보·계정 안내</a> · <a href="game.html">기존 카드게임</a></p></div>`, 'help');
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
    if (busy) return; busy = true; renderButtons();
    try {
      const identity = await request('/api/account/me', {}, 'account');
      const body = await request('/api/school/state');
      profile = identity.profile; mode = 'cloud'; storage.set(MODE, 'cloud'); effects = []; lastSeq = body.state.seq;
      try { const saved = JSON.parse(storage.get(PENDING, true) || 'null'); pending = saved?.accountId === profile.id ? saved : null; if (!pending) storage.remove(PENDING, true); } catch { clearPending(); }
      applyCloud(body); closeModal(); toast('계정의 학교용병단을 불러왔어요.'); lastSync = Date.now();
    } catch (error) {
      if (error.status === 401) { token = null; storage.remove(SESSION, true); }
      toast(error.message); const status = $('login-message'); if (status) status.textContent = error.message;
    } finally { busy = false; renderButtons(); }
    if (pending) sync(true);
  }
  async function accountModal() {
    openModal('내 용병단 저장', `<div class="modal-copy"><p>${mode === 'cloud' ? '<strong>Google 계정에 저장 중입니다.</strong><br>다른 기기에서도 같은 계정으로 이어 할 수 있어요.' : '<strong>지금은 이 브라우저에 저장 중입니다.</strong><br>Google 계정을 연결하면 기기를 바꿔도 이어 할 수 있어요.'}</p><div class="account-box"><span>${mode === 'cloud' ? '계정 용병단' : '게스트 용병단'}<br>단장 Lv.${state.captain.level}</span><b>${Object.keys(state.units).length}명 보유</b></div><p>게스트와 계정 기록은 따로 유지됩니다. 로그인 시 계정 기록을 불러오며 게스트 기록은 이 기기에 남습니다.</p><p>카드게임과 로그인은 공유하고, 성장 기록은 각각 저장합니다.</p></div><div id="account-controls"></div><div id="login-message" class="login-message" role="status"></div><p class="detail-note"><a href="privacy.html" target="_blank" rel="noopener">개인정보 및 계정 삭제 안내</a></p>`, 'account');
    if (mode === 'cloud') {
      $('account-controls').innerHTML = '<div class="account-actions"><button class="secondary" id="cloud-refresh">저장 확인</button><button class="secondary" id="guest-return">게스트로 전환</button></div>';
      $('cloud-refresh').onclick = async () => { await sync(true); if (connected) toast('계정 저장을 확인했습니다.'); };
      $('guest-return').onclick = () => {
        if (busy || pending) { toast('진행 중인 요청을 먼저 확인해 주세요.'); return; }
        mode = 'guest'; profile = null; storage.set(MODE, 'guest'); state = readGuest(); G.advance(state, Date.now()); writeGuest(state); lastSeq = state.seq; effects = []; connected = true; note(''); closeModal(); renderKey = partyKey = ''; render(); toast('이 기기의 게스트 기록으로 돌아왔어요.');
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
          token = result.token;
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
      if (target.dataset.map !== undefined) stageMap();
      if (target.dataset.filter) { filter = target.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === filter)); renderKey = ''; render(); }
      if (target.dataset.action === 'quest') act({kind:'quest', quest:target.dataset.quest});
    });
    $('sound-button').onclick = () => { sound = !sound; storage.set('school-sound', sound ? 'on' : 'off'); refreshSound(); play('tap'); };
    $('account-button').onclick = accountModal; $('help-button').onclick = help; $('captain-button').onclick = help;
    $('modal-close').onclick = closeModal; $('modal').addEventListener('cancel', () => { modalKind = ''; loginGeneration++; });
    $('modal').addEventListener('click', e => { const r = $('modal').getBoundingClientRect(); if (e.target === $('modal') && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) closeModal(); });
    $('stage-button').onclick = stageMap;
    $('battle-stage').onclick = stageMap;
    $('offline-strip').onclick = () => setTab('supplies'); $('claim-offline').onclick = () => act({kind:'offline'}); $('claim-daily').onclick = () => act({kind:'daily'});
    $('recruit-one').onclick = () => act({kind:'recruit', count:1}); $('recruit-ten').onclick = () => act({kind:'recruit', count:10}); $('rates-button').onclick = ratesModal;
    $('log-button').onclick = () => openModal('모험 기록', `<ul class="log-list">${state.logs.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`, 'logs');
    $('history-button').onclick = () => openModal('최근 모집 기록', state.history.length ? state.history.map(r => `<div class="history-row">${portrait(r.id)}${rarity(r.id)}<b>${G.BY_ID[r.id].name}</b><small>${r.fresh ? '첫 만남' : `조각 +${r.shards}`}</small></div>`).join('') : '<p class="modal-copy">아직 모집한 용병이 없어요.</p>', 'history');
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (mode === 'cloud') sync(true); else guestUpdate().catch(e => toast(e.message)); } });
    window.addEventListener('online', () => sync(true));
    window.addEventListener('storage', e => { if (e.key === SAVE && mode === 'guest' && !busy) { state = readGuest(); consumeEvents(); render(); } });
  }
  async function boot() {
    state = readGuest(); G.advance(state, Date.now()); writeGuest(state); lastSeq = state.seq;
    $('feature-ian').src = Art.portrait('ian'); $('feature-lumi').src = Art.portrait('lumi');
    bind(); refreshSound(); render();
    if (storage.get(MODE) === 'cloud') {
      if (token) await useCloud(); else note('계정 기록을 이어 하려면 계정 메뉴에서 Google로 로그인하세요. 지금은 게스트 화면입니다.');
    }
    setInterval(() => {
      if (document.hidden || !state) return;
      if (!busy) { G.advance(state, Date.now() + (mode === 'cloud' ? offset : 0)); consumeEvents(); render(); }
      if (mode === 'guest' && !busy && Date.now() - lastSave > 2000) { lastSave = Date.now(); guestUpdate().catch(e => toast(e.message)); }
      if (mode === 'cloud' && Date.now() - lastSync > 12000) { lastSync = Date.now(); sync(); }
    }, 250);
    const ctx = $('battle').getContext('2d'); ctx.imageSmoothingEnabled = false; let previous = 0;
    function animate(time) { requestAnimationFrame(animate); if (document.hidden || tab !== 'adventure' && innerWidth <= 650 || time - previous < (reduced ? 120 : 32)) return; previous = time; Art.draw(ctx, state, time / 1000, effects, reduced); }
    requestAnimationFrame(animate);
  }
  boot().catch(error => { note('게임을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.'); console.error(error); });
})();
