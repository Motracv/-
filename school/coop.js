/* A small foreground inbox. It never touches the combat loop or wallet sync. */
window.SchoolCoop=(()=>{
 'use strict';const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function create(ctx){
  let epoch=0,scope='',timer=0,polling=false,pending=false,stopped=false,incoming=[],node=null,markup='',picker=null;
  const seen=new Set(),removed=new Set();
  const title=mode=>mode==='yeti'?'예티 협동 토벌':'길드 보스 · 벌룬';
  function schedule(delay=2500){clearTimeout(timer);if(!stopped)timer=setTimeout(poll,delay);}
  function hide(){if(node){try{node.hidePopover?.();}catch{}node.remove();node=null;}markup='';}
  function reset(){epoch++;scope=ctx.scope();incoming=[];pending=false;polling=false;picker=null;seen.clear();removed.clear();hide();schedule(0);}
  function render(){
   incoming=incoming.filter(i=>i.expiresAt>ctx.now()&&!removed.has(i.id));
   if(document.hidden||!ctx.isCloud()||!incoming.length){hide();return;}
   if(!node){node=document.createElement('aside');node.id='coop-inbox';node.setAttribute('popover','manual');node.setAttribute('aria-label','받은 협동전 초대');node.setAttribute('aria-live','polite');document.body.append(node);node.addEventListener('click',e=>{const b=e.target.closest('[data-coop-reply]');if(b&&!b.disabled)reply(b.dataset.coopReply);});}
   const invite=incoming[0],blocked=pending||ctx.blocked(),busyRoom=ctx.inEncounter();
   const next=`<div class="coop-inbox-top"><span>함께 도전해요</span><small><span data-coop-clock></span>${incoming.length>1?' · 초대 '+incoming.length+'개':''}</small></div><div class="coop-inbox-person">${window.SchoolGuild.avatar(invite,invite.hero)}<div><b>${esc(invite.name)}</b><span>${title(invite.mode)} 초대</span></div></div><div class="coop-reply"><button data-coop-reply="decline">거절</button><button class="coop-accept" data-coop-reply="accept">수락 · 입장</button></div>${busyRoom?'<p>현재 전투방에서 나온 뒤 수락할 수 있어요.</p>':''}`;
   if(next!==markup){const focus=node.contains(document.activeElement)?document.activeElement?.dataset.coopReply:null;node.innerHTML=next;markup=next;if(focus)node.querySelector(`[data-coop-reply="${focus}"]`)?.focus({preventScroll:true});}
   node.querySelector('[data-coop-clock]').textContent=Math.max(0,Math.ceil((invite.expiresAt-ctx.now())/1000))+'초 남음';
   const accept=node.querySelector('[data-coop-reply="accept"]');accept.disabled=blocked||busyRoom;accept.textContent=pending?'확인 중…':'수락 · 입장';node.querySelector('[data-coop-reply="decline"]').disabled=blocked;
   if(node.showPopover){try{if(!node.matches(':popover-open'))node.showPopover();}catch{}}
   else{const host=document.querySelector('dialog[open]')||document.body;if(node.parentNode!==host)host.append(node);}
  }
  async function reply(kind){
   const invite=incoming[0];if(!invite||pending||ctx.blocked()||(kind==='accept'&&ctx.inEncounter()))return;
   const ticket=epoch,account=scope;pending=true;render();
   try{const result=await ctx.request('/api/school/coop',{kind,inviteId:invite.id});if(ticket!==epoch||account!==ctx.scope())return;
    removed.add(invite.id);if(removed.size>100)removed.delete(removed.values().next().value);incoming=incoming.filter(i=>i.id!==invite.id);render();
    if(kind==='accept'&&result.joined)ctx.openEncounter(result.mode);else ctx.toast('초대를 거절했어요.');
   }catch(e){if(ticket===epoch){ctx.toast(e.message);if([403,404,410].includes(e.status)){removed.add(invite.id);incoming=incoming.filter(i=>i.id!==invite.id);}}}
   finally{if(ticket===epoch){pending=false;render();schedule(0);}}
  }
  async function poll(){
   if(stopped)return;if(scope!==ctx.scope())reset();
   if(document.hidden||!ctx.isCloud()){hide();schedule(2500);return;}
   if(polling){schedule();return;}const ticket=epoch;polling=true;
   try{const result=await ctx.request('/api/school/coop',{kind:'state'});if(ticket!==epoch||scope!==ctx.scope())return;
    incoming=result.incoming||[];let fresh=false;for(const i of incoming)if(!seen.has(i.id)){seen.add(i.id);fresh=true;}if(seen.size>100){seen.clear();for(const i of incoming)seen.add(i.id);}
    if(fresh)ctx.play?.('tap');render();
    if(picker&&!picker.busy&&!picker.container.hidden&&Date.now()-picker.at>10000)loadPicker(picker);
   }catch{ /* A lost inbox poll does not pause or disconnect the game. */ }
   finally{if(ticket===epoch){polling=false;render();schedule();}}
  }
  function pickerValid(p){return picker===p&&p.scope===ctx.scope()&&p.container.isConnected&&p.container.closest('[data-phase]')?.dataset.phase==='lobby';}
  async function loadPicker(p){
   if(!pickerValid(p)||p.busy)return;p.busy=true;p.at=Date.now();
   try{const result=await ctx.request('/api/school/coop',{kind:'candidates',mode:p.mode,roomId:p.roomId});if(!pickerValid(p))return;
    p.container.innerHTML=`<header><b>${p.mode==='yeti'?'친구·길드원 초대':'길드원 초대'}</b><button data-coop-hide aria-label="초대 목록 닫기">×</button></header><p>상대 화면에 2분 동안 수락 알림이 표시돼요.</p><div class="coop-contacts">${result.candidates.map(c=>`<div class="coop-contact">${window.SchoolGuild.avatar(c,c.hero)}<span><b>${esc(c.name)}</b><small><i class="${c.online?'online':''}"></i>${c.online?'접속 중':'오프라인'}${c.guildmate?' · 길드원':' · 친구'}</small></span><button data-coop-target="${esc(c.id)}" data-unavailable="${c.invitedUntil>ctx.now()}" ${c.invitedUntil>ctx.now()?'disabled':''}>${c.invitedUntil>ctx.now()?'초대 보냄':'초대'}</button></div>`).join('')||'<p class="coop-empty">초대할 단장이 없어요. 친구를 추가하거나 길드에 가입해 보세요.</p>'}</div><p class="coop-picker-message" role="status"></p>`;
    p.container.querySelector('[data-coop-hide]').onclick=()=>p.container.hidden=true;
    p.container.querySelectorAll('[data-coop-target]').forEach(b=>b.onclick=async()=>{
     if(p.busy||ctx.blocked()||!pickerValid(p))return;p.busy=true;b.disabled=true;b.dataset.unavailable='true';const line=p.container.querySelector('.coop-picker-message');
     const requestId=crypto.randomUUID();
     try{await ctx.request('/api/school/coop',{kind:'invite',mode:p.mode,roomId:p.roomId,targetId:b.dataset.coopTarget,requestId});if(pickerValid(p)){b.textContent='초대 보냄';line.textContent='초대를 보냈어요. 상대의 수락을 기다려 주세요.';}}
     catch(e){if(pickerValid(p)){line.textContent=e.message;b.disabled=false;b.dataset.unavailable='false';}}
     finally{p.busy=false;}
    });
   }catch(e){if(pickerValid(p))p.container.textContent=e.message;}
   finally{p.busy=false;}
  }
  function openPicker(mode,roomId,container){if(!container)return;container.hidden=false;container.textContent='초대할 단장을 불러오는 중…';picker={mode,roomId,container,scope:ctx.scope(),busy:false,at:0};loadPicker(picker);}
  const visibility=()=>{if(document.hidden)hide();else schedule(0);};document.addEventListener('visibilitychange',visibility);scope=ctx.scope();schedule(0);
  return {openPicker,reset,refresh:render,destroy(){stopped=true;epoch++;clearTimeout(timer);hide();document.removeEventListener('visibilitychange',visibility);}};
 }
 return {create};
})();
