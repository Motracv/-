const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('../school/combat-feedback.js');
const unit=()=>({id:'kazua',hp:100,max:100,shield:0,kazua:{mode:'fire',modeSince:0,phaseMs:1000}});
const battle=(elapsed=0,events=[],hp=1000,unitHP=100)=>({elapsed,seq:events.at(-1)?.seq||0,events,boss:{hp,max:1000},teams:[{isMe:true,units:[{...unit(),hp:unitHP}]}]});
const batch=[
 {seq:1,t:250,kind:'hit',team:0,id:'kazua',amount:10},
 {seq:2,t:250,kind:'hurt',team:0,id:'kazua',amount:20},
 {seq:3,t:500,kind:'hit',team:0,id:'kazua',amount:10},
 {seq:4,t:500,kind:'heal',team:0,id:'kazua',amount:5},
 {seq:5,t:750,kind:'kazua-shot',team:0,id:'kazua',mode:'pistol'},
 {seq:6,t:750,kind:'hit',team:0,id:'kazua',amount:10},
 {seq:7,t:1000,kind:'hurt',team:0,id:'kazua',amount:30}
];
const timeline=F.createSnapshotTimeline();timeline.accept(battle(),'a',0);
const incoming=battle(1000,batch,970,55),before=JSON.stringify(incoming),queue=timeline.accept(incoming,'a',1100);
assert.equal(new Set(queue.map(e=>e.shown)).size,4,'Separate confirmed turns are not collapsed to one paint');
assert.equal(queue[0].shown,queue[1].shown,'Truly simultaneous server damage stays simultaneous');
assert(queue.every(e=>e.shown>=1100&&e.shown<=1750),'Presentation backlog is capped at 650ms');
assert.equal(timeline.view(1100).boss.hp,990);assert.equal(timeline.view(1100).teams[0].units[0].hp,80);
assert.equal(timeline.view(1400).boss.hp,980);assert.equal(timeline.view(1400).teams[0].units[0].hp,85);
assert.equal(timeline.view(1800).boss.hp,970);assert.equal(timeline.view(1800).teams[0].units[0].hp,55);
const scheduled=queue.map(e=>e.shown);timeline.accept(incoming,'a',1150);
assert.deepEqual(timeline.events(1150).map(e=>e.shown),scheduled,'Duplicate poll or action acknowledgement never repeats events');
assert.equal(timeline.clock(2400)-timeline.clock(2100),300,'Visual clock does not freeze at the old one-second extrapolation ceiling');
assert.equal(JSON.stringify(incoming),before,'Rendering never changes confirmed battle HP, timers or event records');
const shot=timeline.events(1550).find(e=>e.kind==='kazua-shot');
const frame=F.kazuaPresentation(unit(),0,timeline.events(1550),1550,{kazuaMode:'reload',kazuaAge:.2});
assert.equal(frame.kazuaMode,'pistol');assert.equal(frame.kazuaAge,(1550-shot.shown)/1000,'A short weapon swap skipped between polls still plays from its confirmed event');
assert.equal(F.kazuaPresentation(unit(),1,queue,1550,{kazuaMode:'reload'}).kazuaMode,'reload','One player does not borrow another player’s shot');
assert.equal(F.kazuaPresentation({...unit(),hp:0},0,queue,1550,{kazuaMode:'idle'}).kazuaMode,'idle');
assert.equal(F.kazuaPresentation(unit(),0,queue,shot.shown+551,{kazuaMode:'reload'}).kazuaMode,'reload');
assert.equal(timeline.accept(battle(5000,[...batch,{seq:8,t:5000,kind:'hit',amount:50}],920,55),'a',5000).length,0,'Reconnect skips old attack backlogs');
assert.equal(timeline.view(5000).boss.hp,920);
timeline.accept(battle(5250,[{seq:9,t:5250,kind:'hit',amount:20}],900,55),'a',5250,{hidden:true});
assert.equal(timeline.events(5260).length,0,'Hidden tabs do not queue effects');
timeline.accept(incoming,'other-room',5300);assert.equal(timeline.events(5300).length,7);
timeline.accept(battle(1100,[...batch,{seq:8,t:1100,kind:'end'}],0,0),'other-room',5400,{active:false});
assert.equal(timeline.view(5400).boss.hp,0);assert.equal(timeline.view(5400).teams[0].units[0].hp,0,'Finished battles never retain phantom live units');
const late=F.createSnapshotTimeline();late.accept(incoming,'a',10000);late.accept(battle(1250,[...batch,{seq:8,t:1250,kind:'hit',amount:10}],960,55),'a',10250);
late.events(10250);assert.equal(late.events(13000).length,0,'A long suspended frame clears pending effects before rendering');
console.log('PASS bounded confirmed-turn replay, exact HP reconstruction, skipped short shots, monotonic clock, reconnect/tab/result cleanup');

