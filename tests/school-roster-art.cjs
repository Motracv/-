// Decode the shipped atlases and exercise the production renderer on native
// Canvas. These checks do not claim browser/device FPS or network performance.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const fixture=require('../tools/roster-render-fixture.cjs');
const {loadImage}=require('@napi-rs/canvas');
const hash=cv=>crypto.createHash('sha256').update(cv.toBuffer('image/png')).digest('hex');
(async()=>{
 const {G,window:W,canvas,allocations}=await fixture(),A=W.SchoolArt,R=W.SchoolRosterArt;
 const generic=G.HEROES.filter(h=>['R','SR'].includes(h.rarity)||['ian','lumi'].includes(h.id));
 assert.equal(generic.length,13);assert.deepEqual([...R.ids].sort(),generic.map(h=>h.id).sort());
 const cv=canvas(400,360),c=cv.getContext('2d');
 function render(id,frame={}){c.clearRect(0,0,400,360);A.hero(c,id,200,270,4,frame);return hash(cv);}
 for(const h of G.HEROES){
  render(h.id,{reduced:true});const p=c.getImageData(0,0,400,360).data;let count=0,bottom=0,top=360;
  for(let y=0;y<360;y++)for(let x=0;x<400;x++)if(p[(y*400+x)*4+3]>128){count++;bottom=Math.max(bottom,y);top=Math.min(top,y);}
  assert(count>700&&count<400*360*.4,h.id+' visible sprite without an opaque background');
  assert(bottom>=260&&bottom<=285,h.id+' planted feet');assert(top>20&&top<160,h.id+' consistent on-field height');
  assert.equal(p[3],0,h.id+' transparent corner');
 }
 console.log('PASS all 20 characters decode, draw at useful sizes, and retain transparent backgrounds and foot anchors');
 for(const h of G.HEROES){
  const url=A.portrait(h.id),image=await loadImage(url),card=canvas(160,192),cc=card.getContext('2d');cc.drawImage(image,0,0);
  const pixels=cc.getImageData(0,0,160,192).data;
  for(let y=0;y<192;y++)for(let x=0;x<160;x++)if(x<5||x>=155||y<5||y>=187)assert(pixels[(y*160+x)*4+3]<20,h.id+' head/weapon stays inside portrait padding');
  assert.equal(A.rosterPortrait(h.id),url,h.id+' same framed portrait across inventory and codex');
 }
 console.log('PASS all 20 card portraits retain head/weapon padding and shared framing');
 for(const h of generic){
  assert(A.assetsReady(h.id));
  const poses=[{}, {attackAge:.08}, {attackAge:.35}, {casting:true,castAge:.45}].map(f=>render(h.id,{reduced:false,...f}));
  assert.equal(new Set(poses).size,4,h.id+' four different illustrated poses');
  assert(new Set([0,.5,1,1.5,2,3].map(time=>render(h.id,{time}))).size>1,h.id+' idle breathing across its cycle');
  assert.notEqual(render(h.id,{attackAge:.35}),render(h.id,{attackAge:.35,flip:true}),h.id+' PvP facing');
  for(const state of ['frozen','stunned','dead']){
   assert.equal(render(h.id,{[state]:true,time:1,casting:true,castAge:.4,attackAge:.35}),render(h.id,{[state]:true,time:2}),h.id+' '+state+' cancels attacks and effects');
  }
  assert.equal(render(h.id,{reduced:true,time:1}),render(h.id,{reduced:true,time:2}));
  const before=allocations();
  for(let k=0;k<100;k++)A.hero(c,h.id,200,270,1.3,{time:k/60,casting:k%2===0,castAge:k%50/60,attackAge:k%48/60});
  assert.equal(allocations(),before,h.id+' no canvases allocated during repeated battle animation');
 }
 console.log('PASS 13 new pose sets, idle motion, basic/skill effects, mirrored teams, status interruption and zero per-frame surface allocation');
 // The module can fail/finish loading after the game has already drawn its
 // fallback; drawing becomes available without restarting or touching saves.
 const pending=[],events=[],win={SchoolRPG:G,dispatchEvent:e=>events.push(e.type)};
 class DelayedImage{constructor(){pending.push(this)}set src(v){this.path=v}}
 vm.runInNewContext(fs.readFileSync('school/roster-art.js','utf8'),{window:win,Image:DelayedImage,Event,Promise,setTimeout:()=>0,clearTimeout(){}});
 assert.equal(win.SchoolRosterArt.draw(c,'harin',0,0),false);
 pending[0].onerror();await Promise.resolve();assert.equal(win.SchoolRosterArt.assetsReady('harin'),false);
 pending[0].onload();assert.equal(win.SchoolRosterArt.assetsReady('harin'),true);assert(events.includes('school-art-ready'));
 for(const item of pending.slice(1))item.onload();await win.SchoolRosterArt.ready;
 assert.equal(R.draw(c,'missing',0,0),false);assert.equal(R.draw(c,'harin',NaN,0),false);
 console.log('PASS failed and late image loads preserve fallback and announce recovery');
 const state=G.create(1000,991);state.team=['geonu','nari','harin','siu','yuna','lumi'];state.best=75;
 for(const id of state.team)state.units[id]={level:70,xp:0,stars:1,shards:0,nextSkill:1,basicHits:0};
 G.action(state,{kind:'stage',stage:31,mode:'farm'},state.at);state.battle.elapsed=10000;state.simTime=10000;
 const battle=canvas(960,560),bc=battle.getContext('2d'),before=JSON.stringify(state);
 const effects=state.team.map((id,i)=>({kind:i%2?'skill':'hit',from:id,to:state.battle.enemies[0].id,amount:20,time:10}));
 for(const layout of ['','panorama']){battle.dataset.layout=layout;for(let k=0;k<12;k++)A.draw(bc,state,10+k/20,effects,false);}
 assert.equal(JSON.stringify(state),before,'Artwork never changes HP, costs, buffs, cooldowns or saved data');
 const manifest=JSON.parse(fs.readFileSync('school/assets/roster-remake/atlas.json'));
 for(const [key,sheet]of Object.entries(manifest.sheets)){
  assert(fs.statSync('school/assets/roster-remake/'+sheet.file).size>10000);
  for(const frame of sheet.frames){
   assert(Math.abs(frame.destination[0]+frame.source.footX*frame.scale-sheet.foot[0])<1e-8,key+' horizontal anchor');
   assert(Math.abs(frame.destination[1]+frame.source.footY*frame.scale-sheet.foot[1])<1e-8,key+' vertical anchor');
  }
 }
 console.log('PASS live campaign rendering is read-only in both layouts; all atlas frames preserve measured anchors');
})().catch(e=>{console.error(e);process.exitCode=1});
