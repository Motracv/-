// Rendering contracts without a browser: actual renderer, recording Canvas2D
// port. This checks lifecycle/caching/finite geometry, not visual appearance.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const G=require('../school/engine.js');
let allocated=0,gradients=0;const images=[],listeners=new Map();
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
class Canvas{
 constructor(){this.width=960;this.height=560;this.dataset={};this.id=++allocated;this.context=null;}
 getContext(){return this.context||(this.context=context(this));}
 toDataURL(){return 'data:image/png;base64,'+this.id;}
}
function context(canvas){
 const records=[],stack=[];let matrix=[1,0,0,1,0,0];
 const value={canvas,records,stack,globalAlpha:1,
  save(){stack.push([matrix.slice(),this.globalAlpha]);records.push(['save']);},
  restore(){assert(stack.length>0,'Canvas stack underflow');[matrix,this.globalAlpha]=stack.pop();records.push(['restore']);},
  getTransform(){return Object.fromEntries(['a','b','c','d','e','f'].map((k,i)=>[k,matrix[i]]));},
  setTransform(...args){matrix=args;},
  transform(...args){matrix=multiply(matrix,args);records.push(['transform',...args]);},
  translate(x,y){this.transform(1,0,0,1,x,y);},scale(x,y){this.transform(x,0,0,y,0,0);},
  rotate(a){this.transform(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);},
  measureText(t){return {width:String(t).length*6};},
  createLinearGradient(){gradients++;return {addColorStop(){}};},createRadialGradient(){gradients++;return {addColorStop(){}};},
  getImageData(){return {data:new Uint8ClampedArray(4)};}
 };
 return new Proxy(value,{get(target,key){if(key in target)return target[key];return (...args)=>{for(const a of args)if(typeof a==='number')assert(Number.isFinite(a),`${key} received ${a}`);records.push([key,...args]);};}});
}
class Image{
 constructor(){this.naturalWidth=1536;this.naturalHeight=1024;this.complete=false;images.push(this);}
 set src(v){this._src=v;if(v.includes('portrait')){this.naturalWidth=1024;this.naturalHeight=1536;}if(v.includes('spica/combat-horas')){this.naturalWidth=1774;this.naturalHeight=887;}if(v.includes('battlefields')){this.naturalWidth=887;this.naturalHeight=578;}}
 get src(){return this._src;}
 load(){this.complete=true;this.onload?.();}
}
const document={hidden:false,createElement:()=>new Canvas()},window={SchoolRPG:G,
 addEventListener(k,f){if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(f);},
 dispatchEvent(e){for(const f of listeners.get(e.type)||[])f(e);},requestIdleCallback:f=>queueMicrotask(f)};
const sandbox={window,document,SchoolRPG:G,Image,Event,console,Uint8ClampedArray,Promise,
 setTimeout:f=>0,clearTimeout(){}};
