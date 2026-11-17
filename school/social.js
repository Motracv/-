/* Friends, authoritative arena replays and the winter exchange. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const number = value => Math.max(0, Math.round(Number(value) || 0)).toLocaleString('ko-KR');
  const icons = {
    friends:'<path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM1 22v-3a7 7 0 0 1 14 0v3M17 5a4 4 0 0 1 0 8M18 16a6 6 0 0 1 5 6"/>',
    arena:'<path d="m4 3 17 17M3 4l2 5 3-1 1-3-5-2ZM20 3 3 20M21 4l-2 5-3-1-1-3 5-2ZM3 16l5 5M16 21l5-5"/>',
    winter:'<path d="M12 1v22M2.5 6.5l19 11M2.5 17.5l19-11M8 3l4 4 4-4M8 21l4-4 4 4M3 11l5-2-1-5M21 13l-5 2 1 5M3 13l5 2-1 5M21 11l-5-2 1-5"/>',
    damage:'<path d="M4 21V13h4v8M10 21V7h4v14M16 21V2h4v19M2 22h21"/>',
    gem:'<path d="m2 8 5-5h10l5 5-10 14ZM2 8h20M7 3l-2 5 7 14 7-14-2-5M12 3v19"/>',
    coin:'<path d="M7 2h10l5 5v10l-5 5H7l-5-5V7ZM15 7H9v5h6v5H9M12 5v14"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.arena}</svg>`;
  const portrait = id => {
    try { return `<img src="${escape(window.SchoolArt.portrait(id))}" alt="" class="social-portrait">`; }
    catch { return '<span class="social-portrait social-placeholder">✦</span>'; }
  };
  const time = stamp => Number.isFinite(Number(stamp)) ? new Date(Number(stamp)).toLocaleDateString('ko-KR', {month:'numeric',day:'numeric'}) : '';

  function create(context) {
    let generation = 0, loadEpoch = 0, view = '', data = null, busy = false, poll = null, cancelReplay = null, pending = null, stopped = false;
    const own = () => !stopped && document.querySelector(`#school-social[data-view="${view}"]`)?.closest('dialog')?.open;
    const $ = id => document.getElementById(id);
    function stop() { generation++; clearTimeout(poll); poll = null; cancelReplay?.(); cancelReplay = null; }
    function status(message, error = false) {
      const node = $('social-message');
      if (node) { node.textContent = message; node.dataset.error = String(error); }
      else if (error) context.toast?.(message);
    }
    function frame(inner) {
      const titles = {friends:'친구', arena:'아레나', winter:'겨울 이벤트'};
      context.openModal(titles[view], `<section id="school-social" data-view="${view}">${inner}<p id="social-message" role="status" aria-live="polite"></p></section>`, `social-${view}`);
    }
    function loginGate() {
      frame(`<div class="social-empty">${icon(view)}<h3>함께할 준비가 됐나요?</h3><p>Google 계정으로 로그인하면 친구와 대결할 수 있어요.</p><button class="primary" id="social-login">계정 연결</button></div>`);
      $('social-login')?.addEventListener('click', () => context.openAccount?.());
    }
    function header() {
      return `<div class="social-profile"><div>${icon(view)}<span><b>${escape(data?.me?.name || context.getState()?.commanderName || '나의 용병단')}</b><small>${view === 'arena' ? '6 대 6 · 친구 초청전' : '단장 이름으로 친구를 찾아보세요'}</small></span></div>${view === 'arena' ? `<div class="arena-rating"><b>${number(data?.me?.rating || 1000)}</b><small>친선 점수</small></div>` : ''}</div>`;
    }
    function nameGate() {
      return data?.me?.canName ? `<div class="social-name-gate"><b>먼저 나만의 단장 이름을 정해 주세요.</b><p>첫 이름은 무료예요. 이후 변경은 보석 3,000개가 필요해요.</p><button class="primary" id="social-name">단장 이름 정하기</button></div>` : '';
    }
    function requestRow(entry, incoming, arena) {
      const kind = arena ? 'arena' : 'friend';
      return `<div class="social-row"><span class="social-avatar">${icon(arena ? 'arena' : 'friends')}</span><div class="social-person"><b>${escape(entry.name)}</b><small>${arena ? (incoming ? '대결 초대가 도착했어요' : '상대의 수락을 기다리는 중') : incoming ? '친구가 되고 싶어요' : '친구 요청을 보냈어요'}</small></div><div class="social-actions">${incoming ? `<button class="primary" data-social-action="${kind}_accept" data-id="${escape(entry.id)}">${arena ? '대결' : '수락'}</button><button class="secondary" data-social-action="${kind}_decline" data-id="${escape(entry.id)}" aria-label="${escape(entry.name)} 요청 거절">거절</button>` : '<span class="social-waiting">대기</span>'}</div></div>`;
    }
    function friendRow(friend, arena) {
      return `<div class="social-row"><span class="social-avatar">${icon('friends')}</span><div class="social-person"><b>${escape(friend.name)}</b><small>Lv.${number(friend.level)} · 전투력 ${number(friend.power)}</small></div><div class="social-actions"><button class="${arena ? 'primary' : 'secondary'}" data-social-action="arena_invite" data-id="${escape(friend.id)}" aria-label="${escape(friend.name)} 아레나 초대">${icon('arena')}<span>초대</span></button>${arena ? '' : `<button class="social-remove" data-social-action="friend_remove" data-id="${escape(friend.id)}" aria-label="${escape(friend.name)} 친구 삭제">×</button>`}</div></div>`;
    }
    function renderSocial() {
      if (!own()) return;
      const focused = document.activeElement?.id === 'social-friend-name';
      const draft = $('social-friend-name')?.value || '';
      const selection = focused ? [$('social-friend-name').selectionStart, $('social-friend-name').selectionEnd] : null;
      const incoming = data?.requests?.incoming || [], outgoing = data?.requests?.outgoing || [], friends = data?.friends || [];
      const invites = data?.invites || {incoming:[],outgoing:[]};
      const arena = view === 'arena';
      let inner = header() + nameGate();
      if (arena) {
        inner += `<div class="arena-banner"><div class="arena-banner-ring" aria-hidden="true"></div><span>방과 후 결투장</span><b>우리 용병단의 실력을 겨룰 시간</b><small>현재 편성으로 초대 · 보유 용병의 성장 반영</small></div><details class="arena-rules"><summary>친선전 규칙</summary><p>체력 3배 · 회복량 75% · 최대 90초. 45초부터 피해가 점점 강해지며, 시간 종료 시 남은 체력 비율로 승패를 정해요. 방어막은 기존 체력을 기준으로 계산해요.</p><p>친선 점수는 승리 +10, 패배 −5. 재화 보상은 없고 모험 중인 용병단은 영향을 받지 않아요.</p></details>`;
      } else if (!data?.me?.canName) {
        inner += `<form id="social-add-friend" class="social-add"><label class="social-input-label" for="social-friend-name">친구의 단장 이름</label><div><input id="social-friend-name" maxlength="24" autocomplete="off" placeholder="정확한 이름을 입력하세요" value="${escape(draft)}" required><button class="primary" type="submit">친구 요청</button></div></form>`;
      }
      const incomingAll = (invites.incoming || []).map(entry => requestRow(entry, true, true)).join('') + (!arena ? incoming.map(entry => requestRow(entry, true, false)).join('') : '');
      if (incomingAll) inner += `<div class="social-section"><h3>도착한 요청 <span>${(invites.incoming || []).length + (arena ? 0 : incoming.length)}</span></h3>${incomingAll}</div>`;
      const outgoingAll = (invites.outgoing || []).map(entry => requestRow(entry, false, true)).join('') + (!arena ? outgoing.map(entry => requestRow(entry, false, false)).join('') : '');
      if (outgoingAll) inner += `<details class="social-pending" open><summary>보낸 요청</summary>${outgoingAll}</details>`;
      inner += `<div class="social-section"><h3>${arena ? '친구에게 도전' : '내 친구'} <span>${friends.length}</span><button id="social-refresh" class="social-refresh" aria-label="친구와 초대 새로고침">↻</button></h3>${friends.map(friend => friendRow(friend, arena)).join('') || `<div class="social-empty compact">${icon('friends')}<p>${arena ? '친구를 추가하고 첫 대결을 시작해 보세요.' : '아직 친구가 없어요. 단장 이름으로 먼저 인사해 보세요.'}</p>${arena ? '<button id="arena-add-friend" class="secondary">친구 찾기</button>' : ''}</div>`}</div>`;
      if (arena && data?.matches?.length) inner += `<div class="social-section"><h3>최근 대결</h3><div class="arena-history">${data.matches.map(match => `<button class="arena-history-row" data-social-action="arena_match" data-id="${escape(match.id)}"><span class="arena-history-result ${escape(match.result)}">${({win:'승리',loss:'패배',draw:'무승부'})[match.result] || '대결'}</span><b>${escape(match.opponent)}</b><small>${time(match.createdAt)}</small><span aria-hidden="true">▶</span></button>`).join('')}</div></div>`;
      inner += `<p id="social-message" role="status" aria-live="polite"></p>`;
      const root = $('school-social'); root.innerHTML = inner;
      $('social-name')?.addEventListener('click', () => context.openCaptain?.());
      $('arena-add-friend')?.addEventListener('click', () => open('friends'));
      $('social-refresh')?.addEventListener('click', () => fetchState(true));
      $('social-add-friend')?.addEventListener('submit', event => { event.preventDefault(); mutate('friend_request', {name:$('social-friend-name').value.trim()}); });
      root.querySelectorAll('[data-social-action]').forEach(button => button.addEventListener('click', () => mutate(button.dataset.socialAction, {id:button.dataset.id})));
      if (focused && $('social-friend-name')) { $('social-friend-name').focus({preventScroll:true}); $('social-friend-name').setSelectionRange(...selection); }
      lockButtons();
    }
    function lockButtons() { $('school-social')?.querySelectorAll('button,input').forEach(node => { node.disabled = busy; }); }
    function schedulePoll() {
      clearTimeout(poll);
      poll = setTimeout(() => {
        if (!own() || view === 'winter' || cancelReplay) return;
        if (busy || document.hidden) { schedulePoll(); return; }
        fetchState(false);
      }, 5000);
    }
    async function fetchState(manual = false) {
      if (!own() || !context.isCloud() || busy) return;
      const ticket = generation, epoch = ++loadEpoch;
      if (manual) { busy = true; lockButtons(); status('새 소식을 확인하고 있어요…'); }
      try {
        const response = await context.request('/api/school/social', {kind:'state'});
        if (ticket !== generation || epoch !== loadEpoch || !own()) return;
        const waiting = new Set((data?.invites?.outgoing || []).map(invite => invite.id));
        const started = response.matches?.find(match => waiting.has(match.id));
        data = response;
        if (started) {
          busy = true; lockButtons(); status('친구가 초대를 수락했어요. 대결을 불러옵니다…');
          const result = await context.request('/api/school/social', {kind:'arena_match', id:started.id});
          if (ticket !== generation || epoch !== loadEpoch || !own()) return;
          if (result.match) { busy = false; showMatch(result.match); return; }
        }
        renderSocial();
      } catch (error) { if (ticket === generation && epoch === loadEpoch && own()) status(error.message, true); }
      finally { if (ticket === generation && epoch === loadEpoch) { busy = false; lockButtons(); schedulePoll(); } }
    }
    async function mutate(kind, values) {
      if (busy || !own()) return;
      loadEpoch++;
      const ticket = generation;
      const key = JSON.stringify({kind, ...values});
      if (pending?.key !== key) pending = {key, requestId:crypto.randomUUID().replaceAll('-', '')};
      busy = true; lockButtons(); status(kind === 'arena_accept' ? '양쪽 편성으로 대결을 준비하고 있어요…' : '확인하고 있어요…');
      try {
        const response = await context.request('/api/school/social', {kind, ...values, requestId:pending.requestId});
        pending = null;
        if (ticket !== generation || !own()) return;
        if (response.match && ['arena_accept','arena_match'].includes(kind)) { busy = false; showMatch(response.match); return; }
        data = response;
        if (kind === 'arena_invite' && view !== 'arena') { view = 'arena'; frame(''); }
        if (kind === 'friend_request' && $('social-friend-name')) $('social-friend-name').value = '';
        renderSocial();
        status(({friend_request:'친구 요청을 보냈어요.',friend_accept:'새 친구가 생겼어요!',friend_decline:'요청을 거절했어요.',friend_remove:'친구 목록에서 삭제했어요.',arena_invite:'대결 초대를 보냈어요. 2분 안에 수락하면 시작됩니다.',arena_decline:'대결 초대를 거절했어요.'})[kind] || '완료했어요.');
      } catch (error) { if (ticket === generation && own()) status(error.message, true); }
      finally { if (ticket === generation) { busy = false; lockButtons(); if (!cancelReplay) schedulePoll(); } }
    }
    function winterMarkup() {
      const info = window.SchoolRPG.winterInfo?.(context.getState());
      if (!info) return '<div class="social-empty">겨울 이벤트를 준비하고 있어요.</div>';
      return `<div class="winter-banner"><div class="winter-snow" aria-hidden="true">✦ · ✧ · ✦</div>${icon('winter')}<small>WINTER FESTIVAL</small><h3>${escape(info.name)}</h3><p>모험 끝에 찾아온 작은 눈송이</p></div><div class="winter-wallet"><span>${icon('winter')} 내 눈송이</span><b id="winter-balance">${number(info.snowflakes)}</b></div><div class="winter-shop">${info.items.map(item => `<div class="winter-item"><span class="winter-reward-icon ${item.id}">${icon(item.gems ? 'gem' : 'coin')}</span><div><b>${item.gems ? '보석' : '코인'} ${number(item.gems || item.gold)}</b><small>남은 교환 ${number(item.remaining)} / ${number(item.limit)}</small></div><button class="primary" data-winter-item="${escape(item.id)}" ${!item.canBuy || busy ? 'disabled' : ''} aria-label="${item.gems ? '보석' : '코인'} 교환, 눈송이 ${number(item.cost)}개">${icon('winter')}${number(item.cost)}</button></div>`).join('')}</div><p class="social-note">전투 승리 시 가끔 눈송이를 얻어요. 보스는 한 번에 2개! 교환 한도는 이벤트 전체에 적용됩니다.</p><p id="social-message" role="status" aria-live="polite"></p>`;
    }
    function renderWinter() {
      if (!own()) return;
      $('school-social').innerHTML = winterMarkup();
      $('school-social').querySelectorAll('[data-winter-item]').forEach(button => button.addEventListener('click', async () => {
        if (busy) return;
        const ticket = generation, before = window.SchoolRPG.winterInfo(context.getState()).snowflakes;
        busy = true; lockButtons(); let message = '', failed = false;
        try {
          await context.dispatch({kind:'winter-exchange',item:button.dataset.winterItem});
          if (ticket !== generation || !own()) return;
          if (window.SchoolRPG.winterInfo(context.getState()).snowflakes < before) message = '교환한 보상을 받았어요!';
        } catch (error) { message = error.message; failed = true; }
        finally { if (ticket === generation && own()) { busy = false; renderWinter(); if (message) status(message, failed); } }
      }));
    }
    function open(next) {
      stop(); stopped = false; view = next; busy = false;
      if (next === 'winter') { frame(winterMarkup()); renderWinter(); return; }
      if (!context.isCloud()) { data = null; loginGate(); return; }
      frame(`<div class="social-empty">${icon(next)}<h3>용병단 소식을 불러오는 중…</h3><div class="social-loader" aria-label="불러오는 중"></div></div>`);
      fetchState(true);
    }

    function showMatch(match) {
      stop(); view = 'arena'; busy = false;
      const me = Number(match.meSide) === 1 ? 1 : 0;
      const teams = match.teams || [];
      if (teams.length !== 2) { context.toast?.('대결 기록을 불러오지 못했어요.'); open('arena'); return; }
      frame(`<div class="arena-match-heading"><div><small>${me === 0 ? '나의 용병단' : '상대 용병단'}</small><b>${escape(teams[0].name)}</b></div><span>VS</span><div><small>${me === 1 ? '나의 용병단' : '상대 용병단'}</small><b>${escape(teams[1].name)}</b></div></div><div class="arena-stage"><canvas id="arena-canvas" aria-label="서버에서 확정된 두 용병단의 아레나 전투 재생"></canvas><div id="arena-replay-result" hidden></div></div><div class="arena-playback"><span id="arena-clock">0:00</span><progress id="arena-progress" max="${Math.max(1, Number(match.durationMs) || 1)}" value="0" aria-label="대결 재생 진행률"></progress><button class="secondary" id="arena-skip">결과 보기</button><button class="secondary" id="arena-damage-report" aria-label="대결 기여도 보기" title="딜량 · 치유량">${icon('damage')}</button></div><div id="arena-damage-content" hidden></div><div class="arena-return"><button class="secondary" id="arena-back">아레나로 돌아가기</button><small>양쪽 편성으로 서버에서 진행한 대결입니다.</small></div>`);
      $('arena-back').addEventListener('click', () => open('arena'));
      $('arena-damage-report').addEventListener('click', () => {
        const target = $('arena-damage-content'); target.hidden = !target.hidden;
        if (!target.hidden) {
          target.innerHTML = damageMarkup(match);
          target.scrollIntoView({block:'nearest',behavior:'smooth'});
        }
      });
      cancelReplay = replay(match, me, () => own() && !!$('arena-canvas'));
      $('arena-skip').addEventListener('click', () => cancelReplay?.finish());
    }

    function refresh() {
      if (!own()) return;
      if (view === 'winter' && !busy) {
        const balance = number(window.SchoolRPG.winterInfo?.(context.getState())?.snowflakes);
        if ($('winter-balance')?.textContent !== balance) renderWinter();
      }
    }
    return {openFriends:() => open('friends'),openArena:() => open('arena'),openWinter:() => open('winter'),refresh,destroy() {stop();stopped = true;data = null;}};
  }

  function damageMarkup(match) {
    return `<div class="arena-damage-grid">${match.teams.map((team,side) => {
      const records = [...(match.damage?.[side] || [])].sort((a,b) => b.damage - a.damage);
      const max = Math.max(1, ...records.map(row => Number(row.damage) || 0));
      return `<section><h4>${escape(team.name)}</h4>${records.map(row => `<div class="arena-damage-row">${portrait(row.id)}<div><span><b>${escape(window.SchoolRPG.BY_ID[row.id]?.name || row.id)}</b><strong>${number(row.damage)}</strong></span><progress max="${max}" value="${Number(row.damage) || 0}" aria-label="가한 피해"></progress><small>치유 ${number(row.healing)}</small></div></div>`).join('')}</section>`;
    }).join('')}</div>`;
  }

  function replay(match, me, alive) {
    const canvas = document.getElementById('arena-canvas'), c = canvas.getContext('2d');
    const background = document.createElement('canvas'), bc = background.getContext('2d');
    let cancelled = false, finished = false, frame = 0, clock = 0, previous = 0, lastDraw = 0, lastDom = -1000, cursor = 0;
    let events = [...(match.events || [])].sort((a,b) => a.t - b.t), effects = [];
    const duration = Math.max(1, Number(match.durationMs) || Number(events.at(-1)?.t) || 1000);
    const units = match.teams.map((team,side) => team.units.map((unit,index) => ({...unit,hp:unit.max || unit.hp,shield:0,side,index,actAt:-10000,hitAt:-10000,actKind:'attack',skill:''})));
    const byKey = new Map(units.flat().map(unit => [`${unit.side}:${unit.id}`,unit]));
    const positions = new Map(units.flat().map(unit => {
      const column = unit.index < 3 ? 1 : 0, row = unit.index % 3;
      const x = 130 + column * 185 + row * 18, y = 173 + row * 91;
      return [`${unit.side}:${unit.id}`, {x:unit.side ? 960 - x : x,y}];
    }));
    let scale = 1, cssWidth = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
    function scenery() {
      const width = Math.max(320, Math.round(canvas.getBoundingClientRect().width));
      if (width === cssWidth) return;
      cssWidth = width;
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.min(1800, Math.round(width * dpr)); canvas.height = Math.round(canvas.width * 420 / 960);
      background.width = canvas.width; background.height = canvas.height; scale = canvas.width / 960;
      bc.setTransform(scale,0,0,scale,0,0); bc.imageSmoothingEnabled = false;
      const fill = (color,x,y,w,h) => {bc.fillStyle=color;bc.fillRect(x,y,w,h);};
      fill('#192330',0,0,960,420); fill('#283d50',0,0,960,150); fill('#31475b',0,150,960,270);
      for (let i=0;i<8;i++) { fill('#223142',i*140,0,13,150); fill('#496277',i*140+13,20,110,5); }
      for (let i=0;i<16;i++) { fill(i%2?'#557080':'#496576',i*64,100,64,25); fill('#344b5c',i*64+6,128,49,7); }
      fill('#1b2a38',0,144,960,15); fill('#a5ac9d',0,159,960,5);
      for (let y=171;y<420;y+=36) { fill('#40596b',0,y,960,2); for(let x=(y%72?0:50);x<960;x+=100)fill('#40596b',x,y,2,36); }
      bc.strokeStyle='#b5bb96';bc.lineWidth=3;bc.strokeRect(70,182,820,195);bc.beginPath();bc.ellipse(480,283,115,69,0,0,Math.PI*2);bc.moveTo(480,182);bc.lineTo(480,377);bc.stroke();
      fill('#1b2b3c',402,25,156,74);fill('#c9b373',407,30,146,3);
      bc.font='20px Galmuri,monospace';bc.fillStyle='#ebdb9d';bc.textAlign='center';bc.fillText('ARENA',480,60);bc.font='10px Galmuri,monospace';bc.fillStyle='#c4d8d7';bc.fillText('방과 후 결투장',480,82);
      for(const x of [32,928]) {fill('#c6aa62',x-6,38,12,93);fill('#465f72',x-20,51,40,55);fill('#d1b36c',x-14,59,28,4);fill('#d1b36c',x-2,57,4,30);}
    }
    function apply(event) {
      const from = byKey.get(`${event.side}:${event.from}`), target = byKey.get(`${event.toSide}:${event.target}`);
      if (from) {from.actAt = event.t;from.actKind=event.kind;from.skill=event.skill || '';from.actStage=event.stage || 1;}
      if (target) {
        if (Number.isFinite(event.hp)) target.hp = Math.max(0,event.hp);
        else if (['attack','skill'].includes(event.kind)) target.hp = Math.max(0,target.hp-(event.amount || 0));
        else if (event.kind==='heal') target.hp = Math.min(target.max,target.hp+(event.amount || 0));
        else if (event.kind==='down') target.hp = 0;
        if (Number.isFinite(event.shield)) target.shield=Math.max(0,event.shield);
        if (['attack','skill'].includes(event.kind)) target.hitAt=event.t;
      }
      if (!reduced) effects.push(event);
      if (effects.length>28) effects.splice(0,effects.length-28);
    }
    function complete() {
      if (finished) return; finished=true;clock=duration;
      while(cursor<events.length) apply(events[cursor++]);
      const node=document.getElementById('arena-replay-result');
      if (node) {
        const result=match.winner===-1?'draw':match.winner===me?'win':'loss';
        const delta = typeof match.ratingChange === 'number' ? match.ratingChange : Number(match.ratingChange?.[me]) || 0;
        node.hidden=false;node.dataset.result=result;
        node.innerHTML=`<small>ARENA RESULT</small><strong>${{win:'승리',loss:'패배',draw:'무승부'}[result]}</strong><span>${result==='win'?'우리 용병단이 결투장을 제패했어요!':result==='loss'?'편성을 바꾸고 다시 도전해 보세요.':'팽팽한 대결이었어요.'}</span>${delta ? `<b>친선 점수 ${delta>0?'+':''}${delta}</b>` : ''}`;
      }
      const skip=document.getElementById('arena-skip');if(skip){skip.textContent='재생 완료';skip.disabled=true;}
    }
    function draw() {
      scenery();c.setTransform(1,0,0,1,0,0);c.drawImage(background,0,0);c.setTransform(scale,0,0,scale,0,0);c.imageSmoothingEnabled=false;
      units.flat().sort((a,b)=>positions.get(`${a.side}:${a.id}`).y-positions.get(`${b.side}:${b.id}`).y).forEach(unit=>{
        const position=positions.get(`${unit.side}:${unit.id}`),actAge=(clock-unit.actAt)/1000,hitAge=clock-unit.hitAt;
        const casting=['skill','heal','shield'].includes(unit.actKind)&&actAge>=0&&actAge<1.15&&unit.hp>0;
        const attacking=actAge>=0&&actAge<.48&&unit.hp>0, direction=unit.side?-1:1;
        const move=attacking&&!reduced?Math.sin(actAge/.48*Math.PI)*15*direction:0;
        const motion=casting&&['osia','lava'].includes(unit.id)?window.SchoolArt?.poseForSkill?.(unit.id,unit.actStage,actAge,reduced):null;
        window.SchoolArt?.hero(c,unit.id,position.x+move,position.y,2.3,{time:clock/1000,dead:unit.hp<=0,flip:!!unit.side,attack:attacking&&!casting,attackAge:attacking&&!casting?actAge:null,casting,motion,hit:hitAge>=0&&hitAge<100,pose:motion?.pose??(attacking?2:0),reduced});
        c.fillStyle='#14222ce6';c.fillRect(position.x-38,position.y+8,76,8);c.fillStyle=unit.side===me?'#a4c478':'#dc8d7f';c.fillRect(position.x-37,position.y+9,74*Math.max(0,unit.hp)/Math.max(1,unit.max),6);
        if(unit.shield>0){c.fillStyle='#9dd4e2';c.fillRect(position.x-37,position.y+16,74*Math.min(1,unit.shield/Math.max(1,unit.max)),3);}
        c.font='9px Galmuri,monospace';c.textAlign='center';c.fillStyle=unit.hp>0?'#edf0e5':'#93a0a6';c.fillText(unit.name || window.SchoolRPG.BY_ID[unit.id]?.name || unit.id,position.x,position.y+30);
      });
      effects=effects.filter(event=>clock-event.t<800);
      for(const event of effects){
        const age=(clock-event.t)/800;if(age<0)continue;
        const p=positions.get(`${event.toSide}:${event.target}`),from=positions.get(`${event.side}:${event.from}`);if(!p)continue;
        const healing=event.kind==='heal', shield=event.kind==='shield';
        c.save();c.globalAlpha=Math.min(1,(1-age)*2);
        if(from&&['attack','skill'].includes(event.kind)&&age<.28){c.strokeStyle=event.crit?'#ffe69d':event.kind==='skill'?'#b7e8ff':'#f7f1dc';c.lineWidth=event.crit?5:3;c.beginPath();c.moveTo(from.x,from.y-47);c.lineTo(p.x,p.y-48);c.stroke();}
        if(event.amount){c.textAlign='center';c.font=`${event.crit?20:15}px Galmuri,monospace`;c.fillStyle=healing?'#b8efb5':shield?'#acdbf0':event.crit?'#ffcf71':'#fff1df';c.strokeStyle='#233244';c.lineWidth=3;const label=(healing?'+':shield?'+':'')+number(event.amount),y=p.y-79-age*24;c.strokeText(label,p.x,y);c.fillText(label,p.x,y);if(event.crit){c.fillStyle='#ffe49a';c.fillRect(p.x-6,y-29,12,5);c.fillRect(p.x-2,y-33,4,13);c.fillRect(p.x-12,y-26,4,4);c.fillRect(p.x+8,y-26,4,4);}}
        c.restore();
      }
      if(clock-lastDom>=200||finished){lastDom=clock;const seconds=Math.floor(clock/1000),label=document.getElementById('arena-clock'),progress=document.getElementById('arena-progress');if(label)label.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;if(progress)progress.value=clock;}
    }
    function tick(now){
      if(cancelled||!alive()){cancelled=true;return;}
      if(document.hidden){previous=now;frame=requestAnimationFrame(tick);return;}
      if(!previous)previous=now;
      if(!finished)clock=Math.min(duration,clock+Math.min(80,now-previous));previous=now;
      while(cursor<events.length&&events[cursor].t<=clock)apply(events[cursor++]);
      if(clock>=duration)complete();
      if(now-lastDraw>=1000/(reduced?15:60)-1){lastDraw=now;draw();}
      if(!finished)frame=requestAnimationFrame(tick);
    }
    const cancel=()=>{cancelled=true;cancelAnimationFrame(frame);};
    cancel.finish=()=>{if(cancelled||!alive())return;complete();draw();cancelAnimationFrame(frame);};
    frame=requestAnimationFrame(tick);return cancel;
  }
  window.SchoolSocial=Object.freeze({create});
})();
