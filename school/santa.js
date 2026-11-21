/* Account actions own the battle, boxes and roulette. Presentation is disposable. */
window.SchoolSanta=(()=>{
 'use strict';const S=window.SchoolSantaRules,fmt=n=>Math.round(n||0).toLocaleString('ko-KR');
 function create(ctx){
  let epoch=0,timer=0,raf=0,spinTimer=0,busy=false,spinning=false,frameReady=false,tab='battle',mode='normal',rotation=0,received=0,lastFrame=0,lastSound=0,lastCards=0,auto=true,autoDue=0,handled='',battleKey='',preview=null,errorAt=0,retryAt=0,wake=null,leaving=false;
  const timeline=window.SchoolCombatFeedback.createSnapshotTimeline(),bars=new Map(),$=id=>document.getElementById(id),wallet=()=>ctx.getState().santa||{},own=()=>!!$('santa-view')?.closest('dialog')?.open;
  const scope=()=>ctx.scope?.()||'local',reports=window.SchoolEncounterTools?.createReport({kind:'santa',scope,host:()=>$('santa-report')});
  const saveAuto=()=>window.SchoolEncounterTools?.writeAuto('santa',scope(),auto);
  function message(text){if($('santa-message'))$('santa-message').textContent=text;}
  function stop(){epoch++;clearTimeout(timer);clearTimeout(spinTimer);cancelAnimationFrame(raf);timer=raf=spinTimer=0;busy=spinning=frameReady=false;autoDue=0;timeline.clear();bars.clear();wake?.destroy();wake=null;}
  function accept(){const b=wallet().battle;received=performance.now();if(b){
   if(battleKey!==b.key){battleKey=b.key;autoDue=0;retryAt=0;timeline.clear();bars.clear();}
   timeline.accept(b,b.key,received,{active:!b.ended,hidden:document.hidden});reports?.update(b,b.key);
   if(b.ended&&b.key!==handled){handled=b.key;if(auto&&!leaving&&b.outcome==='defeated')autoDue=Date.now()+5000;}
  }wake?.update(auto);render();}
  function schedule(){clearTimeout(timer);if(!own())return;timer=setTimeout(async()=>{timer=0;if(!own())return;
   try{const b=wallet().battle;if(b?.key!==battleKey||b?.ended&&b.key!==handled)accept();wake?.update(auto);
    if(!document.hidden&&!busy&&!ctx.isBlocked()&&Date.now()>=retryAt){
     if(auto&&!leaving&&autoDue&&Date.now()>=autoDue&&frameReady)await send('santa-start');
     else if(b&&!b.ended)await send('santa-tick');
    }
   }finally{if(own()){render();schedule();}}
  },wallet().battle&&!wallet().battle.ended?1000:250);}
  async function send(kind,extra={}){
   if(!own()||busy||kind==='santa-spin'&&spinning||ctx.isBlocked()||kind==='santa-start'&&!frameReady)return false;
   const ticket=epoch;busy=true;clearTimeout(timer);render();
   if(!['santa-tick','santa-start'].includes(kind)&&!spinning)message('확인 중…');
   try{const result=await ctx.dispatch({kind,...(['santa-tick','santa-leave'].includes(kind)?{battleKey:wallet().battle?.key}:{}),...extra});if(ticket!==epoch||!own())return false;
    if(!result||result.error){retryAt=Date.now()+2500;message(result?.error||'연결을 확인해 주세요.');return false;}
    accept();if(kind==='santa-box'){message(`선물상자 개봉 · 산타코인 +${fmt(result.amount)}`);ctx.play?.('reward');}
    else if(kind==='santa-ticket')message('일반 룰렛권 1장을 구입했어요.');
    else if(kind==='santa-spin')spin(result);
    else if(kind!=='santa-tick'&&!spinning)message('');return true;
   }catch(error){if(ticket===epoch){retryAt=Date.now()+2500;message(error.message||'연결을 확인해 주세요.');}return false;}
   finally{if(ticket===epoch&&own()){busy=false;render();schedule();}}
  }
  function wheel(){const table=mode==='special'?S.SPECIAL:S.NORMAL,n=table.length,colors=mode==='special'?['#254c75','#326a92','#234264','#408396']:['#943d43','#35585d','#65507d','#315e80','#8b6834'];
   $('santa-wheel').style.background=`conic-gradient(${colors.map((c,i)=>`${c} ${i*360/n}deg ${(i+1)*360/n}deg`).join(',')})`;
   $('santa-wheel').innerHTML=table.map((p,i)=>`<span style="--a:${(i+.5)*360/n}deg"><b>${p.label}</b></span>`).join('');
   $('santa-odds').innerHTML=table.map(p=>`<li><span>${p.label}</span><b>${Math.round(p.chance*100)}%</b></li>`).join('');
   $('santa-roulette-title').textContent=mode==='special'?'별빛 특별 룰렛':'산타의 선물 룰렛';
   $('santa-wheel').style.transition='none';$('santa-wheel').style.transform=`rotate(${rotation}deg)`;
  }
  function spin(result){spinning=true;const wheelNode=$('santa-wheel'),n=(result.special?S.SPECIAL:S.NORMAL).length,target=(360-(result.index+.5)*360/n+360)%360;
   rotation+=360*5+(target-rotation%360+360)%360;wheelNode.style.transition=ctx.reduced?.()?'none':'transform 3.6s cubic-bezier(.16,.72,.12,1)';wheelNode.style.transform=`rotate(${rotation}deg)`;
   message('선물이 도착하고 있어요…');const ticket=epoch;spinTimer=setTimeout(()=>{spinTimer=0;if(ticket!==epoch||!own())return;spinning=false;message(`${result.prize.label} 획득!${result.bonus?' ✦ 특별 룰렛권도 1장 받았어요!':''}`);ctx.play?.('reward');render();},ctx.reduced?.()?0:3650);
  }
  function render(){if(!own())return;const w=wallet(),b=w.battle,live=b&&!b.ended,locked=busy||ctx.isBlocked();
   for(const [id,key] of [['coins','coins'],['boxes','boxes'],['tickets','tickets'],['special','special']])$('santa-'+id).textContent=fmt(w[key]);
   $('santa-last-prize').textContent=w.lastReward?'최근 획득: '+w.lastReward:'';
   $('santa-view').dataset.phase=live?'fighting':b?.ended?'finished':'ready';
   document.querySelectorAll('[data-santa-tab]').forEach(n=>{n.setAttribute('aria-selected',String(n.dataset.santaTab===tab));n.disabled=false;});
   $('santa-view').dataset.panel=tab;$('santa-battle').hidden=false;$('santa-loot').hidden=tab!=='loot';
   $('santa-start').disabled=locked||!!live||!frameReady;$('santa-start').textContent=live?'토벌 중':b?.ended?'즉시 재도전':'산타 토벌 시작';
   $('santa-auto').checked=auto;$('santa-countdown').textContent=autoDue?(Date.now()<autoDue?`${Math.ceil((autoDue-Date.now())/1000)}초 후 자동 재도전`:document.hidden?'화면 복귀 후 자동 재도전':locked||Date.now()<retryAt?'연결 확인 후 자동 재도전':'곧 자동 재도전'):auto?'승리하면 5초 뒤 자동 재도전':'자동 재도전 꺼짐';
   const outcome=b?.outcome;$('santa-result').hidden=!b?.ended;$('santa-result').textContent=outcome==='defeated'?'토벌 성공! 선물상자 1개 획득':outcome==='timeout'?'시간 종료 · 용병을 육성하고 다시 도전하세요':outcome==='down'?'용병단이 쓰러졌어요':outcome==='withdrawn'?'도전을 종료했어요':'';
   $('santa-box').disabled=locked||!(w.boxes>0);$('santa-buy').disabled=locked||!(w.coins>=S.TICKET_COST);$('santa-spin').disabled=locked||spinning||!(w[mode==='special'?'special':'tickets']>0);
   $('santa-spin').textContent=(mode==='special'?'특별':'일반')+' 룰렛권 1장 · 돌리기';
   document.querySelectorAll('[data-santa-mode]').forEach(n=>{n.disabled=locked||spinning;n.setAttribute('aria-pressed',String(n.dataset.santaMode===mode));});
   $('santa-back').disabled=busy||ctx.isBlocked();
  }
  function draw(now){if(!own())return;raf=requestAnimationFrame(draw);if(document.hidden){timeline.suspend();lastFrame=0;return;}if(now-lastFrame<16)return;
   try{const canvas=$('santa-canvas'),rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;const width=Math.min(1600,Math.round(rect.width*Math.min(window.devicePixelRatio||1,1.5))),height=Math.round(width*rect.height/rect.width);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}const c=canvas.getContext('2d');if(!c||c.isContextLost?.())return;
    const mobileLandscape=window.matchMedia('(pointer:coarse) and (orientation:landscape)').matches;
    const sceneHeight=mobileLandscape?1000*height/width:560;
    c.setTransform(1,0,0,1,0,0);c.fillStyle='#102335';c.fillRect(0,0,width,height);const scale=Math.min(width/1000,height/sceneHeight);c.setTransform(scale,0,0,scale,(width-1000*scale)/2,(height-sceneHeight*scale)/2);c.imageSmoothingEnabled=false;
    const b=wallet().battle,visual=timeline.view(now)||b||preview,events=timeline.events(now),live=!!b&&!b.ended,time=b?timeline.clock(now):0,units=visual?.teams[0].units||[];
    window.SchoolRaidFX.draw(c,{w:1000,h:sceneHeight,now,dt:Math.min(50,now-lastFrame||16),battle:visual,roomKey:b?.key||'santa-preview',focus:0,events,bg:window.SchoolSantaArt.background,atlas:{complete:false},bars,reduced:ctx.reduced?.()||false,units,received,visualTime:time,live,hp:visual?.boss.hp,bossId:'santa'});
    lastFrame=now;canvas.dataset.draws=String((Number(canvas.dataset.draws)||0)+1);if(!frameReady&&window.SchoolSantaArt.ready){frameReady=true;render();}
    $('santa-health').value=visual?.boss.hp??S.HP;$('santa-hp').textContent=fmt(visual?.boss.hp??S.HP)+' / '+fmt(S.HP);
    $('santa-clock').textContent=live?Math.max(0,Math.ceil((S.DURATION-time)/1000))+'초':'권장 용병 Lv.90 이상';
    const gift=S.GIFTS.find(p=>p.id===visual?.boss.cast?.id);$('santa-warning').textContent=gift?`${gift.name} · ${gift.desc}`:'선물상자를 조심하세요!';
    if(now-lastCards>125){lastCards=now;window.SchoolSkillCards?.coop($('santa-skill-cards'),units,{elapsed:time,phase:live?'fight':'waiting',events,now,team:0});}
    const fresh=events.filter(e=>!e.sounded&&e.shown<=now&&now-e.shown<300);if(now-lastSound>150&&fresh.some(e=>['impact','hit'].includes(e.kind))){ctx.play?.(fresh.some(e=>e.kind==='impact')?'critical':'hit');lastSound=now;}for(const e of fresh)e.sounded=true;
   }catch(error){frameReady=false;if(!errorAt||now-errorAt>5000){console.error('Santa render failed',error);errorAt=now;}message('전투 화면을 다시 불러오는 중이에요.');render();}
  }
  function open(){stop();leaving=false;wake=window.SchoolEncounterTools?.keepAwake();auto=window.SchoolEncounterTools?.readAuto('santa',scope())??true;retryAt=0;tab='battle';mode='normal';rotation=0;lastFrame=0;handled=wallet().battle?.ended?wallet().battle.key:'';battleKey='';
   if(!ctx.isCloud()){ctx.openModal('겨울 이벤트 · 산타 토벌','<p>계정에 로그인하면 산타 토벌과 룰렛을 이용할 수 있어요.</p><button id="santa-login" class="primary">계정 연결</button>','santa');$('santa-login').onclick=ctx.openAccount;return;}
   preview=window.SchoolRaidRules.create(window.SchoolRPG,[{account:'solo',save:ctx.getState()}],Date.now(),1,S.HP);preview.boss.id='santa';
   ctx.openModal('겨울 이벤트 · 산타의 선물',`<section id="santa-view"><nav class="santa-tabs" aria-label="산타 이벤트 메뉴"><button data-santa-tab="battle" aria-selected="true">산타 토벌</button><button data-santa-tab="loot" aria-selected="false">상자 · 룰렛</button><button id="santa-back" class="secondary">이벤트</button></nav>
    <div class="santa-wallet"><span>산타코인 <b id="santa-coins">0</b></span><span>선물상자 <b id="santa-boxes">0</b></span><span>일반권 <b id="santa-tickets">0</b></span><span class="santa-special">특별권 <b id="santa-special">0</b></span></div>
    <div class="santa-actions winter-auto-toolbar"><button id="santa-start" class="primary" disabled>산타 토벌 시작</button><label><input id="santa-auto" type="checkbox" checked> 자동 재도전</label><span id="santa-countdown"></span><button id="santa-record-button" data-encounter-record class="secondary">전투 기록</button></div><div class="santa-workspace"><section id="santa-report" class="encounter-report" hidden></section><section id="santa-battle"><div class="santa-arena"><canvas id="santa-canvas" aria-label="내 용병단과 산타의 전투"></canvas><div class="santa-boss-hp"><b>선물보따리 산타</b><span id="santa-hp"></span><progress id="santa-health" max="${S.HP}" value="${S.HP}"></progress></div><span id="santa-clock"></span><p id="santa-warning"></p><div id="santa-result" role="status" hidden></div></div><div id="santa-skill-cards" class="coop-skill-cards"></div>
    <p class="santa-note">1인 용병단 · 권장 용병 Lv.90 이상 · 제한 150초 · 횟수 제한 없음<br>물리·마법 모두 유효합니다. 탱커와 힐러를 포함한 6인 편성을 추천해요.</p></section>
    <section id="santa-loot" hidden><div class="santa-shop"><div><b>산타 선물상자</b><p>토벌 성공마다 1개 · 코인 1~100개 균등 확률</p></div><button id="santa-box" class="primary">상자 1개 열기</button><button id="santa-buy" class="secondary">50코인 · 일반권 1장 구입</button></div><div class="santa-roulette"><div class="santa-wheel-shell"><i aria-hidden="true"></i><div id="santa-wheel" aria-hidden="true"></div><span class="santa-wheel-hub" aria-hidden="true">✦</span></div><div class="santa-roulette-copy"><small>WINTER GIFT</small><h3 id="santa-roulette-title"></h3><p>일반 룰렛을 돌릴 때마다 3% 확률로<br>보석만 나오는 특별 룰렛권을 추가로 받아요.</p><div class="santa-modes"><button data-santa-mode="normal" aria-pressed="true">일반 룰렛</button><button data-santa-mode="special" aria-pressed="false">특별 룰렛</button></div><button id="santa-spin" class="primary">일반 룰렛권 1장 · 돌리기</button><p id="santa-last-prize" class="santa-note"></p></div></div><details class="santa-probabilities"><summary>보상과 정확한 당첨 확률</summary><ul id="santa-odds"></ul><p>칸의 크기와 당첨 확률은 달라요. 특별권은 일반 보상과 별도로 추첨하며, 특별 룰렛에서는 추가 특별권이 나오지 않아요.</p></details></section></div><p id="santa-message" role="status" aria-live="polite"></p></section>`,'santa');
   $('santa-record-button').onclick=()=>{tab='battle';reports?.toggle();render();};
   $('santa-start').onclick=()=>{leaving=false;return send('santa-start');};$('santa-auto').onchange=()=>{auto=$('santa-auto').checked;if(auto)leaving=false;saveAuto();if(!auto)autoDue=0;else if(wallet().battle?.outcome==='defeated')autoDue=Date.now()+5000;wake?.update(auto);render();};
   $('santa-box').onclick=()=>send('santa-box');$('santa-buy').onclick=()=>send('santa-ticket');$('santa-spin').onclick=()=>send('santa-spin',{special:mode==='special'});
   $('santa-back').onclick=async()=>{if(await leave()){stop();ctx.openWinter();}};
   document.querySelectorAll('[data-santa-tab]').forEach(n=>n.onclick=()=>{tab=n.dataset.santaTab;if(tab==='loot')$('santa-report').hidden=true;render();});
   document.querySelectorAll('[data-santa-mode]').forEach(n=>n.onclick=()=>{if(busy||spinning)return;mode=n.dataset.santaMode;rotation=0;wheel();render();});
   wheel();accept();window.SchoolSantaArt.load().then(ok=>{if(own()&&!ok)message('산타 이미지를 불러오지 못했어요. 다시 열어 주세요.');});raf=requestAnimationFrame(draw);schedule();
  }
  async function leave(){if(!own())return true;if(busy||ctx.isBlocked())return false;leaving=true;autoDue=0;wake?.update(false);if(spinning){clearTimeout(spinTimer);spinning=false;}return wallet().battle&&!wallet().battle.ended?await send('santa-leave'):true;}
  return{open,leave,destroy:stop};
 }
 return{create};
})();
