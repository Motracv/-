/* Shared deterministic raid rules. Only the server advances account raids. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SchoolRaidRules=api;})(globalThis,()=>{
 'use strict';
 const HP=50000000,DURATION=90000,LIMIT=5,MAX_PLAYERS=5,STEP=250,BASIC_MS=750,BOSS_BASIC_MS=1750;
 const PATTERNS=[
  {id:'slam',name:'푸른 지면타',tell:1200,desc:'전방 한 명을 내려치고 충격파를 일으킵니다.'},
  {id:'rise',name:'푸른 올려치기',tell:1400,desc:'전방 세 명을 향해 기운을 크게 올려칩니다.'},
  {id:'guard',name:'기체 응축',tell:1000,desc:'6초 동안 받는 마법 피해가 40% 감소합니다.'},
  {id:'dash',name:'쇄도하는 사슬',tell:1500,desc:'앞으로 질주한 뒤 전방 두 명을 타격합니다.'},
  {id:'pull',name:'사슬 낚아채기',tell:1400,desc:'공격력이 가장 높은 용병을 사슬로 묶어 1초 기절시킵니다.'},
  {id:'storm',name:'환영의 사슬폭풍',tell:1800,desc:'사슬을 회전시켜 아군 전체를 공격합니다.'}
 ];
 const magical=(g,id)=>['마법','치유'].includes(g.BY_ID[id]?.role)||id==='horas';
 function snapshot(g,s){return{synergy:g.partySynergies(s),rescued:false,buffUntil:0,damage:0,units:s.team.slice(0,6).map(id=>{const d=g.BY_ID[id],st=g.stats(id,s.units[id],s);return{id,name:d.name,role:d.role,level:s.units[id].level,stars:s.units[id].stars,magic:magical(g,id),max:st.hp,hp:st.hp,atk:st.atk,defense:st.defense,shield:0,energy:0,stage:1,hits:0,stacks:0,stunUntil:0,protectedUntil:0,nextBasic:0,damage:0,healing:0,exclusive:g.exclusivePassive?.(s,id)||null};})};}
 function create(g,members,now,seed,hp=HP){return{rules:2,startedAt:now,elapsed:0,seed:seed>>>0||1,seq:0,events:[],ended:false,outcome:null,damage:0,teams:members.map(m=>({account:m.account,...snapshot(g,m.save)})),boss:{hp,max:HP,guardUntil:0,stunUntil:0,nextAt:3000,nextBasicAt:1250,pattern:0,cast:null}};}
 function advance(g,s,now){
  const end=Math.min(DURATION,Math.max(0,Math.floor((now-s.startedAt)/STEP)*STEP));
  const random=()=>{let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x>>>0;return s.seed/4294967296;};
  const emit=(kind,extra={})=>s.events.push({seq:++s.seq,t:s.elapsed,kind,...extra});
  const living=t=>t.units.filter(u=>u.hp>0),weak=t=>living(t).sort((a,b)=>a.hp/a.max-b.hp/b.max)[0];
  const shield=(ti,u,amount,from)=>{const n=Math.max(0,Math.min(Math.round(amount),Math.floor(u.max*.6)-u.shield));u.shield+=n;if(n)emit('shield',{team:ti,id:u.id,from,amount:n});};
  const heal=(ti,u,amount,from)=>{const t=s.teams[ti],before=u.hp,n=Math.max(0,Math.min(u.max-u.hp,Math.round(amount*t.synergy.healMultiplier)));u.hp+=n;const caster=t.units.find(a=>a.id===from);if(caster)caster.healing+=n;if(n)emit('heal',{team:ti,id:u.id,from,amount:n,hpBefore:before,hpAfter:u.hp});};
  const hit=(ti,u,mult,skill)=>{if(!s.boss.hp)return 0;const crit=random()<.12;const n=u.magic?Math.min(s.boss.hp,Math.max(1,Math.round(u.atk*mult*(.9+random()*.2)*(crit?1.5:1)*s.teams[ti].synergy.damageMultiplier*(s.teams[ti].buffUntil>s.elapsed?1.3:1)*(s.boss.guardUntil>s.elapsed?.6:1)*(u.id==='horas'&&s.boss.stunUntil>s.elapsed?1.5:1)*(1+(u.exclusive?.strength||0))))):0;s.boss.hp-=n;s.damage+=n;s.teams[ti].damage+=n;u.damage+=n;emit(n?'hit':'immune',{team:ti,id:u.id,amount:n,crit:crit&&n>0,skill:skill||null});return n;};
  function hurt(ti,original,mult,pattern){const t=s.teams[ti],guard=g.ryusionGuard(t.units,s.elapsed),u=guard.taunting?guard.hero:original;if(!u||u.hp<=0)return;
   const hpBefore=u.hp,shieldBefore=u.shield;
   let n=Math.max(1,Math.round((480+s.elapsed/1000*4)*mult*(1-u.defense)*t.synergy.incomingMultiplier*(guard.hero?1-g.RYUSION_RULES.teamReduction:1)*(guard.taunting&&u.id==='ryusion'?1-g.RYUSION_RULES.tauntReduction:1)));
   const absorbed=Math.min(u.shield,n);u.shield-=absorbed;n-=absorbed;g.absorbEarthShield(u,absorbed);
   if(n>=u.hp&&!t.rescued&&living(t).some(a=>a.id==='lava')){t.rescued=true;u.protectedUntil=s.elapsed+2000;emit('rescue',{team:ti,id:u.id});}
   if(u.protectedUntil>s.elapsed)n=Math.min(n,Math.max(0,u.hp-1));n=Math.min(u.hp,n);u.hp-=n;u.taken=(u.taken||0)+n;u.absorbed=(u.absorbed||0)+absorbed;emit('hurt',{team:ti,id:u.id,amount:n,absorbed,pattern,hpBefore,hpAfter:u.hp,shieldBefore,shieldAfter:u.shield});
   if(u.id==='horas'&&n>0&&s.elapsed>=(u.lastHit||-1000)+1000){u.lastHit=s.elapsed;u.stacks=Math.min(5,u.stacks+1);}return u;
  }
  function bossAct(){const b=s.boss;if(b.stunUntil>s.elapsed)return;
   if(b.cast&&s.elapsed>=b.cast.at){const id=b.cast.id;emit('impact',{pattern:id});b.cast=null;b.nextBasicAt=s.elapsed+750;
    if(id==='guard'){b.guardUntil=s.elapsed+6000;return;}
    s.teams.forEach((t,ti)=>{const live=living(t);let targets=id==='storm'?live:id==='pull'?live.sort((a,b)=>b.atk-a.atk).slice(0,1):live.slice(0,id==='rise'?3:id==='dash'?2:1);for(const v of targets){const u=hurt(ti,v,id==='storm'?.7:id==='dash'?1.65:id==='pull'?1.15:1.2,id);if(id==='pull'&&u?.hp>0)u.stunUntil=s.elapsed+1000;}});
   }
   if(!b.cast&&s.elapsed>=b.nextAt){const p=PATTERNS[b.pattern++%PATTERNS.length];b.cast={id:p.id,at:s.elapsed+p.tell};b.nextAt=s.elapsed+4500;emit('telegraph',{pattern:p.id,impactAt:b.cast.at});}
   if(b.nextBasicAt==null)b.nextBasicAt=s.elapsed+500;
   if(!b.cast&&s.elapsed>=b.nextBasicAt){b.nextBasicAt=s.elapsed+BOSS_BASIC_MS;emit('impact',{pattern:'basic'});s.teams.forEach((t,ti)=>hurt(ti,living(t)[0],.75,'basic'));}
  }
  function act(ti,u){const t=s.teams[ti];if(u.hp<=0||u.stunUntil>s.elapsed)return;
   if(u.cast){if(s.elapsed<u.cast.at)return;const cast=u.cast;delete u.cast;if(!cast.miss){hit(ti,u,g.HORAS_RULES.primaryMultiplier,'벚꽃의식');emit('ritual',{team:ti,id:u.id});}else emit('miss',{team:ti,id:u.id});return;}
   if(u.id==='horas'){
    if(u.stacks>=5){u.stacks=0;u.cast={at:s.elapsed+1500,miss:random()<.1};emit('cast',{team:ti,id:u.id,skill:'벚꽃의식'});return;}
    if(s.elapsed<u.nextBasic)return;u.nextBasic=s.elapsed+1500;u.basicPose=u.basicPose===1?2:1;hit(ti,u,g.HORAS_RULES.basicMultiplier);u.stacks=Math.min(5,u.stacks+1);return;
   }
   const def=g.BY_ID[u.id];if(u.nextSkillAt==null)u.nextSkillAt=s.elapsed+(def.cooldown-(u.energy||0))*1000;
   const skill=s.elapsed>=u.nextSkillAt;u.energy=Math.max(0,def.cooldown-(u.nextSkillAt-s.elapsed)/1000);
   if(!skill&&s.elapsed<u.nextBasic)return;u.nextBasic=s.elapsed+BASIC_MS;
   if(skill){u.energy=0;u.nextSkillAt=s.elapsed+def.cooldown*1000;}
   if(skill){emit('cast',{team:ti,id:u.id,skill:u.id==='osia'?g.OSIA_SKILLS[u.stage-1].name:def.skill,stage:u.stage});
    if(u.id==='ryusion'){if(u.stage===2)for(const a of living(t)){const n=g.addEarthShield(a,u.max*g.RYUSION_RULES.shieldRatio,s.elapsed);emit('shield',{team:ti,id:a.id,from:u.id,amount:n});}else hit(ti,u,1,'돌격 앞으로');u.stage=u.stage%2+1;return;}
    if(u.id==='lava'){const bonus=1+(u.exclusive?.strength||0);if(u.stage===1)for(const a of living(t)){heal(ti,a,u.atk*1.6*bonus,u.id);shield(ti,a,u.atk*.9*bonus,u.id);}else{const a=weak(t);if(a)heal(ti,a,u.atk*4.5*bonus,u.id);}u.stage=u.stage%2+1;return;}
    if(u.role==='치유'){for(const a of living(t))heal(ti,a,u.atk*2.2,u.id);return;}
    if(u.role==='수호')shield(ti,u,u.max*.25,u.id);
    if(u.role==='지원')t.buffUntil=s.elapsed+3000;
    if(u.id==='osia'){hit(ti,u,2.2*(1+(u.exclusive?.skill||0)),g.OSIA_SKILLS[u.stage-1].name);if(u.stage===4){s.boss.stunUntil=s.elapsed+1500;emit('dragon',{team:ti,id:u.id});if(u.exclusive)shield(ti,u,u.atk*.2,u.id);}u.stage=u.stage%4+1;return;}
   }
   const n=hit(ti,u,skill?(u.role==='마법'?1.7:u.role==='사수'?2.6:u.role==='전사'?3:1):1,skill?def.skill:null);
   if(u.id==='lava'&&n>0&&++u.hits%10===0){const a=weak(t);if(a)shield(ti,a,(u.atk*2+a.max*.08)*(1+(u.exclusive?.strength||0)),u.id);}
  }
  while(!s.ended&&s.elapsed<end){s.elapsed+=STEP;
   for(const t of s.teams)for(const u of t.units)g.expireEarthShield(u,s.elapsed);
   for(let i=0;i<s.teams.length;i++)for(const u of s.teams[i].units)if(s.boss.hp>0)act(i,u);
   if(s.boss.hp>0)bossAct();
   if(s.boss.hp<=0||s.teams.every(t=>!living(t).length)||s.elapsed>=DURATION){s.ended=true;s.outcome=s.boss.hp<=0?'defeated':s.teams.every(t=>!living(t).length)?'down':'timeout';emit('end',{outcome:s.outcome});}
   s.events=s.events.slice(-240);
  }return s;
 }
 const reward=damage=>damage>0?{gems:20+Math.min(60,Math.floor(damage/50000)*10),gold:Math.round((800+Math.min(3200,Math.floor(damage/1000)*10))*2.6)}:{gems:0,gold:0};
 return{HP,DURATION,LIMIT,MAX_PLAYERS,STEP,BASIC_MS,BOSS_BASIC_MS,PATTERNS,magical,snapshot,create,advance,reward};
});
