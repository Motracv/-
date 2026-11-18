/* Small modal controllers. Recommendations run only in a disposable worker;
   every mutation still goes through the existing confirmed action pipeline. */
window.SchoolQoL = (() => {
  'use strict';
  const G=window.SchoolRPG,Art=window.SchoolArt,esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=value=>Math.round(Number(value)||0).toLocaleString('ko-KR');
  const text=(el,value)=>{if(el&&el.textContent!==String(value))el.textContent=String(value);};
  const disabled=(el,value)=>{if(el&&el.disabled!==!!value)el.disabled=!!value;};
  function countdown(expiresAt,now,permanent=false){
    if(expiresAt===null||expiresAt===undefined)return {text:permanent?'상시':'종료일 미정',ended:false,seconds:null};
    const left=Math.max(0,Math.ceil((expiresAt-now)/1000));
    if(!left)return {text:'종료됨',ended:true,seconds:0};
    const days=Math.floor(left/86400),h=Math.floor(left%86400/3600),m=Math.floor(left%3600/60),s=left%60;
    return {text:`${days?`${days}일 `:''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} 남음`,ended:false,seconds:left};
  }
  function create(ctx){
    let current='',presetKey='',worker=null,serial=0,preview=null,lastClock=-1;
    const cache=new Map(),$=id=>document.getElementById(id),state=()=>ctx.getState(),scope=()=>ctx.accountScope(),blocked=()=>ctx.isBlocked();
    const active=kind=>current===kind&&ctx.modalKind()===kind&&$('modal')?.open;
    const portrait=id=>G.BY_ID[id]?`<img src="${Art.portrait(id)}" alt="${esc(G.BY_ID[id].name)}" title="${esc(G.BY_ID[id].name)}">`:'';
    const teamHTML=team=>`<div class="qol-team" aria-label="출전 용병">${Array.from({length:G.MAX_TEAM||6},(_,i)=>team[i]?portrait(team[i]):'<span aria-label="빈자리">＋</span>').join('')}</div>`;
    function stopWorker(){if(worker){worker.onmessage=worker.onerror=null;worker.terminate();worker=null;}serial++;}
    function close(){stopWorker();preview=null;current='';presetKey='';}
    function open(title,html,kind){ctx.openModal(title,html,kind);current=kind;$('modal').classList.add('qol-modal');}
    function presets(){
      open('저장한 편성',`<div class="qol-heading"><div><p>현재 출전 용병</p><div id="preset-current-team"></div></div><button type="button" class="secondary" id="presets-edit-team">용병 교체</button></div><p class="qol-note" id="preset-status" role="status"></p><div id="preset-list" class="preset-list"></div>`,'presets');
      $('presets-edit-team').onclick=()=>{ctx.closeModal();ctx.openRoster();};refreshPresets(true);
      $('preset-list').onclick=async event=>{
        const button=event.target.closest('button');if(!button||button.disabled||!active('presets')||blocked())return;
        const kind=['save','apply','delete','rename'].find(name=>button.dataset[`preset${name[0].toUpperCase()+name.slice(1)}`]!==undefined);if(!kind)return;
        const slot=Number(button.dataset[`preset${kind[0].toUpperCase()+kind.slice(1)}`]);
        if(kind==='apply'&&ctx.activityActive())return ctx.toast('던전 도전을 마친 뒤 편성을 바꿔 주세요.');
        const action={kind:`preset-${kind}`,slot};if(kind==='rename')action.name=$('preset-list').querySelector(`[data-preset-name="${slot}"]`).value;
        await ctx.dispatch(action);refreshPresets();
      };
    }
    function refreshPresets(force=false){
      if(!active('presets'))return;
      const s=state(),info=G.presetInfo?.(s)||[];
      const key=JSON.stringify([scope(),s.team,info]);
      if(force||key!==presetKey){
        const focus=document.activeElement?.dataset.presetName,typed=focus!==undefined?document.activeElement.value:null;
        presetKey=key;$('preset-current-team').innerHTML=teamHTML(s.team);
        $('preset-list').innerHTML=info.map(p=>`<section class="preset-card" data-preset-slot="${p.slot}"><div class="preset-top"><span class="qol-number">0${p.slot+1}</span><strong>${esc(p.name)}</strong><span class="preset-state">${p.active?'사용 중':p.saved?'저장됨':'빈 편성'}</span></div>${teamHTML(p.team)}<div class="preset-name-row"><input data-preset-name="${p.slot}" aria-label="편성 ${p.slot+1} 이름" maxlength="12" value="${esc(p.name)}" autocomplete="off"><button class="secondary" type="button" data-preset-rename="${p.slot}">이름 저장</button></div><div class="preset-actions"><button type="button" class="secondary" data-preset-save="${p.slot}">${p.saved?'현재 편성 덮어쓰기':'현재 편성 저장'}</button><button type="button" class="primary" data-preset-apply="${p.slot}">불러오기</button><button type="button" class="text-button" data-preset-delete="${p.slot}">삭제</button></div></section>`).join('');
        if(focus!==undefined){const input=$('preset-list').querySelector(`[data-preset-name="${focus}"]`);if(input){input.value=typed;input.focus({preventScroll:true});}}
      }
      text($('preset-status'),ctx.activityActive()?'던전 도전 중에는 불러오기를 할 수 없어요. 현재 편성 저장과 이름 변경은 가능해요.':'불러오면 현재 전투를 다시 시작해요. 전열·후열 순서도 함께 저장됩니다.');
      for(const p of info){const invalid=p.team.some(id=>!s.units[id]||!G.BY_ID[id]);for(const kind of ['save','apply','delete','rename'])disabled($('preset-list').querySelector(`[data-preset-${kind}="${p.slot}"]`),blocked()||(kind==='apply'&&(!p.saved||p.active||invalid||ctx.activityActive()))||(kind==='delete'&&!p.saved));}
    }
    function invalidatePreview(){
      stopWorker();preview=null;if(!active('farm-recommend'))return;
      $('farm-recommendations').replaceChildren();text($('farm-preview-status'),'편성이나 진행 기록이 바뀌었어요. 다시 계산해 주세요.');$('farm-preview-progress').hidden=true;disabled($('farm-preview-retry'),blocked());
    }
    function fingerprint(){return G.farmingFingerprint?.(state())||'';}
    function farm(){
      open('파밍 추천',`<div class="qol-heading"><div><p>현재 편성으로 미리 전투해요</p>${teamHTML(state().team)}</div><button type="button" class="secondary" id="farm-preview-retry">다시 계산</button></div><p class="qol-note" id="farm-preview-status" role="status">전투를 계산할 준비를 하고 있어요.</p><progress id="farm-preview-progress" max="6" value="0" aria-label="파밍 지역 계산 진행"></progress><div id="farm-recommendations" class="farm-recommendations"></div><p class="qol-note">계산 결과는 재화나 편성에 적용되지 않아요. 아래 버튼을 눌러야 지역을 이동합니다.</p><details class="qol-details"><summary>어떻게 계산하나요?</summary><p>현재 편성·레벨·각성과 전투 속도로 최근 정상 보상 지역을 비교해요. 각 지역을 180초씩 3번 계산하며, 골드/분은 전투 보상만 포함합니다. 임무·첫 돌파·방치·눈송이 보상은 제외해요. 안정도와 획득량은 추정치이므로 실제 결과와 다를 수 있어요.</p></details>`,'farm-recommend');
      $('farm-preview-retry').onclick=startPreview;
      $('farm-recommendations').onclick=async event=>{
        const button=event.target.closest('[data-farm-start]');if(!button||button.disabled||!preview||blocked())return;
        if(preview.scope!==scope()||preview.fingerprint!==fingerprint())return invalidatePreview();
        if(ctx.activityActive()||state().battle.activity)return ctx.toast('던전 결과를 확인한 뒤 모험으로 돌아와 주세요.');
        const stage=Number(button.dataset.farmStart);if(!G.farmingCandidates(state()).includes(stage))return invalidatePreview();
        await ctx.dispatch({kind:'stage',stage,mode:'farm'});
      };startPreview();
    }
    function displayRecommendations(data){
      if(!active('farm-recommend'))return;
      $('farm-preview-progress').hidden=true;disabled($('farm-preview-retry'),blocked());
      const rows=data.recommendations||[];
      text($('farm-preview-status'),rows.length?`안정적으로 사냥할 지역 ${rows.length}곳 · 현재 ${(state().speed||1).toFixed(1)}× 기준`:'안정적으로 돌파할 지역을 찾지 못했어요. 용병을 육성하거나 편성을 바꿔 다시 계산해 보세요.');
      $('farm-recommendations').innerHTML=rows.map((r,i)=>`<section class="farm-recommendation"><div class="farm-rank">${i===0?'추천':'대안'} ${i+1}</div><h3>${esc(G.stageName(r.stage))} · ${esc(G.CHAPTERS[G.chapter(r.stage)])}</h3><div class="farm-estimate"><strong>${fmt(r.goldPerMinute)}<small>골드 / 분</small></strong><span>안정 ${r.successfulSeeds}/${r.totalSeeds}회<small>평균 돌파 ${r.meanClearSeconds?`${Math.round(r.meanClearSeconds)}초`:'—'}</small></span></div><p>용병별 경험치 약 ${fmt(r.xpPerMinute)} / 분</p><button type="button" class="primary" data-farm-start="${r.stage}">이동 · 반복 사냥</button></section>`).join('');
      refreshFarm();
    }
    function startPreview(){
      if(!active('farm-recommend'))return;stopWorker();
      if(blocked()){text($('farm-preview-status'),'저장을 확인한 뒤 다시 계산해 주세요.');return;}
      const s=state(),key=fingerprint(),owner=scope(),id=serial;
      preview={fingerprint:key,scope:owner,id};$('farm-recommendations').replaceChildren();
      const cached=cache.get(`${owner}:${key}`);if(cached){displayRecommendations(cached);return;}
      if(!G.farmingFingerprint||!window.Worker){text($('farm-preview-status'),'이 브라우저에서는 파밍 계산을 지원하지 않아요. 모험 지도에서 지역을 직접 선택해 주세요.');$('farm-preview-progress').hidden=true;return;}
      text($('farm-preview-status'),'현재 편성으로 전투를 계산하고 있어요…');$('farm-preview-progress').hidden=false;$('farm-preview-progress').value=0;disabled($('farm-preview-retry'),true);
      try{
        worker=new Worker('school/farming-worker.js?v=school-winter-duo1');
        worker.onmessage=event=>{
          const msg=event.data;if(!active('farm-recommend')||!preview||msg.id!==id||preview.id!==id)return;
          if(owner!==scope()||key!==fingerprint()||(msg.kind!=='error'&&msg.fingerprint!==key))return invalidatePreview();
          if(msg.kind==='progress'){text($('farm-preview-status'),`지역 비교 중 · ${msg.completed} / ${msg.total}`);$('farm-preview-progress').max=msg.total;$('farm-preview-progress').value=msg.completed;}
          else if(msg.kind==='result'){worker?.terminate();worker=null;cache.set(`${owner}:${key}`,msg.data);while(cache.size>5)cache.delete(cache.keys().next().value);displayRecommendations(msg.data);}
          else if(msg.kind==='error'){stopWorker();text($('farm-preview-status'),msg.message||'계산을 완료하지 못했어요. 다시 시도해 주세요.');$('farm-preview-progress').hidden=true;disabled($('farm-preview-retry'),false);}
        };
        worker.onerror=()=>{stopWorker();if(active('farm-recommend')){text($('farm-preview-status'),'파밍 계산을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.');$('farm-preview-progress').hidden=true;disabled($('farm-preview-retry'),false);}};
        worker.postMessage({kind:'recommend',id,state:{...G.clone(s),receipts:[]}});
      }catch{stopWorker();text($('farm-preview-status'),'파밍 계산을 시작하지 못했어요. 다시 시도해 주세요.');$('farm-preview-progress').hidden=true;disabled($('farm-preview-retry'),false);}
    }
    function refreshFarm(){
      if(!active('farm-recommend'))return;
      if(preview&&(preview.scope!==scope()||preview.fingerprint!==fingerprint()))return invalidatePreview();
      disabled($('farm-preview-retry'),!!worker||blocked());
      document.querySelectorAll('[data-farm-start]').forEach(button=>disabled(button,blocked()||ctx.activityActive()||!!state().battle.activity));
    }
    function eventRows(){return `<div class="qol-event-list" aria-label="모집과 이벤트 기간">${['horas','osia','lava'].map(id=>`<div><span>${esc(G.BANNERS[id].name)}</span><b data-qol-countdown="${id}"></b></div>`).join('')}<div><span>호라스 전용 무기</span><b data-qol-countdown="weapon-horas"></b></div><div><span>겨울 이벤트</span><b data-qol-countdown="winter"></b></div></div>`;}
    function refreshCountdowns(){
      if(document.hidden)return;const now=ctx.serverNow();
      for(const label of document.querySelectorAll('[data-qol-countdown]')){if(!label.getClientRects().length)continue;const id=label.dataset.qolCountdown,banner=id.startsWith('weapon-')?G.WEAPON_BANNERS[id.slice(7)]:G.BANNERS[id],expiry=banner?banner.expiresAt:G.WINTER_EVENT?.endsAt??null;const remaining=countdown(expiry,now,!!banner&&!banner.limited);text(label,remaining.text);if(label.dataset.ended!==String(remaining.ended))label.dataset.ended=String(remaining.ended);}
      const version=window.SchoolPatchNotes?.version;let read=false;try{read=localStorage.getItem('school-patch-read')===version;}catch{}
      for(const badge of document.querySelectorAll('[data-patch-unread]'))if(badge.hidden!==read)badge.hidden=read;
    }
    function patchNotes(){
      const notes=window.SchoolPatchNotes||{version:'',entries:[]};
      open('업데이트 소식',`<p class="qol-note">새로운 기능과 수정 내용을 모았어요.</p><div id="patch-notes-list">${notes.entries.map((entry,i)=>`<article class="patch-note"><header><span>${i===0?'최신 업데이트':esc(entry.date)}</span><small>${esc(entry.version)}</small></header><h3>${esc(entry.title)}</h3><ul>${entry.items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></article>`).join('')}</div><details class="qol-details"><summary>모집·이벤트 일정</summary>${eventRows()}<p class="qol-note">기간이 정해진 일정만 카운트다운합니다. 라바 모집은 한국 시간 11월 20일 23:59까지예요.</p></details><button type="button" class="secondary" id="patch-game-help">게임 안내</button>`,'patch-notes');
      try{localStorage.setItem('school-patch-read',notes.version);}catch{}refreshCountdowns();
      $('modal-content').querySelector('details')?.addEventListener('toggle',refreshCountdowns);$('patch-game-help').onclick=ctx.openHelp;
    }
    function refresh(){refreshPresets();refreshFarm();const clock=Math.floor(ctx.serverNow()/1000);if(clock!==lastClock){lastClock=clock;refreshCountdowns();}}
    const timer=setInterval(()=>{if(!document.hidden)refreshCountdowns();},1000);
    document.addEventListener('visibilitychange',refreshCountdowns);
    return {presets,farm,patchNotes,refresh,close,eventRows,refreshCountdowns,destroy(){close();clearInterval(timer);document.removeEventListener('visibilitychange',refreshCountdowns);cache.clear();}};
  }
  return {create,countdown};
})();
