/* Read-only navigation over the existing campaign; starting still uses SchoolRPG.action. */
window.SchoolWorldMap = (() => {
  'use strict';
  const G = window.SchoolRPG;
  const COLORS = ['#d7b16c','#d7b16c','#a0a4df','#87be9a','#cfaa78','#9faee2','#9acdde','#a89dc2','#94c1c3','#bb9b89','#94b89e','#b4d3c6','#d9a2df','#88c9e7','#d6b178'];
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
  function markerIcon(index) {
    const c=COLORS[index],stroke='#172d35';
    let shape='';
    const building=`<path fill="${stroke}" d="M9 23h46v34H9z"/><path fill="#a9b7af" d="M12 26h40v28H12z"/><path fill="#d8dbba" d="M16 30h7v7h-7zm13 0h7v7h-7zm13 0h6v7h-6z"/><path fill="#365b61" d="M27 42h10v12H27z"/>`;
    if(index===0)shape=building+'<path fill="#677d81" d="M7 23 32 7l25 16v4H7z"/><path fill="#d6c68b" d="M28 13h8v8h-8z"/>';
    else if(index===1)shape='<path fill="#a8b4a8" d="M5 24h54v28H5z"/><path fill="#57787a" d="M3 20h58v7H3z"/><path fill="#273e45" d="M12 31h9v21h-9zm15 0h10v21H27zm16 0h9v21h-9z"/><path fill="#d3c18c" d="M5 51h54v6H5z"/>';
    else if(index===2)shape=building+'<path fill="#696b8d" d="M8 19 32 7l24 12v8H8z"/><path fill="#e3d9b5" d="M22 15h9v12h-9zm11 0h9v12h-9z"/><path fill="#4a455f" d="M31 14h2v14h-2z"/>';
    else if(index===3)shape='<path fill="#8a7858" d="M10 48h45v10H10z"/><path fill="#426a58" d="M11 20h38v24H11zM18 9h26v12H18zM4 28h53v12H4z"/><path fill="#7eac77" d="M16 13h25v8H16zM8 25h42v8H8z"/><path fill="#a9855f" d="M26 38h10v15H26z"/><path fill="#e2bda4" d="M9 43h6v6H9zm38-2h6v6h-6z"/>';
    else if(index===4)shape='<path fill="#a2aaa6" d="M8 25h48v31H8z"/><path fill="#a48264" d="M5 19 16 9h33l10 10v10H5z"/><path fill="#5d7176" d="M14 34h36v18H14z"/><path fill="none" stroke="#e8d8a7" stroke-width="3" d="M32 35v16m-15-8h30"/><path fill="#d7c99f" d="M10 29h10v7H10zm34 0h10v7H44z"/>';
    else if(index===5)shape='<path fill="#7e8998" d="M9 35h46v19H9z"/><path fill="#aeb8c2" d="M6 31h52v7H6z"/><path fill="#485970" d="M15 18h20v13H15z"/><path fill="#deb97a" d="m44 5 3 8 8 2-8 3-3 8-3-8-8-3 8-2z"/><path fill="#d1dbde" d="M9 44h46v4H9z"/>';
    else if(index===6)shape='<path fill="#9cb9c0" d="M5 23h54v32H5z"/><path fill="#dfebe4" d="M5 20h54v8H5zM9 33h46v3H9zm0 14h46v3H9z"/><path fill="none" stroke="#5f8ea0" stroke-width="3" d="M32 26v28M10 39h44"/><path fill="#cee9e9" d="M20 4h7v5h-7zm7 5h7v5h-7zm7-5h7v5h-7zm0 10h7v5h-7zm-14 0h7v5h-7z"/>';
    else if(index===7)shape='<path fill="#8a8b9b" d="M15 20h37v35H15z"/><path fill="#666779" d="M9 22 28 5l29 17v6H9z"/><path fill="#4b465b" d="M24 32h10v23H24zm15-2h7v9h-7z"/><path fill="#aeb6a2" d="M9 40h11v17H9zm39 5h9v12h-9z"/><path fill="#d7c395" d="M25 15h8v8h-8z"/>';
    else if(index===8)shape='<path fill="#76929b" d="M6 34h52v21H6z"/><path fill="#d1ded4" d="M24 6h16v6h-3v16l15 20v6H12v-6l15-20V12h-3z"/><path fill="#71c4bc" d="m23 34-9 14v3h36v-3l-9-14z"/><path fill="#e6f4db" d="M24 38h5v5h-5zm12 7h4v4h-4z"/>';
    else if(index===9)shape='<path fill="#9b9d94" d="M6 27 21 12h22l15 15v30H6z"/><path fill="#273d48" d="M17 31 26 23h12l9 8v26H17z"/><path fill="#aa997e" d="M5 53h54v5H5zm13-9h28v4H18zm5-9h18v4H23z"/><path fill="#e5bd7b" d="M9 33h4v11H9zm42 0h4v11h-4z"/>';
    else if(index===10)shape='<path fill="#9bafa0" d="M9 22h10v36H9zm36 0h10v36H45z"/><path fill="#c6cfb4" d="M6 17h16v8H6zm36 0h16v8H42z"/><path fill="#7d9b87" d="M20 26h24v5H20z"/><path fill="#9fae91" d="M25 29h4v25h-4zm10 0h4v25h-4z"/><path fill="#68936f" d="M3 38h7v16H3zm53-5h6v21h-6z"/>';
    else shape='<path fill="#adc7b9" d="M13 31h7v23h-7zm31 0h7v23h-7z"/><path fill="#80a69a" d="M6 25 32 10l26 15v7H6z"/><path fill="#dce3c2" d="M8 25h48v6H8zM9 53h46v5H9z"/><path fill="#b6e5d4" d="m32 31 8 9-8 9-8-9z"/><path fill="#8bbfb3" d="M25 3h17v3H25zm13 4h14v3H38z"/>';
    return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path fill="#10282c" opacity=".5" d="M5 54h54v7H5z"/>${shape}<path fill="${c}" opacity=".18" d="M7 59h50v3H7z"/></svg>`;
  }
  const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  function render(container, options) {
    if (!container || !options?.state) throw Error('모험 지도를 표시할 기록이 필요합니다.');
    let state=options.state, blocked=options.blocked||false, destroyed=false, sending=false, signature='', lastError='', scrollFrame=0;
    let selectedStage=clamp(Number(state.stage)||1,1,G.MAX_STAGE), selectedChapter=Math.floor((selectedStage-1)/5);
    const chapterCount=G.CHAPTERS.length;
    container.innerHTML=`<section class="school-world-map" aria-label="학교 모험 지도"><div class="wm-toolbar"><p>학교 너머, 새로운 모험</p><div><button type="button" class="wm-jump" data-map-current>현재 지역</button><button type="button" class="wm-jump" data-map-next>다음 도전 <span aria-hidden="true">↗</span></button></div></div><div class="wm-layout"><div class="wm-map-wrap"><div class="wm-campus" aria-label="학교의 ${G.CHAPTERS.length}개 구역 · 좌우로 넘겨서 선택">${G.CHAPTERS.map((name,i)=>`<button type="button" class="wm-chapter" data-map-chapter="${i}" style="--map-accent:${COLORS[i]||COLORS[0]}" aria-label="${i+1}구역 ${esc(name)}" title="${esc(name)}"><span class="wm-region-fallback" aria-hidden="true">${markerIcon(i)}</span>${i>=12?`<span class="wm-region-image wm-expansion-atlas" style="background-position:center ${(i-12)*50}%" aria-hidden="true"></span>`:`<img class="wm-region-image" src="school/assets/adventure/region-${String(i+1).padStart(2,'0')}.webp?v=adventure1" alt="" loading="${Math.abs(i-selectedChapter)<3?'eager':'lazy'}" decoding="async" draggable="false">`}<span class="wm-region-shade" aria-hidden="true"></span><span class="wm-chapter-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span class="wm-current-tag" aria-hidden="true">현재</span><span class="wm-chapter-boss" title="보스 · ${esc(G.BOSSES?.[i]||'지역의 수호자')}"><span class="wm-boss-fallback" aria-hidden="true">${markerIcon(i)}</span><canvas class="wm-boss-art" width="160" height="144" aria-hidden="true"></canvas><span class="wm-boss-label" aria-hidden="true">BOSS</span></span><span class="wm-chapter-caption"><span class="wm-chapter-name">${esc(name)}</span><span class="wm-chapter-stars" aria-hidden="true">${'<i></i>'.repeat(5)}</span><span class="wm-chapter-progress"></span><span class="wm-chapter-state">${LOCK}<span>미개방</span></span></span></button>`).join('')}</div><div class="wm-map-legend"><span>← <span class="wm-swipe-copy">지역을 좌우로 넘겨보세요</span> →</span><span class="wm-total"></span></div></div><aside class="wm-detail" aria-label="선택한 지역"><div class="wm-selection-summary"><div class="wm-detail-heading"><small class="wm-region-number"></small><h3 class="wm-region-title"></h3></div><div class="wm-stage-info"><b class="wm-stage-title"></b><span class="wm-stage-state"></span></div><span class="wm-reward"></span></div><div class="wm-route-box"><div class="wm-route" role="group" aria-label="구역의 다섯 지역"></div><p class="wm-stage-note"></p><p class="wm-chapter-tip"></p></div><div class="wm-action-box"><div class="wm-map-actions"><button id="map-start" type="button" class="wm-start" data-map-start>도전 시작</button><button id="map-farm" type="button" class="wm-farm" data-map-farm>반복 사냥</button></div><p class="wm-mode-note">도전: 다음 지역으로 · 반복: 이 지역에서</p></div><p class="wm-block-reason" role="status" hidden></p></aside></div></section>`;
    const q=selector=>container.querySelector(selector),track=q('.wm-campus');
    if(options.onRecommend){const button=document.createElement('button');button.type='button';button.className='wm-jump wm-recommend';button.dataset.mapRecommend='';button.textContent='파밍 추천';button.title='현재 편성의 안정적인 골드 획득 지역 계산';q('.wm-toolbar>div').prepend(button);}
    const labels=Array.from(container.querySelectorAll('[data-map-chapter]'));
    // Static portraits are drawn once. The map never adds an animation or battle loop.
    if(window.SchoolArt?.monster)labels.forEach((button,i)=>{
      try {
        const canvas=button.querySelector('canvas'),c=canvas.getContext('2d');
        if(!c)return;c.imageSmoothingEnabled=false;
        window.SchoolArt.monster(c,{kind:i,boss:true,hp:1},80,130,{reduced:true,stage:i*5+5,wave:4});
        button.classList.add('wm-boss-ready');
      }catch{/* The school emblem remains visible if a browser cannot draw a portrait. */}
    });
    function imageError(event){if(event.target.matches?.('.wm-region-image'))event.target.closest('.wm-chapter').classList.add('wm-image-missing');}
    container.addEventListener('error',imageError,true);
    function centerSelection(){
      cancelAnimationFrame(scrollFrame);
      scrollFrame=requestAnimationFrame(()=>{if(destroyed)return;const card=labels[selectedChapter];track.scrollLeft=card.offsetLeft-(track.clientWidth-card.offsetWidth)/2;});
    }
    function reason() {
      if (state.activities?.run && !state.activities.run.settled || state.battle?.activity) return '던전 결과를 확인하고 모험으로 돌아와 주세요.';
      if (typeof blocked==='string') return blocked;
      if (blocked || sending) return '저장 확인 중이에요. 잠시만 기다려 주세요.';
      return '';
    }
    function unlock() { return Math.min(G.MAX_STAGE, Math.max(0,Number(state.best)||0)+1); }
    function paint(force=false) {
      if (destroyed) return;
      const why=reason(), key=[state.best,state.stage,state.mode,selectedChapter,selectedStage,why,sending,lastError].join('|');
      if(!force&&signature===key)return;signature=key;
      const best=clamp(Number(state.best)||0,0,G.MAX_STAGE),opened=unlock(),first=selectedChapter*5+1,last=Math.min(first+4,G.MAX_STAGE), locked=selectedStage>opened;
      labels.forEach((button,i)=>{
        const start=i*5+1,end=Math.min(start+4,G.MAX_STAGE),canOpen=start<=opened,cleared=best>=end,current=Math.floor(((Number(state.stage)||1)-1)/5)===i,count=clamp(best-start+1,0,end-start+1);
        button.classList.toggle('selected',i===selectedChapter);button.classList.toggle('locked',!canOpen);button.classList.toggle('cleared',cleared);button.classList.toggle('current',current);
        button.setAttribute('aria-pressed',String(i===selectedChapter));
        button.setAttribute('aria-label',`${i+1}구역 ${G.CHAPTERS[i]} · 클리어 ${count}/5 · ${cleared?'돌파':canOpen?'도전 가능':'미개방'}${current?' · 현재 지역':''}`);
        button.querySelector('.wm-chapter-progress').textContent=`클리어 ${count} / 5`;
        button.querySelectorAll('.wm-chapter-stars i').forEach((star,n)=>star.classList.toggle('earned',n<count));
      });
      q('.wm-total').textContent=`전체 ${best} / ${G.MAX_STAGE}`;
      q('.wm-region-number').textContent=`CHAPTER ${String(selectedChapter+1).padStart(2,'0')}`;
      q('.wm-region-title').textContent=G.CHAPTERS[selectedChapter];
      const route=q('.wm-route'),routeKey=[selectedChapter,best,state.stage,selectedStage].join('|');
      if(route.dataset.key!==routeKey){
        const focus=route.contains(document.activeElement)?document.activeElement.dataset.mapStage:null;
        route.innerHTML=Array.from({length:last-first+1},(_,i)=>{const n=first+i,isLocked=n>opened,isSelected=n===selectedStage,isCleared=n<=best;return `<button type="button" data-map-stage="${n}" class="wm-stage${isLocked?' locked':''}${isCleared?' cleared':''}${isSelected?' selected':''}${n===state.stage?' current':''}" aria-pressed="${isSelected}" aria-disabled="${isLocked}" ${isLocked?'disabled':''} aria-label="${G.stageName(n)} ${isLocked?'미개방':isCleared?'돌파':'도전 가능'}"><span>${G.stageName(n)}</span><small aria-hidden="true">${isLocked?'◆':isCleared?'✓':n===state.stage?'●':'·'}</small></button>`;}).join('');
        route.dataset.key=routeKey;if(focus)route.querySelector(`[data-map-stage="${focus}"]`)?.focus({preventScroll:true});
      }
      q('.wm-stage-title').textContent=G.stageName(selectedStage);
      q('.wm-stage-state').textContent=locked?'미개방':selectedStage===state.stage?'현재 지역':selectedStage<=best?'돌파 완료':'새로운 도전';
      const rewardInfo=G.campaignRewardInfo?.(state,selectedStage,false),reducedRewards=!locked&&rewardInfo?.eligible===false;
      q('.wm-stage-note').textContent=locked?`${G.stageName(selectedStage-1)} 돌파 후 열려요.`:reducedRewards?'반복·일일 임무 / 눈송이 미집계':'일반 전투 3번 · 마지막 웨이브 보스';
      q('.wm-stage-note').dataset.reduced=String(reducedRewards);
      const trait=G.CHAPTER_TRAITS?.[selectedChapter];q('.wm-chapter-tip').textContent=trait?`${trait.tip} 스킬 예고 중 기절시키면 시전을 차단해요.`:'';q('.wm-chapter-tip').hidden=!trait;
      // Ask the shared rules for the range instead of duplicating the cutoff.
      const firstEligible=G.campaignRewardInfo?Array.from({length:opened},(_,i)=>i+1).find(stage=>G.campaignRewardInfo(state,stage,false).eligible):1;
      const range=`정상 보상 지역: ${G.stageName(firstEligible)} ~ ${G.stageName(opened)}`;
      q('.wm-stage-note').title=range;
      q('.wm-stage-note').setAttribute('aria-label',`${q('.wm-stage-note').textContent} · ${range}`);
      q('.wm-reward').textContent=reducedRewards?`저레벨 지역 · 전투 보상 ${Math.round(rewardInfo.multiplier*100)}%`:selectedStage<=best?'첫 돌파 보상 수령 완료':'첫 돌파 보석 60';
      q('.wm-reward').dataset.reduced=String(reducedRewards);
      q('.wm-reward').classList.toggle('claimed',!reducedRewards&&selectedStage<=best);
      q('[data-map-start]').textContent=selectedStage<=best?'다시 도전':'도전 시작';
      for(const button of container.querySelectorAll('[data-map-start],[data-map-farm]'))button.disabled=locked||!!why||sending;
      q('.wm-block-reason').textContent=why||lastError;q('.wm-block-reason').hidden=!(why||lastError);
      q('[data-map-next]').disabled=sending;q('[data-map-current]').disabled=sending;
      if(q('[data-map-recommend]'))q('[data-map-recommend]').disabled=!!why||sending;
    }
    function chooseStage(n,center=false){lastError='';selectedStage=clamp(n,1,G.MAX_STAGE);selectedChapter=Math.floor((selectedStage-1)/5);paint();if(center)centerSelection();}
    async function start(mode) {
      if(destroyed||sending||reason()||selectedStage>unlock())return;
      lastError='';sending=true;paint();
      try { await options.onSelect?.(selectedStage,mode); }
      catch(error) { if(!destroyed)lastError=error?.message||'지역을 선택하지 못했어요. 다시 시도해 주세요.'; }
      finally {sending=false;if(!destroyed)paint();}
    }
    function click(event){
      const button=event.target.closest('button');if(!button||!container.contains(button)||destroyed||button.disabled)return;
      if(button.dataset.mapChapter!==undefined){lastError='';selectedChapter=clamp(Number(button.dataset.mapChapter),0,chapterCount-1);const first=selectedChapter*5+1,last=Math.min(first+4,G.MAX_STAGE);selectedStage=clamp(unlock(),first,last);paint();}
      else if(button.dataset.mapStage!==undefined)chooseStage(Number(button.dataset.mapStage));
      else if(button.hasAttribute('data-map-current'))chooseStage(Number(state.stage)||1,true);
      else if(button.hasAttribute('data-map-next'))chooseStage(unlock(),true);
      else if(button.hasAttribute('data-map-recommend'))options.onRecommend?.();
      else if(button.hasAttribute('data-map-start'))start('progress');
      else if(button.hasAttribute('data-map-farm'))start('farm');
    }
    container.addEventListener('click',click);window.addEventListener('resize',centerSelection);paint(true);centerSelection();
    return {
      update(next,nextBlocked=false){if(destroyed)return;state=next||state;blocked=nextBlocked;paint();},
      destroy(){destroyed=true;cancelAnimationFrame(scrollFrame);container.removeEventListener('click',click);container.removeEventListener('error',imageError,true);window.removeEventListener('resize',centerSelection);}
    };
  }
  return {render};
})();
