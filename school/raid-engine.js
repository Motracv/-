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
 const TWIN_PATTERNS=[
  {id:'cross',name:'교차 협공',tell:1500,desc:'홍과 록이 전방 한 명에게 동시에 돌진합니다.'},
  {id:'relay',name:'추격 연계',tell:1250,desc:'홍의 선제 베기 후 0.75초 뒤 록이 후속 타격합니다.'},
  {id:'slam',name:'합동 내려치기',tell:1750,desc:'두 보스가 도약해 전방 세 명을 함께 내려칩니다.'}
 ];
 const ROTATION_START=Date.parse('2026-11-21T00:00:00+09:00'),WEEK=7*86400000;
 function rotation(now){const index=Math.max(0,Math.floor((now-ROTATION_START)/WEEK));return{key:'twins-week-'+index,bossId:index%2?'balloon':'twins',nextAt:ROTATION_START+(index+1)*WEEK};}
 const bossInfo=id=>id==='twins'?{id:'twins',name:'홍 · 록',rule:'마법 무효 · 물리 공격만 유효',patterns:TWIN_PATTERNS}:{id:'balloon',name:'벌룬',rule:'물리 무효 · 마법 공격만 유효',patterns:PATTERNS};
 const acceptsDamage=(boss,magic,encounter)=>encounter?.physical?true:boss.id==='twins'?!magic:!!magic;
 const magical=(g,id)=>['마법','치유'].includes(g.BY_ID[id]?.role)||id==='horas'||id==='spica';
 function snapshot(g,s){const team={synergy:g.partySynergies(s),rescued:false,buffUntil:0,damage:0,units:s.team.slice(0,6).map(id=>{const d=g.BY_ID[id],st=g.stats(id,s.units[id],s);return{id,...(g.equippedSkin?.(s,id)?{skin:g.equippedSkin(s,id)}:{}),name:d.name,role:d.role,level:s.units[id].level,stars:s.units[id].stars,magic:magical(g,id),max:st.hp,hp:st.hp,atk:st.atk,defense:st.defense,shield:0,energy:0,stage:1,hits:0,stacks:0,stunUntil:0,protectedUntil:0,nextBasic:0,damage:0,healing:0,exclusive:g.exclusivePassive?.(s,id)||null};})};team.units.forEach(u=>g.hyeokjinInit(u,team.units));return team;}
 function create(g,members,now,seed,hp=HP,bossId='balloon'){return{rules:3,startedAt:now,elapsed:0,seed:seed>>>0||1,seq:0,events:[],ended:false,outcome:null,damage:0,teams:members.map(m=>({account:m.account,...snapshot(g,m.save)})),boss:{id:bossId==='twins'?'twins':'balloon',hp,max:HP,guardUntil:0,stunUntil:0,nextAt:3000,nextBasicAt:1250,pattern:0,cast:null}};}
 function advance(g,s,now,encounter){
  const duration=encounter?.duration||DURATION,tactical=s.teams.some(t=>t.units.some(u=>u.id==='spica'));
  const basicRate=(unit,boss=false)=>(g.basicAttackRate?.(unit,s.elapsed,boss)||1)*(encounter?.rate?.(unit,s.elapsed)||1);
  const nextBasic=(previous,interval,unit,boss=false)=>(previous>0&&previous>s.elapsed-STEP?previous:s.elapsed)+interval/basicRate(unit,boss);
  const defense=hero=>g.ryusionDefense?.(hero)||g.RYUSION_RULES;
  const end=Math.min(duration,Math.max(0,Math.floor((now-s.startedAt)/STEP)*STEP));
  const random=()=>{let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x>>>0;return s.seed/4294967296;};
  const emit=(kind,extra={})=>s.events.push({seq:++s.seq,t:s.elapsed,kind,...extra});
  const living=t=>t.units.filter(u=>u.hp>0),weak=t=>living(t).sort((a,b)=>a.hp/a.max-b.hp/b.max)[0];
  const shield=(ti,u,amount,from)=>{const n=Math.max(0,Math.min(Math.round(amount*g.yahoMasterMultiplier(from,s.teams[ti].units)),Math.floor(u.max*.6)-u.shield));u.shield+=n;if(n)emit('shield',{team:ti,id:u.id,from,amount:n});};
  const heal=(ti,u,amount,from)=>{const t=s.teams[ti],before=u.hp,n=Math.max(0,Math.min(u.max-u.hp,Math.round(amount*t.synergy.healMultiplier*g.yahoMasterMultiplier(from,t.units))));u.hp+=n;const caster=t.units.find(a=>a.id===from);if(caster)caster.healing+=n;if(n)emit('heal',{team:ti,id:u.id,from,amount:n,hpBefore:before,hpAfter:u.hp});};
  const hyeokEmit=(ti,u)=>(kind,extra)=>{if(kind==='heal')u.healing+=extra.amount;emit(kind,{team:ti,id:u.id,from:u.id,...extra});};
  const hit=(ti,u,mult,skill,prepared)=>{if(!s.boss.hp)return 0;const crit=prepared?prepared.crit:random()<.12,power=prepared?prepared.amount:u.atk*mult*(.9+random()*.2)*(crit?1.5:1)*s.teams[ti].synergy.damageMultiplier*(s.teams[ti].buffUntil>s.elapsed?1.3:1)*(1+(u.exclusive?.strength||0));const n=acceptsDamage(s.boss,u.magic,encounter)?Math.min(s.boss.hp,Math.max(1,Math.round(power*(encounter?.damage?.(u,s.elapsed)||1)*(prepared?.ultimate?1:g.yahoDamageMultiplier(u,s.elapsed)*g.yahoMasterMultiplier(u.id,s.teams[ti].units))*(s.boss.guardUntil>s.elapsed?.6:1)*(u.id==='horas'&&s.boss.stunUntil>s.elapsed?1.5:1)))):0;s.boss.hp-=n;s.damage+=n;s.teams[ti].damage+=n;u.damage+=n;emit(n?'hit':'immune',{team:ti,id:u.id,amount:n,crit:crit&&n>0,skill:skill||null,...(prepared&&!prepared.hyeokjin?{breath:true,tick:prepared.tick}:{} )});g.hyeokjinRecord(u,n,s.elapsed,hyeokEmit(ti,u),!!prepared?.ultimate);return n;};
  function hurt(ti,original,mult,pattern){if(pattern==='basic')original=g.lowAggroTarget(original,living(s.teams[ti]),random);const t=s.teams[ti],guard=g.ryusionGuard(t.units,s.elapsed),u=guard.taunting?guard.hero:original;if(!u||u.hp<=0)return;
   if(u.id==='kazua'&&random()<g.KAZUA_RULES.evasion){emit('dodge',{team:ti,id:u.id});return null;}
   const hpBefore=u.hp,shieldBefore=u.shield;
   let n=Math.max(1,Math.round(((encounter?.attack??480)+s.elapsed/1000*(encounter?.rage??4))*mult*(1-u.defense)*g.yahoProtectionMultiplier(u,s.elapsed)*t.synergy.incomingMultiplier*(guard.hero?1-g.RYUSION_RULES.teamReduction:1)*(guard.taunting&&u.id==='ryusion'?1-defense(guard.hero).tauntReduction:1)));
   if(u.id==='hyeokjin'&&s.elapsed<g.hyeokjinRefresh(u,t.units,s.elapsed,hyeokEmit(ti,u)).lastUntil)n=0;
   const absorbed=Math.min(u.shield,n);u.shield-=absorbed;n-=absorbed;g.absorbEarthShield(u,absorbed);
   n=g.hyeokjinGuard(u,t.units,s.elapsed,n,hyeokEmit(ti,u));
   if(n>=u.hp&&!t.rescued&&living(t).some(a=>a.id==='lava')){t.rescued=true;u.protectedUntil=s.elapsed+2000;emit('rescue',{team:ti,id:u.id});}
   if(u.protectedUntil>s.elapsed)n=Math.min(n,Math.max(0,u.hp-1));n=Math.min(u.hp,n);u.hp-=n;u.taken=(u.taken||0)+n;u.absorbed=(u.absorbed||0)+absorbed;emit('hurt',{team:ti,id:u.id,amount:n,absorbed,pattern,hpBefore,hpAfter:u.hp,shieldBefore,shieldAfter:u.shield});
   if(u.id==='horas'&&n>0&&s.elapsed>=(u.lastHit||-1000)+1000){u.lastHit=s.elapsed;u.stacks=Math.min(5,u.stacks+1);}return u;
  }
  function twinAct(){const b=s.boss;
   // Freeze the complete attack clock while stunned, including pending relay strikes.
   if(b.stunUntil>s.elapsed){if(b.cast){b.cast.at+=STEP;for(let i=b.cast.next;i<b.cast.hits.length;i++)b.cast.hits[i]+=STEP;if(b.combo){b.combo.began+=STEP;b.combo.hits=b.cast.hits.slice();}}b.nextAt+=STEP;return;}
   if(b.cast){const cast=b.cast;
    while(cast.next<cast.hits.length&&s.elapsed>=cast.hits[cast.next]){const actor=cast.next++;emit('impact',{pattern:cast.id,actor,comboAt:cast.began});
     s.teams.forEach((t,ti)=>{const targets=living(t).slice(0,cast.id==='slam'?3:1);for(const v of targets)hurt(ti,v,cast.id==='slam'?.72:cast.id==='relay'?.95:.85,cast.id);});
    }
    if(cast.next===cast.hits.length)b.cast=null;
   }
   if(!b.cast&&s.elapsed>=b.nextAt){const p=TWIN_PATTERNS[b.pattern++%TWIN_PATTERNS.length],at=s.elapsed+p.tell,hits=[at,at+(p.id==='relay'?750:0)];b.cast={id:p.id,began:s.elapsed,at,hits,next:0};b.combo={id:p.id,began:s.elapsed,hits:hits.slice()};b.nextAt=at+5000;emit('telegraph',{pattern:p.id,impactAt:at,hits:hits.slice()});}
  }
  function bossAct(){if(encounter?.bossAct){encounter.bossAct({s,emit,hurt,living,basicRate});return;}const b=s.boss;if(b.id==='twins'){twinAct();return;}if(b.stunUntil>s.elapsed)return;
   if(b.cast&&s.elapsed>=b.cast.at){const id=b.cast.id;emit('impact',{pattern:id});b.cast=null;b.nextBasicAt=s.elapsed+750;
    if(id==='guard'){b.guardUntil=s.elapsed+6000;return;}
    s.teams.forEach((t,ti)=>{const live=living(t);let targets=id==='storm'?live:id==='pull'?live.sort((a,b)=>b.atk-a.atk).slice(0,1):live.slice(0,id==='rise'?3:id==='dash'?2:1);for(const v of targets){const u=hurt(ti,v,id==='storm'?.7:id==='dash'?1.65:id==='pull'?1.15:1.2,id);if(id==='pull'&&u?.hp>0)u.stunUntil=s.elapsed+1000;}});
   }
   if(!b.cast&&s.elapsed>=b.nextAt){const p=PATTERNS[b.pattern++%PATTERNS.length];b.cast={id:p.id,at:s.elapsed+p.tell};b.nextAt=s.elapsed+4500;emit('telegraph',{pattern:p.id,impactAt:b.cast.at});}
   if(b.nextBasicAt==null)b.nextBasicAt=s.elapsed+500;
   if(!b.cast&&s.elapsed>=b.nextBasicAt){b.nextBasicAt=nextBasic(b.nextBasicAt,BOSS_BASIC_MS,b,true);emit('impact',{pattern:'basic'});s.teams.forEach((t,ti)=>hurt(ti,living(t)[0],.75,'basic'));}
  }
  function act(ti,u){const t=s.teams[ti];
   if(u.id==='osia')g.osiaWeaponStep?.(u,[s.boss],s.elapsed,STEP,(target,amount,detail)=>{const before=target.hp,n=acceptsDamage(target,u.magic,encounter)?Math.min(target.hp,Math.max(0,Math.round(amount*(encounter?.damage?.(u,s.elapsed)||1)*(target.guardUntil>s.elapsed?.6:1)))):0;target.hp-=n;s.damage+=n;t.damage+=n;u.damage+=n;emit(n?'hit':'immune',{team:ti,id:u.id,amount:n,crit:false,skill:'익사',drowning:true,damageType:'magic',hpBefore:before,hpAfter:target.hp});return n;},(kind,extra)=>emit(kind,{team:ti,id:u.id,...extra}),u.stunUntil>s.elapsed||t.frozen||t.withdrawn,{guildRaid:s.encounter!=='yeti'});
   if(u.id==='hyeokjin'){g.hyeokjinStep(u,t.units,[s.boss],s.elapsed,STEP,(_,amount,d)=>hit(ti,u,amount/u.atk,d.skill,d.fixed?{amount,crit:false,hyeokjin:true,ultimate:true}:undefined),hyeokEmit(ti,u),u.hp<=0||u.stunUntil>s.elapsed||t.frozen||t.withdrawn,basicRate(u));return;}
   if(u.id==='kazua'){g.kazuaStep(u,t.units,[s.boss],s.elapsed,STEP,(_,mult,d)=>hit(ti,u,mult,d.skill),(kind,extra)=>emit(kind,{team:ti,id:u.id,...extra}),u.hp<=0||u.stunUntil>s.elapsed||t.frozen||t.withdrawn,basicRate(u));return;}
   if(u.breath){
    const cast=u.breath,r=g.OSIA_BREATH_RULES,age=s.elapsed-cast.began;
    if(u.hp<=0||u.stunUntil>s.elapsed||t.frozen||t.withdrawn){delete u.breath;emit('osia-breath-cancel',{team:ti,id:u.id,breath:true});return;}
    if(age>=r.windupMs+r.breathMs){delete u.breath;return;}
    const tick=cast.tick;if(tick<r.ticks&&age>=r.windupMs+tick*r.tickMs){cast.tick++;
     const amount=Math.round(cast.amount*(tick+1)/r.ticks)-Math.round(cast.amount*tick/r.ticks);
     if(amount>0)hit(ti,u,0,'용의 신수',{amount,crit:cast.crit,tick});
     if(!tick&&s.boss.hp>0){if(acceptsDamage(s.boss,u.magic,encounter)){s.boss.stunUntil=Math.max(s.boss.stunUntil,s.elapsed+r.stunMs);emit('stun',{team:ti,id:u.id,duration:r.stunMs,until:s.boss.stunUntil});}shield(ti,u,u.atk*(u.exclusive.dragonShield||.2),u.id);}
    }
    return;
   }
   if(u.id==='yaho'&&g.yahoStep(u,t.units,s.elapsed,STEP,(a,n)=>heal(ti,a,n,u.id),(kind,extra)=>{emit(kind,{team:ti,id:u.id,from:u.id,...extra});emit('cast',{team:ti,id:u.id,skill:extra.name,stage:extra.stage});},u.hp<=0||u.stunUntil>s.elapsed||t.frozen||t.withdrawn)){u.nextSkillAt=s.elapsed+g.YAHO_RULES.cooldown*1000;return;}
   if(u.hp<=0||u.stunUntil>s.elapsed||t.frozen||t.withdrawn||u.yahoCastUntil>s.elapsed)return;
   if(u.cast){if(s.elapsed<u.cast.at)return;const cast=u.cast;delete u.cast;if(!cast.miss){hit(ti,u,g.HORAS_RULES.primaryMultiplier,'벚꽃의식');emit('ritual',{team:ti,id:u.id});}else emit('miss',{team:ti,id:u.id});return;}
   if(u.id==='horas'){
    if(u.stacks>=5){u.stacks=0;u.cast={at:s.elapsed+1500,miss:random()<.1};emit('cast',{team:ti,id:u.id,skill:'벚꽃의식'});return;}
    if(s.elapsed<u.nextBasic)return;u.nextBasic=nextBasic(u.nextBasic,1500,u);u.basicPose=u.basicPose===1?2:1;hit(ti,u,g.HORAS_RULES.basicMultiplier);u.stacks=Math.min(5,u.stacks+1);return;
   }
   const def=g.BY_ID[u.id];if(u.nextSkillAt==null)u.nextSkillAt=s.elapsed+(def.cooldown-(u.energy||0))*1000;
   const skill=s.elapsed>=u.nextSkillAt;u.energy=Math.max(0,def.cooldown-(u.nextSkillAt-s.elapsed)/1000);
   if(!skill&&s.elapsed<u.nextBasic)return;u.nextBasic=skill?(tactical?Math.max(u.nextBasic||s.elapsed,s.elapsed):s.elapsed)+BASIC_MS/basicRate(u):nextBasic(u.nextBasic,BASIC_MS,u);
   if(skill){u.energy=0;u.nextSkillAt=s.elapsed+def.cooldown*1000;}
   if(skill&&u.id==='osia'&&u.stage===4&&g.osiaDivine(u)){
    const crit=random()<.12,amount=Math.round(u.atk*2.2*g.osiaSkillMultiplier(u,4)*(.9+random()*.2)*(crit?1.5:1)*t.synergy.damageMultiplier*(t.buffUntil>s.elapsed?1.3:1)*(1+(u.exclusive?.strength||0)));
    u.breath={began:s.elapsed,tick:0,amount,crit};u.stage=1;
    emit('cast',{team:ti,id:u.id,skill:'용의 신수',stage:4,breath:true});emit('dragon',{team:ti,id:u.id,divine:true,breath:true});return;
   }
   if(skill&&u.id==='yaho'){g.yahoCast(u,t.units,s.elapsed,(a,n)=>heal(ti,a,n,u.id),(kind,extra)=>{emit(kind,{team:ti,id:u.id,from:u.id,...extra});emit('cast',{team:ti,id:u.id,skill:extra.name,stage:extra.stage});});return;}
   if(skill){emit('cast',{team:ti,id:u.id,skill:u.id==='osia'?g.osiaSkillName(u,u.stage):def.skill,stage:u.stage});
    if(u.id==='ryusion'){if(u.stage===2)for(const a of living(t)){const n=g.addEarthShield(a,u.max*defense(u).shieldRatio,s.elapsed);emit('shield',{team:ti,id:a.id,from:u.id,amount:n});}else hit(ti,u,1,'돌격 앞으로');u.stage=u.stage%2+1;return;}
    if(u.id==='spica'){const p=g.SPICA_RULES;for(const a of living(t))a.hasteUntil=Math.max(a.hasteUntil||0,s.elapsed+p.hasteMs);s.boss.slowUntil=Math.max(s.boss.slowUntil||0,s.elapsed+p.slowMs);emit('spica-wind',{team:ti,id:u.id,hasteUntil:s.elapsed+p.hasteMs,slowUntil:s.boss.slowUntil});hit(ti,u,p.skillMultiplier,def.skill);return;}
    if(u.id==='lava'){const bonus=1+(u.exclusive?.strength||0);if(u.stage===1)for(const a of living(t)){heal(ti,a,u.atk*1.6*bonus,u.id);shield(ti,a,u.atk*.9*bonus,u.id);}else{const a=weak(t);if(a)heal(ti,a,u.atk*4.5*bonus,u.id);}u.stage=u.stage%2+1;return;}
    if(u.role==='치유'){for(const a of living(t))heal(ti,a,u.atk*2.2,u.id);return;}
    if(u.role==='수호')shield(ti,u,u.max*.25,u.id);
    if(u.role==='지원')t.buffUntil=s.elapsed+3000;
    if(u.id==='osia'){hit(ti,u,2.2*g.osiaSkillMultiplier(u,u.stage),g.osiaSkillName(u,u.stage));if(u.stage===4){if(acceptsDamage(s.boss,u.magic,encounter))s.boss.stunUntil=s.elapsed+1500;emit('dragon',{team:ti,id:u.id,divine:g.osiaDivine(u)});if(g.osiaDivine(u))shield(ti,u,u.atk*(u.exclusive.dragonShield||.2),u.id);}u.stage=u.stage%4+1;return;}
   }
   if(!skill&&u.id==='yaho')g.yahoBasic(u,t.units,(a,n)=>heal(ti,a,n,u.id));
   const n=hit(ti,u,skill?(u.role==='마법'?1.7:u.role==='사수'?2.6:u.role==='전사'?3:1):g.osiaBasicMultiplier(u),skill?def.skill:null);
   if(u.id==='lava'&&n>0&&++u.hits%10===0){const a=weak(t);if(a)shield(ti,a,(u.atk*2+a.max*.08)*(1+(u.exclusive?.strength||0)),u.id);}
  }
  while(!s.ended&&s.elapsed<end){s.elapsed+=STEP;encounter?.tick?.({s,emit,hurt,living});if(s.ended)break;
   for(let ti=0;ti<s.teams.length;ti++){const t=s.teams[ti];for(const u of t.units)g.expireEarthShield(u,s.elapsed);const guard=g.ryusionGuard(t.units,s.elapsed);if(guard.taunting){const began=s.elapsed-s.elapsed%g.RYUSION_RULES.tauntEvery;if(guard.hero.lastTauntAt!==began){guard.hero.lastTauntAt=began;const ratio=defense(guard.hero).tauntShieldRatio||0;if(ratio){const n=g.addEarthShield(guard.hero,Math.max(guard.hero.earthShield||0,guard.hero.max*ratio),s.elapsed);emit('shield',{team:ti,id:'ryusion',from:'ryusion',amount:n,skill:'대지의 맹세'});}emit('ryusion-taunt',{team:ti,id:'ryusion',until:began+g.RYUSION_RULES.tauntMs});}}}
   for(let i=0;i<s.teams.length;i++)for(const u of s.teams[i].units)if(s.boss.hp>0)act(i,u);
   if(s.boss.hp>0)bossAct();
   if(s.boss.hp<=0||s.teams.every(t=>!living(t).length)||s.elapsed>=duration){s.ended=true;s.outcome=s.boss.hp<=0?'defeated':s.teams.every(t=>!living(t).length)?'down':'timeout';emit('end',{outcome:s.outcome});}
   s.events=s.events.slice(-240);
  }return s;
 }
 const reward=damage=>damage>0?{gems:20+Math.min(60,Math.floor(damage/50000)*10),gold:Math.round((800+Math.min(3200,Math.floor(damage/1000)*10))*2.6)}:{gems:0,gold:0};
 return{HP,DURATION,LIMIT,MAX_PLAYERS,STEP,BASIC_MS,BOSS_BASIC_MS,PATTERNS,TWIN_PATTERNS,rotation,bossInfo,acceptsDamage,magical,snapshot,create,advance,reward};
});