const load=file=>vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
load('school/ryusion.js');load('school/art.js');sandbox.SchoolArt=window.SchoolArt;load('school/raid-vfx.js');
const A=window.SchoolArt,canvas=new Canvas(),c=canvas.getContext('2d');
const snapshot=(id,frame)=>{c.records.length=0;A.hero(c,id,200,200,2,frame);assert.equal(c.stack.length,0);return JSON.stringify(c.records);};
for(const id of ['taeo','osia','lava','horas','ryusion','spica']){
 assert.notEqual(snapshot(id,{time:1}),snapshot(id,{time:2}),`${id} breathes while idle`);
 for(const blocked of ['reduced','dead','frozen','stunned'])assert.equal(snapshot(id,{time:1,[blocked]:true}),snapshot(id,{time:2,[blocked]:true}),`${id} holds a stable pose when ${blocked}`);
}
console.log('PASS all hero idle transforms animate with anchored feet; reduced/dead/frozen/stunned remain still');
// Load the real atlas paths only after the fallback path has been exercised.
for(const image of images.filter(i=>/spica|battlefields/.test(i.src)))image.load();
assert(A.assetsReady('spica'));assert(A.assetsReady('spica-portrait'));
const atlas=JSON.parse(fs.readFileSync('school/assets/spica/atlas.json')),anchors=atlas.poses;
for(let pose=0;pose<anchors.length;pose++){
 c.records.length=0;A.hero(c,'spica',0,0,1,{pose,reduced:true});
 const draw=c.records.find(r=>r[0]==='drawImage');assert(draw);
 assert(Math.abs(draw[2]+anchors[pose].anchorX*46/atlas.nominalBodyHeight)<1e-9);
 assert(Math.abs(draw[3]+anchors[pose].anchorY*46/atlas.nominalBodyHeight)<1e-9);
}
assert.deepEqual([.2,.6,1.1,1.45].map(t=>A.poseForSkill('spica',1,t).pose),[4,5,6,7]);
const attacks=[.1,.3,.65].map(attackAge=>snapshot('spica',{attackAge}));assert.equal(new Set(attacks).size,3,'Windup/release/recovery are different drawings');
assert.equal(snapshot('spica',{attackAge:null}),snapshot('spica',{}),'An absent replay attack age stays idle');
const warm=allocated;for(let n=0;n<200;n++)A.hero(c,'spica',100,120,1,{pose:n%8,reduced:true});assert.equal(allocated,warm);
console.log('PASS eight aligned poses; distinct basic and skill sequences; null attack is idle and 200 repeats allocate no canvases');
const s=G.create(1000,991);s.team=['taeo','harin','sua','spica','osia','lava'];for(const id of s.team)s.units[id]={level:70,xp:0,stars:1,shards:0,nextSkill:1,basicHits:0};s.best=60;
for(const stage of [1,16,31,41,60]){
 G.action(s,{kind:'stage',stage,mode:'farm'},s.at);s.battle.stage=stage;s.battle.elapsed=10000;s.simTime=10000;
 for(const layout of ['', 'panorama']){
  canvas.dataset.layout=layout;A.resetRenderCache();
  const before=JSON.stringify(s),events=[{kind:'spica-skill',from:'spica',stage:1,time:10,targets:s.team,enemies:s.battle.enemies.map(e=>e.id)}];
  A.draw(c,s,10.4,events,false);const drawn=allocated,g=gradients;
  for(let i=0;i<20;i++)A.draw(c,s,10.4,events,false);
  assert.equal(allocated,drawn,'Scenery/pose reuse');assert.equal(gradients,g,'No per-frame depth gradients');assert.equal(c.stack.length,0);assert.equal(JSON.stringify(s),before,'Rendering never mutates a saved game');
 }
}
console.log('PASS real painted/procedural stages, standard/wide layouts, Spica cast geometry; no steady-state scenery allocations or state mutation');
const units=s.battle.heroes.map(u=>({...u,hasteUntil:16000,stunUntil:0}));
window.SchoolRaidFX.draw(c,{w:960,h:400,now:10000,dt:16,battle:{elapsed:10000,boss:{slowUntil:15000}},received:10000,focus:0,events:[{kind:'spica-wind',team:0,id:'spica',shown:9600},{kind:'cast',team:0,id:'spica',stage:1,shown:9600}],bg:{complete:false},atlas:{complete:false},bars:new Map(),reduced:false,units,hp:1000,live:true});assert.equal(c.stack.length,0);
console.log('PASS guild raid Spica cast/haste effects render with balanced canvas state');

const area={x:0,y:0,width:480,height:280},buffs=[{id:'spica',hasteUntil:16000},{id:'lava',hasteUntil:16000},{id:'spica',hasteUntil:15000}],buffCopy=JSON.stringify(buffs);
const until=A.spicaFieldUntil(buffs);assert.equal(until,16000);assert.equal(A.spicaFieldUntil([]),0);assert.equal(JSON.stringify(buffs),buffCopy);
for(const t of [10000,10001,12500,15000,15999]){c.records.length=0;assert.equal(A.spicaBlizzard(c,area,t,until),36);assert(c.records.some(r=>r[0]==='fillRect'));assert.equal(c.stack.length,0);}
for(const t of [9999,16000,17000]){c.records.length=0;assert.equal(A.spicaBlizzard(c,area,t,until),0);assert.equal(c.records.length,0);}
const snow=(t,reduced=false,economy=false)=>{c.records.length=0;const count=A.spicaBlizzard(c,area,t,until,reduced,economy);assert.equal(c.stack.length,0);return {count,records:JSON.stringify(c.records)};};
assert.equal(snow(12000,false,true).count,18);assert.equal(snow(12000,true).count,8);
assert.equal(snow(12000,true).records,snow(13000,true).records,'Reduced motion holds snow still');
assert.notEqual(snow(12000).records,snow(12100).records,'Snow continues moving after the 1.6-second cast');
const alloc=allocated,gradientCount=gradients;for(let i=0;i<600;i++)snow(10000+i*9);assert.equal(allocated,alloc);assert.equal(gradients,gradientCount);
console.log('PASS six-second field survives cast/event expiry, exact stop, merged casters, 36/18/8 caps and no repeated allocations');

// Rejoining at t=13s with no old event history still shows the saved buff field.
const raid={elapsed:13000,teams:[{units:buffs}],boss:{hp:1000}},options={w:960,h:400,now:13000,dt:16,battle:raid,received:13000,focus:0,events:[],bg:{complete:false},atlas:{complete:false},bars:new Map(),reduced:false,units:[],hp:1000,live:true};
c.records.length=0;window.SchoolRaidFX.draw(c,options);assert(c.records.some(r=>r[0]==='bezierCurveTo'),'Field restores from snapshot, with no cast events');
c.records.length=0;window.SchoolRaidFX.draw(c,{...options,live:false});assert(!c.records.some(r=>r[0]==='bezierCurveTo'),'Result screen stops the blizzard');assert.equal(c.stack.length,0);
console.log('PASS raid reconnect restores the remaining field and settlement stops it');

