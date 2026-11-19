/* A small foreground inbox. It never touches the combat loop or wallet sync. */
window.SchoolCoop=(()=>{
 'use strict';const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function create(ctx){
  let epoch=0,scope='',timer=0,polling=false,pending=false,stopped=false,incoming=[],node=null,markup='',picker=null,clientId=crypto.randomUUID();
  const seen=new Set(),removed=new Set();
  const title=mode=>mode==='yeti'?'예티 협동 토벌':'길드 보스 · 벌룬';
  function schedule(delay=2500){clearTimeout(timer);if(!stopped)timer=setTimeout(poll,delay);}
  function hide(){if(node){try{node.hidePopover?.();}catch{}node.remove();node=null;}markup='';}
  function reset(){closePicker();epoch++;clientId=crypto.randomUUID();scope=ctx.scope();incoming=[];pending=false;polling=false;seen.clear();removed.clear();hide();schedule(0);}
  function render(){
   if(picker&&!pickerValid(picker))closePicker();
   if(picker&&(!ctx.isCloud()||picker.checkedAt&&Date.now()-picker.checkedAt>15000))unknown(picker);
   incoming=incoming.filter(i=>i.expiresAt>ctx.now()&&!removed.has(i.id));
   if(document.hidden||!ctx.isCloud()||!incoming.length){hide();return;}
   if(!node){node=document.createElement('aside');node.id='coop-inbox';node.setAttribute('popover','manual');node.setAttribute('aria-label','받은 협동전 초대');node.setAttribute('aria-live','polite');document.body.append(node);node.addEventListener('click',e=>{const b=e.target.closest('[data-coop-reply]');if(b&&!b.disabled)reply(b.dataset.coopReply);});}
   const invite=incoming[0],blocked=pending||ctx.blocked(),busyRoom=ctx.inEncounter();
   const next=`<div class="coop-inbox-top"><span>함께 도전해요</span><small><span data-coop-clock></span>${incoming.length>1?' · 초대 '+incoming.length+'개':''}</small></div><div class="coop-inbox-person">${window.SchoolGuild.avatar(invite,invite.hero)}<div><b>${esc(invite.name)}</b><span>${title(invite.mode)} 초대</span></div></div><div class="coop-reply"><button data-coop-reply="decline">거절</button><button class="coop-accept" data-coop-reply="accept">수락 · 입장</button></div>${busyRoom?'<p>현재 전투방에서 나온 뒤 수락할 수 있어요.</p>':''}`;
   if(next!==markup){const focus=node.contains(document.activeElement)?document.activeElement?.dataset.coopReply:null;node.innerHTML=next;markup=next;if(focus)node.querySelector(`[data-coop-reply="${focus}"]`)?.focus({preventScroll:true});}
   node.querySelector('[data-coop-clock]').textContent=Math.max(0,Math.ceil((invite.expiresAt-ctx.now())/1000))+'초 남음';
   const accept=node.querySelector('[data-coop-reply="accept"]');accept.disabled=blocked||busyRoom;accept.textContent=pending?'확인 중…':'수락 · 입장';node.querySelector('[data-coop-reply="decline"]').disabled=blocked;
   const dialogs=[...document.querySelectorAll('dialog[open]')],host=dialogs.at(-1)||document.body;
   if(node.parentNode!==host){try{node.hidePopover?.();}catch{}host.append(node);}
   if(node.showPopover){try{if(!node.matches(':popover-open'))node.showPopover();}catch{}}
  }
  async function reply(kind){
   const invite=incoming[0];if(!invite||pending||ctx.blocked()||(kind==='accept'&&ctx.inEncounter()))return;
   const ticket=epoch,account=scope;pending=true;render();
   try{const result=await ctx.request('/api/school/coop',{kind,inviteId:invite.id,clientId});if(ticket!==epoch||account!==ctx.scope())return;
    removed.add(invite.id);if(removed.size>100)removed.delete(removed.values().next().value);incoming=incoming.filter(i=>i.id!==invite.id);render();
    if(kind==='accept'&&result.joined)ctx.openEncounter(result.mode);else ctx.toast('초대를 거절했어요.');
   }catch(e){if(ticket===epoch){ctx.toast(e.message);if([403,404,409,410].includes(e.status)){removed.add(invite.id);incoming=incoming.filter(i=>i.id!==invite.id);}}}
   finally{if(ticket===epoch){pending=false;render();schedule(0);}}
  }
  async function poll(){
   if(stopped)return;if(scope!==ctx.scope())reset();
   if(document.hidden||!ctx.isCloud()){hide();schedule(2500);return;}
   if(polling){schedule();return;}const ticket=epoch,pollClient=clientId;polling=true;
   try{const result=await ctx.request('/api/school/coop',{kind:'state',clientId:pollClient});if(ticket!==epoch||scope!==ctx.scope())return;
    if(document.hidden||pollClient!==clientId){depart(pollClient);return;}
    incoming=result.incoming||[];let fresh=false;for(const i of incoming)if(!seen.has(i.id)){seen.add(i.id);fresh=true;}if(seen.size>100){seen.clear();for(const i of incoming)seen.add(i.id);}
    if(fresh)ctx.play?.('tap');render();
    if(picker)loadPicker(picker);
   }catch{if(picker)unknown(picker); /* A lost inbox poll does not pause combat. */ }
   finally{if(ticket===epoch){polling=false;render();schedule();}}
  }
  function pickerValid(p){return picker===p&&p.scope===ctx.scope()&&p.dialog.isConnected&&p.dialog.open&&ctx.isLobby(p.mode,p.roomId);}
  function closePicker(){
   const p=picker;if(!p)return false;picker=null;p.dialog.close();p.dialog.remove();if(p.focus?.isConnected)p.focus.focus({preventScroll:true});render();return true;
  }
  function pickerStatus(p,text){if(picker===p)p.dialog.querySelector('.coop-picker-message').textContent=text;}
  function unknown(p){
   if(picker!==p)return;p.dialog.querySelector('[data-coop-connection]').textContent='연결 확인 중 · 접속 상태를 다시 확인하고 있어요.';
   p.dialog.querySelectorAll('[data-coop-status]').forEach(n=>n.textContent='접속 상태 확인 중');p.dialog.querySelectorAll('[data-coop-person]').forEach(n=>n.dataset.online='unknown');
  }
  function renderCandidates(p,candidates){
   p.checkedAt=Date.now();
   const list=p.dialog.querySelector('.coop-contacts'),key=JSON.stringify(candidates.map(c=>[c.id,c.name,c.hero,c.avatar,c.profileAvatar,c.guildmate]));
   if(key!==p.key){
    const focus=list.contains(document.activeElement)?document.activeElement?.dataset.coopTarget:null;
    list.innerHTML=candidates.map(c=>`<div class="coop-contact" data-coop-person="${esc(c.id)}">${window.SchoolGuild.avatar(c,c.hero)}<span><b>${esc(c.name)}</b><small data-coop-status></small></span><button data-coop-target="${esc(c.id)}">초대</button></div>`).join('')||'<p class="coop-empty">초대할 단장이 없어요. 친구를 추가하거나 길드에 가입해 보세요.</p>';
    p.key=key;list.querySelectorAll('[data-coop-target]').forEach(b=>b.onclick=()=>sendInvite(p,b));
    if(focus)[...list.querySelectorAll('[data-coop-target]')].find(b=>b.dataset.coopTarget===focus)?.focus({preventScroll:true});
   }
   const byId=new Map(candidates.map(c=>[c.id,c]));
   list.querySelectorAll('[data-coop-person]').forEach(row=>{
    const c=byId.get(row.dataset.coopPerson),b=row.querySelector('[data-coop-target]'),sent=Math.max(c.invitedUntil||0,p.sent.get(c.id)||0)>ctx.now(),sending=p.sending.has(c.id);
    row.querySelector('[data-coop-status]').textContent=(c.online?'● 온라인':'○ 오프라인')+(c.guildmate?' · 길드원':' · 친구');row.dataset.online=String(c.online);
    b.disabled=sent||sending||ctx.blocked();b.textContent=sending?'보내는 중…':sent?'초대 보냄':'초대';
   });
   p.dialog.querySelector('[data-coop-connection]').textContent='접속 상태 자동 갱신 · 초대는 2분 동안 유효해요.';
  }
  async function sendInvite(p,b){
   const target=b.dataset.coopTarget;if(!pickerValid(p)||ctx.blocked()||b.disabled||p.sending.has(target))return;
   p.sending.add(target);b.disabled=true;b.textContent='보내는 중…';const requestId=p.requests.get(target)||crypto.randomUUID();p.requests.set(target,requestId);
   try{
    const result=await ctx.request('/api/school/coop',{kind:'invite',mode:p.mode,roomId:p.roomId,targetId:target,requestId});
    if(pickerValid(p)){p.sent.set(target,result.expiresAt);p.requests.delete(target);pickerStatus(p,'초대를 보냈어요. 상대 화면에서 수락하면 입장해요.');}
   }catch(e){if(pickerValid(p)){pickerStatus(p,e.message);if(e.status&&e.status<500)p.requests.delete(target);}}
   finally{p.sending.delete(target);if(pickerValid(p))loadPicker(p);}
  }
  async function loadPicker(p){
   if(!pickerValid(p)){if(picker===p)closePicker();return;}if(p.loading)return;p.loading=true;
   try{const result=await ctx.request('/api/school/coop',{kind:'candidates',mode:p.mode,roomId:p.roomId});if(pickerValid(p))renderCandidates(p,result.candidates);}
   catch(e){if(pickerValid(p)){
    unknown(p);pickerStatus(p,e.message);
    if([403,404,409].includes(e.status)){closePicker();ctx.toast(e.message);}
   }}finally{p.loading=false;}
  }
  function openPicker(mode,roomId){
   closePicker();if(!ctx.isCloud()||!ctx.isLobby(mode,roomId))return;
   const dialog=document.createElement('dialog');dialog.id='coop-picker-dialog';dialog.className='coop-picker';dialog.setAttribute('aria-labelledby','coop-picker-title');
   dialog.innerHTML=`<header><div><small>${title(mode)}</small><h2 id="coop-picker-title">${mode==='yeti'?'친구·길드원 초대':'길드원 초대'}</h2></div><button data-coop-hide aria-label="초대 창 닫기">×</button></header><p data-coop-connection>접속 상태를 확인하고 있어요…</p><div class="coop-contacts"><p class="coop-empty">초대할 단장을 불러오는 중…</p></div><p class="coop-picker-message" role="status"></p>`;
   picker={mode,roomId,dialog,scope:ctx.scope(),loading:false,key:'',sent:new Map(),requests:new Map(),sending:new Set(),focus:document.activeElement};
   dialog.querySelector('[data-coop-hide]').onclick=closePicker;
   dialog.addEventListener('cancel',e=>{e.preventDefault();e.stopPropagation();closePicker();});
   dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePicker();}},true);
   dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePicker();}});
   document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-coop-hide]').focus({preventScroll:true});loadPicker(picker);render();
  }
  function depart(id=clientId){if(ctx.isCloud())ctx.request('/api/school/coop',{kind:'presence',online:false,clientId:id},'school',{keepalive:true}).catch(()=>{});}
  const visibility=()=>{if(document.hidden){hide();depart();}else{clientId=crypto.randomUUID();schedule(0);}};
  const online=()=>schedule(0),offline=()=>{if(picker)unknown(picker);},pagehide=()=>depart();
  document.addEventListener('visibilitychange',visibility);window.addEventListener('online',online);window.addEventListener('offline',offline);window.addEventListener('pagehide',pagehide);scope=ctx.scope();schedule(0);
  return {openPicker,closePicker,reset,refresh:render,depart,destroy(){depart();stopped=true;epoch++;clearTimeout(timer);closePicker();hide();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',online);window.removeEventListener('offline',offline);window.removeEventListener('pagehide',pagehide);}};

 }
 return {create};
})();
