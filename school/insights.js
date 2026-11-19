/* Live combat reports, saved results and bond stories. Mutations use the account's action queue. */
window.SchoolInsights=(()=>{
  'use strict';
  const G=window.SchoolRPG,Art=window.SchoolArt;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Math.round(n||0).toLocaleString('ko-KR'),clock=ms=>`${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms%60000/1000)).padStart(2,'0')}`;
  const bondImage=(id,kind='illustration')=>`school/assets/bonds/${id}-${kind}.webp?v=bond-art1`;
  const STORIES=[
    [['기록','모두가 떠난 교실. 창틀에 맺힌 물방울이 바람도 없이 한 방향으로 흘렀다.'],['단장','바다가 그리워?'],['오시아','그립다고 말하면, 돌아갈 곳이 아직 남아 있는 것 같잖아.'],['기록','오시아가 손을 펴자 작은 물방울 속에 낡은 계단과 부서진 문양이 떠올랐다.'],['오시아','내가 다스리던 곳에서는 물이 기억을 품었어. 기쁜 날도, 돌이킬 수 없는 날도.'],['단장','그 기억을 여기까지 가져온 거야?'],['오시아','아니. 잊지 않으려고 내가 따라온 거야. 이 학교 아래에서도 같은 파도 소리가 들려.'],['기록','그날부터 방과 후 교실에는, 바다에서 온 동료의 자리가 하나 남았다.']],
    [['기록','늦은 밤, 오시아는 물방울 속에 잠겨 있던 왕좌를 다시 비췄다.'],['오시아','왕좌는 가장 높은 곳에 있었어. 그곳에 앉으면 모두를 지킬 수 있을 줄 알았지.'],['기록','왕좌 뒤의 문이 갈라지고, 어둠이 물살을 거슬러 흘렀다.'],['오시아','균열을 막으려면 문 안쪽에 권능을 남겨야 했어. 왕관도, 내가 돌아갈 길도.'],['단장','사람들은?'],['오시아','마지막 배가 문을 지나가는 건 봤어. 그 뒤는… 나도 몰라.'],['기록','그녀는 손을 움켜쥐었다. 수면 아래의 왕좌가 잔물결 속으로 사라졌다.'],['오시아','왕관은 바다에 두고 왔어. 하지만 약속까지 버린 건 아니야.']],
    [['기록','학교의 결계에 파문이 일던 날, 오시아는 홀로 복도 끝을 지키고 있었다.'],['단장','혼자서 전부 감당할 생각이야?'],['오시아','용왕이라면 그래야 한다고 배웠으니까.'],['단장','여기서는 우리 용병단의 동료잖아. 네가 지키려는 사람 안에 너도 있어.'],['기록','잠시 뒤, 오시아의 발밑에서 일던 거친 물결이 잦아들었다.'],['오시아','그날 마지막 배에서 누군가 나한테 소리쳤어. 꼭 돌아오라고.'],['오시아','나는 남겠다는 말만 했지. 살아 돌아가겠다는 약속은 하지 않았어.'],['기록','그녀가 방패를 든 동료 옆으로 한 걸음 물러섰다.'],['오시아','이번에는 함께 돌아갈게. 그 약속부터 지킬 거야.']],
    [['기록','새벽의 학교. 창문에 비친 수룡의 그림자가 천천히 눈을 떴다.'],['오시아','이곳의 균열과 바다의 문은 이어져 있어. 여기서 시작하면 그 배를 찾을 수 있을지도 몰라.'],['단장','그게 학교에 남은 이유였구나.'],['오시아','처음에는. 하지만 지금은 그것만이 아니야.'],['기록','책상 위에는 동료들이 남긴 쪽지와 아직 마르지 않은 수건이 놓여 있었다.'],['오시아','돌아갈 곳을 찾는 동안, 지키고 싶은 곳이 또 생겼어.'],['단장','그럼 오늘도 함께 가자.'],['오시아','응. 왕으로 명령하는 게 아니라, 동료로 부탁할게. 내일도 내 옆에 있어 줘.'],['기록','첫 종이 울렸다. 오시아는 물방울을 창밖으로 보내고, 동료들이 기다리는 복도로 걸어갔다.']]
  ];
  function findings(r){
    const out=[],enemies=r.enemies||[],physical=Math.max(0,...enemies.map(e=>e.physicalReduction||0)),magic=Math.max(0,...enemies.map(e=>e.magicReduction||0));
    if(physical)out.push(['물리 피해 감소',`${Math.round(physical*100)}% 감소 특성 · 마법 공격 편성을 확인해 보세요.`]);
    if(magic)out.push(['마법 피해 감소',`${Math.round(magic*100)}% 감소 특성 · 물리 공격 편성을 확인해 보세요.`]);
    const fallen=(r.fallen||r.timeline||[]).find(e=>e.kind==='fallen'&&G.BY_ID[e.from]?.role==='치유');
    if(fallen)out.push(['회복 담당 전투불능',`${clock(fallen.ms)} · ${fallen.name}. 후열 보호와 수호 용병 배치를 확인해 보세요.`]);
    if(r.reason==='timeout')out.push(['제한 시간 종료','시간 안에 적을 처치하지 못했어요. 공격 기여도와 적의 감소 특성을 함께 확인하세요.']);
    else if(r.phase==='defeat'&&!fallen)out.push(['용병 전원 전투불능','받은 피해가 높은 동료의 보호막·회복·배치를 확인해 보세요.']);
    if(!out.length)out.push(['전투 기록 확인',r.phase==='fight'?'현재 웨이브의 피해·회복·보호막 기록을 자동으로 갱신하고 있어요.':'용병별 기여도와 주요 기술 시점을 비교해 다음 편성을 준비하세요.']);
    return out.slice(0,3);
  }
  function create(ctx){
    const $=id=>document.getElementById(id);let report=null,metric='damage',episode=0,line=0,readingScope='',pending=false,bondKey='',hero='osia';
    const state=()=>ctx.getState(),isBond=()=>ctx.modalKind()==='bond',open=()=>ctx.modalKind()==='damage';
    // Keep DOM nodes, scroll and the selected metric while the battle advances.
    let reportSource='current',reportScope='',reportKey='',rowsKey='';
    const write=(id,value)=>{const node=$(id),text=String(value);if(node&&node.textContent!==text)node.textContent=text;};
    const markup=(id,html)=>{const node=$(id);if(node&&node.innerHTML!==html)node.innerHTML=html;};
    function reportRows(){
      if(!open()||!report)return;
      const total=report.totals[metric]||0,rows=[...report.rows].sort((a,b)=>(b[metric]||0)-(a[metric]||0));
      const key=report.rows.map(r=>r.id).join('|');
      if(rowsKey!==key){
        rowsKey=key;
        $('insight-rows').innerHTML=report.rows.map(r=>{const h=G.BY_ID[r.id];return `<article id="insight-row-${r.id}" class="insight-row" data-rarity="${h.rarity}"><img src="${Art.portrait(r.id)}" alt=""><div><div class="insight-row-label"><b>${esc(h.name)}</b><span><b id="insight-value-${r.id}"></b><small id="insight-share-${r.id}"></small></span></div><div class="insight-bar"><i id="insight-bar-${r.id}"></i></div><small id="insight-detail-${r.id}"></small></div></article>`;}).join('');
      }
      rows.forEach((r,index)=>{
        const value=r[metric]||0,share=total?value/total*100:0;
        const row=$('insight-row-'+r.id),bar=$('insight-bar-'+r.id);
        if(row.style.order!==String(index))row.style.order=String(index);
        const width=`${Math.max(0,Math.min(100,share))}%`;if(bar.style.width!==width)bar.style.width=width;
        write('insight-value-'+r.id,fmt(value));write('insight-share-'+r.id,share.toFixed(1)+'%');
        write('insight-detail-'+r.id,`${G.BY_ID[r.id].role} · ${metric==='damage'?`${fmt(r.dps)} DPS`:metric==='healing'?'실제 회복 · 초과 치유 제외':metric==='absorbed'?'이 용병이 부여한 보호막의 실제 흡수량':'보호막 흡수 후 실제 HP 피해'}`);
      });
      $('insight-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.metric===metric)));
    }
    function refreshReport(force=false){
      if(!open())return;
      if(reportScope!==ctx.scope())return ctx.closeModal();
      if(reportSource==='current')report=G.damageReport(state());
      if(!report)return;
      const r=report,key=JSON.stringify([reportSource,r,!!state().lastCombatReport]);
      if(!force&&key===reportKey)return;reportKey=key;
      const place=r.activity?`${G.DUNGEONS[r.activity.kind].name} · ${r.activity.floor?`${r.activity.floor}층`:`${r.activity.tier}단계`}`:`${G.stageName(r.stage)} · ${G.CHAPTERS[G.chapter(r.stage)]} · WAVE ${r.wave}/4`;
      write('insight-place',place);
      write('insight-outcome',r.phase==='victory'?'도전 성공':r.phase==='defeat'?'도전 종료':'전투 진행 중');
      $('insight-outcome').classList.toggle('lost',r.phase==='defeat');
      write('insight-status',reportSource==='current'?'● 실시간 · 현재 웨이브 자동 갱신':'저장된 전투 결과');
      $('insight-status').dataset.live=String(reportSource==='current');
      for(const k of ['damage','healing','absorbed'])write('insight-total-'+k,fmt(r.totals[k]));
      write('insight-time',clock(r.elapsedMs));
      $('insight-last').disabled=!state().lastCombatReport;
      $('insight-last').setAttribute('aria-pressed',String(reportSource==='last'));
      $('insight-current').setAttribute('aria-pressed',String(reportSource==='current'));
      markup('insight-findings',findings(r).map(([title,text])=>`<article><b>${esc(title)}</b><p>${esc(text)}</p></article>`).join(''));
      markup('insight-events',(r.timeline||[]).slice(-32).map(e=>`<li><time>${clock(e.ms)}</time><span>${esc(G.BY_ID[e.from]?.name||'적')} · ${esc(e.kind==='fallen'?'전투불능':e.name)}</span></li>`).join('')||'<li>기술을 사용하면 이곳에 기록돼요.</li>');
      write('insight-retry',r.activity?'던전 선택으로':'다시 도전');reportRows();
    }
    function showReport(source='current'){
      const same=open()&&reportScope===ctx.scope()&&!!$('insight-rows');
      reportSource=source==='last'&&state().lastCombatReport?'last':'current';
      report=reportSource==='last'?G.clone(state().lastCombatReport):G.damageReport(state());
      reportScope=ctx.scope();reportKey='';
      if(!same){
        metric='damage';rowsKey='';
        ctx.openModal('전투 기록',`<div class="insight-report"><header class="insight-heading"><div><small id="insight-place"></small><h3 id="insight-outcome"></h3><small id="insight-status" role="status"></small></div><div class="insight-switch"><button id="insight-last" data-report="last">최근 결과</button><button id="insight-current" data-report="current">현재 전투</button></div></header><div class="insight-totals">${[['총 피해','damage'],['실제 회복','healing'],['보호막 흡수','absorbed'],['전투 시간','time']].map(([a,b])=>`<div><small>${a}</small><strong id="${b==='time'?'insight-time':'insight-total-'+b}"></strong></div>`).join('')}</div><div class="insight-columns"><section><nav id="insight-tabs" aria-label="전투 기여도 종류">${[['damage','피해량'],['healing','회복량'],['absorbed','보호막'],['taken','받은 피해']].map(([k,v])=>`<button data-metric="${k}" aria-pressed="${k===metric}">${v}</button>`).join('')}</nav><div id="insight-rows"></div></section><aside class="insight-findings"><h4>다음 도전을 위한 기록</h4><div id="insight-findings"></div><small>기록에 나타난 사실을 바탕으로 한 제안입니다.</small></aside></div><details class="insight-timeline" id="insight-timeline"><summary>주요 전투 기록 · 최근 32건</summary><ol id="insight-events"></ol></details><footer class="insight-actions"><button class="secondary" id="insight-formation">편성 바꾸기</button><button class="primary" id="insight-retry">다시 도전</button></footer><p class="insight-note">현재 전투는 웨이브가 바뀌면 새 기록으로 전환돼요. 피해량은 실제로 깎인 HP, 회복량은 초과 치유를 제외한 수치예요. 최근 결과는 저장된 보스전 또는 패배 기록입니다.</p></div>`,'damage');
        $('insight-tabs').onclick=e=>{const b=e.target.closest('[data-metric]');if(b){metric=b.dataset.metric;reportRows();}};
        document.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>showReport(b.dataset.report));
        $('insight-formation').onclick=ctx.openFormation;$('insight-retry').onclick=()=>ctx.retry(report);
      }
      refreshReport(true);
    }
    function bond(id='osia'){
      if(pending)return;hero=Object.hasOwn(G.BOND_CHARACTERS,id)?id:'osia';episode=0;line=0;bondKey='';readingScope=ctx.scope();
      const meta=G.BOND_CHARACTERS[hero],h=G.BY_ID[hero];
      ctx.openModal('인연 기록',`<nav class="bond-selector" aria-label="인연 캐릭터">${Object.keys(G.BOND_CHARACTERS).map(id=>`<button data-bond-hero="${id}" aria-pressed="${id===hero}"><img src="${bondImage(id,'profile')}" alt="" width="44" height="44"><span>${G.BY_ID[id].name}<small>${state().units[id]?'Lv.'+state().units[id].level:'미보유'}</small></span></button>`).join('')}</nav><div class="bond-layout"><section class="bond-art"><img src="${bondImage(hero)}" width="1024" height="1536" alt="${h.name} · ${meta.name} 인연 일러스트"><div class="bond-name"><small>${h.rarity} · ${h.club}</small><h3>${h.name}</h3><p>${meta.name}</p></div></section><section class="bond-content" id="bond-content"></section></div>`,'bond');
      document.querySelectorAll('[data-bond-hero]').forEach(b=>b.onclick=()=>bond(b.dataset.bondHero));refreshBond(true);
    }
    function refreshBond(force=false){
      if(!isBond())return;if(readingScope!==ctx.scope())return ctx.closeModal();if(episode)return;
      const info=G.bondInfo(state(),ctx.now(),hero),key=JSON.stringify([info,ctx.blocked(),pending]);if(!force&&key===bondKey)return;bondKey=key;
      $('bond-content').innerHTML=`<header><small>과거와 세계관을 따라가는 이야기</small><h3>${info.meta.name}</h3></header><div class="bond-level"><b>인연 Lv.${info.level}</b><span>${info.needed?`${info.progress} / ${info.needed}`:'최대 인연'}</span></div><progress value="${info.needed?info.progress:1}" max="${info.needed||1}" aria-label="${G.BY_ID[hero].name} 인연 경험치"></progress><p class="bond-help">${info.owned?'이 용병 Lv.10부터 편성한 보상 적용 전투 승리 시 인연 +1. 개인 임무 포함 캐릭터별 하루 최대 60. 너무 낮은 지역·반복 탑·방치 수령은 제외됩니다.':'이 용병을 영입하면 이야기를 시작할 수 있어요.'}</p><div class="bond-episodes">${info.episodes.map(e=>`<button data-episode="${e.id}" ${!e.unlocked?'disabled':''}><span class="bond-number">0${e.id}</span><span><b>${e.title}</b><small>${e.read?'다시 읽기':e.unlocked?'새 이야기':`용병 Lv.${e.unitLevel} · 인연 Lv.${e.level} · 이전 이야기 완료`}</small></span><span>${e.read?'✓':e.unlocked?'›':'⌑'}</span></button>`).join('')}</div><details class="bond-missions" ${info.owned?'open':''}><summary>오늘의 개인 임무 <small>획득 ${info.dailyEarned}/${info.dailyLimit} · 한국 시간 자정 갱신</small></summary>${info.missions.map(m=>`<div><span><b>${m.name}</b><small>${m.desc} · ${m.value}/${m.goal}</small></span><button data-bond-mission="${m.id}" ${!m.ready||ctx.blocked()||pending?'disabled':''}>${m.claimed?'수령 완료':`인연 +${m.xp}`}</button></div>`).join('')}</details><div class="bond-rewards"><button id="bond-profile" ${!info.avatar?'disabled':''}><img class="bond-reward-preview" src="${bondImage(hero,'profile')}" width="64" height="64" alt="${info.meta.avatarName}"><b>프로필</b><small>${info.avatar?'사용하기':'2화 완료'}</small></button><button id="bond-title" ${!info.title?'disabled':''}>✧<b>칭호</b><small>${info.title?'사용하기':'3화 완료'}</small></button><div>♧<b>로비 대사</b><small>${info.dialogue?'해금 완료':'4화 완료'}</small></div></div>${info.dialogue?`<blockquote class="bond-unlocked-quote">“${info.meta.quote}”<small>출전 편성의 첫 번째 인연 대사 해금 동료가 로비에서 말해요.</small></blockquote>`:''}<p class="bond-help">꾸미기 보상 · 능력치 변화 없음 · 오늘 임무와 진행도는 계정에 저장됩니다.</p>`;
      $('bond-content').querySelectorAll('[data-episode]').forEach(b=>b.onclick=()=>{episode=Number(b.dataset.episode);line=0;story();});
      $('bond-content').querySelectorAll('[data-bond-mission]').forEach(b=>b.onclick=async()=>{if(pending||ctx.blocked())return;pending=true;refreshBond(true);try{await ctx.dispatch({kind:'bond-mission',hero,mission:b.dataset.bondMission});}finally{pending=false;refreshBond(true);}});
      $('bond-profile').onclick=()=>!ctx.blocked()&&ctx.dispatch({kind:'profile',avatar:G.BOND_CHARACTERS[hero].avatar});$('bond-title').onclick=()=>!ctx.blocked()&&ctx.dispatch({kind:'profile',title:G.BOND_CHARACTERS[hero].title});
    }
    function story(){
      if(!isBond()||readingScope!==ctx.scope())return;const lines=(hero==='osia'?STORIES:window.SchoolBondStories[hero])[episode-1],[who,text]=lines[line],last=line===lines.length-1;
      $('bond-content').innerHTML=`<button class="bond-back" id="bond-back">‹ 이야기 목록</button><span class="bond-chapter">기록 0${episode} · ${G.BOND_CHARACTERS[hero].titles[episode-1]}</span><div class="bond-dialogue"><small>${who}</small><p>${text}</p></div><div class="bond-reader-controls"><button id="bond-prev" ${line===0||pending?'disabled':''}>이전</button><small>${line+1} / ${lines.length}</small><button class="primary" id="bond-next" ${pending?'disabled':''}>${pending?'저장 중…':last?'읽기 완료':'다음 ›'}</button></div><p class="bond-help">마지막 장에서 읽기 완료를 누르면 기록과 보상이 저장돼요.</p>`;
      $('bond-back').onclick=()=>{episode=0;refreshBond(true);};$('bond-prev').onclick=()=>{line--;story();};
      $('bond-next').onclick=async()=>{if(pending)return;if(!last){line++;story();return;}if(ctx.blocked())return ctx.toast('연결과 저장 상태를 확인해 주세요.');const id=episode,scope=readingScope;pending=true;story();try{await ctx.dispatch({kind:'bond-read',hero,episode:id});if(isBond()&&ctx.scope()===scope&&G.bondInfo(state(),ctx.now(),hero).episodes[id-1].read){episode=0;}}finally{pending=false;if(isBond()&&ctx.scope()===scope){if(episode)story();else refreshBond(true);}}};
    }
    function back(){if(isBond()&&episode){episode=0;refreshBond(true);return true;}return false;}
    return {report:showReport,bond,refresh(force=false){refreshBond(force);refreshReport(force);},back};
  }
  return {create,findings,STORIES};
})();
