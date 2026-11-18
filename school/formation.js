/* Six-slot formation desk. Pointer gestures only preview; confirmed game actions
   remain the single source of truth for both touch and keyboard users. */
window.SchoolFormation=(()=>{
 'use strict';
 const G=window.SchoolRPG,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const order=[3,0,4,1,5,2],grades={UR:4,SSR:3,SR:2,R:1};
 function place(team,id,slot,units){
  if(!units[id]||!Number.isInteger(slot)||slot<0||slot>=6)return team.slice();
  const next=team.slice(),from=next.indexOf(id),to=Math.min(slot,next.length);
  if(from>=0){if(to===next.length){next.splice(from,1);next.push(id);}else [next[from],next[to]]=[next[to],next[from]];}
  else if(to<6)next[to]=id;
  return next;
 }
 function create(root,ctx){
  const $=id=>root.querySelector('#'+id);
  let role='all',sort='grade',selection=null,gesture=null,ghost=null,hold=0,suppressUntil=0,viewKey='',scope='',owned='owned',sending=false;
  const blocked=()=>sending||ctx.blocked()||ctx.activityActive();
  const active=()=>!root.hidden&&!document.hidden&&!ctx.modalOpen();
  const portrait=id=>`<span class="formation-figure"><img src="${(window.SchoolArt.rosterPortrait||window.SchoolArt.portrait)(id)}" alt="" draggable="false"></span>`;
  const stars=u=>`<span class="formation-stars" aria-label="${u.stars}성">${'★'.repeat(u.stars)}${'☆'.repeat(5-u.stars)}</span>`;
  const say=text=>{$('formation-status-live').textContent=text;};
  function hint(){say(ctx.activityActive()?'던전 도전을 마친 뒤 편성을 바꿀 수 있어요.':selection?`${G.BY_ID[selection].name} · 넣을 자리를 누르세요. ESC로 취소`:'짧게 누르면 육성 · 꾹 눌러 끌면 배치');}
  function cleanup(){clearTimeout(hold);hold=0;const g=gesture;gesture=null;if(g?.node.hasPointerCapture?.(g.pointer))g.node.releasePointerCapture(g.pointer);ghost?.remove();ghost=null;root.classList.remove('is-placing');root.querySelectorAll('.drop-target').forEach(n=>n.classList.remove('drop-target'));}
  function cancel(){cleanup();selection=null;root.querySelectorAll('[data-form-select]').forEach(n=>n.setAttribute('aria-pressed','false'));hint();}
  function controls(){
   if(!active())cleanup();
   root.querySelectorAll('[data-form-mutate]').forEach(n=>n.disabled=blocked()||n.dataset.unavailable==='true');
  }
  async function dispatch(action){
   if(blocked()){ctx.toast(ctx.activityActive()?'던전 도전을 마친 뒤 편성해 주세요.':'저장을 확인한 뒤 다시 시도해 주세요.');return;}
   sending=true;controls();say('편성을 저장하고 있어요…');
   try{await ctx.dispatch(action);}finally{sending=false;selection=null;viewKey='';refresh(owned);}
  }
  function drop(id,slot){const s=ctx.getState(),team=place(s.team,id,slot,s.units);if(team.join()===s.team.join()){cancel();return;}dispatch({kind:'team',team});}
  function refresh(filter=owned){
   if(!ctx.getState())return;owned=filter;const s=ctx.getState(),nextScope=ctx.scope();
   if(scope!==nextScope){cancel();scope=nextScope;viewKey='';}
   const key=JSON.stringify([scope,owned,role,sort,s.team,Object.entries(s.units).map(([id,u])=>[id,u.level,u.stars]),G.presetInfo(s),s.equipment]);
   if(key===viewKey){controls();return;}cleanup();viewKey=key;
   $('roster-count').textContent=`${Object.keys(s.units).length} / ${G.HEROES.length}`;
   $('formation-presets').innerHTML=G.presetInfo(s).map(p=>`<button data-form-preset="${p.slot}" data-form-mutate data-unavailable="${!p.saved}" aria-pressed="${p.active}" title="${p.saved?'저장된 편성 불러오기':'저장한 편성에서 먼저 저장하세요'}">${esc(p.name)}${p.active?' ✓':''}</button>`).join('');
   $('formation-slots').innerHTML=order.map(i=>{
    const id=s.team[i],h=G.BY_ID[id],u=s.units[id];return `<div class="formation-slot ${h?.rarity||'empty'}" data-form-slot="${i}"><button class="formation-slot-main" data-form-target="${i}" ${id?`data-form-drag="${id}"`:''} aria-label="${i<3?'전열':'후열'} ${i%3+1} · ${h?h.name+' Lv.'+u.level:'빈자리'}"><span class="formation-position">${i<3?'전':'후'}${i%3+1}</span>${h?portrait(id)+`<strong>${h.name}</strong><small>Lv.${u.level}</small>${stars(u)}`:'<span class="formation-empty">＋</span><small>용병 배치</small>'}</button>${id?`<button class="formation-remove" data-form-remove="${id}" data-form-mutate aria-label="${h.name} 출전 해제">×</button>`:''}</div>`;
   }).join('');
   const synergies=G.partySynergies(s)?.active||[];
   $('formation-power').textContent=G.power(s).toLocaleString('ko-KR');
   $('formation-synergies').textContent=synergies.map(x=>x.name).join(' · ')||'같은 역할 3명으로 파티 보너스';
   $('formation-team-count').textContent=s.team.length+' / 6';
   const accepts=h=>role==='all'||(role==='damage'?['전사','사수','마법'].includes(h.role):h.role===role);
   const list=G.HEROES.filter(h=>(owned==='all'||s.units[h.id])&&accepts(h)).sort((a,b)=>Number(!!s.units[b.id])-Number(!!s.units[a.id])||(sort==='level'?(s.units[b.id]?.level||0)-(s.units[a.id]?.level||0):grades[b.rarity]-grades[a.rarity])||a.name.localeCompare(b.name,'ko'));
   $('roster').innerHTML=list.map(h=>{const u=s.units[h.id],on=s.team.includes(h.id);return `<article class="formation-card ${h.rarity} ${u?'':'unowned'}"><button class="formation-card-main" data-form-detail="${h.id}" ${u?`data-form-drag="${h.id}"`:''} aria-label="${h.name} ${h.rarity}${u?' '+u.level+'레벨 육성':' 미보유 정보'}"><span class="formation-grade">${h.rarity}</span><span class="formation-level">${u?'Lv.'+u.level:'미보유'}</span>${portrait(h.id)}${on?'<span class="formation-on-team">출전</span>':''}<strong>${h.name}</strong><small>${h.role}</small>${u?stars(u):'<span class="formation-stars">미보유</span>'}</button>${u?`<button class="formation-place" data-form-select="${h.id}" data-form-mutate aria-pressed="${selection===h.id}">${on?'자리 변경':'배치'}</button>`:`<button class="formation-place" data-form-detail="${h.id}">정보 보기</button>`}</article>`;}).join('')||'<p class="formation-no-results">이 역할의 용병이 없어요.</p>';
   root.querySelectorAll('[data-form-role]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.formRole===role)));
   hint();controls();
  }
  root.addEventListener('click',e=>{
   const button=e.target.closest('button');if(!button||button.disabled)return;
   if(performance.now()<suppressUntil){e.preventDefault();e.stopPropagation();return;}
   const d=button.dataset;
   if(d.formRole!==undefined){role=d.formRole;refresh();}
   else if(d.formSelect){selection=selection===d.formSelect?null:d.formSelect;viewKey='';refresh();}
   else if(d.formTarget!==undefined){if(selection)drop(selection,Number(d.formTarget));else {const id=ctx.getState().team[Number(d.formTarget)];if(id)ctx.openHero(id);else say('오른쪽 용병의 배치를 누르거나 꾹 눌러 끌어오세요.');}}
   else if(d.formDetail)ctx.openHero(d.formDetail);
   else if(d.formRemove){const team=ctx.getState().team.filter(id=>id!==d.formRemove);if(!team.length)return ctx.toast('최소 한 명은 출전해야 해요.');dispatch({kind:'team',team});}
   else if(d.formPreset!==undefined)dispatch({kind:'preset-apply',slot:Number(d.formPreset)});
   else if(button.id==='formation-cancel')cancel();
  });
  $('formation-sort').addEventListener('change',e=>{sort=e.target.value;refresh();});
  root.addEventListener('contextmenu',e=>{if(e.target.closest('[data-form-drag]'))e.preventDefault();});
  root.addEventListener('dragstart',e=>e.preventDefault());
  root.addEventListener('pointerdown',e=>{
   const node=e.target.closest('[data-form-drag]');if(!node||e.button!==0||e.isPrimary===false||blocked()||!active())return;
   cleanup();gesture={node,id:node.dataset.formDrag,pointer:e.pointerId,x:e.clientX,y:e.clientY,scope:ctx.scope(),dragging:false};
   hold=setTimeout(()=>{
    const g=gesture;if(!g||blocked()||!active()||g.scope!==ctx.scope())return cleanup();
    g.dragging=true;selection=g.id;suppressUntil=performance.now()+800;node.setPointerCapture?.(g.pointer);
    ghost=document.createElement('div');ghost.className='formation-drag-ghost';ghost.setAttribute('aria-hidden','true');ghost.innerHTML=portrait(g.id)+`<b>${G.BY_ID[g.id].name}</b>`;document.body.append(ghost);
    ghost.style.transform=`translate3d(${g.x-40}px,${g.y-72}px,0)`;root.classList.add('is-placing');say(`${G.BY_ID[g.id].name} · 놓을 자리로 끌어주세요`);
   },320);
  });
  root.addEventListener('touchmove',e=>{if(gesture?.dragging)e.preventDefault();},{passive:false});
  root.addEventListener('lostpointercapture',()=>{if(gesture?.dragging)cancel();});
  window.addEventListener('pointermove',e=>{
   const g=gesture;if(!g||e.pointerId!==g.pointer)return;
   if(!active()||g.scope!==ctx.scope()||blocked())return cleanup();
   if(!g.dragging){if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>10)cleanup();return;}
   e.preventDefault();ghost.style.transform=`translate3d(${e.clientX-40}px,${e.clientY-72}px,0)`;
   const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-form-slot]');
   root.querySelectorAll('[data-form-slot]').forEach(n=>n.classList.toggle('drop-target',n===target));
  },{passive:false});
  window.addEventListener('pointerup',e=>{
   const g=gesture;if(!g||e.pointerId!==g.pointer)return;
   const target=g.dragging&&document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-form-slot]');
   if(g.dragging){e.preventDefault();suppressUntil=performance.now()+650;}
   const valid=g.dragging&&active()&&g.scope===ctx.scope()&&!blocked();cleanup();
   if(valid&&target&&root.contains(target))drop(g.id,Number(target.dataset.formSlot));else if(g.dragging){hint();viewKey='';refresh();}
  });
  for(const name of ['pointercancel','blur'])window.addEventListener(name,cancel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  root.addEventListener('scroll',()=>{if(!gesture?.dragging)cleanup();},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active()&&(gesture||selection)){e.preventDefault();e.stopImmediatePropagation();cancel();}},true);
  window.addEventListener('school-art-ready',()=>{viewKey='';if(active())refresh();});
  return {refresh,controls,cancel};
 }
 return {create,place};
})();