// Execute the real cooperative controllers. Only canvas pixels and DOM layout
// are stubbed; snapshot acceptance, event scheduling and frame selection run.
function controller(kind){
 let now=0,open=false,frames=[],fx=[];const nodes=new Map(),timers=[];
 const c=new Proxy({setTransform(){},isContextLost:()=>false},{get(o,k){if(k in o)return o[k];return(...args)=>{for(const a of args)if(typeof a==='number')assert(Number.isFinite(a),String(k)+' finite');};}});
 const canvas={width:0,height:0,dataset:{},getBoundingClientRect:()=>({width:800,height:448}),getContext:()=>c};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',dataset:{},closest:()=>({open}),scrollTop:0});return nodes.get(id);};nodes.set(kind+'-canvas',canvas);
 const document={hidden:false,getElementById:node,querySelector:s=>node(s.slice(1)),querySelectorAll:()=>[]};
 const art={hero(c,id,x,y,scale,frame){frames.push(frame);},kazuaFrame(u,t,sample){return {kazuaMode:u.kazua?.mode,kazuaAge:1+(t-sample)/1000};},poseForSkill(){return null;},spicaFieldUntil:()=>0,spicaBlizzard(){},combatNumber(){}};
 const window={SchoolCombatFeedback:F,SchoolArt:art,SchoolYetiRules:{HP:1000,DURATION:210000,PATTERNS:[]},SchoolRaidRules:{HP:50000000,PATTERNS:[]},SchoolRescue:{create:()=>({destroy(){},update(){}})},SchoolKazuaArt:{effects(c,o){fx.push(o);}},SchoolRaidFX:{draw(c,o){frames.push(o);return {effects:o.events.length,hits:0};}}};
 const context={window,document,Image:class{},performance:{now:()=>now},devicePixelRatio:1,requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:(fn,ms)=>{timers.push({fn,ms});return 1;},clearTimeout(){},sessionStorage:{getItem:()=>null},crypto};
 let source=fs.readFileSync('school/'+kind+'.js','utf8');source=source.replace(/return\s*\{open,leave,destroy:stop[^;]+;/,'return {accept,draw,destroy:stop};');vm.runInNewContext(source,context);
 const game=window[kind==='yeti'?'SchoolYeti':'SchoolRaid'].create({reduced:()=>false});
 const room=b=>({room:{id:'live',status:'fighting',battle:b,members:[{account:'a',isMe:true}]},hp:b.boss.hp,rewards:[]});
 game.accept(room(battle()));now=1100;game.accept(room(incoming));open=true;
 now=1560;game.draw(now);assert.equal(JSON.stringify(incoming),before);
 if(kind==='yeti'){assert.equal(fx.at(-1).mode,'pistol');assert.equal(frames.at(-1).kazuaMode,'pistol');}
 else{assert.equal(frames.at(-1).battle.boss.hp,970);assert.equal(frames.at(-1).battle.teams[0].units[0].hp,85);assert(Number.isFinite(frames.at(-1).visualTime));}
 now=1800;game.draw(now);if(kind==='raid')assert.equal(frames.at(-1).battle.teams[0].units[0].hp,55);
 document.hidden=true;now=1900;game.draw(now);document.hidden=false;now=5000;game.draw(now);
 game.destroy();
}
controller('yeti');controller('raid');
console.log('PASS actual Yeti and raid frame controllers: distributed HP, event-driven pistol, finite canvas inputs, hidden-tab cleanup');

const client=fs.readFileSync('school/client.js','utf8'),animation=client.match(/  function animationTime\(\) \{[\s\S]*?\n  \}/)[0];
const context={mode:'cloud',connected:false,hasCloudState:true,hasGuestState:false,guestSaveFailed:false,serverNow:()=>1250,state:{at:1000,simTime:1000,simCredit:0,speed:1}};
vm.runInNewContext(animation+'; globalThis.read=animationTime;',context);
assert.equal(context.read(),1.25,'Losing a save connection does not freeze the independent combat presentation clock');
assert(client.includes("mode === 'cloud' && hasCloudState && serverNow()-state.at >= 500"),'Visible combat advances its preview while saving/reconnecting');
assert(client.includes("mode === 'cloud' && hasCloudState) { advanceCloudPreview(); consumeEvents(); render(); }"));
console.log('PASS campaign preview keeps animating through saving/reconnection; spending authority remains separate');
