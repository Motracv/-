(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SchoolRPG = api;
})(globalThis, function () {
  "use strict";
  const NORMAL_MAX_STAGE = 100, MAX_STAGE = 125, MAX_LEVEL = 125, CAPTAIN_MAX_LEVEL = 200, MAX_TEAM = 6, MAX_TOWER_FLOOR = 1000000, OFFLINE_CAP = 8 * 3600, CATALOG_VERSION = 53;
  const GOLD_MULTIPLIER = 2.6;
  const earnedGold = amount => Math.round(amount * 26 / 10);
  const DOUBLE_REWARD_EVENT = Object.freeze({ id:'weekend-double-2026', name:'주말 2배 이벤트', startsAt:Date.parse('2026-11-19T08:17:32Z'), endsAt:Date.parse('2026-11-23T08:17:32Z'), multiplier:2 });
  function eventInfo(now = Date.now()) {
    const e=DOUBLE_REWARD_EVENT, active=Number.isFinite(now)&&now>=e.startsAt&&now<e.endsAt;
    return {...e,active,upcoming:Number.isFinite(now)&&now<e.startsAt,multiplier:active?e.multiplier:1,remainingMs:active?e.endsAt-now:0,startsInMs:Math.max(0,e.startsAt-now)};
  }
  // Apply only at an earned reward boundary, never to a wallet, a stored reward,
  // a purchase, or a coupon. Gems and roulette tokens keep their stated amounts.
  function rewardBonus(reward, now = Date.now()) {
    const result={...reward}, multiplier=eventInfo(now).multiplier;
    for(const key of ['gold','xp','captainXp','snowflakes'])if(Number.isFinite(result[key]))result[key]*=multiplier;
    return result;
  }
  function offlineRewardSeconds(start, end) {
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return 0;
    const e=DOUBLE_REWARD_EVENT, overlap=Math.max(0,Math.min(end,e.endsAt)-Math.max(start,e.startsAt));
    return (end-start+overlap*(e.multiplier-1))/1000;
  }
  const PROFILE_AVATARS = Object.freeze(['knight','witch','scholar','bear','cat','bird']);
  const PROFILE_REWARDS = Object.freeze([Object.freeze({id:'rank-ntr',name:'랭킹 1등 기념 · T1',receipt:'RANK_NTR_1',private:true,image:'school/assets/profile/rank-ntr.webp?v=rank-ntr1'}),Object.freeze({id:'horas-after-school',name:'방과 후의 성좌 · 호라스',receipt:'HORAS_AFTER_SCHOOL_SKIN',private:true,image:'school/assets/horas-after-school/profile.webp?v=horas-illust1'}),Object.freeze({id:'rank-first',name:'랭킹 1등 기념',code:'랭킹1등축하드립니다',receipt:'RANKING_FIRST_CONGRATS',image:'school/assets/profile/rank-first.webp?v=rank-profile1'}),Object.freeze({id:'rank-first-2',name:'랭킹1위 프로필2',receipt:'RANK_RECLAIMER_2',private:true,image:'school/assets/profile/rank-first-2.webp?v=rank-profile2'})]);
  const ownsProfileAvatar = (s, id) => Object.values(BOND_CHARACTERS).some(m=>m.avatar===id&&s.bonds?.[m.id]?.read?.includes(2)) || id === 'leader' || PROFILE_AVATARS.includes(id) || PROFILE_REWARDS.some(p => p.id === id && Array.isArray(s.redeemedCodes) && s.redeemedCodes.includes(p.receipt));
  function normalizeCouponCode(value) {
    const code = String(value ?? '').normalize('NFC').trim().toUpperCase();
    return PROFILE_REWARDS.find(p => p.code === code)?.receipt || code;
  }
  function publicProfile(s){try{if(typeof s==='string')s=JSON.parse(s);const id=s?.profile?.avatar;return {avatar:ownsProfileAvatar(s||{},id)?id:'leader',hero:BY_ID[s?.team?.[0]]?s.team[0]:'taeo'};}catch{return{avatar:'leader',hero:'taeo'};}}
  const profileInfo = s => s.profile || {avatar:'leader',title:'',beta:true};
  const validProfile = (p,s) => p === undefined || p && typeof p === 'object' && !Array.isArray(p) && ownsProfileAvatar(s,p.avatar) && typeof p.beta === 'boolean' && ownsProfileTitle(s,p.title);
  const COUNTER_RULES = Object.freeze({ chance: .18, bossChance: .32, windowMs: 3500, cooldownMs: 10000, multiplier: 1.8 });
  const STEP_MS = 500;
  const OSIA_CINEMATIC_MS = 1000;
  const OSIA_BREATH_RULES = Object.freeze({windupMs:2000,breathMs:2300,recoveryMs:450,tickMs:500,ticks:5,stunMs:2000});
  const OSIA_SKILLS = [
    { stage: 1, impactDelay: 500, name: "대형 물탄" },
    { stage: 2, impactDelay: 500, name: "소용돌이" },
    { stage: 3, impactDelay: 500, name: "물기둥" },
    { stage: 4, impactDelay: 1000, name: "거대 수룡", stunMs: 1500 },
  ];
  const osiaSkill = s => OSIA_SKILLS[(s.units.osia?.nextSkill || 1) - 1];
  const LAVA_SKILLS = [
    { stage: 1, name: "바람의 부채", healMultiplier: 1.6, shieldMultiplier: .9 },
    { stage: 2, name: "바람의 상처", healMultiplier: 4.5 },
  ];
  const lavaSkill = s => LAVA_SKILLS[(s.units.lava?.nextSkill || 1) - 1];
  const YAHO_RULES = Object.freeze({cooldown:6,ultimateMs:18000,basicHeal:.9,basicHealth:.02,roarHeal:3.2,roarHealth:.04,damageBonus:.35,roarMs:8000,protection:.28,protectionMs:6000,grace:.42,graceMs:8000,graceHeal:1.6,ultimateHeal:4,ultimateHealth:.08,masterBonus:.4});
  function yahoInit(u){return u.yaho||=( {summoned:false,activeMs:0,next:1} );}
  function validYaho(u){const q=u.yaho;return (q===undefined||u.id==='yaho'&&q&&typeof q.summoned==='boolean'&&Number.isFinite(q.activeMs)&&q.activeMs>=0&&q.activeMs<=YAHO_RULES.ultimateMs&&[1,2].includes(q.next))&&['yahoRoarUntil','yahoGuardUntil','yahoCastUntil'].every(k=>u[k]===undefined||Number.isFinite(u[k])&&u[k]>=0)&&(u.yahoGrace===undefined||typeof u.yahoGrace==='boolean');}
  const yahoMasterMultiplier=(id,allies)=>id==='lava'&&allies.some(u=>u.id==='yaho'&&u.hp>0)&&allies.some(u=>u.id==='lava'&&u.hp>0)?1+YAHO_RULES.masterBonus:1;
  const yahoDamageMultiplier=(u,time)=>u&&time<(u.yahoRoarUntil||0)?1+YAHO_RULES.damageBonus:1;
  const yahoProtectionMultiplier=(u,time)=>time<(u.yahoGuardUntil||0)?1-(u.yahoGrace?YAHO_RULES.grace:YAHO_RULES.protection):1;
  function yahoBasic(u,allies,heal){if(u.hp<=0)return;const target=allies.filter(a=>a.hp>0).reduce((best,a)=>!best||a.hp/a.max<best.hp/best.max?a:best,null);if(target)heal(target,u.atk*YAHO_RULES.basicHeal+target.max*YAHO_RULES.basicHealth,'내가 건내준 힘');}
  function yahoCast(u,allies,time,heal,emit,summon=false){
    if(u.hp<=0)return false;const q=yahoInit(u),r=YAHO_RULES,live=allies.filter(a=>a.hp>0);
    if(summon&&q.summoned)return false;
    if(summon){q.summoned=true;q.activeMs=r.ultimateMs;u.energy=0;u.yahoCastUntil=time+1200;}
    const stage=summon?3:q.next,name=summon?'거스리는 자':stage===1?'포효':q.summoned?'산군의 가호':'산군의 보호';
    emit('yaho-skill',{stage,name,skill:name,guardian:q.summoned,element:'fire',targets:live.map(a=>a.id)});
    for(const a of live){
      if(stage===1){heal(a,u.atk*r.roarHeal+a.max*r.roarHealth,name);a.yahoRoarUntil=time+r.roarMs;}
      else{a.yahoGrace=q.summoned;a.yahoGuardUntil=time+(q.summoned?r.graceMs:r.protectionMs);if(summon)heal(a,u.atk*r.ultimateHeal+a.max*r.ultimateHealth,name);else if(q.summoned)heal(a,u.atk*r.graceHeal,name);}
    }
    if(!summon)q.next=stage===1?2:1;return true;
  }
  function yahoStep(u,allies,time,dt,heal,emit,blocked=false){
    if(u.hp<=0||blocked)return false;const q=yahoInit(u);if(q.summoned)return false;
    q.activeMs=Math.min(YAHO_RULES.ultimateMs,q.activeMs+dt);
    return q.activeMs>=YAHO_RULES.ultimateMs&&yahoCast(u,allies,time,heal,emit,true);
  }
  const SPICA_RULES = Object.freeze({haste:.15,hasteMs:6000,slow:.15,slowMs:5000,bossSlowScale:.5,cooldown:9,skillMultiplier:1.1});
  function basicAttackRate(unit,time,isBoss=false) { return 1 + ((time < (unit.hasteUntil||0) ? SPICA_RULES.haste : 0) - (time < (unit.slowUntil||0) ? SPICA_RULES.slow*(isBoss?SPICA_RULES.bossSlowScale:1) : 0)); }
  const RYUSION_RULES = Object.freeze({ tauntEvery:5000, tauntMs:2000, tauntReduction:.6, teamReduction:.08, shieldRatio:.08, shieldMs:6000, stunMs:2000, impactDelay:500 });
  const RYUSION_SKILLS = Object.freeze([{stage:1,name:"돌격 앞으로"},{stage:2,name:"방어막 추가"}]);
  const ryusionSkill = s => RYUSION_SKILLS[(s.units.ryusion?.nextSkill || 1)-1];
  function ryusionDefense(hero) { const p=hero?.exclusive;return p?.id==='earth_shield'?{tauntReduction:p.tauntReduction,shieldRatio:p.shieldRatio,tauntShieldRatio:p.tauntShieldRatio}:{tauntReduction:RYUSION_RULES.tauntReduction,shieldRatio:RYUSION_RULES.shieldRatio,tauntShieldRatio:0}; }
  function ryusionGuard(heroes,time) { const hero=heroes.find(h=>h.id==='ryusion'&&h.hp>0);return {hero,taunting:!!hero&&time>=RYUSION_RULES.tauntEvery&&time%RYUSION_RULES.tauntEvery<RYUSION_RULES.tauntMs}; }
  function expireEarthShield(hero,time) { if(hero.earthShield&&time>=hero.earthShieldUntil){hero.shield=Math.max(0,hero.shield-hero.earthShield);hero.earthShield=0;return true;}return false; }
  function addEarthShield(hero,amount,time) { hero.shield=Math.max(0,hero.shield-(hero.earthShield||0));hero.earthShield=Math.max(0,Math.round(amount));hero.earthShieldUntil=time+RYUSION_RULES.shieldMs;hero.shield+=hero.earthShield;return hero.earthShield; }
  function absorbEarthShield(hero,amount) { if(hero.earthShield)hero.earthShield=Math.max(0,hero.earthShield-amount); }
  const HORAS_RULES = Object.freeze({ maxStacks: 5, basicMs: 2000, basicMotionMs: 900, hitStackMs: 1000, mergeMs: 1000, impactDelay: 1500, minCastMs: 3000, basicMultiplier: 5.4, primaryMultiplier: 30, splashMultiplier: 16, stunMultiplier: 1.5, missChance: .1, markMs: 6000, refundStacks: 2 });
  const UR_RECRUIT_RATES = Object.freeze({ UR: .003, SSR: .01, SR: .26, R: .727 });
  const RECRUIT_COST = Object.freeze({ 1: 160, 10: 1600 });
  // Shared by campaign, guild bosses, winter encounters and authoritative PvP.
  const RUDES_RULES=Object.freeze({basicMs:1500,basic:1.8,skillMs:7000,pierce:1.8,shots:2,fan:4.2,shieldCap:.35,shieldMs:6000,bondCap:.4,bondMs:8000,watchBonus:.15});
  function rudesInit(u){return u.id==='rudes'?(u.rudes||={nextBasic:1000,nextSkill:7000,next:'pierce',cast:null,shield:0,shieldUntil:0}):null;}
  function validRudes(u){const q=u.rudes;return q===undefined||u.id==='rudes'&&q&&['nextBasic','nextSkill','shield','shieldUntil'].every(k=>Number.isFinite(q[k])&&q[k]>=0)&&q.shield<=u.shield&&['pierce','fan'].includes(q.next)&&(q.cast===null||q.cast&&['basic','pierce','fan'].includes(q.cast.mode)&&Number.isFinite(q.cast.began)&&q.cast.began>=0&&Number.isInteger(q.cast.hit)&&q.cast.hit>=0&&q.cast.hit<=2);}
  function expireRudesShield(u,time){const q=u.rudes;if(q?.shield&&time>=q.shieldUntil){u.shield=Math.max(0,u.shield-q.shield);q.shield=0;}}
  // Consume this shield after the earth shield and before other sources.
  function absorbRudesShield(u,amount){const q=u.rudes;if(!q)return 0;const n=Math.min(q.shield,Math.max(0,amount-(u.earthShield||0)));q.shield-=n;return n;}
  function rudesStep(u,allies,enemies,time,dt,hit,emit=()=>{},blocked=false,rate=1){
    const q=rudesInit(u);if(!q)return;expireRudesShield(u,time);
    if(u.hp<=0||blocked){if(q.cast){q.cast=null;emit('rudes-cancel',{});}q.nextBasic=Math.max(q.nextBasic,time+500);q.nextSkill=Math.max(q.nextSkill,time+250);return;}
    const live=()=>enemies.filter(e=>e.hp>0),r=RUDES_RULES;
    if(!live().length){q.cast=null;return;}
    if(!q.cast){const skill=time>=q.nextSkill,mode=skill?q.next:'basic';if(!skill&&time<q.nextBasic)return;
      q.cast={mode,began:time,hit:0};q.nextBasic=time+r.basicMs/Math.max(.1,rate);
      if(skill){q.nextSkill=time+r.skillMs;q.next=mode==='pierce'?'fan':'pierce';}
      const targets=mode==='pierce'?live():[mode==='basic'?live().at(-1):live()[0]];
      emit('rudes-cast',{mode,stage:mode==='fan'?2:1,name:mode==='basic'?'우산 사격':mode==='pierce'?'관통샷 · 은월 궤적':'부채 · 월화 잔영',to:targets[0].id,targets:targets.map(e=>e.id),duration:mode==='pierce'?1400:1000,element:'dark'});
    }
    const cast=q.cast,age=time-cast.began,count=cast.mode==='pierce'?r.shots:1;
    while(cast.hit<count&&age>=500+cast.hit*500){
      const targets=cast.mode==='pierce'?live():[cast.mode==='basic'?live().at(-1):live()[0]].filter(Boolean);cast.hit++;
      for(const target of targets){const mode=cast.mode,watch=mode==='basic'&&target.hp>=target.max*.7?1+r.watchBonus:1;
        const dealt=hit(target,u.atk*(mode==='basic'?r.basic:mode==='pierce'?r.pierce:r.fan)*watch,{rudesMode:mode,damageType:mode==='fan'?'magic':'physical',piercing:mode==='pierce',skill:mode!=='basic',shot:cast.hit});
        if(mode==='fan'&&dealt>0){const bond=allies.some(a=>a.id==='yaho'&&a.hp>0),cap=Math.floor(u.max*(bond?r.bondCap:r.shieldCap)),gained=Math.max(0,Math.min(Math.floor(dealt),cap-q.shield));
          q.shield+=gained;u.shield+=gained;q.shieldUntil=time+(bond?r.bondMs:r.shieldMs);
          emit('rudes-shield',{to:u.id,amount:gained,rudesShield:q.shield,shield:u.shield,until:q.shieldUntil,bond,name:'우산 보호막',element:'dark'});
        }
      }
    }
    if(age>=(cast.mode==='pierce'?1250:1000))q.cast=null;
  }

  const SSR_RECRUIT_COST = Object.freeze({ 1: 100, 10: 1000 });
  function isURBanner(id){return id==='horas'||id==='hyeokjin';}
  function recruitCost(banner, count) { return (isURBanner(banner) ? RECRUIT_COST : SSR_RECRUIT_COST)[count]; }
  const WEAPON_COST = SSR_RECRUIT_COST;
  const WEAPON_BANNERS = Object.freeze({
    ryusion: Object.freeze({ id:"ryusion", item:"earth_shield", group:"standard", limited:false, expiresAt:null }),
    osia: Object.freeze({ id:"osia", item:"osia_scepter", group:"standard", limited:false, expiresAt:null }),
    lava: Object.freeze({ id:"lava", item:"lava_fan", group:"standard", limited:false, expiresAt:null }),
    horas: Object.freeze({ id:"horas", item:"horas_orbit", group:"limited", limited:true, expiresAt:Date.parse("2026-11-23T00:00:00+09:00") }),
  });
  const RECRUIT_RATES = { SSR: .01, SR: .26, R: .73 };
  const RECRUIT_PITY = { hard: 80, soft: 60, stepPercent: 1 };
  const STANDARD_SSR = Object.freeze(["osia", "ian", "lumi", "lava", "ryusion", "kazua"]);
  const BANNERS = Object.freeze({
    yaho: Object.freeze({id:"yaho",name:"야호 픽업 모집",featured:"yaho",limited:false,expiresAt:null}),
    hyeokjin: Object.freeze({id:"hyeokjin",name:"서혁진 UR 픽업뽑기",featured:"hyeokjin",rarity:"UR",limited:false,expiresAt:null}),
    rudes: Object.freeze({id:"rudes",name:"루데스 · 탑의 마녀 픽업",featured:"rudes",limited:false,expiresAt:null}),
    standard: Object.freeze({ id:"standard", name:"상시뽑기", featured:null, limited:false, expiresAt:null }),
    horas: Object.freeze({ id: "horas", name: "호라스 픽업뽑기", featured: "horas", rarity: "UR", limited: true, expiresAt: Date.parse("2026-11-23T00:00:00+09:00") }),
  });
  // Retired receipts remain readable. New codes are separately issued below.
  const COUPONS = Object.freeze({
    '야호업데이트': Object.freeze({gold:0,gems:1600,expiresAt:null}),
    '게임을즐겨주신여러분께감사합니다': Object.freeze({gold:0,gems:1600,snowflakes:100,expiresAt:null}),
    NEWNAME: Object.freeze({gold:0,gems:0,nameChangeTickets:1,expiresAt:Date.parse('2026-11-20T10:38:23Z')}),
    MAJOR_UPDATE_OVERHAUL: Object.freeze({gold:40000,gems:3000,expiresAt:Date.parse('2026-11-20T10:38:23Z')}),
    SORRY_FOR_FREQUENT_UPDATES: Object.freeze({gold:5000,gems:500,expiresAt:Date.parse('2026-11-20T10:38:23Z')}),
    HYEOKJIN_UPDATE: Object.freeze({gold:30000,gems:3000,expiresAt:Date.parse('2026-11-20T10:38:23Z')}),
    BALANCE_PATCH_REWARD: Object.freeze({gold:50000,gems:3000,expiresAt:Date.parse('2026-11-20T10:38:23Z')}),
    WEEKEND_GIFT: Object.freeze({gold:0,gems:1000,snowflakes:100,expiresAt:Date.parse('2026-11-20T10:38:23Z')}),
    WEEKEND_DOUBLE_REWARDS: Object.freeze({gold:0,gems:2000,expiresAt:Date.parse('2026-11-20T10:38:23Z')}),
    HYUKJIN_PLEASE_STOP_ASKING: Object.freeze({gold:0,gems:500,snowflakes:50,expiresAt:Date.parse('2026-11-20T10:38:23Z')}),
    KAZUA_UPDATE: Object.freeze({gold:0,gems:2000,snowflakes:100,expiresAt:Date.parse('2026-11-20T10:38:23Z')}),
    THANKS_FOR_ENJOYING_THE_GAME: Object.freeze({gold:0,gems:1000,snowflakes:100,expiresAt:Date.parse('2026-11-20T10:38:23Z')}),
    BEYOND_CHAPTER_12: Object.freeze({gold:15000,gems:1500,snowflakes:100,expiresAt:Date.parse('2026-11-20T10:38:23Z')}),
    SORRY_FOR_FREQUENT_PATCHES: Object.freeze({gold:0,gems:900,snowflakes:500,expiresAt:Date.parse('2026-11-20T10:38:23Z')}),
    RANKING_FIRST_CONGRATS: Object.freeze({ gold:0, gems:0, expiresAt:Date.parse('2026-11-18T22:46:56Z'), avatar:'rank-first' }),
    RYUSION_UPDATE: Object.freeze({ gold:5000, gems:2000, expiresAt:Date.parse('2026-11-18T22:46:56Z') }),
    THANKS_FOR_PLAYING: Object.freeze({ gold:10000, gems:1000, expiresAt:Date.parse('2026-11-18T22:46:56Z') }),
    THANKS_FOR_REPORTING: Object.freeze({ gold: 500, gems: 500, expiresAt: Date.parse('2026-11-18T22:46:56Z') }),
    HORAS_CELEBRATION: Object.freeze({ gold: 2000, gems: 2000, expiresAt: Date.parse('2026-11-18T22:46:56Z') }),
  });
  const DUNGEONS = Object.freeze({
    daily: Object.freeze({ id: "daily", name: "방과 후 보급고", cap: 3, unlocks: [0, 10, 20, 35, 50], stages: [5, 15, 30, 45, 60] }),
    weekly: Object.freeze({ id: "weekly", name: "봉인된 이사장실", cap: 2, unlocks: [0, 15, 30, 45, 60], stages: [5, 15, 30, 45, 60] }),
    tower: Object.freeze({ id: "tower", name: "뫼비우스의 복도", cap: null }),
  });
  const BOSS_RULES = Object.freeze({ storyHp: 2.6, storyAttack: 1, aoeEvery: 6000, aoeMultiplier: 1.6, rageEvery: 15000, rageStep: .12 });
  const PROGRESSION = Object.freeze({ unitRequirement: 3, battleXp: .2, dungeonXp: .35, offlineXp: .2, captainBattleXp: .25, captainOfflineDivisor: 8 });
  const CAMPAIGN_REWARDS = Object.freeze({ safeGap: 5, decay: .75, minimum: .05, bonusStart: 10, bonusPerStage: .02 });
  const GEAR_SLOTS = Object.freeze(["weapon", "armor", "charm"]), GEAR_AWAKEN_COST = Object.freeze([1, 1, 2, 2, 3]), GEAR_MAX_COUNT = 1000000000;
  const GEAR = Object.freeze([
    { id: "chalk_star", name: "별빛 분필", slot: "weapon", rarity: "R", atk: .01, hp: 0, starAtk: .006, starHp: 0 },
    { id: "rift_baton", name: "균열의 지휘봉", slot: "weapon", rarity: "SR", atk: .02, hp: 0, starAtk: .006, starHp: 0 },
    { id: "dawn_staff", name: "새벽별 홀", slot: "weapon", rarity: "SSR", atk: .03, hp: 0, starAtk: .006, starHp: 0 },
    { id: "apprentice_cape", name: "견습 망토", slot: "armor", rarity: "R", atk: 0, hp: .03, starAtk: 0, starHp: .01 },
    { id: "barrier_uniform", name: "결계 교복", slot: "armor", rarity: "SR", atk: 0, hp: .04, starAtk: 0, starHp: .01 },
    { id: "guardian_robe", name: "수호자의 예복", slot: "armor", rarity: "SSR", atk: 0, hp: .05, starAtk: 0, starHp: .01 },
    { id: "adventure_badge", name: "모험부 배지", slot: "charm", rarity: "R", atk: .01, hp: .01, starAtk: .002, starHp: .004 },
    { id: "wind_bell", name: "바람의 방울", slot: "charm", rarity: "SR", atk: .015, hp: .015, starAtk: .002, starHp: .004 },
    { id: "dawn_brooch", name: "여명석 브로치", slot: "charm", rarity: "SSR", atk: .02, hp: .02, starAtk: .002, starHp: .004 },
    { id:"earth_shield", name:"대지의 방패", owner:"ryusion", passive:"대지의 맹약", slot:"weapon", rarity:"EX", atk:.02, hp:.08, starAtk:.004, starHp:.008 },
    { id:"osia_scepter", name:"해연의 왕권", owner:"osia", passive:"신수의 왕권", slot:"weapon", rarity:"UR", atk:.06, hp:0, starAtk:.008, starHp:0 },
    { id:"lava_fan", name:"설풍의 신탁", owner:"lava", passive:"풍령의 가호", slot:"weapon", rarity:"EX", atk:.06, hp:0, starAtk:.008, starHp:0 },
    { id:"horas_orbit", name:"낙성의 화관", owner:"horas", passive:"벚꽃의 맹세", slot:"weapon", rarity:"EX", atk:.06, hp:0, starAtk:.008, starHp:0 },
  ].map(item => Object.freeze({ ...item, icon: `school/assets/equipment/${item.id}.svg` })));
  const GEAR_BY_ID = Object.freeze(Object.fromEntries(GEAR.map(item => [item.id, item])));
  const GEAR_DROP_RATES = Object.freeze({ daily: [[80,18,2],[74,23,3],[68,27,5],[62,31,7],[55,35,10]].map(Object.freeze), weekly: [[60,34,6],[52,40,8],[45,45,10],[38,49,13],[30,55,15]].map(Object.freeze) });
  // Request-local entropy and preview policy never become visible saved fields.
  const gearContexts = new WeakMap();
  function withGearContext(s, options, execute) {
    if (!options) return execute();
    const previous = gearContexts.get(s); gearContexts.set(s, options);
    try { return execute(); } finally { if (previous) gearContexts.set(s, previous); else gearContexts.delete(s); }
  }
  const CRITICAL = Object.freeze({ chance: .12, multiplier: 1.5 });
  const PARTY_SYNERGIES = Object.freeze([
    Object.freeze({ id: "tank", name: "철벽 전열", required: 3, description: "수호 3명 · 아군 전체 받는 피해 15% 감소" }),
    Object.freeze({ id: "damage", name: "집중 공세", required: 3, description: "전사·사수·마법 3명 · 아군 전체 공격 피해 15% 증가" }),
    Object.freeze({ id: "healer", name: "생명의 합주", required: 3, description: "치유 3명 · 아군 전체 회복량 20% 증가" }),
  ]);
  const WINTER_EVENT = Object.freeze({ id: "first-snow-2026", name: "겨울의 첫눈", startsAt: Date.parse("2026-11-18T00:00:00+09:00"), endsAt: null, dropChance: .2,
    shop: Object.freeze({ gold: Object.freeze({ cost: 30, limit: 10, gold: 1000, gems: 0 }), gems: Object.freeze({ cost: 60, limit: 10, gold: 0, gems: 100 }), hyeokjin: Object.freeze({ cost:1000,limit:2,gold:0,gems:0,hero:"hyeokjin",shards:5 }), horas: Object.freeze({ cost:1000, limit:2, gold:0, gems:0, hero:"horas", shards:5 }), spica:Object.freeze({cost:5000,limit:1,gold:0,gems:0,hero:"spica",unlock:true,lifetime:true}) }) });
  const WINTER_ROULETTE = Object.freeze([
    {id:'jackpot',label:'보석 10,000',type:'gems',amount:10000,chance:.001},
    {id:'gems1000',label:'보석 1,000',type:'gems',amount:1000,chance:.01},
    {id:'gems100',label:'보석 100',type:'gems',amount:100,chance:.089},
    {id:'gear',label:'랜덤 장비',type:'equipment',amount:1,chance:.35},
    {id:'gold',label:'랜덤 골드',type:'gold',min:2600,max:7800,chance:.55}
  ].map(Object.freeze));
  // Use integer percentages so 1400 × 35% is exactly 490, not 489.999… .
  const scaledXp = (amount, multiplier) => amount > 0 ? Math.max(1, Math.floor(amount * Math.round(multiplier * 100) / 100)) : 0;
  function recruitRates(misses, banner = "osia") {
    if (isURBanner(banner)) {
      const next = misses + 1;
      if (next >= RECRUIT_PITY.hard) return { UR: 1, SSR: 0, SR: 0, R: 0 };
      const ur = (3 + Math.max(0, next - RECRUIT_PITY.soft + 1) * 10) / 1000;
      return { UR: ur, SSR: UR_RECRUIT_RATES.SSR, SR: UR_RECRUIT_RATES.SR, R: 1 - ur - UR_RECRUIT_RATES.SSR - UR_RECRUIT_RATES.SR };
    }
    const next = misses + 1;
    if (next >= RECRUIT_PITY.hard) return { SSR: 1, SR: 0, R: 0 };
    const ssrPercent = RECRUIT_RATES.SSR * 100 + Math.max(0, next - RECRUIT_PITY.soft + 1) * RECRUIT_PITY.stepPercent;
    // Soft pity takes its extra probability from R, keeping SR at 26%.
    return { SSR: ssrPercent / 100, SR: RECRUIT_RATES.SR, R: (100 - ssrPercent - RECRUIT_RATES.SR * 100) / 100 };
  }
  function bannerAvailable(id, now = Date.now()) {
    return typeof id === "string" && Object.hasOwn(BANNERS, id) && Number.isFinite(now) && (BANNERS[id].expiresAt === null || now < BANNERS[id].expiresAt);
  }
  const canonicalBanner = id => id === 'osia' || id === 'lava' || id === 'ryusion' || id === 'kazua' ? 'standard' : id;
  function bannerState(s, id = "standard") {
    id = canonicalBanner(id);
    if (!Object.hasOwn(BANNERS, id)) return null;
    const saved = s.banners?.[id];
    if(id==='standard'){
      // Project legacy counters without mutating a save during a UI read.
      const total=(s.banners?.osia?.pity??s.pity??0)+(s.banners?.lava?.pity??0);
      const merged=(saved?.pity??Math.min(79,total))+(saved?.reserve??Math.max(0,total-79))+(s.banners?.ryusion?.pity||0)+(s.banners?.kazua?.pity||0);
      const guarantees=(saved?.guarantees??(Number(!!s.banners?.osia?.guaranteed)+Number(!!s.banners?.lava?.guaranteed)))+Number(!!s.banners?.ryusion?.guaranteed)+Number(!!s.banners?.kazua?.guaranteed);
      return {pity:Math.min(79,merged),reserve:Math.max(0,merged-79),guarantees,guaranteed:guarantees>0};
    }
    return { pity: saved?.pity ?? 0, guaranteed: saved?.guaranteed ?? false };
  }
  function bannerHeroRates(s, id = "standard", guaranteedHero = 'osia') {
    id = canonicalBanner(id);
    const progress = bannerState(s, id); if (!progress) return {};
    const rates = recruitRates(progress.pity, id), featured = BANNERS[id].featured;
    const otherSSR = STANDARD_SSR.filter(hero => hero !== featured);
    const result = Object.fromEntries(HEROES.map(hero => [hero.id, 0]));
    for (const grade of ["R", "SR"]) {
      const pool = HEROES.filter(hero => hero.rarity === grade);
      for (const hero of pool) result[hero.id] = rates[grade] / pool.length;
    }
    if (isURBanner(id)) {
      result[featured] = rates.UR;
      for (const hero of STANDARD_SSR) result[hero] = rates.SSR / STANDARD_SSR.length;
      return result;
    }
    if(id==='standard'){
      for(const hero of STANDARD_SSR)result[hero]=progress.guaranteed?(hero===guaranteedHero?rates.SSR:0):rates.SSR/STANDARD_SSR.length;
      return result;
    }
    result[featured] = rates.SSR * (progress.guaranteed ? 1 : .5);
    for (const hero of otherSSR) result[hero] = progress.guaranteed ? 0 : rates.SSR * .5 / otherSSR.length;
    return result;
  }
  const HEROES = [
    { id: "harin", name: "하린", club: "검도부", role: "전사", rarity: "R", hp: 102, atk: 12, skill: "일섬", cooldown: 5, color: "#d97852", hair: "#553a31", outfit: "#536c76", weapon: "sword", desc: "한 명에게 공격력 300%의 검격." },
    { id: "taeo", name: "태오", club: "체육부", role: "수호", rarity: "R", hp: 158, atk: 8, skill: "굳건한 수비", cooldown: 5, color: "#568b79", hair: "#343b3e", outfit: "#416d62", weapon: "shield", desc: "최대 체력 25%의 보호막. 받는 피해 28% 감소." },
    { id: "yuna", name: "유나", club: "궁도부", role: "사수", rarity: "R", hp: 88, atk: 14, skill: "정조준", cooldown: 4, color: "#d7a34c", hair: "#8a582f", outfit: "#b08949", weapon: "bow", desc: "체력이 가장 낮은 적에게 공격력 260%의 화살." },
    { id: "minjae", name: "민재", club: "과학부", role: "마법", rarity: "R", hp: 82, atk: 12, skill: "플라스크 폭발", cooldown: 6, color: "#7297ab", hair: "#4c4657", outfit: "#668a9b", weapon: "staff", desc: "적 전체에게 공격력 170%의 마법 피해." },
    { id: "sua", name: "수아", club: "보건부", role: "치유", rarity: "R", hp: 94, atk: 8, skill: "응급 처치", cooldown: 4, color: "#ce8b9d", hair: "#70434a", outfit: "#d1b9a4", weapon: "heal", desc: "살아 있는 아군 전원의 체력을 공격력 220%만큼 회복." },
    { id: "jiho", name: "지호", club: "방송부", role: "지원", rarity: "R", hp: 98, atk: 10, skill: "응원의 방송", cooldown: 5, color: "#a29568", hair: "#725a40", outfit: "#7c7751", weapon: "flag", desc: "3초 동안 아군 전원 공격력 30% 증가." },
    { id: "seoyun", name: "서윤", club: "학생회", role: "전사", rarity: "SR", hp: 125, atk: 15, skill: "질서의 검", cooldown: 4, color: "#a37db0", hair: "#373d63", outfit: "#68517b", weapon: "sword", desc: "한 명에게 공격력 300%의 검격. 빠른 스킬 순환." },
    { id: "siu", name: "시우", club: "천문부", role: "마법", rarity: "SR", hp: 103, atk: 16, skill: "별빛 낙하", cooldown: 5, color: "#7990bf", hair: "#a0a5c6", outfit: "#4d6292", weapon: "staff", desc: "적 전체에게 공격력 170%의 별빛 피해." },
    { id: "nari", name: "나리", club: "음악부", role: "치유", rarity: "SR", hp: 115, atk: 11, skill: "작은 치유곡", cooldown: 4, color: "#b68fab", hair: "#aa7977", outfit: "#8c7088", weapon: "heal", desc: "살아 있는 아군 전원에게 공격력 220%의 회복." },
    { id: "geonu", name: "건우", club: "럭비부", role: "수호", rarity: "SR", hp: 192, atk: 11, skill: "철벽 스크럼", cooldown: 4, color: "#7e9a74", hair: "#776348", outfit: "#68774c", weapon: "shield", desc: "최대 체력 25%의 보호막. 받는 피해 28% 감소." },
    { id: "doyoon", name: "도윤", club: "안전부", role: "수호", rarity: "SR", hp: 180, atk: 10, skill: "안전한 귀갓길", cooldown: 4, color: "#6e9dbc", hair: "#574035", outfit: "#476b8b", weapon: "shield", desc: "최대 체력 25%의 보호막. 받는 피해 28% 감소. 수호 3인 편성으로 철벽 전열을 완성할 수 있습니다." },
    { id: "ian", name: "이안", club: "풍기위원", role: "전사", rarity: "SSR", hp: 155, atk: 24, atkGrowth: 4.2, skill: "황혼의 발도", cooldown: 4, color: "#dfb354", hair: "#d8d1b7", outfit: "#344a51", weapon: "sword", desc: "한 명에게 공격력 300%의 발도. 높은 체력과 공격력." },
    { id: "lumi", name: "루미", club: "오컬트부", role: "마법", rarity: "SSR", hp: 128, atk: 25, atkGrowth: 3.7, skill: "달빛 소환", cooldown: 4, color: "#c89ed4", hair: "#b9b2db", outfit: "#5c527d", weapon: "staff", desc: "적 전체에게 공격력 170%의 달빛. 빠른 광역 공격." },
    { id: "osia", name: "오시아", latin: "Osia", club: "물의 용왕", species: "물고기", element: "water", role: "마법", rarity: "SSR", hp: 136, atk: 20, skill: "용왕의 해일", skillMultiplier: 2.2, cooldown: 5, passive: "용왕의 권능", passiveDesc: "물폭탄 평타로 싸우며 스킬을 충전합니다. 충전할 때마다 대형 물탄 → 소용돌이 → 물기둥 → 거대 수룡 순서로 하나씩 사용하고 반복합니다. 마지막 수룡은 명중한 적을 1.5초 기절시킵니다.", color: "#59bdd7", hair: "#6587bb", outfit: "#f6f3eb", weapon: "water", desc: "5초 충전마다 다음 단계 스킬 하나로 적 전체에게 공격력 220%의 물 피해. 스킬 사이에는 물폭탄 평타를 사용합니다." },
    { id: "lava", name: "라바", latin: "Lava", gender: "남성", species: "인간", club: "바람의 무당", element: "wind", role: "치유", rarity: "SSR", hp: 142, atk: 15, cooldown: 5, skill: "바람의 부채 · 바람의 상처", passive: "신내림", passiveDesc: "본인의 평타가 10회 명중하면 체력 비율이 가장 낮은 생존 아군에게 공격력 200% + 대상 최대 체력 8%의 방어막을 줍니다. 방어막은 최대 체력 60%까지 쌓입니다.", passive2: "긴급생존", passive2Desc: "라바가 살아 있으면 웨이브당 한 번, 아군의 치명적인 피해를 HP 1로 버티게 하고 2초 동안 쓰러지지 않게 합니다. 보호 중에도 회복할 수 있습니다.", color: "#81c4ab", hair: "#91d7f1", outfit: "#9caa65", skirt: "#b9564d", weapon: "wind", desc: "5초 충전마다 교대로 사용합니다. 바람의 부채: 아군 전체 공격력 160% 회복 + 공격력 90% 방어막. 바람의 상처: 체력 비율이 가장 낮은 생존 아군 한 명을 공격력 450%만큼 회복." },
    { id:"yaho", name:"야호", latin:"Yaho", gender:"여성", species:"영물 · 호랑이 수인", club:"라바의 두 번째 제자", element:"fire", role:"치유", rarity:"SSR", hp:160, hpGrowth:12, atk:19, atkGrowth:3.2, cooldown:YAHO_RULES.cooldown, skill:"포효 · 산군의 보호", passive:"내가 건내준 힘", passiveDesc:"평타마다 체력 비율이 가장 낮은 생존 아군을 공격력 90% + 대상 최대 HP 2%만큼 회복합니다.", passive2:"스승님", passive2Desc:"야호와 라바가 함께 살아 있으면 라바의 바람이 태풍으로 강화되어 피해·회복·보호막이 40% 증가합니다.", ultimate:"거스리는 자", ultimateDesc:"활동 시간 18초에 산군 호랑이를 한 번 소환합니다. 전체 회복(공격력 400% + 최대 HP 8%)과 8초간 피해 감소 42%. 산군의 보호가 산군의 가호로 바뀌어 회복 160%와 8초간 피해 감소 42%를 부여합니다. 모험에서는 같은 스테이지의 다음 웨이브에도 소환 상태가 유지됩니다.", color:"#ffb968", hair:"#ffd978", outfit:"#ec837c", weapon:"tiger-fan", desc:"어릴 적 라바에게 거두어진, 도술을 부리는 어린 호랑이 영물. 6초마다 포효와 산군의 보호를 번갈아 사용합니다. 포효: 아군 전체 공격력 320% + 대상 최대 HP 4% 회복, 8초간 주는 피해 35% 증가. 산군의 보호: 6초간 받는 피해 28% 감소. 보호 효과는 중첩되지 않습니다." },
    { id:"spica", name:"스피카", latin:"Spica", gender:"여성", species:"설녀", club:"겨울의 손님", element:"ice", role:"지원", rarity:"SSR", eventOnly:true, hp:148, atk:13, cooldown:SPICA_RULES.cooldown, skill:"설녀의 겨울", color:"#a8d9f0", hair:"#7796cf", outfit:"#c1d4e5", weapon:"ice", desc:"9초마다 적 전체에 공격력 110%의 마법 피해. 아군 전체의 기본 공격 속도 15% 증가(6초), 적의 기본 공격 속도 15% 감소(5초). 보스에게는 7.5% 감소하며 같은 효과는 중첩되지 않습니다. 스킬 충전 속도는 바뀌지 않습니다." },
    { id:"ryusion", name:"류시온", latin:"Ryusion", gender:"여성", species:"인간", club:"대지의 수호자", element:"earth", role:"수호", rarity:"SSR", hp:245, hpGrowth:18, atk:10, atkGrowth:2.4, cooldown:8, skill:"돌격 앞으로 · 방어막 추가", passive:"내가 대신 맞아줄게", passiveDesc:"전투 5초부터 5초마다 2초 동안 모든 적 공격을 대신 받습니다. 광역 공격은 각 아군에게 향한 타격을 전부 받습니다. 도발 중 본인이 받는 피해는 추가로 60% 감소합니다. 쓰러지면 도발은 끝납니다.", passive2:"피해감소", passive2Desc:"생존 중 자신을 포함한 아군 전체가 받는 피해 8% 감소. 다른 피해 감소와 곱해서 적용됩니다.", color:"#daa456", hair:"#674b40", outfit:"#28272b", weapon:"earth-shield", desc:"8초 충전마다 교대로 사용합니다. 돌격 앞으로: 전방 적 한 명에게 공격력 100% 피해·밀쳐내기·2초 기절. 방어막 추가: 생존 아군 각각에게 류시온 최대 HP 8%의 보호막을 6초간 부여. 같은 보호막은 중첩되지 않습니다." },
  ];
  HEROES.push({ id: "horas", name: "호라스", latin: "Horas", gender: "여성", club: "벚꽃의 의식", element: "blossom", role: "사수", rarity: "UR", hp: 128, atk: 22, atkGrowth:4.8, cooldown: 5, skill: "벚꽃의식", passive: "별빛 축적", passiveDesc: "두 손짓의 느린 평타가 적중하거나 공격을 받으면 벚꽃 구슬을 1개 쌓습니다. 피격 획득은 1초당 한 번. 5개를 합쳐 벚꽃의식을 사용합니다.", passive2: "벚꽃의 잔향", passive2Desc: "기절 중인 적에게 주는 피해 1.5배. 의식이 적중한 주 대상에게 6초간 표식을 남깁니다. 아군 누구든 표식 대상을 처치하면 2스택을 한 번 회수합니다.", color: "#f3a2d0", hair: "#f2a6d0", outfit: "#d6e5ff", weapon: "blossom", desc: "2초 간격으로 공격력 540% 평타. 5스택을 소모하여 구슬을 합친 뒤 가까운 적이 많은 한 명에게 공격력 3000%, 인접한 적에게 1600% 피해. 의식은 10% 확률로 빗나갑니다. 의식 시작 간격은 최소 3초입니다." });
  HEROES.push({id:'kazua',name:'카즈아',latin:'Kazua',gender:'남성',species:'인간',club:'붉은 탄막',role:'사수',rarity:'SSR',hp:100,hpGrowth:12,atk:24,atkGrowth:3,cooldown:20,skill:'붉은총알',passive:'권총 · 바주카포',passiveDesc:'5초마다 권총으로 단일 520%, 15초마다 바주카포로 적 전체 700% 물리 피해. 무기를 바꾸는 동안 머신건 사격은 잠시 멈춥니다.',passive2:'최후의 생존자',passive2Desc:'함께 출전한 아군이 쓰러질 때마다 피해 +12%(최대 60%). 원래 2명 이상 출전했고 혼자 남으면 추가 +240%(최대 총 피해 4배). 빈 편성이나 부활 반복으로 중첩되지 않습니다. 회피 10%, 일반 공격 표적 우선도 감소. 광역·도발은 별도입니다.',color:'#f65d55',hair:'#a62428',outfit:'#24242c',weapon:'gatling',desc:'끝없는 총알: 3초간 초고속 연사 후 2초 장전. 연사 중 0.5초마다 공격력 120%의 물리 피해를 묶어 적용합니다. 붉은총알: 20초마다 3초간 초당 50발의 붉은 유도탄. 주 대상 총 3500%, 다른 적 각각 총 1225% 물리 피해. 낮은 체력을 감수하는 극딜 사수.'});
  HEROES.push({id:'hyeokjin',name:'서혁진',latin:'Seo Hyeokjin',gender:'남성',species:'이계의 인간',element:'dark',club:'지켜온 맹세',role:'전사',rarity:'UR',hp:175,hpGrowth:16,atk:48,atkGrowth:5.6,cooldown:10,skill:'죽지 않는 청년 · 어둠의 잠식',passive:'폼 체인지 · 피 보는 자',passiveDesc:'HP 35% 이하가 되는 타격부터 전투당 1회 8초 각성. 각성 중 HP가 1 아래로 내려가지 않으며 직접 가한 피해의 20%를 흡혈합니다(초당 최대 HP 8%). 공격 피해 +50%, 평타 간격 1.4초. 기본형 평타 간격은 1.8초입니다.',passive2:'책임감',passive2Desc:'함께 출전한 아군이 모두 쓰러지면 전투당 1회 5초간 피해 면역·피해 +30%. 처음부터 혼자 출전하면 발동하지 않습니다. 각성과 동시에 시간이 흐릅니다.',color:'#e25c83',hair:'#22202f',outfit:'#edeaf0',weapon:'greatsword',desc:'평타: 주 대상 660%·추가 전방 2명 각각 230% 물리 피해. 기본형: 10초마다 주 대상 900%·추가 전방 2명 각각 400%, 명중 시 HP 10% 회복. 각성형: 블랙 전방 최대 3명 각각 900%, 참수 단일 X자 6연타(0.25초 간격), 총 1400%(첫 타격 시 대상 HP 30% 이하이면 총 2100%, 처치 시 HP 15% 회복). 각성 중 HP 20% 이하가 되면 전투당 한 번 궁극기: 공격력 2000% + 직접 누적한 실제 HP 피해 150%(합계 최대 공격력 12000%) 방출. 주 대상 70%·나머지 적에게 총 30% 분배, 단일 적은 100%. 모든 공격은 물리이며 기절·빙결로 시전이 중단될 수 있습니다.'});
  HEROES.push({id:'rudes',name:'루데스',latin:'Rudes',gender:'여성',species:'인간 · 마녀',club:'탑의 마녀',element:'dark',role:'사수',rarity:'SSR',hp:132,hpGrowth:11,atk:23,atkGrowth:3.6,cooldown:7,weapon:'parasol',color:'#bca2ee',hair:'#d9d0f1',outfit:'#4d3b68',skill:'관통샷 · 월화 잔영',passive:'탑의 관측자',passiveDesc:'우산 사격은 살아 있는 가장 뒷줄 적을 우선 공격합니다. 대상의 현재 HP가 70% 이상이면 평타 피해가 15% 증가합니다. 도발은 우선 적용됩니다.',passive2:'우산 보호막 · 작은 손님의 책갈피',passive2Desc:'부채가 실제로 깎은 적 HP의 100%를 자신의 보호막으로 전환합니다. 최대 자신의 HP 35%, 6초 지속. 야호가 함께 살아 있으면 최대 40%, 8초로 강화됩니다. 다른 아군에게 나눠 주지 않으며 초과 피해·적 보호막 피해로는 충전되지 않습니다.',desc:'어둠 속성 원거리 혼합 딜러. 우산총은 물리, 부채는 마법 피해. 평타: 1.5초 주기로 공격력 180%. 7초마다 관통샷(2발, 매 발 생존 적 전체에 180% 물리)과 월화 잔영(맨 앞 적 한 명에게 420% 마법)을 번갈아 시전합니다. 준비 동작 후 명중하며 기절·빙결로 시전이 끊깁니다.'});
  const BY_ID = Object.fromEntries(HEROES.map(h => [h.id, h]));
  const HYEOKJIN_RULES=Object.freeze({awakeMs:8000,lastMs:5000,basicMs:1800,awakeBasicMs:1400,basicMultiplier:6.6,basicSplash:2.3,recoveryMultiplier:9,recoverySplash:4,blackMultiplier:9,executionMultiplier:14,executionLowMultiplier:21,executionTicks:6,executionTickMs:250,awakeMultiplier:1.5,healMs:10000,blackMs:4000,lifesteal:.2,healCap:.08,ultimateBase:20,ultimateStored:1.5,ultimateCap:120});
  const HYEOKJIN_MOVES=Object.freeze({basic:{name:'대검 내려베기',hit:800,duration:1300},recovery:{name:'죽지 않는 청년',hit:400,duration:1100},transform:{name:'어둠의 잠식',hit:0,duration:1000},black:{name:'블랙',hit:600,duration:1000},execution:{name:'참수',hit:450,duration:2200},ultimate:{name:'내가 지켜온 모든 것',hit:1300,duration:2300}});
  function hyeokjinInit(u,allies){if(u.id!=='hyeokjin')return null;return u.hyeokjin||=( {used:false,until:0,lastUsed:false,lastUntil:0,ultimateUsed:false,ultimateArmed:false,executeUsed:false,total:0,healWindow:0,healUsed:0,initial:allies.filter(a=>a.hp>0).map(a=>a.id),mode:'idle',began:0,modeUntil:0,nextBasic:1800,nextHeal:10000,nextBlack:0,nextExecute:0,cast:null} );}
  function hyeokjinAwake(u,time){return !!u?.hyeokjin?.used&&time<u.hyeokjin.until;}
  function hyeokjinRefresh(u,allies,time,emit=()=>{}){
    const q=hyeokjinInit(u,allies);if(!q||u.hp<=0)return q;
    if(!q.lastUsed&&q.initial.length>1&&q.initial.filter(id=>id!==u.id).every(id=>!allies.some(a=>a.id===id&&a.hp>0))){q.lastUsed=true;q.lastUntil=time+5000;emit('hyeokjin-last',{name:'책임감',until:q.lastUntil,duration:5000});}
    if(!q.cast&&time>=q.modeUntil)q.mode='idle';return q;
  }
  function hyeokjinGuard(u,allies,time,amount,emit=()=>{}){
    if(u.id!=='hyeokjin'||u.hp<=0)return amount;const q=hyeokjinRefresh(u,allies,time,emit);
    if(time<q.lastUntil)amount=0;
    if(!q.used&&u.hp-amount<=u.max*.35){q.used=true;q.until=time+8000;q.mode='transform';q.began=time;q.modeUntil=time+1000;q.cast=null;q.nextBlack=time+1000;q.nextExecute=time+4500;q.nextBasic=time+1000;emit('hyeokjin-mode',{mode:'transform',name:'어둠의 잠식',duration:1000,until:q.until});}
    const damage=time<q.lastUntil?0:hyeokjinAwake(u,time)?Math.min(amount,Math.max(0,u.hp-1)):amount;
    if(hyeokjinAwake(u,time)&&u.hp-damage<=u.max*.2&&!q.ultimateUsed)q.ultimateArmed=true;
    return damage;
  }
  function hyeokjinHeal(u,amount,emit=()=>{},skill='피 보는 자'){
    if(u.hp<=0)return 0;const before=u.hp,n=Math.max(0,Math.min(u.max-u.hp,Math.floor(amount)));u.hp+=n;if(n)emit('heal',{to:u.id,amount:n,hpBefore:before,hpAfter:u.hp,name:skill,skill});return n;
  }
  function hyeokjinRecord(u,amount,time,emit=()=>{},ultimate=false){
    if(u?.id!=='hyeokjin'||!u.hyeokjin||amount<=0)return;const q=u.hyeokjin;
    if(!ultimate)q.total=Math.min(1e12,q.total+amount);
    if(!hyeokjinAwake(u,time)||u.hp<=0)return;
    const window=Math.floor(time/1000);if(q.healWindow!==window){q.healWindow=window;q.healUsed=0;}
    const room=Math.max(0,Math.floor(u.max*.08)-q.healUsed);q.healUsed+=hyeokjinHeal(u,Math.min(room,amount*.2),emit);
  }
  function validHyeokjin(q){return q===undefined||!!(q&&['idle',...Object.keys(HYEOKJIN_MOVES)].includes(q.mode)&&['used','lastUsed','ultimateUsed','ultimateArmed','executeUsed'].every(k=>typeof q[k]==='boolean')&&['until','lastUntil','total','healWindow','healUsed','began','modeUntil','nextBasic','nextHeal','nextBlack','nextExecute'].every(k=>Number.isFinite(q[k])&&q[k]>=0)&&q.total<=1e12&&Array.isArray(q.initial)&&q.initial.length>=1&&q.initial.length<=6&&new Set(q.initial).size===q.initial.length&&q.initial.every(id=>Object.hasOwn(BY_ID,id))&&(q.cast===null||q.cast&&Object.hasOwn(HYEOKJIN_MOVES,q.cast.mode)&&Number.isFinite(q.cast.at)&&q.cast.at>=0&&Number.isFinite(q.cast.amount)&&q.cast.amount>=0&&q.cast.amount<=1e12&&Array.isArray(q.cast.targets)&&q.cast.targets.length<=30&&q.cast.targets.every(id=>typeof id==='string')&&typeof q.cast.done==='boolean'&&typeof q.cast.awakened==='boolean'&&(q.cast.tick===undefined||Number.isInteger(q.cast.tick)&&q.cast.tick>=0&&q.cast.tick<=HYEOKJIN_RULES.executionTicks)&&(q.cast.pulseAmount===undefined||Number.isFinite(q.cast.pulseAmount)&&q.cast.pulseAmount>=0&&q.cast.pulseAmount<=1e12)));}
  function hyeokjinStep(u,allies,enemies,time,dt,hit,emit=()=>{},blocked=false,haste=1){
    if(u.id!=='hyeokjin')return;const q=hyeokjinRefresh(u,allies,time,emit);u.energy=Math.min(10,Math.max(0,10-(q.nextHeal-time)/1000));
    if(u.hp<=0||blocked){if(q.cast){q.cast=null;q.mode='idle';q.modeUntil=time;emit('hyeokjin-cancel',{});}return;}
    // Injuries from older saves and non-attack damage still trigger the same gate.
    hyeokjinGuard(u,allies,time,0,emit);
    if(q.cast){const cast=q.cast;
      if(cast.mode==='execution'&&!cast.done)q.modeUntil=Math.max(q.modeUntil,cast.at+HYEOKJIN_RULES.executionTickMs*(HYEOKJIN_RULES.executionTicks-1)+Math.min(dt,300));
      if(cast.mode==='execution'&&!cast.done&&time>=cast.at){
        const r=HYEOKJIN_RULES,weights=[.1,.13,.15,.17,.2,.25],target=enemies.find(e=>e.id===cast.targets[0]&&e.hp>0);
        if(!target){cast.done=true;}else{
          cast.tick??=0;
          cast.pulseAmount??=u.atk*(target.hp/target.max<=.3?r.executionLowMultiplier:r.executionMultiplier)*(cast.awakened?r.awakeMultiplier:1)*(time<q.lastUntil?1.3:1);
          while(cast.tick<r.executionTicks&&time>=cast.at+cast.tick*r.executionTickMs&&target.hp>0){
            const tick=cast.tick++,dealt=hit(target,cast.pulseAmount*weights[tick],{mode:'execution',skill:'참수',comboTick:tick,comboTicks:r.executionTicks});
            emit('hyeokjin-impact',{mode:'execution',name:'참수',targets:[target.id],amount:dealt,tick,ticks:r.executionTicks});
            if(dealt>0&&target.hp<=0)hyeokjinHeal(u,u.max*.15,emit,'참수');
          }
          cast.done=cast.tick>=r.executionTicks||target.hp<=0;
        }
      }
      if(cast.mode!=='execution'&&!cast.done&&time>=cast.at){cast.done=true;const saved=enemies.filter(e=>e.hp>0&&cast.targets.includes(e.id));const targets=saved.length?saved:enemies.filter(e=>e.hp>0);let dealt=0;
        if(cast.mode==='ultimate'){
          if(targets.length&&cast.amount>0){const pool=Math.min(cast.amount,u.atk*HYEOKJIN_RULES.ultimateCap),primary=targets.length>1?pool*.7:pool,splash=targets.length>1?pool*.3/(targets.length-1):0;targets.forEach((e,i)=>{dealt+=hit(e,i?splash:primary,{mode:cast.mode,skill:HYEOKJIN_MOVES[cast.mode].name,fixed:true,ultimate:true});});}
        }else{
          const r=HYEOKJIN_RULES,multiplier=cast.mode==='basic'?r.basicMultiplier:cast.mode==='recovery'?r.recoveryMultiplier:cast.mode==='black'?r.blackMultiplier:targets[0]?.hp/targets[0]?.max<=.3?r.executionLowMultiplier:r.executionMultiplier;
          const victims=targets.slice(0,cast.mode==='execution'?1:3);
          for(const [i,e] of victims.entries()){const mult=i&&cast.mode==='basic'?r.basicSplash:i&&cast.mode==='recovery'?r.recoverySplash:multiplier;dealt+=hit(e,u.atk*mult*(cast.awakened?r.awakeMultiplier:1)*(time<q.lastUntil?1.3:1),{mode:cast.mode,skill:cast.mode==='basic'?null:HYEOKJIN_MOVES[cast.mode].name});}
          if(cast.mode==='recovery'&&dealt>0)hyeokjinHeal(u,u.max*.1,emit,'죽지 않는 청년');
          if(cast.mode==='execution'&&dealt>0&&victims[0]?.hp<=0)hyeokjinHeal(u,u.max*.15,emit,'참수');
        }
        emit('hyeokjin-impact',{mode:cast.mode,name:HYEOKJIN_MOVES[cast.mode].name,targets:targets.map(e=>e.id),amount:dealt});
      }
      if(time<q.modeUntil||cast.mode==='execution'&&!cast.done)return;q.cast=null;q.mode='idle';
    }
    if(time<q.modeUntil||!enemies.some(e=>e.hp>0))return;
    const awake=hyeokjinAwake(u,time);let mode;
    if(awake&&!q.ultimateUsed&&q.ultimateArmed){mode='ultimate';q.ultimateUsed=true;}
    else if(awake&&!q.executeUsed&&time>=q.nextExecute){mode='execution';q.executeUsed=true;}
    else if(awake&&time>=q.nextBlack){mode='black';q.nextBlack=time+4000;}
    else if(!awake&&time>=q.nextHeal){mode='recovery';q.nextHeal=time+10000;}
    else if(time>=q.nextBasic)mode='basic';else return;
    const speed=mode==='basic'?Math.max(.5,Math.min(2,haste)):1,def=HYEOKJIN_MOVES[mode];
    const began=mode==='basic'&&q.nextBasic>time-dt?Math.min(time,q.nextBasic):time;
    q.mode=mode;q.began=began;q.modeUntil=began+def.duration/speed;q.nextBasic=began+(awake?1400:1800)/speed;
    q.cast={mode,at:Math.ceil((began+def.hit/speed)/dt)*dt,amount:mode==='ultimate'?Math.min(u.atk*HYEOKJIN_RULES.ultimateBase+q.total*HYEOKJIN_RULES.ultimateStored,u.atk*HYEOKJIN_RULES.ultimateCap):0,targets:enemies.filter(e=>e.hp>0).slice(0,mode==='execution'?1:30).map(e=>e.id),done:false,awakened:awake,...(mode==='execution'?{tick:0}:{})};
    q.modeUntil=Math.max(q.modeUntil,q.cast.at+(mode==='execution'?(HYEOKJIN_RULES.executionTicks-1)*HYEOKJIN_RULES.executionTickMs:0)+Math.min(dt,300));
    emit('hyeokjin-mode',{mode,name:def.name,duration:q.modeUntil-time,impactDelay:q.cast.at-time,awakened:awake,until:q.until});
  }

  const KAZUA_RULES = Object.freeze({fireMs:3000,reloadMs:2000,volleyMs:500,basicMultiplier:1.2,pistolMs:5000,pistolMultiplier:5.2,bazookaMs:15000,bazookaMultiplier:7,redMs:20000,redDuration:3000,redMultiplier:35,splash:.35,evasion:.1,aggro:.4,fallenBonus:.12,lastBonus:2.4});
  function kazuaPower(allies,initial=allies.map(u=>u.id)) {
    const original=allies.filter(u=>initial.includes(u.id)),fallen=original.filter(u=>u.id!=='kazua'&&u.hp<=0).length;
    const alone=initial.length>1&&original.filter(u=>u.hp>0).length===1&&original.some(u=>u.id==='kazua'&&u.hp>0);
    return 1+Math.min(.6,fallen*KAZUA_RULES.fallenBonus)+(alone?KAZUA_RULES.lastBonus:0);
  }
  function validKazua(q){return q===undefined||!!(q&&['idle','fire','reload','pistol','bazooka','red'].includes(q.mode)&&['fire','reload'].includes(q.phase)&&['clock','phaseMs','volley','skillUntil','nextPistol','nextBazooka','nextRed','modeSince','credit'].every(k=>Number.isFinite(q[k])&&q[k]>=0)&&q.credit<250&&q.phaseMs<=3000&&q.volley<=500&&q.power>=1&&q.power<=4.001&&Array.isArray(q.initial)&&q.initial.length>=1&&q.initial.length<=6&&new Set(q.initial).size===q.initial.length&&q.initial.every(id=>Object.hasOwn(BY_ID,id)));}
  // The same bounded 250 ms state machine serves campaign, raids and PvP.
  // Bullets are visual; damage is grouped into 500 ms volleys, never 50 timers/s.
  function kazuaStep(unit,allies,enemies,time,dt,hit,emit=()=>{},blocked=false,haste=1){
    const q=unit.kazua||={clock:0,phase:'fire',phaseMs:0,mode:'fire',modeSince:Math.max(0,time-dt),volley:0,skillUntil:0,nextPistol:5000,nextBazooka:15000,nextRed:20000,credit:0,power:1,initial:allies.map(u=>u.id)};
    if(blocked||unit.hp<=0)return q;
    q.credit+=Math.max(0,Math.min(500,dt));
    const change=(mode,at)=>{if(q.mode===mode)return;q.mode=mode;q.modeSince=at;emit('kazua-mode',{mode,power:q.power});};
    const shoot=(mode,mult)=>{const live=enemies.filter(e=>e.hp>0);if(!live.length)return;const targets=mode==='bazooka'||mode==='red'?live:[live[0]];
      emit('kazua-shot',{mode,targets:targets.map(e=>e.id),bullets:mode==='red'?25:mode==='fire'?10:1,power:q.power});
      targets.forEach((e,i)=>hit(e,mult*q.power*(mode==='red'&&i?KAZUA_RULES.splash:1)*(mode==='fire'?Math.max(.5,Math.min(1.5,haste)):1),{mode,skill:mode==='fire'?null:mode==='red'?'붉은총알':mode==='pistol'?'권총':'바주카포'}));};
    while(q.credit>=250){q.credit-=250;q.clock+=250;const at=Math.max(0,time-q.credit),power=kazuaPower(allies,q.initial);
      if(power!==q.power){q.power=power;emit('kazua-survivor',{power});}
      if(q.mode==='red'){
        q.volley+=250;if(q.volley>=500){q.volley-=500;shoot('red',KAZUA_RULES.redMultiplier/6);}
        if(q.clock>=q.skillUntil){q.volley=0;change(q.phase,at);}continue;
      }
      if(q.mode==='pistol'||q.mode==='bazooka'){if(q.clock<q.skillUntil)continue;change(q.phase,at);}
      if(q.clock>=q.nextRed){q.nextRed=q.clock+KAZUA_RULES.redMs;q.skillUntil=q.clock+KAZUA_RULES.redDuration;q.volley=0;change('red',at);continue;}
      if(q.clock>=q.nextBazooka){q.nextBazooka=q.clock+KAZUA_RULES.bazookaMs;q.skillUntil=q.clock+1000;change('bazooka',at);shoot('bazooka',KAZUA_RULES.bazookaMultiplier);continue;}
      if(q.clock>=q.nextPistol){q.nextPistol=q.clock+KAZUA_RULES.pistolMs;q.skillUntil=q.clock+500;change('pistol',at);shoot('pistol',KAZUA_RULES.pistolMultiplier);continue;}
      q.phaseMs+=250;
      if(q.phase==='fire'){q.volley+=250;if(q.volley>=500){q.volley-=500;shoot('fire',KAZUA_RULES.basicMultiplier);}}
      if(q.phaseMs>=(q.phase==='fire'?KAZUA_RULES.fireMs:KAZUA_RULES.reloadMs)){q.phaseMs=0;q.volley=0;q.phase=q.phase==='fire'?'reload':'fire';change(q.phase,at);}
    }unit.energy=Math.max(0,20-(q.nextRed-q.clock)/1000);return q;
  }
  function kazuaInfo(s){const u=s.battle?.heroes?.find(u=>u.id==='kazua'),q=u?.kazua;return {mode:q?.mode||'idle',power:q?.power||1,nextRedMs:q?Math.max(0,q.nextRed-q.clock):20000};}
  function lowAggroTarget(target,alive,rng){if(target?.id!=='kazua'||alive.length<2||rng()<KAZUA_RULES.aggro)return target;const others=alive.filter(u=>u.id!=='kazua');return others[Math.floor(rng()*others.length)];}
  const CHAPTERS = ["오래된 교실", "방과 후 복도", "비밀의 도서관", "뒤뜰의 정원", "체육관 결계", "별이 내리는 옥상", "눈 내린 운동장", "잊혀진 별관", "마력 실험실", "지하 통로", "학교의 경계", "바람의 성소", "침식된 미술실", "뒤집힌 천문관", "멈춰진 종루"];
  const ENEMIES = ["분필 슬라임", "낙서 유령", "종이 박쥐", "덩굴 정령", "체육관 골렘", "별가루 망령", "눈송이 정령", "종이 갑옷", "마력 실험체", "그림자 박쥐", "경계 파수꾼", "폭풍 정령", "석고 수문장", "별자리 추적자", "태엽 순찰병"];
  const ENEMY_VARIANTS = [
    ["분필 슬라임", "지우개 미믹", "연필 꼬마악마"], ["시계 정령", "사물함 미믹", "대걸레 유령"],
    ["책 박쥐", "두루마리 망령", "잉크 거미"], ["화분 덩굴", "물뿌리개 요정", "갈퀴 허수아비"],
    ["폭주 농구공", "아령 집게", "호루라기 정령"], ["별빛 망원경", "천체구 정령", "종이학 환영"],
    ["서리 종", "목도리 눈사람", "얼음 표지콘"], ["빈 교복 기사", "책상 미믹", "금간 칠판병"],
    ["마력 플라스크", "현미경 감시자", "자석 골렘"], ["양동이 소라게", "배수관 장어", "젖은 우산 요괴"],
    ["바람 깃발", "나침반 파수꾼", "연 가오리"], ["신당의 방울", "부적 망령", "설원의 여우탈"],
    ["석고 수문장", "거울 화구", "물감 복원사"], ["별자리 추적자", "반전 망원경", "성도 기록자"], ["태엽 순찰병", "진자 사수", "종루 조율사"],
  ];
  const BOSSES = ["칠판의 수호자", "잃어버린 종소리", "금서의 파수꾼", "오래된 나무", "철벽 체육부장", "옥상의 달그림자", "얼어붙은 운동장지기", "별관의 잊힌 기사", "폭주한 마력핵", "지하의 눈먼 수호자", "경계를 삼키는 그림자", "성소의 폭풍왕", "미완성의 초상", "천구의 관측자", "열세 번째 종지기"];
  const ASCENSION_CHAPTERS = [
    ['침몰한 수족관','심해 잠수병','유리 수조의 군주',['심해 잠수병','해파리 사수','산호 치유사']],
    ['붉은 온실','가시 갑옷','혈장미의 여왕',['가시 갑옷','씨앗 추격자','붉은 정원사']],
    ['유리 강당','수정 검병','천 개의 반사상',['수정 검병','거울 조준수','유리 합창단']],
    ['잿빛 학생회실','서약의 기사','이름 없는 의장',['서약의 기사','그림자 서기','봉인의 기록관']],
    ['균열의 졸업식장','공허 졸업생','마지막 종의 파수꾼',['공허 졸업생','별빛 추방자','균열 봉합사']]
  ];
  for(const [name,enemy,boss,variants] of ASCENSION_CHAPTERS){CHAPTERS.push(name);ENEMIES.push(enemy);BOSSES.push(boss);ENEMY_VARIANTS.push(variants);}
  for(let i=0;i<5;i++){CHAPTERS.push('하드 · '+CHAPTERS[i]);ENEMIES.push('침식된 '+ENEMIES[i]);BOSSES.push('침식된 '+BOSSES[i]);ENEMY_VARIANTS.push(ENEMY_VARIANTS[i].map(n=>'침식된 '+n));}
  const visualChapter = stage => {const n=chapter(stage);return n>=20?n-20:n;};
  const CHAPTER_TRAITS=Object.freeze({
    12:Object.freeze({name:'침식된 미술실',tip:'석고는 물리 피해 35% 감소, 거울은 마법 피해 35% 감소. 복원사의 치유는 기절로 끊으세요.',boss:'미완성의 초상 · 8초마다 물감 파동'}),
    13:Object.freeze({name:'뒤집힌 천문관',tip:'망원경의 후열 조준을 주의하세요. 성도 기록자는 생존 적에게 최대 HP 8% 보호막을 부여합니다.',boss:'천구의 관측자 · 9초마다 성좌 낙하'}),
    14:Object.freeze({name:'멈춰진 종루',tip:'태엽병은 10초마다 공격력 6% 증가(최대 36%). 진자 사수는 후열을 노리고 조율사는 치유합니다.',boss:'열세 번째 종지기 · 10초마다 멈춘 시간의 종'}),
    15:Object.freeze({name:CHAPTERS[15],tip:'잠수병은 물리 피해 25% 감소. 해파리의 후열 공격과 산호 치유를 차단하세요.',boss:BOSSES[15]+' · 광역 공격 예고를 주의하세요.'}),
    16:Object.freeze({name:CHAPTERS[16],tip:'가시 갑옷은 마법 피해 25% 감소. 정원사가 생존 적에게 HP 6% 보호막을 부여합니다.',boss:BOSSES[16]+' · 광역 공격 예고를 주의하세요.'}),
    17:Object.freeze({name:CHAPTERS[17],tip:'수정 검병은 물리 피해 25%, 거울 조준수는 마법 피해 25% 감소. 혼합 편성을 준비하세요.',boss:BOSSES[17]+' · 광역 공격 예고를 주의하세요.'}),
    18:Object.freeze({name:CHAPTERS[18],tip:'서약 기사는 시간이 지날수록 공격력 증가. 기록관의 치유를 먼저 차단하세요.',boss:BOSSES[18]+' · 광역 공격 예고를 주의하세요.'}),
    19:Object.freeze({name:CHAPTERS[19],tip:'졸업생은 물리·마법 피해 15% 감소. 봉합사의 보호막과 후열 공격에 대비하세요.',boss:BOSSES[19]+' · 광역 공격 예고를 주의하세요.'}),
    20:Object.freeze({name:CHAPTERS[20],tip:'침식된 적들이 강화된 기술을 사용합니다. 전열은 피해 15% 감소, 후열은 집중 사격, 지원은 보호막을 부여합니다.',boss:BOSSES[20]+' · 광역 공격 예고를 주의하세요.'}),
    21:Object.freeze({name:CHAPTERS[21],tip:'침식된 적들이 강화된 기술을 사용합니다. 전열은 피해 15% 감소, 후열은 집중 사격, 지원은 보호막을 부여합니다.',boss:BOSSES[21]+' · 광역 공격 예고를 주의하세요.'}),
    22:Object.freeze({name:CHAPTERS[22],tip:'침식된 적들이 강화된 기술을 사용합니다. 전열은 피해 15% 감소, 후열은 집중 사격, 지원은 보호막을 부여합니다.',boss:BOSSES[22]+' · 광역 공격 예고를 주의하세요.'}),
    23:Object.freeze({name:CHAPTERS[23],tip:'침식된 적들이 강화된 기술을 사용합니다. 전열은 피해 15% 감소, 후열은 집중 사격, 지원은 보호막을 부여합니다.',boss:BOSSES[23]+' · 광역 공격 예고를 주의하세요.'}),
    24:Object.freeze({name:CHAPTERS[24],tip:'침식된 적들이 강화된 기술을 사용합니다. 전열은 피해 15% 감소, 후열은 집중 사격, 지원은 보호막을 부여합니다.',boss:BOSSES[24]+' · 광역 공격 예고를 주의하세요.'})
  });
  const QUESTS = [
    { id: "first", name: "첫 번째 교실", desc: "1-1 지역 클리어", goal: 1, metric: "best", gold: 200, gems: 100 },
    { id: "recruit", name: "새로운 동료", desc: "용병 10회 모집", goal: 10, metric: "pulls", gold: 300, gems: 150 },
    { id: "collection", name: "우리들의 동아리", desc: "서로 다른 용병 6명 수집", goal: 6, metric: "collection", gold: 500, gems: 200 },
    { id: "chapter", name: "교실 너머로", desc: "1-5 지역 클리어", goal: 5, metric: "best", gold: 700, gems: 200 },
    { id: "captain", name: "믿음직한 단장", desc: "단장 레벨 5 달성", goal: 5, metric: "captain", gold: 900, gems: 250 },
    { id: "veteran", name: "학교를 지키는 사람들", desc: "3-5 지역 클리어", goal: 15, metric: "best", gold: 2000, gems: 400 },
    { id: "graduation", name: "학교의 전설", desc: "6-5 지역 클리어", goal: 30, metric: "best", gold: 5000, gems: 1000 },
  ];
  const PROGRESS_QUESTS = Object.freeze([
    { id: "repeat-kills", category: "repeat", name: "끝없는 토벌", desc: "몬스터 75마리 처치", metric: "kills", goal: 75, gems: 40, gold: 250 },
    { id: "repeat-waves", category: "repeat", name: "꾸준한 전투", desc: "전투 웨이브 30회 승리", metric: "waves", goal: 30, gems: 40, gold: 350 },
    { id: "repeat-bosses", category: "repeat", name: "학교의 수호자", desc: "모험 보스 10회 처치", metric: "bosses", goal: 10, gems: 60, gold: 500 },
    { id: "daily-kills", category: "daily", name: "오늘의 토벌", desc: "오늘 몬스터 50마리 처치", metric: "kills", goal: 50, gems: 30, gold: 300 },
    { id: "daily-waves", category: "daily", name: "오늘의 출전", desc: "오늘 전투 웨이브 15회 승리", metric: "waves", goal: 15, gems: 30, gold: 300 },
    { id: "daily-bosses", category: "daily", name: "오늘의 보스", desc: "오늘 모험 보스 2회 처치", metric: "bosses", goal: 2, gems: 40, gold: 500 },
  ].map(Object.freeze));
  const EXTRA_QUESTS = Object.freeze([
    { id: "collection-10", name: "열 명의 동료", desc: "서로 다른 용병 10명 수집", metric: "collection", goal: 10, gems: 250, gold: 1000 },
    { id: "collection-15", name: "든든한 용병단", desc: "서로 다른 용병 15명 수집", metric: "collection", goal: 15, gems: 400, gold: 1500 },
    { id: "captain-10", name: "성장하는 단장", desc: "단장 레벨 10 달성", metric: "captain", goal: 10, gems: 200, gold: 1200 },
    { id: "captain-25", name: "숙련된 단장", desc: "단장 레벨 25 달성", metric: "captain", goal: 25, gems: 400, gold: 2500 },
  ].map(Object.freeze));
  const QUEST_CLAIM_LIMIT = 100, QUEST_COUNTER_LIMIT = 1000000000;
  const captainReward = (level, now = 0) => rewardBonus({ gems: 160, gold: earnedGold(500 + 100 * level) },now);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fail = (condition, message) => { if (!condition) throw new Error(message); };
  const clone = value => JSON.parse(JSON.stringify(value));
  function random(s) { let x = s.seed | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.seed = x >>> 0; return s.seed / 4294967296; }
  const day = now => Math.floor((now + 9 * 3600000) / 86400000);
  const week = now => Math.floor((day(now) + 3) / 7);
  const PASS_MAX_LEVEL=50,PASS_LEVEL_XP=100;
  const PASS_QUESTS=Object.freeze([
    {id:'login',daily:true,name:'오늘도 함께',metric:'login',goal:1,xp:40},
    {id:'kills',daily:true,name:'오늘의 토벌',metric:'kills',goal:150,xp:60},
    {id:'waves',daily:true,name:'꾸준한 출전',metric:'waves',goal:30,xp:60},
    {id:'bosses',daily:true,name:'강적에게 도전',metric:'bosses',goal:5,xp:40},
    ...[['kills',[500,1500,3000],'누적 토벌'],['waves',[100,300,600],'누적 전투'],['bosses',[20,50,100],'누적 보스']].flatMap(([metric,goals,name])=>goals.map(goal=>({id:metric+'-'+goal,daily:false,name,metric,goal,xp:100})))
  ].map(Object.freeze));
  const passDaily=now=>({day:day(now),kills:0,waves:0,bosses:0,claimed:[]});
  const newPass=now=>({version:1,xp:0,counts:{kills:0,waves:0,bosses:0},daily:passDaily(now),milestones:[],rewards:[]});
  function passState(s,now=s.at){const p=s.battlePass||=newPass(now);if(day(now)>p.daily.day)p.daily=passDaily(now);return p;}
  function validPass(p){
    if(p===undefined)return true;
    const counts=v=>v&&['kills','waves','bosses'].every(k=>Number.isSafeInteger(v[k])&&v[k]>=0&&v[k]<=QUEST_COUNTER_LIMIT);
    const list=(a,max,check)=>Array.isArray(a)&&a.length<=max&&new Set(a).size===a.length&&a.every(check);
    return !!(p&&p.version===1&&Number.isInteger(p.xp)&&p.xp>=0&&p.xp<=4900&&counts(p.counts)&&counts(p.daily)&&Number.isSafeInteger(p.daily.day)&&p.daily.day>=0&&list(p.daily.claimed,4,id=>PASS_QUESTS.some(q=>q.daily&&q.id===id))&&list(p.milestones,9,id=>PASS_QUESTS.some(q=>!q.daily&&q.id===id))&&list(p.rewards,50,n=>Number.isInteger(n)&&n>=1&&n<=Math.min(50,1+Math.floor(p.xp/100))));
  }
  function passReward(level){
    if(level%5===0){const rarity=level===25||level===50?'SSR':'SR',gear=GEAR.filter(g=>!g.owner&&g.rarity===rarity);return {item:gear[(level/5-1)%gear.length].id,count:1};}
    return level%5===2||level%5===4?{snowflakes:20+Math.floor(level/10)*5}:{gold:4000+level*500};
  }
  function passInfo(s,now=s.at){
    const p=s.battlePass||newPass(Math.max(s.at,now)),d=day(Math.max(s.at,now))>p.daily.day?passDaily(Math.max(s.at,now)):p.daily,level=Math.min(50,1+Math.floor(p.xp/100));
    return {level,xp:p.xp,progress:level===50?100:p.xp%100,maxLevel:50,nextXp:100,day:d.day,
      quests:PASS_QUESTS.map(q=>{const value=q.metric==='login'?1:(q.daily?d:p.counts)[q.metric],claimed=(q.daily?d.claimed:p.milestones).includes(q.id);return {...q,value:Math.min(q.goal,value),claimed,ready:!claimed&&value>=q.goal&&level<50};}),
      rewards:Array.from({length:50},(_,i)=>{const n=i+1,claimed=p.rewards.includes(n);return {level:n,...passReward(n),claimed,ready:n<=level&&!claimed};})};
  }
  function passAction(s,input,now){
    const info=passInfo(s,now);
    if(input.kind==='pass-quest'){
      const q=info.quests.find(q=>q.id===input.quest);fail(q?.ready,'완료한 미수령 패스 임무를 선택하세요.');
      const p=passState(s,now),before=p.xp;(q.daily?p.daily.claimed:p.milestones).push(q.id);p.xp=Math.min(4900,p.xp+q.xp);
      return {kind:input.kind,xp:p.xp-before,level:Math.min(50,1+Math.floor(p.xp/100))};
    }
    const r=info.rewards.find(r=>r.level===input.level);fail(r?.ready,'해금한 미수령 패스 보상을 선택하세요.');
    if(r.gold)fail(Number.isSafeInteger(s.gold+r.gold),'코인 보유량을 확인해 주세요.');
    if(r.item)fail((s.equipment?.inventory?.[r.item]?.count||0)<GEAR_MAX_COUNT,'장비 보유 한도에 도달했습니다.');
    if(r.snowflakes)fail(Number.isSafeInteger((s.winter?.earned||0)+r.snowflakes),'눈송이 보유량을 확인해 주세요.');
    const p=passState(s,now);p.rewards.push(r.level);
    if(r.gold)s.gold+=r.gold;
    if(r.snowflakes){const w=s.winter||=newWinter(now);w.snowflakes+=r.snowflakes;w.earned+=r.snowflakes;}
    if(r.item){const gear=s.equipment||=newEquipment(),item=gear.inventory[r.item]||={count:0,stars:0};item.count++;}
    return {kind:input.kind,level:r.level,...passReward(r.level)};
  }
  function newQuestState(now) {
    return { version: 1, repeat: { kills: 0, waves: 0, bosses: 0 }, daily: { day: day(now), kills: 0, waves: 0, bosses: 0, claimed: [] } };
  }
  function validQuestState(q) {
    if (q === undefined) return true;
    const counts = block => block && ["kills", "waves", "bosses"].every(key => Number.isSafeInteger(block[key]) && block[key] >= 0 && block[key] <= QUEST_COUNTER_LIMIT);
    return !!(q && q.version === 1 && counts(q.repeat) && counts(q.daily) && Number.isSafeInteger(q.daily.day) && q.daily.day >= 0 && Array.isArray(q.daily.claimed) &&
      q.daily.claimed.length <= 3 && new Set(q.daily.claimed).size === q.daily.claimed.length && q.daily.claimed.every(id => PROGRESS_QUESTS.some(def => def.id === id && def.category === "daily")));
  }
  function refreshQuestState(s, now) {
    const q = s.quests ||= newQuestState(now);
    if (day(now) > q.daily.day) q.daily = newQuestState(now).daily;
    return q;
  }
  function questCombatEligible(s) {
    const activity = s.battle?.activity;
    return activity ? activity.kind !== "tower" || activity.floor > (s.activities?.towerBest || 0) : campaignRewardInfo(s).eligible;
  }
  function questProgress(s, metric, amount = 1) {
    const p=passState(s);p.counts[metric]=Math.min(QUEST_COUNTER_LIMIT,p.counts[metric]+amount);p.daily[metric]=Math.min(QUEST_COUNTER_LIMIT,p.daily[metric]+amount);
    const q = refreshQuestState(s, s.at);
    q.repeat[metric] = Math.min(QUEST_COUNTER_LIMIT, q.repeat[metric] + amount);
    q.daily[metric] = Math.min(QUEST_COUNTER_LIMIT, q.daily[metric] + amount);
  }
  // Read-only projection; old lifetime kills cannot mint new repeat rewards.
  function questBoard(s, now = Date.now()) {
    const time = Number.isFinite(now) && now >= 0 ? Math.max(s.at, now) : s.at;
    const stored = s.quests || newQuestState(time), currentDay = Math.max(stored.daily.day, day(time));
    const daily = currentDay === stored.daily.day ? stored.daily : newQuestState(time).daily;
    const items = PROGRESS_QUESTS.map(def => {
      const value = (def.category === "repeat" ? stored.repeat : daily)[def.metric];
      const claimed = def.category === "daily" && daily.claimed.includes(def.id);
      const cycles = claimed ? 0 : def.category === "repeat" ? Math.min(QUEST_CLAIM_LIMIT, Math.floor(value / def.goal)) : value >= def.goal ? 1 : 0;
      return { ...def, value, progress: Math.min(def.goal, value), claimed, cycles, ready: cycles > 0 };
    });
    for (let stage = 1; stage <= MAX_STAGE; stage++) {
      const id = `stage-${stage}`, claimed = s.claimed.includes(id), value = s.best >= stage ? 1 : 0, cycles = !claimed && value ? 1 : 0;
      items.push({ id, name: `${stageName(stage)} 첫 돌파`, desc: `${CHAPTERS[chapter(stage)]} · ${stageName(stage)} 지역 클리어`, category: "stage", stage, metric: "best", goal: 1, value, progress: value, claimed, cycles, ready: cycles > 0, gems: 80, gold: 200 + 20 * stage });
    }
    for (const def of [...QUESTS, ...EXTRA_QUESTS]) {
      const value = questValue(s, def), claimed = s.claimed.includes(def.id), cycles = !claimed && value >= def.goal ? 1 : 0;
      items.push({ ...def, category: "milestone", value, progress: Math.min(def.goal, value), claimed, cycles, ready: cycles > 0 });
    }
    for (const item of items) item.gold = rewardBonus({gold:earnedGold(item.gold)},time).gold;
    const ready = items.filter(item => item.ready);
    return { items, readyCount: ready.length, readyGems: ready.reduce((sum, q) => sum + q.gems * q.cycles, 0), readyGold: ready.reduce((sum, q) => sum + q.gold * q.cycles, 0), day: currentDay, resetsAt: (currentDay + 1) * 86400000 - 9 * 3600000 };
  }
  const questReady = (s, now = Date.now()) => questBoard(s, now).readyCount;
  function normalizeCommanderName(raw) {
    if (typeof raw !== "string" || raw.length > 128 || /[\p{C}<>]/u.test(raw)) return null;
    const name = raw.normalize("NFC").trim().replace(/\p{Zs}+/gu, " ");
    const length = Array.from(name).length;
    return length >= 2 && length <= 12 && /^[\p{L}\p{N} _-]+$/u.test(name) ? name : null;
  }
  function newEquipment() { return { inventory: {}, equipped: {} }; }
  function validEquipment(s) {
    const gear = s.equipment; if (gear === undefined) return true;
    if (!gear || typeof gear !== "object" || Array.isArray(gear) || !gear.inventory || typeof gear.inventory !== "object" || Array.isArray(gear.inventory) || !gear.equipped || typeof gear.equipped !== "object" || Array.isArray(gear.equipped)) return false;
    const worn = {};
    for (const [id, item] of Object.entries(gear.inventory)) if (!Object.hasOwn(GEAR_BY_ID, id) || !item || !Number.isSafeInteger(item.count) || item.count < 1 || item.count > GEAR_MAX_COUNT || !Number.isInteger(item.stars) || item.stars < 0 || item.stars > 5) return false;
    for (const [hero, loadout] of Object.entries(gear.equipped)) {
      if (!Object.hasOwn(s.units, hero) || !loadout || typeof loadout !== "object" || Array.isArray(loadout)) return false;
      for (const [slot, id] of Object.entries(loadout)) {
        if (!GEAR_SLOTS.includes(slot) || typeof id !== "string" || !Object.hasOwn(GEAR_BY_ID, id) || GEAR_BY_ID[id].slot !== slot || !Object.hasOwn(gear.inventory, id)) return false;
        worn[id] = (worn[id] || 0) + 1;
      }
    }
    return Object.entries(worn).every(([id, count]) => count <= gear.inventory[id].count);
  }
  function gearBonus(id, stars = 0) {
    const def = Object.hasOwn(GEAR_BY_ID, id) ? GEAR_BY_ID[id] : null; if (!def) return { atk: 0, hp: 0 };
    const level = Number.isInteger(stars) ? clamp(stars, 0, 5) : 0;
    return { atk: def.atk + def.starAtk * level, hp: def.hp + def.starHp * level };
  }
  function equipmentBonus(s, hero) {
    const gear = s?.equipment, bonus = { atk: 0, hp: 0 };
    for (const id of Object.values(gear?.equipped?.[hero] || {})) {
      if (!gear.inventory?.[id]) continue;
      const value = gearBonus(id, gear.inventory[id].stars); bonus.atk += value.atk; bonus.hp += value.hp;
    }
    return bonus;
  }
  function weaponPassive(item, stars=0) {
    const def=GEAR_BY_ID[item]; if(!def?.owner)return null;
    stars=clamp(Math.floor(stars)||0,0,5);
    const strength=(10+stars*1.6)/100, skill=(12+stars*1.6)/100;
    if(def.owner==='osia')return {id:item,owner:def.owner,name:def.passive,stars,divine:true,attack:.35+stars*.02,vitality:.25,basic:.25+stars*.03,skill:.6+stars*.04,dragon:1.6,dragonShield:.8+stars*.08,
      description:`오시아 전용: 공격력 +${35+stars*2}%, 최대 HP +25%, 평타 피해 +${25+stars*3}%, 물 스킬 피해 +${60+stars*4}%. 거대 수룡이 용의 신수로 변화합니다. 소환·흡기 후 2.3초간 물 브레스로 적 전체를 공격하고 최초 명중 시 2초 기절시킵니다. 총 피해가 추가로 60% 증가하고 공격력 ${80+stars*8}%의 보호막을 얻습니다. 전투당 최초 1회, 전투 시작 10초 후 해연의 창이 적 하나에게 2초 동안 최대 HP 10%의 익사 피해(마법 속성·방어/보호막 무시)를 줍니다. 길드 보스에게는 발동하지 않습니다. 다른 보스는 최대 HP 10% 적용. 마법 피해 감소는 적용되며 아레나에서만 공격력 250% 한도입니다.`};
    if(def.owner==='ryusion')return {id:item,owner:def.owner,name:def.passive,stars,tauntReduction:.68+.008*stars,shieldRatio:.105+.003*stars,tauntShieldRatio:.03+.004*stars,
      description:`도발 중 피해 감소 ${68+.8*stars}%. 전체 보호막이 최대 HP ${(10.5+.3*stars).toFixed(1)}%로 증가. 도발 시작 시 본인에게 최대 HP ${3+.4*stars}%의 대지 보호막(기존 보호막과 중첩되지 않음). 아군 피해 감소 8%는 그대로 유지됩니다.`};
    return {id:item,owner:def.owner,name:def.passive,stars,strength,skill,
      description:def.owner==="osia"?`물 스킬 피해 +${Number((skill*100).toFixed(1))}%. 수룡 적중 후 자신에게 공격력 20%의 보호막.`:
      def.owner==="lava"?`회복·보호막 +${Number((strength*100).toFixed(1))}%. 바람의 상처의 초과 회복 15%를 보호막으로 전환(공격력 40% 한도).`:
      `평타·벚꽃의식 피해 +${Number((strength*100).toFixed(1))}%. 의식 표식이 8초간 유지됩니다.`};
  }
  function exclusivePassive(s, hero) {
    const id=s?.equipment?.equipped?.[hero]?.weapon, item=s?.equipment?.inventory?.[id];
    return item&&GEAR_BY_ID[id]?.owner===hero?weaponPassive(id,item.stars):null;
  }
  const OSIA_WEAPON_RULES=Object.freeze({interval:10000,tickMs:500,ticks:4,healthRatio:.1,arenaCap:2.5});
  const osiaDivine=unit=>unit?.id==='osia'&&unit.exclusive?.id==='osia_scepter'&&unit.exclusive?.owner==='osia';
  const osiaSkillMultiplier=(unit,stage)=>(1+(unit?.exclusive?.skill||0))*(stage===4&&osiaDivine(unit)?unit.exclusive.dragon||1:1);
  const osiaBasicMultiplier=unit=>osiaDivine(unit)?1+(unit.exclusive.basic||0):1;
  const osiaSkillName=(unit,stage)=>stage===4&&osiaDivine(unit)?'용의 신수':OSIA_SKILLS[stage-1].name;
  function validOsiaWeapon(value){
    if(value===undefined)return true;
    const time=n=>Number.isSafeInteger(n)&&n>=0,d=value?.dot;
    return !!(value&&time(value.lastAt)&&time(value.nextAt)&&(value.used===undefined||typeof value.used==='boolean')&&(d===undefined||d&&typeof d.targetId==='string'&&d.targetId.length<=100&&time(d.nextAt)&&Number.isSafeInteger(d.remaining)&&d.remaining>=1&&d.remaining<=4&&Number.isSafeInteger(d.total)&&d.total>=0&&Number.isSafeInteger(d.paid)&&d.paid>=0&&d.paid<=d.total));
  }
  // One shared clock drives campaign, raids and PvP. A resumed/stunned caster
  // never drains a cooldown backlog into one rendered frame.
  function osiaWeaponStep(unit,targets,now,delta,hit,emit,blocked=false,context={}){
    if(!unit)return;
    if(!osiaDivine(unit)||context.guildRaid){delete unit.osiaWeapon;return;}
    const rule=OSIA_WEAPON_RULES;
    const state=unit.osiaWeapon||={lastAt:Math.max(0,now-delta),nextAt:Math.max(0,now-delta)+rule.interval,used:false};
    // Legacy active battles may already have spent their first cast.
    if(state.used===undefined)state.used=!!state.dot||state.nextAt>rule.interval;
    if(now<=state.lastAt)return;
    const dt=Math.min(delta,now-state.lastAt);state.lastAt=now;
    if(unit.hp<=0){delete state.dot;state.nextAt=now+rule.interval;return;}
    if(blocked){state.nextAt=Math.max(now+dt,state.nextAt+dt);if(state.dot)state.dot.nextAt=now+rule.tickMs;return;}
    if(state.dot){const dot=state.dot,target=targets.find(e=>e.id===dot.targetId&&e.hp>0);
      if(!target)delete state.dot;
      else if(now>=dot.nextAt){const cumulative=Math.round(dot.total*(rule.ticks-dot.remaining+1)/rule.ticks),amount=cumulative-dot.paid;dot.paid=cumulative;dot.remaining--;dot.nextAt=now+rule.tickMs;
        if(amount>0)hit(target,amount,{drowning:true,directHp:true,damageType:'magic',critical:false,name:'익사'});if(!dot.remaining)delete state.dot;}
    }
    if(state.used||now<state.nextAt||state.dot)return;
    const target=targets.find(e=>e.hp>0);if(!target)return;
    const cap=context.arena?unit.atk*rule.arenaCap:Infinity;
    const total=Math.max(0,Math.floor(Math.min(target.max*rule.healthRatio,cap)));
    state.used=true;state.nextAt=now+rule.interval;state.dot={targetId:target.id,total,paid:0,remaining:rule.ticks,nextAt:now+rule.tickMs};
    emit('osia-drowning',{to:target.id,target:target.id,targets:[target.id],name:'해연의 창 · 익사',duration:rule.tickMs*rule.ticks,until:now+rule.tickMs*rule.ticks,element:'water',divine:true});
  }
  function weaponRates(pity=0) { const r=recruitRates(pity); return {EX:r.SSR,SR:r.SR,R:r.R}; }
  function weaponBannerState(s,id) { const b=Object.hasOwn(WEAPON_BANNERS,id)&&WEAPON_BANNERS[id]; return b?{pity:s.weaponBanners?.[b.group]?.pity||0}:null; }
  function weaponAvailable(id,now=Date.now()) {const b=Object.hasOwn(WEAPON_BANNERS,id)&&WEAPON_BANNERS[id];return !!b&&Number.isFinite(now)&&(b.expiresAt===null||now<b.expiresAt);}
  function validWeaponRecruit(s) {
    return (s.weaponBanners===undefined||s.weaponBanners&&typeof s.weaponBanners==="object"&&!Array.isArray(s.weaponBanners)&&Object.keys(s.weaponBanners).every(k=>["standard","limited"].includes(k))&&Object.values(s.weaponBanners).every(b=>b&&Number.isInteger(b.pity)&&b.pity>=0&&b.pity<80))&&
      (s.weaponPulls===undefined||Number.isSafeInteger(s.weaponPulls)&&s.weaponPulls>=0)&&
      (s.weaponHistory===undefined||Array.isArray(s.weaponHistory)&&s.weaponHistory.length<=30&&s.weaponHistory.every(r=>r&&Object.hasOwn(GEAR_BY_ID,r.item)&&Object.hasOwn(WEAPON_BANNERS,r.banner)&&typeof r.fresh==="boolean"));
  }
  function recruitWeapons(s,count,rng,banner,now) {
    fail(count===1||count===10,"1회 또는 10회 뽑기를 선택하세요.");
    fail(typeof banner==="string"&&weaponAvailable(banner,now),"이 무기 픽업은 종료되었거나 존재하지 않습니다.");
    const cost=WEAPON_COST[count];fail(s.gems>=cost,"보석이 부족합니다.");
    const b=WEAPON_BANNERS[banner],progress=weaponBannerState(s,banner),inventory=clone(s.equipment?.inventory||{}),results=[];let premium=false;
    for(let i=0;i<count;i++){
      const odds=weaponRates(progress.pity),roll=rng();
      let rarity=roll<odds.EX?"EX":roll<Math.round((odds.EX+odds.SR)*1e9)/1e9?"SR":"R";
      if(count===10&&i===9&&!premium&&rarity==="R")rarity="SR";
      if(rarity!=="R")premium=true;
      const item=rarity==="EX"?b.item:rarity==="SR"?"rift_baton":"chalk_star",previous=inventory[item];
      fail(!previous||previous.count<GEAR_MAX_COUNT,"장비 보유 한도에 도달했습니다. 각성 후 다시 시도하세요.");
      inventory[item]={count:(previous?.count||0)+1,stars:previous?.stars||0};
      results.push({item,banner,fresh:!previous,pity:progress.pity===79,chance:odds.EX,stars:previous?.stars||0});
      progress.pity=rarity==="EX"?0:progress.pity+1;
    }
    fail(Number.isSafeInteger((s.weaponPulls||0)+count),"뽑기 기록 한도에 도달했습니다.");
    s.equipment??=newEquipment();s.equipment.inventory=inventory;
    s.weaponBanners={standard:{pity:s.weaponBanners?.standard?.pity||0},limited:{pity:s.weaponBanners?.limited?.pity||0},[b.group]:progress};
    s.gems-=cost;s.weaponPulls=(s.weaponPulls||0)+count;s.weaponHistory=results.concat(s.weaponHistory||[]).slice(0,30);
    event(s,"weapon-recruit",{count,banner,exclusive:results.some(r=>GEAR_BY_ID[r.item].owner)});
    log(s,`${BY_ID[banner].name} 전용 무기 · ${count}회 뽑기`);
    return {kind:"weapon-recruit",results,cost,banner};
  }
  function equipmentInfo(s, hero) {
    const gear = s.equipment || newEquipment(), locked = !!s.activities?.run && !s.activities.run.settled;
    return { locked, loadout: { ...(gear.equipped[hero] || {}) }, items: GEAR.map(def => {
      const item = gear.inventory[def.id], count = item?.count || 0, stars = item?.stars || 0;
      const wearers = Object.entries(gear.equipped).filter(([, loadout]) => loadout[def.slot] === def.id).map(([id]) => id);
      const free = count - wearers.length, materials = Math.max(0, count - Math.max(1, wearers.length)), awakenCost = stars < 5 ? GEAR_AWAKEN_COST[stars] : null;
      return { ...def, count, stars, wearers, free, materials, awakenCost, canAwaken: !locked && count > 0 && awakenCost !== null && materials >= awakenCost };
    }) };
  }
  function snapshotEquipment(s, team = s.team) {
    const result = newEquipment(), gear = s.equipment;
    if (!gear) return result;
    for (const hero of team) for (const slot of GEAR_SLOTS) {
      const id = gear.equipped[hero]?.[slot]; if (!id || !gear.inventory[id]) continue;
      (result.equipped[hero] ||= {})[slot] = id;
      if (!result.inventory[id]) result.inventory[id] = { count: 0, stars: gear.inventory[id].stars };
      result.inventory[id].count++;
    }
    return result;
  }
  function equipmentDropInfo(kind, value = 1) {
    let values, count = 0;
    if (kind === "daily" || kind === "weekly") { values = GEAR_DROP_RATES[kind][clamp(Math.floor(value), 1, 5) - 1]; count = kind === "daily" ? 1 : 2; }
    else if (kind === "tower") { values = value <= 20 ? [80,18,2] : value <= 50 ? [68,27,5] : value <= 100 ? [60,33,7] : [55,35,10]; count = Number.isInteger(value) && value >= 1 && value % 5 === 0 ? 1 : 0; }
    else values = [0,0,0];
    return { count, rates: { R: values[0] / 100, SR: values[1] / 100, SSR: values[2] / 100 } };
  }
  function awardEquipment(s, run, firstClear) {
    if (run.kind === "tower" && !firstClear) return { gearDrops: [] };
    const info = equipmentDropInfo(run.kind, run.kind === "tower" ? run.floor : run.tier);
    if (!info.count) return { gearDrops: [] };
    const context = gearContexts.get(s);
    if (context?.preview) return { gearDrops: [], gearPending: true };
    const rng = context?.gearRng || (() => random(s));
    const roll = () => { const value = rng(); fail(Number.isFinite(value) && value >= 0 && value < 1, "장비 추첨 정보를 확인하세요."); return value; };
    const ids = Array.from({ length: info.count }, () => {
      const value = roll(), rarity = value < info.rates.R ? "R" : value < info.rates.R + info.rates.SR ? "SR" : "SSR";
      const pool = GEAR.filter(item => item.rarity === rarity); return pool[Math.floor(roll() * pool.length)].id;
    });
    const gear = s.equipment ||= newEquipment(), gearDrops = [];
    for (const item of ids) {
      const previous = gear.inventory[item], duplicate = !!previous, stars = previous?.stars || 0, overflow = previous?.count === GEAR_MAX_COUNT;
      if (!overflow) { if (previous) previous.count++; else gear.inventory[item] = { count: 1, stars: 0 }; }
      gearDrops.push({ item, count: overflow ? 0 : 1, duplicate, stars, ...(overflow ? { overflow: true } : {}) });
    }
    return { gearDrops };
  }
  const PRESET_NAMES = Object.freeze(["모험", "보스", "아레나"]);
  function normalizePresetName(raw) {
    if (typeof raw !== "string" || raw.length > 128 || /[\p{C}<>]/u.test(raw)) return null;
    const name = raw.normalize("NFC").trim().replace(/\p{Zs}+/gu, " ");
    return Array.from(name).length >= 1 && Array.from(name).length <= 12 && /^[\p{L}\p{N} _-]+$/u.test(name) ? name : null;
  }
  function newPresets() { return PRESET_NAMES.map(name => ({ name, team: [] })); }
  function ownedTeam(s, team, empty = false) {
    return Array.isArray(team) && team.length >= (empty ? 0 : 1) && team.length <= MAX_TEAM && new Set(team).size === team.length && team.every(id => typeof id === "string" && Object.hasOwn(BY_ID, id) && Object.hasOwn(s.units, id));
  }
  function validPresets(s) {
    return s.presets === undefined || Array.isArray(s.presets) && s.presets.length === PRESET_NAMES.length && s.presets.every(p => p && typeof p.name === "string" && normalizePresetName(p.name) === p.name && ownedTeam(s, p.team, true));
  }
  function presetInfo(s) {
    return (s.presets || newPresets()).map((p, slot) => ({ slot, name: p.name, team: [...p.team], saved: p.team.length > 0, active: p.team.length > 0 && p.team.length === s.team.length && p.team.every((id, i) => id === s.team[i]) }));
  }
  function commanderNameInfo(s) {
    const changes = s.nameChanges ?? (s.commanderName && s.commanderName !== "새내기 단장" ? 1 : 0);
    const tickets = s.nameChangeTickets || 0, usesTicket = changes > 0 && tickets > 0;
    return { changes, tickets, usesTicket, cost: changes > 0 && !usesTicket ? 3000 : 0 };
  }
  function partySynergies(s) {
    const counts = { tank: 0, damage: 0, healer: 0 };
    for (const id of new Set(s.team || [])) {
      const role = BY_ID[id]?.role;
      if (role === "수호") counts.tank++;
      if (["전사", "사수", "마법"].includes(role)) counts.damage++;
      if (role === "치유") counts.healer++;
    }
    return { counts, active: PARTY_SYNERGIES.filter(def => counts[def.id] >= def.required).map(def => ({ ...def, count: counts[def.id] })),
      damageMultiplier: counts.damage >= 3 ? 1.15 : 1, healMultiplier: counts.healer >= 3 ? 1.2 : 1, incomingMultiplier: counts.tank >= 3 ? .85 : 1 };
  }
  function winterDay(now) { return { day: day(now), exchanges: { gold: 0, gems: 0 } }; }
  function newWinter(now) { return { id: WINTER_EVENT.id, snowflakes: 0, earned: 0, exchanges: { gold: 0, gems: 0 }, ...(Number.isFinite(now) ? { daily: winterDay(now) } : {}) }; }
  function validWinter(w) {
    const counts = (values,daily=false) => values && Object.keys(WINTER_EVENT.shop).every(id => ((id==='horas'||id==='hyeokjin'||id==='spica')&&values[id]===undefined) || Number.isSafeInteger(values[id])&&values[id]>=0&&values[id] <= (id==='spica'?1:daily?WINTER_EVENT.shop[id].limit:Number.MAX_SAFE_INTEGER));
    const optionalCount = value => value===undefined||Number.isSafeInteger(value)&&value>=0;
    return w === undefined || !!(w && w.id === WINTER_EVENT.id && Number.isSafeInteger(w.snowflakes) && w.snowflakes >= 0 && Number.isSafeInteger(w.earned) && w.earned >= w.snowflakes &&
      counts(w.exchanges) && (w.daily === undefined || w.daily && Number.isSafeInteger(w.daily.day) && w.daily.day >= 0 && counts(w.daily.exchanges,true)) &&
      optionalCount(w.snowmen)&&optionalCount(w.snowmenEarned)&&optionalCount(w.spins)&&Number.isSafeInteger((w.snowmen||0)+(w.spins||0))&&(w.snowmenEarned||0)>=(w.snowmen||0)+(w.spins||0)&&
      (w.spicaClaimed===undefined||typeof w.spicaClaimed==='boolean'));
  }
  function refreshWinter(s, now) {
    const w = s.winter ||= newWinter(now);
    // Keep lifetime exchanges for old saves. The daily allowance starts at zero
    // once, without reclaiming any previously earned currency or snowflakes.
    if (!w.daily || day(now) > w.daily.day) w.daily = winterDay(now);
    return w;
  }
  function winterInfo(s, now = Date.now()) {
    const at = Number.isFinite(now) && now >= 0 ? Math.max(s.at, now) : s.at;
    const w = s.winter || newWinter(at), currentDay = Math.max(w.daily?.day ?? day(at), day(at));
    const daily = w.daily?.day === currentDay ? w.daily : winterDay(at);
    const active = at >= WINTER_EVENT.startsAt && (WINTER_EVENT.endsAt === null || at < WINTER_EVENT.endsAt);
    const spicaOwned=!!s.units.spica||!!w.spicaClaimed;
    return { id: WINTER_EVENT.id, name: WINTER_EVENT.name, active, snowflakes: w.snowflakes, earned: w.earned, snowmen:w.snowmen||0,snowmenEarned:w.snowmenEarned||0,spins:w.spins||0,spicaOwned,roulette:WINTER_ROULETTE, day: currentDay, resetsAt: (currentDay + 1) * 86400000 - 9 * 3600000,
      items: Object.entries(WINTER_EVENT.shop).filter(([id])=>id!==(at<BANNERS.horas.expiresAt?'hyeokjin':'horas')).map(([id, item]) => {const bought=item.lifetime?(spicaOwned?1:w.exchanges[id]||0):daily.exchanges[id]||0;return {id,...item,bought,totalBought:w.exchanges[id]||0,remaining:Math.max(0,item.limit-bought),canBuy:active&&bought<item.limit&&w.snowflakes>=item.cost};}) };
  }
  function winterSpin(s,now,rng) {
    fail(Number.isFinite(now)&&now>=0,'잘못된 시간입니다.');
    const info=winterInfo(s,now);fail(info.active,'겨울 이벤트 기간이 아닙니다.');fail(info.snowmen>=1,'눈사람이 부족합니다. 예티 토벌로 모아 주세요.');
    // Check every possible prize before sampling. A full inventory cannot be
    // used to reject equipment outcomes repeatedly until gems are selected.
    const normalGear=GEAR.filter(item=>!item.owner&&['R','SR','SSR'].includes(item.rarity));
    fail(Number.isSafeInteger(s.gold+7800)&&Number.isSafeInteger(s.gems+10000)&&Number.isSafeInteger(info.spins+1),'보유 재화 한도를 확인하세요.');
    fail(normalGear.every(item=>(s.equipment?.inventory?.[item.id]?.count||0)<GEAR_MAX_COUNT),'장비 보유 한도에 도달했습니다. 각성 후 다시 돌려주세요.');
    const roll=()=>{const r=rng();fail(Number.isFinite(r)&&r>=0&&r<1,'추첨 정보를 확인하세요.');return r;};
    const value=Math.floor(roll()*10000),index=value<10?0:value<110?1:value<1000?2:value<4500?3:4,slot=WINTER_ROULETTE[index];let reward;
    if(slot.type==='equipment'){
      const gradeRoll=Math.floor(roll()*100),rarity=gradeRoll<70?'R':gradeRoll<95?'SR':'SSR',pool=normalGear.filter(item=>item.rarity===rarity),item=pool[Math.floor(roll()*pool.length)].id;
      reward={type:'equipment',amount:1,item,rarity};
    }else reward={type:slot.type,amount:slot.type==='gold'?2600+Math.floor(roll()*5201):slot.amount};
    const w=refreshWinter(s,Math.max(s.at,now));w.snowmen=(w.snowmen||0)-1;w.spins=(w.spins||0)+1;
    if(reward.type==='equipment'){s.equipment ||= newEquipment();const old=s.equipment.inventory[reward.item];s.equipment.inventory[reward.item]={count:(old?.count||0)+1,stars:old?.stars||0};}
    else s[reward.type==='gold'?'gold':'gems']+=reward.amount;
    event(s,'winter-spin',{index,reward});return {kind:'winter-spin',reward,index,snowmenRemaining:w.snowmen};
  }

  function winterDrop(s) {
    if (!s.battle.activity && !campaignRewardInfo(s).eligible) return 0;
    if (!winterInfo(s, s.at).active || random(s) >= WINTER_EVENT.dropChance) return 0;
    const w = s.winter ||= newWinter(), amount = rewardBonus({snowflakes:s.battle.boss ? 2 : 1},s.at).snowflakes;
    if (w.earned > Number.MAX_SAFE_INTEGER - amount) return 0;
    w.snowflakes += amount; w.earned += amount;
    event(s, "snowflake", { amount, total: w.snowflakes });
    return amount;
  }
  function damageReport(s) {
    const b = s.battle, elapsedMs = b.elapsed || 0;
    const rows = b.heroes.map(hero => {
      const record = b.damage?.[hero.id] || {};
      const row = { id: hero.id, damage: record.damage || 0, healing: record.healing || 0, taken: record.taken || 0, absorbed: record.absorbed || 0, criticals: record.criticals || 0 };
      return { ...row, dps: Math.round(row.damage / Math.max(1, elapsedMs / 1000)) };
    });
    return { battleId: b.id, elapsedMs, rows, stage:b.stage, wave:b.wave, boss:!!b.boss, activity:b.activity?clone(b.activity):null, phase:b.phase,
      timeline:clone(b.timeline||[]), fallen:clone(b.reportFallen||[]), enemies:b.enemies.map(e=>({name:e.name,physicalReduction:e.physicalReduction||0,magicReduction:e.magicReduction||0})),
      totals: rows.reduce((sum, row) => { for (const key of ["damage", "healing", "taken", "absorbed", "criticals"]) sum[key] += row[key]; return sum; }, { damage: 0, healing: 0, taken: 0, absorbed: 0, criticals: 0 }) };
  }
  function meter(s, id, key, amount) {
    if (!Object.hasOwn(BY_ID, id) || !Number.isFinite(amount) || amount <= 0) return;
    const records = s.battle.damage ||= {}, record = records[id] ||= { damage: 0, healing: 0, taken: 0, absorbed: 0, criticals: 0 };
    record[key] = (record[key] || 0) + amount;
  }
  function activityReward(kind, value, now = 0) {
    const reward = kind === "tower" ? { gold: earnedGold(100 + 5 * value), gems: 10 + Math.floor(value / 5), xp: 0 }
      : kind === "daily" ? { gold: earnedGold(2000 + 1500 * (value - 1)), gems: 80 + 30 * (value - 1), xp: scaledXp(200 + 100 * (value - 1), PROGRESSION.dungeonXp) }
      : { gold: earnedGold(12000 + 6000 * (value - 1)), gems: 600 + 200 * (value - 1), xp: scaledXp(1000 + 400 * (value - 1), PROGRESSION.dungeonXp) };
    return rewardBonus(reward,now);
  }
  function newActivities(now) {
    return { daily: { period: day(now), used: 0 }, weekly: { period: week(now), used: 0 }, towerBest: 0, run: null, lastResult: null };
  }
  const KEY_RESET_AT=Date.parse('2026-11-21T00:00:00+09:00');
  function refreshActivities(s, now) {
    s.activities ??= newActivities(now);
    if(now>=KEY_RESET_AT&&!s.activities.santaKeyReset){s.activities.weekly={period:week(now),used:0};s.activities.santaKeyReset=true;}
    for (const kind of ["daily", "weekly"]) {
      const period = kind === "daily" ? day(now) : week(now);
      if (period > s.activities[kind].period) s.activities[kind] = { period, used: 0 };
    }
    return s.activities;
  }
  // Pure UI projection: opening a panel does not replenish or spend a key.
  function activityInfo(s, now = Date.now()) {
    const at = Number.isFinite(now) && now >= 0 ? now : s.at, saved = s.activities || newActivities(at), result = {};
    for (const kind of ["daily", "weekly"]) {
      const def = DUNGEONS[kind], current = kind === "daily" ? day(at) : week(at);
      const period = Math.max(current, saved[kind].period), used = kind==='weekly'&&at>=KEY_RESET_AT&&!saved.santaKeyReset?0:period === saved[kind].period ? saved[kind].used : 0;
      result[kind] = { id: kind, name: def.name, keys: def.cap - used, cap: def.cap, period,
        resetAt: (kind === "daily" ? period + 1 : (period + 1) * 7 - 3) * 86400000 - 9 * 3600000,
        tiers: def.unlocks.map((best, i) => ({ tier: i + 1, unlocked: s.best >= best, requiredBest: best, unlockBest: best, stage: def.stages[i], reward: activityReward(kind, i + 1, at) })) };
    }
    const nextFloor = Math.min(MAX_TOWER_FLOOR, saved.towerBest + 1);
    result.tower = { id: "tower", name: DUNGEONS.tower.name, best: saved.towerBest, nextFloor, reward: activityReward("tower", nextFloor, at), maxFloor: MAX_TOWER_FLOOR };
    result.run = saved.run ? clone(saved.run) : null; result.result = saved.lastResult ? clone(saved.lastResult) : null;
    return result;
  }
  function validActivities(a) {
    if (a === undefined) return true;
    if (!a || typeof a !== "object" || Array.isArray(a)) return false;
    if(a.santaKeyReset!==undefined&&typeof a.santaKeyReset!=="boolean")return false;
    for (const kind of ["daily", "weekly"]) if (!a[kind] || !Number.isSafeInteger(a[kind].period) || !Number.isInteger(a[kind].used) || a[kind].used < 0 || a[kind].used > DUNGEONS[kind].cap) return false;
    if (!Number.isInteger(a.towerBest) || a.towerBest < 0 || a.towerBest > MAX_TOWER_FLOOR) return false;
    function validRun(r) {
      return r && Number.isSafeInteger(r.id) && r.id > 0 && Object.hasOwn(DUNGEONS, r.kind) && typeof r.settled === "boolean" &&
        (r.kind === "tower" ? Number.isInteger(r.floor) && r.floor >= 1 && r.floor <= MAX_TOWER_FLOOR
          : Number.isInteger(r.tier) && r.tier >= 1 && r.tier <= 5 && Number.isSafeInteger(r.period));
    }
    if (a.run !== null && !validRun(a.run)) return false;
    const r = a.lastResult;
    const validDrops = drops => drops === undefined || Array.isArray(drops) && drops.length <= 2 && drops.every(d => d && typeof d.item === "string" && Object.hasOwn(GEAR_BY_ID, d.item) && [0,1].includes(d.count) && typeof d.duplicate === "boolean" && Number.isInteger(d.stars) && d.stars >= 0 && d.stars <= 5 && (d.count === 0 ? d.overflow === true : d.overflow === undefined));
    return r === null || !!(r && validDrops(r.gearDrops) && (r.gearPending === undefined || r.gearPending === true && r.gearDrops?.length === 0) && Number.isSafeInteger(r.runId) && r.runId > 0 && Object.hasOwn(DUNGEONS, r.kind) && typeof r.won === "boolean" && typeof r.firstClear === "boolean" && typeof r.refunded === "boolean" && typeof r.reason === "string" && r.reward && ["gold", "gems", "xp"].every(k => Number.isFinite(r.reward[k]) && r.reward[k] >= 0));
  }
  const needXp = level => (20 + level * 12 + Math.floor(level * level * 1.5)) * PROGRESSION.unitRequirement;
  const captainNeed = level => 20 + level * 10 + level * level * 5;
  const levelCap = unit => 100 + 5 * Math.max(0,Math.min(5,unit?.stars||0));
  const trainingCost = unit => unit.level>=100?44000+(unit.level-100)*3000:50+unit.level*16+unit.level*unit.level*2;
  function trainingQuote(unit,count=1){const levels=Math.max(0,Math.min(count,levelCap(unit)-unit.level));let cost=0;for(let i=0;i<levels;i++)cost+=trainingCost({...unit,level:unit.level+i});return {levels,cost,from:unit.level,to:unit.level+levels,cap:levelCap(unit)};}
  const awakeningCost = unit => 10 + unit.stars * 10;
  function stats(id, unit, state) {
    const h = BY_ID[id], factor = 1 + unit.stars * .15, gear = equipmentBonus(state, id),exclusive=exclusivePassive(state,id);
    const divine=exclusive?.id==='osia_scepter'&&id==='osia';
    return { hp: Math.round((h.hp + (unit.level - 1) * (h.hpGrowth || 14)) * factor * (1 + gear.hp)*(divine?1+exclusive.vitality:1)), atk: Math.round((h.atk + (unit.level - 1) * (h.atkGrowth || 3)) * factor * (1 + gear.atk)*(divine?1+exclusive.attack:1)), defense: h.role === "수호" ? .28 : .05, critChance: CRITICAL.chance, critMultiplier: CRITICAL.multiplier };
  }
  function stageName(stage) { const hard=stage>NORMAL_MAX_STAGE,n=hard?stage-NORMAL_MAX_STAGE:stage;return `${hard?"하드 ":""}${Math.floor((n-1)/5)+1}-${(n-1)%5+1}`; }
  function chapter(stage) { return clamp(Math.floor((stage - 1) / 5), 0, CHAPTERS.length - 1); }
  function event(s, kind, data = {}) {
    const e = { seq: ++s.seq, kind, at: s.at, simAt: s.simTime || 0, battleId: s.battle?.id, ...data };
    if(s.battle){
      const entries=s.battle.timeline||=[];
      if(['skill-impact','ryusion-taunt','rescue','boss-skill','monster-skill','horas-impact','spica-skill'].includes(kind)){
        entries.push({ms:s.battle.elapsed||0,kind,from:data.from||'',name:data.name|| (kind==='ryusion-taunt'?'내가 대신 맞아줄게':kind==='rescue'?'긴급생존':kind==='horas-impact'?'벚꽃의식':'기술 사용')});
      }
      if(kind==='hit'&&data.side==='hero'&&data.hpBefore>0&&data.hpAfter<=0){const fall={ms:s.battle.elapsed||0,kind:'fallen',from:data.to,name:BY_ID[data.to]?.name||'용병'};entries.push(fall);s.battle.reportFallen||=[];if(!s.battle.reportFallen.some(f=>f.from===data.to))s.battle.reportFallen.push(fall);}
      if(entries.length>32)entries.splice(0,entries.length-32);
    }
    s.events.push(e); if (s.events.length > 50) s.events.splice(0, s.events.length - 50);
    return e;
  }
  function log(s, text) { s.logs.unshift(text); s.logs.length = Math.min(s.logs.length, 14); }
  function addUnitXp(s, id, amount) {
    const u = s.units[id]; if (!u || u.level >= levelCap(u)) return;
    u.xp += amount;
    const before = u.level;
    while (u.level < levelCap(u) && u.xp >= needXp(u.level)) { u.xp -= needXp(u.level); u.level++; }
    if (u.level === levelCap(u)) u.xp = 0;
    if (u.level > before) { event(s, "level", { id, level: u.level }); log(s, `${BY_ID[id].name} Lv.${u.level}!`); }
  }
  function captainXp(s, amount) {
    s.captain.xp += amount;
    while (s.captain.level < CAPTAIN_MAX_LEVEL && s.captain.xp >= captainNeed(s.captain.level)) {
      s.captain.xp -= captainNeed(s.captain.level); s.captain.level++;
      const reward = captainReward(s.captain.level,s.at); s.gems += reward.gems; s.gold += reward.gold;
      event(s, "captain", { level: s.captain.level, ...reward }); log(s, `단장 Lv.${s.captain.level} · 보석 +${reward.gems} · 골드 +${reward.gold}`);
    }
    if (s.captain.level === CAPTAIN_MAX_LEVEL) s.captain.xp = 0;
  }
  function baseRates(s) { return { gold: earnedGold(20 + s.best * 7), xp: scaledXp(8 + s.best * 2, PROGRESSION.offlineXp) }; }
  function rates(s, now = s.at ?? Date.now()) { return rewardBonus(baseRates(s),now); }
  function campaignRewardInfo(s, stage = s.battle?.stage ?? s.stage, boss = !!s.battle?.boss) {
    const best = s.best, gap = Math.max(0, best - stage), eligible = gap <= CAMPAIGN_REWARDS.safeGap;
    const multiplier = eligible ? 1 : Math.max(CAMPAIGN_REWARDS.minimum, Math.pow(CAMPAIGN_REWARDS.decay, gap - CAMPAIGN_REWARDS.safeGap));
    const baseGold = (12 + 4 * stage) * (boss ? 3 : 1), stageBonus = 1 + Math.max(0, stage - CAMPAIGN_REWARDS.bonusStart) * CAMPAIGN_REWARDS.bonusPerStage;
    // Keep the first ten stages and nearby farming intact. Lower stages retain
    // token gold, but no minimum XP that could bypass the captain reward curve.
    return rewardBonus({ stage, best, gap, eligible, multiplier, baseGold, stageBonus, gold: earnedGold(Math.max(1, Math.floor(baseGold * stageBonus * multiplier))),
      xp: Math.floor(scaledXp((8 + stage * 2) * (boss ? 2 : 1), PROGRESSION.battleXp) * multiplier),
      captainXp: Math.floor(scaledXp(4 + Math.floor(stage / 2), PROGRESSION.captainBattleXp) * multiplier) },s.at);
  }
  function campaignScale(stage) {
    if(stage>70){const base=campaignScale(70),hard=stage>NORMAL_MAX_STAGE,d=stage-(hard?100:70);return {hp:base.hp*(hard?4.4+.062*d:1.10+.11*d),atk:base.atk*(hard?1.42+.0035*d:1.06+.012*d)};}
    const late = Math.max(0, stage - 30) / 30, middle = Math.max(0, Math.min(20, stage - 10)) / 20;
    return { hp: Math.pow(1.18, Math.min(29, stage - 1)) * Math.pow(1.055, Math.max(0, stage - 30)) * (1 + middle * .25 + late * (BOSS_RULES.storyHp - 1.25)),
      atk: Math.pow(1.14, Math.min(29, stage - 1)) * Math.pow(1.015, Math.max(0, stage - 30)) * (1 + late * (BOSS_RULES.storyAttack - 1)) };
  }
  // Appearance is an account entitlement, never a source of combat stats.
  const SKINS = Object.freeze({horas_after_school:Object.freeze({id:'horas_after_school',hero:'horas',name:'방과 후의 성좌',receipt:'HORAS_AFTER_SCHOOL_SKIN'})});
  function ownsSkin(s,id){return !!SKINS[id] && (s.redeemedCodes||[]).includes(SKINS[id].receipt);}
  function equippedSkin(s,hero){const id=s.skins?.[hero];return s.units?.[hero]&&SKINS[id]?.hero===hero&&ownsSkin(s,id)?id:null;}
  function validSkins(s){return s.skins===undefined||!!s.skins&&typeof s.skins==='object'&&!Array.isArray(s.skins)&&Object.entries(s.skins).every(([hero,id])=>typeof id==='string'&&!!s.units?.[hero]&&SKINS[id]?.hero===hero&&ownsSkin(s,id));}
  function snapshotSkins(s,team=s.team){const skins=Object.fromEntries(team.map(id=>[id,equippedSkin(s,id)]).filter(([,v])=>v));return {skins,redeemedCodes:Object.values(skins).map(id=>SKINS[id].receipt)};}
  function freshHeroes(s, previousOsia) {
    const synergy = partySynergies(s);
    const heroes = s.team.map(id => { const st = stats(id, s.units[id], s); return { id, ...(equippedSkin(s,id)?{skin:equippedSkin(s,id)}:{}), hp: st.hp, max: st.hp, atk: st.atk, defense: 1 - (1 - st.defense) * synergy.incomingMultiplier, damageMultiplier: synergy.damageMultiplier, healMultiplier: synergy.healMultiplier, critChance: st.critChance, critMultiplier: st.critMultiplier, energy: id === "osia" && previousOsia ? previousOsia.energy : 0, shield: 0, ...(exclusivePassive(s,id)?{exclusive:exclusivePassive(s,id)}:{}) }; });
    heroes.forEach(u=>hyeokjinInit(u,heroes));return heroes;
  }
  function monsterAbility(enemy, stage) {
    if (enemy.boss || stage < 11) return enemy;
    const roles = ["melee", "ranged", "healer"], role = roles[enemy.variant || 0];
    enemy.combatRole = role;
    enemy.monsterSkill = role === "melee" ? "결계 돌진" : role === "ranged" ? "마력 탄환" : "회복의 종";
    // Introduce charge and ranged skills in chapter 3; support casters join in 4.
    if (role === "healer" && stage < 16) return enemy;
    enemy.skillEvery = role === "healer" ? 8000 : 6000;
    enemy.nextSkillAt = enemy.skillEvery + (enemy.variant || 0) * 1000;
    enemy.skillPower = 1 + Math.min(1, Math.max(0, stage - 11) / 49) * .3;
    return enemy;
  }
  function chapterMechanic(enemy,stage){
    if(stage<61)return enemy;const zone=chapter(stage),v=enemy.variant||0;enemy.campaignTrait=zone;
    if(enemy.boss){
      enemy.ability=['물감 파동','성좌 낙하','멈춘 시간의 종','심해의 압력','장미의 낙인','수정 공명','침묵의 선고','졸업의 종'][zone-12]||'침식된 결계 붕괴';enemy.aoeEvery=8000+Math.min(2,zone-12)*1000;enemy.nextAbilityAt=enemy.aoeEvery;enemy.aoeMultiplier=1.45;enemy.rageStep=.06;enemy.rageCap=1.36;
      return enemy;
    }
    enemy.skillEvery=v===2?10000:8000;enemy.nextSkillAt=enemy.skillEvery+v*1000;enemy.skillPower=1.2;enemy.telegraphMs=1500;
    if(zone===12){enemy.monsterSkill=['석고 돌진','거울 탄환','색채 복원'][v];if(v===0)enemy.physicalReduction=.35;if(v===1)enemy.magicReduction=.35;}
    if(zone===13){enemy.monsterSkill=['성좌 돌격','역전 별빛','성도의 장막'][v];if(v===2)enemy.supportShield=.08;}
    if(zone===14){enemy.monsterSkill=['태엽 강타','진자의 궤적','종소리 복원'][v];if(v===0){enemy.rageEvery=10000;enemy.rageStep=.06;enemy.rageCap=1.36;}}
    if(zone>=15){
      enemy.monsterSkill=[['심해 돌진','해파리 탄환','산호 복원'],['가시 강타','씨앗 추격','장미 장막'],['수정 베기','거울 조준','유리 공명'],['서약의 일격','후열 선고','봉인 복원'],['공허 강타','별의 추방','균열 장막']][Math.min(zone-15,4)][v];
      if((zone===15||zone===17)&&v===0)enemy.physicalReduction=.25;
      if((zone===16&&v===0)||(zone===17&&v===1))enemy.magicReduction=.25;
      if(zone===18&&v===0){enemy.rageEvery=10000;enemy.rageStep=.05;enemy.rageCap=1.3;}
      if(zone>=19&&v===0){enemy.physicalReduction=.15;enemy.magicReduction=.15;}
      if((zone===16||zone>=19)&&v===2)enemy.supportShield=.06;
    }
    return enemy;
  }
  function bossAbility(enemy, strength = 1, name = "결계 붕괴") {
    Object.assign(enemy, { ability: name, aoeEvery: BOSS_RULES.aoeEvery, aoeMultiplier: BOSS_RULES.aoeMultiplier * strength,
      nextAbilityAt: BOSS_RULES.aoeEvery, rageEvery: BOSS_RULES.rageEvery, rageStep: BOSS_RULES.rageStep, warnedFor: 0 });
    return enemy;
  }
  function spawn(s, carry = false) {
    if (s.counter) delete s.counter.opportunity;
    const boss = s.wave === 4, zone = chapter(s.stage);
    // Existing in-progress battles keep their saved stats. New late-game waves
    // accommodate six units, while the first ten areas retain their old curve.
    const scale = campaignScale(s.stage);
    const previousYaho = carry && s.battle?.phase === 'victory' && s.battle.stage === s.stage && !s.battle.boss ? s.battle.heroes.find(h=>h.id==='yaho')?.yaho : null;
    const previousHoras = carry && s.battle?.phase === "victory" && s.battle.heroes.some(h => h.id === "horas" && h.hp > 0) ? s.battle.horas : null;
    const previousOsia = carry && s.battle?.phase === "victory" && s.battle.heroes.find(h => h.id === "osia" && h.hp > 0);
    s.battle = { id: s.seq + 1, stage: s.stage, wave: s.wave, boss, phase: "fight", wait: 0, tick: 0, elapsed: 0, buff: 0, lavaRescueUsed: false, damage: {}, synergies: partySynergies(s),
      heroes: freshHeroes(s, previousOsia),
      enemies: Array.from({ length: boss ? 1 : 3 }, (_, i) => {
        const variant = (s.stage + s.wave - 2 + i) % 3;
        const e = { id: `e${i}`, kind: zone, name: boss ? BOSSES[zone] : ENEMY_VARIANTS[zone][variant], ...(boss ? {} : { variant }), hp: Math.round((boss ? 155 : 30) * scale.hp), max: Math.round((boss ? 155 : 30) * scale.hp), atk: Math.round((boss ? 10 : 3) * scale.atk), boss };
        return chapterMechanic(boss && s.stage > 30 ? bossAbility(e, .65 + (s.stage - 30) / 30 * .35) : monsterAbility(e, s.stage),s.stage);
      }),
    };
    if(previousYaho){const yaho=s.battle.heroes.find(h=>h.id==='yaho');if(yaho)yaho.yaho={...previousYaho};}
    if (s.team.includes("horas")) s.battle.horas = newHoras(previousHoras?.stacks || 0);
    event(s, "wave", { stage: s.stage, wave: s.wave, boss });
  }
  const TOWER_THEMES=Object.freeze([
    Object.freeze({id:'armory',name:'철갑 교실',boss:'철갑 교관',trait:'물리 피해 35% 감소',tip:'마법·치유 계열 공격 추천',physicalReduction:.35,magicReduction:0,enemyKind:4,skill:'철갑 내려찍기'}),
    Object.freeze({id:'library',name:'금서 서고',boss:'금서의 사서',trait:'마법 피해 35% 감소',tip:'전사·사수 계열 공격 추천',physicalReduction:0,magicReduction:.35,enemyKind:1,skill:'금서 폭주'}),
    Object.freeze({id:'garden',name:'뒤틀린 온실',boss:'가시 심장',trait:'6초마다 최대 HP 2% 회복',tip:'회복 전에 집중 공격 · 기절로 회복 지연',physicalReduction:0,magicReduction:0,enemyKind:3,skill:'가시 덩굴'}),
    Object.freeze({id:'clock',name:'멈춘 시계실',boss:'태엽 감시자',trait:'10초마다 공격력 8% 증가',tip:'시간이 지날수록 위험 · 빠른 처치 추천',physicalReduction:0,magicReduction:0,enemyKind:2,skill:'시간 파열'}),
    Object.freeze({id:'astral',name:'균열 천문대',boss:'균열의 핵',trait:'모든 피해 15% 감소 · 보스는 7초마다 광역 공격',tip:'보호막·전체 회복으로 광역 공격 대비',physicalReduction:.15,magicReduction:.15,enemyKind:5,skill:'별의 붕괴'})
  ]);
  function towerEncounter(floor){const n=Math.max(1,Math.min(MAX_TOWER_FLOOR,Math.floor(Number(floor)||1)));const theme=TOWER_THEMES[Math.floor((n-1)/5)%TOWER_THEMES.length];return {...theme,floor:n,bossFloor:n%5===0,sectionStart:Math.floor((n-1)/5)*5+1,sectionEnd:Math.ceil(n/5)*5};}
  function damageType(id){return ['마법','치유'].includes(BY_ID[id]?.role)||['horas','spica'].includes(id)?'magic':'physical';}
  function spawnActivity(s) {
    if (s.counter) delete s.counter.opportunity;
    const run = s.activities.run, tower = run.kind === "tower", stage = tower ? Math.min(60, Math.ceil(run.floor / 5)) : DUNGEONS[run.kind].stages[run.tier - 1];
    const boss = !tower || run.floor % 5 === 0, scale = campaignScale(stage), weekly = run.kind === "weekly";
    const difficulty = weekly ? 1.25 : 1.05, hp = tower ? (80 + 20 * run.floor + 2 * run.floor * run.floor) * (boss ? 3.2 : 1) : 155 * scale.hp * difficulty;
    const atk = tower ? (5 + .9 * run.floor + .012 * run.floor * run.floor) * (boss ? 1.1 : 1) : 10 * scale.atk;
    const theme=tower?towerEncounter(run.floor):null;
    const activity = { kind: run.kind, ...(tower ? { floor: run.floor,theme:theme.id } : { tier: run.tier }) };
    s.battle = { id: run.id, runId: run.id, stage, wave: 4, boss, activity, phase: "fight", wait: 0, tick: 0, elapsed: 0, buff: 0, lavaRescueUsed: false, damage: {}, synergies: partySynergies(s),
      heroes: freshHeroes(s), enemies: Array.from({ length: boss ? 1 : 3 }, (_, i) => {
        const e = { id: `e${i}`, kind: tower?theme.enemyKind:chapter(stage), name: tower ? boss ? theme.boss : `${theme.name}의 잔영` : weekly ? "봉인의 이사장" : "보급고의 수호자", ...(boss ? {} : { variant: (stage + 2 + i) % 3 }), hp: Math.round(hp), max: Math.round(hp), atk: Math.round(atk), boss };
        const enemy=boss && (tower || run.tier >= 3) ? bossAbility(e, 1, tower ? theme.skill : weekly ? "봉인 해방" : "보급고 대격돌") : monsterAbility(e, stage);
        if(tower){Object.assign(enemy,{towerTrait:theme.id,physicalReduction:theme.physicalReduction,magicReduction:theme.magicReduction});
          if(theme.id==='garden')Object.assign(enemy,{regenEvery:6000,nextRegenAt:6000,regenRatio:.02});
          if(theme.id==='clock')Object.assign(enemy,{rageEvery:10000,rageStep:.08});
          if(theme.id==='astral'&&boss)Object.assign(enemy,{aoeEvery:7000,nextAbilityAt:7000,aoeMultiplier:1.15});
        }
        return enemy;
      }) };
    if (s.team.includes("horas")) s.battle.horas = newHoras();
  }
  function settleActivity(s, won, reason) {
    const a = refreshActivities(s, s.at), run = a.run;
    if (!run || run.settled) return a.lastResult;
    run.settled = true; if (s.counter) delete s.counter.opportunity;
    let reward = { gold: 0, gems: 0, xp: 0 }, refunded = false;
    const firstClear = won && run.kind === "tower" && run.floor > a.towerBest;
    if (won && (run.kind !== "tower" || firstClear)) reward = activityReward(run.kind, run.kind === "tower" ? run.floor : run.tier, s.at);
    if(won&&(run.kind!=="tower"||firstClear)){bondCombat(s,"waves");if(s.battle.boss)bondCombat(s,"bosses");}
    if (firstClear) a.towerBest = run.floor;
    if (!won && run.kind !== "tower" && a[run.kind].period === run.period && a[run.kind].used > 0) { a[run.kind].used--; refunded = true; }
    s.gold += reward.gold; s.gems += reward.gems;
    if (won && (run.kind !== "tower" || firstClear)) { winterDrop(s); questProgress(s, "waves"); }
    if (reward.xp) for (const id of s.team) addUnitXp(s, id, reward.xp);
    const gearResult = won ? awardEquipment(s, run, firstClear) : { gearDrops: [] };
    a.lastResult = { ...gearResult, runId: run.id, kind: run.kind, ...(run.kind === "tower" ? { floor: run.floor } : { tier: run.tier }), won, reason, firstClear, reward, refunded };
    s.battle.phase = won ? "victory" : "defeat"; s.battle.wait = 0; delete s.battle.osiaCast; delete s.battle.horasCast; delete s.battle.cinematic;
    s.lastCombatReport={...damageReport(s),reason,at:s.at};
    event(s, "activity-result", { ...a.lastResult, kind: "activity-result", activityKind: run.kind }); log(s, `${DUNGEONS[run.kind].name} ${won ? "승리" : reason === "exit" ? "도전 종료" : "패배"}${refunded ? " · 열쇠 반환" : ""}`);
    return a.lastResult;
  }
  function create(now = Date.now(), seed = 123456789) {
    fail(Number.isFinite(now) && now >= 0, "잘못된 시간입니다.");
    const s = { version: 1, at: now, speed: 1, simCredit: 0, simTime: 0, seed: (seed >>> 0) || 123456789, seq: 0, events: [], logs: [],
      profile: {avatar:'leader',title:'',beta:false}, gold: 700, gems: 1800, commanderName: "새내기 단장", nameChanges: 0, nameChangeTickets: 0, winter: newWinter(now), captain: { level: 1, xp: 0 }, units: {}, team: ["taeo", "harin", "sua"], presets: newPresets(), equipment: newEquipment(), weaponBanners:{standard:{pity:0},limited:{pity:0}}, weaponPulls:0, weaponHistory:[],
      onboarding: {version:1,step:0},
      stage: 1, wave: 1, best: 0, mode: "progress", kills: 0, pulls: 0, pity: 0, losses: 0,
      banners: { rudes:{pity:0,guaranteed:false}, yaho:{pity:0,guaranteed:false}, hyeokjin:{pity:0,guaranteed:false}, standard: { pity: 0, reserve:0, guarantees:0, guaranteed:false }, kazua:{pity:0,guaranteed:false}, ryusion:{pity:0,guaranteed:false}, horas:{pity:0,guaranteed:false} },
      offline: { seconds: 0, gold: 0, xp: 0, captainXp: 0 }, claimed: [], codexClaimed: [], daily: -1, receipts: [], history: [], redeemedCodes: [], quests: newQuestState(now), activities: newActivities(now) };
    for (const id of s.team) s.units[id] = { level: 1, xp: 0, stars: 0, shards: 0 };
    log(s, "방과 후, 학교용병단의 모험이 시작됩니다."); spawn(s); return s;
  }

  const BOND_LEVELS = Object.freeze([0,30,90,180,300,420,540,650]);
  const BOND_DAILY_LIMIT = 60;
  const BOND_CHARACTERS = Object.freeze(Object.fromEntries([
    ["rudes", "비가 그치지 않는 탑", "은빛 우산의 마녀", "밤을 접어 너를 지키는 우산", "비가 그칠 때까지 있어도 좋아. 아니, 맑은 날에도 다시 와 줘.", ["탑을 두드린 발소리", "젖지 않는 책갈피", "우산을 접는 용기", "맑은 날의 방문"]],
    ["yaho", "작은 발자국의 약속", "산군의 작은 제자", "작은 포효로 지킨 약속", "오늘은 야호가 데리러 왔어. 혼자 돌아가지 않아도 돼!", ["부채보다 큰 약속", "탑의 낯선 냄새", "작은 손님과 마녀", "함께 돌아가는 길"]],
    ['osia','수면 아래의 기억','기억 속 용왕','파도를 지키는 자','돌아갈 곳을 찾는 동안, 지키고 싶은 곳이 또 생겼어.',['낯선 교실의 파도','가라앉은 왕좌','용왕의 약속','학교에 남은 이유']],
    ['ian','검집에 남은 이름','황혼의 파수꾼','마지막까지 남는 검','오늘 순찰은 함께 돌자. 돌아오는 사람까지 세어야 하니까.',['빈 출석부','금이 간 규율','물러서지 않는 이유','함께 돌아오는 길']],
    ['lumi','달이 비추지 않는 방','달빛의 기록자','어둠의 이름을 부르는 자','무서운 밤이면 불러 줘. 이름을 알면 어둠도 조금 작아지거든.',['닫힌 관측실','지워진 관측자','응답하는 달빛','새벽의 기록']],
    ['lava','바람이 남긴 목소리','귀환의 무당','돌아오는 바람','네 숨소리가 들리면 안심이 돼. 오늘도 무사히 돌아와.',['부러진 부채살','멈추지 않는 제사','살아 있는 이의 부탁','귀환의 바람']],
    ['ryusion','방패 뒤의 자리','대지의 수호자','함께 버티는 방패','내 뒤에만 숨지 않아도 돼. 오늘은 나란히 서자.',['낡은 방패의 흠집','구하지 못한 문','대신 맞는다는 것','나란히 선 사람들']],
    ['kazua','마지막 탄피','귀환의 사수','살아 돌아온 마지막 탄환','마지막 한 발은 남겨 둘게. 끝을 내려고가 아니라, 함께 돌아가려고.',['이름 없는 탄피','혼자 남은 교전','방아쇠에서 뗀 손','귀환 신호']],
    ['spica','녹지 않는 편지','첫봄의 설녀','겨울 끝의 약속','천천히 가도 괜찮아. 이번 봄은 너희와 같이 기다릴게.',['눈 속의 우편함','멈춘 겨울','기다리는 속도','첫봄의 답장']],
    ['horas','떨어지지 않은 별','벚꽃 아래의 별','별의 귀환을 기다리는 자','오늘 밤의 별은 같이 세자. 하나쯤 놓쳐도 다시 찾으면 되니까.',['다섯 개의 빈자리','빗나간 별','의식 밖의 소원','돌아오는 별빛']],
    ['hyeokjin','돌아오는 사람의 이름','새벽에 돌아온 청년','너까지 지켜낸 약속','다녀올게. 이번에 지켜야 할 사람에는 나도 넣어 뒀어.',['웃음 뒤의 빈자리','거울 너머의 목소리','다섯 초 뒤의 약속','내가 지켜갈 모든 것']]
  ].map(([id,name,avatarName,titleName,quote,titles])=>[id,Object.freeze({id,name,avatar:id+'-memory',title:id+'-oath',avatarName,titleName,quote,titles})])));
  const BOND_EPISODES = Object.freeze([
    {id:1,level:1,unitLevel:1,title:'낯선 교실의 파도',reward:'이야기'},
    {id:2,level:3,unitLevel:30,title:'가라앉은 왕좌',reward:'프로필'},
    {id:3,level:5,unitLevel:50,title:'용왕의 약속',reward:'칭호'},
    {id:4,level:8,unitLevel:70,title:'학교에 남은 이유',reward:'로비 대사'}
  ].map(Object.freeze));
  const BOND_MISSIONS = Object.freeze([
    {id:'waves',name:'같은 전선을 지키며',desc:'이 용병과 보상 적용 전투 10회 승리',goal:10,xp:8},
    {id:'bosses',name:'함께 넘은 고비',desc:'이 용병과 보상 적용 보스 3회 처치',goal:3,xp:12},
    {id:'dragons',name:'성장한 동료',desc:'이 용병을 Lv.30 이상으로 육성하고 보상 적용 전투 20회 승리',goal:20,xp:10}
  ].map(Object.freeze));
  const newBondDay = now => ({day:day(now),waves:0,bosses:0,dragons:0,earned:0,claimed:[]});
  function validBonds(s) {
    if(s.bonds===undefined)return true;
    if(!s.bonds||typeof s.bonds!=='object'||Array.isArray(s.bonds))return false;
    return Object.entries(s.bonds).every(([id,b])=>Object.hasOwn(BOND_CHARACTERS,id)&&!!s.units[id]&&b&&Number.isInteger(b.xp)&&b.xp>=0&&b.xp<=650&&Array.isArray(b.read)&&b.read.length<=4&&b.read.every((id,i)=>id===i+1)&&b.daily&&Number.isInteger(b.daily.day)&&b.daily.day>=0&&['waves','bosses','dragons','earned'].every(k=>Number.isInteger(b.daily[k])&&b.daily[k]>=0&&b.daily[k]<=200)&&Array.isArray(b.daily.claimed)&&b.daily.claimed.length<=3&&new Set(b.daily.claimed).size===b.daily.claimed.length&&b.daily.claimed.every(id=>BOND_MISSIONS.some(m=>m.id===id)));
  }
  function bondMeta(s,id){const meta=BOND_CHARACTERS[id];return id==='horas'&&equippedSkin(s,id)==='horas_after_school'?{...meta,name:'방과 후의 성좌',skin:'horas_after_school',avatar:'horas-after-school',avatarName:'방과 후의 성좌 · 호라스',quote:'마지막 종이 울려도 괜찮아. 돌아갈 길은 내가 별빛으로 밝혀 둘게.',titles:['빈 교실의 약속','옥상에 남은 별','의식이 아닌 손짓','함께 맞는 내일']}:meta;}
  function bondInfo(s,now=s.at,id='osia') {
    const meta=bondMeta(s,id);if(!meta)return null;
    const owned=!!s.units[id],b=s.bonds?.[id]||{xp:0,read:[],daily:newBondDay(now)},d=day(Math.max(s.at,now))>b.daily.day?newBondDay(Math.max(s.at,now)):b.daily;
    const level=BOND_LEVELS.filter(x=>x<=b.xp).length,base=BOND_LEVELS[level-1],next=BOND_LEVELS[level]??base;
    return {id,meta,owned,xp:b.xp,level,unitLevel:s.units[id]?.level||0,progress:b.xp-base,needed:next-base,dailyEarned:d.earned,dailyLimit:BOND_DAILY_LIMIT,
      episodes:BOND_EPISODES.map(e=>({...e,title:meta.titles[e.id-1],reward:e.id===2?meta.avatarName+' · 프로필':e.id===3?meta.titleName+' · 칭호':e.reward,read:b.read.includes(e.id),unlocked:owned&&(b.read.includes(e.id)||level>=e.level&&s.units[id].level>=e.unitLevel&&(e.id===1||b.read.includes(e.id-1)))})),
      missions:BOND_MISSIONS.map(m=>({...m,value:Math.min(m.goal,d[m.id]),claimed:d.claimed.includes(m.id),ready:owned&&s.units[id].level>=10&&d[m.id]>=m.goal&&!d.claimed.includes(m.id)&&d.earned<BOND_DAILY_LIMIT&&b.xp<650})),
      avatar:!!meta.skin||b.read.includes(2),title:b.read.includes(3),dialogue:b.read.includes(4)};
  }
  function bondState(s,id='osia') {
    s.bonds||={};const b=s.bonds[id]||={xp:0,read:[],daily:newBondDay(s.at)};
    if(day(s.at)>b.daily.day)b.daily=newBondDay(s.at);return b;
  }
  function bondCombat(s,metric) {
    if(!questCombatEligible(s))return;
    for(const h of s.battle.heroes){const u=s.units[h.id];if(!BOND_CHARACTERS[h.id]||!u||u.level<10)continue;
      const b=bondState(s,h.id);b.daily[metric]=Math.min(200,b.daily[metric]+1);
      if(metric==='waves'){
        if(u.level>=30)b.daily.dragons=Math.min(200,b.daily.dragons+1);
        if(b.xp<650&&b.daily.earned<BOND_DAILY_LIMIT){b.xp++;b.daily.earned++;}
      }
    }
  }
  const ownsProfileTitle=(s,title)=>title===''||title==='beta'&&profileInfo(s).beta||Object.values(BOND_CHARACTERS).some(m=>m.title===title&&s.bonds?.[m.id]?.read?.includes(3))||title==='rank-reclaimer'&&!!s.redeemedCodes?.includes('RANK_RECLAIMER_2')||title==='rank-ntr'&&!!s.redeemedCodes?.includes('RANK_NTR_1')||title==='rank-azure-first'&&!!s.redeemedCodes?.includes('RANK_AZURE_FIRST_1');

  const SHARD_SSR = Object.freeze([...STANDARD_SSR]);
  const SHARD_LIMIT=1000000000;
  function shardInfo(s){return {unlocked:s.captain.level>=20,SR:s.shardExchange?.SR||0,SSR:s.shardExchange?.SSR||0,choices:SHARD_SSR.filter(id=>!!s.units[id]),recyclable:Object.entries(s.units).filter(([id,u])=>u.stars===5&&['SR','SSR'].includes(BY_ID[id].rarity)).map(([id,u])=>({id,rarity:BY_ID[id].rarity,shards:u.shards,batch:BY_ID[id].rarity==='SSR'?20:10}))};}
  function validShards(s){return s.shardExchange===undefined||s.shardExchange&&typeof s.shardExchange==='object'&&!Array.isArray(s.shardExchange)&&Object.keys(s.shardExchange).length===2&&['SR','SSR'].every(r=>Number.isSafeInteger(s.shardExchange[r])&&s.shardExchange[r]>=0&&s.shardExchange[r]<=SHARD_LIMIT);}
  function validate(s) {
    return !!(s && s.version === 1 && Number.isFinite(s.at) && s.at >= 0 && Number.isInteger(s.seed) &&
      (s.onboarding === undefined || s.onboarding && s.onboarding.version === 1 && Number.isInteger(s.onboarding.step) && s.onboarding.step >= 0 && s.onboarding.step <= 8) &&
      Number.isFinite(s.gold) && s.gold >= 0 && Number.isFinite(s.gems) && s.gems >= 0 &&
      (s.commanderName === undefined || typeof s.commanderName === "string" && normalizeCommanderName(s.commanderName) === s.commanderName) &&
      (s.nameChanges === undefined || Number.isSafeInteger(s.nameChanges) && s.nameChanges >= 0) &&
      (s.nameChangeTickets === undefined || Number.isSafeInteger(s.nameChangeTickets) && s.nameChangeTickets >= 0) && validWinter(s.winter) && (s.santa===undefined||!!globalThis.SchoolSantaRules?.valid(s.santa)) &&
      (s.speed === undefined || s.speed === 1 || s.speed === 1.5) &&
      (s.simCredit === undefined || Number.isFinite(s.simCredit) && s.simCredit >= 0 && s.simCredit < STEP_MS) &&
      (s.simTime === undefined || Number.isSafeInteger(s.simTime) && s.simTime >= 0) &&
      s.units && Object.keys(s.units).every(id => Object.hasOwn(BY_ID, id) && Number.isInteger(s.units[id].level) && s.units[id].level >= 1 && s.units[id].level <= levelCap(s.units[id]) && Number.isFinite(s.units[id].xp) && Number.isInteger(s.units[id].stars) && s.units[id].stars >= 0 && s.units[id].stars <= 5 && Number.isFinite(s.units[id].shards)) &&
      Array.isArray(s.team) && s.team.length >= 1 && s.team.length <= MAX_TEAM && new Set(s.team).size === s.team.length && s.team.every(id => typeof id === "string" && Object.hasOwn(BY_ID, id) && Object.hasOwn(s.units, id)) &&
      validBonds(s) && validShards(s) && validShop(s) && validPresets(s) && validEquipment(s) && validWeaponRecruit(s) && validCounter(s) &&
      Number.isInteger(s.stage) && s.stage >= 1 && s.stage <= MAX_STAGE && Number.isInteger(s.wave) && s.wave >= 1 && s.wave <= 4 &&
      Number.isInteger(s.best) && s.best >= 0 && s.best <= MAX_STAGE && Number.isInteger(s.pity) && s.pity >= 0 && s.pity < RECRUIT_PITY.hard &&
      (s.banners === undefined || s.banners && typeof s.banners === "object" && !Array.isArray(s.banners) && Object.keys(s.banners).every(id => Object.hasOwn(BANNERS, id)||id==="osia"||id==="lava"||id==="ryusion"||id==="kazua") && Object.values(s.banners).every(b => b && Number.isInteger(b.pity) && b.pity >= 0 && b.pity < RECRUIT_PITY.hard && typeof b.guaranteed === "boolean") && (!s.banners.standard || Number.isInteger(s.banners.standard.reserve)&&s.banners.standard.reserve>=0&&s.banners.standard.reserve<=237&&Number.isInteger(s.banners.standard.guarantees)&&s.banners.standard.guarantees>=0&&s.banners.standard.guarantees<=4&&s.banners.standard.guaranteed===(s.banners.standard.guarantees>0))) &&
      (s.units.osia?.nextSkill == null || Number.isInteger(s.units.osia.nextSkill) && s.units.osia.nextSkill >= 1 && s.units.osia.nextSkill <= 4) &&
      (s.units.ryusion?.nextSkill == null || s.units.ryusion.nextSkill === 1 || s.units.ryusion.nextSkill === 2) &&
      (s.units.lava?.nextSkill == null || s.units.lava.nextSkill === 1 || s.units.lava.nextSkill === 2) &&
      (s.units.lava?.basicHits == null || Number.isInteger(s.units.lava.basicHits) && s.units.lava.basicHits >= 0 && s.units.lava.basicHits < 10) &&
      s.battle && Array.isArray(s.battle.heroes) && s.battle.heroes.length >= 1 && s.battle.heroes.length <= MAX_TEAM && new Set(s.battle.heroes.map(h => h.id)).size === s.battle.heroes.length && Array.isArray(s.battle.enemies) && s.battle.heroes.every(h => Object.hasOwn(BY_ID, h.id) && Number.isFinite(h.hp) && (h.indomitableUntil === undefined || Number.isFinite(h.indomitableUntil) && h.indomitableUntil >= 0)) &&
      (s.battle.lavaRescueUsed === undefined || typeof s.battle.lavaRescueUsed === "boolean") &&
      (s.battle.cinematic === undefined || s.battle.cinematic && s.battle.cinematic.from === "osia" && [STEP_MS, OSIA_CINEMATIC_MS].includes(s.battle.cinematic.duration) && Number.isFinite(s.battle.cinematic.remaining) && s.battle.cinematic.remaining > 0 && s.battle.cinematic.remaining <= s.battle.cinematic.duration && Number.isInteger(s.battle.cinematic.resumeIndex) && s.battle.cinematic.resumeIndex >= 1 && s.battle.cinematic.resumeIndex <= s.battle.heroes.length) &&
      validQuestState(s.quests) && validPass(s.battlePass) &&
      (!s.battle.osiaCast?.breath||s.battle.osiaCast.stage===4&&Number.isInteger(s.battle.osiaCast.tick)&&s.battle.osiaCast.tick>=0&&s.battle.osiaCast.tick<=OSIA_BREATH_RULES.ticks) &&
      validHoras(s.battle) && s.battle.heroes.every(h=>validKazua(h.kazua)&&validHyeokjin(h.hyeokjin)&&validOsiaWeapon(h.osiaWeapon)&&validYaho(h)&&validRudes(h)) &&
      validActivities(s.activities) &&
      (s.battle.activity === undefined || s.activities?.run && s.battle.runId === s.activities.run.id && s.battle.activity.kind === s.activities.run.kind) &&
      (!s.activities?.run || s.battle.activity && (s.activities.run.settled ? s.activities.lastResult?.runId === s.activities.run.id && ["victory", "defeat"].includes(s.battle.phase) : s.battle.phase === "fight")) &&
      (s.codexClaimed===undefined||Array.isArray(s.codexClaimed)&&s.codexClaimed.length<=HEROES.length&&new Set(s.codexClaimed).size===s.codexClaimed.length&&s.codexClaimed.every(id=>Object.hasOwn(BY_ID,id)&&!!s.units[id])) &&
      Array.isArray(s.events) && Array.isArray(s.logs) && Array.isArray(s.claimed) && Array.isArray(s.receipts) && Array.isArray(s.history) &&
      (s.redeemedCodes === undefined || Array.isArray(s.redeemedCodes) && s.redeemedCodes.length <= 1000 && new Set(s.redeemedCodes).size === s.redeemedCodes.length && s.redeemedCodes.every(code => typeof code === "string" && /^[A-Z0-9_가-힣]{1,40}$/.test(code))) &&
      s.offline && Number.isFinite(s.offline.seconds) && Number.isFinite(s.offline.gold) && Number.isFinite(s.offline.xp) &&
      (s.offline.captainXp === undefined || Number.isFinite(s.offline.captainXp) && s.offline.captainXp >= 0) &&
      (s.heroShards===undefined||s.heroShards&&typeof s.heroShards==='object'&&!Array.isArray(s.heroShards)&&Object.entries(s.heroShards).every(([id,n])=>Object.hasOwn(BY_ID,id)&&Number.isSafeInteger(n)&&n>=0)) &&
      validSkins(s) && validProfile(s.profile,s) && s.captain && Number.isInteger(s.captain.level) && s.captain.level >= 1 && s.captain.level <= CAPTAIN_MAX_LEVEL && Number.isFinite(s.captain.xp) && s.captain.xp >= 0);
  }
  function newHoras(stacks = 0) {
    return { stacks, nextBasicAt: HORAS_RULES.basicMs, basicPose: 1, lastHitStackAt: -HORAS_RULES.hitStackMs, lastCastAt: -HORAS_RULES.minCastMs };
  }
  function horasInfo(s) {
    const b = s.battle, h = b?.heroes?.find(h => h.id === "horas"), progress = b?.horas || newHoras();
    const cast = b?.horasCast;
    return { stacks: progress.stacks, maxStacks: HORAS_RULES.maxStacks, casting: !!cast && !!h && h.hp > 0 && b.phase === "fight", cast: cast || null,
      nextBasicMs: Math.max(0, progress.nextBasicAt - (b?.elapsed || 0)), basicPose: progress.basicPose, skill: "벚꽃의식" };
  }
  function validHoras(b) {
    const h = b.horas, c = b.horasCast;
    const finite = value => Number.isFinite(value) && value >= 0;
    if (h !== undefined && (!h || !Number.isInteger(h.stacks) || h.stacks < 0 || h.stacks > HORAS_RULES.maxStacks || ![1, 2].includes(h.basicPose) || !finite(h.nextBasicAt) || !Number.isFinite(h.lastHitStackAt) || h.lastHitStackAt < -HORAS_RULES.hitStackMs || !Number.isFinite(h.lastCastAt) || h.lastCastAt < -HORAS_RULES.minCastMs)) return false;
    if (c !== undefined && (!c || !h || !Number.isSafeInteger(c.id) || c.id < 0 || !finite(c.began) || !finite(c.simBegan) || typeof c.targetId !== "string" || typeof c.missed !== "boolean" || c.impactDelay !== HORAS_RULES.impactDelay || c.mergeMs !== HORAS_RULES.mergeMs || !Array.isArray(c.targets) || !c.targets.length || c.targets.length > b.enemies.length || new Set(c.targets.map(t => t.id)).size !== c.targets.length || !c.targets.every(t => t && typeof t.id === "string" && finite(t.amount) && finite(t.splashAmount) && typeof t.critical === "boolean" && typeof t.primary === "boolean") || !c.targets.some(t => t.id === c.targetId && t.primary))) return false;
    return b.enemies.every(e => e.horasMark === undefined || e.horasMark && finite(e.horasMark.until) && Number.isSafeInteger(e.horasMark.castId) && e.horasMark.castId >= 0);
  }
  function horasStack(s, amount, source, to) {
    const b = s.battle;
    if (!b.heroes.some(h => h.id === "horas" && h.hp > 0)) return 0;
    const hs = b.horas ||= newHoras(), before = hs.stacks;
    hs.stacks = Math.min(HORAS_RULES.maxStacks, hs.stacks + amount);
    const gained = hs.stacks - before;
    if (gained) event(s, "horas-stack", { from: "horas", ...(to ? { to } : {}), stacks: hs.stacks, amount: gained, source, element: "blossom" });
    return gained;
  }
  function horasTurn(s, hero, enemies) {
    const b = s.battle, hs = b.horas ||= newHoras();
    // Her gauge is stacks, never the generic elapsed-time energy skill.
    hero.energy = 0;
    if (b.horasCast) return;
    if (hs.stacks >= HORAS_RULES.maxStacks && b.elapsed >= hs.lastCastAt + HORAS_RULES.minCastMs) {
      hs.stacks = 0; hs.lastCastAt = b.elapsed;
      hs.nextBasicAt = b.elapsed + HORAS_RULES.impactDelay + HORAS_RULES.basicMs/basicAttackRate(hero,b.elapsed);
      // Aim at the living cluster with the most neighbours. Stable order breaks
      // ties, so reconnecting and the authoritative arena choose the same target.
      const nearby = target => enemies.filter(enemy => Math.abs(b.enemies.indexOf(enemy) - b.enemies.indexOf(target)) <= 1).length;
      const target = enemies.reduce((best, enemy) => nearby(enemy) > nearby(best) ? enemy : best, enemies[0]), missed = random(s) < HORAS_RULES.missChance;
      const start = event(s, "skill", { from: "horas", name: "벚꽃의식", role: "사수", element: "blossom" });
      b.horasCast = { id: start.seq, began: b.elapsed, simBegan: s.simTime, targetId: target.id, missed, mergeMs: HORAS_RULES.mergeMs, impactDelay: HORAS_RULES.impactDelay,
        targets: enemies.map(enemy => {
          const critical = random(s) < (hero.critChance ?? CRITICAL.chance);
          const power = hero.atk * (1+(hero.exclusive?.strength||0)) * (hero.damageMultiplier || 1) * (b.buff ? 1.3 : 1) * (.9 + random(s) * .2) * (critical ? hero.critMultiplier || CRITICAL.multiplier : 1);
          return { id: enemy.id, primary: enemy.id === target.id, critical, amount: Math.round(power * HORAS_RULES.primaryMultiplier), splashAmount: Math.round(power * HORAS_RULES.splashMultiplier) };
        }) };
      event(s, "horas-cast", { from: "horas", castId: start.seq, targetId: target.id, targets: [target.id], name: "벚꽃의식", mergeMs: HORAS_RULES.mergeMs, impactDelay: HORAS_RULES.impactDelay, element: "blossom" });
      return;
    }
    if (b.elapsed < hs.nextBasicAt) return;
    hs.nextBasicAt = spicaRhythm(b)?(hs.nextBasicAt>=b.elapsed-STEP_MS?hs.nextBasicAt:b.elapsed)+HORAS_RULES.basicMs/basicAttackRate(hero,b.elapsed):b.elapsed+HORAS_RULES.basicMs;
    const target = enemies[0], pose = hs.basicPose;
    hs.basicPose = pose === 1 ? 2 : 1;
    event(s, "horas-basic", { from: "horas", to: target.id, pose, duration: HORAS_RULES.basicMotionMs, element: "blossom" });
    const critical = random(s) < (hero.critChance ?? CRITICAL.chance);
    hurt(s, "horas", target, hero.atk * HORAS_RULES.basicMultiplier * (1+(hero.exclusive?.strength||0)) * (hero.damageMultiplier || 1) * (b.buff ? 1.3 : 1) * (.9 + random(s) * .2) * (critical ? hero.critMultiplier || CRITICAL.multiplier : 1), "enemy", false, { critical, pose });
    horasStack(s, 1, "basic", target.id);
  }
  function horasStep(s) {
    const b = s.battle;
    for (const enemy of b.enemies) if (enemy.horasMark && b.elapsed >= enemy.horasMark.until) delete enemy.horasMark;
    const cast = b.horasCast;
    if (!cast) return false;
    if (!b.heroes.some(h => h.id === "horas" && h.hp > 0)) { delete b.horasCast; return false; }
    if (b.elapsed < cast.began + cast.impactDelay) return false;
    const previousIndex = b.enemies.findIndex(e => e.id === cast.targetId);
    const candidates = b.enemies.filter(e => e.hp > 0 && cast.targets.some(t => t.id === e.id));
    // If an ally defeated the original target during the ritual, reacquire the
    // nearest surviving saved target without rerolling damage, critical or miss.
    const target = candidates.find(e => e.id === cast.targetId) || candidates.reduce((a, e) => !a || Math.abs(b.enemies.indexOf(e) - previousIndex) < Math.abs(b.enemies.indexOf(a) - previousIndex) ? e : a, null);
    delete b.horasCast;
    if (!target) return true;
    const index = b.enemies.indexOf(target);
    const victims = candidates.filter(e => e === target || Math.abs(b.enemies.indexOf(e) - index) <= 1);
    event(s, "horas-impact", { from: "horas", castId: cast.id, targetId: target.id, missed: cast.missed, targets: cast.missed ? [] : victims.map(e => e.id), name: "벚꽃의식", element: "blossom" });
    if (cast.missed) { event(s, "miss", { from: "horas", to: target.id, castId: cast.id, element: "blossom" }); return true; }
    // At most one mark remains. Mark before damage so a killing blow refunds it.
    for (const enemy of b.enemies) delete enemy.horasMark;
    target.horasMark = { until: b.elapsed + HORAS_RULES.markMs + (b.heroes.find(h=>h.id==="horas")?.exclusive?2000:0), castId: cast.id };
    event(s, "horas-mark", { from: "horas", to: target.id, until: target.horasMark.until, duration: target.horasMark.until-b.elapsed, castId: cast.id, element: "blossom" });
    // Main target first, then low-damage neighbours: each death is settled once.
    for (const enemy of [target, ...victims.filter(e => e !== target)]) {
      const hit = cast.targets.find(t => t.id === enemy.id), primary = enemy === target;
      hurt(s, "horas", enemy, primary ? hit.amount : hit.splashAmount, "enemy", true, { castId: cast.id, primary, critical: hit.critical });
    }
    return true;
  }
  function hurt(s, from, target, raw, side, skill = false, detail = {}) {
    let earthGuard;
    if(side==='enemy'&&!detail.fixed&&!detail.directHp){const allies=s.battle.heroes;raw*=yahoDamageMultiplier(allies.find(h=>h.id===from),s.battle.elapsed)*yahoMasterMultiplier(from,allies);}
    if(side==='hero'){
      earthGuard=ryusionGuard(s.battle.heroes,s.battle.elapsed);
      if(earthGuard.taunting&&target.id!==earthGuard.hero.id){detail={...detail,redirectedFrom:target.id};target=earthGuard.hero;}
    }
    if (target.hp <= 0) return 0;
    if(side==='hero'&&target.id==='kazua'&&random(s)<KAZUA_RULES.evasion){event(s,'dodge',{from,to:target.id,side:'hero'});return 0;}
    // Stun amplification is decided at the actual hit, not at cast start.
    const stunBonus = from === "horas" && side === "enemy" && s.battle.elapsed < (target.stunUntil || 0);
    let amount = Math.max(1, Math.round(raw * (stunBonus ? HORAS_RULES.stunMultiplier : 1)));
    if(side==='enemy'&&(target.towerTrait||target.campaignTrait!==undefined)){const type=['physical','magic'].includes(detail.damageType)?detail.damageType:damageType(from),reduction=target[type==='magic'?'magicReduction':'physicalReduction']||0;amount=Math.max(1,Math.round(amount*(1-reduction)));detail={...detail,damageType:type,reduction};}
    if(side==='enemy'&&target.shield>0&&!detail.directHp){const absorbed=Math.min(target.shield,amount);target.shield-=absorbed;amount-=absorbed;event(s,'shield',{to:target.id,side:'enemy',amount:absorbed});}
    if (stunBonus) detail = { ...detail, stunBonus: true };
    if (side === "hero") {
      const b = s.battle;
      amount = Math.max(1, Math.round(amount * (1 - target.defense) * yahoProtectionMultiplier(target,b.elapsed) * (earthGuard.hero ? 1-RYUSION_RULES.teamReduction : 1) * (earthGuard.taunting&&target===earthGuard.hero ? 1-ryusionDefense(earthGuard.hero).tauntReduction : 1)));
      if(target.id==='hyeokjin'&&b.elapsed<hyeokjinRefresh(target,b.heroes,b.elapsed,(kind,extra)=>event(s,kind,{from:target.id,...extra})).lastUntil)amount=0;
      const shield = Math.min(target.shield, amount); target.shield -= shield; amount -= shield;
      const earthAbsorbed=Math.min(shield,target.earthShield||0);meter(s,'ryusion','absorbed',earthAbsorbed);
      const rudesAbsorbed=absorbRudesShield(target,shield);meter(s,'rudes','absorbed',rudesAbsorbed);
      let rest=shield-earthAbsorbed-rudesAbsorbed;
      for(const source of Object.keys(target.shieldSources||{})){const used=Math.min(rest,target.shieldSources[source]);target.shieldSources[source]-=used;rest-=used;meter(s,source,'absorbed',used);}
      absorbEarthShield(target,shield);
      if (shield) event(s, "shield", { to: target.id, amount: shield, ...(detail.redirectedFrom?{redirectedFrom:detail.redirectedFrom}:{}) });
      amount=hyeokjinGuard(target,b.heroes,b.elapsed,amount,(kind,extra)=>event(s,kind,{from:'hyeokjin',...extra}));
      if (amount >= target.hp && !b.lavaRescueUsed && b.heroes.some(h => h.id === "lava" && h.hp > 0)) {
        b.lavaRescueUsed = true; target.indomitableUntil = b.elapsed + 2000;
        event(s, "rescue", { from: "lava", to: target.id, duration: 2000, until: target.indomitableUntil, element: "wind" });
      }
      if (b.elapsed < (target.indomitableUntil || 0)) amount = Math.min(amount, target.hp - 1);
    }
    const hpBefore = target.hp;
    amount = Math.min(target.hp, amount); target.hp -= amount;
    if (side === "enemy") { meter(s, from, "damage", amount); if (detail.critical && amount > 0) meter(s, from, "criticals", 1); }
    else meter(s, target.id, "taken", amount);
    event(s, "hit", { from, to: target.id, side, amount, hpBefore, hpAfter:target.hp, skill, critical: !!detail.critical, impact: detail.critical ? "critical" : skill ? "heavy" : "normal", ...(BY_ID[from]?.element ? { element: BY_ID[from].element } : {}), ...detail });
    if (side === "hero" && target.id === "horas" && target.hp > 0) {
      const hs = s.battle.horas ||= newHoras();
      if (s.battle.elapsed >= hs.lastHitStackAt + HORAS_RULES.hitStackMs) {
        hs.lastHitStackAt = s.battle.elapsed; horasStack(s, 1, "hit", from);
      }
    }
    if(side==='enemy'&&from==='hyeokjin')hyeokjinRecord(s.battle.heroes.find(h=>h.id==='hyeokjin'),amount,s.battle.elapsed,(kind,extra)=>{if(kind==='heal')meter(s,'hyeokjin','healing',extra.amount);event(s,kind,{from:'hyeokjin',...extra});},!!detail.ultimate);
    if (target.hp <= 0 && side === "enemy") {
      s.kills++;
      if (questCombatEligible(s)) questProgress(s, "kills");
      if (target.horasMark && s.battle.elapsed < target.horasMark.until) {
        delete target.horasMark;
        const credited = horasStack(s, HORAS_RULES.refundStacks, "mark", target.id);
        if (credited) event(s, "horas-refund", { from: "horas", to: target.id, amount: credited, stacks: s.battle.horas.stacks, element: "blossom" });
      }
    }
    return amount;
  }
  function lowestAlive(b) {
    return b.heroes.filter(h => h.hp > 0).reduce((lowest, hero) => !lowest || hero.hp / hero.max < lowest.hp / lowest.max ? hero : lowest, null);
  }
  function lavaGuard(s, hero, target, raw, passive) {
    const amount = Math.max(0, Math.min(Math.round(raw * (1+(hero.exclusive?.strength||0)) * yahoMasterMultiplier(hero.id,s.battle.heroes)), Math.round(target.max * .6) - target.shield));
    target.shield += amount;target.shieldSources||={};target.shieldSources[hero.id]=(target.shieldSources[hero.id]||0)+amount;
    if (amount) event(s, "guard", { from: hero.id, to: target.id, amount, shield: target.shield, passive, element: "wind" });
  }
  function lavaHeal(s, hero, target, raw, stage) {
    const healing=Math.round(raw * (hero.healMultiplier || 1) * (1+(hero.exclusive?.strength||0)) * yahoMasterMultiplier(hero.id,s.battle.heroes));
    const amount = Math.min(target.max - target.hp, healing); target.hp += amount;
    if(stage===2&&hero.exclusive&&healing>amount)lavaGuard(s,hero,target,Math.min(hero.atk*.4,(healing-amount)*.15)/(1+hero.exclusive.strength),"weapon-overheal");
    meter(s, hero.id, "healing", amount);
    if (amount) event(s, "heal", { from: hero.id, to: target.id, amount, hpBefore:target.hp-amount, hpAfter:target.hp, stage, element: "wind" });
  }
  function victory(s) {
    if (s.counter) delete s.counter.opportunity;
    if (s.battle.activity) { settleActivity(s, true, "victory"); return; }
    const b = s.battle, reward = campaignRewardInfo(s), { gold, xp } = reward;
    if (reward.eligible) { bondCombat(s,"waves"); if(b.boss)bondCombat(s,"bosses"); questProgress(s, "waves"); if (b.boss) questProgress(s, "bosses"); }
    s.gold += gold; for (const id of s.team) addUnitXp(s, id, xp);
    if (reward.captainXp) captainXp(s, reward.captainXp);
    event(s, "reward", { gold, xp, boss: b.boss, eligible: reward.eligible, multiplier: reward.multiplier });
    winterDrop(s);
    if (b.boss) {
      s.losses = 0;
      if (s.stage > s.best) { s.best = s.stage; s.gems += 60; event(s, "clear", { stage: s.stage, gems: 60 }); log(s, `${stageName(s.stage)} 클리어! 보석 +60`); }
      if (s.mode === "progress" && s.stage < MAX_STAGE) s.stage++;
      if (s.stage === MAX_STAGE && s.best === MAX_STAGE) s.mode = "farm";
      s.wave = 1;
    } else s.wave++;
    b.phase = "victory"; if(b.boss)s.lastCombatReport={...damageReport(s),reason:"victory",at:s.at}; b.wait = b.boss ? 4 : 2; delete b.osiaCast; delete b.horasCast; delete b.cinematic;
  }
  function osiaStep(s) {
    const b = s.battle, cast = b.osiaCast;
    if (!cast) return false;
    if (!b.heroes.some(h => h.id === "osia" && h.hp > 0)) { if(cast.breath)event(s,"osia-breath-cancel",{from:"osia",castId:cast.id,breath:true});delete b.osiaCast; return false; }
    const step = OSIA_SKILLS[cast.stage - 1];
    if(cast.breath){
      const owner=b.heroes.find(h=>h.id==='osia'),r=OSIA_BREATH_RULES,age=b.elapsed-cast.began;
      if(!osiaDivine(owner)||owner.stunUntil>b.elapsed){event(s,'osia-breath-cancel',{from:'osia',castId:cast.id,breath:true});delete b.osiaCast;return false;}
      if(age>=r.windupMs+r.breathMs){delete b.osiaCast;return false;}
      const tick=cast.tick||0;if(tick>=r.ticks||age<r.windupMs+tick*r.tickMs)return false;
      cast.tick=tick+1;
      const targets=b.enemies.filter(e=>e.hp>0&&cast.targets.some(t=>t.id===e.id));
      if(!tick){
        event(s,'skill-impact',{from:'osia',castId:cast.id,stage:4,name:'용의 신수',element:'water',breath:true,targets:targets.map(e=>e.id)});
        if(targets.length){const amount=Math.max(0,Math.min(Math.round(owner.atk*(owner.exclusive.dragonShield||.2)),Math.round(owner.max*.6)-owner.shield));owner.shield+=amount;owner.shieldSources||={};owner.shieldSources.osia=(owner.shieldSources.osia||0)+amount;if(amount)event(s,'guard',{from:'osia',to:'osia',amount,shield:owner.shield,passive:'weapon-tide',element:'water'});}
      }
      for(const enemy of targets){const hit=cast.targets.find(t=>t.id===enemy.id),amount=Math.round(hit.amount*(tick+1)/r.ticks)-Math.round(hit.amount*tick/r.ticks);
        if(amount>0)hurt(s,'osia',enemy,amount,'enemy',true,{castId:cast.id,stage:4,critical:!!hit.critical,breath:true,tick});
        if(!tick&&enemy.hp>0){enemy.stunUntil=Math.max(enemy.stunUntil||0,b.elapsed+r.stunMs);event(s,'stun',{from:'osia',to:enemy.id,duration:r.stunMs,until:enemy.stunUntil});}
      }
      return true;
    }
    if (b.elapsed < cast.began + step.impactDelay) return false;
    const targets = b.enemies.filter(e => e.hp > 0 && cast.targets.some(t => t.id === e.id));
    event(s, "skill-impact", { from: "osia", castId: cast.id, stage: step.stage, name: osiaSkillName(b.heroes.find(h=>h.id==='osia'),step.stage), element: "water", targets: targets.map(e => e.id) });

    const owner=b.heroes.find(h=>h.id==="osia");
    if(step.stage===4&&targets.length&&osiaDivine(owner)){const amount=Math.max(0,Math.min(Math.round(owner.atk*(owner.exclusive.dragonShield||.2)),Math.round(owner.max*.6)-owner.shield));owner.shield+=amount;owner.shieldSources||={};owner.shieldSources.osia=(owner.shieldSources.osia||0)+amount;if(amount)event(s,"guard",{from:"osia",to:"osia",amount,shield:owner.shield,passive:"weapon-tide",element:"water"});}
    for (const enemy of targets) {
      const hit = cast.targets.find(t => t.id === enemy.id);
      hurt(s, "osia", enemy, hit.amount, "enemy", true, { castId: cast.id, stage: step.stage, critical: !!hit.critical });
      if (step.stunMs && enemy.hp > 0) {
        enemy.stunUntil = Math.max(enemy.stunUntil || 0, b.elapsed + step.stunMs);
        event(s, "stun", { from: "osia", to: enemy.id, duration: step.stunMs, until: enemy.stunUntil });
      }
    }
    delete b.osiaCast;
    return true;
  }
  function validCounter(s) {
    const c=s.counter,o=c?.opportunity;
    const time=v=>Number.isSafeInteger(v)&&v>=0;
    return c===undefined||!!(c&&time(c.cooldownUntil)&&(o===undefined||o&&typeof o.id==='string'&&o.id.length<=80&&Number.isSafeInteger(o.battleId)&&typeof o.enemyId==='string'&&time(o.openedAt)&&time(o.expiresAt)&&o.expiresAt-o.openedAt===COUNTER_RULES.windowMs));
  }
  function counterInfo(s, now=s.at) {
    const b=s.battle,o=s.counter?.opportunity,at=Math.max(s.at,Number.isFinite(now)?now:s.at);
    const enemy=o&&b.enemies.find(e=>e.id===o.enemyId&&e.hp>0);
    const active=!!(o&&b.id===o.battleId&&b.phase==='fight'&&!(b.cinematic&&!b.cinematic.nonBlocking)&&enemy&&b.heroes.some(h=>h.hp>0)&&at<o.expiresAt);
    return {active,opportunity:active?{...o,enemyName:enemy.name,remainingMs:o.expiresAt-at}:null};
  }
  function offerCounter(s, enemy) {
    const b=s.battle,c=s.counter||{cooldownUntil:0};
    if (b.phase!=='fight'||b.cinematic&&!b.cinematic.nonBlocking||!b.heroes.some(h=>h.hp>0)||s.at<c.cooldownUntil||enemy.hp<=0) return;
    // Separate deterministic roll: ignoring the prompt never consumes combat RNG.
    let bits=(s.seed^Math.imul(b.elapsed+(Number(enemy.id.slice(1))||0)+1,0x9e3779b1))>>>0;
    bits=Math.imul(bits^(bits>>>16),0x85ebca6b)>>>0;bits=Math.imul(bits^(bits>>>13),0xc2b2ae35)>>>0;bits=(bits^(bits>>>16))>>>0;
    if (bits/4294967296 >= (enemy.boss?COUNTER_RULES.bossChance:COUNTER_RULES.chance)) return;
    s.counter=c;c.cooldownUntil=s.at+COUNTER_RULES.cooldownMs;
    c.opportunity={id:`${b.id}:${s.seq+1}`,battleId:b.id,enemyId:enemy.id,openedAt:s.at,expiresAt:s.at+COUNTER_RULES.windowMs};
    event(s,'counter-ready',{from:enemy.id,opportunityId:c.opportunity.id,expiresAt:c.opportunity.expiresAt});
  }
  function counterAttack(s,input,now) {
    const info=counterInfo(s,now),o=info.opportunity;
    fail(info.active&&typeof input.opportunityId==='string'&&input.opportunityId===o.id&&input.battleId===o.battleId,'반격 기회가 끝났어요. 다음 기회를 노려주세요.');
    const b=s.battle,enemy=b.enemies.find(e=>e.id===o.enemyId),hero=b.heroes.filter(h=>h.hp>0).reduce((best,h)=>!best||h.atk>best.atk?h:best,null);
    delete s.counter.opportunity;
    event(s,'counter',{from:hero.id,to:enemy.id,name:'반격 성공',opportunityId:o.id});
    const amount=hurt(s,hero.id,enemy,hero.atk*COUNTER_RULES.multiplier*(hero.damageMultiplier||1),'enemy',true,{counter:true});
    if(b.enemies.every(e=>e.hp<=0))victory(s);
    return {kind:'counter',amount,hero:hero.id,target:enemy.id,opportunityId:o.id};
  }
  function ryusionStep(s) {
    const b=s.battle,guard=ryusionGuard(b.heroes,b.elapsed);
    for(const hero of b.heroes)expireEarthShield(hero,b.elapsed);
    if(guard.taunting){const began=b.elapsed-b.elapsed%RYUSION_RULES.tauntEvery;if(guard.hero.lastTauntAt!==began){guard.hero.lastTauntAt=began;const ratio=ryusionDefense(guard.hero).tauntShieldRatio;if(ratio){const amount=addEarthShield(guard.hero,Math.max(guard.hero.earthShield||0,guard.hero.max*ratio),b.elapsed);event(s,'earth-guard',{from:'ryusion',to:'ryusion',amount,until:guard.hero.earthShieldUntil,element:'earth'});}event(s,'ryusion-taunt',{from:'ryusion',to:'ryusion',until:began+RYUSION_RULES.tauntMs,duration:RYUSION_RULES.tauntMs,element:'earth'});}}
    const cast=b.ryusionCast;if(!cast)return;
    if(!guard.hero){delete b.ryusionCast;return;}
    if(b.elapsed<cast.began+RYUSION_RULES.impactDelay)return;
    delete b.ryusionCast;
    if(cast.stage===1){const target=b.enemies.find(e=>e.id===cast.targetId&&e.hp>0)||b.enemies.find(e=>e.hp>0);if(!target)return;
      event(s,'ryusion-impact',{from:'ryusion',to:target.id,stage:1,element:'earth'});
      hurt(s,'ryusion',target,cast.power,'enemy',true,{element:'earth'});
      if(target.hp>0){target.stunUntil=Math.max(target.stunUntil||0,b.elapsed+RYUSION_RULES.stunMs);event(s,'stun',{from:'ryusion',to:target.id,duration:RYUSION_RULES.stunMs,until:target.stunUntil,element:'earth'});}
    }else{for(const hero of b.heroes.filter(h=>h.hp>0)){const amount=addEarthShield(hero,cast.shield,b.elapsed);event(s,'earth-guard',{from:'ryusion',to:hero.id,amount,until:hero.earthShieldUntil,element:'earth'});}}
  }
  function spicaRhythm(b) { return b.heroes.some(h=>h.id==='spica'); }
  function basicDue(unit,time,base=1000,isBoss=false) {
    unit.nextBasicAt ??= base;
    if(time<unit.nextBasicAt)return false;
    unit.nextBasicAt=(unit.nextBasicAt>=time-STEP_MS?unit.nextBasicAt:time)+base/basicAttackRate(unit,time,isBoss);
    return true;
  }
  function yahoHeal(s,hero,target,raw,name){const before=target.hp,amount=Math.max(0,Math.min(target.max-target.hp,Math.round(raw*(hero.healMultiplier||1))));target.hp+=amount;meter(s,hero.id,'healing',amount);if(amount)event(s,'heal',{from:hero.id,to:target.id,amount,hpBefore:before,hpAfter:target.hp,name,element:'fire'});}
  function heroBasic(s,hero,enemies) {
    const b=s.battle,target=enemies[0];if(!target)return;
    const critical=random(s)<(hero.critChance??CRITICAL.chance);
    const dealt=hurt(s,hero.id,target,hero.atk*osiaBasicMultiplier(hero)*(hero.damageMultiplier||1)*(b.buff?1.3:1)*(.9+random(s)*.2)*(critical?hero.critMultiplier||CRITICAL.multiplier:1),'enemy',false,{critical});
    if(hero.id==='yaho')yahoBasic(hero,b.heroes,(a,n,name)=>yahoHeal(s,hero,a,n,name));
    if(hero.id==='lava'&&dealt>0){const unit=s.units.lava;unit.basicHits=(unit.basicHits||0)+1;if(unit.basicHits>=10){unit.basicHits=0;const friend=lowestAlive(b);if(friend)lavaGuard(s,hero,friend,hero.atk*2+friend.max*.08,'ten-hits');}}
  }
  function enemyBasic(s,enemy) {
    const b=s.battle,alive=b.heroes.filter(h=>h.hp>0);if(!alive.length)return;
    let target;
    if(b.heroes.length<=3)target=random(s)<.75?alive[0]:alive[Math.floor(random(s)*alive.length)];
    else{const front=b.heroes.slice(0,3).filter(h=>h.hp>0),back=b.heroes.slice(3).filter(h=>h.hp>0),pool=front.length&&(!back.length||random(s)<.8)?front:back.length?back:alive;
      const weights=pool.map(h=>BY_ID[h.id].role==='수호'?3:1);let pick=random(s)*weights.reduce((a,v)=>a+v,0);target=pool[pool.length-1];for(let i=0;i<pool.length;i++){pick-=weights[i];if(pick<0){target=pool[i];break;}}}
    target=lowAggroTarget(target,alive,()=>random(s));
    const rage=Math.min(enemy.rageCap||Infinity,1+Math.floor(b.elapsed/(enemy.rageEvery||Infinity))*(enemy.rageStep||0));
    hurt(s,enemy.id,target,enemy.atk*rage*(.85+random(s)*.3),'hero');
  }
  function spicaHalfTurn(s) {
    const b=s.battle;
    for(const hero of b.heroes){if(hero.hp<=0||hero.id==='kazua'||hero.id==='hyeokjin'||hero.id==='rudes'||b.elapsed<(hero.stunUntil||0)||b.elapsed<(hero.yahoCastUntil||0))continue;const enemies=b.enemies.filter(e=>e.hp>0);if(!enemies.length)break;
      if(hero.id==='horas'){horasTurn(s,hero,enemies);continue;}
      if(hero.id==='osia'&&b.osiaCast)continue;
      if(basicDue(hero,b.elapsed))heroBasic(s,hero,enemies);
    }
    if(b.enemies.every(e=>e.hp<=0)){victory(s);return;}
    for(const enemy of b.enemies){if(enemy.hp<=0||b.elapsed<(enemy.stunUntil||0)||!b.heroes.some(h=>h.hp>0))continue;if(basicDue(enemy,b.elapsed,1000,!!enemy.boss)){enemyBasic(s,enemy);offerCounter(s,enemy);}}
  }
  function spicaSkill(s,hero,enemies) {
    const b=s.battle,hasteUntil=b.elapsed+SPICA_RULES.hasteMs,slowUntil=b.elapsed+SPICA_RULES.slowMs;
    const allies=b.heroes.filter(h=>h.hp>0);
    event(s,'spica-skill',{from:hero.id,stage:1,name:'설녀의 겨울',targets:allies.map(h=>h.id),enemies:enemies.map(e=>e.id),hasteUntil,slowUntil,element:'ice'});
    for(const friend of allies){friend.hasteUntil=Math.max(friend.hasteUntil||0,hasteUntil);event(s,'haste',{from:hero.id,to:friend.id,until:friend.hasteUntil,duration:SPICA_RULES.hasteMs,amount:SPICA_RULES.haste,element:'ice'});}
    for(const enemy of enemies){enemy.slowUntil=Math.max(enemy.slowUntil||0,slowUntil);event(s,'slow',{from:hero.id,to:enemy.id,until:enemy.slowUntil,duration:SPICA_RULES.slowMs,amount:SPICA_RULES.slow*(enemy.boss?SPICA_RULES.bossSlowScale:1),element:'ice'});
      const critical=random(s)<(hero.critChance??CRITICAL.chance);hurt(s,hero.id,enemy,hero.atk*SPICA_RULES.skillMultiplier*(hero.damageMultiplier||1)*(b.buff?1.3:1)*(.9+random(s)*.2)*(critical?hero.critMultiplier||CRITICAL.multiplier:1),'enemy',true,{critical,element:'ice'});}
  }
  function tick(s) {
    const b = s.battle;
    // Old saves have no half-second clock. Keep their existing attack cadence.
    b.elapsed ??= b.tick * 1000; b.id ??= s.seq;
    if (b.activity && s.activities?.run?.settled) return;
    if (b.phase !== "fight") { if ((b.wait -= STEP_MS / 1000) <= 0) spawn(s, true); return; }
    if (b.cinematic) {
      const cutin = b.cinematic;
      if (!b.heroes.some(h => h.id === "osia" && h.hp > 0)) { if(b.osiaCast?.breath)event(s,"osia-breath-cancel",{from:"osia",castId:b.osiaCast.id,breath:true});delete b.osiaCast; cutin.remaining = 0; }
      else cutin.remaining -= STEP_MS;
      if (cutin.remaining <= 0) {
        event(s, "cinematic-end", { from: "osia", castId: cutin.castId }); delete b.cinematic;
      }
      // Presentation only: allies, enemy attacks and status clocks keep moving.
    }
    b.elapsed += STEP_MS;
    if (b.activity && b.heroes.every(h => h.hp <= 0)) { settleActivity(s, false, "defeat"); return; }
    const witch=b.heroes.find(h=>h.id==='rudes');
    if(witch)rudesStep(witch,b.heroes,b.enemies,b.elapsed,STEP_MS,(target,amount,detail)=>{const critical=random(s)<(witch.critChance??CRITICAL.chance);return hurt(s,'rudes',target,amount*(witch.damageMultiplier||1)*(b.buff?1.3:1)*(.9+random(s)*.2)*(critical?witch.critMultiplier||CRITICAL.multiplier:1),'enemy',detail.skill,{...detail,critical});},(kind,extra)=>event(s,kind,{from:'rudes',...extra}),b.elapsed<(witch.stunUntil||0),basicAttackRate(witch,b.elapsed));
    const yaho=b.heroes.find(h=>h.id==='yaho');
    if(yaho)yahoStep(yaho,b.heroes,b.elapsed,STEP_MS,(a,n,name)=>yahoHeal(s,yaho,a,n,name),(kind,extra)=>event(s,kind,{from:'yaho',...extra}),b.elapsed<(yaho.stunUntil||0));
    ryusionStep(s);
    const osiaImpact = osiaStep(s);
    const osia=b.heroes.find(h=>h.id==='osia');
    if(osia)osiaWeaponStep(osia,b.enemies,b.elapsed,STEP_MS,(target,amount,detail)=>hurt(s,'osia',target,amount,'enemy',true,detail),(kind,extra)=>event(s,kind,{from:'osia',...extra}),b.elapsed<(osia.stunUntil||0));
    horasStep(s);
    const berserker=b.heroes.find(h=>h.id==='hyeokjin');
    if(berserker)hyeokjinStep(berserker,b.heroes,b.enemies,b.elapsed,STEP_MS,(target,amount,detail)=>{const critical=!detail.fixed&&random(s)<(berserker.critChance??CRITICAL.chance);return hurt(s,berserker.id,target,detail.fixed?amount:amount*(berserker.damageMultiplier||1)*(b.buff?1.3:1)*(.9+random(s)*.2)*(critical?berserker.critMultiplier||CRITICAL.multiplier:1),'enemy',!!detail.skill,{...detail,critical});},(kind,extra)=>{if(kind==='heal')meter(s,'hyeokjin','healing',extra.amount);event(s,kind,{from:'hyeokjin',...extra});},b.elapsed<(berserker.stunUntil||0),basicAttackRate(berserker,b.elapsed));
    const gunner=b.heroes.find(h=>h.id==='kazua');
    if(gunner)kazuaStep(gunner,b.heroes,b.enemies,b.elapsed,STEP_MS,(target,mult,detail)=>{
      const critical=random(s)<(gunner.critChance??CRITICAL.chance);
      return hurt(s,gunner.id,target,gunner.atk*mult*(gunner.damageMultiplier||1)*(b.buff?1.3:1)*(.9+random(s)*.2)*(critical?gunner.critMultiplier||CRITICAL.multiplier:1),'enemy',!!detail.skill,{critical,kazuaMode:detail.mode});
    },(kind,extra)=>event(s,kind,{from:'kazua',...extra}),b.elapsed<(gunner.stunUntil||0),basicAttackRate(gunner,b.elapsed));
    if (b.enemies.every(e => e.hp <= 0)) { victory(s); return; }
    for (const enemy of b.enemies) {
      if(enemy.hp>0&&enemy.telegraphMs){
        if(b.elapsed<(enemy.stunUntil||0)&&enemy.skillWarnedFor===enemy.nextSkillAt){
          enemy.nextSkillAt=b.elapsed+enemy.skillEvery;enemy.skillWarnedFor=0;delete enemy.skillTarget;
          event(s,'monster-interrupt',{from:enemy.id,name:'시전 차단'});
        }else if(b.elapsed>=(enemy.stunUntil||0)&&enemy.skillWarnedFor!==enemy.nextSkillAt&&b.elapsed>=enemy.nextSkillAt-enemy.telegraphMs){
          enemy.skillWarnedFor=enemy.nextSkillAt;const living=b.heroes.filter(h=>h.hp>0),back=b.heroes.slice(3).filter(h=>h.hp>0),pool=enemy.combatRole==='ranged'&&back.length?back:living;
          enemy.skillTarget=enemy.combatRole==='healer'?enemy.id:pool.reduce((a,h)=>!a||h.hp/h.max<a.hp/a.max?h:a,null)?.id;
          event(s,'monster-warning',{from:enemy.id,to:enemy.skillTarget,name:enemy.monsterSkill,role:enemy.combatRole,duration:Math.max(0,enemy.nextSkillAt-b.elapsed)});
        }
      }
      if(enemy.hp>0&&enemy.regenEvery&&b.elapsed>=enemy.nextRegenAt&&b.elapsed>=(enemy.stunUntil||0)){
        const amount=Math.min(enemy.max-enemy.hp,Math.round(enemy.max*enemy.regenRatio));enemy.nextRegenAt=b.elapsed+enemy.regenEvery;enemy.hp+=amount;
        if(amount)event(s,'enemy-heal',{from:enemy.id,to:enemy.id,side:'enemy',amount,hpBefore:enemy.hp-amount,hpAfter:enemy.hp});
      }
      if (enemy.hp <= 0 || !enemy.ability || enemy.warnedFor === enemy.nextAbilityAt || b.elapsed < enemy.nextAbilityAt - 1000) continue;
      enemy.warnedFor = enemy.nextAbilityAt;
      event(s, "boss-warning", { from: enemy.id, name: enemy.ability, targets: b.heroes.filter(h => h.hp > 0).map(h => h.id), atElapsed: enemy.nextAbilityAt, duration: Math.max(0, enemy.nextAbilityAt - b.elapsed) });
    }
    if (b.elapsed % 1000) {if(spicaRhythm(b))spicaHalfTurn(s);return;}
    b.tick = b.elapsed / 1000;
    if (b.buff > 0) b.buff--;
    combatTurn(s, 0, osiaImpact);
  }
  function combatTurn(s, startIndex, osiaImpact) {
    const b = s.battle,rhythm=spicaRhythm(b);
    for (let index = startIndex; index < b.heroes.length; index++) {
      const hero = b.heroes[index]; if (hero.hp <= 0 || hero.id==='kazua'||hero.id==='hyeokjin'||hero.id==='rudes'||b.elapsed<(hero.stunUntil||0)||b.elapsed<(hero.yahoCastUntil||0)) continue;
      const enemies = b.enemies.filter(e => e.hp > 0); if (!enemies.length) break;
      const def = BY_ID[hero.id];
      if (hero.id === "horas") { horasTurn(s, hero, enemies); continue; }
      hero.energy++;
      if (hero.id === "osia" && (b.osiaCast || osiaImpact)) continue;
      const skill = hero.energy >= def.cooldown;
      if(rhythm){const ready=basicDue(hero,b.elapsed);if(!skill&&!ready)continue;if(skill&&!ready)hero.nextBasicAt+=1000/basicAttackRate(hero,b.elapsed);}
      if (skill) { hero.energy = 0; event(s, "skill", { from: hero.id, name: hero.id === "yaho" ? (yahoInit(hero).next===1?"포효":hero.yaho.summoned?"산군의 가호":"산군의 보호") : hero.id === "osia" ? osiaSkillName(hero,osiaSkill(s).stage) : hero.id === "lava" ? lavaSkill(s).name : hero.id === "ryusion" ? ryusionSkill(s).name : def.skill, role: def.role, ...(def.element ? { element: def.element } : {}) }); }
      if(skill&&hero.id==='yaho'){yahoCast(hero,b.heroes,b.elapsed,(a,n,name)=>yahoHeal(s,hero,a,n,name),(kind,extra)=>event(s,kind,{from:'yaho',...extra}));continue;}
      if(skill&&hero.id==='spica'){spicaSkill(s,hero,enemies);continue;}
      if(skill&&hero.id==='ryusion'){
        const step=ryusionSkill(s);s.units.ryusion.nextSkill=step.stage===1?2:1;
        b.ryusionCast={began:b.elapsed,stage:step.stage,targetId:enemies[0].id,power:hero.atk*(hero.damageMultiplier||1)*(b.buff?1.3:1),shield:Math.round(hero.max*ryusionDefense(hero).shieldRatio)};
        event(s,'ryusion-skill',{from:hero.id,to:step.stage===1?enemies[0].id:hero.id,stage:step.stage,name:step.name,element:'earth',impactDelay:RYUSION_RULES.impactDelay});continue;
      }
      if (skill && hero.id === "osia") {
        const step = osiaSkill(s);
        const cinematicDuration = step.stage === 4 ? OSIA_CINEMATIC_MS : 0;
        const breath=step.stage===4&&osiaDivine(hero),impactDelay=breath?OSIA_BREATH_RULES.windupMs:step.impactDelay;
        b.osiaCast = { id: s.seq, began: b.elapsed, simBegan: s.simTime, stage: step.stage, ...(breath?{breath:true,tick:0}:{}), cinematicDuration, nonBlocking:true, targets: enemies.map(e => {
          const critical = random(s) < (hero.critChance ?? CRITICAL.chance);
          return { id: e.id, critical, amount: Math.round(hero.atk * def.skillMultiplier * osiaSkillMultiplier(hero,step.stage) * (hero.damageMultiplier || 1) * (b.buff ? 1.3 : 1) * (.9 + random(s) * .2) * (critical ? hero.critMultiplier || CRITICAL.multiplier : 1)) };
        }) };
        s.units.osia.nextSkill = step.stage % 4 + 1;
        event(s, "skill-stage", { from: "osia", castId: b.osiaCast.id, stage: step.stage, name: osiaSkillName(hero,step.stage), impactDelay, cinematicDuration, element: "water", divine:osiaDivine(hero), ...(breath?{breath:true}:{}), targets: enemies.map(e => e.id) });
        if (cinematicDuration) {
          b.cinematic = { from: "osia", castId: b.osiaCast.id, duration: cinematicDuration, remaining: cinematicDuration, resumeIndex: index + 1, nonBlocking:true };
          event(s, "cinematic", { from: "osia", castId: b.osiaCast.id, stage: 4, duration: cinematicDuration, nonBlocking:true });
        }
        continue;
      }
      if (skill && hero.id === "lava") {
        const step = lavaSkill(s), targets = step.stage === 1 ? b.heroes.filter(h => h.hp > 0) : [lowestAlive(b)];
        s.units.lava.nextSkill = step.stage === 1 ? 2 : 1;
        event(s, "lava-skill", { from: hero.id, stage: step.stage, name: yahoMasterMultiplier(hero.id,b.heroes)>1?step.name.replace("바람","태풍"):step.name, typhoon:yahoMasterMultiplier(hero.id,b.heroes)>1, element: "wind", targets: targets.map(h => h.id) });
        for (const friend of targets) {
          lavaHeal(s, hero, friend, hero.atk * step.healMultiplier, step.stage);
          if (step.shieldMultiplier) lavaGuard(s, hero, friend, hero.atk * step.shieldMultiplier, "fan");
        }
        continue;
      }
      if(!skill&&hero.id==='yaho')yahoBasic(hero,b.heroes,(a,n,name)=>yahoHeal(s,hero,a,n,name));
      let target = enemies[0], multiplier = skill ? 3 : 1;
      if (skill && def.role === "치유") {
        for (const friend of b.heroes.filter(h => h.hp > 0)) {
          const heal = Math.min(friend.max - friend.hp, Math.round(hero.atk * 2.2 * (hero.healMultiplier || 1))); friend.hp += heal;
          meter(s, hero.id, "healing", heal);
          if (heal) event(s, "heal", { from: hero.id, to: friend.id, amount: heal, hpBefore:friend.hp-heal, hpAfter:friend.hp });
        }
        continue;
      }
      if (skill && def.role === "수호") { const gained=Math.round(hero.max*.25);hero.shield+=gained;hero.shieldSources||={};hero.shieldSources[hero.id]=(hero.shieldSources[hero.id]||0)+gained; event(s, "guard", { to: hero.id, amount: hero.shield }); multiplier = 1; }
      if (skill && def.role === "지원") { b.buff = 4; multiplier = 1; }
      if (skill && def.role === "사수") { target = enemies.reduce((a, e) => a.hp < e.hp ? a : e); multiplier = 2.6; }
      const victims = skill && def.role === "마법" ? enemies : [target];
      if (skill && def.role === "마법") multiplier = def.skillMultiplier || 1.7;
      for (const enemy of victims) {
        const critical = random(s) < (hero.critChance ?? CRITICAL.chance);
        const dealt = hurt(s, hero.id, enemy, hero.atk * multiplier * (!skill?osiaBasicMultiplier(hero):1) * (hero.damageMultiplier || 1) * (b.buff ? 1.3 : 1) * (.9 + random(s) * .2) * (critical ? hero.critMultiplier || CRITICAL.multiplier : 1), "enemy", skill, { critical });
        if (hero.id === "lava" && !skill && dealt > 0) {
          const unit = s.units.lava; unit.basicHits = (unit.basicHits || 0) + 1;
          if (unit.basicHits >= 10) { unit.basicHits = 0; const friend = lowestAlive(b); if (friend) lavaGuard(s, hero, friend, hero.atk * 2 + friend.max * .08, "ten-hits"); }
        }
      }
    }
    if (b.enemies.every(e => e.hp <= 0)) { victory(s); return; }
    for (const enemy of b.enemies.filter(e => e.hp > 0)) {
      if (b.elapsed < (enemy.stunUntil || 0)) continue;
      const alive = b.heroes.filter(h => h.hp > 0); if (!alive.length) break;
      const rage = Math.min(enemy.rageCap||Infinity,1 + Math.floor(b.elapsed / (enemy.rageEvery || Infinity)) * (enemy.rageStep || 0));
      let attacked=true;
      if (enemy.ability && b.elapsed >= enemy.nextAbilityAt) {
        if(rhythm&&!basicDue(enemy,b.elapsed,1000,!!enemy.boss))enemy.nextBasicAt+=1000/basicAttackRate(enemy,b.elapsed,!!enemy.boss);
        event(s, "boss-skill", { from: enemy.id, name: enemy.ability, targets: alive.map(h => h.id), rage, atElapsed: b.elapsed });
        for (const target of alive) hurt(s, enemy.id, target, enemy.atk * enemy.aoeMultiplier * rage * (.9 + random(s) * .2), "hero", true, { bossSkill: true });
        enemy.nextAbilityAt = b.elapsed + enemy.aoeEvery;
      } else if (enemy.monsterSkill && Number.isFinite(enemy.nextSkillAt) && b.elapsed >= enemy.nextSkillAt) {
        if(rhythm&&!basicDue(enemy,b.elapsed,1000,!!enemy.boss))enemy.nextBasicAt+=1000/basicAttackRate(enemy,b.elapsed,!!enemy.boss);
        const role = enemy.combatRole;
        if(enemy.supportShield){
          attacked=false;const friends=b.enemies.filter(e=>e.hp>0);
          for(const friend of friends)friend.shield=Math.max(friend.shield||0,Math.round(friend.max*enemy.supportShield));
          event(s,'monster-skill',{from:enemy.id,name:enemy.monsterSkill,role:'guard',targets:friends.map(e=>e.id),element:'arcane'});
        } else if (role === "healer") {
          attacked=false;
          const friend = b.enemies.filter(e => e.hp > 0).reduce((a, e) => !a || e.hp / e.max < a.hp / a.max ? e : a, null);
          const amount = Math.max(0, Math.min(friend.max - friend.hp, Math.round((enemy.atk * 2 + friend.max * .025) * enemy.skillPower)));
          event(s, "monster-skill", { from: enemy.id, name: enemy.monsterSkill, role, targets: [friend.id], element: "healing" });
          friend.hp += amount;
          if (amount) event(s, "enemy-heal", { from: enemy.id, to: friend.id, side: "enemy", amount, hpBefore:friend.hp-amount, hpAfter:friend.hp });
        } else {
          const back = b.heroes.slice(3).filter(h => h.hp > 0), pool = role === "ranged" && back.length ? back : alive;
          const target = alive.find(h=>h.id===enemy.skillTarget) || (role === "ranged" ? pool.reduce((a, h) => h.hp / h.max < a.hp / a.max ? h : a) : alive[0]);
          event(s, "monster-skill", { from: enemy.id, name: enemy.monsterSkill, role, targets: [target.id], element: role === "ranged" ? "arcane" : "physical" });
          hurt(s, enemy.id, target, enemy.atk * (role === "melee" ? 1.8 : 1.45) * enemy.skillPower, "hero", true, { monsterSkill: true });
        }
        enemy.nextSkillAt = b.elapsed + enemy.skillEvery;delete enemy.skillTarget;
      } else {
        if(rhythm&&!basicDue(enemy,b.elapsed,1000,!!enemy.boss))continue;
        enemyBasic(s,enemy);
      }
      if(attacked)offerCounter(s,enemy);
    }
    if (b.heroes.every(h => h.hp <= 0) || b.tick >= 120) {
      if (b.activity) { settleActivity(s, false, b.tick >= 120 ? "timeout" : "defeat"); return; }
      b.phase = "defeat"; b.wait = 5; s.wave = 1; s.losses++; delete b.osiaCast; delete b.horasCast; delete b.cinematic; if(s.counter)delete s.counter.opportunity;
      s.lastCombatReport={...damageReport(s),reason:b.tick>=120?"timeout":"defeat",at:s.at};
      event(s, "defeat", { boss: b.boss, stage: b.stage, reason: b.tick >= 120 ? "timeout" : "defeat", report: damageReport(s) }); log(s, "잠시 쉬어 갑니다. 용병을 훈련하거나 편성을 바꿔보세요.");
      if (s.losses >= 3 && s.best >= 1) { s.mode = "farm"; s.stage = s.best; s.losses = 0; log(s, "클리어한 지역에서 자동으로 성장합니다. 도전 버튼으로 다시 출발하세요."); }
    }
  }
  function advance(s, now, options) { return withGearContext(s, options, () => advanceCore(s, now)); }
  function advanceCore(s, now) {
    if(now>=Date.parse('2026-11-20T00:00:00+09:00')&&!(s.redeemedCodes||[]).includes('HORAS_FAREWELL_5')){
      if(s.units.horas)s.units.horas.shards+=5;else{s.heroShards||={};s.heroShards.horas=(s.heroShards.horas||0)+5;}
      s.redeemedCodes=[...(s.redeemedCodes||[]),'HORAS_FAREWELL_5'];
    }
    s.profile ??= {avatar:'leader',title:'',beta:true};
    refreshQuestState(s, s.at); refreshWinter(s, s.at);
    s.speed ??= 1; s.simCredit ??= 0; s.simTime ??= 0;
    s.commanderName ??= "새내기 단장"; s.presets ??= newPresets(); s.equipment ??= newEquipment(); s.weaponBanners ??= {standard:{pity:0},limited:{pity:0}}; s.weaponPulls ??= 0; s.weaponHistory ??= [];
    // Preserve the captain share already earned under the previous bank rate.
    s.offline.captainXp ??= Math.floor(s.offline.xp / 4);
    refreshActivities(s, Number.isFinite(now) && now >= 0 ? Math.max(now, s.at) : s.at);
    const migrated=Object.fromEntries(Object.keys(BANNERS).map(id=>[id,bannerState(s,id)]));
    s.banners=migrated; s.pity=migrated.standard.pity;
    if (s.team.includes("horas")) s.battle.horas ??= newHoras();
    if (s.units.ryusion) s.units.ryusion.nextSkill ??= 1;
    if (s.units.osia) s.units.osia.nextSkill ??= 1;
    if (s.units.lava) { s.units.lava.nextSkill ??= 1; s.units.lava.basicHits ??= 0; }
    // A v4 simultaneous combo must not continue into the new per-cooldown cycle.
    if (s.battle.osiaCast && !s.battle.osiaCast.stage) delete s.battle.osiaCast;
    if (!Number.isFinite(now) || now <= s.at) return { seconds: 0, offline: false };
    const seconds = Math.floor((now - s.at) / 1000);
    const steps = Math.floor((now - s.at) / STEP_MS);
    if (!steps) return { seconds: 0, offline: false };
    if (seconds > 90) {
      if(s.counter)delete s.counter.opportunity;
      const add = Math.min(seconds, Math.max(0, OFFLINE_CAP - s.offline.seconds)), rate = baseRates(s);
      const weightedSeconds=offlineRewardSeconds(s.at,s.at+add*1000), xp = Math.floor(rate.xp * weightedSeconds / 60);
      s.offline.seconds += add; s.offline.gold += Math.floor(rate.gold * weightedSeconds / 60); s.offline.xp += xp;
      s.offline.captainXp += xp / PROGRESSION.captainOfflineDivisor;
      s.at += seconds * 1000; refreshQuestState(s, s.at);
      if (add) event(s, "offline", { seconds: add });
      return { seconds: add, offline: true };
    }
    for (let i = 0; i < steps; i++) consumeRealTime(s, STEP_MS);
    return { seconds: steps * STEP_MS / 1000, offline: false };
  }
  function consumeRealTime(s, milliseconds) {
    s.at += milliseconds; s.simCredit += milliseconds * s.speed;
    while (s.simCredit >= STEP_MS) {
      s.simCredit -= STEP_MS; s.simTime += STEP_MS; tick(s);
    }
  }
  function questValue(s, quest) { return quest.metric === "collection" ? Object.keys(s.units).length : quest.metric === "captain" ? s.captain.level : s[quest.metric]; }
  function recruit(s, count, rng, banner = "standard", now = Date.now(), guaranteedHero = "osia") {
    banner=canonicalBanner(banner);
    fail(banner!=="standard"||STANDARD_SSR.includes(guaranteedHero), "기존 확정 보상은 상시 SSR 중 선택하세요.");
    fail(count === 1 || count === 10, "1회 또는 10회 모집할 수 있습니다.");
    fail(typeof banner === "string" && Object.hasOwn(BANNERS, banner), "모집할 배너를 선택하세요.");
    fail(bannerAvailable(banner, now), "이 모집 배너는 종료되었습니다.");
    const cost = recruitCost(banner,count); fail(s.gems >= cost, "보석이 부족합니다.");
    const shardWallet=shardInfo(s);
    fail(shardWallet.SR<=SHARD_LIMIT-count*10&&shardWallet.SSR<=SHARD_LIMIT-count*10,"공용 조각을 먼저 교환해 주세요.");
    const progress = bannerState(s, banner), featured = BANNERS[banner].featured;
    const otherSSR = STANDARD_SSR.filter(id => id !== featured);
    const nextBanners = Object.fromEntries(Object.keys(BANNERS).map(id => [id, bannerState(s, id)]));
    const results = []; let premium = false;
    for (let i = 0; i < count; i++) {
      const odds = recruitRates(progress.pity, banner), roll = rng();
      const ur = odds.UR || 0;
      let rarity = roll < ur ? "UR" : roll < Math.round((ur + odds.SSR) * 1e9) / 1e9 ? "SSR" : roll < Math.round((ur + odds.SSR + odds.SR) * 1e9) / 1e9 ? "SR" : "R";
      const pity = progress.pity >= RECRUIT_PITY.hard - 1;
      if (pity) rarity = isURBanner(banner) ? "UR" : "SSR";
      if (count === 10 && i === 9 && !premium && rarity === "R") rarity = "SR";
      if (rarity !== "R") premium = true;
      // One grade roll and one character roll per slot, including a guaranteed
      // featured SSR, keeps replay and ten-pull sequencing deterministic.
      const pick = Math.max(0, Math.min(1 - Number.EPSILON, rng()));
      const guaranteed = isURBanner(banner) ? rarity === "UR" && pity : rarity === "SSR" && progress.guaranteed;
      let h;
      if (rarity === "UR") h = BY_ID[featured];
      else if (rarity === "SSR" && isURBanner(banner)) h = BY_ID[STANDARD_SSR[Math.min(STANDARD_SSR.length - 1, Math.floor(pick * STANDARD_SSR.length))]];
      else if(rarity==='SSR'&&banner==='standard'){
        h=BY_ID[guaranteed?guaranteedHero:STANDARD_SSR[Math.floor(pick*STANDARD_SSR.length)]];
        if(guaranteed)progress.guarantees--;progress.guaranteed=progress.guarantees>0;
      } else if (rarity === "SSR") {
        const chosen = guaranteed || pick < .5 ? featured : otherSSR[Math.min(otherSSR.length - 1, Math.floor((pick - .5) * 2 * otherSSR.length))];
        h = BY_ID[chosen]; progress.guaranteed = chosen !== featured;
      } else {
        const candidates = HEROES.filter(hero => hero.rarity === rarity);
        h = candidates[Math.min(candidates.length - 1, Math.floor(pick * candidates.length))];
      }
      if(rarity===(isURBanner(banner)?'UR':'SSR')){const carry=banner==='standard'?progress.reserve:0;progress.pity=Math.min(79,carry);if(banner==='standard')progress.reserve=Math.max(0,carry-79);}else progress.pity++;
      const fresh = !s.units[h.id], shards = rarity === "UR" ? 30 : rarity === "SSR" ? 20 : rarity === "SR" ? 10 : 5;
      const converted=!fresh&&s.units[h.id].stars===5&&shardWallet.unlocked&&['SR','SSR'].includes(rarity)?{rarity,count:10}:null;
      if (fresh) {s.units[h.id] = { level: 1, xp: 0, stars: 0, shards: s.heroShards?.[h.id]||0 };if(s.heroShards)delete s.heroShards[h.id];}
      else if(converted){s.shardExchange||={SR:0,SSR:0};s.shardExchange[rarity]+=10;}
      else s.units[h.id].shards += shards;
      results.push({ id: h.id, fresh, shards: fresh || converted ? 0 : shards, ...(converted?{converted}:{}), pity, ssrChance: odds.SSR, ...(isURBanner(banner) ? { urChance: odds.UR } : {}), banner, featured: h.id === featured, guaranteed, lostFeatured: !isURBanner(banner) && banner !== "standard" && rarity === "SSR" && h.id !== featured });
    }
    nextBanners[banner] = progress; s.banners = nextBanners; s.pity = nextBanners.standard.pity;
    s.gems -= cost; s.pulls += count; s.history = results.concat(s.history).slice(0, 30);
    event(s, "recruit", { count, banner, ssr: results.some(r => BY_ID[r.id].rarity === "SSR"), ur: results.some(r => BY_ID[r.id].rarity === "UR") });
    log(s, `${BANNERS[banner].name} · ${count}명의 지원서가 도착했습니다.`); return { kind: "recruit", results, cost, banner };
  }
  function action(s, input, now = Date.now(), rng = Math.random, options) { return withGearContext(s, options, () => actionCore(s, input, now, rng)); }
  const SHOP_ITEMS=Object.freeze([
    {id:'coins',name:'코인 주머니',price:100,limit:20,type:'gold'},
    {id:'daily-coins',name:'오늘의 코인 특가',price:60,regular:100,limit:1,type:'gold'},
    {id:'daily-key',name:'일일 던전 열쇠 재충전',price:200,limit:1,type:'daily'},
    {id:'weekly-key',name:'주간 던전 열쇠 재충전',price:1500,limit:1,type:'weekly'},
    {id:'winter-pack',name:'겨울 한정 코인 묶음',price:240,regular:300,limit:1,type:'gold',multiplier:3,endsAt:Date.UTC(2026,11,2,14,59,59,999)}
  ]);
  function shopInfo(s,now=Date.now()){
    const current=day(now),counts=s.shop?.day===current?s.shop.counts:{},activities=activityInfo(s,now);
    return SHOP_ITEMS.map(item=>{const remaining=Math.max(0,item.limit-(counts[item.id]||0)),gold=item.type==='gold'?(26000+s.best*650)*(item.multiplier||1):0;
      return {...item,gold,remaining,available:(!item.endsAt||now<=item.endsAt)&&remaining>0&&(item.type==='gold'||!s.activities?.run&&activities[item.type].keys<activities[item.type].cap)};});
  }
  function validShop(s){return s.shop===undefined||s.shop&&Number.isSafeInteger(s.shop.day)&&s.shop.day>=0&&s.shop.counts&&typeof s.shop.counts==='object'&&!Array.isArray(s.shop.counts)&&Object.entries(s.shop.counts).every(([id,n])=>SHOP_ITEMS.some(i=>i.id===id&&Number.isSafeInteger(n)&&n>=0&&n<=i.limit));}
  function actionCore(s, input, now, rng) {
    fail(input && typeof input === "object" && !Array.isArray(input), "잘못된 행동입니다.");
    const kind = input.kind;
    if(typeof kind==='string'&&kind.startsWith('santa-'))return globalThis.SchoolSantaRules.action(globalThis.SchoolRPG,s,input,now,rng);
    if(kind === 'onboarding') {
      fail(Number.isInteger(input.step) && input.step >= 0 && input.step <= 8, '안내 단계를 확인해 주세요.');
      if(input.step>=5)fail(!s.nameNeedsClaim && s.commanderName!=='새내기 단장', '단장 이름을 먼저 등록해 주세요.');
      // Tutorial progress never grants currency or pulls.
      s.onboarding = {version:1,step:Math.max(s.onboarding?.step || 0,input.step)};
      return {kind,step:s.onboarding.step};
    }
    if(['shard-refine','shard-select','shard-recycle'].includes(kind)){
      const w=shardInfo(s),count=input.count??1;
      fail(w.unlocked,'단장 Lv.20부터 조각 교환소가 열려요.');
      fail(Number.isSafeInteger(count)&&count>=1&&count<=100,'교환 수량은 1~100회로 선택해 주세요.');
      let source,cost,reward,rarity,hero;
      if(kind==='shard-refine'){
        source='SR';cost=count*50;reward=count*5;rarity='SSR';
        fail(w.SR>=cost,'공용 SR 조각이 부족해요.');fail(w.SSR+reward<=SHARD_LIMIT,'공용 조각 보유 한도입니다.');
      }else if(kind==='shard-select'){
        hero=input.hero;fail(SHARD_SSR.includes(hero),'상시·기간 제한 없는 픽업 SSR만 선택할 수 있어요.');fail(!!s.units[hero],'보유한 SSR 캐릭터만 교환할 수 있어요.');
        source='SSR';cost=count*10;reward=count*5;rarity='character';
        fail(w.SSR>=cost,'공용 SSR 조각이 부족해요.');
        fail(Number.isSafeInteger(s.units[hero].shards+reward),'캐릭터 조각 보유량을 확인해 주세요.');
      }else{
        hero=input.hero;const u=s.units[hero];rarity=BY_ID[hero]?.rarity;
        fail(u?.stars===5&&['SR','SSR'].includes(rarity),'풀각성 SR·SSR만 변환할 수 있어요.');
        source='character';cost=count*(rarity==='SSR'?20:10);reward=count*10;
        fail(u.shards>=cost,'변환할 캐릭터 조각이 부족해요.');fail(w[rarity]+reward<=SHARD_LIMIT,'공용 조각 보유 한도입니다.');
      }
      s.shardExchange||={SR:0,SSR:0};
      if(source==='character')s.units[hero].shards-=cost;else s.shardExchange[source]-=cost;
      if(rarity==='character')s.units[hero].shards+=reward;
      else s.shardExchange[rarity]+=reward;
      return {kind,hero,source,cost,rarity,reward,count};
    }
    if(kind==='shop-buy'){
      const item=shopInfo(s,now).find(i=>i.id===input.item);
      fail(item?.available,'구매 한도·판매 기간 또는 열쇠 보유량을 확인해 주세요.');fail(s.gems>=item.price,'보석이 부족해요.');
      fail(Number.isSafeInteger(s.gold+item.gold),'코인 보유 한도를 확인해 주세요.');
      if(item.type!=='gold')refreshActivities(s,now);
      s.gems-=item.price;s.gold+=item.gold;if(item.type!=='gold')s.activities[item.type].used--;
      if(s.shop?.day!==day(now))s.shop={day:day(now),counts:{}};s.shop.counts[item.id]=(s.shop.counts[item.id]||0)+1;
      return {kind,item:item.id,gold:item.gold,price:item.price};
    }
    if(kind==='bond-mission') {
      const id=input.hero??'osia';fail(Object.hasOwn(BOND_CHARACTERS,id),'인연 캐릭터를 확인하세요.');
      const m=bondInfo(s,now,id).missions.find(m=>m.id===input.mission);fail(m?.ready,'완료한 인연 임무와 오늘의 획득 한도를 확인하세요.');
      const b=bondState(s,id),xp=Math.min(m.xp,BOND_DAILY_LIMIT-b.daily.earned,650-b.xp);b.xp+=xp;b.daily.earned+=xp;b.daily.claimed.push(m.id);return {kind,xp};
    }
    if(kind==='bond-read') {
      const id=input.hero??'osia';fail(Object.hasOwn(BOND_CHARACTERS,id),'인연 캐릭터를 확인하세요.');
      const e=bondInfo(s,now,id).episodes.find(e=>e.id===input.episode);fail(e?.unlocked,'용병 육성 레벨·인연 레벨·이전 이야기를 확인하세요.');
      const b=bondState(s,id),fresh=!b.read.includes(e.id);if(fresh)b.read.push(e.id);return {kind,episode:e.id,fresh,reward:e.reward};
    }
    if(kind==='codex-claim'){
      const id=input.hero;
      fail(typeof id==='string'&&Object.hasOwn(BY_ID,id)&&!!s.units[id],'보유한 용병의 보상만 받을 수 있어요.');
      fail(!(s.codexClaimed||[]).includes(id),'이미 받은 도감 보상이에요.');
      fail(Number.isSafeInteger(s.gems+100),'보석 수량을 확인해 주세요.');
      (s.codexClaimed||=[]).push(id);s.gems+=100;
      return {kind,hero:id,gems:100};
    }
    if(kind==='pass-quest'||kind==='pass-reward')return passAction(s,input,now);
    if (kind === 'profile') {
      const current = profileInfo(s), avatar = input.avatar ?? current.avatar, title = input.title ?? current.title;
      fail(ownsProfileAvatar(s,avatar), '해금한 프로필 그림만 사용할 수 있어요.');
      fail(ownsProfileTitle(s,title), '해금한 칭호만 사용할 수 있어요.');
      s.profile = {...current, avatar, title}; return {kind, avatar, title};
    }
    if (kind === 'counter') return counterAttack(s,input,now);
    if (kind === "rename") {
      const name = normalizeCommanderName(input.name);
      fail(name !== null, "단장 이름은 문자·숫자·공백·_·-를 사용해 2~12자로 입력하세요.");
      const info = commanderNameInfo(s);
      fail(name !== s.commanderName, "이미 사용 중인 이름입니다.");
      fail(s.gems >= info.cost, "이름 변경에는 보석 3,000개가 필요합니다.");
      s.gems -= info.cost; s.commanderName = name; s.nameChanges = info.changes + 1;
      if (info.usesTicket) s.nameChangeTickets = info.tickets - 1;
      return { kind, name, cost: info.cost, ticketUsed: info.usesTicket };
    }
    if (kind === "winter-spin") return winterSpin(s,now,rng);
    if (kind === "winter-exchange") {
      fail(Number.isFinite(now) && now >= 0, "잘못된 시간입니다.");
      const info = winterInfo(s, now);
      fail(info.active, "겨울 이벤트 기간이 아닙니다.");
      fail(typeof input.item === "string" && Object.hasOwn(WINTER_EVENT.shop, input.item), "교환할 보상을 선택하세요.");
      const item = info.items.find(item => item.id === input.item);
      fail(item,"교환 상품이 변경됐어요. 새 상품을 선택해 주세요.");
      fail(item.remaining > 0, item.lifetime?"이미 만난 이벤트 용병입니다.":"오늘의 교환 횟수를 모두 사용했어요. 자정에 초기화됩니다.");
      fail(info.snowflakes >= item.cost, "눈송이가 부족합니다.");
      fail(Number.isSafeInteger(s.gold + item.gold) && Number.isSafeInteger(s.gems + item.gems) && (s.winter?.exchanges[item.id] || 0) < Number.MAX_SAFE_INTEGER, "보유 재화를 확인하세요.");
      if(item.hero&&!item.unlock)fail(Number.isSafeInteger((s.units[item.hero]?.shards||s.heroShards?.[item.hero]||0)+item.shards),"보유 조각을 확인하세요.");
      const w = refreshWinter(s, Math.max(s.at, now));
      w.snowflakes -= item.cost; w.exchanges[item.id]=(w.exchanges[item.id]||0)+1; w.daily.exchanges[item.id]=(w.daily.exchanges[item.id]||0)+1;
      s.gold += item.gold; s.gems += item.gems;
      if(item.unlock){s.units[item.hero]={level:1,xp:0,stars:0,shards:s.heroShards?.[item.hero]||0};if(s.heroShards)delete s.heroShards[item.hero];w.spicaClaimed=true;}
      else if(item.hero){if(s.units[item.hero])s.units[item.hero].shards+=item.shards;else{ s.heroShards ||= {};s.heroShards[item.hero]=(s.heroShards[item.hero]||0)+item.shards; }}
      event(s, "winter-exchange", { item: item.id, cost: item.cost, gold: item.gold, gems: item.gems });
      return { kind, item: item.id, cost: item.cost, gold: item.gold, gems: item.gems, remaining: item.remaining - 1, ...(item.hero?{hero:item.hero,shards:item.shards||0,...(item.unlock?{fresh:true}:{})}: {}) };
    }
    if (kind === "activity") {
      fail(Number.isFinite(now) && now >= 0, "잘못된 시간입니다.");
      fail(typeof input.mode === "string" && Object.hasOwn(DUNGEONS, input.mode), "도전할 던전을 선택하세요.");
      fail(!s.activities?.run || s.activities.run.settled, "진행 중인 던전을 마치거나 먼저 포기하세요.");
      const mode = input.mode, info = activityInfo(s, now);
      if (mode === "tower") {
        fail(Number.isInteger(input.floor) && input.floor >= 1 && input.floor <= Math.min(MAX_TOWER_FLOOR, info.tower.best + 1), "아직 열리지 않은 층입니다.");
      } else {
        fail(Number.isInteger(input.tier) && input.tier >= 1 && input.tier <= 5, "던전 단계를 선택하세요.");
        fail(info[mode].tiers[input.tier - 1].unlocked, "모험 지역을 더 클리어하면 열립니다.");
        fail(info[mode].keys > 0, "열쇠가 부족합니다. 다음 충전을 기다려 주세요.");
      }
      // Every check above precedes mutation, including key consumption.
      const a = refreshActivities(s, now);
      const run = { id: s.seq + 1, kind: mode, settled: false, ...(mode === "tower" ? { floor: input.floor } : { tier: input.tier, period: a[mode].period }) };
      if (mode !== "tower") a[mode].used++;
      a.run = run; a.lastResult = null; spawnActivity(s);
      event(s, "activity-start", { runId: run.id, ...s.battle.activity, kind: "activity-start", activityKind: mode }); log(s, `${DUNGEONS[mode].name} · ${mode === "tower" ? `${run.floor}층` : `${run.tier}단계`} 도전`);
      return { kind, run: clone(run) };
    }
    if (kind === "activity-exit") {
      fail(Number.isFinite(now) && now >= 0, "잘못된 시간입니다.");
      fail(s.activities?.run, "진행 중인 던전이 없습니다.");
      refreshActivities(s, now);
      if (!s.activities.run.settled) settleActivity(s, false, "exit");
      const result = clone(s.activities.lastResult); s.activities.run = null; spawn(s);
      return { kind, result };
    }
    if (kind === "speed") {
      fail(input.speed === 1 || input.speed === 1.5, "전투 속도는 1배 또는 1.5배를 선택하세요.");
      fail(Number.isFinite(now) && now >= 0, "잘못된 시간입니다.");
      advance(s, now);
      // Fractional real time before the toggle still belongs to the old speed.
      if (now > s.at) consumeRealTime(s, now - s.at);
      s.speed = input.speed;
      return { kind, speed: s.speed };
    }
    if (kind === 'skin-equip') {
      fail(!!s.units[input.hero] && !!BY_ID[input.hero], '보유한 용병을 선택하세요.');
      const skin=input.skin;
      fail(skin===null || typeof skin==='string'&&SKINS[skin]?.hero===input.hero&&ownsSkin(s,skin), '아직 획득하지 않은 스킨입니다.');
      s.skins ||= {};
      if(skin===null)delete s.skins[input.hero];else s.skins[input.hero]=skin;
      // Change only appearance; no spawn, stat refresh, timers or random rolls.
      const actor=s.battle?.heroes?.find(h=>h.id===input.hero);if(actor){if(skin===null)delete actor.skin;else actor.skin=skin;}
      return {kind,hero:input.hero,skin};
    }
    if (kind === "redeem") {
      fail(typeof input.code === "string" && input.code.length <= 128, "코드를 확인해 주세요.");
      const code = normalizeCouponCode(input.code);
      fail(code.length > 0, "코드를 입력하세요.");
      fail(/^[A-Z0-9_가-힣]{1,40}$/.test(code) && Object.hasOwn(COUPONS, code), "사용할 수 없는 코드입니다.");
      const coupon = COUPONS[code], redeemed = s.redeemedCodes || [];
      fail(!redeemed.includes(code), "이미 사용한 코드입니다.");
      fail(Number.isFinite(now) && now >= 0 && (coupon.expiresAt === null || now < coupon.expiresAt), "사용 기간이 지난 코드입니다.");
      if(coupon.nameChangeTickets)fail(Number.isSafeInteger((s.nameChangeTickets||0)+coupon.nameChangeTickets),'보유 변경권을 확인해 주세요.');
      // Client-supplied rewards and timestamps never participate in redemption.
      s.redeemedCodes = [...redeemed, code]; s.gold += coupon.gold; s.gems += coupon.gems;
      if(coupon.nameChangeTickets)s.nameChangeTickets=(s.nameChangeTickets||0)+coupon.nameChangeTickets;
      if(coupon.snowflakes){s.winter||=newWinter(now);s.winter.snowflakes+=coupon.snowflakes;s.winter.earned+=coupon.snowflakes;}
      const profileReward = PROFILE_REWARDS.find(p => p.id === coupon.avatar);
      log(s, profileReward ? `${profileReward.name} 프로필 해금` : coupon.nameChangeTickets ? `CODE ${code} · 닉네임 변경권 +${coupon.nameChangeTickets}` : `CODE ${code} · 보석 +${coupon.gems} · 골드 +${coupon.gold}${coupon.snowflakes?` · 눈송이 +${coupon.snowflakes}`:""}`);
      return { kind, code, gold: coupon.gold, gems: coupon.gems, ...(coupon.nameChangeTickets?{nameChangeTickets:coupon.nameChangeTickets}:{}), ...(coupon.snowflakes?{snowflakes:coupon.snowflakes}:{}), expiresAt: coupon.expiresAt, ...(profileReward ? {avatar:profileReward.id,avatarName:profileReward.name,displayCode:profileReward.code} : {}) };
    }
    if (kind === "weapon-recruit") return recruitWeapons(s,input.count,rng,input.banner,now);
    if (kind === "recruit") return recruit(s, input.count, rng, input.banner === undefined ? "standard" : input.banner, now, input.guaranteedHero);
    if (kind === "train") {
      const u = s.units[input.hero]; fail(u && BY_ID[input.hero], "보유한 용병을 선택하세요.");
      fail(input.count===undefined||input.count===1||input.count===10,'한 번 또는 10레벨 훈련을 선택하세요.');
      const quote=trainingQuote(u,input.count||1);fail(quote.levels>0,`현재 상한 Lv.${quote.cap}입니다. 각성하면 상한이 5레벨 증가해요.`);
      fail(s.gold>=quote.cost,'골드가 부족합니다. 표시된 전체 훈련 비용이 필요해요.');
      s.gold-=quote.cost;for(let i=0;i<quote.levels;i++)addUnitXp(s,input.hero,needXp(u.level)-u.xp);
      return {kind,hero:input.hero,level:u.level,count:quote.levels,cost:quote.cost,from:quote.from};
    }
    if (kind === "awaken") {
      const u = s.units[input.hero]; fail(u && BY_ID[input.hero], "보유한 용병을 선택하세요.");
      fail(u.stars < 5, "최대 각성입니다."); const cost = awakeningCost(u); fail(u.shards >= cost, "같은 용병의 조각이 부족합니다.");
      u.shards -= cost; u.stars++; event(s, "awaken", { id: input.hero, stars: u.stars }); return { kind, hero: input.hero, stars: u.stars };
    }
    if (["gear-equip", "gear-unequip", "gear-awaken"].includes(kind)) {
      fail(!s.activities?.run || s.activities.run.settled, "진행 중인 던전을 마친 뒤 장비를 변경하세요.");
      fail(input.stars === undefined && input.count === undefined, "장비 수량과 각성 단계는 직접 지정할 수 없습니다.");
      const gear = s.equipment || newEquipment();
      if (kind === "gear-awaken") {
        fail(typeof input.item === "string" && Object.hasOwn(GEAR_BY_ID, input.item) && Object.hasOwn(gear.inventory, input.item), "보유한 장비를 선택하세요.");
        const info = equipmentInfo(s).items.find(item => item.id === input.item);
        fail(info.stars < 5, "최대 각성 장비입니다."); fail(info.materials >= info.awakenCost, "사용하지 않는 동일 장비가 부족합니다.");
        const item = gear.inventory[input.item]; item.count -= info.awakenCost; item.stars++;
        event(s, "gear-awaken", { item: input.item, stars: item.stars, cost: info.awakenCost });
        return { kind, item: input.item, stars: item.stars, count: item.count, cost: info.awakenCost };
      }
      fail(typeof input.hero === "string" && Object.hasOwn(s.units, input.hero) && Object.hasOwn(BY_ID, input.hero), "보유한 용병을 선택하세요.");
      const current = gear.equipped[input.hero] || {};
      if (kind === "gear-equip") {
        fail(typeof input.item === "string" && Object.hasOwn(GEAR_BY_ID, input.item) && Object.hasOwn(gear.inventory, input.item), "보유한 장비를 선택하세요.");
        const info = equipmentInfo(s).items.find(item => item.id === input.item), slot = info.slot;
        fail(input.slot === undefined || input.slot === slot, "장비 종류에 맞는 칸을 선택하세요.");
        fail(current[slot] !== input.item, "이미 착용한 장비입니다."); fail(info.free >= 1, "모든 사본을 다른 용병이 착용 중입니다.");
        (gear.equipped[input.hero] ||= {})[slot] = input.item; s.equipment = gear;
        return { kind, hero: input.hero, item: input.item, slot };
      }
      fail(typeof input.slot === "string" && GEAR_SLOTS.includes(input.slot) && current[input.slot], "착용 중인 장비 칸을 선택하세요.");
      const item = current[input.slot]; delete current[input.slot]; if (!Object.keys(current).length) delete gear.equipped[input.hero];
      return { kind, hero: input.hero, item, slot: input.slot };
    }
    if (["preset-save", "preset-apply", "preset-delete", "preset-rename"].includes(kind)) {
      fail(Number.isInteger(input.slot) && input.slot >= 0 && input.slot < PRESET_NAMES.length, "편성 슬롯을 선택하세요.");
      const presets = presetInfo(s), preset = presets[input.slot];
      if (kind === "preset-apply") {
        fail(preset.saved && ownedTeam(s, preset.team), "저장된 편성의 용병을 확인하세요.");
        // Reuse the exact existing team-change rules, including dungeon locks
        // and a fresh campaign battle. Failed applies leave the save untouched.
        action(s, { kind: "team", team: preset.team }, now, rng);
      } else if (kind === "preset-save") {
        fail(ownedTeam(s, s.team), "현재 편성을 확인하세요.");
        presets[input.slot].team = [...s.team];
      } else if (kind === "preset-delete") {
        fail(preset.saved, "비어 있는 편성입니다."); presets[input.slot].team = [];
      } else {
        const name = normalizePresetName(input.name);
        fail(name !== null, "편성 이름은 문자·숫자·공백·_·-로 1~12자를 입력하세요.");
        fail(name !== preset.name, "이미 같은 편성 이름입니다."); presets[input.slot].name = name;
      }
      if (kind !== "preset-apply") s.presets = presets.map(p => ({ name: p.name, team: [...p.team] }));
      const result = presetInfo(s)[input.slot];
      return { kind, slot: input.slot, name: result.name, team: result.team };
    }
    if (kind === "team") {
      fail(!s.activities?.run || s.activities.run.settled, "진행 중인 던전을 마치거나 먼저 포기하세요.");
      fail(Array.isArray(input.team) && input.team.length >= 1 && input.team.length <= MAX_TEAM && new Set(input.team).size === input.team.length && input.team.every(id => typeof id === "string" && BY_ID[id] && Object.hasOwn(s.units, id)), "보유한 서로 다른 용병 1~6명을 편성하세요.");
      fail(input.team.length !== s.team.length || input.team.some((id, i) => s.team[i] !== id), "이미 같은 편성입니다.");
      if (s.activities?.run?.settled) s.activities.run = null;
      s.team = [...input.team]; spawn(s); log(s, "새로운 편성으로 전투를 시작합니다."); return { kind };
    }
    if (kind === "stage") {
      fail(!s.activities?.run || s.activities.run.settled, "진행 중인 던전을 마치거나 먼저 포기하세요.");
      fail(Number.isInteger(input.stage) && input.stage >= 1 && input.stage <= Math.min(MAX_STAGE, s.best + 1), "아직 열리지 않은 지역입니다.");
      fail(["progress", "farm"].includes(input.mode), "도전 또는 반복을 선택하세요.");
      if (s.activities?.run?.settled) s.activities.run = null;
      s.stage = input.stage; s.wave = 1; s.mode = input.mode; s.losses = 0; spawn(s); return { kind };
    }
    if (kind === "offline") {
      fail(s.offline.seconds > 0, "이미 보상을 받았습니다."); const reward = { ...s.offline };
      const earnedCaptainXp = Math.floor(reward.captainXp ?? reward.xp / 4);
      s.offline = { seconds: 0, gold: 0, xp: 0, captainXp: 0 }; s.gold += reward.gold;
      for (const id of s.team) addUnitXp(s, id, reward.xp); captainXp(s, earnedCaptainXp);
      log(s, `방치 보상 골드 +${reward.gold} · 용병 경험치 +${reward.xp}`); return { kind, reward };
    }
    if (kind === "daily") {
      const today = day(now); fail(s.daily < today, "오늘의 보급은 이미 받았습니다.");
      const reward=rewardBonus({gold:earnedGold(250),gems:150},Math.max(s.at,now));
      s.daily = today; s.gold += reward.gold; s.gems += reward.gems; return { kind, ...reward };
    }
    if (kind === "quest" || kind === "quest-all") {
      fail(Number.isFinite(now) && now >= 0, "잘못된 시간입니다.");
      const board = questBoard(s, Math.max(s.at, now));
      const selected = kind === "quest-all" ? board.items.filter(q => q.ready) : board.items.filter(q => q.id === input.quest && q.ready);
      fail(selected.length > 0, "달성한 임무 보상을 선택하세요.");
      const gold = selected.reduce((sum, q) => sum + q.gold * q.cycles, 0), gems = selected.reduce((sum, q) => sum + q.gems * q.cycles, 0);
      fail(Number.isSafeInteger(s.gold + gold) && Number.isSafeInteger(s.gems + gems), "보유 재화를 확인하세요.");
      const store = refreshQuestState(s, Math.max(s.at, now));
      for (const q of selected) {
        if (q.category === "repeat") store.repeat[q.metric] -= q.goal * q.cycles;
        else if (q.category === "daily") store.daily.claimed.push(q.id);
        else s.claimed.push(q.id);
      }
      s.gold += gold; s.gems += gems;
      return { kind, gold, gems, claimed: selected.map(q => q.id), cycles: selected.reduce((n, q) => n + q.cycles, 0) };
    }
    throw Error("지원하지 않는 행동입니다.");
  }
  const FARMING_ANALYSIS = Object.freeze({ seconds: 180, seeds: Object.freeze([0x8d12a7b3, 0x41c6ce57, 0xe7139a2d]), minSuccessfulSeeds: 3 });
  function farmingCandidates(s) {
    const top = Math.max(1, Math.min(MAX_STAGE, s.best));
    return Array.from({length:top},(_,i)=>i+1);
  }
  function farmingFingerprint(s) {
    const gear = snapshotEquipment(s);
    return JSON.stringify([CATALOG_VERSION, eventInfo(s.at).multiplier, s.best, s.stage, s.speed || 1, s.team.map(id => [id, s.units[id].level, s.units[id].stars]), ...(Object.keys(gear.equipped).length ? [gear] : [])]);
  }
  // CPU-heavy analysis belongs in farming-worker.js, never the render loop.
  // Every run starts at wave one on a detached save; current investment is held
  // fixed, and only normal combat reward events contribute to the estimate.
  function simulateFarmingStage(source, stage) {
    fail(validate(source), "분석할 편성 정보를 확인하세요.");
    fail(farmingCandidates(source).includes(stage), "보상이 적용되는 열린 지역만 분석할 수 있습니다.");
    let totalGold = 0, totalXp = 0, clears = 0, losses = 0, successfulSeeds = 0, clearTime = 0;const seedGold=[];
    for (const seed of FARMING_ANALYSIS.seeds) {
      const s = clone(source), levels = Object.fromEntries(s.team.map(id => [id, s.units[id].level]));
      s.at = WINTER_EVENT.startsAt; s.seed = seed; s.simTime = 0; s.simCredit = 0; s.seq = 0; s.events = []; s.logs = []; s.receipts = []; s.history = [];
      s.captain = { level: CAPTAIN_MAX_LEVEL, xp: 0 }; s.activities = newActivities(s.at); s.offline = { seconds: 0, gold: 0, xp: 0, captainXp: 0 };
      for (const id of s.team) { s.units[id].xp = 0; if (id === "osia" || id === "lava" || id === "ryusion") s.units[id].nextSkill = 1; if (id === "lava") s.units[id].basicHits = 0; }
      action(s, { kind: "stage", stage, mode: "farm" }, s.at);
      let trialClears = 0, trialLosses = 0, previousClear = 0, trialGold=0;
      for (let elapsed = STEP_MS; elapsed <= FARMING_ANALYSIS.seconds * 1000; elapsed += STEP_MS) {
        const seq = s.seq; advance(s, s.at + STEP_MS);
        for (const e of s.events) if (e.seq > seq) {
          if (e.kind === "reward") {
            totalGold += e.gold; trialGold+=e.gold; totalXp += e.xp;
            if (e.boss) { clears++; trialClears++; clearTime += elapsed - previousClear; previousClear = elapsed; }
          } else if (e.kind === "defeat") { losses++; trialLosses++; }
        }
        // Training, awakening, level-up grants, quest claims and event exchanges
        // are not simulated. Earned unit XP cannot inflate a current-team estimate.
        for (const id of s.team) { s.units[id].level = levels[id]; s.units[id].xp = 0; }
        // A failed trial is deliberately conservative: remaining time contributes
        // no income, instead of silently farming a different fallback stage.
        if (trialLosses) break;
      }
      seedGold.push(Math.floor(trialGold/(FARMING_ANALYSIS.seconds/60)));
      if (trialClears > 0 && trialLosses === 0) successfulSeeds++;
    }
    const totalSeeds = FARMING_ANALYSIS.seeds.length, minutes = totalSeeds * FARMING_ANALYSIS.seconds / 60;
    return { stage, name: stageName(stage), goldPerMinute: Math.round(totalGold / minutes), xpPerMinute: Math.round(totalXp / minutes), clears, losses,
      successfulSeeds, totalSeeds, successRate: successfulSeeds / totalSeeds, minGoldPerMinute:Math.min(...seedGold), maxGoldPerMinute:Math.max(...seedGold), stable: successfulSeeds >= FARMING_ANALYSIS.minSuccessfulSeeds,
      meanClearSeconds: clears ? Math.round(clearTime / clears / 100) / 10 : null };
  }
  function farmingRecommendations(s, candidates) {
    const baseline=candidates.find(r=>r.stage===s.stage)||null;
    const ranked = [...candidates].filter(r => r.stable&&r.losses===0).sort((a,b)=>b.goldPerMinute-a.goldPerMinute||b.minGoldPerMinute-a.minGoldPerMinute||Number(b.stage===s.stage)-Number(a.stage===s.stage)||a.stage-b.stage);
    // Switching for noise-sized gains costs a partially completed wave. Keep a
    // safe current region when its estimate is within 5% of the best result.
    const keepCurrent=baseline?.stable&&ranked[0]&&ranked[0].goldPerMinute<=baseline.goldPerMinute*1.05;
    const filtered=ranked.filter(r=>!baseline?.stable||r.stage===s.stage||r.goldPerMinute>baseline.goldPerMinute*1.05);
    if(keepCurrent){filtered.splice(0,filtered.length,baseline);}
    return {fingerprint:farmingFingerprint(s),recommendations:filtered.slice(0,3),candidates:[...candidates],baseline,keepCurrent:!!keepCurrent,
      seconds:FARMING_ANALYSIS.seconds,seeds:FARMING_ANALYSIS.seeds.length,basis:'combat-gold-only',reason:filtered.length?'ok':'train'};
  }
  function view(s) { const result = clone(s); delete result.receipts; return result; }
  function power(s) { return s.team.reduce((sum, id) => { const st = stats(id, s.units[id], s); return sum + st.atk * 5 + Math.round(st.hp / 4); }, 0); }
  return { RUDES_RULES,rudesInit,validRudes,rudesStep,expireRudesShield,absorbRudesShield,YAHO_RULES,yahoInit,validYaho,yahoMasterMultiplier,yahoDamageMultiplier,yahoProtectionMultiplier,yahoBasic,yahoCast,yahoStep,passInfo,PASS_QUESTS,PASS_MAX_LEVEL,passReward,bondMeta,visualChapter,levelCap,trainingQuote,NORMAL_MAX_STAGE,SKINS,ownsSkin,equippedSkin,snapshotSkins,isURBanner,HYEOKJIN_RULES,HYEOKJIN_MOVES,hyeokjinInit,hyeokjinAwake,hyeokjinRefresh,hyeokjinGuard,hyeokjinRecord,hyeokjinStep,validHyeokjin, OSIA_BREATH_RULES, OSIA_WEAPON_RULES,osiaDivine,osiaSkillMultiplier,osiaBasicMultiplier,osiaSkillName,osiaWeaponStep,validOsiaWeapon, DOUBLE_REWARD_EVENT,eventInfo,rewardBonus,offlineRewardSeconds,KAZUA_RULES,kazuaStep,kazuaPower,kazuaInfo,validKazua,lowAggroTarget,canonicalBanner, BOND_CHARACTERS,BOND_DAILY_LIMIT,SHARD_SSR,BOND_LEVELS,BOND_EPISODES,BOND_MISSIONS,bondInfo,ownsProfileTitle, SHARD_LIMIT,shardInfo,TOWER_THEMES,towerEncounter,damageType, SHOP_ITEMS,shopInfo, SPICA_RULES,basicAttackRate,ryusionDefense,WINTER_ROULETTE,GOLD_MULTIPLIER, earnedGold, PROFILE_AVATARS, PROFILE_REWARDS, ownsProfileAvatar, normalizeCouponCode, publicProfile, profileInfo, RYUSION_RULES, RYUSION_SKILLS, ryusionSkill, ryusionGuard, expireEarthShield, addEarthShield, absorbEarthShield, COUNTER_RULES, counterInfo, weaponPassive,exclusivePassive,weaponRates,weaponBannerState,weaponAvailable,WEAPON_BANNERS,WEAPON_COST,SSR_RECRUIT_COST,recruitCost,HEROES, BY_ID, GEAR, GEAR_BY_ID, GEAR_SLOTS, GEAR_AWAKEN_COST, GEAR_MAX_COUNT, gearBonus, equipmentBonus, equipmentInfo, equipmentDropInfo, snapshotEquipment, CHAPTER_TRAITS, PRESET_NAMES, presetInfo, normalizePresetName, FARMING_ANALYSIS, farmingCandidates, farmingFingerprint, simulateFarmingStage, farmingRecommendations, CHAPTERS, ENEMIES, ENEMY_VARIANTS, BOSSES, QUESTS, PROGRESS_QUESTS, EXTRA_QUESTS, QUEST_CLAIM_LIMIT, questBoard, questReady, captainReward, MAX_STAGE, MAX_LEVEL, CAPTAIN_MAX_LEVEL, MAX_TEAM, MAX_TOWER_FLOOR, OFFLINE_CAP, CATALOG_VERSION, DUNGEONS, BOSS_RULES, PROGRESSION, CAMPAIGN_REWARDS, campaignRewardInfo, CRITICAL, PARTY_SYNERGIES, WINTER_EVENT, winterInfo, partySynergies, damageReport, commanderNameInfo, normalizeCommanderName, activityInfo, activityReward, campaignScale, OSIA_SKILLS, OSIA_CINEMATIC_MS, osiaSkill, LAVA_SKILLS, lavaSkill, HORAS_RULES, horasInfo, UR_RECRUIT_RATES, RECRUIT_COST, RECRUIT_RATES, RECRUIT_PITY, COUPONS, BANNERS, STANDARD_SSR, bannerState, bannerAvailable, bannerHeroRates, recruitRates, create, validate, advance, action, stats, stageName, chapter, rates, questValue, needXp, captainNeed, trainingCost, awakeningCost, power, day, week, clone, view };
});
