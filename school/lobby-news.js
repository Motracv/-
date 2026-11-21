/* Lobby promotions navigate to existing screens; they never spend or grant rewards. */
window.SchoolLobbyNews = (() => {
  'use strict';
  const INTERVAL = 6500;
  const ticket = '<svg viewBox="0 0 120 90" aria-hidden="true"><path d="M10 18h100v15a12 12 0 0 0 0 24v15H10V57a12 12 0 0 0 0-24Z" fill="#ecd9af" stroke="#fff1d1" stroke-width="2"/><path d="M84 24v42" stroke="#967351" stroke-width="2" stroke-dasharray="4 5"/><path d="m32 52 4-14 24-15 10 14-25 15Z" fill="#4b5478"/><path d="m32 52 13 0-9-14Z" fill="#bd8b59"/></svg>';
  const pass = '<svg viewBox="0 0 100 110" aria-hidden="true"><path d="M16 8h68v66L50 103 16 74Z" fill="#264f70" stroke="#f5d393" stroke-width="4"/><path d="m50 25 9 18 20 3-14 14 3 20-18-9-18 9 3-20-14-14 20-3Z" fill="#ffe3a3"/></svg>';
  function slidesFor(G, state, now) {
    const slides = [];
    if(G.bannerAvailable('rudes',now))slides.push({id:'rudes',banner:'rudes',tag:'NEW · SSR 픽업 모집',title:'루데스',subtitle:'은빛 우산 아래, 탑의 마녀',note:'어둠 · 우산총 물리 / 부채 마법',cta:'모집 보기',image:'school/assets/rudes/illustration.webp?v=rudes1'});
    if(G.bannerAvailable('yaho',now))slides.push({id:'yaho',banner:'yaho',tag:'NEW · SSR 픽업 모집',title:'야호',subtitle:'작은 포효, 커다란 약속',note:'라바의 제자 · 화염 치유 서포터',cta:'모집 보기',image:'school/assets/yaho/illustration.webp?v=yaho1'});
    if(G.bannerAvailable('horas', now)) slides.push({id:'horas',banner:'horas',tag:'UR · 한정 모집',title:'호라스',subtitle:'벚꽃 아래, 새로운 인연',note:'11. 23 00:00까지 · 한국 시간',cta:'모집 보기',image:'school/assets/horas/pickup.webp?v=horas1'});
    if(G.bannerAvailable('hyeokjin', now)) slides.push({id:'hyeokjin',banner:'hyeokjin',tag:'UR · 픽업 모집',title:'서혁진',subtitle:'마지막까지 지켜낸 약속',note:'어둠을 가르는 대검',cta:'모집 보기',image:'school/assets/hyeokjin/pickup.webp?v=hyeokjin1'});
    if(G.eventInfo(now).active) slides.push({id:'double',tag:'진행 중 · 더블 보상',title:'모험의 보상이 2배',subtitle:'눈송이 · 코인 · 경험치',note:'11. 23 17:17까지 · 한국 시간',cta:'이벤트 보기',symbol:'<b class="lobby-news-double">×2</b>'});
    if(G.winterInfo(state,now).active) slides.push({id:'winter',tag:'WINTER FESTIVAL',title:'눈꽃이 내리는 학교',subtitle:'눈송이를 모아 특별한 선물을',note:'겨울 축제 · 이벤트 교환소',cta:'축제 가기',image:'school/assets/bonds/spica-illustration.webp?v=bond-art1'});
    slides.push({id:'pass',tag:'FREE · 최대 50레벨',title:'우리의 모험 기록',subtitle:'퀘스트로 채우는 무료 배틀패스',note:'코인 · 장비 · 눈송이 보상',cta:'패스 보기',symbol:pass});
    if(G.COUPONS.NEWNAME.expiresAt>now&&!(state.redeemedCodes||[]).includes('NEWNAME')) slides.push({id:'newname',tag:'선물 도착 · 계정당 1회',title:'새 이름, 새로운 시작',subtitle:'닉네임 변경권 1장 선물',note:'보상 코드 NEWNAME',cta:'코드 입력',symbol:ticket});
    return slides;
  }
  function create(ctx) {
    const host=document.getElementById('lobby-panel');
    if(!host||document.getElementById('lobby-news'))return null;
    const box=document.createElement('section');box.id='lobby-news';box.className='lobby-news';box.setAttribute('aria-label','모집과 이벤트 소식');box.setAttribute('aria-roledescription','캐러셀');
    box.innerHTML='<div class="lobby-news-window"></div><div class="lobby-news-controls"><span class="lobby-news-count" aria-hidden="true"></span><div class="lobby-news-pages" role="group" aria-label="소식 선택"></div><button type="button" class="lobby-news-pause" aria-label="배너 자동 넘김 일시 정지" aria-pressed="false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg></button></div>';
    host.append(box);host.dataset.newsReady='true';
    const windowEl=box.querySelector('.lobby-news-window'),pages=box.querySelector('.lobby-news-pages'),count=box.querySelector('.lobby-news-count'),pause=box.querySelector('.lobby-news-pause');
    let slides=[],key='',index=0,timer=0,paused=false,hovered=false,focused=false,suspended=false,destroyed=false,down=null,suppressClick=false,controlState='';
    const disposers=[];
    const on=(target,type,fn,options)=>{target.addEventListener(type,fn,options);disposers.push(()=>target.removeEventListener(type,fn,options));};
    const reduced=()=>!!ctx.reduced?.()||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const canRun=()=>!destroyed&&!suspended&&!document.hidden&&ctx.visible()&&!down&&!paused&&!hovered&&!focused&&!reduced()&&slides.length>1;
    function stop(){if(timer)clearTimeout(timer);timer=0;}
    function schedule(){if(!canRun()){stop();return;}if(!timer)timer=setTimeout(()=>{timer=0;refresh();if(canRun())show(index+1);},INTERVAL);}
    function show(next){
      if(!slides.length)return;index=(next+slides.length)%slides.length;
      [...windowEl.children].forEach((node,i)=>{const active=i===index;node.classList.toggle('is-current',active);node.setAttribute('aria-hidden',String(!active));node.tabIndex=active?0:-1;node.inert=!active;});
      [...pages.children].forEach((node,i)=>node.setAttribute('aria-pressed',String(i===index)));
      count.textContent=`${String(index+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`;
      stop();schedule();
    }
    function rebuild(next){
      const current=slides[index]?.id;slides=next;key=slides.map(s=>s.id).join('|');
      windowEl.replaceChildren();pages.replaceChildren();
      for(const [i,slide]of slides.entries()){
        const card=document.createElement('button');card.type='button';card.className='lobby-news-card';card.dataset.promo=slide.id;card.setAttribute('aria-label',`${slide.tag} · ${slide.title} · ${slide.subtitle} · ${slide.cta}`);
        // All copy and paths above are owned by the game, never user-generated.
        card.innerHTML=`${slide.image?`<img src="${slide.image}" alt="" decoding="async" loading="lazy" draggable="false">`:''}<span class="lobby-news-shade" aria-hidden="true"></span>${slide.symbol?`<span class="lobby-news-symbol" aria-hidden="true">${slide.symbol}</span>`:''}<span class="lobby-news-copy"><small class="lobby-news-tag">${slide.tag}</small><strong>${slide.title}</strong><span>${slide.subtitle}</span><small class="lobby-news-note">${slide.note}</small></span><span class="lobby-news-cta">${slide.cta}</span>`;
        card.onclick=()=>{if(suppressClick){suppressClick=false;return;}if(slidesFor(ctx.game,ctx.state(),ctx.now()).some(s=>s.id===slide.id))ctx.open(slide);else refresh();};
        windowEl.append(card);
        const dot=document.createElement('button');dot.type='button';dot.className='lobby-news-page';dot.setAttribute('aria-label',`${i+1}번째 소식 · ${slide.title}`);dot.innerHTML='<i aria-hidden="true"></i>';dot.onclick=()=>show(i);pages.append(dot);
      }
      show(Math.max(0,slides.findIndex(s=>s.id===current)));
    }
    function refresh(){
      if(destroyed)return;
      const next=slidesFor(ctx.game,ctx.state(),ctx.now());
      if(next.map(s=>s.id).join('|')!==key)rebuild(next);
      const nextControls=`${paused}:${!!reduced()}`;
      if(nextControls!==controlState){
        controlState=nextControls;box.dataset.reduced=String(!!reduced());
        pause.disabled=!!reduced();pause.setAttribute('aria-pressed',String(paused||!!reduced()));pause.setAttribute('aria-label',reduced()?'자동 넘김 꺼짐 · 모션 줄이기':paused?'배너 자동 넘김 재생':'배너 자동 넘김 일시 정지');
        pause.innerHTML=paused||reduced()?'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 5 7 5-7 5Z"/></svg>':'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg>';
      }
      schedule();
    }
    on(pause,'click',()=>{paused=!paused;refresh();});
    on(box,'pointerenter',e=>{if(e.pointerType==='mouse'){hovered=true;stop();}});
    on(box,'pointerleave',()=>{hovered=false;schedule();});
    on(box,'focusin',()=>{focused=true;stop();});
    on(box,'focusout',e=>{focused=box.contains(e.relatedTarget);schedule();});
    on(box,'keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(index+(e.key==='ArrowRight'?1:-1));pages.children[index]?.focus();}});
    on(windowEl,'pointerdown',e=>{if(e.isPrimary===false||e.button>0)return;suppressClick=false;down={x:e.clientX,y:e.clientY,id:e.pointerId};stop();});
    on(windowEl,'pointerup',e=>{if(down?.id!==e.pointerId)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;down=null;if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy)*1.4){suppressClick=true;show(index+(dx<0?1:-1));}else schedule();});
    on(window,'pointerup',()=>{down=null;schedule();});
    on(window,'pointercancel',()=>{down=null;schedule();});
    on(document,'visibilitychange',()=>document.hidden?stop():refresh());
    on(window,'pagehide',()=>{suspended=true;stop();});on(window,'pageshow',()=>{suspended=false;refresh();});
    const observer=typeof MutationObserver==='function'?new MutationObserver(refresh):null;observer?.observe(document.getElementById('app'),{attributes:true,attributeFilter:['data-tab']});
    refresh();
    return {refresh,destroy(){destroyed=true;stop();observer?.disconnect();disposers.forEach(fn=>fn());box.remove();delete host.dataset.newsReady;}};
  }
  return {create,slidesFor,INTERVAL};
})();
