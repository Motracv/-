// Owner-only divine Osia rendering contracts; actual dispatch with a recording canvas.
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
 set src(v){this._src=v;if(v.includes('portrait')){this.naturalWidth=1024;this.naturalHeight=1536;}if(v.includes('spica/combat-horas')){this.naturalWidth=1774;this.naturalHeight=887;}if(v.includes('battlefields')){this.naturalWidth=887;this.naturalHeight=578;}if(v.includes('chapters-13-15')){this.naturalWidth=1024;this.naturalHeight=1536;}}
 get src(){return this._src;}
 load(){this.complete=true;this.onload?.();}
}
const document={hidden:false,createElement:()=>new Canvas()},window={SchoolRPG:G,
 addEventListener(k,f){if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(f);},
 dispatchEvent(e){for(const f of listeners.get(e.type)||[])f(e);},requestIdleCallback:f=>queueMicrotask(f)};
const sandbox={window,document,SchoolRPG:G,Image,Event,console,Uint8ClampedArray,Promise,
 setTimeout:f=>0,clearTimeout(){}};
const load=file=>vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
load('school/osia-weapon-art.js');load('school/battle-polish.js');load('school/art.js');sandbox.SchoolArt=window.SchoolArt;load('school/raid-vfx.js');
const W=window.SchoolOsiaWeaponArt,A=window.SchoolArt,canvas=new Canvas(),c=canvas.getContext('2d');
const ex={id:'osia_scepter'},owner={id:'osia',exclusive:ex};
assert(W.equipped(owner));assert(!W.equipped({id:'taeo',exclusive:ex}));assert(!W.equipped({id:'osia'}));
const shot=(id,frame)=>{c.records.length=0;A.hero(c,id,120,220,2,frame);assert.equal(c.stack.length,0);return JSON.stringify(c.records);};
const idle=shot('osia',{time:1,reduced:true});
assert.equal(idle,shot('osia',{time:1,reduced:true,exclusive:{id:'lava_fan'}}));
assert.notEqual(idle,shot('osia',{time:1,reduced:true,exclusive:ex}),'Only equipped Osia gains a spear');
for(const state of ['reduced','stunned','frozen','dead'])assert.equal(shot('osia',{time:1,exclusive:ex,[state]:true}),shot('osia',{time:2,exclusive:ex,[state]:true}),state+' keeps equipped actor still');
console.log('PASS owner gating and stable blocked/reduced floating weapon');
const opt={source:{x:120,y:220},target:{x:380,y:200},age:.6};
W.dragon(c,opt);assert(!W.assetsReady(),'Fallback is available before image loads');
images.find(i=>i.src.includes('divine-dragon')).load();assert(W.assetsReady());W.dragon(c,opt);
const atlas=images.find(i=>i.src.includes('divine-dragon-motion'));atlas.load();assert(W.motionReady());
const usedFrames=new Set();
for(let i=0;i<12;i++){
 const age=W.frameTimes[i]+.02;c.records.length=0;W.dragon(c,{...opt,age});
 assert.equal(W.motion(age).frame,i);usedFrames.add(W.motion(age).frame);
 const slices=c.records.filter(r=>r[0]==='drawImage'&&r[1]===atlas);
 assert.equal(slices.length,16,'Animated anatomy uses a bounded continuous spine mesh');
 for(const r of slices){const [,img,x,y,w,h]=r;assert(x>=i%4*384&&x+w<=(i%4+1)*384+.001);assert.equal(y,Math.floor(i/4)*1024/3);assert(y+h<=img.naturalHeight+.001);}
}
assert.equal(usedFrames.size,12,'Every authored attack pose is displayed');
const meshAt=age=>{c.records.length=0;W.dragon(c,{...opt,age});return JSON.stringify(c.records.filter(r=>r[0]==='transform'&&r[2]!==0));};
assert.equal(W.motion(.55).frame,W.motion(.60).frame);assert.notEqual(meshAt(.55),meshAt(.60),'Tail and spine continue moving between key poses');
c.records.length=0;W.dragon(c,{...opt,reduced:true});assert.equal(c.records.filter(r=>r[0]==='drawImage'&&r[1]===atlas).length,1,'Reduced motion uses one stable pose without a spine warp');
console.log('PASS 12 real poses, cell-isolated cropping, continuous spine/tail motion and reduced-motion fallback');
const warm={allocated,gradients},input=JSON.stringify(opt);let maxCommands=0;
for(let i=0;i<100;i++)for(const effect of ['dragon','drowning']){
 c.records.length=0;c.globalAlpha=.65;const before=c.getTransform();
 W[effect](c,{...opt,source:i%2?opt.source:opt.target,target:i%2?opt.target:opt.source,age:i/55,reduced:i%4===0,economy:i%3===0});
 assert.equal(c.stack.length,0);assert.equal(c.globalAlpha,.65);assert.deepEqual(c.getTransform(),before);maxCommands=Math.max(maxCommands,c.records.length);
}
assert.deepEqual({allocated,gradients},warm,'No steady-state texture or gradient allocation');assert(maxCommands<420,'Effects have a bounded draw budget: '+maxCommands);assert.equal(JSON.stringify(opt),input);
for(const effect of ['dragon','drowning'])for(const bad of [{age:-1},{age:4},{source:{x:NaN,y:0}},{target:null}]){
 c.records.length=0;W[effect](c,{...opt,...bad});assert.equal(c.records.length,0,'Expired or invalid effect does not draw');
}
c.globalAlpha=1;
console.log('PASS loaded/fallback dragon, bounded mirrored effects, finite geometry and immutable simulation inputs');
let dragons=0,drownings=0;
window.SchoolOsiaWeaponArt={...W,dragon(...args){dragons++;return W.dragon(...args);},drowning(...args){drownings++;return W.drowning(...args);}};
const s=G.create(1000,991);s.team=['osia','harin','sua'];for(const id of s.team)s.units[id]={level:70,xp:0,stars:1,shards:0,nextSkill:1};
G.action(s,{kind:'stage',stage:1,mode:'farm'},s.at);s.battle.elapsed=10000;s.simTime=10000;s.battle.heroes.find(h=>h.id==='osia').exclusive=ex;
const enemy=s.battle.enemies[0].id,events=[{kind:'osia-drowning',from:'osia',to:enemy,time:10},{kind:'skill-stage',from:'osia',stage:4,castId:42,name:'용의 신수',time:10,cinematicDuration:1000,impactDelay:1000,targets:[enemy]},{kind:'skill-impact',castId:42,time:10}];
s.battle.cinematic={castId:42,duration:1000,remaining:400,nonBlocking:true};
const stateBefore=JSON.stringify(s);A.draw(c,s,10.6,events,false);assert.equal(dragons,1);assert.equal(drownings,1);assert.equal(JSON.stringify(s),stateBefore);
delete s.battle.heroes.find(h=>h.id==='osia').exclusive;A.draw(c,s,10.6,events,false);assert.equal(dragons,1);assert.equal(drownings,1);
console.log('PASS campaign dispatch honors owner equipment and starts divine effects during nonblocking cut-in');
const unit={id:'osia',hp:100,max:100,exclusive:ex,energy:1,stunUntil:0},battle={elapsed:10000,boss:{},teams:[{units:[unit]}]};
const raid={w:960,h:420,now:10600,received:10000,visualTime:10600,dt:16,battle,focus:0,events:[{team:0,id:'osia',kind:'cast',stage:4,shown:10000},{team:0,id:'osia',kind:'osia-drowning',shown:10000}],bg:{},atlas:{},bars:new Map(),reduced:false,units:[unit],live:true,hp:100};
window.SchoolRaidFX.draw(c,raid);assert.equal(dragons,2);assert.equal(drownings,2);
delete unit.exclusive;window.SchoolRaidFX.draw(c,raid);assert.equal(dragons,2);assert.equal(drownings,2);assert.equal(c.stack.length,0);
console.log('PASS real raid rendering dispatch, owner-only divine effects and restored canvas state');

