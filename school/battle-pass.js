/* Free, permanent progression pass. All grants are authoritative engine actions. */
window.SchoolBattlePass=(()=>{
 'use strict';
 const G=window.SchoolRPG,fmt=n=>n.toLocaleString('ko-KR');
 const reward=r=>r.item?G.GEAR_BY_ID[r.item].name:r.gold?`코인 ${fmt(r.gold)}`:`눈송이 ${r.snowflakes}`;
 function create(ctx){
  let scope='',questKey='',rewardKey='',pending=false;
  const $=id=>document.getElementById(id);
  function refresh(){
   if(ctx.modalKind()!=='battle-pass')return;
   if(scope!==ctx.scope())return ctx.closeModal();
   const info=G.passInfo(ctx.getState(),ctx.now()),blocked=pending||ctx.blocked();
   $('pass-level').textContent=`Lv.${info.level} / 50`;$('pass-xp').textContent=info.level===50?'최대 레벨 달성':`${info.progress} / 100 XP`;$('pass-progress').value=info.progress;
   const qk=JSON.stringify([info.quests,blocked]);
   if(qk!==questKey){questKey=qk;$('pass-quests').innerHTML=[true,false].map(d=>`<section><h4>${d?'오늘의 임무':'누적 임무'}</h4>${info.quests.filter(q=>q.daily===d).map(q=>`<article class="pass-quest"><div><b>${q.name}</b><small>${q.metric==='login'?'접속 완료':`${fmt(q.value)} / ${fmt(q.goal)}`} · ${q.xp} XP</small></div><button data-pass-quest="${q.id}" ${!q.ready||blocked?'disabled':''}>${q.claimed?'완료':q.ready?'XP 받기':info.level===50?'최대 레벨':'진행 중'}</button></article>`).join('')}</section>`).join('');}
   const rk=JSON.stringify([info.rewards,blocked]);
   if(rk!==rewardKey){rewardKey=rk;$('pass-rewards').innerHTML=info.rewards.map(r=>`<article class="pass-reward ${r.ready?'available':''} ${r.claimed?'claimed':''}"><small>LEVEL ${String(r.level).padStart(2,'0')} <span>무료</span></small><div class="pass-loot">${r.item?`<img src="school/assets/equipment/${r.item}.svg?v=gear1" alt="" width="54" height="54">`:`<span aria-hidden="true">${r.gold?'◉':'❄'}</span>`}</div><b>${reward(r)}</b><button data-pass-level="${r.level}" ${!r.ready||blocked?'disabled':''}>${r.claimed?'수령 완료':r.ready?'보상 받기':`Lv.${r.level} 해금`}</button></article>`).join('');}
  }
  async function click(e){const b=e.target.closest('[data-pass-quest],[data-pass-level]');if(!b||b.disabled||pending||ctx.blocked())return;pending=true;refresh();try{await ctx.dispatch(b.dataset.passQuest?{kind:'pass-quest',quest:b.dataset.passQuest}:{kind:'pass-reward',level:Number(b.dataset.passLevel)});}finally{pending=false;refresh();}}
  function open(){scope=ctx.scope();questKey=rewardKey='';ctx.openModal('배틀패스',`<div class="growth-pass"><header class="pass-header"><div class="pass-emblem" aria-hidden="true">✦</div><div><small>FREE BATTLE PASS</small><h3>함께 성장하는 50레벨의 기록</h3><p>기간 제한 없는 무료 성장 패스 · 보석·유료 구간 없음</p></div></header><section class="pass-progress"><b id="pass-level"></b><span id="pass-xp"></span><progress id="pass-progress" value="0" max="100" aria-label="패스 레벨 경험치"></progress></section><nav class="pass-tabs"><button data-pass-tab="rewards" aria-pressed="true">레벨 보상</button><button data-pass-tab="quests" aria-pressed="false">패스 임무</button></nav><div id="pass-rewards" class="pass-rewards"></div><div id="pass-quests" class="pass-quests" hidden></div><p class="pass-note">보상 적용 전투부터 집계됩니다. 완료한 임무의 XP를 받아 레벨을 올려 주세요. 일일 임무는 한국 시간 자정에 갱신되며, 누적 임무와 레벨 보상은 한 번만 수령합니다.</p></div>`,'battle-pass');
   const panel=document.querySelector('.growth-pass');panel.onclick=e=>{const tab=e.target.closest('[data-pass-tab]');if(tab){panel.querySelectorAll('[data-pass-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===tab)));$('pass-rewards').hidden=tab.dataset.passTab!=='rewards';$('pass-quests').hidden=tab.dataset.passTab!=='quests';}else click(e);};refresh();
  }
  return {open,refresh};
 }
 return {create};
})();
