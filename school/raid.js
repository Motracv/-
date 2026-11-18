/* Live shared guild raid: server snapshots, bounded canvas effects, no local rewards. */
window.SchoolRaid=(()=>{
 'use strict';const R=window.SchoolRaidRules,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=n=>Math.round(n||0).toLocaleString('ko-KR');
 const bg=new Image(),atlas=new Image();bg.src='school/assets/raid/gymnasium.png?v=raid1';atlas.src='school/assets/raid/balloon-poses.png?v=raid1';
 function create(ctx){let data=null,busy=false,polling=false,timer=0,raf=0,epoch=0,focus=0,seen=0,received=0,events=[],pending=null,lastFrame=0,renderKey='',bars=new Map(),lastSound=0;
  const own=()=>!!document.querySelector('#raid-view')?.closest('dialog')?.open;
  const key=()=>`school-raid-request:${ctx.scope()}`;
  const remember=p=>{pending=p;try{p?sessionStorage.setItem(key(),JSON.stringify(p)):sessionStorage.removeItem(key());}catch{}};
  const message=(s,error=false)=>{const n=document.getElementById('raid-message');if(n){n.textContent=s;n.dataset.error=String(error);}};
  function stop(){epoch++;clearTimeout(timer);cancelAnimationFrame(raf);busy=false;polling=false;}
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>{if(!own())return;if(!document.hidden)load();else schedule();},data?.room?.status==='fighting'?1000:2500);}
  function accept(next){const old=data?.room?.id,phase=data?.room?.status;if(phase!==next.room?.status){document.getElementById('modal').scrollTop=0;document.getElementById('modal-content').scrollTop=0;}if(old!==next.room?.id){seen=0;events=[];focus=0;bars.clear();}data=next;received=performance.now();const battle=data.room?.battle;if(battle){focus=Math.min(focus,Math.max(0,battle.teams.length-1));if(!old||old!==data.room.id)focus=Math.max(0,battle.teams.findIndex(t=>data.room.members.find(m=>m.account===t.account)?.isMe));for(const e of battle.events)if(e.seq>seen&&e.t>=battle.elapsed-2200)events.push({...e,shown:received-Math.min(1000,battle.elapsed-e.t)+180});seen=battle.seq;events=events.slice(-160);}render();}
  async function load(){if(!own()||busy||polling)return;const ticket=epoch;polling=true;try{const next=await ctx.request('/api/school/raid',{kind:'state'});if(ticket===epoch&&own()){accept(next);message('');}}catch(e){if(ticket===epoch)message(e.message+' · 자동으로 다시 연결합니다.',true);}finally{polling=false;if(ticket===epoch){controls();schedule();}}}
  async function send(kind,retry=false){if(!own()||busy||ctx.isBlocked())return;const ticket=++epoch;clearTimeout(timer);if(pending&&!retry){message('이전 요청의 결과를 먼저 확인해 주세요.',true);return;}const body=retry?pending:{kind,roomId:data?.room?.id,requestId:crypto.randomUUID()};if(!body)return;remember(body);busy=true;controls();message('서버 확인 중…');
   try{const next=await ctx.request('/api/school/raid',body);if(ticket===epoch&&own()){remember(null);accept(next);message('');}}
   catch(e){if(ticket===epoch){if(e.status&&e.status<500)remember(null);message(e.message,true);}}
   finally{if(ticket===epoch){busy=false;renderKey='';render();schedule();}}
  }
  function controls(){document.querySelectorAll('#raid-view button').forEach(b=>b.disabled=busy||ctx.isBlocked()||b.dataset.unavailable==='true');}
  function html(id,value){const n=document.getElementById(id);if(n._raidHTML!==value){n.innerHTML=value;n._raidHTML=value;}}
  function render(){if(!own()||!data)return;const room=data.room,b=room?.battle,me=room?.members.find(m=>m.isMe),host=me&&room.host===me.account;
   document.getElementById('raid-hp').textContent=fmt(data.hp)+' / 50,000,000';document.getElementById('raid-health').value=data.hp;document.getElementById('raid-attempts').textContent=`오늘 ${data.remaining} / 5회`;
   const status=room?.status||'empty';document.getElementById('raid-view').dataset.phase=status;
   const key=JSON.stringify({id:room?.id,status,host,m:room?.members,rewards:data.rewards,pending:!!pending,remaining:data.remaining,cycle:data.cycle});
   if(key!==renderKey){renderKey=key;
    document.getElementById('raid-parties').innerHTML=(room?.members||[]).map((m,i)=>`<button class="raid-party ${i===focus?'selected':''}" data-raid-focus="${i}"><span class="raid-presence ${m.online?'online':''}"></span><b>${esc(m.name)}${m.isMe?' · 나':''}${room.host===m.account?' ♛':''}</b><small>${status==='lobby'?m.ready?'준비 완료':'준비 중':`${fmt(b?.teams.find(t=>t.account===m.account)?.damage)} 피해`}</small></button>`).join('')||'<span class="raid-empty">길드원과 함께 또는 혼자 도전하세요</span>';
    let actions='';if(!room||status==='finished')actions=`<button class="primary" data-raid-send="${data.hp===0?'next':'create'}">${data.hp===0?'다음 벌룬 열기':'전투방 만들기'}</button>`;
    else if(status==='lobby'){if(!me)actions='<button class="primary" data-raid-send="join">같이 도전하기</button>';else actions=`<button class="${me.ready?'secondary':'primary'}" data-raid-send="ready">${me.ready?'준비 취소':'준비 완료'}</button>${host?`<button class="primary" data-raid-send="start" ${!room.members.every(m=>m.ready)?'data-unavailable="true"':''}>${room.members.length===1?'혼자 시작':'함께 시작'}</button>`:''}<button class="secondary" data-raid-send="leave">방 나가기</button>`;}
    else actions='<span class="raid-live-dot">● 협동 전투 진행 중</span>';
    html('raid-actions',`${actions}${pending?'<button id="raid-retry" class="secondary">요청 결과 확인</button>':''}<button id="raid-fullscreen" class="secondary" aria-label="전체 화면 · 상태바 숨기기">⛶</button><button id="raid-info" class="secondary" aria-label="패턴과 규칙">ⓘ</button><button id="raid-lineup-toggle" class="secondary">편성</button><button id="raid-back" class="secondary">교실</button>`);
    html('raid-rewards',data.rewards.map(r=>`<button class="raid-reward" data-raid-claim="${esc(r.roomId)}">전투 보상 · ◆ ${r.gems} / 골드 ${fmt(r.gold)} 받기</button>`).join(''));
    const summary=document.getElementById('raid-summary');summary.hidden=status!=='finished';summary.innerHTML=status==='finished'?`<b>${b?.outcome==='defeated'?'벌룬 토벌 성공!':b?.outcome==='down'?'부대 전멸 · 도전 종료':'시간 종료 · 도전 완료'}</b><span>이번 협동 피해 ${fmt(b?.damage)} · 남은 HP는 다음 도전으로 이어집니다</span>`:'';
    html('raid-lineup',status==='lobby'&&me?me.heroes.map(h=>`<span class="${h.magic?'magic':'physical'}"><img src="${window.SchoolArt.portrait(h.id)}" alt=""><b>${esc(window.SchoolRPG.BY_ID[h.id].name)}</b><small>${h.magic?'마법':'물리 무효'}</small></span>`).join(''):'');
    document.querySelectorAll('[data-raid-send]').forEach(n=>n.onclick=()=>send(n.dataset.raidSend));document.querySelectorAll('[data-raid-focus]').forEach(n=>n.onclick=()=>{focus=Number(n.dataset.raidFocus);bars.clear();renderKey='';render();});
    document.querySelectorAll('[data-raid-claim]').forEach(n=>n.onclick=async()=>{if(busy||ctx.isBlocked())return;busy=true;controls();await ctx.dispatch({kind:'raid-claim',roomId:n.dataset.raidClaim});busy=false;if(own())load();});
    const retry=document.getElementById('raid-retry');if(retry)retry.onclick=()=>send(null,true);document.getElementById('raid-fullscreen').onclick=ctx.fullscreen;document.getElementById('raid-back').onclick=()=>{stop();ctx.openGuild();};document.getElementById('raid-lineup-toggle').onclick=()=>document.getElementById('raid-lineup').classList.toggle('expanded');document.getElementById('raid-info').onclick=()=>{const n=document.getElementById('raid-rules');n.hidden=!n.hidden;};
   }
   html('raid-ranks','<b>이번 벌룬 · 길드 누적 피해</b>'+data.ranks.map((r,i)=>`<p>${i+1}. ${esc(r.name||'단장')} · ${fmt(r.damage)}</p>`).join(''));
   if(b)document.querySelectorAll('[data-raid-focus] small').forEach((n,i)=>n.textContent=fmt(b.teams[i]?.damage)+' 피해');controls();
  }
  function draw(now){
   if(!own())return;raf=requestAnimationFrame(draw);if(document.hidden||now-lastFrame<16)return;
   const dt=Math.min(50,now-lastFrame||16);lastFrame=now;
   const canvas=document.getElementById('raid-canvas'),rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
   const density=Math.min(window.devicePixelRatio||1,1.5),cw=Math.min(1600,Math.round(rect.width*density)),ch=Math.round(cw*rect.height/rect.width);
   if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
   const c=canvas.getContext('2d');if(!c||c.isContextLost?.())return;
   c.setTransform(cw/1000,0,0,cw/1000,0,0);c.imageSmoothingEnabled=false;
   const battle=data?.room?.battle,live=data?.room?.status==='fighting',t=battle?battle.elapsed+Math.min(1000,now-received):0;
   const units=battle?.teams[focus]?.units||ctx.getState().team.map(id=>({id,hp:1,max:1,shield:0}));events=events.filter(e=>now-e.shown<2200);
   const info=window.SchoolRaidFX.draw(c,{w:1000,h:ch/cw*1000,now,dt,battle,focus,events,bg,atlas,bars,reduced:ctx.reduced?.()||false,units,received,live,hp:data?.hp});
   const fresh=events.filter(e=>!e.sounded&&e.shown<=now&&now-e.shown<400);for(const e of fresh)e.sounded=true;
   if(now-lastSound>130){const boss=fresh.find(e=>e.kind==='impact'),hit=fresh.findLast(e=>e.team===focus&&['hit','cast'].includes(e.kind));if(boss||hit){ctx.play?.(boss?'critical':hit.id==='osia'&&hit.kind==='cast'?'water':hit.id==='horas'&&hit.skill?'blossom':hit.crit?'critical':'hit',hit?.stage||1);lastSound=now;}}
   canvas.dataset.effects=String(info.effects);canvas.dataset.hurtEffects=String(info.hits);canvas.dataset.draws=String((Number(canvas.dataset.draws)||0)+1);
   const cast=battle?.boss.cast,pattern=R.PATTERNS.find(p=>p.id===cast?.id),label=document.getElementById('raid-warning');
   const warning=live?(pattern?`${pattern.name} · 준비!`:battle.boss.guardUntil>t?'기체 응축 · 마법 피해 40% 감소':'마법 공격만 유효'):'물리 무적 · 마법만 유효';
   if(label.textContent!==warning)label.textContent=warning;label.dataset.warning=String(!!pattern);
   const clock=live?Math.max(0,Math.ceil((90000-t)/1000))+'초':data?.room?.status==='finished'?'전투 종료':`벌룬 · ${data?.cycle||1}차`;
   if(document.getElementById('raid-clock').textContent!==clock)document.getElementById('raid-clock').textContent=clock;
  }
  function open(){stop();data=null;seen=0;renderKey='';events=[];bars.clear();try{pending=JSON.parse(sessionStorage.getItem(key())||'null');}catch{pending=null;}
   ctx.openModal('길드 보스 · 벌룬',`<section id="raid-view"><div class="raid-top"><div><strong>벌룬 <small>HP</small></strong><span id="raid-hp">50,000,000</span><progress id="raid-health" value="50000000" max="50000000"></progress></div><b id="raid-attempts">오늘 5 / 5회</b></div><div class="raid-arena"><canvas id="raid-canvas" aria-label="실시간 길드 보스 전투"></canvas><span id="raid-clock"></span><span id="raid-warning"></span><div id="raid-summary" hidden></div></div><div id="raid-parties"></div><div id="raid-lineup"></div><div id="raid-actions"></div><div id="raid-rewards"></div><p id="raid-message" role="status"></p><details id="raid-rules" hidden open><summary>패턴과 규칙</summary><p>같은 길드 최대 5명 · 각자 현재 6인 편성 · 90초 자동 전투. 시작할 때 계정당 1회 차감, 한국 시간 자정에 5회 충전. 대기실은 무료이며 방장 부재 30초 뒤 다른 단원에게 위임됩니다. 전투방은 길드당 하나입니다.</p><p>마법·치유 용병과 호라스가 마법 피해를 줍니다. 물리 피해는 0이지만 보호막·치유·도발은 유효합니다. 편성은 시작할 때 확정되며, 이후 변경은 다음 전투부터 적용됩니다.</p><p>닫거나 접속을 끊어도 시작한 전투는 자동으로 끝납니다. 피해는 길드 전체에 누적되며, 마법 피해를 준 참가자는 보석 20~80개와 골드 2,080~10,400개를 받습니다. 보상은 한 번만 받을 수 있습니다.</p><div id="raid-ranks"></div>${R.PATTERNS.map(p=>`<p><b>${p.name}</b> · ${p.desc}</p>`).join('')}</details></section>`,'raid');lastFrame=0;raf=requestAnimationFrame(draw);load();}
  return{open,destroy:stop};
 }
 return{create};
})();
