/* Winter duo rules. Only the server advances the encounter or accepts a thaw. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SchoolYetiRules=api;})(globalThis,()=>{
 'use strict';
 const HP=800000,DURATION=210000,MAX_PLAYERS=2,RECOMMENDED_LEVEL=70,DIFFICULTY='어려움';
 const RULES=Object.freeze({version:2,hp:HP,duration:DURATION,attack:1000,rage:4,recommendedLevel:RECOMMENDED_LEVEL,difficulty:DIFFICULTY});
 const LEGACY_RULES=Object.freeze({version:1,hp:1600000,duration:150000,attack:480,rage:3,recommendedLevel:100,difficulty:'어려움'});
 const encounterRules=s=>s?.yetiRules||LEGACY_RULES;
 const PATTERNS=Object.freeze([
  {id:'claw',name:'서리 발톱',tell:1000,desc:'전열 2명을 공격하고 1초 기절시켜요.'},
  {id:'freeze',name:'꽁꽁 얼음!',tell:1800,desc:'한쪽 용병단을 얼려요. 동료의 얼음땡이 필요해요.'},
  {id:'slam',name:'빙하 내려찍기',tell:1400,desc:'모두를 공격하고 1.5초 기절시켜요.'},
  {id:'guard',name:'만년설 갑옷',tell:1000,desc:'6초 동안 받는 피해가 40% 줄어요.'},
  {id:'charge',name:'눈사태 돌진',tell:1600,desc:'전열 3명을 공격하고 2초 기절시켜요.'},
  {id:'blizzard',name:'백야의 눈보라',tell:1600,desc:'모두를 공격하고 1초 기절시켜요.'}
 ]);
 function create(g,parties,now,seed){
  if(parties.length!==2)throw Error('예티는 두 명이 함께 도전해야 해요.');
  const s=globalThis.SchoolRaidRules.create(g,parties,now,seed,HP);
  s.encounter='yeti';s.yetiRules={...RULES};s.boss.max=HP;s.boss.nextAt=3000;s.boss.pattern=0;s.freezeNext=0;
  for(const t of s.teams){t.frozen=null;t.thaws=0;}
  return s;
 }
 function bossAct({s,emit,hurt,living,basicRate}){
  const b=s.boss;if(b.stunUntil>s.elapsed)return;
  if(b.cast&&s.elapsed>=b.cast.at){
   const id=b.cast.id;b.cast=null;b.nextBasicAt=s.elapsed+1200;emit('impact',{pattern:id});
   if(id==='guard'){b.guardUntil=s.elapsed+6000;return;}
   if(id==='freeze'){
    if(!s.teams.some(t=>t.frozen)){
     const ti=s.freezeNext++%2,t=s.teams[ti],other=s.teams[1-ti];
     if(t&&!t.withdrawn&&living(t).length&&other&&!other.withdrawn&&living(other).length){
      t.frozen={id:`ice-${s.seq+1}`,at:s.elapsed};
      emit('freeze',{team:ti,freezeId:t.frozen.id});
     }
    }
    return;
   }
   s.teams.forEach((t,ti)=>{
    const targets=['slam','blizzard'].includes(id)?living(t):living(t).slice(0,id==='charge'?3:2);
    for(const unit of targets){const hit=hurt(ti,unit,id==='charge'?1.3:id==='slam'?.85:id==='blizzard'?.65:1,id);if(hit?.hp>0)hit.stunUntil=Math.max(hit.stunUntil,s.elapsed+(id==='charge'?2000:id==='slam'?1500:1000));}
   });
  }
  if(!b.cast&&s.elapsed>=b.nextAt){const p=PATTERNS[b.pattern++%PATTERNS.length];b.cast={id:p.id,at:s.elapsed+p.tell};b.nextAt=s.elapsed+5500;emit('telegraph',{pattern:p.id,impactAt:b.cast.at});}
  if(!b.cast&&s.elapsed>=b.nextBasicAt){b.nextBasicAt=(b.nextBasicAt>s.elapsed-250?b.nextBasicAt:s.elapsed)+2000/(basicRate?.(b,true)||1);emit('impact',{pattern:'basic'});s.teams.forEach((t,ti)=>hurt(ti,living(t)[0],.55,'basic'));}
 }
 function tick({s,emit,hurt,living}){
  expireRescues(s,s.startedAt+s.elapsed);
  for(let ti=0;ti<s.teams.length;ti++){
   const t=s.teams[ti];if(t.frozen&&s.elapsed-t.frozen.at>=3000&&s.elapsed%3000===0){for(const u of living(t))hurt(ti,u,.3,'frostbite');}
  }
  if(s.teams.every(t=>t.withdrawn||!living(t).length||t.frozen)){s.ended=true;s.outcome='trapped';emit('end',{outcome:s.outcome});}
 }
 function advance(g,s,now){const rules=encounterRules(s);return globalThis.SchoolRaidRules.advance(g,s,now,{physical:true,duration:rules.duration,attack:rules.attack,rage:rules.rage,bossAct,tick});}
 function thaw(g,s,actor,freezeId,now){
  advance(g,s,now);
  const ti=s.teams.findIndex(t=>t.account===actor),own=s.teams[ti],target=s.teams[1-ti];
  if(s.ended||!own||own.withdrawn||own.frozen||!own.units.some(u=>u.hp>0)||!target?.frozen||target.frozen.id!==freezeId||!target.units.some(u=>u.hp>0))throw Error('동료의 현재 얼음만 해제할 수 있어요.');
  target.frozen=null;own.thaws++;
  for(const u of target.units)if(u.hp>0){u.stunUntil=s.elapsed;u.shield=Math.min(u.max*.6,u.shield+Math.round(u.max*.08));}
  s.events.push({seq:++s.seq,t:s.elapsed,kind:'thaw',team:1-ti,fromTeam:ti,freezeId});s.events=s.events.slice(-240);
  return s;
 }
 function withdraw(s,account){const t=s.teams.find(t=>t.account===account);if(t){t.withdrawn=true;t.frozen=null;for(const u of t.units)u.hp=0;}s.ended=true;s.outcome='abandoned';s.events.push({seq:++s.seq,t:s.elapsed,kind:'end',outcome:s.outcome});}
 function rescueFail(s,t,challenge){
  challenge.outcome='failed';t.rescueLockUntil=s.elapsed+15000;
  for(const u of t.units)if(u.hp>0)u.stunUntil=Math.max(u.stunUntil||0,t.rescueLockUntil);
  s.events.push({seq:++s.seq,t:s.elapsed,kind:'rescue-failed',team:s.teams.indexOf(t),until:t.rescueLockUntil});
 }
 function expireRescues(s,now){for(const t of s.teams){const q=t.rescue;if(q?.outcome==='pending'&&now>q.expiresAt){if(s.ended)q.outcome='cancelled';else rescueFail(s,t,q);}}}
 function startRescue(s,actor,freezeId,mode,sequence,now){
  const i=s.teams.findIndex(t=>t.account===actor),t=s.teams[i],other=s.teams[1-i];
  if(s.ended||!t||t.withdrawn||t.frozen||t.rescueLockUntil>s.elapsed||!t.units.some(u=>u.hp>0)||!other?.frozen||other.frozen.id!==freezeId||!other.units.some(u=>u.hp>0))throw Error('현재 동료를 구출할 수 없어요.');
  if(t.rescue?.outcome==='pending')return;
  if(!['touch','keyboard'].includes(mode))throw Error('입력 방식을 확인해 주세요.');
  t.rescue={id:freezeId+':'+(++s.seq),freezeId,mode,sequence:mode==='touch'?[0,1,2,3]:sequence,outcome:'pending',expiresAt:now+2600};
 }
 function finishRescue(g,s,actor,id,inputs,now){
  const t=s.teams.find(t=>t.account===actor),q=t?.rescue;
  if(!q||q.id!==id)throw Error('구출 도전이 바뀌었어요.');
  if(q.outcome!=='pending')return;
  const correct=Array.isArray(inputs)&&inputs.length===4&&(q.mode==='touch'?new Set(inputs).size===4&&inputs.every(k=>q.sequence.includes(k)):inputs.every((k,i)=>k===q.sequence[i]));
  if(now>q.expiresAt||!correct){rescueFail(s,t,q);return;}
  thaw(g,s,actor,q.freezeId,now);q.outcome='success';
 }
 return {HP,DURATION,MAX_PLAYERS,RECOMMENDED_LEVEL,DIFFICULTY,RULES,LEGACY_RULES,encounterRules,PATTERNS,create,advance,thaw,withdraw,startRescue,finishRescue,expireRescues};
});
