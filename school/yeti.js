/* Two-player winter encounter. Rendering is local; damage, rescue and loot are not. */
window.SchoolYeti=(()=>{
 'use strict';
 const Y=window.SchoolYetiRules,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=n=>Math.round(n||0).toLocaleString('ko-KR');
 const bg=new Image(),atlas=new Image();let loaded=false;
 function assets(){if(loaded)return;loaded=true;bg.src='school/assets/yeti/background.webp?v=yeti1';atlas.src='school/assets/yeti/poses.png?v=yeti1';}
 function create(ctx){
  let data=null,busy=false,polling=false,epoch=0,timer=0,raf=0,pending=null,received=0,lastFrame=0,seen=0,events=[],signature='',lastSound=0,rewardKey='';
  const rescueInput=window.SchoolRescue.create(send),health=window.SchoolCombatFeedback?.createHealthTracker();
  const own=()=>!!document.getElementById('yeti-view')?.closest('dialog')?.open;
  const key=()=>`school-yeti-request:${ctx.scope()}`;
  const message=(text,error=false)=>{const n=document.getElementById('yeti-message');if(n){n.textContent=text;n.dataset.error=String(error);}};
  function remember(body){pending=body;try{body?sessionStorage.setItem(key(),JSON.stringify(body)):sessionStorage.removeItem(key());}catch{}}
  function stop(){rescueInput.destroy();epoch++;clearTimeout(timer);cancelAnimationFrame(raf);polling=false;busy=false;}
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>{if(!own())return;if(document.hidden)schedule();else load();},data?.room?.status==='fighting'?800:2000);}
  function accept(next){
   if(data?.room?.id!==next.room?.id){seen=0;events=[];health?.clear();}
   data=next;received=performance.now();const b=data.room?.battle;
   if(b){for(const e of b.events)if(e.seq>seen&&e.t>=b.elapsed-2200)events.push({...e,shown:received-Math.min(1000,b.elapsed-e.t)+120});seen=b.seq;events=events.slice(-100);}
   const nextKey=(next.rewards||[]).filter(r=>r.claimed).map(r=>r.roomId).sort().join('|');
   if(nextKey&&nextKey!==rewardKey){rewardKey=nextKey;ctx.refreshRewards?.();}
   render();
  }
  async function load(){if(!own()||busy||polling||!ctx.isCloud())return;const ticket=epoch;polling=true;
   try{const next=await ctx.request('/api/school/yeti',{kind:'state',roomId:data?.room?.id});if(ticket===epoch&&own()){accept(next);message('');}}
   catch(e){if(ticket===epoch)message(e.message+' · 다시 연결 중',true);}
   finally{if(ticket===epoch){polling=false;schedule();}}
  }
  async function send(kind,extra={},retry=false){
   if(!own()||busy||ctx.isBlocked())return false;
   if(pending&&!retry){message('이전 요청의 결과를 먼저 확인해 주세요.',true);return false;}
   const body=retry?pending:{kind,requestId:crypto.randomUUID(),roomId:data?.room?.id,...extra};if(!body)return false;
   const ticket=++epoch,storageKey=key();clearTimeout(timer);remember(body);busy=true;controls();message(kind==='thaw'?'동료를 구하고 있어요…':'서버 확인 중…');
   try{const next=await ctx.request('/api/school/yeti',body);try{sessionStorage.removeItem(storageKey);}catch{}if(ticket===epoch&&own()){remember(null);accept(next);message('');return true;}return false;}
   catch(e){if(ticket===epoch){if(e.status&&e.status<500)remember(null);message(e.message,true);}return false;}
   finally{if(ticket===epoch){busy=false;polling=false;signature='';render();schedule();}}
  }
  function controls(){document.querySelectorAll('#yeti-view button,#yeti-view input').forEach(n=>n.disabled=busy||ctx.isBlocked()||n.dataset.unavailable==='true');}
  function render(){if(!own()||!data)return;
   const room=data.room,b=room?.battle,status=room?.status||'empty',me=room?.members.find(m=>m.isMe),myTeam=b?.teams.find(t=>t.isMe),other=b?.teams.find(t=>!t.isMe);
   const frozen=other?.frozen,canRescue=status==='fighting'&&frozen&&!myTeam?.frozen&&!(myTeam?.rescueLockUntil>b.elapsed)&&myTeam?.units.some(u=>u.hp>0)&&other.units.some(u=>u.hp>0);
   document.getElementById('yeti-view').dataset.phase=status;
   const sig=JSON.stringify({id:room?.id,status,members:room?.members,ice:!!myTeam?.frozen,freezeId:frozen?.id,rescue:!!canRescue,lock:myTeam?.rescueLockUntil,outcome:b?.outcome,rewards:data.rewards,pending:!!pending});
   if(sig!==signature){signature=sig;
    const host=me?.host;
    document.getElementById('yeti-members').innerHTML=(room?.members||[]).map(m=>`<div class="yeti-member">${window.SchoolGuild.avatar(m,m.hero)}<span><b>${esc(m.name)}${m.isMe?' · 나':''}</b><small>${m.host?'방장 · ':''}${m.online?'접속 중':'연결 대기'} · ${m.ready?'준비 완료':'준비 중'}</small></span></div>`).join('');
    let actions='';
    if(!room||status==='finished')actions='<button class="primary" data-yeti="create">2인 전투방 만들기</button><form id="yeti-join"><label for="yeti-code">초대 코드</label><input id="yeti-code" maxlength="8" placeholder="8자리 코드" autocomplete="off" autocapitalize="characters"><button class="secondary" type="submit">참가</button></form>';
    else if(status==='lobby')actions=`<div class="yeti-invite"><span>친구에게 전달할 코드 <b>${esc(room.code)}</b></span><button id="yeti-copy" class="secondary">코드 복사</button></div><button class="${me?.ready?'secondary':'primary'}" data-yeti="ready">${me?.ready?'준비 취소':'준비 완료'}</button>${host?`<button class="primary" data-yeti="start" data-unavailable="${room.members.length!==2||!room.members.every(m=>m.ready&&m.online)}">함께 도전</button>`:''}`;
    else actions=`<p class="yeti-rescue-hint">${myTeam?.rescueLockUntil>b.elapsed?'구출 실패 · 내 용병단 15초 정지':myTeam?.frozen?'동료가 얼음을 깨는 중':canRescue?'7초 안에 입력을 완료해 동료를 구하세요':'동료가 얼면 화면에 구출 도전이 나타나요'}</p>`;
    document.getElementById('yeti-actions').innerHTML=actions+(pending?'<button id="yeti-retry" class="secondary">요청 결과 확인</button>':'')+'<button id="yeti-back" class="secondary">'+(status==='fighting'?'도전 포기 · 나가기':'이벤트로 돌아가기')+'</button>';
    document.getElementById('yeti-rewards').innerHTML=(data.rewards||[]).filter(r=>r.claimed).map(r=>`<div class="yeti-reward" role="status">✓ 자동 획득 · ❄ 눈송이 <b>${r.snowflakes}개</b>${r.snowmen?' · ☃ 눈사람 '+r.snowmen+'개':''}</div>`).join('');
    const result=document.getElementById('yeti-result');result.hidden=status!=='finished';
    result.innerHTML=b?.outcome==='defeated'?'<strong>예티 토벌 성공!</strong><span>보상이 자동으로 지급됐어요. 바로 다음 도전을 준비하세요.</span>':`<strong>${status==='finished'?'도전 종료':''}</strong><span>${({timeout:'시간이 끝났어요. 육성과 구출 타이밍을 점검해 보세요.',trapped:'움직일 수 있는 동료가 없어요.',down:'용병단이 쓰러졌어요.',abandoned:'한 단장이 떠나 도전이 종료됐어요.',expired:'대기실이 만료됐어요.'})[b?.outcome||room?.outcome]||'함께 준비하고 다시 도전해 보세요.'}</span>`;
    const toolbar=document.getElementById('yeti-lobby-toolbar');toolbar.hidden=status!=='lobby';
    const invite=document.getElementById('yeti-invite-friends');invite.dataset.unavailable=String(status!=='lobby'||room?.members.length>=2);invite.onclick=()=>ctx.openInvites?.('yeti',room.id);
    document.getElementById('yeti-party-count').textContent=`함께할 단장 ${room?.members.length||0} / 2`;
    document.querySelectorAll('[data-yeti]').forEach(n=>n.onclick=()=>send(n.dataset.yeti));
    document.getElementById('yeti-join')?.addEventListener('submit',e=>{e.preventDefault();send('join',{code:document.getElementById('yeti-code').value.trim().toUpperCase()});});
    const copy=document.getElementById('yeti-copy');if(copy)copy.onclick=async()=>{try{await navigator.clipboard.writeText(room.code);message('초대 코드를 복사했어요.');}catch{message(`초대 코드: ${room.code}`);}};

    const retry=document.getElementById('yeti-retry');if(retry)retry.onclick=()=>send(null,{},true);
    document.getElementById('yeti-back').onclick=async()=>{if(await leave()){stop();ctx.openWinter();}};

   }
   controls();rescueInput.update(data);
  }
  function draw(now){if(!own())return;raf=requestAnimationFrame(draw);if(document.hidden||now-lastFrame<16)return;lastFrame=now;
   const canvas=document.getElementById('yeti-canvas'),rect=canvas?.getBoundingClientRect();if(!rect||rect.width<1||rect.height<1)return;
   const width=Math.min(1440,Math.round(rect.width*Math.min(devicePixelRatio||1,1.5))),height=Math.round(width*rect.height/rect.width);
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
   const c=canvas.getContext('2d');if(!c||c.isContextLost?.())return;c.setTransform(width/1000,0,0,height/560,0,0);c.imageSmoothingEnabled=false;
   c.fillStyle='#142a45';c.fillRect(0,0,1000,560);if(bg.complete&&bg.naturalWidth)c.drawImage(bg,0,0,1000,560);
   const b=data?.room?.battle,live=data?.room?.status==='fighting',time=b?b.elapsed+(live?Math.min(1000,now-received):0):0,reduced=ctx.reduced?.();
   health?.begin(data?.room?.id,now/1000);
   const myIndex=Math.max(0,b?.teams.findIndex(t=>t.isMe)??0);events=events.filter(e=>now-e.shown<2200);
   let winterUntil=0;if(live)for(const team of b?.teams||[])winterUntil=Math.max(winterUntil,window.SchoolArt.spicaFieldUntil(team.units));
   const pos=(ti,i)=>({x:100+(i%3)*132+(i>=3?30:0),y:ti===myIndex?374+(i>=3?76:0):199+(i>=3?76:0)});
   if(b)for(let ti=0;ti<b.teams.length;ti++){
    const team=b.teams[ti];c.fillStyle='#e0f7ff';c.font='bold 15px sans-serif';c.fillText(team.isMe?'나의 용병단':'동료 용병단',55,ti===myIndex?319:159);
    team.units.forEach((u,i)=>{const p=pos(ti,i),hit=events.findLast(e=>e.kind==='hit'&&e.team===ti&&e.id===u.id&&now>=e.shown&&now-e.shown<(u.id==='spica'?850:600)),cast=events.findLast(e=>e.kind==='cast'&&e.team===ti&&e.id===u.id&&now>=e.shown&&now-e.shown<(u.id==='spica'?1600:1300));
     const age=cast?(now-cast.shown)/1000:-1,motion=cast?window.SchoolArt.poseForSkill(u.id,cast.stage||1,age,reduced):null;
     window.SchoolArt.hero(c,u.id,p.x+(motion?.dx||0),p.y+(motion?.dy||0),1.3,{...window.SchoolArt.kazuaFrame(u,time),time:now/1000,reduced,dead:u.hp<=0,frozen:!!team.frozen,stunned:u.stunUntil>time,taunting:u.id==='ryusion'&&window.SchoolRPG.ryusionGuard(team.units,time).taunting,attack:!!hit,attackAge:hit?(now-hit.shown)/1000:undefined,pose:motion?.pose,motion,casting:!!cast,horasBasicPose:u.basicPose||1,horasStacks:u.stacks||0});
     if(live&&u.id==='kazua'&&u.hp>0&&!team.frozen&&!team.withdrawn&&!(u.stunUntil>time))window.SchoolKazuaArt?.effects(c,{source:p,targets:[{x:790,y:350,aimY:240}],mode:u.kazua?.mode||'idle',age:(time-(u.kazua?.modeSince||0))/1000,time:now/1000,scale:1.3,reduced,economy:width<900});
     if(u.id==='spica'&&cast&&u.hp>0&&!team.frozen)window.SchoolArt.spicaSkillEffect?.(c,p,team.units.flatMap((ally,ai)=>ally.hp>0?[pos(ti,ai)]:[]),[{x:790,y:350}],age,reduced,.8);
     const heal=events.findLast(e=>e.kind==='heal'&&e.team===ti&&e.id===u.id&&e.shown<=now),visual=health?.sample(ti+':'+u.id,u.hp,u.max,now/1000,reduced,heal?{time:heal.shown/1000}:null)||{ratio:u.hp/u.max};
     window.SchoolCombatFeedback?.drawHealth(c,{x:p.x,y:p.y+7,width:58,...visual,shield:(u.shield||0)/u.max});
     if(team.frozen&&u.hp>0){c.fillStyle='#a7e5ff66';c.strokeStyle='#c4f4ff';c.lineWidth=2;c.beginPath();c.moveTo(p.x-30,p.y);c.lineTo(p.x-38,p.y-47);c.lineTo(p.x-8,p.y-78);c.lineTo(p.x+28,p.y-58);c.lineTo(p.x+35,p.y);c.closePath();c.fill();c.stroke();}
     else if(u.stunUntil>time&&u.hp>0){c.fillStyle='#fbef99';c.font='18px sans-serif';c.fillText('✦',p.x-8,p.y-63);}
    });
   }
   const impact=events.findLast(e=>e.kind==='impact'&&e.shown<=now&&now-e.shown<900),cast=b?.boss.cast;
   const pattern=impact?.pattern||cast?.id;let pose=b?.boss.hp===0?5:impact?({freeze:3,slam:2,charge:4,blizzard:3,claw:2,guard:1})[pattern]||2:cast?1:0;
   const anchors=[424,424,423,408,407,405],scale=.74,bx=790-(impact?.pattern==='charge'&&!reduced?Math.sin((now-impact.shown)/900*Math.PI)*90:0),by=450;
   const bossHit=events.findLast(e=>e.kind==='hit'&&e.amount>0&&e.shown<=now&&now-e.shown<200);
   if(atlas.complete&&atlas.naturalWidth)window.SchoolArt.hitSprite(c,atlas,[(pose%3)*512,Math.floor(pose/3)*512,512,512,bx-256*scale,by-anchors[pose]*scale,512*scale,512*scale],bossHit?(now-bossHit.shown)/1000:1);
   else{c.fillStyle='#c4edff';c.beginPath();c.ellipse(bx,by-100,100,110,0,0,Math.PI*2);c.fill();}
   if(live)window.SchoolArt.spicaBlizzard(c,{x:0,y:86,width:1000,height:474},time,winterUntil,reduced,width<900);
   for(const e of events){const age=(now-e.shown)/1000;if(age<0||age>1.5)continue;
    c.save();c.globalAlpha=Math.max(0,1-age/1.5);
    if(['hit','heal','hurt','shield'].includes(e.kind)){
     const ti=e.team||0,i=b?.teams[ti]?.units.findIndex(u=>u.id===e.id),p=e.kind==='hit'?{x:bx-50+(e.seq%5)*18,y:by-180}:pos(ti,Math.max(0,i));
     const word=(e.kind==='heal'?'+':e.kind==='hurt'?'-':e.kind==='shield'?'방어 ':'')+fmt(e.amount),color=e.kind==='heal'?'#a9ffd0':e.kind==='shield'?'#a9ddff':e.kind==='hurt'?'#ffa0af':e.crit?'#ffe898':'#fff8e9';
     window.SchoolArt.combatNumber(c,word,p.x+((e.seq%3)-1)*12,p.y-40-age*45,e.crit?29:23,color,!!e.crit);
     if(e.kind==='hit'&&age<.28){c.strokeStyle=e.id==='horas'?'#ffb4e7':'#b6eeff';c.lineWidth=3;c.beginPath();c.moveTo(p.x-15,p.y-20);c.lineTo(p.x+18,p.y+10);c.moveTo(p.x+15,p.y-20);c.lineTo(p.x-18,p.y+10);c.stroke();}
    }else if(e.kind==='impact'){
     c.strokeStyle='#a8eeff';c.lineWidth=5;for(let k=0;k<3;k++){c.beginPath();c.ellipse(480,430,100+age*260+k*35,20+age*20,0,0,Math.PI*2);c.stroke();}
    }else if(e.kind==='thaw'){
     c.strokeStyle='#d2fcff';c.lineWidth=4;const y=e.team===myIndex?400:240;c.beginPath();c.arc(260,y,40+age*130,0,Math.PI*2);c.stroke();
    }
    c.restore();
   }
   if(!reduced&&winterUntil<=time){c.fillStyle='#d9f6ff88';for(let i=0;i<25;i++){const x=(i*173+now*.015)%1000,y=(i*67+now*.026)%560;c.fillRect(x,y,3,3);}}
   const maximum=b?.boss.max||data?.rules?.hp||Y.HP,hp=b?.boss.hp??maximum;c.fillStyle='#0b1d33cc';c.fillRect(260,26,480,40);c.fillStyle='#8ce0f4';c.fillRect(266,56,468*hp/maximum,4);c.fillStyle='#effbff';c.textAlign='center';c.font='bold 18px sans-serif';c.fillText(`만년설 예티 · ${fmt(hp)} / ${fmt(maximum)}`,500,48);c.textAlign='start';
   const warning=document.getElementById('yeti-warning'),label=b?.teams[myIndex]?.rescueLockUntil>time?`구출 실패 · 내 용병단 ${Math.ceil((b.teams[myIndex].rescueLockUntil-time)/1000)}초 정지`:cast?Y.PATTERNS.find(p=>p.id===cast.id)?.name:live?'동료가 얼면 7초 구출 도전!':'두 단장이 함께하는 겨울 토벌';if(warning.textContent!==label)warning.textContent=label;
   document.getElementById('yeti-clock').textContent=live?`${Math.max(0,Math.ceil(((b?.yetiRules?.duration||(b?150000:data?.rules?.duration||Y.DURATION))-time)/1000))}초`:'어려움 · 권장 Lv.70 이상';
   if(now-lastSound>150){const sound=events.findLast(e=>!e.sounded&&e.shown<=now&&now-e.shown<300&&['impact','thaw','hit'].includes(e.kind));if(sound){ctx.play?.(sound.kind==='thaw'?'reward':sound.kind==='impact'?'critical':'hit');lastSound=now;}for(const e of events)if(e.shown<=now)e.sounded=true;}
  }
  function open(){stop();assets();data=null;signature='';events=[];seen=0;try{pending=JSON.parse(sessionStorage.getItem(key())||'null');}catch{pending=null;}
   if(!ctx.isCloud()){ctx.openModal('예티 협동 토벌','<div class="yeti-login"><h3>친구와 함께 만년설 예티에 도전!</h3><p>Google 계정으로 로그인하면 2인 전투방을 만들 수 있어요.</p><button id="yeti-login" class="primary">계정 연결</button></div>','yeti');document.getElementById('yeti-login').onclick=ctx.openAccount;return;}
   ctx.openModal('겨울 협동전 · 만년설 예티',`<section id="yeti-view"><div id="yeti-lobby-toolbar" hidden><strong id="yeti-party-count"></strong><button id="yeti-invite-friends" class="primary">＋ 친구·길드원 초대</button></div><div class="yeti-arena"><canvas id="yeti-canvas" aria-label="두 용병단과 예티의 실시간 협동 전투"></canvas><span id="yeti-clock"></span><span id="yeti-warning"></span><div id="yeti-result" hidden></div></div><div id="yeti-members"></div><div id="yeti-actions"></div><div id="yeti-rewards"></div><p id="yeti-message" role="status">전투방을 확인 중이에요…</p><details class="yeti-rules"><summary>구출 방법과 보상</summary><p>2명 모두 준비하면 방장이 시작해요. 권장 Lv.70 이상, 탱커와 힐러를 포함한 6인 편성을 추천해요. 새 도전은 210초이며 횟수 제한은 없어요. 예티는 물리·마법 공격 모두 유효해요.</p><p>한쪽 용병단이 얼면 다른 단장이 ‘얼음땡’을 눌러 구해 주세요. 자기 얼음은 풀 수 없어요. 방치하면 동상 피해를 받아요.</p><p>처치하면 각자 눈송이 20~50개와 룰렛용 눈사람 1개를 받아요. 실패하거나 중간에 나가면 보상이 없어요. 나가기는 두 사람의 도전을 종료해요. 접속이 끊겼다면 같은 계정으로 돌아와 이어할 수 있어요.</p></details></section>`,'yeti');raf=requestAnimationFrame(draw);load();
  }
  async function leave(){if(!own())return true;if(busy)return false;if(pending){await send(null,{},true);if(pending)return false;}return data?.room&&data.room.status!=='finished'?!!await send('leave'):true;}
  return {open,leave,destroy:stop,canInvite:id=>own()&&data?.room?.id===id&&data.room.status==='lobby'&&data.room.members.length<2};
 }
 return {create};
})();
