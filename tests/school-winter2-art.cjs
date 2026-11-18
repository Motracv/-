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
 set src(v){this._src=v;if(v.includes('portrait')){this.naturalWidth=1024;this.naturalHeight=1536;}if(v.includes('battlefields')){this.naturalWidth=887;this.naturalHeight=578;}}
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
const anchors=JSON.parse(fs.readFileSync('school/assets/spica/atlas.json')).poses;
for(let pose=0;pose<6;pose++){
 c.records.length=0;A.hero(c,'spica',0,0,1,{pose,reduced:true});
 const draw=c.records.find(r=>r[0]==='drawImage');assert(draw);
 assert(Math.abs(draw[2]+anchors[pose].anchorX*46/432)<1e-9);
 assert(Math.abs(draw[3]+anchors[pose].anchorY*46/432)<1e-9);
}
assert.equal(A.poseForSkill('spica',1,.4).pose,2);assert.equal(A.poseForSkill('spica',1,.9).pose,3);
const warm=allocated;for(let n=0;n<200;n++)A.hero(c,'spica',100,120,1,{pose:n%6,reduced:true});assert.equal(allocated,warm);
console.log('PASS six atlas poses use measured foot anchors; haste/slow poses distinct and 200 repeats allocate no canvases');
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
