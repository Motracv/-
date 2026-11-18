/* Input-only UI. The encounter server validates the challenge and its deadline. */
window.SchoolRescue=(()=>{
 'use strict';
 function create(send){
  let active=null,started='',timer=0,root=null,inputs=[],done=false;
  const touch=()=>matchMedia('(pointer: coarse)').matches;
  function clear(){clearTimeout(timer);document.removeEventListener('keydown',key,true);root?.remove();root=null;active=null;}
  function finish(success){if(done||!active)return;done=true;clearTimeout(timer);document.removeEventListener('keydown',key,true);root.innerHTML=`<strong>${success?'얼음을 깨뜨리는 중…':'구출 실패 · 내 용병단 15초 정지'}</strong>`;send('thaw-submit',{challengeId:active.id,inputs:success?inputs:[]});}
  function choose(value){if(done||!active)return;if(performance.now()>active.deadline)return finish(false);
   if(active.mode==='keyboard'&&value!==active.sequence[inputs.length])return finish(false);
   if(inputs.includes(value)&&active.mode==='touch')return;inputs.push(value);if(inputs.length===4)return finish(true);paint();
  }
  function key(e){if(!active||done||active.mode!=='keyboard')return;if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.isComposing)return;e.preventDefault();e.stopImmediatePropagation();choose(e.code);}
  function paint(){const q=active;if(!root||!q)return;const points=[[24,40],[66,31],[41,65],[79,65]],order=q.mode==='touch'?[0,1,2,3]:[inputs.length];
   root.innerHTML='<div class="rescue-heading"><b>얼음땡!</b><small>'+ (q.mode==='touch'?'원 4개를 모두 터치':'표시된 키를 순서대로 · 마우스 불가')+' · 7초</small><span>'+inputs.length+' / 4</span><i class="rescue-time"></i></div>';
   root.querySelector('.rescue-time').style.animationDuration=Math.max(0,q.deadline-performance.now())+'ms';root.querySelector('.rescue-time').style.width=Math.min(100,Math.max(0,(q.deadline-performance.now())/70))+'%';
   for(const i of order){if(q.mode==='touch'&&inputs.includes(i))continue;const n=document.createElement(q.mode==='touch'?'button':'span');n.className='rescue-orb';n.style.left=points[(i+q.offset)%4][0]+'%';n.style.top=points[(i+q.offset)%4][1]+'%';n.textContent=q.mode==='touch'?'❄':q.sequence[i].slice(3);if(q.mode==='touch'){n.type='button';n.setAttribute('aria-label',`얼음 ${i+1} 깨기`);n.onpointerdown=e=>{if(!['touch','pen'].includes(e.pointerType))return;e.preventDefault();choose(i);};}root.append(n);}
  }
  function update(data){const b=data?.room?.battle,t=b?.teams.find(t=>t.isMe),other=b?.teams.find(t=>!t.isMe),q=t?.rescue,live=data?.room?.status==='fighting';
   if(!live||!other?.frozen||t?.frozen){clear();return;}
   if(q?.outcome==='pending'){
    if(active?.id===q.id)return;clear();active={...q,offset:crypto.getRandomValues(new Uint8Array(1))[0]%4,deadline:performance.now()+Math.max(0,Math.min(7000,q.expiresAt-data.serverTime))};inputs=[];done=false;
    root=document.createElement('div');root.className='rescue-overlay';document.querySelector('.yeti-arena')?.append(root);paint();document.addEventListener('keydown',key,true);timer=setTimeout(()=>finish(false),Math.max(0,active.deadline-performance.now()));return;
   }
   clear();const token=data.room.id+':'+other.frozen.id+':'+(t?.rescueLockUntil||0);
   if(t?.units.some(u=>u.hp>0)&&other.units.some(u=>u.hp>0)&&!(t.rescueLockUntil>b.elapsed)&&started!==token){started=token;queueMicrotask(()=>Promise.resolve(send('thaw-start',{freezeId:other.frozen.id,mode:touch()?'touch':'keyboard'})).then(ok=>{if(!ok&&started===token)started='';}));}
  }
  return {update,destroy(){clear();started='';}};
 }
 return {create};
})();
