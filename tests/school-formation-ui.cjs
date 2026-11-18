const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),G=require('../school/engine.js');
let clock=0,timer=0;const timers=new Map();
const camel=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
class Element{
 constructor(tag='div',attrs=''){this.tagName=tag;this.children=[];this.parentNode=null;this.dataset={};this.attrs={};this.listeners={};this.style={};this.hidden=false;this.disabled=false;this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,on)=>on===false?this.classes.delete(x):this.classes.add(x),contains:x=>this.classes.has(x)};
  for(const a of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)){this.setAttribute(a[1],a[2]||'');} }
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=v;if(k.startsWith('data-'))this.dataset[camel(k.slice(5))]=String(v);if(k==='class')this.classes=new Set(v.split(' '));}
 append(n){n.parentNode=this;this.children.push(n);}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
 set innerHTML(v){this.html=v;this.children=[];const stack=[this];for(const tag of v.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/g)){if(tag[1]){if(stack.length>1)stack.pop();}else{const n=new Element(tag[2],tag[3]);stack.at(-1).append(n);if(!['img','input','br','hr'].includes(tag[2]))stack.push(n);}}}
 get innerHTML(){return this.html||'';}
 matches(s){if(s.startsWith('#'))return this.id===s.slice(1);if(s.startsWith('.'))return this.classes.has(s.slice(1));const m=s.match(/^\[data-([\w-]+)\]$/);if(m)return camel(m[1]) in this.dataset;return this.tagName===s;}
 querySelectorAll(s){return this.children.flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 closest(s){for(let n=this;n;n=n.parentNode)if(n.matches(s))return n;return null;}
 contains(n){for(;n;n=n.parentNode)if(n===this)return true;return false;}
 addEventListener(k,fn){(this.listeners[k]||=[]).push(fn);}
 emit(k,e={}){e.preventDefault||=()=>e.prevented=true;e.stopPropagation||=()=>{};e.stopImmediatePropagation||=()=>e.stopped=true;for(const fn of this.listeners[k]||[])fn(e);return e;}
 setPointerCapture(id){this.capture=id;}hasPointerCapture(id){return this.capture===id;}releasePointerCapture(){this.capture=null;}
}
const root=new Element(),body=new Element('body');body.append(root);root.innerHTML=fs.readFileSync('school.html','utf8').split('<article class="tab-panel" id="tab-roster" hidden>')[1].split('</article>')[0];
const document=new Element(),window=new Element();document.body=body;document.hidden=false;document.createElement=tag=>new Element(tag);let hit=null;document.elementFromPoint=()=>hit;
window.SchoolRPG=G;window.SchoolArt={portrait:id=>'portrait-'+id};
vm.runInNewContext(fs.readFileSync('school/formation.js','utf8'),{window,document,performance:{now:()=>clock},setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
const tick=()=>{clock+=330;for(const [id,fn] of [...timers]){timers.delete(id);fn();}};
let s=G.create(Date.now(),42),scope='a',blocked=false,activity=false,modal=false,opened=[],actions=[],message='',waiter=null;
for(const id of ['osia','lava','horas','ryusion'])s.units[id]={level:70,stars:2,xp:0,shards:0};
const ui=window.SchoolFormation.create(root,{getState:()=>s,scope:()=>scope,blocked:()=>blocked,activityActive:()=>activity,modalOpen:()=>modal,toast:m=>message=m,openHero:id=>opened.push(id),dispatch:async a=>{actions.push(a);if(waiter)await new Promise(r=>waiter=r);G.action(s,a,s.at);}});
const find=(key,value)=>root.querySelectorAll(`[data-${key}]`).find(n=>n.dataset[camel(key)]===String(value));
const click=n=>root.emit('click',{target:n});const pointer=(node,extra={})=>({target:node,button:0,isPrimary:true,pointerId:7,clientX:20,clientY:30,...extra});
(async()=>{
 ui.refresh();assert.equal(root.querySelectorAll('[data-form-slot]').length,6);assert(root.querySelector('#formation-power').textContent);
 click(find('form-detail','osia'));assert.deepEqual(opened,['osia']);assert.equal(actions.length,0);
 click(find('form-select','osia'));click(find('form-target','1'));await flush();assert.equal(s.team[1],'osia');assert.equal(actions.length,1);
 const before=s.team.slice();root.emit('pointerdown',pointer(find('form-drag','osia')));tick();hit=find('form-slot','0');window.emit('pointerup',pointer(hit));await flush();assert.equal(s.team[0],'osia');assert.equal(s.team[1],before[0]);assert.equal(new Set(s.team).size,s.team.length);assert.equal(body.querySelectorAll('.formation-drag-ghost').length,0);
 clock+=700;click(find('form-role','치유'));assert(!find('form-detail','osia'));assert(find('form-detail','lava'));click(find('form-role','all'));
 root.emit('pointerdown',pointer(find('form-drag','lava')));window.emit('pointermove',pointer(root,{clientY:60}));tick();window.emit('pointerup',pointer(root));await flush();assert.equal(actions.length,2);
 root.emit('pointerdown',pointer(find('form-drag','lava')));tick();const touch=root.emit('touchmove',{});assert(touch.prevented);window.emit('pointercancel',{});hit=find('form-slot','0');window.emit('pointerup',pointer(hit));await flush();assert.equal(actions.length,2);
 clock+=700;root.emit('pointerdown',pointer(find('form-drag','lava')));tick();scope='b';hit=find('form-slot','0');window.emit('pointerup',pointer(hit));await flush();assert.equal(actions.length,2);ui.refresh();
 clock+=700;click(find('form-select','lava'));const esc=document.emit('keydown',{key:'Escape'});assert(esc.prevented&&esc.stopped);click(find('form-target','0'));assert.equal(opened.at(-1),'osia');
 blocked=true;ui.controls();assert(find('form-select','lava').disabled);blocked=false;activity=true;ui.controls();assert(find('form-select','lava').disabled);activity=false;ui.controls();
 s.team=['osia'];ui.refresh();click(find('form-remove','osia'));await flush();assert.equal(actions.length,2);assert(message.includes('최소 한 명'));
 waiter=true;click(find('form-select','lava'));click(find('form-target','5'));assert.equal(actions.length,3);assert(find('form-select','lava').disabled);click(find('form-select','lava'));assert.equal(actions.length,3);const release=waiter;waiter=null;release();await flush();assert.deepEqual(s.team,['osia','lava']);
 const place=window.SchoolFormation.place;const all=['osia','lava','horas','ryusion','sua','taeo'];assert.deepEqual(Array.from(place(all,'lava',5,s.units)),['osia','taeo','horas','ryusion','sua','lava']);assert.deepEqual(Array.from(place(all,'lumi',1,s.units)),all);assert.deepEqual(Array.from(place(all,'osia',-1,s.units)),all);
 const html=fs.readFileSync('school.html','utf8'),sw=fs.readFileSync('school-sw.js','utf8');for(const file of ['formation.js','formation.css']){assert(html.includes('school/'+file));assert(sw.includes("'"+file+"'"));}
 assert(new RegExp('CATALOG_VERSION\\s*=\\s*'+G.CATALOG_VERSION+'\\b').test(fs.readFileSync('school/engine.js','utf8')));assert(sw.includes('\\s*'+G.CATALOG_VERSION+'\\b'));
 console.log('PASS detail tap, click-to-place, long-press swap, scroll/cancel, account switch, Escape, blocked/dungeon locks, last-member guard, save lock, six unique slots and offline wiring');
})().catch(e=>{console.error(e);process.exitCode=1;});
