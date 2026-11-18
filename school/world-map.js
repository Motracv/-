/* Read-only navigation over the existing campaign; starting still uses SchoolRPG.action. */
window.SchoolWorldMap = (() => {
  'use strict';
  const G = window.SchoolRPG;
  const NODES = [
    [12,19], [37,16], [62,19], [87,17],
    [86,49], [62,49], [37,48], [12,49],
    [12,80], [37,81], [62,80], [87,80]
  ];
  const COLORS = ['#d7b16c','#d7b16c','#a0a4df','#87be9a','#cfaa78','#9faee2','#9acdde','#a89dc2','#94c1c3','#bb9b89','#94b89e','#b4d3c6'];
  const THEMES = ['교실','복도','도서관','정원','체육관','옥상','운동장','별관','실험실','지하','경계','성소'];
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
  function terrain() {
    const path = NODES.map((p,i)=>(i?'L':'M')+(p[0]*8.4)+' '+(p[1]*4.8)).join(' ');
    let trees='';
    for(const [x,y,s] of [[23,41,1],[787,349,1],[463,19,.85],[470,375,.9],[164,370,.8],[690,8,.7],[19,345,.9],[746,208,.8],[330,180,.65],[521,191,.7],[198,202,.6],[810,32,.85]]) trees+=`<g transform="translate(${x} ${y}) scale(${s})"><path fill="#162f36" d="M-12 0h24v30h-24z"/><path fill="#36584c" d="M-21 8h42v24h-42zM-14-5h28v18h-28z"/><path fill="#62816a" d="M-14-5h28v6h-28zM-21 8h20v7h-20z"/><path fill="#907b59" d="M-4 32h8v11h-8z"/></g>`;
    return `<svg class="wm-terrain" viewBox="0 0 840 480" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs><pattern id="wm-ground" width="40" height="40" patternUnits="userSpaceOnUse"><path fill="#273f46" d="M0 0h40v40H0z"/><path fill="#2d474d" d="M1 1h18v18H1zm20 20h18v18H21z"/></pattern></defs><path fill="url(#wm-ground)" d="M0 0h840v480H0z"/><path fill="#324f48" d="M16 14h342v126H16zM483 15h342v129H483zM3 319h225v144H3zM572 326h253v139H572z"/><path fill="#314951" d="M280 290h253v159H280z"/><path d="${path}" fill="none" stroke="#182e36" stroke-width="29" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="#786d55" stroke-width="19" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="#b9a982" stroke-width="2" stroke-dasharray="4 12"/>${trees}<g opacity=".6" fill="#9dc7ba"><path d="M397 223h4v4h-4zm29 15h3v3h-3zm-44 27h3v3h-3z"/></g><path fill="#607c82" d="M359 338h121v6H359zm17 10h89v5h-89z"/><path fill="#8aa4a0" d="M390 324h61v13h-61z"/><path fill="#bdd5bc" d="M414 311h12v13h-12z"/></svg>`;
  }
  function render(container, options) {
    if (!container || !options?.state) throw Error('모험 지도를 표시할 기록이 필요합니다.');
    let state=options.state, blocked=options.blocked||false, destroyed=false, sending=false, signature='', lastError='';
    let selectedStage=clamp(Number(state.stage)||1,1,G.MAX_STAGE), selectedChapter=Math.floor((selectedStage-1)/5);
    const chapterCount=G.CHAPTERS.length;
    container.innerHTML=`<section class="school-world-map" aria-label="학교 모험 지도"><div class="wm-toolbar"><p><span class="wm-compass" aria-hidden="true">✦</span><span>지도에서 지역을 골라 출발하세요</span></p><div><button type="button" class="wm-jump" data-map-current>현재 지역</button><button type="button" class="wm-jump" data-map-next>다음 도전 <span aria-hidden="true">↗</span></button></div></div><div class="wm-layout"><div class="wm-map-wrap"><div class="wm-campus" aria-label="학교의 열두 구역">${terrain()}${G.CHAPTERS.map((name,i)=>{const [x,y]=NODES[i]||[50,50];return `<button type="button" class="wm-chapter" data-map-chapter="${i}" style="--map-x:${x}%;--map-y:${y}%;--map-accent:${COLORS[i]||COLORS[0]}" aria-label="${i+1}구역 ${esc(name)}" title="${esc(name)}"><span class="wm-chapter-art">${markerIcon(i)}</span><span class="wm-chapter-name"><i>${String(i+1).padStart(2,'0')}</i><b>${esc(THEMES[i]||name)}</b></span><span class="wm-chapter-state"></span></button>`;}).join('')}</div><div class="wm-map-legend"><span><i class="wm-legend-dot cleared"></i>돌파</span><span><i class="wm-legend-dot available"></i>도전 가능</span><span><i class="wm-legend-dot locked"></i>미개방</span><span class="wm-total"></span></div></div><aside class="wm-detail" aria-label="선택한 지역"><div class="wm-detail-heading"><span class="wm-region-icon"></span><div><small class="wm-region-number"></small><h3 class="wm-region-title"></h3></div></div><div class="wm-route" role="group" aria-label="구역의 다섯 지역"></div><div class="wm-stage-info"><div><b class="wm-stage-title"></b><span class="wm-stage-state"></span></div><p class="wm-stage-note"></p><span class="wm-reward"></span></div><div class="wm-map-actions"><button id="map-start" type="button" class="wm-start" data-map-start>도전 시작</button><button id="map-farm" type="button" class="wm-farm" data-map-farm>반복 사냥</button></div><p class="wm-block-reason" role="status"></p><p class="wm-mode-note">도전은 다음 지역으로 · 반복은 선택한 지역에서</p></aside></div></section>`;
    const q=selector=>container.querySelector(selector);
    const labels=Array.from(container.querySelectorAll('[data-map-chapter]'));
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
      const best=Number(state.best)||0,opened=unlock(),first=selectedChapter*5+1,last=Math.min(first+4,G.MAX_STAGE), locked=selectedStage>opened;
      labels.forEach((button,i)=>{
        const start=i*5+1,end=Math.min(start+4,G.MAX_STAGE),canOpen=start<=opened,cleared=best>=end,current=Math.floor(((Number(state.stage)||1)-1)/5)===i;
        button.classList.toggle('selected',i===selectedChapter);button.classList.toggle('locked',!canOpen);button.classList.toggle('cleared',cleared);button.classList.toggle('current',current);
        button.setAttribute('aria-pressed',String(i===selectedChapter));
        button.setAttribute('aria-label',`${i+1}구역 ${G.CHAPTERS[i]} · ${cleared?'돌파':canOpen?'도전 가능':'미개방'}${current?' · 현재 지역':''}`);
        button.querySelector('.wm-chapter-state').textContent=cleared?'✓':!canOpen?'◆':current?'●':'';
      });
      q('.wm-total').textContent=`${best} / ${G.MAX_STAGE}`;
      q('.wm-region-icon').innerHTML=markerIcon(selectedChapter);
      q('.wm-region-number').textContent=`CHAPTER ${String(selectedChapter+1).padStart(2,'0')}`;
      q('.wm-region-title').textContent=G.CHAPTERS[selectedChapter];
      const route=q('.wm-route'),routeKey=[selectedChapter,best,state.stage,selectedStage].join('|');
      if(route.dataset.key!==routeKey){
        const focus=route.contains(document.activeElement)?document.activeElement.dataset.mapStage:null;
        route.innerHTML=Array.from({length:last-first+1},(_,i)=>{const n=first+i,isLocked=n>opened,isSelected=n===selectedStage,isCleared=n<=best;return `<button type="button" data-map-stage="${n}" class="wm-stage${isLocked?' locked':''}${isCleared?' cleared':''}${isSelected?' selected':''}${n===state.stage?' current':''}" aria-pressed="${isSelected}" aria-disabled="${isLocked}" ${isLocked?'disabled':''} aria-label="${G.stageName(n)} ${isLocked?'미개방':isCleared?'돌파':'도전 가능'}"><span>${G.stageName(n)}</span><small aria-hidden="true">${isLocked?'◆':isCleared?'✓':n===state.stage?'●':'·'}</small></button>`;}).join('');
        route.dataset.key=routeKey;if(focus)route.querySelector(`[data-map-stage="${focus}"]`)?.focus({preventScroll:true});
      }
      q('.wm-stage-title').textContent=`${G.stageName(selectedStage)} · ${THEMES[selectedChapter]||'지역'}`;
      q('.wm-stage-state').textContent=locked?'미개방':selectedStage===state.stage?'전투 중':selectedStage<=best?'돌파 완료':'새로운 도전';
      q('.wm-stage-note').textContent=locked?`${G.stageName(selectedStage-1)} 돌파 후 열려요.`:'일반 전투 3번 · 마지막 웨이브 보스';
      q('.wm-reward').textContent=selectedStage<=best?'첫 돌파 보상 수령 완료':'첫 돌파 보석 60';
      q('.wm-reward').classList.toggle('claimed',selectedStage<=best);
      q('[data-map-start]').textContent=selectedStage<=best?'다시 도전':'도전 시작';
      for(const button of container.querySelectorAll('[data-map-start],[data-map-farm]'))button.disabled=locked||!!why||sending;
      q('.wm-block-reason').textContent=why||lastError;q('.wm-block-reason').hidden=!(why||lastError);
      q('[data-map-next]').disabled=sending;
      q('[data-map-current]').disabled=sending;
    }
    function chooseStage(n){lastError='';selectedStage=clamp(n,1,G.MAX_STAGE);selectedChapter=Math.floor((selectedStage-1)/5);paint();}
    async function start(mode) {
      if(destroyed||sending||reason()||selectedStage>unlock())return;
      lastError='';sending=true;paint();
      try { await options.onSelect?.(selectedStage,mode); }
      catch(error) { if(!destroyed)lastError=error?.message||'지역을 선택하지 못했어요. 다시 시도해 주세요.'; }
      finally {sending=false;if(!destroyed)paint();}
    }
    function click(event){
      const button=event.target.closest('button');if(!button||!container.contains(button)||destroyed)return;
      if(button.dataset.mapChapter!==undefined){lastError='';selectedChapter=clamp(Number(button.dataset.mapChapter),0,chapterCount-1);const first=selectedChapter*5+1,last=Math.min(first+4,G.MAX_STAGE);selectedStage=clamp(unlock(),first,last);paint();}
      else if(button.dataset.mapStage!==undefined)chooseStage(Number(button.dataset.mapStage));
      else if(button.hasAttribute('data-map-current'))chooseStage(Number(state.stage)||1);
      else if(button.hasAttribute('data-map-next'))chooseStage(unlock());
      else if(button.hasAttribute('data-map-start'))start('progress');
      else if(button.hasAttribute('data-map-farm'))start('farm');
    }
    container.addEventListener('click',click);paint(true);
    return {
      update(next,nextBlocked=false){if(destroyed)return;state=next||state;blocked=nextBlocked;paint();},
      destroy(){destroyed=true;container.removeEventListener('click',click);}
    };
  }
  return {render};
})();
