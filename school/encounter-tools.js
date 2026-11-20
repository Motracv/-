/* Read-only reports and device preferences. Never changes a battle or rewards. */
window.SchoolEncounterTools=(()=>{
 'use strict';const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=v=>Math.round(v||0).toLocaleString('ko-KR'),metrics={damage:'피해량',healing:'회복량',absorbed:'보호막 흡수',taken:'받은 피해'};
 const prefKey=(kind,scope)=>`school-boss-auto:${scope}:${kind}`;
 function readAuto(kind,scope){try{return localStorage.getItem(prefKey(kind,scope))!=='false';}catch{return true;}}
 function writeAuto(kind,scope,value){try{localStorage.setItem(prefKey(kind,scope),String(value));}catch{}}
 function keepAwake(){let token=null,pending=false,wanted=false,closed=false,retryAt=0;
  async function update(value=wanted){wanted=!!value;if(closed||!wanted||document.hidden){if(token){const old=token;token=null;old.release().catch(()=>{});}return;}
   if(token||pending||Date.now()<retryAt||!globalThis.navigator?.wakeLock)return;pending=true;
   try{const lock=await navigator.wakeLock.request('screen');if(closed||!wanted||document.hidden)await lock.release();else{token=lock;lock.addEventListener('release',()=>{if(token===lock)token=null;});}}
   catch{retryAt=Date.now()+30000;}finally{pending=false;}
  }
  return{update,destroy(){closed=true;update(false);}};
 }
 function snapshot(b,key,members=[]){if(!b?.teams?.length)return null;const elapsed=Math.max(0,b.elapsed||0);return{key,at:b.startedAt||Date.now(),elapsed,ended:!!b.ended,outcome:b.outcome,rows:b.teams.flatMap((t,ti)=>t.units.map(u=>({id:u.id,skin:u.skin||'',team:ti,mine:b.teams.length===1||!!t.isMe,teamName:b.teams.length===1?'나의 용병단':members.find(m=>!!m.isMe===!!t.isMe)?.name||`용병단 ${ti+1}`,level:u.level||1,hp:u.hp,max:u.max,...Object.fromEntries(Object.keys(metrics).map(k=>[k,Math.max(0,Math.round(u[k]||0))]))}))) };}
 function createReport({kind,scope,host}){let current=null,history=[],selected='current',metric='damage',team='all',signature='',mounted=false;let owner='';const storageKey=()=>`school-boss-records:${owner}:${kind}`;
  function syncScope(){const next=scope();if(owner===next)return;owner=next;current=null;history=[];selected='current';signature='';mounted=false;
   try{const values=JSON.parse(localStorage.getItem(storageKey())||'[]');if(Array.isArray(values))history=values.filter(r=>r&&typeof r.key==='string'&&Array.isArray(r.rows)&&r.rows.length<=12&&r.rows.every(u=>window.SchoolRPG.BY_ID[u.id])).slice(0,10);}catch{}
  }
  function save(){try{localStorage.setItem(storageKey(),JSON.stringify(history));}catch{}}
  function update(b,key,members){syncScope();const next=snapshot(b,key,members);if(next)current=next;
   if(next?.ended&&!history.some(r=>r.key===next.key)){history=[next,...history].slice(0,10);save();}render();
  }
  function render(){syncScope();const node=host();if(!node||node.hidden)return;if(!mounted||!node.querySelector('[data-record-rows]')){mounted=true;signature='';node.innerHTML=`<header><h3>전투 기록</h3><button type="button" data-record-close class="secondary">기록 닫기</button></header><div class="encounter-report-select"><label>전투 <select data-record-run aria-label="확인할 전투"></select></label><label ${kind==='santa'?'hidden':''}>용병단 <select data-record-team aria-label="확인할 용병단"><option value="all">전체 용병단</option><option value="mine">내 용병단</option><option value="other">동료 용병단</option></select></label></div><p data-record-summary></p><nav aria-label="기여도 종류">${Object.entries(metrics).map(([k,label])=>`<button type="button" data-record-metric="${k}" aria-pressed="${k===metric}">${label}</button>`).join('')}</nav><div data-record-rows></div><p class="encounter-report-note">서버의 실제 누적 피해·회복을 표시해요. 보호막은 각 용병이 받은 피해를 흡수한 양입니다. 최근 10회 결과는 이 기기·계정에 보관하며, 기록을 보는 동안에도 자동 전투가 계속됩니다.</p>`;
    node.querySelector('[data-record-close]').onclick=()=>{node.hidden=true;};node.querySelector('[data-record-run]').onchange=e=>{selected=e.target.value;signature='';render();};node.querySelector('[data-record-team]').onchange=e=>{team=e.target.value;signature='';render();};node.querySelectorAll('[data-record-metric]').forEach(n=>n.onclick=()=>{metric=n.dataset.recordMetric;signature='';render();});
   }
   const select=node.querySelector('[data-record-run]'),options='<option value="current">현재 전투</option>'+history.map((r,i)=>`<option value="${esc(r.key)}">최근 ${i+1}회 · ${r.outcome==='defeated'?'승리':'종료'} · ${new Date(r.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</option>`).join('');const optionsKey=history.map(r=>r.key).join('|');if(select.dataset.records!==optionsKey){select.dataset.records=optionsKey;select.innerHTML=options;for(const option of select.querySelectorAll('option'))option.selected=option.value===selected;}
   const record=selected==='current'?current:history.find(r=>r.key===selected),key=JSON.stringify([selected,metric,team,record]);if(signature===key)return;signature=key;
   const rows=(record?.rows||[]).filter(r=>team==='all'||(team==='mine'?r.mine:!r.mine)).sort((a,b)=>b[metric]-a[metric]),total=rows.reduce((sum,r)=>sum+r[metric],0),seconds=(record?.elapsed||0)/1000;
   node.querySelector('[data-record-summary]').textContent=record?`${record.ended?(record.outcome==='defeated'?'토벌 성공':'전투 종료'):'실시간 갱신'} · ${Math.floor(seconds/60)}분 ${Math.floor(seconds%60)}초 · ${metrics[metric]} 합계 ${fmt(total)}`:'전투를 시작하면 기록이 표시돼요.';
   node.querySelectorAll('[data-record-metric]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.recordMetric===metric)));
   const holder=node.querySelector('[data-record-rows]'),ids=rows.map(r=>r.team+':'+r.id+':'+r.skin).sort().join('|');
   if(holder.dataset.rows!==ids){holder.dataset.rows=ids;holder.innerHTML=rows.map(r=>{const h=window.SchoolRPG.BY_ID[r.id],portrait=window.SchoolArt?.portrait?.(r.id,r.skin);return `<article data-record-row="${r.team}:${r.id}">${portrait?`<img src="${esc(portrait)}" alt="">`:''}<div><div class="encounter-row-heading"><b>${esc(h?.name||r.id)}</b><strong data-record-value></strong></div><div class="encounter-bar"><i></i></div><small data-record-detail></small></div></article>`;}).join('');}
   rows.forEach((r,i)=>{const row=holder.querySelector(`[data-record-row="${r.team}:${r.id}"]`),share=total?r[metric]/total*100:0;row.style.order=i;row.querySelector('[data-record-value]').textContent=`${fmt(r[metric])} · ${share.toFixed(1)}%`;row.querySelector('i').style.width=share+'%';row.querySelector('[data-record-detail]').textContent=`${r.teamName} · Lv.${r.level} · ${metric==='damage'?fmt(seconds?r.damage/seconds:0)+' DPS':metrics[metric]}`;});
  }
  return{update,render,toggle(){const node=host();if(!node)return;node.hidden=!node.hidden;render();}};
 }
 return{readAuto,writeAuto,keepAwake,createReport,snapshot};
})();