const socialSource=fs.readFileSync('school/social.js','utf8').replace('Object.freeze({create})','Object.freeze({create,replay})');
function arenaCase(rightWeapon,reduced){
 const replayCanvas=new Canvas();replayCanvas.getBoundingClientRect=()=>({width:960,height:420});
 let nextFrame=null,now=0;const calls=[],frames=[];
 const portWindow={...window,SchoolOsiaWeaponArt:{...W,dragon(ctx,opt){calls.push({kind:'dragon',...opt});return W.dragon(ctx,opt);},drowning(ctx,opt){calls.push({kind:'drowning',...opt});return W.drowning(ctx,opt);}},SchoolArt:{...A,hero(ctx,id,x,y,scale,frame){frames.push({id,x,frame});return A.hero(ctx,id,x,y,scale,frame);}}};
 const port={...sandbox,window:portWindow,document:{...document,documentElement:{dataset:{}},getElementById:id=>id==='arena-canvas'?replayCanvas:null},devicePixelRatio:1,matchMedia:()=>({matches:reduced}),requestAnimationFrame:f=>{nextFrame=f;return 1;},cancelAnimationFrame(){nextFrame=null;}};
 vm.runInNewContext(socialSource,port);
 const match={durationMs:3000,winner:0,teams:[{units:[{id:'osia',max:100,exclusive:ex}]},{units:[{id:'osia',max:100,...(rightWeapon?{exclusive:ex}:{})},{id:'harin',max:100}]}],events:[
  {kind:'skill',side:0,from:'osia',toSide:1,target:'osia',stage:4,skill:'용의 신수',t:0},
  {kind:'skill',side:0,from:'osia',toSide:1,target:'harin',stage:4,skill:'용의 신수',t:0},
  {kind:'skill',side:1,from:'osia',toSide:0,target:'osia',stage:4,skill:'용의 신수',t:0},
  ...[0,1].map(side=>({kind:'osia-drowning',side,from:'osia',toSide:1-side,target:'osia',targetId:'osia',duration:2000,t:200}))]};
 const saved=JSON.stringify(match),stop=portWindow.SchoolSocial.replay(match,0,()=>true);
 let late=false,left=false,right=false,drowning=false;
 for(now=50;now<=1850;now+=50){calls.length=0;const f=nextFrame;nextFrame=null;f?.(now);const dragons=calls.filter(x=>x.kind==='dragon');assert(dragons.length<=(rightWeapon?2:1),'One dragon per cast, not per area victim');for(const call of calls){left||=call.source.x<call.target.x;right||=call.source.x>call.target.x;drowning||=call.kind==='drowning';late||=call.kind==='dragon'&&call.age>1;}}
 assert(left);assert.equal(right,rightWeapon);assert(drowning);assert(late,'Divine effects outlive generic 800ms damage text');assert(frames.some(f=>f.id==='osia'&&f.x<480&&f.frame.exclusive?.id==='osia_scepter'));
 calls.length=0;stop.finish();assert.equal(calls.length,0,'Settled replay stops divine effects');stop();assert.equal(JSON.stringify(match),saved);assert.equal(replayCanvas.getContext('2d').stack.length,0);
}
arenaCase(false,false);arenaCase(true,true);
console.log('PASS arena owner gating, mirrored sides, reduced motion, single area-cast dragon, spear frame and replay completion');

