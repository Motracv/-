// Server-only deterministic friendly PvP. No client combat state is accepted.
export function simulateArena(game, saves, names, seed) {
  let randomSeed = seed >>> 0 || 1;
  const random = () => { let x = randomSeed | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; randomSeed = x >>> 0; return randomSeed / 4294967296; };
  const synergy = saves.map(s => game.partySynergies?.(s) || { damageMultiplier:1, healMultiplier:1, incomingMultiplier:1 });
  const teams = saves.map((s,side) => ({ name:names[side], units:s.team.slice(0,6).map(id => {
    const unit = s.units[id], def = game.BY_ID[id], st = game.stats(id,unit,s);
    // PvP vitality gives healers, shields and Osia's complete cycle time to act.
    return { id,name:def.name,role:def.role,level:unit.level,stars:unit.stars,max:st.hp*3,hp:st.hp*3,atk:st.atk,defense:st.defense,shield:0 };
  }) }));
  // Replays retain only gear worn by this formation. Unused inventory,
  // duplicate stacks and campaign currency never enter a public replay.
  for (let side=0;side<saves.length;side++) {
    const equipment=game.snapshotEquipment?.(saves[side],saves[side].team);
    if(equipment&&Object.keys(equipment.equipped).length)teams[side].equipment=equipment;
  }
  const sides = teams.map((team,side) => team.units.map(u => ({...u,...(game.exclusivePassive?.(saves[side],u.id)?{exclusive:game.exclusivePassive(saves[side],u.id)}:{}),energy:0,stage:1,hits:0,stunUntil:0,protectedUntil:0})));
  const H = game.HORAS_RULES, R=game.RYUSION_RULES, tactical=sides.some(team=>team.some(u=>u.id==='spica'));
  const defense=hero=>game.ryusionDefense?.(hero)||R;
  const basicRate=unit=>game.basicAttackRate?.(unit,t)||1;
  const nextBasic=(previous,interval,unit)=>(previous>0&&previous>t-500?previous:t)+interval/basicRate(unit);
  const guard=side=>game.ryusionGuard?.(sides[side],t)||{hero:null,taunting:false};
  const redirect=(side,target)=>guard(1-side).taunting?guard(1-side).hero:target;
  // A PvP-only adjustment keeps stack generation and the 1.5x stun combo
  // intact without letting PvE ritual bursts dominate a six-unit duel.
  const horasDamageMultiplier = .78;
  const horas = sides.map(units => units.some(u=>u.id==='horas') ? {stacks:0,nextBasicAt:H.basicMs,basicPose:1,lastHitStackAt:-H.hitStackMs,lastCastAt:-H.minCastMs,cast:null} : null);
  const damage = sides.map(units => units.map(u=>({id:u.id,damage:0,healing:0,taken:0,criticals:0})));
  const meter = (side,id) => damage[side].find(u=>u.id===id);
  const events = []; let t=0; const rescued=[false,false], buffUntil=[0,0];
  const alive = side => sides[side].filter(u=>u.hp>0);
  const weakest = side => alive(side).sort((a,b)=>a.hp/a.max-b.hp/b.max)[0];
  const emit = (kind,side,from,targetSide,target,amount,extra={}) => events.push({t,kind,side,from,toSide:targetSide,target:target.id,amount,hp:target.hp,shield:target.shield,...extra});
  function shield(side,from,target,raw,skill) { const amount=Math.max(0,Math.min(Math.round(raw*(from==='lava'?1+(sides[side].find(u=>u.id===from)?.exclusive?.strength||0):1)),Math.floor(target.max*.6)-target.shield));target.shield+=amount;emit('shield',side,from,side,target,amount,{skill}); }
  function heal(side,from,target,raw,skill) { const caster=sides[side].find(u=>u.id===from),bonus=from==='lava'?caster?.exclusive?.strength||0:0,healing=Math.round(raw*synergy[side].healMultiplier*.75*(1+bonus)),amount=Math.min(target.max-target.hp,healing);target.hp+=amount;meter(side,from).healing+=amount;emit('heal',side,from,side,target,amount,{skill});if(bonus&&skill==='바람의 상처'&&healing>amount)shield(side,from,target,Math.min(caster.atk*.4,(healing-amount)*.15)/(1+bonus),'풍령의 가호'); }
  function addHorasStack(side,amount,source,target) {
    const hero=alive(side).find(u=>u.id==='horas'), progress=horas[side];
    if(!hero||!progress)return 0;
    const before=progress.stacks;progress.stacks=Math.min(H.maxStacks,before+amount);const gained=progress.stacks-before;
    if(gained)emit('horas-stack',side,'horas',side,hero,gained,{stacks:progress.stacks,source,sourceTarget:target?.id});
    return gained;
  }
  function hit(side,from,target,raw,skill,stage,detail={}) {
    const original=target;target=redirect(side,target);
    if(target.hp<=0)return 0;
    if(target.id==='kazua'&&random()<game.KAZUA_RULES.evasion){target.evadedAt=t;emit('dodge',1-side,'kazua',1-side,target,0);return 0;}
    if(target.id==='kazua')target.evadedAt=-1;
    const enemySide=1-side, crit=typeof detail.critical==='boolean'?detail.critical:random()<.12;
    const power=detail.snapshot?raw:raw*(.9+random()*.2)*(crit?1.5:1);
    const stunBonus=from==='horas'&&target.stunUntil>t;
    let value=Math.max(1,Math.round(power*(stunBonus?H.stunMultiplier:1)*(1-target.defense)*synergy[enemySide].incomingMultiplier*(guard(enemySide).hero?1-R.teamReduction:1)*(guard(enemySide).taunting&&target.id==='ryusion'?1-defense(guard(enemySide).hero).tauntReduction:1)));
    const absorbed=Math.min(target.shield,value);target.shield-=absorbed;value-=absorbed;game.absorbEarthShield?.(target,absorbed);
    if(value>=target.hp&&!rescued[enemySide]&&alive(enemySide).some(u=>u.id==='lava')){
      rescued[enemySide]=true;target.protectedUntil=t+2000;
      emit('shield',enemySide,'lava',enemySide,target,0,{skill:'긴급생존',protectedUntil:target.protectedUntil});
    }
    if(target.protectedUntil>t)value=Math.min(value,Math.max(0,target.hp-1));
    const amount=Math.min(target.hp,value);target.hp-=amount;meter(side,from).damage+=amount;meter(enemySide,target.id).taken+=amount;if(crit&&amount>0)meter(side,from).criticals++;
    emit(skill?'skill':'attack',side,from,enemySide,target,amount,{crit:crit&&amount>0,absorbed,...(target!==original?{redirectedFrom:original.id}:{}),...(skill?{skill}:{}),...(stage?{stage}:{}),...(stunBonus?{stunBonus:true}:{}),...(detail.castId?{castId:detail.castId,primary:detail.primary}:{})});
    if(target.id==='horas'&&target.hp>0&&t>=horas[enemySide].lastHitStackAt+H.hitStackMs){horas[enemySide].lastHitStackAt=t;addHorasStack(enemySide,1,'hit',sides[side].find(u=>u.id===from));}
    if(target.hp<=0){
      emit('down',side,from,enemySide,target,0);
      if(target.horasMark&&target.horasMark.until>t){
        delete target.horasMark;const gained=addHorasStack(side,H.refundStacks,'mark',target);
        if(gained)emit('horas-refund',side,'horas',enemySide,target,gained,{stacks:horas[side].stacks});
      }
    }
    return amount;
  }
  function horasAct(side,unit,attack) {
    const progress=horas[side],enemies=alive(1-side);
    if(progress.cast)return;
    if(progress.stacks>=H.maxStacks&&t>=progress.lastCastAt+H.minCastMs){
      progress.stacks=0;progress.lastCastAt=t;progress.nextBasicAt=t+H.impactDelay+H.basicMs;
      // Choose a living target with the most living adjacent slots. Ties keep
      // formation order; this remains one main target plus weaker neighbours.
      const formation=sides[1-side],nearby=candidate=>enemies.filter(enemy=>Math.abs(formation.indexOf(enemy)-formation.indexOf(candidate))<=1).length;
      const target=enemies.reduce((best,candidate)=>nearby(candidate)>nearby(best)?candidate:best,enemies[0]),missed=random()<H.missChance;
      progress.cast={id:events.length+1,began:t,targetId:target.id,missed,mergeMs:H.mergeMs,impactDelay:H.impactDelay,targets:enemies.map(enemy=>{
        const critical=random()<.12,power=attack*(.9+random()*.2)*(critical?1.5:1);
        return{id:enemy.id,critical,amount:Math.round(power*H.primaryMultiplier),splashAmount:Math.round(power*H.splashMultiplier)};
      })};
      emit('horas-cast',side,'horas',1-side,target,0,{castId:progress.cast.id,stacks:0,skill:'벚꽃의식',targetId:target.id,mergeMs:H.mergeMs,impactDelay:H.impactDelay,targets:[target.id]});return;
    }
    if(t<progress.nextBasicAt)return;
    progress.nextBasicAt=tactical?nextBasic(progress.nextBasicAt,H.basicMs,unit):t+H.basicMs;const target=enemies[0],pose=progress.basicPose;progress.basicPose=pose===1?2:1;
    emit('horas-basic',side,'horas',1-side,target,0,{pose,duration:H.basicMotionMs});
    hit(side,'horas',target,attack*H.basicMultiplier,null);addHorasStack(side,1,'basic',target);
  }
  function horasStep(side) {
    const progress=horas[side];if(!progress)return;
    const enemies=sides[1-side];for(const enemy of enemies)if(enemy.horasMark&&enemy.horasMark.until<=t)delete enemy.horasMark;
    const cast=progress.cast;if(!cast)return;
    if(!alive(side).some(u=>u.id==='horas')){progress.cast=null;return;}
    if(t<cast.began+cast.impactDelay)return;
    progress.cast=null;
    const originalIndex=enemies.findIndex(u=>u.id===cast.targetId),candidates=enemies.filter(u=>u.hp>0&&cast.targets.some(target=>target.id===u.id));
    const target=candidates.find(u=>u.id===cast.targetId)||candidates.reduce((best,u)=>!best||Math.abs(enemies.indexOf(u)-originalIndex)<Math.abs(enemies.indexOf(best)-originalIndex)?u:best,null);
    if(!target)return;
    const index=enemies.indexOf(target),victims=candidates.filter(u=>u===target||Math.abs(enemies.indexOf(u)-index)<=1);
    emit('horas-impact',side,'horas',1-side,target,0,{castId:cast.id,targetId:target.id,missed:cast.missed,targets:cast.missed?[]:victims.map(u=>u.id),skill:'벚꽃의식'});
    if(cast.missed){emit('miss',side,'horas',1-side,target,0,{castId:cast.id});return;}
    for(const enemy of enemies)delete enemy.horasMark;
    const marked=redirect(side,target);
    marked.horasMark={until:t+H.markMs+(alive(side).find(u=>u.id==='horas')?.exclusive?2000:0),castId:cast.id};
    emit('horas-mark',side,'horas',1-side,marked,0,{until:marked.horasMark.until,castId:cast.id});
    for(const enemy of[target,...victims.filter(u=>u!==target)]){
      const saved=cast.targets.find(u=>u.id===enemy.id),primary=enemy===target;
      hit(side,'horas',enemy,primary?saved.amount:saved.splashAmount,'벚꽃의식',null,{snapshot:true,critical:saved.critical,castId:cast.id,primary});
    }
  }
  function ryusionStep(side){
    const g=guard(side);
    for(const hero of sides[side])if(game.expireEarthShield?.(hero,t))emit('shield-expire',side,'ryusion',side,hero,0);
    if(g.taunting){const began=t-t%R.tauntEvery;if(g.hero.lastTauntAt!==began){g.hero.lastTauntAt=began;const ratio=defense(g.hero).tauntShieldRatio||0;if(ratio){const amount=game.addEarthShield(g.hero,Math.max(g.hero.earthShield||0,g.hero.max/3*ratio),t);emit('shield',side,'ryusion',side,g.hero,amount,{skill:'대지의 맹세'});}emit('ryusion-taunt',side,'ryusion',side,g.hero,0,{until:began+R.tauntMs});}}
    const hero=sides[side].find(h=>h.id==='ryusion'),cast=hero?.earthCast;if(!cast)return;
    if(hero.hp<=0){delete hero.earthCast;return;}
    if(t<cast.began+R.impactDelay)return;delete hero.earthCast;
    if(cast.stage===1){const target=alive(1-side).find(h=>h.id===cast.targetId)||alive(1-side)[0];if(!target)return;const victim=redirect(side,target);
      hit(side,hero.id,target,cast.power,'돌격 앞으로',1,{snapshot:true,critical:false});
      if(victim.hp>0&&victim.evadedAt!==t){victim.stunUntil=Math.max(victim.stunUntil,t+R.stunMs);emit('stun',side,hero.id,1-side,victim,0,{skill:'돌격 앞으로',duration:R.stunMs});}
    }else for(const target of alive(side)){const amount=game.addEarthShield(target,hero.max/3*defense(hero).shieldRatio,t);emit('shield',side,hero.id,side,target,amount,{skill:'방어막 추가',stage:2,earthShield:amount,earthShieldUntil:target.earthShieldUntil});}
  }
  function act(side,unit) {
    if(unit.id==='kazua'||unit.hp<=0||unit.stunUntil>t||!alive(1-side).length)return;
    const attack=unit.atk*synergy[side].damageMultiplier*(buffUntil[side]>t?1.3:1)*(t>=45000?1+(t-45000)/15000:1);
    if(unit.id==='horas'){horasAct(side,unit,attack*horasDamageMultiplier*(1+(unit.exclusive?.strength||0)));return;}
    const def=game.BY_ID[unit.id];
    if(!tactical||t>=(unit.nextEnergyAt||1000)){unit.energy++;unit.nextEnergyAt=t+1000;}
    const skill=unit.energy>=def.cooldown;
    if(tactical&&!skill&&t<(unit.nextBasicAt||1000))return;
    if(tactical)unit.nextBasicAt=skill?Math.max(unit.nextBasicAt||t,t)+1000/basicRate(unit):nextBasic(unit.nextBasicAt||1000,1000,unit);
    if(skill)unit.energy=0;
    if(skill&&unit.id==='ryusion'){
      unit.earthCast={began:t,stage:unit.stage,targetId:alive(1-side)[0].id,power:attack};
      emit('ryusion-skill',side,unit.id,unit.stage===1?1-side:side,unit.stage===1?alive(1-side)[0]:unit,0,{stage:unit.stage,skill:game.RYUSION_SKILLS[unit.stage-1].name});unit.stage=unit.stage===1?2:1;return;
    }
    if(skill&&unit.id==='spica'){
      const p=game.SPICA_RULES;for(const ally of alive(side))ally.hasteUntil=Math.max(ally.hasteUntil||0,t+p.hasteMs);
      for(const target of alive(1-side)){target.slowUntil=Math.max(target.slowUntil||0,t+p.slowMs);hit(side,unit.id,target,attack*p.skillMultiplier,def.skill);}
      emit('spica-wind',side,unit.id,side,unit,0,{skill:def.skill,hasteUntil:t+p.hasteMs,slowUntil:t+p.slowMs});return;
    }
    if(skill&&unit.id==='lava'){
      if(unit.stage===1)for(const target of alive(side)){heal(side,unit.id,target,unit.atk*1.6,'바람의 부채');shield(side,unit.id,target,unit.atk*.9,'바람의 부채');}
      else heal(side,unit.id,weakest(side),unit.atk*4.5,'바람의 상처');
      unit.stage=unit.stage===1?2:1;return;
    }
    if(skill&&unit.role==='치유'){for(const target of alive(side))heal(side,unit.id,target,unit.atk*2.2,def.skill);return;}
    if(skill&&unit.role==='수호')shield(side,unit.id,unit,unit.max/3*.25,def.skill);
    if(skill&&unit.role==='지원'){buffUntil[side]=t+3000;emit('shield',side,unit.id,side,unit,0,{skill:def.skill});}
    if(skill&&unit.id==='osia'){
      const stage=unit.stage, name=game.OSIA_SKILLS[stage-1].name;
      for(const target of alive(1-side)){const victim=redirect(side,target);hit(side,unit.id,target,attack*2.2*(1+(unit.exclusive?.skill||0)),name,stage);if(stage===4&&victim.hp>0&&victim.evadedAt!==t){victim.stunUntil=t+1500;emit('stun',side,unit.id,1-side,victim,0,{skill:name,duration:1500});}}
      if(stage===4&&unit.exclusive)shield(side,unit.id,unit,unit.atk*.2,'용왕의 해류');
      unit.stage=stage%4+1;return;
    }
    const targets=skill&&unit.role==='마법'?alive(1-side):[skill&&unit.role==='사수'?alive(1-side).sort((a,b)=>a.hp-b.hp)[0]:game.lowAggroTarget(alive(1-side)[0],alive(1-side),random)];
    const multiplier=skill?(unit.role==='마법'?1.7:unit.role==='사수'?2.6:['수호','지원'].includes(unit.role)?1:3):1;
    let dealt=0;for(const target of targets)dealt+=hit(side,unit.id,target,attack*multiplier,skill?def.skill:null);
    if(unit.id==='lava'&&dealt>0&&++unit.hits%10===0){const target=weakest(side);if(target)shield(side,unit.id,target,unit.atk*2+target.max/3*.08,'신내림');}
  }
  // Side initiative alternates each second; the initial side comes from the
  // committed seed, so challengers do not always receive the first strike.
  const initial=random()<.5?0:1;
  for(t=500;t<=90000&&alive(0).length&&alive(1).length;t+=500){
    const first=(Math.floor(t/1000)+initial)%2;
    ryusionStep(first);ryusionStep(1-first);
    horasStep(first);horasStep(1-first);
    for(const side of[first,1-first]){const u=sides[side].find(u=>u.id==='kazua');if(u&&alive(1-side).length)game.kazuaStep(u,sides[side],sides[1-side],t,500,(target,mult,d)=>hit(side,u.id,target,u.atk*mult*synergy[side].damageMultiplier*(buffUntil[side]>t?1.3:1)*(t>=45000?1+(t-45000)/15000:1),d.skill),(kind,extra)=>emit(kind,side,u.id,side,u,0,extra),u.stunUntil>t,basicRate(u));}
    if((!tactical&&t%1000)||!alive(0).length||!alive(1).length)continue;
    for(let index=0;index<6;index++){for(const side of[first,1-first])if(sides[side][index])act(side,sides[side][index]);}
  }
  const ratios=sides.map(team=>team.reduce((sum,u)=>sum+u.hp/u.max,0)/Math.max(1,team.length));
  const winner=!alive(0).length&&!alive(1).length?-1:!alive(0).length?1:!alive(1).length?0:Math.abs(ratios[0]-ratios[1])<.0001?-1:ratios[0]>ratios[1]?0:1;
  return {seed,teams,events,damage,winner,durationMs:Math.min(90000,t-500),final:sides.map(team=>team.map(({id,hp,shield})=>({id,hp,shield}))),rules:{maxSeconds:90,vitality:3,healing:.75,shieldHealth:'original',overtimeAt:45,tiebreak:'remaining-health-ratio',rewards:false,...(horas.some(Boolean)?{horasDamageMultiplier}: {})}};
}