// Exercise the actual replay and duo controllers with a deterministic RAF and
// DOM port. Test-only exports avoid adding inspection hooks to the shipped UI.
const replayCanvas=new Canvas();replayCanvas.getBoundingClientRect=()=>({width:960,height:420});
const duoCanvas=new Canvas();duoCanvas.getBoundingClientRect=()=>({width:800,height:448});
let nextFrame=null,rafId=0,now=0,reducedMotion=false;const fieldCalls=[];
const nodes={'arena-canvas':replayCanvas,'yeti-canvas':duoCanvas,'yeti-view':{closest:()=>({open:true})},'yeti-warning':{},'yeti-clock':{}};
const portDocument={...document,documentElement:{dataset:{}},getElementById:id=>nodes[id]||null};
const portWindow={...window,SchoolArt:{...A,spicaBlizzard(...args){const count=A.spicaBlizzard(...args);fieldCalls.push({elapsed:args[2],until:args[3],count});return count;}},SchoolRescue:{create:()=>({update(){},destroy(){}})},SchoolYetiRules:{HP:800000,DURATION:210000,PATTERNS:[]}};
const port={...sandbox,window:portWindow,document:portDocument,devicePixelRatio:1,performance:{now:()=>now},matchMedia:()=>({matches:reducedMotion}),requestAnimationFrame:f=>{nextFrame=f;return ++rafId;},cancelAnimationFrame(){nextFrame=null;}};
const replaySource=fs.readFileSync('school/social.js','utf8');assert(replaySource.includes('Object.freeze({create})'));
vm.runInNewContext(replaySource.replace('Object.freeze({create})','Object.freeze({create,replay})'),port,{filename:'school/social.js'});
for(const reduced of [false,true]){
 reducedMotion=reduced;fieldCalls.length=0;
 const match={durationMs:9000,winner:0,teams:[{units:[{id:'spica',hp:100,max:100}]},{units:[{id:'spica',hp:100,max:100}]}],events:[0,1].map(side=>({kind:'spica-wind',from:'spica',side,t:1000,hasteUntil:7000}))};
 const stop=portWindow.SchoolSocial.replay(match,0,()=>true);
 for(now=50;now<=4100;now+=50){const frame=nextFrame;nextFrame=null;frame?.(now);}
 assert.equal(fieldCalls.at(-1).count,reduced?8:36,'Arena snow outlives both casting and the expired event queue');
 assert.equal(fieldCalls.at(-1).until,7000,'Both teams share one field deadline');
 const prior=fieldCalls.length;for(;now<=7600;now+=50){const frame=nextFrame;nextFrame=null;frame?.(now);}
 assert(fieldCalls.length>prior);assert.equal(fieldCalls.at(-1).count,0,'Arena field expires at its recorded deadline');
 const beforeFinish=fieldCalls.length;stop.finish();assert.equal(fieldCalls.length,beforeFinish,'Replay completion does not draw snow');stop();
}
const duoSource=fs.readFileSync('school/yeti.js','utf8'),duoReturn='return {open,leave,destroy:stop};';assert(duoSource.includes(duoReturn));
vm.runInNewContext(duoSource.replace(duoReturn,'return {open,leave,destroy:stop,setSnapshot(next){data=next;received=performance.now();},draw};'),port,{filename:'school/yeti.js'});
const duo=portWindow.SchoolYeti.create({reduced:()=>false});
const duoData={room:{status:'fighting',battle:{elapsed:13000,boss:{hp:800000,max:800000},teams:[{isMe:true,units:[{id:'spica',hp:100,max:100,hasteUntil:16000}]},{isMe:false,units:[{id:'lava',hp:100,max:100,hasteUntil:16000}]}]}}};
now=10000;duo.setSnapshot(duoData);duo.draw(now);assert.equal(fieldCalls.at(-1).count,18,'Duo reconnect restores an economical field without old events');
now+=100;duoData.room.battle.elapsed=16000;duo.setSnapshot(duoData);duo.draw(now);assert.equal(fieldCalls.at(-1).count,0,'Duo expiration clears the field');
duoData.room.status='finished';duoData.room.battle.elapsed=14000;now+=100;duo.setSnapshot(duoData);const beforeFinish=fieldCalls.length;duo.draw(now);assert.equal(fieldCalls.length,beforeFinish,'Finished duo stops the blizzard');duo.destroy();
console.log('PASS arena event pruning/merged teams/reduced motion/completion and duo reconnect/expiry/completion controllers');