// Effects must leave the clean sprite visible when an attack ends or control
// is lost, including a mirrored opponent with a previously selected pose.
images.find(i=>i.src.includes('osia-sprites.png')).load();
for(let pose=0;pose<6;pose++)shot('osia',{pose,reduced:true});
const palm={pose:1,reduced:true},cleanPalm=shot('osia',palm);
assert.notEqual(cleanPalm,shot('osia',{...palm,ready:true}),'Preparing magic adds a hand effect');
for(const state of ['frozen','stunned']){
 assert.equal(shot('osia',{...palm,[state]:true}),shot('osia',{...palm,[state]:true,ready:true,casting:true,attack:true,attackAge:.12}),state+' hides stale hand magic');
}
const cleanIdle=shot('osia',{reduced:true});
assert.equal(cleanIdle,shot('osia',{reduced:true,attackAge:2}),'Expired basic attack has no lingering effect');
assert.equal(cleanIdle,shot('osia',{reduced:true,attack:true,attackAge:.7}),'Long raid attack flags cannot restart the release pose after recovery');
assert.equal(cleanIdle,shot('osia',{reduced:true,attackAge:null}),'Absent attack age stays idle');
assert.notEqual(shot('osia',{attackAge:.1}),shot('osia',{attackAge:.5}),'Release settles into a clean recovery pose');
const warmHands={allocated,gradients};
for(const flip of [false,true])for(const reduced of [false,true])for(let i=0;i<50;i++){
 const frame={flip,reduced,pose:1,casting:true,motion:{age:i/100,lean:0,stretch:1}};
 const before=JSON.stringify(frame),alpha=c.globalAlpha,transform=c.getTransform();
 shot('osia',frame);assert.equal(JSON.stringify(frame),before);assert.equal(c.globalAlpha,alpha);assert.deepEqual(c.getTransform(),transform);
}
assert.deepEqual({allocated,gradients},warmHands,'Hand magic does not allocate textures or gradients each frame');
console.log('PASS clean Osia hand effects, expiry, recovery, blocked actors, mirror/reduced mode and bounded allocation');
