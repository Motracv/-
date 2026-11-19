/* Friends, authoritative arena replays and the winter exchange. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const number = value => Math.max(0, Math.round(Number(value) || 0)).toLocaleString('ko-KR');
  const icons = {
    friends:'<path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM1 22v-3a7 7 0 0 1 14 0v3M17 5a4 4 0 0 1 0 8M18 16a6 6 0 0 1 5 6"/>',
    arena:'<path d="m4 3 17 17M3 4l2 5 3-1 1-3-5-2ZM20 3 3 20M21 4l-2 5-3-1-1-3 5-2ZM3 16l5 5M16 21l5-5"/>',
    winter:'<path d="M12 1v22M2.5 6.5l19 11M2.5 17.5l19-11M8 3l4 4 4-4M8 21l4-4 4 4M3 11l5-2-1-5M21 13l-5 2 1 5M3 13l5 2-1 5M21 11l-5-2 1-5"/>',
    snowman:'<circle cx="12" cy="7" r="4"/><circle cx="12" cy="17" r="6"/><path d="M8 3h8M9 3V1h6v2M5 15l-4-3M19 15l4-3M11 7h2M12 14v5"/>',
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
    let generation = 0, loadEpoch = 0, view = '', data = null, busy = false, poll = null, cancelReplay = null, pending = null, stopped = false, winterSignature = '';
    let spinRotation=0, spinAnimation=null;
    let arenaMode='season', seasonPanel='opponents', seasonData=null, seasonClock=null, seasonPending=null, seasonScope=null, seasonLoading=false, seasonContentKey='', seasonDefenseKey='', seasonPortraitKey='', seasonCountdownSecond=-1, seasonPointer=false, seasonRolloverKey='';
    const own = () => !stopped && document.querySelector(`#school-social[data-view="${view}"]`)?.closest('dialog')?.open;
    const $ = id => document.getElementById(id);
    const now = () => context.serverNow?.() ?? Date.now();
    const winterInfo = () => window.SchoolRPG.winterInfo?.(context.getState(), now());
    const winterBlocked = () => busy || !!context.isBlocked?.();
    function stop() { spinAnimation?.cancel();spinAnimation=null;generation++; seasonLoading=false; clearTimeout(poll); poll = null; cancelReplay?.(); cancelReplay = null; }
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
      return `<div class="social-row"><button class="social-avatar inspect-avatar" data-inspect-name="${escape(entry.name)}" aria-label="${escape(entry.name)} 프로필 보기">${icon(arena ? 'arena' : 'friends')}</button><div class="social-person"><b>${escape(entry.name)}</b><small>${arena ? (incoming ? '대결 초대가 도착했어요' : '상대의 수락을 기다리는 중') : incoming ? '친구가 되고 싶어요' : '친구 요청을 보냈어요'}</small></div><div class="social-actions">${incoming ? `<button class="primary" data-social-action="${kind}_accept" data-id="${escape(entry.id)}">${arena ? '대결' : '수락'}</button><button class="secondary" data-social-action="${kind}_decline" data-id="${escape(entry.id)}" aria-label="${escape(entry.name)} 요청 거절">거절</button>` : '<span class="social-waiting">대기</span>'}</div></div>`;
    }
    function friendRow(friend, arena) {
      return `<div class="social-row">${window.SchoolGuild.avatar(friend,friend.hero)}<div class="social-person"><b>${escape(friend.name)}</b><small>Lv.${number(friend.level)} · 전투력 ${number(friend.power)}</small></div><div class="social-actions"><button class="${arena ? 'primary' : 'secondary'}" data-social-action="arena_invite" data-id="${escape(friend.id)}" aria-label="${escape(friend.name)} 아레나 초대">${icon('arena')}<span>초대</span></button>${arena ? '' : `<button class="social-remove" data-social-action="friend_remove" data-id="${escape(friend.id)}" aria-label="${escape(friend.name)} 친구 삭제">×</button>`}</div></div>`;
    }
    function renderSocial() {
      if (!own()) return;
      const focused = document.activeElement?.id === 'social-friend-name';
      const draft = $('social-friend-name')?.value || '';
      const selection = focused ? [$('social-friend-name').selectionStart, $('social-friend-name').selectionEnd] : null;
      const incoming = data?.requests?.incoming || [], outgoing = data?.requests?.outgoing || [], friends = data?.friends || [];
      const invites = data?.invites || {incoming:[],outgoing:[]};
      const arena = view === 'arena';
      let inner = (arena ? arenaTabs()+'<div class="friendly-shell"><aside class="friendly-rail" aria-label="친선전 안내">' : '') + header() + nameGate();
      if (arena) {
        inner += `<div class="arena-banner"><div class="arena-banner-ring" aria-hidden="true"></div><span>방과 후 결투장</span><b>친구와 6 대 6</b><small>현재 편성으로 초대하고<br>상대가 수락하면 시작해요.</small></div><details class="arena-rules"><summary>친선전 규칙</summary><p>체력 3배 · 회복량 75% · 최대 90초. 45초부터 피해가 점점 강해지며, 시간 종료 시 남은 체력 비율로 승패를 정해요. 방어막은 기존 체력을 기준으로 계산해요.</p><p>호라스는 아레나에서 기본 공격과 의식 피해가 모험의 78%로 적용돼요. 기절 대상 1.5배와 스택·표식 효과는 유지돼요.</p><p>친선 점수는 승리 +10, 패배 −5. 재화 보상은 없고 모험 중인 용병단은 영향을 받지 않아요.</p></details></aside><div class="friendly-content" aria-label="친구 대결과 기록">`;
      } else if (!data?.me?.canName) {
        inner += `<form id="social-add-friend" class="social-add"><label class="social-input-label" for="social-friend-name">친구의 단장 이름</label><div><input id="social-friend-name" maxlength="24" autocomplete="off" placeholder="정확한 이름을 입력하세요" value="${escape(draft)}" required><button class="primary" type="submit">친구 요청</button></div></form>`;
      }
      const incomingAll = (invites.incoming || []).map(entry => requestRow(entry, true, true)).join('') + (!arena ? incoming.map(entry => requestRow(entry, true, false)).join('') : '');
      if (incomingAll) inner += `<div class="social-section"><h3>도착한 요청 <span>${(invites.incoming || []).length + (arena ? 0 : incoming.length)}</span></h3>${incomingAll}</div>`;
      const outgoingAll = (invites.outgoing || []).map(entry => requestRow(entry, false, true)).join('') + (!arena ? outgoing.map(entry => requestRow(entry, false, false)).join('') : '');
      if (outgoingAll) inner += `<details class="social-pending" open><summary>보낸 요청</summary>${outgoingAll}</details>`;
      inner += `<div class="social-section"><h3>${arena ? '친구에게 도전' : '내 친구'} <span>${friends.length}</span><button id="social-refresh" class="social-refresh" aria-label="친구와 초대 새로고침">↻</button></h3>${friends.map(friend => friendRow(friend, arena)).join('') || `<div class="social-empty compact">${icon('friends')}<p>${arena ? '친구를 추가하고 첫 대결을 시작해 보세요.' : '아직 친구가 없어요. 단장 이름으로 먼저 인사해 보세요.'}</p>${arena ? '<button id="arena-add-friend" class="secondary">친구 찾기</button>' : ''}</div>`}</div>`;
      if (arena && data?.matches?.length) inner += `<div class="social-section"><h3>최근 대결</h3><div class="arena-history">${data.matches.map(match => `<button class="arena-history-row" data-social-action="arena_match" data-id="${escape(match.id)}"><span class="arena-history-result ${escape(match.result)}">${({win:'승리',loss:'패배',draw:'무승부'})[match.result] || '대결'}</span><b>${escape(match.opponent)}</b><small>${time(match.createdAt)}</small><span aria-hidden="true">▶</span></button>`).join('')}</div></div>`;
      if(arena)inner+='</div></div>';
      inner += `<p id="social-message" role="status" aria-live="polite"></p>`;
      const root = $('school-social'),scrollNodes=arena?Array.from(root.querySelectorAll('.friendly-rail,.friendly-content')).map(node=>node.scrollTop):[];
      root.innerHTML = inner; if(arena){root.dataset.arenaMode='friendly';bindArenaTabs();root.querySelectorAll('.friendly-rail,.friendly-content').forEach((node,index)=>{node.scrollTop=scrollNodes[index]||0;});}
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
        if (kind === 'arena_invite' && view !== 'arena') { view = 'arena'; arenaMode='friendly'; frame(''); }
        if (kind === 'friend_request' && $('social-friend-name')) $('social-friend-name').value = '';
        renderSocial();
        status(({friend_request:'친구 요청을 보냈어요.',friend_accept:'새 친구가 생겼어요!',friend_decline:'요청을 거절했어요.',friend_remove:'친구 목록에서 삭제했어요.',arena_invite:'대결 초대를 보냈어요. 2분 안에 수락하면 시작됩니다.',arena_decline:'대결 초대를 거절했어요.'})[kind] || '완료했어요.');
      } catch (error) { if (ticket === generation && own()) status(error.message, true); }
      finally { if (ticket === generation) { busy = false; lockButtons(); if (!cancelReplay) schedulePoll(); } }
    }
    const tierName = tier => ({bronze:'브론즈',silver:'실버',gold:'골드',diamond:'다이아몬드'})[typeof tier === 'string' ? tier : tier?.id] || tier?.name || '브론즈';
    const frameName = frame => ['bronze','silver','gold','diamond'].find(name => String(frame || '').includes(name)) || 'none';
    const cosmeticMarkup = cosmetic => cosmetic?.title ? `<span class="season-cosmetic" data-frame="${frameName(cosmetic.frame)}">✦ ${escape(cosmetic.title)}</span>` : '';
    const seasonNow = () => seasonClock ? seasonClock.time + Math.max(0,performance.now()-seasonClock.at) : now();
    const setSeasonText = (id,value) => { const node=$(id),text=String(value);if(node&&node.textContent!==text)node.textContent=text; };
    const arenaTabs = () => `<div class="arena-mode-tabs" role="group" aria-label="아레나 종류"><button type="button" data-arena-mode="season" aria-pressed="${arenaMode === 'season'}">시즌전</button><button type="button" data-arena-mode="friendly" aria-pressed="${arenaMode === 'friendly'}">친선전</button></div>`;
    function bindArenaTabs() { $('school-social')?.querySelectorAll('[data-arena-mode]').forEach(button=>button.addEventListener('click',()=>{if(busy||arenaMode===button.dataset.arenaMode)return;arenaMode=button.dataset.arenaMode;open('arena');})); }
    function pendingKey(accountId) { return `school-season-pending:${accountId}`; }
    function loadSeasonPending() {
      const id=context.getProfile()?.id;
      if(seasonScope!==id){seasonData=null;seasonClock=null;}
      seasonPending=null;seasonScope=id;
      if(!id)return;
      try { const saved=JSON.parse(sessionStorage.getItem(pendingKey(id))||'null');if(saved?.accountId===id&&saved.input?.requestId&&['season_attack','season_register','season_equip'].includes(saved.input.kind))seasonPending=saved.input; } catch {}
    }
    function rememberSeasonPending(input,accountId=seasonScope,expectedId=null) {
      try {
        if(input)sessionStorage.setItem(pendingKey(accountId),JSON.stringify({accountId,input}));
        else {
          const stored=JSON.parse(sessionStorage.getItem(pendingKey(accountId))||'null');
          // A late response from a closed dialog cannot erase a newer intent.
          if(expectedId&&stored?.input?.requestId&&stored.input.requestId!==expectedId)return;
          if(expectedId&&accountId===seasonScope&&seasonPending?.requestId&&seasonPending.requestId!==expectedId)return;
          sessionStorage.removeItem(pendingKey(accountId));
        }
      }
      catch { if(input)throw Error('안전한 요청 저장을 사용할 수 없어요. 일반 브라우저에서 다시 시도해 주세요.'); }
      if(accountId===seasonScope)seasonPending=input;
    }
    function acceptSeason(response) {
      if(!response?.season||!response.me)return;
      seasonData=response;
      if(Number.isFinite(response.serverTime))seasonClock={time:response.serverTime,at:performance.now()};
    }
    function seasonMarkup() {
      return `${arenaTabs()}<div class="season-shell"><aside class="season-rail" aria-label="내 시즌 정보와 방어 편성"><div class="season-topline"><b id="season-name">시즌 아레나</b><span id="season-countdown"></span></div><div class="season-profile"><div id="season-profile-art" class="season-profile-art"></div><div class="season-identity"><b id="season-commander"></b><span id="season-cosmetic"></span></div><div class="season-stats"><div class="season-score"><b id="season-tier"></b><strong id="season-rating">—</strong><small>시즌 점수</small></div><div class="season-entry"><small>오늘 남은 도전</small><b id="season-remaining">— / 5</b></div></div><span id="season-day-countdown" class="season-reset"></span></div><div id="season-defense-panel"></div></aside><div class="season-main"><div class="season-navigation" role="group" aria-label="시즌전 메뉴">${[['opponents','도전'],['ranking','순위'],['history','기록'],['rewards','보상']].map(([id,label])=>`<button type="button" data-season-panel="${id}" aria-pressed="${seasonPanel===id}">${label}</button>`).join('')}<button type="button" id="season-refresh" aria-label="시즌 정보 새로고침">↻</button></div><div class="season-pending" id="season-pending" hidden><span id="season-pending-message">이전 요청의 결과를 확인해 주세요.</span><button type="button" class="primary" id="season-pending-retry">결과 확인</button><button type="button" class="primary" id="season-connect" hidden>계정 연결</button></div><div id="season-content" class="season-content" aria-live="off"><div class="social-empty"><div class="social-loader" aria-label="시즌 정보 불러오는 중"></div></div></div><p id="season-feedback" class="season-feedback" role="status" aria-live="polite"></p></div></div>`;
    }
    function setupSeason() {
      frame(seasonMarkup());const root=$('school-social');root.dataset.arenaMode='season';seasonContentKey='';seasonDefenseKey='';seasonPortraitKey='';seasonCountdownSecond=-1;seasonPointer=false;
      bindArenaTabs();
      root.addEventListener('pointerdown',()=>{seasonPointer=true;});
      const release=()=>{if(!seasonPointer)return;seasonPointer=false;if(own()&&arenaMode==='season'&&!cancelReplay)requestAnimationFrame(()=>renderSeason());};
      root.addEventListener('pointerup',release);root.addEventListener('pointercancel',release);root.addEventListener('pointerleave',release);
      root.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.closest('button'))seasonPointer=true;});
      root.addEventListener('keyup',release);
      root.addEventListener('click',event=>{
        const button=event.target.closest('button');if(!button||button.disabled)return;
        if(button.dataset.seasonPanel){seasonPanel=button.dataset.seasonPanel;seasonContentKey='';renderSeason();}
        else if(button.id==='season-register')seasonMutate('season_register',{});
        else if(button.dataset.seasonAttack)seasonMutate('season_attack',{targetId:button.dataset.seasonAttack});
        else if(button.dataset.seasonMatch)readSeasonMatch(button.dataset.seasonMatch);
        else if(button.hasAttribute('data-season-equip'))seasonMutate('season_equip',{awardId:button.dataset.seasonEquip||null});
        else if(button.id==='season-refresh')fetchSeason(true);
        else if(button.id==='season-pending-retry')seasonMutate(null,null,true);
        else if(button.id==='season-name-setup')context.openCaptain?.();
        else if(button.id==='season-connect')context.openAccount?.();
      });
      loadSeasonPending();renderSeason();
    }
    function teamMarkup(team) {
      return `<span class="season-team">${(team||[]).slice(0,6).map(entry=>{const id=typeof entry==='string'?entry:entry.id;return window.SchoolRPG.BY_ID[id]?`<span title="${escape(window.SchoolRPG.BY_ID[id].name)}">${portrait(id)}</span>`:'';}).join('')}</span>`;
    }
    function seasonDefenseMarkup() {
      const me=seasonData.me,defense=me.defense,registered=me.registered;
      if(me.requiresName)return '<p class="season-hint">단장 이름을 정한 뒤 시즌에 참가할 수 있어요.</p>';
      return `<div class="season-defense"><div><b>${registered?'나의 방어 편성':'시즌 참가 준비'}</b><small>${registered?`전투력 ${number(defense?.power)}`:'현재 편성으로 등록해요'}</small>${teamMarkup(defense?.team||context.getState()?.team)}</div><button type="button" class="${registered?'secondary':'primary'}" id="season-register" ${!me.canRegister?'disabled':''}>${registered?'방어 편성 갱신':'시즌 참가'}</button></div>${registered?window.SchoolEquipment?.snapshotMarkup(defense,'방어 장비')||'':''}`;
    }
    function seasonPanelMarkup() {
      const s=seasonData,me=s.me,rules=s.rules||{},registered=me.registered;
      if(seasonPanel==='opponents') {
        if(me.requiresName)return `<div class="social-empty compact"><h3>단장 이름을 먼저 정해 주세요</h3><p>시즌전에서는 이름과 등록한 방어 편성이 공개돼요.</p><button type="button" class="primary" id="season-name-setup">이름 정하기</button></div>`;
        const candidates=s.candidates||[];
        return `<p class="season-hint">비슷한 전투력의 단원 · 같은 상대는 하루 1회</p>${!registered?'<div class="season-empty">시즌에 참가하면 상대를 찾을 수 있어요.<br>접속 중이 아니어도 등록된 방어 편성과 대결합니다.</div>':candidates.length?`<div class="season-opponents">${candidates.map(player=>`<article class="season-opponent"><div class="season-opponent-name"><button class="text-button" data-inspect-name="${escape(player.name)}"><b>${escape(player.name)} ↗</b></button><span>${tierName(player.tier)} · ${number(player.rating)}점</span>${cosmeticMarkup(player.cosmetic)}</div>${teamMarkup(player.team)}<small>전투력 ${number(player.power)}</small><button type="button" class="primary" data-season-attack="${escape(player.id)}">도전 <span aria-hidden="true">↗</span></button></article>`).join('')}</div>`:'<div class="season-empty">지금은 비슷한 전투력의 도전 가능한 단원이 없어요.<br>새 단원이 참가하면 이곳에 표시됩니다.</div>'}<details class="season-rules"><summary>시즌전 규칙</summary><p>4주 시즌 · 한국 시간 매일 00:00에 도전 ${number(rules.dailyAttacks||5)}회 갱신. 승리 +${number(rules.win??20)}, 패배 ${rules.loss??-10}, 무승부 0점. 방어전 결과로 내 점수는 변하지 않아요.</p><p>공격은 현재 편성, 방어는 등록 당시 편성으로 진행해요. 전투력 ${Math.round((rules.powerRange?.[0]??.65)*100)}~${Math.round((rules.powerRange?.[1]??1.35)*100)}%의 실제 단원만 표시합니다. 시즌 종료 전 ${number(rules.minimumRewardAttacks||5)}회 이상 도전하면 최종 티어의 칭호·테두리를 얻어요.</p></details>`;
      }
      if(seasonPanel==='ranking')return `<div class="season-list-head"><b>이번 시즌 순위</b><small>점수 · 도전 횟수</small></div><ol class="season-rankings">${(s.rankings||[]).map(player=>`<li class="${player.isMe?'season-self':''}"><span class="season-rank-number">${number(player.rank)}</span><div class="season-rank-person" data-frame="${frameName(player.cosmetic?.frame)}"><b class="ranking-person">${window.SchoolGuild.avatar(player,player.hero)}<span>${escape(player.name)}${player.isMe?' · 나':''}</span></b>${cosmeticMarkup(player.cosmetic)}<small>${tierName(player.tier)}</small></div><div class="season-rank-score"><b>${number(player.rating)}</b><small>${number(player.attacks)}회</small></div></li>`).join('')}</ol>${s.rankings?.length?'':'<div class="season-empty">아직 참가한 단원이 없어요. 이번 시즌의 첫 주인공이 되어 보세요.</div>'}`;
      if(seasonPanel==='history')return `<div class="season-list-head"><b>최근 시즌 대결</b><small>방어전은 점수 변화 없음</small></div><div class="arena-history season-history">${(s.matches||[]).map(match=>`<button type="button" class="arena-history-row" data-season-match="${escape(match.id)}"><span class="arena-history-result ${escape(match.result)}">${({win:'승리',loss:'패배',draw:'무승부'})[match.result]||'대결'}</span><b>${escape(match.opponent)}<small>시즌 ${number(match.seasonId)} · ${match.isAttack?'공격':'방어'} · ${time(match.createdAt)}</small></b><span>${match.isAttack?(match.ratingChange>0?'+':'')+String(match.ratingChange||0):'—'}</span><span aria-hidden="true">▶</span></button>`).join('')||'<div class="season-empty">아직 시즌 대결 기록이 없어요.</div>'}</div>`;
      const awards=s.awards||[],equipped=awards.some(award=>award.equipped);
      return `<div class="season-rewards-head"><div><b>시즌 명예 보상</b><p>종료 시 최종 티어의 칭호·테두리 지급 · 능력치 보너스 없음</p></div><span>${number(me.attacks)} / ${number(rules.minimumRewardAttacks||5)}회 도전</span></div><div class="season-awards">${awards.map(award=>`<article class="season-award" data-frame="${frameName(award.frame)}"><span class="season-award-emblem" aria-hidden="true">✦</span><div><b>${escape(award.title)}</b><small>시즌 ${escape(typeof award.season==='object'?award.season.number:award.season)} · ${tierName(award.tier)}</small></div><button type="button" class="secondary" data-season-equip="${escape(award.id)}" data-equipped="${!!award.equipped}">${award.equipped?'착용 중':'착용'}</button></article>`).join('')||'<div class="season-empty">아직 받은 시즌 보상이 없어요.<br>이번 시즌에 5회 이상 도전하고 종료 후 확인해 주세요.</div>'}</div>${equipped?'<button type="button" class="secondary season-unequip" data-season-equip="">칭호·테두리 해제</button>':''}`;
    }
    function renderSeason() {
      if(!own()||view!=='arena'||arenaMode!=='season'||cancelReplay||!$('season-content'))return;
      const s=seasonData,accountReady=context.isCloud()&&!context.isBlocked?.();
      if(s){
        const me=s.me;setSeasonText('season-name',s.season.name||`시즌 ${s.season.number}`);setSeasonText('season-commander',me.name||'나의 용병단');setSeasonText('season-tier',me.registered?tierName(me.tier):'참가 전');setSeasonText('season-rating',me.registered?number(me.rating):'—');setSeasonText('season-remaining',`${number(me.remainingToday)} / ${number(s.rules?.dailyAttacks||5)}`);
        const artKey=JSON.stringify([me.avatar,me.hero,me.cosmetic]);
        if(artKey!==seasonPortraitKey){seasonPortraitKey=artKey;const first=me.defense?.team?.[0]||context.getState()?.team?.[0];$('season-profile-art').innerHTML=window.SchoolGuild.avatar(me,me.hero);$('season-profile-art').dataset.frame=frameName(me.cosmetic?.frame);$('season-cosmetic').innerHTML=cosmeticMarkup(me.cosmetic);}
        const defenseKey=JSON.stringify([s.season.id,me.registered,me.canRegister,me.requiresName,me.defense,context.getState()?.team]);
        if(!seasonPointer&&defenseKey!==seasonDefenseKey){
          const focused=$('season-register')===document.activeElement,details=$('season-defense-panel').querySelector('details');
          const expanded=!!details?.open;seasonDefenseKey=defenseKey;$('season-defense-panel').innerHTML=seasonDefenseMarkup();
          const nextDetails=$('season-defense-panel').querySelector('details');if(nextDetails&&expanded)nextDetails.open=true;
          if(focused)$('season-register')?.focus({preventScroll:true});
        }
        const key=JSON.stringify([seasonPanel,s.season.id,s.season.phase,s.me,s.rules,s.candidates,s.rankings,s.matches,s.awards]);
        if(!seasonPointer&&key!==seasonContentKey){
          const content=$('season-content'),focused=content.contains(document.activeElement)?document.activeElement:null;
          const focusKey=focused&&['seasonAttack','seasonMatch','seasonEquip'].find(key=>Object.hasOwn(focused.dataset,key)),focusValue=focusKey?focused.dataset[focusKey]:null,focusId=focused?.id;
          seasonContentKey=key;content.innerHTML=seasonPanelMarkup();
          if(focused){const target=Array.from(content.querySelectorAll('button')).find(button=>focusId?button.id===focusId:focusKey&&button.dataset[focusKey]===focusValue);target?.focus({preventScroll:true});}
        }
      }
      const disconnected=!context.isCloud();
      $('season-pending').hidden=!seasonPending&&!disconnected;
      setSeasonText('season-pending-message',disconnected?'계정을 다시 연결하면 이어서 대결할 수 있어요.':'이전 요청의 결과를 확인해 주세요.');
      $('season-pending-retry').hidden=!seasonPending||disconnected;
      $('season-connect').hidden=!disconnected;
      const blocked=busy||!!seasonPending||!accountReady,expired=s?.season.phase==='upcoming'||!s||s.season.endsAt<=seasonNow(),dayExpired=!!s&&s.dayResetsAt<=seasonNow();
      $('school-social').querySelectorAll('[data-season-panel]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.seasonPanel===seasonPanel));button.disabled=busy;});
      $('school-social').querySelectorAll('[data-arena-mode]').forEach(button=>{button.disabled=busy;});
      if($('season-register'))$('season-register').disabled=blocked||expired||!s.me.canRegister;
      $('school-social').querySelectorAll('[data-season-attack]').forEach(button=>{button.disabled=blocked||expired||dayExpired||!s.me.registered||s.me.remainingToday<1;});
      $('school-social').querySelectorAll('[data-season-equip]').forEach(button=>{button.disabled=blocked||button.dataset.equipped==='true';});
      $('school-social').querySelectorAll('[data-season-match]').forEach(button=>{button.disabled=busy||!accountReady;});
      $('season-pending-retry').disabled=busy||!accountReady;
      $('season-refresh').disabled=busy||seasonLoading||!context.isCloud();
      seasonCountdown();
    }
    function seasonCountdown() {
      if(!seasonData||!$('season-countdown'))return;
      const at=seasonNow(),second=Math.floor(at/1000);if(second===seasonCountdownSecond)return;seasonCountdownSecond=second;
      const duration=stamp=>{const seconds=Math.max(0,Math.ceil((stamp-at)/1000)),days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),rest=seconds%60;return `${days?days+'일 ':''}${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`;};
      setSeasonText('season-countdown',seasonData.season.phase==='upcoming'?`시작까지 ${duration(seasonData.season.startsAt)}`:seasonData.season.endsAt>at?`종료까지 ${duration(seasonData.season.endsAt)}`:'새 시즌 확인 중');
      setSeasonText('season-day-countdown',`도전 갱신 ${duration(seasonData.dayResetsAt)} · KST`);
      const rolloverKey=`${seasonData.season.id}:${seasonData.dayResetsAt}`;
      if((seasonData.season.endsAt<=at||seasonData.dayResetsAt<=at)&&!busy&&!seasonLoading&&context.isCloud()&&rolloverKey!==seasonRolloverKey){seasonRolloverKey=rolloverKey;fetchSeason(false);}
    }
    function scheduleSeasonPoll() {
      clearTimeout(poll);poll=setTimeout(()=>{if(!own()||view!=='arena'||arenaMode!=='season'||cancelReplay)return;if(document.hidden||busy||seasonLoading||!context.isCloud()){scheduleSeasonPoll();return;}fetchSeason(false);},10000);
    }
    async function fetchSeason(manual=false) {
      if(!own()||!context.isCloud()||busy||seasonLoading||arenaMode!=='season'||cancelReplay)return;
      const ticket=generation,epoch=++loadEpoch;seasonLoading=true;if(manual)setSeasonText('season-feedback','시즌 정보를 확인하고 있어요…');renderSeason();
      try{const response=await context.request('/api/school/social',{kind:'season_state'});if(ticket!==generation||epoch!==loadEpoch||!own())return;acceptSeason(response);if(manual)setSeasonText('season-feedback','');}
      catch(error){if(ticket===generation&&own())setSeasonText('season-feedback',error.message);}
      finally{if(ticket===generation){seasonLoading=false;renderSeason();scheduleSeasonPoll();}}
    }
    async function seasonMutate(kind,values,retry=false) {
      if(busy||!own()||!context.isCloud()||context.isBlocked?.())return;
      if(seasonPending&&!retry){setSeasonText('season-feedback','이전 요청의 결과를 먼저 확인해 주세요.');return;}
      const input=retry?seasonPending:{kind,...values,seasonId:seasonData?.season.id,requestId:crypto.randomUUID().replaceAll('-','')};if(!input)return;
      const ticket=generation,scope=context.getProfile()?.id;if(!scope)return;
      try{rememberSeasonPending(input,scope);}catch(error){setSeasonText('season-feedback',error.message);return;}
      ++loadEpoch;busy=true;renderSeason();setSeasonText('season-feedback',input.kind==='season_attack'?'대결 결과를 저장하고 있어요…':'시즌 정보를 저장하고 있어요…');
      try{
        const response=await context.request('/api/school/social',input);rememberSeasonPending(null,scope,input.requestId);
        if(ticket!==generation||!own()||context.getProfile()?.id!==scope)return;
        acceptSeason(response);setSeasonText('season-feedback','');
        if(response.match&&input.kind==='season_attack'){busy=false;showMatch({...response.match,mode:'season'});return;}
        if(response.matchUnavailable){setSeasonText('season-feedback','대결 결과는 저장됐어요. 상대 계정이 삭제되어 재생 기록은 볼 수 없습니다.');return;}
        setSeasonText('season-feedback',input.kind==='season_register'?'방어 편성을 등록했어요.':input.awardId?'시즌 칭호와 테두리를 착용했어요.':'시즌 장식을 해제했어요.');
      }catch(error){
        if(error.status&&error.status<500&&![408,425,426,429].includes(error.status))rememberSeasonPending(null,scope,input.requestId);
        if(ticket===generation&&own())setSeasonText('season-feedback',seasonPending?'응답을 확인하지 못했어요. 결과 확인을 누르면 같은 요청을 안전하게 확인합니다.':error.message);
      }finally{if(ticket===generation){busy=false;renderSeason();if(!cancelReplay){scheduleSeasonPoll();if(!seasonPending)fetchSeason(false);}}}
    }
    async function readSeasonMatch(id) {
      if(busy||!own()||!context.isCloud())return;const ticket=generation;busy=true;++loadEpoch;renderSeason();
      try{const response=await context.request('/api/school/social',{kind:'season_match',id});if(ticket===generation&&own()&&response.match){busy=false;showMatch({...response.match,mode:'season'});}}
      catch(error){if(ticket===generation&&own())setSeasonText('season-feedback',error.message);}
      finally{if(ticket===generation){busy=false;renderSeason();if(!cancelReplay)scheduleSeasonPoll();}}
    }
    const winterItemName = item => item.unlock ? `${window.SchoolRPG.BY_ID[item.hero]?.name || item.hero} · SSR` : item.hero ? `${window.SchoolRPG.BY_ID[item.hero]?.name || item.hero} 조각 ${number(item.shards)}` : `${item.gems?'보석':'코인'} ${number(item.gems || item.gold)}`;
    const wheelSlots=()=>window.SchoolRPG.WINTER_ROULETTE||[];
    function winterMarkup() {
      const info = winterInfo();
      if (!info) return '<div class="social-empty">겨울 이벤트를 준비하고 있어요.</div>';
      const spica=info.items.find(i=>i.id==='spica'),ordinary=info.items.filter(i=>i.id!=='spica');
      return `<header class="winter-banner"><div class="winter-snow" aria-hidden="true">✦ · ✧ · ✦</div><small>WINTER FESTIVAL</small><h3>${escape(info.name)}</h3><p>둘이 함께 구하는 겨울, 새로운 인연</p><span id="winter-event-deadline" class="winter-event-deadline"></span><div class="winter-reset"><span>매일 00:00 · 한국 시간</span><b id="winter-reset-countdown"></b></div></header>
      <div class="winter-tabs" role="tablist" aria-label="겨울 이벤트 메뉴"><button role="tab" data-winter-tab="festival" aria-selected="true">축제 · 교환</button><button role="tab" data-winter-tab="roulette" aria-selected="false">눈사람 룰렛</button></div>
      <div class="winter-wallets"><div class="winter-wallet"><span>${icon('winter')} 눈송이</span><b id="winter-balance">0</b></div><div class="winter-wallet"><span>${icon('snowman')} 눈사람</span><b id="winter-snowmen">0</b></div></div>
      <section data-winter-panel="festival"><button class="winter-yeti-entry" id="winter-yeti"><span aria-hidden="true">❄</span><span><b>만년설 예티 · 2인 협동 토벌</b><small>어려움 · 권장 Lv.70 이상 · HP 80만<br>눈송이 20~50개 + 눈사람 1개 · 무제한 도전</small></span><span class="winter-entry-arrow" aria-hidden="true">›</span></button>
      ${spica?`<article class="winter-spica-card" data-winter-row="spica"><button class="winter-spica-art" id="winter-spica-preview" aria-label="스피카 캐릭터 시안과 능력 보기"><img src="school/assets/spica/portrait.webp?v=spica1" alt="흰 털 장식과 긴 겨울 드레스를 입은 설녀 스피카" loading="lazy" decoding="async"><span>캐릭터 살펴보기 ↗</span></button><div class="winter-spica-copy"><span class="winter-exclusive">겨울 한정 · SSR</span><h3>스피카</h3><p>설원의 숨결</p><div class="spica-traits"><span>지원</span><span>아군 공속 ↑</span><span>적 공속 ↓</span></div><small data-winter-remaining></small><button class="primary" data-winter-item="spica" disabled>${icon('winter')}<span data-winter-price>5,000</span><span>교환</span></button><small>모집에서 나오지 않는 겨울의 동료</small></div></article>`:''}
      <div class="winter-shop">${ordinary.map(item => `<div class="winter-item" data-winter-row="${escape(item.id)}"><span class="winter-reward-icon ${escape(item.id)}">${item.hero?portrait(item.hero):icon(item.gems ? 'gem' : 'coin')}</span><div><b>${escape(winterItemName(item))}</b><small data-winter-remaining></small></div><button class="primary" data-winter-item="${escape(item.id)}" disabled>${icon('winter')}<span data-winter-price>${number(item.cost)}</span></button></div>`).join('')}</div><p class="social-note">코인·보석은 하루 10회, 호라스 조각은 하루 2회 교환해요. 미보유 조각은 보관하고 첫 모집 때 합쳐요. 스피카는 계정당 한 번 영입할 수 있어요.</p></section>
      <section data-winter-panel="roulette" hidden><div class="winter-roulette-layout"><div class="winter-wheel-shell"><i class="winter-wheel-pointer" aria-hidden="true"></i><div id="winter-wheel" class="winter-wheel" aria-hidden="true">${wheelSlots().map((slot,i)=>`<div class="winter-wheel-label" style="--slot:${i}"><span>${slot.type==='equipment'?'⚒':slot.type==='gold'?'◉':'◆'}</span><b>${i===0?'10,000':i===1?'1,000':i===2?'100':i===3?'장비':'코인'}</b></div>`).join('')}<span class="winter-wheel-hub">${icon('snowman')}</span></div></div><div class="winter-roulette-copy"><span class="winter-exclusive">SNOWMAN ROULETTE</span><h3>눈사람의 선물</h3><p>예티 토벌로 모은 눈사람이<br>작은 행운을 가져와요.</p><button id="winter-spin" class="primary" disabled>${icon('snowman')}<span>눈사람 1개 · 돌리기</span></button><div id="winter-spin-result" class="winter-spin-result" role="status" aria-live="polite">다섯 가지 선물 중 하나를 받아요.</div></div></div><details class="winter-wheel-odds"><summary>5칸의 보상과 정확한 확률</summary><ul>${wheelSlots().map(slot=>`<li><span>${escape(slot.label)}</span><b>${Number((slot.chance*100).toFixed(3))}%</b></li>`).join('')}</ul><p>칸의 크기와 당첨 확률은 달라요. 일반 장비는 R 70% · SR 25% · SSR 5%이며 전용 무기는 나오지 않아요. 코인은 2,600~7,800개예요.</p></details></section>`;
    }
    async function playWinterSpin(result){
      const reward=result.reward||{},g=window.SchoolRPG.GEAR_BY_ID?.[reward.item],text=reward.type==='equipment'?`${g?.name||'일반 장비'} · ${reward.rarity||g?.rarity||''} 획득`: `${reward.type==='gems'?'보석':'코인'} +${number(reward.amount)}`;
      if(!own()||view!=='winter'){context.toast?.(text);return;}
      const ticket=generation,wheel=$('winter-wheel'),resultNode=$('winter-spin-result');
      if(!wheel||!Number.isInteger(result.index)||result.index<0||result.index>=5){context.toast?.(text);return;}
      // The action has already committed. Animation never rolls or grants a reward.
      selectWinterTab('roulette');resultNode.textContent='선물이 도착하고 있어요…';resultNode.classList.remove('won');
      const target=(360-result.index*72)%360,from=spinRotation,to=from+360*5+(target-from%360+360)%360;
      const reduced=document.documentElement.dataset.motion==='reduced'||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const animation=wheel.animate([{transform:`rotate(${from}deg)`},{transform:`rotate(${to}deg)`}],{duration:reduced?120:3500,easing:'cubic-bezier(.12,.72,.12,1)',fill:'forwards'});spinAnimation=animation;
      window.SchoolPresentation?.play('pull');
      try{await animation.finished;}catch{}
      if(ticket!==generation||!own()||view!=='winter')return;
      spinRotation=to;wheel.style.transform=`rotate(${to}deg)`;animation.cancel();spinAnimation=null;
      resultNode.textContent=text;resultNode.classList.add('won');status('');window.SchoolPresentation?.play(result.index<2?'SSR':'reward');renderWinter();
    }
    function selectWinterTab(tab){
      const root=$('school-social');if(!root||view!=='winter')return;
      root.dataset.winterTab=tab;
      root.querySelectorAll('[data-winter-panel]').forEach(n=>n.hidden=n.dataset.winterPanel!==tab);
      root.querySelectorAll('[data-winter-tab]').forEach(n=>n.setAttribute('aria-selected',String(n.dataset.winterTab===tab)));
    }
    function renderWinter() {
      if (!own()) return;
      const root = $('school-social'), info = winterInfo();
      if (!info || !root.querySelector('.winter-shop')) return;
      if (!root.dataset.winterReady) {
        root.dataset.winterReady = 'true'; winterSignature = '';spinRotation=0;
        $('winter-yeti')?.addEventListener('click',()=>context.openYeti?.());
        $('winter-spica-preview')?.addEventListener('click',()=>context.openHero?.('spica'));
        root.querySelectorAll('[data-winter-tab]').forEach(n=>n.onclick=()=>{if(!busy)selectWinterTab(n.dataset.winterTab);});
        $('winter-spin')?.addEventListener('click',async()=>{
          if(winterBlocked()||!winterInfo()?.active||(winterInfo()?.snowmen||0)<1)return;
          const ticket=generation;busy=true;renderWinter();status('눈사람과 선물을 확인하고 있어요…');
          try{await context.dispatch({kind:'winter-spin'});}catch(error){if(ticket===generation)status(error.message,true);}
          finally{if(ticket===generation&&own()){busy=false;renderWinter();}}
        });
        root.querySelectorAll('[data-winter-item]').forEach(button => button.addEventListener('click', async () => {
          if (winterBlocked()) return;
          const item = winterInfo()?.items.find(item => item.id === button.dataset.winterItem);
          if (!item?.canBuy) { renderWinter(); return; }
          const ticket = generation, before = item.totalBought;
          busy = true; renderWinter(); let message = '', failed = false;
          try {
            await context.dispatch({kind:'winter-exchange',item:item.id});
            if (ticket !== generation || !own()) return;
            const after = winterInfo()?.items.find(entry => entry.id === item.id);
            if (after && after.totalBought > before) message = '교환한 보상을 받았어요!';
          } catch (error) { message = error.message; failed = true; }
          finally { if (ticket === generation && own()) { busy = false; renderWinter(); if (message) status(message, failed); } }
        }));
      }
      const blocked = winterBlocked(), signature = [info.day,info.active,info.snowflakes,info.snowmen,info.spicaOwned,blocked,context.getState().units.horas?.shards||context.getState().heroShards?.horas||0,...info.items.flatMap(item => [item.id,item.bought,item.remaining,item.cost,item.canBuy])].join('|');
      if (winterSignature !== signature) {
        winterSignature = signature; $('winter-balance').textContent = number(info.snowflakes);$('winter-snowmen').textContent=number(info.snowmen);
        $('winter-spin').disabled=blocked||!info.active||(info.snowmen||0)<1;
        for (const item of info.items) {
          const row = root.querySelector(`[data-winter-row="${item.id}"]`);if(!row)continue;const button = row.querySelector('[data-winter-item]');
          row.querySelector('[data-winter-remaining]').textContent = item.unlock?(info.spicaOwned?'영입 완료 · 육성에서 확인하세요':'겨울 한정 · 한 번 영입'):`오늘 ${number(item.remaining)} / ${number(item.limit)}회`+(item.hero?` · 조각 ${number(context.getState().units[item.hero]?.shards||context.getState().heroShards?.[item.hero]||0)}개 보유`:'');
          row.querySelector('[data-winter-price]').textContent = number(item.cost);
          button.disabled = blocked || !item.canBuy;
          button.setAttribute('aria-label', `${winterItemName(item)} 교환 · 눈송이 ${number(item.cost)}개 · ${item.lifetime?'계정당 한 번':`오늘 ${number(item.remaining)}회 남음`}`);
        }
      }
      const endsAt=window.SchoolRPG.WINTER_EVENT?.endsAt;
      const eventDeadline=endsAt==null?'이벤트 종료일 미정':`이벤트 종료 ${new Date(endsAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'})} · 한국 시간`;
      if($('winter-event-deadline').textContent!==eventDeadline)$('winter-event-deadline').textContent=eventDeadline;
      const left = Math.max(0, Math.ceil((info.resetsAt - now()) / 1000));
      const countdown = info.active ? `갱신까지 ${String(Math.floor(left/3600)).padStart(2,'0')}:${String(Math.floor(left%3600/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}` : '이벤트 종료';
      if ($('winter-reset-countdown').textContent !== countdown) $('winter-reset-countdown').textContent = countdown;
    }
    function open(next) {
      stop(); stopped = false; view = next; busy = false;
      if (next === 'winter') { frame(winterMarkup()); renderWinter(); return; }
      if (!context.isCloud()) { data = null; loginGate(); return; }
      if(next==='arena'&&arenaMode==='season'){setupSeason();fetchSeason(true);return;}
      frame(`<div class="social-empty">${icon(next)}<h3>용병단 소식을 불러오는 중…</h3><div class="social-loader" aria-label="불러오는 중"></div></div>`);
      fetchState(true);
    }

    function showMatch(match) {
      stop(); view = 'arena'; busy = false; arenaMode=match.mode==='season'?'season':'friendly';
      const me = Number(match.meSide) === 1 ? 1 : 0;
      const teams = match.teams || [];
      if (teams.length !== 2) { context.toast?.('대결 기록을 불러오지 못했어요.'); open('arena'); return; }
      frame(`<div class="arena-match-heading"><div><small>${me === 0 ? '나의 용병단' : '상대 용병단'}</small><b>${escape(teams[0].name)}</b></div><span>VS</span><div><small>${me === 1 ? '나의 용병단' : '상대 용병단'}</small><b>${escape(teams[1].name)}</b></div></div><div class="arena-stage"><canvas id="arena-canvas" aria-label="서버에서 확정된 두 용병단의 아레나 전투 재생"></canvas><div id="arena-replay-result" hidden></div></div><div class="arena-playback"><span id="arena-clock">0:00</span><progress id="arena-progress" max="${Math.max(1, Number(match.durationMs) || 1)}" value="0" aria-label="대결 재생 진행률"></progress><button class="secondary" id="arena-skip">결과 보기</button><button class="secondary" id="arena-damage-report" aria-label="대결 기여도 보기" title="딜량 · 치유량">${icon('damage')}</button></div><div id="arena-damage-content" hidden></div><div class="arena-return"><button class="secondary" id="arena-back">아레나로 돌아가기</button><small>${match.mode==='season'?'시즌전 · 등록된 방어 편성과 진행한 대결':'양쪽 편성으로 서버에서 진행한 대결입니다.'}</small></div>${teams.map(team=>window.SchoolEquipment?.snapshotMarkup(team,`${team.name} · 대결 당시 장비`)||'').join('')}`);
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
      if (view === 'winter') renderWinter();
      if(view==='arena'&&arenaMode==='season'&&!cancelReplay)renderSeason();
    }
    return {openFriends:() => open('friends'),openArena:() => open('arena'),openWinter:() => open('winter'),playWinterSpin,cancelPresentation(){spinAnimation?.cancel();spinAnimation=null;},refresh,destroy() {stop();stopped = true;data = null;}};
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
    let events = [...(match.events || [])].sort((a,b) => a.t - b.t), effects = [], spicaUntil = 0;
    const duration = Math.max(1, Number(match.durationMs) || Number(events.at(-1)?.t) || 1000);
    const units = match.teams.map((team,side) => team.units.map((unit,index) => ({...unit,hp:unit.max || unit.hp,shield:0,side,index,actAt:-10000,hitAt:-10000,actKind:'attack',skill:'',horasStacks:0,horasBasicAt:-10000,horasBasicPose:1,horasCastAt:-10000,horasImpactAt:-10000,horasCast:null})));
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
      if(event.kind==='spica-wind'&&from?.id==='spica'){
        spicaUntil=Math.max(spicaUntil,event.hasteUntil||event.t+6000);
        for(const u of units[event.side])u.hasteUntil=Math.max(u.hasteUntil||0,event.hasteUntil||event.t+6000);
        for(const u of units[1-event.side])u.slowUntil=Math.max(u.slowUntil||0,event.slowUntil||event.t+5000);
      }
      if(event.kind==='osia-breath'&&from){from.breathAt=event.t;from.breathTarget=event.target;}
      if(event.kind==='osia-breath-cancel'&&from)delete from.breathAt;
      if (from && !event.breath && ['attack','skill','heal','shield','spica-wind'].includes(event.kind)) {from.actAt = event.t;from.actKind=event.kind==='spica-wind'?'skill':event.kind;from.skill=event.skill || '';from.actStage=event.stage || 1;}
      if(from?.id==='hyeokjin'){
        from.hyeokjin||={used:false,mode:'idle',until:0,lastUntil:0};const q=from.hyeokjin;
        if(event.kind==='hyeokjin-mode'){Object.assign(q,{mode:event.mode,began:event.t,modeUntil:event.t+event.duration,impactAt:event.t+(event.impactDelay||0),until:event.until||q.until});if(event.mode==='transform'||event.awakened)q.used=true;}
        if(event.kind==='hyeokjin-last')q.lastUntil=event.until;
        if(event.kind==='hyeokjin-cancel'){q.mode='idle';q.modeUntil=event.t;}
      }
      if(from?.id==='kazua'){
        from.kazua||={mode:'fire',modeSince:0,power:1};
        if(event.kind==='dodge')from.dodgeAt=event.t;
        if(event.kind==='kazua-mode'){from.kazua.mode=event.mode;from.kazua.modeSince=event.t;}
        if(event.kind==='kazua-survivor'||event.kind==='kazua-shot')from.kazua.power=event.power||1;
      }
      if(from?.id==='ryusion'){if(event.kind==='ryusion-skill'){from.earthCastAt=event.t;from.earthStage=event.stage;}if(event.kind==='ryusion-taunt')from.earthTauntUntil=event.until;}
      if(from?.id==='osia'&&event.kind==='osia-drowning')from.osiaSpearAt=event.t;
      if (from?.id==='horas') {
        if(event.kind==='horas-basic'){from.horasBasicAt=event.t;from.horasBasicPose=event.pose;}
        if(event.kind==='horas-stack'||event.kind==='horas-refund')from.horasStacks=event.stacks;
        if(event.kind==='horas-cast'){from.horasStacks=0;from.horasCastAt=event.t;from.horasCast={id:event.castId,began:event.t,simBegan:event.t,targetId:event.targetId,impactDelay:event.impactDelay,mergeMs:event.mergeMs};}
        if(event.kind==='horas-impact'){
          from.horasCast=null;from.horasImpactAt=event.t;
          const landed=!event.missed&&events.some(hit=>hit.kind==='skill'&&hit.side===event.side&&hit.from==='horas'&&hit.castId===event.castId&&hit.primary&&hit.amount>0);
          event={...event,landed};
          if(!finished&&clock-event.t>=0&&clock-event.t<200&&(event.missed||landed))window.SchoolPresentation?.play(event.missed?'blossom-miss':'blossom');
        }
        if(event.kind==='horas-cast'&&!finished&&clock-event.t>=0&&clock-event.t<200)window.SchoolPresentation?.play('blossom-charge');
      }
      if (target) {
        if(event.kind==='stun')target.stunUntil=Math.max(target.stunUntil||0,event.t+(event.duration||0));
        if (Number.isFinite(event.hp)) target.hp = Math.max(0,event.hp);
        else if (['attack','skill'].includes(event.kind)) target.hp = Math.max(0,target.hp-(event.amount || 0));
        else if (event.kind==='heal') target.hp = Math.min(target.max,target.hp+(event.amount || 0));
        else if (event.kind==='down') target.hp = 0;
        if (Number.isFinite(event.shield)) target.shield=Math.max(0,event.shield);
        if (['attack','skill'].includes(event.kind)) target.hitAt=event.t;
        if(event.kind==='horas-mark'){
          for(const unit of units[event.toSide])delete unit.horasMark;
          target.horasMark={until:event.until,castId:event.castId};
        }
        if(event.kind==='down'||event.kind==='horas-refund')delete target.horasMark;
      }
      if (!reduced || event.kind==='osia-breath' || event.kind.startsWith('horas-') || event.kind==='miss' || window.SchoolOsiaWeaponArt?.equipped(from)&&(event.kind==='osia-drowning'||event.kind==='skill'&&event.stage===4)) effects.push(event);
      if (effects.length>80) effects.splice(0,effects.length-80);
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
      if(!finished){const hyeok=units.flat().filter(u=>u.id==='hyeokjin');window.SchoolHyeokjinArt?.field(c,hyeok,clock,960,420,reduced);const shake=window.SchoolHyeokjinArt?.shake(hyeok[0],clock,reduced);if(shake)c.translate(shake.x,shake.y);}
      const breathCaster=units.flat().find(u=>Number.isFinite(u.breathAt)&&clock-u.breathAt>=0&&clock-u.breathAt<4750&&u.hp>0&&!(u.stunUntil>clock));
      if(!finished&&breathCaster)window.SchoolOsiaBreathArt?.field(c,(clock-breathCaster.breathAt)/1000,960,420,reduced);
      let impact=null;
      for(let i=effects.length-1;i>=0;i--){const event=effects[i];if(event.kind==='horas-impact'&&event.landed&&clock-event.t>=0&&clock-event.t<180){impact=event;break;}}
      if(impact&&!reduced){const age=(clock-impact.t)/1000,decay=1-age/.18;c.translate(Math.sin(age*100)*4*decay,Math.cos(age*83)*2*decay);}
      if(!finished)for(const u of units.flat())if(Number.isFinite(u.breathAt)&&clock-u.breathAt>=0&&clock-u.breathAt<4750&&u.hp>0&&!(u.stunUntil>clock))window.SchoolOsiaWeaponArt?.dragon(c,{source:positions.get(`${u.side}:${u.id}`),target:positions.get(`${1-u.side}:${u.breathTarget}`),age:(clock-u.breathAt)/1000,reduced,economy:cssWidth<640,scale:1.55,breath:true,layer:'back'});
      const gunners=[];
      units.flat().sort((a,b)=>positions.get(`${a.side}:${a.id}`).y-positions.get(`${b.side}:${b.id}`).y).forEach(unit=>{
        const position=positions.get(`${unit.side}:${unit.id}`),actAge=(clock-unit.actAt)/1000,hitAge=clock-unit.hitAt;
        const horasAge=(clock-unit.horasBasicAt)/1000,horasCastAge=unit.horasCast?(clock-unit.horasCastAt)/1000:1.5+(clock-unit.horasImpactAt)/1000;
        const casting=unit.id==='horas'?(!!unit.horasCast||horasCastAge>=1.5&&horasCastAge<2.45)&&unit.hp>0:['skill','heal','shield'].includes(unit.actKind)&&actAge>=0&&actAge*1000<(window.SchoolCombatFeedback?.castMs(unit.id)||({lava:1800,osia:1650,spica:1600})[unit.id]||1300)&&unit.hp>0;
        const attacking=(unit.id==='horas'?horasAge>=0&&horasAge<1.18:actAge>=0&&actAge*1000<(window.SchoolCombatFeedback?.basicMs(unit.id)||({lava:1000,spica:850})[unit.id]||650))&&unit.hp>0, direction=unit.side?-1:1;
        const move=attacking&&!reduced?Math.sin(Math.min(1,actAge/(unit.id==='spica'?.85:.48))*Math.PI)*15*direction:0;
        const earthAge=(clock-(unit.earthCastAt??-10000))/1000;
        const breathAge=unit.id==='osia'&&Number.isFinite(unit.breathAt)&&clock-unit.breathAt<4750?(clock-unit.breathAt)/1000:undefined;
        const motion=breathAge>=0&&window.SchoolOsiaBreathArt?window.SchoolOsiaBreathArt.motion(breathAge,reduced):unit.id==='ryusion'&&earthAge>=0&&earthAge<1.4?window.SchoolArt?.poseForSkill?.('ryusion',unit.earthStage,earthAge,reduced):casting&&['osia','lava','spica'].includes(unit.id)?window.SchoolArt?.poseForSkill?.(unit.id,unit.actStage,actAge,reduced):null;
        window.SchoolArt?.hero(c,unit.id,position.x+(unit.id==='ryusion'&&motion?motion.dx*direction:['horas','kazua','hyeokjin'].includes(unit.id)?0:move),position.y+(unit.id==='ryusion'&&motion?motion.dy:0),2.3,{skin:unit.skin,exclusive:unit.exclusive,osiaBreathAge:breathAge,osiaSpearAge:Number.isFinite(unit.osiaSpearAt)?(clock-unit.osiaSpearAt)/1000:-1,kazuaActive:!finished,...window.SchoolArt.kazuaFrame(unit,clock),...window.SchoolArt.hyeokjinFrame?.(unit,clock),...(unit.dodgeAt&&clock-unit.dodgeAt<350?{kazuaMode:'dodge',kazuaAge:(clock-unit.dodgeAt)/1000}:{}),time:clock/1000,dead:unit.hp<=0,stunned:unit.stunUntil>clock,flip:!!unit.side,attack:attacking&&!casting,attackAge:attacking&&!casting?(unit.id==='horas'?horasAge:actAge):undefined,casting,motion,taunting:unit.id==='ryusion'&&unit.earthTauntUntil>clock,hit:hitAge>=0&&hitAge<100,pose:motion?.pose??(unit.id==='spica'?undefined:attacking?2:0),horasBasicPose:unit.horasBasicPose,horasStacks:unit.horasStacks,horasCastAge:casting&&unit.id==='horas'?horasCastAge:-1,horasCastDuration:1.5,reduced});
        if(!finished&&unit.id==='kazua'&&unit.hp>0&&!(unit.stunUntil>clock)&&!(unit.dodgeAt&&clock-unit.dodgeAt<350))gunners.push({source:position,targets:units[1-unit.side].filter(u=>u.hp>0).map(u=>positions.get(`${u.side}:${u.id}`)),mode:unit.kazua?.mode||'idle',age:(clock-(unit.kazua?.modeSince||0))/1000,time:clock/1000,scale:2.3,reduced,economy:cssWidth<640,flip:!!unit.side});
        if(unit.id==='spica'&&casting&&!(unit.stunUntil>clock))window.SchoolArt?.spicaSkillEffect?.(c,position,units[unit.side].filter(u=>u.hp>0).map(u=>positions.get(`${u.side}:${u.id}`)),units[1-unit.side].filter(u=>u.hp>0).map(u=>positions.get(`${u.side}:${u.id}`)),actAge,reduced,1.2);
        c.fillStyle='#14222ce6';c.fillRect(position.x-38,position.y+8,76,8);c.fillStyle=unit.side===me?'#a4c478':'#dc8d7f';c.fillRect(position.x-37,position.y+9,74*Math.max(0,unit.hp)/Math.max(1,unit.max),6);
        if(unit.shield>0){c.fillStyle='#9dd4e2';c.fillRect(position.x-37,position.y+16,74*Math.min(1,unit.shield/Math.max(1,unit.max)),3);}
        c.font='9px Galmuri,monospace';c.textAlign='center';c.fillStyle=unit.hp>0?'#edf0e5':'#93a0a6';c.fillText(unit.name || window.SchoolRPG.BY_ID[unit.id]?.name || unit.id,position.x,position.y+30);
      });
      if(!finished)for(const unit of units.flat().filter(u=>u.id==='hyeokjin'))window.SchoolHyeokjinArt?.effects(c,{unit,time:clock,source:positions.get(`${unit.side}:${unit.id}`),targets:units[1-unit.side].map(u=>({...positions.get(`${u.side}:${u.id}`),id:u.id})),scale:2.3,reduced,economy:cssWidth<640,viewport:{width:960,height:420}});
      for(const gunner of gunners)window.SchoolKazuaArt?.effects(c,gunner);
      if(!finished)window.SchoolArt?.spicaBlizzard?.(c,{x:0,y:95,width:960,height:325},clock,spicaUntil,reduced,cssWidth<640);
      effects=effects.filter(event=>clock-event.t<(event.kind==='osia-breath'?4750:event.kind.startsWith('horas-')?2600:event.from==='osia'&&(event.kind==='osia-drowning'||event.kind==='skill'&&event.stage===4)?2200:800));
      if(!finished){
        const drawnDragons=new Set();
        for(const event of effects){
          if(event.from!=='osia'||!(event.kind==='osia-drowning'||event.kind==='osia-breath'||event.kind==='skill'&&event.stage===4&&!event.breath))continue;
          const caster=byKey.get(`${event.side}:osia`);if(!window.SchoolOsiaWeaponArt?.equipped(caster)||caster.hp<=0||caster.stunUntil>clock||event.kind==='osia-breath'&&caster.breathAt!==event.t)continue;
          const source=positions.get(`${event.side}:osia`),target=positions.get(`${event.toSide}:${event.target||event.targetId}`);
          if(!source||!target)continue;
          const opt={source,target,age:(clock-event.t)/1000,reduced,economy:cssWidth<640,scale:1.55,breath:event.kind==='osia-breath',layer:event.kind==='osia-breath'?'front':undefined};
          if(event.kind==='osia-drowning')window.SchoolOsiaWeaponArt.drowning(c,opt);
          else{
            // Area hits share one cast. Draw one dragon rather than one per victim.
            const key=`${event.side}:${event.castId??event.t}`;if(drawnDragons.has(key))continue;
            drawnDragons.add(key);window.SchoolOsiaWeaponArt.dragon(c,opt);
          }
        }
      }
      for(let side=0;side<2;side++){
        const caster=byKey.get(`${side}:horas`);if(!caster)continue;
        const p={}, mirror=point=>({x:side?960-point.x:point.x,y:point.y});
        p.horas=mirror(positions.get(`${side}:horas`));
        for(const target of units[1-side])p[`enemy:${target.id}`]=mirror(positions.get(`${1-side}:${target.id}`));
        const cast=caster.horasCast?{...caster.horasCast,targetId:`enemy:${caster.horasCast.targetId}`}:null;
        const recent=effects.filter(event=>event.side===side&&event.from==='horas').map(event=>({...event,time:event.t/1000,from:'horas',to:event.toSide===side?'horas':`enemy:${event.target}`,targetId:event.targetId?`enemy:${event.targetId}`:undefined,targets:event.targets?.map(id=>`enemy:${id}`)}));
        const battle={elapsed:clock,skipHorasCutin:true,horasEffectScale:1.55,horasActorScale:2.3,horas:{stacks:caster.horasStacks},horasCast:caster.hp>0?cast:null,heroes:[{...caster,id:'horas'}],enemies:units[1-side].map(unit=>({...unit,id:`enemy:${unit.id}`}))};
        c.save();if(side){c.translate(960,0);c.scale(-1,1);}
        window.SchoolArt?.horasVisualEffects?.(c,battle,recent,p,clock/1000,reduced,false,0,!!window.SchoolBattlePolish);c.restore();
      }
      for(const event of effects){
        if(event.kind.startsWith('horas-'))continue;
        const age=(clock-event.t)/800;if(age<0||age>=1)continue;
        const p=positions.get(`${event.toSide}:${event.target}`),from=positions.get(`${event.side}:${event.from}`);if(!p)continue;
        if(event.kind==='ryusion-taunt'||event.kind==='shield'&&event.from==='ryusion')window.SchoolRyusion?.barrier(c,p.x,p.y,1.35,1-age);
        const healing=event.kind==='heal', shield=event.kind==='shield';
        c.save();c.globalAlpha=Math.min(1,(1-age)*2);
        if(from&&!['horas','kazua'].includes(event.from)&&['attack','skill'].includes(event.kind)&&age<.28){c.strokeStyle=event.crit?'#ffe69d':event.kind==='skill'?'#b7e8ff':'#f7f1dc';c.lineWidth=event.crit?5:3;c.beginPath();c.moveTo(from.x,from.y-47);c.lineTo(p.x,p.y-48);c.stroke();}
        if(event.amount){c.textAlign='center';c.font=`${event.crit?20:15}px Galmuri,monospace`;c.fillStyle=healing?'#b8efb5':shield?'#acdbf0':event.crit?'#ffcf71':'#fff1df';c.strokeStyle='#233244';c.lineWidth=3;const label=(healing?'+':shield?'+':'')+number(event.amount),y=p.y-79-age*24;c.strokeText(label,p.x,y);c.fillText(label,p.x,y);if(event.crit){c.fillStyle='#ffe49a';c.fillRect(p.x-6,y-29,12,5);c.fillRect(p.x-2,y-33,4,13);c.fillRect(p.x-12,y-26,4,4);c.fillRect(p.x+8,y-26,4,4);}}
        c.restore();
      }
      const cutin=units.flat().find(unit=>unit.id==='horas'&&unit.hp>0&&unit.horasCast&&clock-unit.horasCastAt>=580&&clock-unit.horasCastAt<1160);
      if(cutin&&!window.SchoolBattlePolish){c.save();c.scale(2,1.5);window.SchoolArt?.horasCutin?.(c,(clock-cutin.horasCastAt)/1000,reduced);c.restore();}
      if(!finished){window.SchoolBattlePolish?.speedField(c,units[me],units[1-me],clock,960,8);window.SchoolBattlePolish?.focus(c,effects,clock,960,420,reduced,shot=>units[shot.side??me]?.find(u=>u.id===shot.id)?.skin);}
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
