/* Skill charge/status presentation shared by campaign and cooperative fights. */
window.SchoolSkillCards=(()=>{
 'use strict';
 const G=window.SchoolRPG,clamp=n=>Math.max(0,Math.min(100,n)),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ice='<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M8 30 28 9 73 6 94 33 89 84 55 98 10 83Z"/><path d="m28 9 14 32-32 42m63-77-18 35 34 43M8 30l34 11 13 57m39-65L55 41 10 83m32-42 13 0"/></svg>';
 function layers(id,skin){const src=(window.SchoolArt.displayPortrait||window.SchoolArt.portrait)(id,skin);return `<span class="skill-portrait"><img class="skill-base" src="${esc(src)}" alt=""><img class="skill-lit" src="${esc(src)}" alt=""><span class="skill-water"></span></span><span class="skill-status-art">${ice}<i>✦</i></span><span class="party-cooldown" aria-hidden="true"></span><span class="skill-state-label" aria-hidden="true"></span><span class="party-info"><b>${G.BY_ID[id].name}</b></span>`;}
 function status(u,{elapsed=0,phase='fight',frozen=false,casting=false,stacks=null}={}){
  const d=G.BY_ID[u.id],dead=u.hp<=0,ice=!!frozen||u.frozenUntil>elapsed,stun=!ice&&u.stunUntil>elapsed;
  const blocked=dead||ice||stun;let charge=dead?0:stacks!==null?clamp(stacks/5*100):clamp((u.energy||0)/d.cooldown*100);
  let conditional=null;
  if(u.id==='yaho')conditional=u.yaho?.summoned?'산군의 가호':`${Math.ceil(Math.max(0,18000-(u.yaho?.activeMs||0))/1000)}초 · 산군`;
  if(u.id==='hyeokjin'&&u.hyeokjin){const q=u.hyeokjin;conditional=q.ultimateUsed?'궁극기 소진':!q.used?'HP 35% · 각성':q.until>elapsed?'각성 · 위기 시 궁극기':'각성 종료';charge=q.ultimateUsed?0:q.ultimateArmed?100:!q.used?clamp((1-u.hp/Math.max(1,u.max))/.65*100):0;}
  if(dead)charge=0;
  const seconds=Math.ceil(Math.max(0,d.cooldown-(u.energy||0)));
  return {state:dead?'fallen':ice?'frozen':stun?'stunned':phase!=='fight'?'waiting':casting?'casting':charge>=100?'ready':'charging',charge:casting&&!blocked?100:charge,seconds,label:dead?'전투불능':ice?'빙결 · 사용 불가':stun?'기절 · 사용 불가':phase!=='fight'?'대기':casting?'시전':conditional|| (charge>=100?'준비':stacks!==null?`${stacks}/5`:seconds+'초')};
 }
 function update(card,u,options={}){
  if(!card||!u||!G.BY_ID[u.id])return;const s=status(u,options);
  if(card.dataset.skillState!==s.state)card.dataset.skillState=s.state;
  const fill=s.charge.toFixed(2)+'%';if(card.style.getPropertyValue('--skill-charge')!==fill)card.style.setProperty('--skill-charge',fill);
  for(const name of ['fallen','casting','ready','frozen','stunned'])card.classList.toggle(name,s.state===name);
  const label=card.querySelector('.skill-state-label'),count=card.querySelector('.party-cooldown');
  const text=['frozen','stunned','fallen'].includes(s.state)?s.label:'';if(label&&label.textContent!==text)label.textContent=text;
  const charge=['frozen','stunned','fallen'].includes(s.state)?'':s.label;if(count&&count.textContent!==charge)count.textContent=charge;
  card.setAttribute('aria-label',`${G.BY_ID[u.id].name} · ${s.label} · 스킬 충전 ${Math.round(s.charge)}%`);
  card.title=`${G.BY_ID[u.id].name} · ${s.label}`;
 }
 function coop(root,units,options){if(!root)return;const key=units.map(u=>u.id+':'+u.skin).join('|');if(root.dataset.team!==key){root.dataset.team=key;root.innerHTML=units.map(u=>`<div class="party-card coop-skill-card" data-hero="${u.id}" data-rarity="${G.BY_ID[u.id].rarity}">${layers(u.id,u.skin)}</div>`).join('');}units.forEach(u=>{const cast=options.events?.findLast(e=>e.kind==='cast'&&e.id===u.id&&e.team===options.team&&e.shown<=options.now&&options.now-e.shown<850);update(root.querySelector(`[data-hero="${u.id}"]`),u,{...options,casting:!!cast,stacks:u.id==='horas'?u.stacks||0:null});});}
 return Object.freeze({layers,status,update,coop});
})();
