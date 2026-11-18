/* Account-owned guild UI. Server owns membership, permissions and attendance. */
window.SchoolGuild=(()=>{
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels=['용기의 방패','별빛의 약속','지혜의 서고'];
 const crest=(n,cls='')=>`<span class="guild-crest ${cls}" data-emblem="${Number(n)||0}" aria-hidden="true"></span>`;
 function avatar(p,hero='taeo',cls=''){const i=window.SchoolRPG.PROFILE_AVATARS.indexOf(p?.avatar);return i<0?`<img class="profile-avatar ${cls}" src="${esc(window.SchoolArt.portrait(hero))}" alt="">`:`<span class="profile-avatar painted-avatar ${cls}" data-avatar="${i}" aria-hidden="true"></span>`;}
 const title=p=>p?.title==='beta'?'<span class="beta-title"><i aria-hidden="true">✦</i> 베타테스터 <i aria-hidden="true">✦</i></span>':'';
 function create(ctx){
  let data=null,busy=false,epoch=0,timer=null,tab='room',pending=null,stopped=false;
  const root=()=>document.querySelector('#guild-view'),own=()=>!stopped&&!!root()?.closest('dialog')?.open;
  const key=()=>`school-guild-pending:${ctx.scope()}`;
  const remember=p=>{pending=p;try{if(p)sessionStorage.setItem(key(),JSON.stringify(p));else sessionStorage.removeItem(key());}catch{}};
  const message=(s,error=false)=>{const node=document.getElementById('guild-message');if(node){node.textContent=s;node.dataset.error=String(error);}};
  const requestId=()=>crypto.randomUUID?.()||'guild-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  function frame(){ctx.openModal('길드',`<section id="guild-view"><div id="guild-body"></div><p id="guild-message" role="status" aria-live="polite"></p></section>`,'guild');}
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>{if(!own())return;if(!document.hidden&&!busy&&!root().querySelector('input:focus,textarea:focus,details[open]'))load(false);else schedule();},15000);}
  async function load(manual=true){if(!own()||busy)return;const ticket=epoch;busy=true;lock();try{const next=await ctx.request('/api/school/guild',{kind:'state'});if(ticket!==epoch||!own())return;const different=JSON.stringify(next.guild)!==JSON.stringify(data?.guild)||JSON.stringify(next.invites)!==JSON.stringify(data?.invites)||!data;data=next;if(manual||different)render();}catch(e){if(ticket===epoch&&own())message(e.message,true);}finally{if(ticket===epoch){busy=false;lock();schedule();}}}
  function lock(){root()?.querySelectorAll('button,input,textarea').forEach(n=>{if(n.dataset.staticDisabled!=='true')n.disabled=busy||ctx.isBlocked();});}
  async function send(input,retry=false){if(!own()||busy||ctx.isBlocked())return;const ticket=epoch;
   if(pending&&!retry){message('이전 요청 결과를 먼저 확인해 주세요.',true);return;}
   const payload=retry?pending:{...input,requestId:requestId()};if(!payload)return;remember(payload);busy=true;lock();message('저장 중…');
   try{const next=await ctx.request('/api/school/guild',payload);if(ticket!==epoch||!own())return;remember(null);data=next;render();message('길드 정보를 저장했어요.');}
   catch(e){if(ticket!==epoch||!own())return;if(e.status&&e.status<500){remember(null);message(e.message,true);}else{message('연결을 확인한 뒤 같은 요청으로 다시 시도해 주세요.',true);document.getElementById('guild-retry')?.remove();const b=document.createElement('button');b.id='guild-retry';b.className='secondary';b.textContent='결과 다시 확인';b.onclick=()=>send(null,true);root().append(b);}}
   finally{if(ticket===epoch){busy=false;lock();schedule();}}
  }
  function roster(g){return `<div class="guild-members">${g.members.map(m=>`<article class="guild-member">${avatar(m,m.hero)}<div class="guild-person"><b>${esc(m.name)}${m.isMe?' <small>나</small>':''}</b>${title(m)}<small>${m.role==='leader'?'♛ 길드장 · ':''}Lv.${m.level} · 전투력 ${m.power.toLocaleString('ko-KR')}</small></div>${g.role==='leader'&&!m.isMe?`<details class="guild-member-menu"><summary aria-label="${esc(m.name)} 관리">⋯</summary><button data-guild-kick="${esc(m.id)}">강퇴</button><button data-guild-transfer="${esc(m.id)}">길드장 위임</button></details>`:''}</article>`).join('')}</div>`;}
  function emblems(selected){return `<div class="guild-emblems" role="group" aria-label="길드 문장 선택">${labels.map((n,i)=>`<button type="button" data-guild-emblem="${i}" aria-pressed="${selected===i}" title="${n}">${crest(i)}<span>${n}</span></button>`).join('')}</div>`;}
  function render(){
   if(!own()||!data)return;const g=data.guild,body=document.getElementById('guild-body');
   if(!g){body.innerHTML=`<div class="guild-welcome"><span class="guild-welcome-flag">⚑</span><div><h3>우리만의 반을 만들어요</h3><p>이름을 정하고 친구들과 함께할 교실을 열어요.</p></div></div>${data.canName?'<button id="guild-name-first" class="primary">먼저 단장 이름 정하기</button>':`<form id="guild-create"><label for="guild-name">길드 이름</label><input id="guild-name" minlength="3" maxlength="32" placeholder="3~16글자 · 중복 불가" required autocomplete="off">${emblems(0)}<button class="primary" type="submit">길드 만들기 · 무료</button><small>최대 30명 · 계정당 한 길드</small></form>`}<section class="guild-invites"><h3>받은 초대 <small>${data.invites.length}</small></h3>${data.invites.map(i=>`<article class="guild-invite">${crest(i.emblem)}<div><b>${esc(i.name)}</b><small>${i.size} / 30명</small></div><button class="primary" data-guild-accept="${esc(i.id)}">가입</button><button class="secondary" data-guild-decline="${esc(i.id)}">거절</button></article>`).join('')||'<p class="guild-empty">길드장에게 내 단장 이름을 알려주면 초대를 받을 수 있어요.</p>'}</section><button class="secondary guild-refresh">초대 새로고침</button>`;
   }else{
    body.innerHTML=`<header class="guild-heading">${crest(g.emblem)}<div><h3>${esc(g.name)}</h3><span>${g.members.length} / 30명 · ${g.role==='leader'?'길드장':'단원'}</span></div><button class="secondary guild-refresh" aria-label="길드 새로고침">↻</button></header><nav class="guild-tabs" aria-label="길드 메뉴">${[['room','교실'],['members','단원'],['manage',g.role==='leader'?'관리':'내 길드']].map(([id,label])=>`<button data-guild-tab="${id}" aria-pressed="${tab===id}">${label}</button>`).join('')}</nav><div id="guild-tab-body"></div>`;
    const pane=document.getElementById('guild-tab-body');
    if(tab==='room'){const a=g.attendance;pane.innerHTML=`<div class="guild-room" data-emblem="${g.emblem}"><div class="guild-chalkboard">${crest(g.emblem)}<strong>${esc(g.name)}</strong><small>${esc(g.notice)||'오늘도 함께하는 우리 반'}</small></div><div class="guild-classmates">${g.members.slice(0,6).map(m=>`<div>${avatar(m,m.hero)}<small>${esc(m.name)}</small></div>`).join('')}</div></div><div class="guild-attendance"><div><b>오늘의 출석</b><small>${a.claimed?'오늘도 만나서 반가워요!':a.eligible?'매일 한국 시간 자정에 갱신':'가입 다음 한국 날짜부터 참여'}</small></div><button id="guild-checkin" class="primary" ${a.claimed||!a.eligible?'disabled data-static-disabled="true"':''}>${a.claimed?'출석 완료':'◆ 30 받기'}</button></div><div class="guild-boss-soon"><span aria-hidden="true">♜</span><div><b>길드 보스전</b><small>추후 개방</small></div><span aria-label="잠김">🔒</span></div>`;}
    else if(tab==='members'){pane.innerHTML=`${g.role==='leader'?'<form id="guild-invite-form"><label for="guild-invite-name">단장 이름으로 초대</label><div><input id="guild-invite-name" maxlength="24" autocomplete="off" placeholder="정확한 단장 이름" required><button class="primary">초대</button></div></form>':''}${roster(g)}${g.role==='leader'&&g.outgoing.length?`<details class="guild-pending"><summary>대기 중인 초대 ${g.outgoing.length}</summary>${g.outgoing.map(i=>`<div><b>${esc(i.name)}</b><button class="secondary" data-guild-revoke="${esc(i.id)}">취소</button></div>`).join('')}</details>`:''}`;}
    else pane.innerHTML=`${g.role==='leader'?`<form id="guild-decorate"><label>길드 문장</label>${emblems(g.emblem)}<label for="guild-notice">칠판 공지</label><input id="guild-notice" maxlength="160" value="${esc(g.notice)}" placeholder="우리 반에게 전할 말"><button class="primary">교실 꾸미기 저장</button></form><p class="guild-empty">길드장 위임은 단원 탭의 ⋯ 메뉴에서 할 수 있어요.</p><button class="guild-danger secondary" id="guild-disband">길드 해산</button>`:'<p class="guild-empty">길드를 나가도 용병과 장비, 받은 출석 보상은 유지돼요.</p><button class="guild-danger secondary" id="guild-leave">길드 탈퇴</button>'}`;
   }
   bind();if(pending){message('아직 확인하지 못한 요청이 있어요.');const b=document.createElement('button');b.id='guild-retry';b.className='secondary';b.textContent='결과 다시 확인';b.onclick=()=>send(null,true);body.append(b);}lock();
  }
  function bind(){
   root().querySelectorAll('[data-guild-emblem]').forEach(b=>b.onclick=()=>root().querySelectorAll('[data-guild-emblem]').forEach(n=>n.setAttribute('aria-pressed',String(n===b))));
   root().querySelectorAll('[data-guild-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.guildTab;render();});
   root().querySelectorAll('.guild-refresh').forEach(b=>b.onclick=()=>load());
   const selected=()=>Number(root().querySelector('[data-guild-emblem][aria-pressed=true]')?.dataset.guildEmblem||0),form=(id,fn)=>{const n=document.getElementById(id);if(n)n.onsubmit=e=>{e.preventDefault();fn();};};
   form('guild-create',()=>send({kind:'create',name:document.getElementById('guild-name').value,emblem:selected()}));
   form('guild-invite-form',()=>send({kind:'invite',guildId:data.guild.id,name:document.getElementById('guild-invite-name').value}));
   form('guild-decorate',()=>send({kind:'decorate',guildId:data.guild.id,emblem:selected(),notice:document.getElementById('guild-notice').value}));
   for(const kind of ['accept','decline','revoke'])root().querySelectorAll(`[data-guild-${kind}]`).forEach(b=>b.onclick=()=>send({kind,inviteId:b.getAttribute(`data-guild-${kind}`),guildId:data.guild?.id}));
   for(const kind of ['kick','transfer'])root().querySelectorAll(`[data-guild-${kind}]`).forEach(b=>b.onclick=()=>{const m=data.guild.members.find(m=>m.id===b.getAttribute(`data-guild-${kind}`));if(m&&confirm(kind==='kick'?`${m.name} 단원을 강퇴할까요?`:`${m.name} 단원에게 길드장을 위임할까요?`))send({kind,guildId:data.guild.id,memberId:m.id,memberKey:m.memberKey});});
   for(const kind of ['leave','disband']){const b=document.getElementById('guild-'+kind);if(b)b.onclick=()=>{if(confirm(kind==='leave'?'길드에서 탈퇴할까요?':'길드를 해산하면 모든 단원과 초대가 해제됩니다. 해산할까요?'))send({kind,guildId:data.guild.id});};}
   const check=document.getElementById('guild-checkin');if(check)check.onclick=async()=>{if(busy||ctx.isBlocked())return;check.disabled=true;await ctx.dispatch({kind:'guild-checkin',guildId:data.guild.id});if(own())load();};
   const name=document.getElementById('guild-name-first');if(name)name.onclick=ctx.openCaptain;
  }
  function open(){clearTimeout(timer);epoch++;busy=false;stopped=false;data=null;tab='room';pending=null;try{pending=JSON.parse(sessionStorage.getItem(key())||'null');}catch{}frame();if(!ctx.isCloud()){document.getElementById('guild-body').innerHTML='<div class="guild-login"><span>⚑</span><h3>함께하는 용병단</h3><p>Google 계정으로 로그인하고 같은 반 친구들을 만나 보세요.</p><button class="primary" id="guild-login">계정 연결</button></div>';document.getElementById('guild-login').onclick=ctx.openAccount;return;}document.getElementById('guild-body').innerHTML='<p class="guild-empty">교실을 불러오는 중…</p>';load();}
  return{open,refresh:()=>{if(own())load();},destroy(){epoch++;stopped=true;clearTimeout(timer);data=null;pending=null;}};
 }
 return{create,avatar,title,crest};
})();
