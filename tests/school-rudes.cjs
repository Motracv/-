'use strict';
const assert=require('node:assert/strict'),G=require('../school/engine.js'),R=require('../school/raid-engine.js');
const NOW=Date.parse('2026-11-21T04:00Z');
const make=(ids=['rudes','yaho','ryusion'])=>{const s=G.create(NOW,731);s.gems=100000;for(const id of ids)s.units[id]={level:90,stars:3,xp:0,shards:0};G.action(s,{kind:'team',team:ids},NOW);return s;};
const unit=(id,hp=1000)=>({id,hp,max:1000,atk:100,shield:0});
const run=(u,all,enemies,end,dt=250)=>{const hits=[],events=[];for(let t=250;t<=end;t+=dt)G.rudesStep(u,all,enemies,t,dt,(e,n,d)=>{n=Math.min(e.hp,Math.round(n));e.hp-=n;hits.push({t,id:e.id,n,...d});return n;},(kind,e)=>events.push({t,kind,...e}));return{hits,events};};
assert.equal(G.BY_ID.rudes.rarity,'SSR');assert.equal(G.BY_ID.rudes.element,'dark');assert.equal(G.recruitCost('rudes',10),1000);
assert.deepEqual(Object.values(G.BANNERS).filter(b=>b.featured&&!G.isURBanner(b.id)).map(b=>b.id).sort(),['rudes','yaho']);
assert(G.STANDARD_SSR.includes('kazua'));assert(!G.STANDARD_SSR.includes('rudes'));assert(!G.STANDARD_SSR.includes('yaho'));
assert(!G.bannerAvailable('kazua',NOW));assert.equal(G.canonicalBanner('kazua'),'standard');
{
 const s=make();s.banners.standard={pity:70,reserve:0,guarantees:0,guaranteed:false};s.banners.kazua={pity:70,guaranteed:true};s.banners.rudes={pity:23,guaranteed:false};s.banners.yaho={pity:32,guaranteed:true};
 assert.deepEqual(G.bannerState(s,'standard'),{pity:79,reserve:61,guarantees:1,guaranteed:true});
 G.advance(s,NOW);assert(!s.banners.kazua);const copy=G.clone(s);G.advance(s,NOW);assert.deepEqual(s.banners,copy.banners);
 const out=G.action(s,{kind:'recruit',banner:'standard',count:1,guaranteedHero:'kazua'},NOW,()=>.99);assert.equal(out.results[0].id,'kazua');assert.equal(s.banners.standard.pity,61);assert.equal(s.banners.rudes.pity,23);assert.equal(s.banners.yaho.pity,32);assert.equal(s.gems,99900);assert(G.validate(s));
 s.banners.rudes={pity:79,guaranteed:true};const res=G.action(s,{kind:'recruit',banner:'rudes',count:1},NOW,()=>.99);assert.equal(res.results[0].id,'rudes');assert.equal(s.gems,99800);
 for(const b of Object.keys(G.BANNERS)){const rates=G.bannerHeroRates(s,b);assert(Math.abs(Object.values(rates).reduce((a,n)=>a+n,0)-1)<1e-8);if(b!=='rudes')assert.equal(rates.rudes,0);}
}
console.log('PASS dedicated SSR banners, standard Kazua, exact one-time pity/guarantee migration, acquisition and rates');
{
 const u=unit('rudes'),es=[unit('front',1e7),unit('middle',1e7),unit('rear',1e7)];es.forEach(e=>e.max=e.hp);
 const {hits,events}=run(u,[u],es,15500);assert(hits.filter(h=>!h.skill).every(h=>h.id==='rear'&&h.damageType==='physical'));
 for(const shot of[1,2])assert.deepEqual(hits.filter(h=>h.rudesMode==='pierce'&&h.shot===shot).map(h=>h.id),['front','middle','rear']);
 const fan=hits.filter(h=>h.rudesMode==='fan');assert.equal(fan.length,1);assert.equal(fan[0].id,'front');assert.equal(fan[0].damageType,'magic');assert.equal(fan[0].n,420);assert.equal(u.rudes.shield,350);assert.equal(u.shield,350);assert.equal(u.rudes.shieldUntil,fan[0].t+6000);assert(events.some(e=>e.kind==='rudes-shield'&&e.shield===350&&e.rudesShield===350));assert(G.validRudes(u));
 G.expireRudesShield(u,u.rudes.shieldUntil);assert.equal(u.shield,0);
 const deadRear=unit('rear',0),u2=unit('rudes');const r=run(u2,[u2],[unit('front'),deadRear],1800);assert.equal(r.hits[0].id,'front');
}
{
 for(const [damage,bond,cap,duration]of[[420,false,350,6000],[420,true,400,8000],[17,true,17,8000],[0,true,0,0]]){
  const u=unit('rudes');u.shield=120;G.rudesInit(u).next='fan';u.rudes.nextSkill=0;const all=[u,...(bond?[unit('yaho')]:[])],e=unit('front');G.rudesStep(u,all,[e],0,250,()=>damage);G.rudesStep(u,all,[e],500,250,()=>damage,(kind,event)=>{if(kind==='rudes-shield'){assert.equal(event.shield,120+cap);assert.equal(event.rudesShield,cap);}});
  assert.equal(u.rudes.shield,cap);assert.equal(u.shield,120+cap);if(damage){assert.equal(u.rudes.shieldUntil,500+duration);u.earthShield=20;const consumed=G.absorbRudesShield(u,70);assert.equal(consumed,Math.min(50,cap));u.shield-=70;G.absorbEarthShield(u,70);G.expireRudesShield(u,500+duration);assert.equal(u.shield,100-Math.max(0,50-cap),'expiry preserves other shield sources after partial absorption');}
 }
 const u=unit('rudes'),e=unit('target');G.rudesStep(u,[u],[e],1000,250,()=>{throw Error('early hit');});G.rudesStep(u,[u],[e],1500,250,()=>{throw Error('stunned cast hit');},()=>{},true);assert.equal(u.rudes.cast,null);
 assert(!G.validRudes({...u,rudes:{...u.rudes,shield:-1}}));assert(!G.validRudes({...u,rudes:{...u.rudes,nextSkill:Infinity}}));
}
console.log('PASS rear priority/fallback, both piercing bullets hit all, front-only magic fan, actual HP shield cap/expiry, Yaho bond, interrupted cast');
{
 const a=make(['rudes']);for(const u of a.battle.heroes)u.hp=u.max=1e7;for(const e of a.battle.enemies){e.hp=e.max=1e9;e.atk=1;}const b=G.clone(a);
 G.advance(a,NOW+18000);for(let t=500;t<=18000;t+=500)G.advance(b,NOW+t);assert.deepEqual(a,b);assert(G.validate(a));assert(a.battle.heroes[0].rudes);assert(a.events.some(e=>e.from==='rudes'&&e.damageType==='magic'));
 const shielded=make(['rudes']);const first=shielded.battle.enemies[0];first.hp=first.max=1e9;first.shield=1e8;shielded.battle.enemies.slice(1).forEach(e=>e.hp=0);shielded.battle.heroes[0].hp=shielded.battle.heroes[0].max=1e7;G.advance(shielded,NOW+16000);assert.equal(shielded.battle.heroes[0].rudes.shield,0);
}
for(const boss of['twins','balloon']){
 const a=R.create(G,[{account:'a',save:make(['rudes'])}],NOW,12,5e7,boss);const b=G.clone(a);const enc={duration:90000,bossAct(){}};
 R.advance(G,a,NOW+17000,enc);for(let t=250;t<=17000;t+=250)R.advance(G,b,NOW+t,enc);assert.deepEqual(a,b);
 const hits=a.events.filter(e=>e.kind==='hit'&&e.id==='rudes');assert(hits.length);assert(hits.every(e=>e.damageType===(boss==='twins'?'physical':'magic')));
 assert(a.events.some(e=>e.kind==='immune'&&e.id==='rudes'&&e.damageType===(boss==='twins'?'magic':'physical')));
 assert.equal(a.teams[0].units[0].rudes.shield>0,boss==='balloon');
}
console.log('PASS campaign snapshot/reconnect parity, enemy shields generate no umbrella shield, per-hit guild immunity and raid parity');
(async()=>{const{simulateArena}=await import('../online/arena.mjs');const saves=[make(['ryusion','geonu','lava','rudes','yaho','nari']),make(['ryusion','geonu','lava','rudes','yaho','nari'])];const out=simulateArena(G,saves,['A','B'],51);assert.deepEqual(out,simulateArena(G,saves,['A','B'],51));assert(out.events.some(e=>e.from==='rudes'&&e.damageType==='magic'));assert(out.events.some(e=>e.from==='rudes'&&e.damageType==='physical'));assert(out.final.flat().every(u=>u.hp>=0&&Number.isFinite(u.hp)));
 const stories=require('node:fs').readFileSync(require('node:path').join(__dirname,'../school/bond-stories.js'),'utf8'),vm=require('node:vm'),ctx={window:{}};vm.runInNewContext(stories,ctx);for(const id of['rudes','yaho']){assert(G.BOND_CHARACTERS[id]);assert.equal(ctx.window.SchoolBondStories[id].length,4);assert(ctx.window.SchoolBondStories[id].flat().some(line=>line[0]==='야호'));}
 console.log('PASS deterministic hybrid PvP and both four-chapter bond stories');})().catch(e=>{console.error(e);process.exitCode=1;});
