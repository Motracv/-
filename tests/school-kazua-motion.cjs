// Actual combat renderer contracts; no browser/layout or mobile FPS claims.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),G=require('../school/engine.js');
let allocated=0,gradients=0;const images=[],listeners=new Map();
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
class Canvas{
 constructor(){this.width=960;this.height=560;this.dataset={};this.id=++allocated;}
 getContext(){return this.context??=context(this);}toDataURL(){return 'data:image/png;base64,'+this.id;}
}
function context(canvas){
 const records=[],stack=[];let matrix=[1,0,0,1,0,0];
 const ctx={canvas,records,stack,globalAlpha:1,globalCompositeOperation:'source-over',
 save(){stack.push([matrix.slice(),this.globalAlpha,this.globalCompositeOperation]);},restore(){assert(stack.length);[matrix,this.globalAlpha,this.globalCompositeOperation]=stack.pop();},
 transform(...a){matrix=multiply(matrix,a);records.push(['transform',...a]);},setTransform(...a){matrix=a;},
 getTransform(){return Object.fromEntries(['a','b','c','d','e','f'].map((k,i)=>[k,matrix[i]]));},
 translate(x,y){this.transform(1,0,0,1,x,y);},scale(x,y){this.transform(x,0,0,y,0,0);},rotate(a){this.transform(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);},
 drawImage(img,...a){for(const n of a)assert(Number.isFinite(n));if(a.length===8){assert(a[0]>=0&&a[1]>=0&&a[2]>0&&a[3]>0);assert(a[0]+a[2]<=img.naturalWidth+.001&&a[1]+a[3]<=img.naturalHeight+.001,'Source crop inside atlas');}records.push(['drawImage',img.src||'canvas:'+img.id,...a,matrix.slice()]);},
 measureText(t){return {width:String(t).length*6};},getImageData(){return {data:new Uint8ClampedArray(4)};},
 createRadialGradient(){gradients++;return {addColorStop(){}};},createLinearGradient(){gradients++;return {addColorStop(){}};}};
 return new Proxy(ctx,{get(o,k){if(k in o)return o[k];return(...a)=>{for(const n of a)if(typeof n==='number')assert(Number.isFinite(n),k+' finite');records.push([k,...a]);};}});
}
class Image{
 constructor(){this.complete=false;this.naturalWidth=1536;this.naturalHeight=1024;images.push(this);}
 set src(v){this._src=v;if(v.includes('kazua/combat'))this.naturalWidth=this.naturalHeight=1254;}
 get src(){return this._src;}load(){this.complete=true;this.onload?.();}
}
const document={hidden:false,createElement:()=>new Canvas()},window={SchoolRPG:G,addEventListener:(k,f)=>{if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(f);},dispatchEvent:e=>{for(const f of listeners.get(e.type)||[])f(e);},requestIdleCallback:f=>queueMicrotask(f)};
const sandbox={window,document,Image,Event,SchoolRPG:G,console,Promise,setTimeout:()=>0,clearTimeout(){}};
vm.createContext(sandbox);for(const file of ['school/kazua-art.js','school/art.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
for(const img of images.filter(i=>i.src.includes('/kazua/')))img.load();
const A=window.SchoolArt,K=window.SchoolKazuaArt,canvas=new Canvas(),c=canvas.getContext('2d');assert(K.assetsReady());
const snap=(mode,age,extra={})=>{c.records.length=0;A.hero(c,'kazua',110,220,2,{kazuaMode:mode,kazuaAge:age,time:age,...extra});assert.equal(c.stack.length,0);return JSON.stringify(c.records);};
const modes=['idle','fire','reload','pistol','bazooka','red','dodge'].map(m=>snap(m,.8));
assert.equal(new Set(modes).size,7,'Live SchoolArt path must forward all modes instead of caching an attack boolean');
for(const age of [.15,.29,.46,.63]){snap('fire',age);assert(c.records.some(r=>r[0]==='drawImage'&&r[1].includes('basic-motion.webp')),'Uses new basic atlas through real SchoolArt.hero');}
assert.equal(new Set([.1,.35,.9,1.5,1.9].map(t=>snap('reload',t))).size,5,'Open/feed/close/raise reload poses');
assert.notEqual(snap('fire',.61),snap('fire',.64),'Subframe upper-body recoil');
for(const flag of ['reduced','dead','frozen','stunned'])assert.equal(snap('fire',1,{[flag]:true}),snap('fire',2,{[flag]:true}),flag+' holds a stable actor');
assert(!snap('fire',1,{kazuaActive:false,reduced:true}).includes('fillRect'),'An ended battle stops animated barrel details');
console.log('PASS actual SchoolArt dispatch: live basic, reload, weapon swaps, recoil and stable blocked/reduced frames');

const metadata=JSON.parse(fs.readFileSync('school/assets/kazua/basic-motion.json','utf8'));
assert.equal(metadata.frames.length,8);assert.equal(K.basicFrames.length,8);
for(const f of metadata.frames){assert.deepEqual(Array.from(K.basicFrames[f.index]),[...f.crop,...f.anchor,...f.muzzle,...f.barrelFace]);assert(f.anchor[1]>=0&&f.anchor[1]<=f.crop[3]);}
const u={id:'kazua',kazua:{phase:'reload',mode:'reload',phaseMs:1500,modeSince:9000,power:1.6}};
assert.equal(A.kazuaFrame(u,9500,9250).kazuaAge,1.75,'Resume belt progress after a pistol interruption');
const saved=JSON.stringify(u);for(let t=0;t<20;t++)A.kazuaFrame(u,9500+t*16,9250);assert.equal(JSON.stringify(u),saved);
for(const mode of ['fire','pistol','bazooka','red'])for(const age of [.2,.55,1.8])for(const reduced of [false,true]){
 const p=K.muzzle(mode,age,reduced);assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert(p.x>15&&p.x<30&&p.y<0&&p.y>-40,'Muzzle remains attached to the forward gun');
}
console.log('PASS measured atlas crops/foot anchors, muzzle attachments and paused reload continuity');

const options={source:{x:120,y:220},targets:Array.from({length:30},(_,i)=>({x:500+i,y:220})),mode:'red',age:2.3,scale:2};
K.effects(c,options);K.effects(c,{...options,mode:'fire'});const warm={allocated,gradients},input=JSON.stringify(options);
let maxCommands=0;
for(let i=0;i<100;i++)for(const mode of ['fire','red','pistol','bazooka']){
 c.records.length=0;K.effects(c,{...options,mode,age:i/59,flip:i%2===0,economy:i%3===0,reduced:i%5===0});maxCommands=Math.max(maxCommands,c.records.length);
 assert.equal(c.stack.length,0);assert.equal(c.globalAlpha,1);assert.equal(c.globalCompositeOperation,'source-over');assert.deepEqual(c.getTransform(),{a:1,b:0,c:0,d:1,e:0,f:0});
}
assert.deepEqual({allocated,gradients},warm,'No steady-state canvas/gradient allocations');assert(maxCommands<850,'Particle workload stays bounded even with 30 target inputs');assert.equal(JSON.stringify(options),input);
for(const mode of ['idle','reload','dodge']){c.records.length=0;K.effects(c,{...options,mode});assert.equal(c.records.length,0,'No firing during '+mode);}
c.records.length=0;K.effects(c,{...options,mode:'fire',age:.05});assert.equal(c.records.length,0,'Brace before firing');
c.records.length=0;K.effects(c,{source:{x:NaN,y:0},targets:[]});assert.equal(c.records.length,0);
console.log('PASS bounded normal/economy/reduced and mirrored gunfire; restored Canvas state, no simulation mutation or per-frame textures');

// Real cooperative/replay controllers: effects must be above the target sprite
// and stop on frozen/withdrawn/dead parties and settled battles.
const duoCanvas=new Canvas(),replayCanvas=new Canvas();duoCanvas.getBoundingClientRect=()=>({width:800,height:448});replayCanvas.getBoundingClientRect=()=>({width:960,height:420});
const nodes={'yeti-canvas':duoCanvas,'yeti-view':{closest:()=>({open:true})},'yeti-warning':{},'yeti-clock':{},'arena-canvas':replayCanvas};
let now=10000,nextFrame=null;const fxCalls=[];
const portWindow={...window,SchoolKazuaArt:{...K,effects(ctx,o){ctx.records.push(['kazua-effects']);fxCalls.push(o);K.effects(ctx,o);}},SchoolRescue:{create:()=>({update(){},destroy(){}})},SchoolYetiRules:{HP:800000,DURATION:210000,PATTERNS:[]}};
const port={...sandbox,window:portWindow,document:{...document,documentElement:{dataset:{}},getElementById:id=>nodes[id]||null},SchoolArt:A,performance:{now:()=>now},devicePixelRatio:1,matchMedia:()=>({matches:false}),requestAnimationFrame:f=>{nextFrame=f;return 1;},cancelAnimationFrame(){nextFrame=null;}};
const duoSource=fs.readFileSync('school/yeti.js','utf8'),duoReturn=duoSource.match(/return \{open,leave,destroy:stop[^;]+;/)[0];
vm.runInNewContext(duoSource.replace(duoReturn,'return {open,leave,destroy:stop,setSnapshot(next){data=next;received=performance.now();},draw};'),port);
const duo=portWindow.SchoolYeti.create({reduced:()=>false});
const gunner=()=>({id:'kazua',hp:100,max:100,kazua:{mode:'fire',phase:'fire',phaseMs:1000,modeSince:12000,power:1}});
const data={room:{status:'fighting',battle:{elapsed:13000,boss:{hp:800000,max:800000},teams:[{isMe:true,units:[gunner()]},{isMe:false,units:[gunner()]}]}}};
function drawDuo(){now+=50;fxCalls.length=0;duoCanvas.getContext().records.length=0;duo.setSnapshot(data);duo.draw(now);}
drawDuo();assert.equal(fxCalls.length,2);assert(fxCalls.every(o=>o.targets[0].x===790&&o.targets[0].aimY===285));
const rec=duoCanvas.getContext().records;assert(rec.findIndex(r=>r[0]==='kazua-effects')>rec.findIndex(r=>r[0]==='ellipse'&&r[1]===790&&r[3]===100),'Yeti is painted before incoming bullet impacts');
for(const field of ['frozen','withdrawn']){data.room.battle.teams[0][field]=true;drawDuo();assert.equal(fxCalls.length,1,field+' team stops shooting');delete data.room.battle.teams[0][field];}
data.room.battle.teams[0].units[0].stunUntil=14000;drawDuo();assert.equal(fxCalls.length,1);delete data.room.battle.teams[0].units[0].stunUntil;
data.room.status='finished';drawDuo();assert.equal(fxCalls.length,0);duo.destroy();

const social=fs.readFileSync('school/social.js','utf8');vm.runInNewContext(social.replace('Object.freeze({create})','Object.freeze({create,replay})'),port);
now=0;fxCalls.length=0;
const match={durationMs:3000,winner:0,teams:[{units:[gunner()]},{units:[gunner()]}],events:[0,1].map(side=>({kind:'kazua-mode',mode:'fire',from:'kazua',side,t:0}))};
const stop=portWindow.SchoolSocial.replay(match,0,()=>true);
for(now=50;now<=900;now+=50){const f=nextFrame;nextFrame=null;f?.(now);}
assert(fxCalls.some(o=>o.flip)&&fxCalls.some(o=>!o.flip),'Both arena sides fire from mirrored guns');
fxCalls.length=0;stop.finish();assert.equal(fxCalls.length,0,'Finishing replay stops gunfire');stop();
console.log('PASS actual duo/replay controllers: two casters, front-layer impacts, mirrored arena, freeze/withdrawal/stun/settlement stop');
