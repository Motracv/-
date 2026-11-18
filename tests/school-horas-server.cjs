const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { fixture } = require('./account-fixture.cjs');
const G = require('../school/engine.js');

function save(team) {
  const state=G.create(1);state.team=team;
  for(const id of team)state.units[id]={level:50,stars:3,xp:0,shards:0};
  return state;
}

(async()=>{
  const { simulateArena }=await import('../online/arena.mjs');
  let passed=0;
  const test=async(name,run)=>{await run();passed++;console.log('PASS',name);};
  const originals=[save(['taeo','geonu','doyoon','osia','lava','nari']),save(['geonu','ian','osia','lumi','nari','lava'])];
  await test('29 existing arena match fixtures retain every event, damage total and result',()=>{
    // Captured from the pre-Horas simulator at commit 5f823cc, before editing.
    const hash=createHash('sha256').update(JSON.stringify(Array.from({length:29},(_,index)=>simulateArena(G,originals,['a','b'],index+1)))).digest('hex');
    assert.equal(hash,'2677356553a2fafae3d974b1960ddbbf16ef90704b6f4e30663afd6484b2bc7b');
  });
  const lineup=['taeo','geonu','doyoon','horas','osia','lava'];
  const saves=[save(lineup),save(lineup)],before=JSON.stringify(saves);
  const matches=Array.from({length:30},(_,index)=>simulateArena(G,saves,['a','b'],index+1));
  await test('Both arena sides use two slow basics, bounded stacks and distinct delayed ritual impacts',()=>{
    for(const match of matches){
      for(let side=0;side<2;side++){
        const own=match.events.filter(event=>event.side===side),basics=own.filter(event=>event.kind==='horas-basic');
        basics.forEach((event,index)=>{assert.equal(event.pose,index%2+1);if(index)assert.ok(event.t-basics[index-1].t>=G.HORAS_RULES.basicMs);});
        const incoming=own.filter(event=>event.kind==='horas-stack'&&event.source==='hit');
        incoming.forEach((event,index)=>{if(index)assert.ok(event.t-incoming[index-1].t>=1000);});
        for(const event of own.filter(event=>event.kind==='horas-stack'))assert.ok(event.stacks>=1&&event.stacks<=5);
        const casts=own.filter(event=>event.kind==='horas-cast');
        casts.forEach((event,index)=>{assert.equal(event.stacks,0);if(index)assert.ok(event.t-casts[index-1].t>=3000);});
        for(const impact of own.filter(event=>event.kind==='horas-impact')){
          const cast=casts.find(event=>event.castId===impact.castId);assert.ok(cast);assert.equal(impact.t-cast.t,1500);
          const hits=own.filter(event=>event.kind==='skill'&&event.castId===impact.castId);
          assert.equal(hits.filter(event=>event.primary).length,impact.missed?0:1);
          assert.ok(hits.filter(event=>!event.primary).length<=2);
        }
      }
    }
    assert.ok(matches.some(match=>[0,1].every(side=>match.events.some(event=>event.side===side&&event.kind==='horas-impact'))));
  });
  await test('Misses do no damage, marks refund once, and the stunned-target bonus occurs at actual impact',()=>{
    let misses=0,refunds=0,bonuses=0;
    // A high-vitality fixture keeps both teams alive through Osia's fourth cast.
    const longGame={...G,stats:(id,unit)=>({...G.stats(id,unit),hp:G.stats(id,unit).hp*4})};
    const longMatch=simulateArena(longGame,saves,['a','b'],1);
    for(const match of[...matches,longMatch]){
      const marks=new Map();
      for(const event of match.events){
        if(event.kind==='horas-impact'&&event.missed){misses++;assert.equal(match.events.filter(hit=>hit.side===event.side&&hit.castId===event.castId&&['skill','horas-mark'].includes(hit.kind)).length,0);}
        if(event.kind==='horas-mark')marks.set(`${event.side}:${event.target}`,event);
        if(event.kind==='horas-refund'){
          refunds++;const key=`${event.side}:${event.target}`,mark=marks.get(key);assert.ok(mark);assert.ok(mark.until>event.t);assert.ok(event.amount>=1&&event.amount<=2);marks.delete(key);
          assert.ok(match.events.some(down=>down.kind==='down'&&down.t===event.t&&down.toSide===event.toSide&&down.target===event.target));
        }
        if(event.stunBonus){bonuses++;assert.equal(event.from,'horas');assert.ok(match.events.some(stun=>stun.kind==='stun'&&stun.target===event.target&&stun.toSide===event.toSide&&stun.t<=event.t&&event.t<stun.t+stun.duration));}
      }
    }
    assert.ok(misses>0);assert.ok(refunds>0);assert.ok(bonuses>0);
  });
  await test('New arena simulations are seed-repeatable, bounded and leave owned saves untouched',()=>{
    assert.equal(JSON.stringify(saves),before);
    for(let index=0;index<5;index++)assert.deepEqual(simulateArena(G,saves,['a','b'],index+1),matches[index]);
    for(const match of matches){
      assert.ok(match.durationMs>0&&match.durationMs<=90000);assert.equal(match.rules.rewards,false);assert.equal(match.rules.horasDamageMultiplier,.75);
      for(let side=0;side<2;side++)for(const meter of match.damage[side])assert.equal(meter.damage,match.events.filter(e=>e.side===side&&e.from===meter.id&&['attack','skill'].includes(e.kind)).reduce((sum,e)=>sum+e.amount,0));
      for(const units of match.final)for(const unit of units)assert.ok(Number.isFinite(unit.hp)&&unit.hp>=0&&Number.isFinite(unit.shield)&&unit.shield>=0);
    }
  });
  await test('Max-level UR mirrors have no fixed initiative winner and replacing Ian remains bounded',()=>{
    const max=team=>{const state=save(team);for(const unit of Object.values(state.units)){unit.level=100;unit.stars=5;}return state;};
    const ur=max(lineup),ordinary=max(['taeo','geonu','doyoon','ian','osia','lava']);
    const mirrors=[0,0],replacement=[0,0];
    for(let seed=1;seed<=100;seed++){
      const mirror=simulateArena(G,[ur,ur],['a','b'],seed*9973),changed=simulateArena(G,[ur,ordinary],['a','b'],seed*9973);
      if(mirror.winner>=0)mirrors[mirror.winner]++;if(changed.winner>=0)replacement[changed.winner]++;
      assert.ok(mirror.durationMs<90000&&changed.durationMs<90000);
    }
    assert.ok(mirrors.every(wins=>wins>=25&&wins<=75));assert.ok(replacement[0]>=45&&replacement[0]<=75);
  });

  const t=await fixture(),realNow=Date.now,realRandom=crypto.getRandomValues;
  let now=Date.parse('2026-11-18T12:00:00+09:00');Date.now=()=>now;
  const call=(who,path,data={})=>t.call('/api/school/'+path,{catalogVersion:G.CATALOG_VERSION,...data},null,who?{'X-Account-Session':who.token}:{});
  const row=who=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id);
  const patch=(who,fn)=>{const state=JSON.parse(row(who).payload);fn(state);t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(state),who.profile.id);};
  const fixedRandom=value=>{crypto.getRandomValues=function(array){if(array instanceof Uint32Array&&array.length===1){array[0]=Math.floor(value*4294967296);return array;}return realRandom.call(crypto,array);};};
  const a=(await t.login('horas-server-a')).data,b=(await t.login('horas-server-b')).data;
  try{
    await call(a,'state');await call(b,'state');
    await test('Legacy save migration preserves other pickup guarantees and rejects catalog10 before writing',async()=>{
      patch(a,state=>{delete state.banners.horas;state.pity=61;state.banners.osia={pity:61,guaranteed:true};state.banners.lava={pity:72,guaranteed:true};state.gold=5860;state.gems=10000;state.units.harin.level=40;});
      const old=row(a).payload;assert.equal((await call(a,'state',{catalogVersion:10})).status,426);assert.equal(row(a).payload,old);
      const read=await call(a,'state');assert.equal(read.status,200);assert.deepEqual(read.data.state.banners.horas,{pity:0,guaranteed:false});assert.deepEqual(read.data.state.banners.osia,{pity:61,guaranteed:true});assert.deepEqual(read.data.state.banners.lava,{pity:72,guaranteed:true});assert.equal(read.data.state.gold,5860);assert.equal(read.data.state.units.harin.level,40);
    });
    await test('Server-owned UR80 guarantee is charged once under concurrent requests and survives another login',async()=>{
      patch(a,state=>state.banners.horas.pity=79);const current=await call(a,'state');
      const input={revision:current.data.revision,requestId:'horas-server-ur-hard-001',action:{kind:'recruit',banner:'horas',count:1},state:{gems:1e12},pity:0,results:[{id:'lava'}]};
      const results=await Promise.all([call(a,'action',input),call(a,'action',input)]);
      for(const result of results){assert.equal(result.status,200);assert.equal(result.data.result.results[0].id,'horas');assert.equal(result.data.state.gems,9900);assert.equal(result.data.state.banners.horas.pity,0);assert.equal(result.data.state.banners.osia.pity,61);assert.equal(result.data.state.banners.lava.pity,72);}
      assert.deepEqual(results[0].data.result,results[1].data.result);
      const signed=(await t.login('horas-server-a')).data,rejoined=await call(signed,'state');assert.equal(rejoined.data.state.units.horas.level,1);assert.equal(rejoined.data.state.pulls,1);
    });
    await test('SSR results retain UR pity and client-supplied UR rolls, pity and guarantees cannot replace a real draw',async()=>{
      let current=await call(a,'state');fixedRandom(.004);
      let result=await call(a,'action',{revision:current.data.revision,requestId:'horas-server-ssr-retain1',action:{kind:'recruit',banner:'horas',count:1,pity:79,rarity:'UR',results:[{id:'horas'}]}});
      crypto.getRandomValues=realRandom;assert.equal(result.status,200);assert.equal(G.BY_ID[result.data.result.results[0].id].rarity,'SSR');assert.equal(result.data.state.banners.horas.pity,1);
      current=result;fixedRandom(.99999);
      result=await call(a,'action',{revision:current.data.revision,requestId:'horas-server-forged-draw1',action:{kind:'recruit',banner:'horas',count:1,pity:79,guaranteed:true,results:[{id:'horas'}]}});
      crypto.getRandomValues=realRandom;assert.equal(result.status,200);assert.equal(G.BY_ID[result.data.result.results[0].id].rarity,'R');assert.equal(result.data.state.banners.horas.pity,2);
    });
    await test('A lost committed UR response recovers the same hero and duplicate shards without paying twice',async()=>{
      patch(a,state=>state.banners.horas.pity=79);const current=await call(a,'state'),before=current.data.state.gems;
      const intent={revision:current.data.revision,requestId:'horas-server-lost-ur-001',action:{kind:'recruit',banner:'horas',count:1}};
      const prepare=t.db.prepare;let drop=true;
      t.db.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith('UPDATE school_saves'))return statement;return{bind(...args){const bound=statement.bind(...args);return{...bound,async run(){const result=await bound.run();if(drop){drop=false;throw Error('D1_RESPONSE_LOST');}return result;}};}};};
      try{assert.equal((await call(a,'action',intent)).status,503);}finally{t.db.prepare=prepare;}
      const recover=await call(a,'action',intent),again=await call(a,'action',intent);
      assert.equal(recover.status,200);assert.equal(recover.data.repeated,true);assert.deepEqual(recover.data.result,again.data.result);assert.equal(recover.data.result.results[0].id,'horas');assert.equal(recover.data.state.gems,before-100);assert.equal(recover.data.state.units.horas.shards,30);assert.equal(recover.data.result.results[0].shards,30);assert.equal(recover.data.state.banners.horas.pity,0);
    });
    await test('Pending ritual snapshot resumes across account reads without reroll or forged impact values',async()=>{
      const state=G.create(now,193);state.units.horas={level:1,xp:0,shards:0,stars:0};G.action(state,{kind:'team',team:['horas']},now);
      state.battle.horas.stacks=5;state.battle.heroes[0].hp=state.battle.heroes[0].max=10000;
      state.battle.enemies.forEach(enemy=>{enemy.hp=enemy.max=100000;enemy.atk=1;});
      now+=1000;G.advance(state,now);assert.ok(state.battle.horasCast);patch(a,s=>Object.assign(s,state));
      const cast=structuredClone(state.battle.horasCast);let read=await call(a,'state',{state:{battle:{horasCast:{missed:false,targets:[]}}}});assert.equal(read.status,200);assert.deepEqual(read.data.state.battle.horasCast,cast);
      const expected=G.clone(state);now+=1500;G.advance(expected,now);read=await call(a,'state');assert.equal(read.status,200);assert.equal(read.data.state.battle.horasCast,undefined);assert.equal(read.data.state.seed,expected.seed);assert.deepEqual(read.data.state.battle.enemies,expected.battle.enemies);assert.equal(read.data.state.events.filter(event=>event.kind==='horas-impact'&&event.castId===cast.id).length,1);
    });
    await test('Both signed friends receive one persisted UR arena replay and unchanged account progression',async()=>{
      for(const [index,who] of[a,b].entries()){
        patch(who,state=>{const fresh=G.create(now,index+1);Object.assign(state,fresh);state.team=lineup;for(const id of lineup)state.units[id]={level:50,stars:3,xp:0,shards:0};});
        let read=await call(who,'state');const rename=await call(who,'action',{revision:read.data.revision,requestId:`horas-arena-name-${index}-0001`,action:{kind:'rename',name:`호라스단장${index}`}});assert.equal(rename.status,200);
      }
      let result=await call(a,'social',{kind:'friend_request',name:'호라스단장1'});assert.equal(result.status,200);const friend=result.data.requests.outgoing[0].id;
      assert.equal((await call(b,'social',{kind:'friend_accept',id:friend})).status,200);
      result=await call(a,'social',{kind:'arena_invite',id:friend,requestId:'horas-arena-invitation1'});assert.equal(result.status,200);const id=result.data.invites.outgoing[0].id;
      const before=[row(a).payload,row(b).payload],accepts=await Promise.all([call(b,'social',{kind:'arena_accept',id,winner:1}),call(b,'social',{kind:'arena_accept',id})]);
      accepts.forEach(response=>assert.equal(response.status,200));assert.deepEqual(accepts[0].data.match,accepts[1].data.match);
      const first=accepts[0].data.match,other=await call(a,'social',{kind:'arena_match',id});assert.deepEqual(first.events,other.data.match.events);assert.ok(first.events.some(event=>event.kind==='horas-cast'));assert.deepEqual([row(a).payload,row(b).payload],before);
      assert.equal((await call(a,'social',{kind:'arena_match',id,catalogVersion:10})).status,426);
    });
    console.log(`${passed} Horas arena/server checks passed`);
  }finally{Date.now=realNow;crypto.getRandomValues=realRandom;t.sqlite.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
