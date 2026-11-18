/* Equipment views. Mutations use the game's existing confirmed action queue. */
window.SchoolEquipment = (() => {
  'use strict';
  const G=window.SchoolRPG, esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slots={weapon:'무기',armor:'방어구',charm:'장신구'}, fmt=value=>Math.round(Number(value)||0).toLocaleString('ko-KR');
  const stars=value=>'★'.repeat(Math.max(0,value||0))+'☆'.repeat(Math.max(0,5-(value||0)));
  const image=(id,cls='')=>`<img class="${cls}" src="school/assets/equipment/${encodeURIComponent(id)}.svg?v=gear1" alt="" width="64" height="64">`;
  const percent=value=>`${Number(((value||0)*100).toFixed(2))}%`;
  const bonusText=bonus=>[['atk','공격'],['hp','체력']].filter(([key])=>bonus?.[key]).map(([key,label])=>`${label} +${percent(bonus[key])}`).join(' · ')||'추가 능력치 없음';
  function slotsMarkup(state,hero) {
    if(!G.equipmentInfo)return '';
    const info=G.equipmentInfo(state,hero);
    return `<section class="hero-equipment"><div class="gear-section-heading"><b>장비</b><small>던전·무기 모집 · 중복으로 각성</small></div><div class="hero-gear-slots" id="hero-gear-slots">${Object.entries(slots).map(([slot,label])=>{const item=info.items.find(item=>item.id===info.loadout[slot]);return `<button type="button" data-gear-slot="${slot}" data-gear-hero="${hero}" class="gear-slot ${item?'gear-'+item.rarity:'gear-empty'}" aria-label="${label} · ${item?item.name+' '+item.stars+'성':'빈 슬롯'} · 장비 관리">${item?image(item.id):`<span class="gear-empty-symbol" aria-hidden="true">${slot==='weapon'?'⚔':slot==='armor'?'◇':'✧'}</span>`}<span><small>${label}</small><b>${item?esc(item.name):'장비 선택'}</b><i aria-hidden="true">${item?stars(item.stars):'＋'}</i></span></button>`;}).join('')}</div></section>`;
  }
  function lootMarkup(result) {
    if(result?.gearPending)return '<p class="gear-pending" role="status">장비 보상을 서버에서 확인하고 있어요.</p>';
    const drops=(result?.gearDrops||[]).filter(drop=>G.GEAR_BY_ID?.[drop.item]);
    if(!drops.length)return '';
    return `<section class="gear-loot-section"><h4>획득 장비</h4><div class="gear-loot">${drops.map((drop,index)=>{const item=G.GEAR_BY_ID[drop.item];return `<article class="gear-loot-card gear-${item.rarity}" data-gear-drop="${item.id}" style="--gear-delay:${index*100}ms">${image(item.id)}<div><span class="gear-rarity">${item.rarity} · ${slots[item.slot]}</span><b>${esc(item.name)}</b><small>${drop.overflow?'보유 한도 도달':drop.duplicate?`중복 장비 +${fmt(drop.count)}`:`새 장비 +${fmt(drop.count)}`}</small></div></article>`;}).join('')}</div></section>`;
  }
  function dropDetails(kind,value,first=true) {
    if(!G.equipmentDropInfo)return '';
    const info=G.equipmentDropInfo(kind,value),count=first?info.count:0;
    const label=kind==='tower'&&!first?'이미 돌파한 층 · 장비 보상 없음':count?`장비 ${count}개 · 등급별 확률`:'매 5층 보스 첫 돌파 시 장비 1개';
    return `<details class="gear-drop-details" data-gear-drop-source="${kind}"><summary>${label}</summary><p>${kind==='tower'?'5·10·15…층 보스의 첫 클리어 때만 획득해요. 같은 층에서는 다시 지급하지 않아요.':`승리할 때 장비 ${info.count}개를 각각 추첨해요. 패배·포기하면 장비가 나오지 않아요.`}</p><table aria-label="${slots[kind]||'장비'} 등급 확률"><thead><tr><th>등급</th><th>1개당 확률</th></tr></thead><tbody>${['R','SR','SSR'].map(rarity=>`<tr><th><span class="gear-rarity gear-${rarity}">${rarity}</span></th><td data-gear-rate="${rarity}">${percent(info.rates[rarity])}</td></tr>`).join('')}</tbody></table><small>일반 뽑기·골드 강화 없음 · 같은 종류의 중복 장비로 최대 5성 각성</small></details>`;
  }
  function snapshotMarkup(snapshot,label='등록 장비') {
    const equipment=snapshot?.equipment,team=snapshot?.team||snapshot?.units?.map(unit=>unit.id)||[];
    const rows=team.filter(hero=>G.BY_ID[hero]).map(hero=>{
      const loadout=equipment?.equipped?.[hero]||{};
      const worn=Object.values(loadout).filter(id=>G.GEAR_BY_ID?.[id]);
      return `<div class="gear-snapshot-row" data-gear-snapshot-hero="${hero}"><b>${esc(G.BY_ID[hero].name)}</b><span>${worn.length?worn.map(id=>{const item=G.GEAR_BY_ID[id],level=equipment.inventory?.[id]?.stars||0;return `<span class="gear-snapshot-item gear-${item.rarity}">${image(id)}<span>${esc(item.name)} <small>${level}성</small></span></span>`;}).join(''):'장비 없음'}</span></div>`;
    });
    return `<details class="gear-snapshot" data-gear-snapshot><summary>${esc(label)} · 장비 확인 ⌄</summary><div class="gear-snapshot-list">${rows.join('')||'<p>등록된 장비가 없어요.</p>'}</div></details>`;
  }
  function create(ctx) {
    let hero=null,filter='weapon',selected=null,current=false,key='',slotKey='',scope='',effectTimer=null;
    const seen=new Set(),$=id=>document.getElementById(id),state=()=>ctx.getState();
    const active=()=>current&&ctx.modalKind()==='equipment'&&$('modal')?.open&&!!$('gear-inventory');
    const text=(id,value)=>{const node=typeof id==='string'?$(id):id;if(node&&node.textContent!==String(value))node.textContent=String(value);};
    const disable=(node,value)=>{if(node&&node.disabled!==!!value)node.disabled=!!value;};
    const definition=id=>G.GEAR_BY_ID?.[id];
    function close(){clearTimeout(effectTimer);effectTimer=null;current=false;hero=null;key='';slotKey='';}
    function choose(info,slot) { return info.loadout[slot]||info.items.find(item=>item.slot===slot&&item.count>0)?.id||info.items.find(item=>item.slot===slot)?.id; }
    function open(id,slot='weapon') {
      if(!state().units[id]||!G.equipmentInfo)return;
      const initial=G.equipmentInfo(state(),id);slot=slots[slot]?slot:'weapon';
      ctx.openModal('용병 장비',`<section id="gear-inventory" class="gear-inventory"><div class="gear-heading"><button type="button" class="secondary" id="gear-back">‹ ${esc(G.BY_ID[id].name)}</button><span>장비 레벨·골드 비용 없음</span></div><div class="gear-workspace"><div class="gear-library"><div class="gear-filters" role="group" aria-label="장비 부위">${Object.entries(slots).map(([value,label])=>`<button type="button" data-gear-filter="${value}" aria-pressed="${slot===value}">${label}</button>`).join('')}</div><div class="gear-items" id="gear-items" aria-label="보유 장비">${G.GEAR.map(item=>`<button type="button" class="gear-item gear-${item.rarity}" data-gear-item="${item.id}" data-gear-kind="${item.slot}" aria-pressed="false">${image(item.id)}<span><small class="gear-rarity">${item.rarity}</small><b>${esc(item.name)}</b><i data-gear-stars aria-hidden="true"></i><small data-gear-count></small></span><em data-gear-equipped hidden>착용</em></button>`).join('')}</div></div><section class="gear-detail" id="gear-detail" aria-label="선택한 장비"><div class="gear-detail-scroll"><div class="gear-selected-heading"><div id="gear-selected-icon"></div><div><span class="gear-rarity" id="gear-selected-rarity"></span><h3 id="gear-selected-name"></h3><p id="gear-selected-stars"></p></div></div><p id="gear-bonus" class="gear-bonus"></p><p id="gear-exclusive" class="gear-exclusive" hidden></p><div class="gear-preview"><span>착용 시 능력치</span><div><small>공격</small><b id="gear-preview-atk"></b><small>체력</small><b id="gear-preview-hp"></b></div></div><p id="gear-owned" class="gear-small"></p><p id="gear-wearers" class="gear-small"></p><p id="gear-awaken-next" class="gear-small"></p><p class="gear-shared-note">같은 종류의 모든 장비가 별을 공유해요. 착용 중인 장비는 각성 재료로 쓰지 않아요.</p><p class="gear-apply-note">다음 웨이브부터 적용 · 현재 체력 유지<br>시즌 방어 편성은 별도 갱신</p></div><div class="gear-actions"><button type="button" class="primary" id="gear-equip">착용</button><button type="button" class="secondary" id="gear-unequip">해제</button><button type="button" class="secondary gear-awaken" id="gear-awaken">각성</button></div><div id="gear-awaken-fx" aria-hidden="true"></div></section></div><p id="gear-lock-note" class="gear-status" role="status"></p></section>`,'equipment');
      current=true;hero=id;filter=slot;selected=choose(initial,slot);scope=ctx.accountScope();key='';$('modal').classList.add('equipment-modal');
      $('gear-back').onclick=()=>ctx.openHero(id);
      $('gear-inventory').addEventListener('click',event=>{
        const button=event.target.closest('button');if(!button||button.disabled||!active())return;
        if(button.dataset.gearFilter){filter=button.dataset.gearFilter;selected=choose(G.equipmentInfo(state(),hero),filter);key='';refresh();}
        else if(button.dataset.gearItem){selected=button.dataset.gearItem;key='';refresh();}
        else if(['gear-equip','gear-unequip','gear-awaken'].includes(button.id)){
          const info=G.equipmentInfo(state(),hero);if(ctx.isBlocked()||info.locked)return;
          const action=button.id==='gear-equip'?{kind:'gear-equip',hero,item:selected}:button.id==='gear-unequip'?{kind:'gear-unequip',hero,slot:filter}:{kind:'gear-awaken',item:selected};ctx.dispatch(action);
        }
      });refresh();
    }
    function preview(s,item,info) {
      const equipment=s.equipment||{inventory:{},equipped:{}};
      const changed={...s,equipment:{...equipment,inventory:{...equipment.inventory,[item.id]:{count:Math.max(1,item.count),stars:item.stars}},equipped:{...equipment.equipped,[hero]:{...info.loadout,[item.slot]:item.id}}}};
      return {before:G.stats(hero,s.units[hero],s),after:G.stats(hero,s.units[hero],changed)};
    }
    function refreshHeroSlots() {
      if(ctx.modalKind()!=='hero'||!$('hero-gear-slots'))return;
      const id=$('hero-gear-slots').querySelector('[data-gear-hero]')?.dataset.gearHero;if(!id)return;
      const s=state(),info=G.equipmentInfo(s,id),stamp=JSON.stringify([ctx.accountScope(),info.loadout,info.items.map(item=>[item.id,item.stars])]);
      if(stamp===slotKey)return;slotKey=stamp;
      for(const slot of Object.keys(slots)){
        const button=$('hero-gear-slots').querySelector(`[data-gear-slot="${slot}"]`),item=info.items.find(item=>item.id===info.loadout[slot]);
        button.className=`gear-slot ${item?'gear-'+item.rarity:'gear-empty'}`;
        button.innerHTML=`${item?image(item.id):`<span class="gear-empty-symbol" aria-hidden="true">${slot==='weapon'?'⚔':slot==='armor'?'◇':'✧'}</span>`}<span><small>${slots[slot]}</small><b>${item?esc(item.name):'장비 선택'}</b><i aria-hidden="true">${item?stars(item.stars):'＋'}</i></span>`;
        button.setAttribute('aria-label',`${slots[slot]} · ${item?item.name+' '+item.stars+'성':'빈 슬롯'} · 장비 관리`);
      }
    }
    function refresh() {
      if(!G.equipmentInfo)return;
      refreshHeroSlots();if(!active())return;
      const s=state();if(scope!==ctx.accountScope()||!s.units[hero]){ctx.closeModal();return;}
      const info=G.equipmentInfo(s,hero),item=info.items.find(item=>item.id===selected)||info.items.find(item=>item.slot===filter);if(!item)return;
      const stamp=JSON.stringify([scope,hero,filter,selected,s.units[hero].level,s.units[hero].stars,info.loadout,info.items.map(entry=>[entry.count,entry.stars,entry.wearers])]);
      if(stamp!==key){key=stamp;
        $('gear-inventory').querySelectorAll('[data-gear-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.gearFilter===filter)));
        for(const entry of info.items){const button=$('gear-items').querySelector(`[data-gear-item="${entry.id}"]`);button.hidden=entry.slot!==filter;button.classList.toggle('gear-unowned',entry.count<1);button.setAttribute('aria-pressed',String(entry.id===selected));button.setAttribute('aria-label',`${entry.name} ${entry.rarity} ${entry.stars}성 · 보유 ${entry.count} · 남는 장비 ${entry.free}`);text(button.querySelector('[data-gear-stars]'),stars(entry.stars));text(button.querySelector('[data-gear-count]'),`보유 ${fmt(entry.count)} · 여유 ${fmt(entry.free)}`);button.querySelector('[data-gear-equipped]').hidden=info.loadout[entry.slot]!==entry.id;}
        $('gear-selected-icon').innerHTML=image(item.id);$('gear-detail').className=`gear-detail gear-${item.rarity}`;
        text('gear-selected-rarity',`${item.rarity} · ${slots[item.slot]}`);text('gear-selected-name',item.name);text('gear-selected-stars',`${stars(item.stars)} · ${item.stars}성`);text('gear-bonus',bonusText(G.gearBonus(item.id,item.stars)));
        const exclusive=G.weaponPassive(item.id,item.stars);$('gear-exclusive').hidden=!exclusive; if(exclusive)text('gear-exclusive',`${exclusive.owner===hero?'전용 패시브 활성':'전용 패시브 비활성 · '+G.BY_ID[exclusive.owner].name+' 전용'} · ${exclusive.name}\n${exclusive.description}`);
        const st=preview(s,item,info);text('gear-preview-atk',`${fmt(st.before.atk)} → ${fmt(st.after.atk)}`);text('gear-preview-hp',`${fmt(st.before.hp)} → ${fmt(st.after.hp)}`);
        text('gear-owned',`보유 ${fmt(item.count)} · 착용 ${item.wearers.length} · 남는 장비 ${fmt(item.free)}`);text('gear-wearers',`착용 중: ${item.wearers.map(id=>G.BY_ID[id]?.name||id).join(', ')||'없음'}`);
        text('gear-equip',info.loadout[filter]===item.id?'착용 중':item.count<1?'미보유':item.free<1?'남는 장비 없음':'착용');
        text('gear-awaken',item.stars>=5?'최대 5성':`각성 · 동일 장비 ${item.awakenCost}개`);
        text('gear-awaken-next',item.stars>=5?'최대 각성 상태예요.':`다음 ${item.stars+1}성: ${bonusText(G.gearBonus(item.id,item.stars+1))} · 재료 ${fmt(item.materials)} / ${item.awakenCost}`);
      }
      const blocked=ctx.isBlocked()||info.locked;
      disable($('gear-equip'),blocked||item.count<1||item.free<1||info.loadout[filter]===item.id);
      $('gear-unequip').hidden=info.loadout[filter]!==item.id;disable($('gear-unequip'),blocked||!info.loadout[filter]);
      disable($('gear-awaken'),blocked||!item.canAwaken);
      text('gear-lock-note',info.locked?'던전 도전을 마친 뒤 장비를 바꾸거나 각성할 수 있어요.':ctx.isBlocked()?'저장 상태를 확인하고 있어요.':'착용·해제·각성에는 골드나 보석이 들지 않아요.');
    }
    function handleResult(result,requestKey) {
      if(!result?.kind?.startsWith('gear-'))return;
      refresh();
      if(result.kind==='gear-awaken'){
        const id=result.item,level=result.stars,k=`${ctx.accountScope()}:${requestKey||id+':'+level}`;
        if(!seen.has(k)){seen.add(k);if(seen.size>100)seen.delete(seen.values().next().value);ctx.play?.('reward');
          if(active()&&selected===id){const target=$('gear-awaken-fx'),box=$('gear-detail').getBoundingClientRect();clearTimeout(effectTimer);target.style.cssText=`position:fixed;inset:auto;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;z-index:20`;target.innerHTML=`<span class="gear-merge-card gear-merge-left">${image(id)}</span><span class="gear-merge-card gear-merge-right">${image(id)}</span><strong class="gear-new-star">★<small>${level}성 각성</small></strong>`;target.className='gear-fx-playing';effectTimer=setTimeout(()=>{if(target.isConnected){target.className='';target.replaceChildren();}},850);}
        }
        ctx.toast(`${definition(id)?.name||'장비'} ${level}성 각성! 같은 종류의 모든 장비에 적용돼요.`);
      }else ctx.toast(result.kind==='gear-equip'?'장비를 착용했어요. 다음 웨이브부터 적용됩니다.':'장비를 해제했어요. 다음 웨이브부터 적용됩니다.');
    }
    return {open,close,refresh,handleResult};
  }
  return Object.freeze({create,slotsMarkup,lootMarkup,dropDetails,snapshotMarkup});
})();
