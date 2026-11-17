// Server-only deterministic friendly PvP. No client combat state is accepted.
export function simulateArena(game, saves, names, seed) {
  let randomSeed = seed >>> 0 || 1;
  const random = () => { let x = randomSeed | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; randomSeed = x >>> 0; return randomSeed / 4294967296; };
  const synergy = saves.map(s => game.partySynergies?.(s) || { damageMultiplier:1, healMultiplier:1, incomingMultiplier:1 });
  const teams = saves.map((s,side) => ({ name:names[side], units:s.team.slice(0,6).map(id => {
    const unit = s.units[id], def = game.BY_ID[id], st = game.stats(id,unit);
    // PvP vitality gives healers, shields and Osia's complete cycle time to act.
    return { id,name:def.name,role:def.role,level:unit.level,stars:unit.stars,max:st.hp*3,hp:st.hp*3,atk:st.atk,defense:st.defense,shield:0 };
  }) }));
  const sides = teams.map(team => team.units.map(u => ({...u,energy:0,stage:1,hits:0,stunUntil:0,protectedUntil:0})));
  const damage = sides.map(units => units.map(u=>({id:u.id,damage:0,healing:0,taken:0,criticals:0})));
  const meter = (side,id) => damage[side].find(u=>u.id===id);
  const events = []; let t=0; const rescued=[false,false], buffUntil=[0,0];
  const alive = side => sides[side].filter(u=>u.hp>0);
  const weakest = side => alive(side).sort((a,b)=>a.hp/a.max-b.hp/b.max)[0];
  const emit = (kind,side,from,targetSide,target,amount,extra={}) => events.push({t,kind,side,from,toSide:targetSide,target:target.id,amount,hp:target.hp,shield:target.shield,...extra});
  function shield(side,from,target,raw,skill) { const amount=Math.max(0,Math.min(Math.round(raw),Math.floor(target.max*.6)-target.shield));target.shield+=amount;emit('shield',side,from,side,target,amount,{skill}); }
  function heal(side,from,target,raw,skill) { const amount=Math.min(target.max-target.hp,Math.round(raw*synergy[side].healMultiplier*.75));target.hp+=amount;meter(side,from).healing+=amount;emit('heal',side,from,side,target,amount,{skill}); }
  function hit(side,from,target,raw,skill,stage) {
    const enemySide=1-side, crit=random()<.12;
    let value=Math.max(1,Math.round(raw*(.9+random()*.2)*(crit?1.5:1)*(1-target.defense)*synergy[enemySide].incomingMultiplier));
    const absorbed=Math.min(target.shield,value);target.shield-=absorbed;value-=absorbed;
    if(value>=target.hp&&!rescued[enemySide]&&alive(enemySide).some(u=>u.id==='lava')){
      rescued[enemySide]=true;target.protectedUntil=t+2000;
      emit('shield',enemySide,'lava',enemySide,target,0,{skill:'긴급생존',protectedUntil:target.protectedUntil});
    }
    if(target.protectedUntil>t)value=Math.min(value,Math.max(0,target.hp-1));
    const amount=Math.min(target.hp,value);target.hp-=amount;meter(side,from).damage+=amount;meter(enemySide,target.id).taken+=amount;if(crit&&amount>0)meter(side,from).criticals++;
    emit(skill?'skill':'attack',side,from,enemySide,target,amount,{crit:crit&&amount>0,absorbed,...(skill?{skill}:{}),...(stage?{stage}:{} )});
    if(target.hp<=0)emit('down',side,from,enemySide,target,0);
    return amount;
  }
  function act(side,unit) {
    if(unit.hp<=0||unit.stunUntil>t||!alive(1-side).length)return;
    const def=game.BY_ID[unit.id];unit.energy++;const skill=unit.energy>=def.cooldown;
    if(skill)unit.energy=0;
    const attack=unit.atk*synergy[side].damageMultiplier*(buffUntil[side]>t?1.3:1)*(t>=45000?1+(t-45000)/15000:1);
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
      for(const target of alive(1-side)){hit(side,unit.id,target,attack*2.2,name,stage);if(stage===4&&target.hp>0){target.stunUntil=t+1500;emit('stun',side,unit.id,1-side,target,0,{skill:name,duration:1500});}}
      unit.stage=stage%4+1;return;
    }
    const targets=skill&&unit.role==='마법'?alive(1-side):[skill&&unit.role==='사수'?alive(1-side).sort((a,b)=>a.hp-b.hp)[0]:alive(1-side)[0]];
    const multiplier=skill?(unit.role==='마법'?1.7:unit.role==='사수'?2.6:['수호','지원'].includes(unit.role)?1:3):1;
    let dealt=0;for(const target of targets)dealt+=hit(side,unit.id,target,attack*multiplier,skill?def.skill:null);
    if(unit.id==='lava'&&dealt>0&&++unit.hits%10===0){const target=weakest(side);if(target)shield(side,unit.id,target,unit.atk*2+target.max/3*.08,'신내림');}
  }
  // Side initiative alternates each second; the initial side comes from the
  // committed seed, so challengers do not always receive the first strike.
  const initial=random()<.5?0:1;
  for(t=1000;t<=90000&&alive(0).length&&alive(1).length;t+=1000){
    const first=(t/1000+initial)%2;
    for(let index=0;index<6;index++){for(const side of[first,1-first])if(sides[side][index])act(side,sides[side][index]);}
  }
  const ratios=sides.map(team=>team.reduce((sum,u)=>sum+u.hp/u.max,0)/Math.max(1,team.length));
  const winner=!alive(0).length&&!alive(1).length?-1:!alive(0).length?1:!alive(1).length?0:Math.abs(ratios[0]-ratios[1])<.0001?-1:ratios[0]>ratios[1]?0:1;
  return {seed,teams,events,damage,winner,durationMs:Math.min(90000,t-1000),final:sides.map(team=>team.map(({id,hp,shield})=>({id,hp,shield}))),rules:{maxSeconds:90,vitality:3,healing:.75,shieldHealth:'original',overtimeAt:45,tiebreak:'remaining-health-ratio',rewards:false}};
}
