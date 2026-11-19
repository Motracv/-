const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),G=require('../school/engine.js');
const ID='horas_after_school';let root=null,kind='',frames=new Map(),next=0,calls=[],scope='a',blocked=false,back=0,ui,time=100;
const canvasContext=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
class Node{constructor(data={}){this.dataset=data;this.attributes={};this.isConnected=true;this.child=new Map();}setAttribute(k,v){this.attributes[k]=v;}querySelector(q){if(!this.child.has(q))this.child.set(q,new Node());return this.child.get(q);}}
function makeRoot(){const r=new Node(),buttons=[new Node({skin:''}),new Node({skin:ID})],poses=['idle','basic1','basic2','skill'].map(p=>new Node({pose:p}));r.querySelectorAll=q=>q==='[data-skin]'?buttons:q==='[data-pose]'?poses:[];const canvas=new Node();canvas.getContext=()=>canvasContext;r.child.set('canvas',canvas);r.child.set(`[data-skin="${ID}"] img`,buttons[1].querySelector('img'));return r;}
const window={SchoolRPG:G,SchoolArt:{rosterPortrait:()=>'',hero(...a){calls.push(['hero',a[5]]);},horasVisualEffects(){}},SchoolHorasSkinArt:{active:id=>id===ID,ready:Promise.resolve(),effects(c,o){calls.push(['effect',o]);}}};
const document={hidden:false,querySelector:()=>root};vm.runInNewContext(fs.readFileSync('school/skins.js','utf8'),{window,document,performance:{now:()=>time},requestAnimationFrame:fn=>{const id=++next;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
let s=G.create();s.units.horas={level:1,stars:0,xp:0,shards:0};
ui=window.SchoolSkins.create({getState:()=>s,scope:()=>scope,blocked:()=>blocked,reduced:()=>false,openModal(t,html,k){ui.destroy();kind=k;if(root)root.isConnected=false;root=makeRoot();assert(html.includes('공격력'));},openHero(){ui.destroy();back++;},dispatch:async input=>{calls.push(['dispatch',input]);G.action(s,input,s.at);}});
const tick=()=>{const before=[...frames.entries()];frames.clear();for(const [,f] of before)f(time+=100);};
(async()=>{
 ui.open();assert.equal(kind,'skin');assert.equal(frames.size,1);assert(root.querySelector('[data-skin-equip]').disabled);
 root.querySelectorAll('[data-skin]')[1].onclick();assert(root.querySelector('[data-skin-equip]').disabled);assert.match(root.querySelector('[data-skin-status]').textContent,/획득/);
 tick();assert.equal(calls.findLast(x=>x[0]==='hero')[1].skin,ID);assert.equal(G.equippedSkin(s,'horas'),null,'Preview never equips');assert.equal(frames.size,1);
 s.redeemedCodes.push(G.SKINS[ID].receipt);ui.refresh();assert(!root.querySelector('[data-skin-equip]').disabled);
 blocked=true;ui.refresh();assert(root.querySelector('[data-skin-equip]').disabled);await root.querySelector('[data-skin-equip]').onclick();assert.equal(G.equippedSkin(s,'horas'),null);
 blocked=false;ui.refresh();await root.querySelector('[data-skin-equip]').onclick();assert.equal(G.equippedSkin(s,'horas'),ID);assert(root.querySelector('[data-skin-equip]').disabled);
 root.querySelectorAll('[data-pose]')[3].onclick();tick();assert(calls.some(x=>x[0]==='effect'&&x[1].kind==='cast'));
 root.querySelectorAll('[data-skin]')[0].onclick();await root.querySelector('[data-skin-equip]').onclick();assert.equal(G.equippedSkin(s,'horas'),null);
 ui.open();assert.equal(frames.size,1);root.querySelector('[data-skin-back]').onclick();assert.equal(back,1);assert.equal(frames.size,0);
 ui.open();scope='b';ui.refresh();assert.equal(frames.size,0);ui.open();ui.destroy();assert.equal(frames.size,0);console.log('PASS real wardrobe handlers, locked preview, saved equip/base restore, blocked input, cast preview, back/account switch and bounded RAF cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});
