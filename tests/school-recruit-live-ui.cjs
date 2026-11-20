'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.SCHOOL_DOM_MODULE||'linkedom');
const G=require('../school/engine.js'),D=require('../school/recruit/data.js'),C=require('../school/recruit/cinema.js');
const base=path.resolve(__dirname,'..'),flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
function mount({reduced=false,fail=false,delayed=false}={}){
  const {window}=parseHTML('<html><body></body></html>'),{document}=window;
  let now=0,index=0;const raf=new Map(),timers=new Map(),requested=[],waiters=[],draws=[],events=new Map();
  Object.defineProperty(document,'hidden',{value:false,writable:true});
  window.HTMLElement.prototype.focus=function(){};
  window.HTMLElement.prototype.showModal=function(){this.open=true;};
  window.HTMLElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
  window.HTMLCanvasElement.prototype.getContext=function(){return {clearRect(){}};};
  const media={matches:reduced,addEventListener(){},removeEventListener(){}};
  class Image{
    naturalWidth=1254;
    set src(url){if(!url)return;requested.push(url);assert(fs.existsSync(path.join(base,url.split('?')[0])),'Missing asset '+url);const run=()=>{if(fail)this.onerror?.();else this.onload?.();};if(delayed)waiters.push(run);else queueMicrotask(run);}
    decode(){return Promise.resolve();}
  }
  const ctx={document,Image,console,queueMicrotask,SchoolRecruitData:D,SchoolRecruitCinema:{...C,actor(...args){draws.push({kind:'actor',pose:args[6]});},effects(...args){draws.push({kind:'effects',time:args[3]});}},matchMedia:()=>media,devicePixelRatio:2,
    requestAnimationFrame(fn){raf.set(++index,fn);return index;},cancelAnimationFrame(id){raf.delete(id);},
    setTimeout(fn,ms){timers.set(++index,{fn,ms});return index;},clearTimeout(id){timers.delete(id);},
    addEventListener(k,fn){if(!events.has(k))events.set(k,new Set());events.get(k).add(fn);},removeEventListener(k,fn){events.get(k)?.delete(fn);},
    fetch(){throw Error('Presentation must never submit or reroll a draw');}
  };
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(base,'school/recruit/scene.js'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(path.join(base,'school/presentation.js'),'utf8'),ctx);
  ctx.SchoolPresentation.configure({heroInfo:id=>G.BY_ID[id],soundEnabled:()=>false,reducedMotion:()=>reduced});
  return {ctx,document,window,raf,timers,requested,waiters,draws,events,$:s=>document.querySelector(s),
    step(ms=100){now+=ms;const batch=[...raf.values()];raf.clear();for(const fn of batch)fn(now);assert(raf.size<=1,'Only one live animation loop');},
    advance(count){for(let i=0;i<count;i++)this.step();},
    hidden(value){document.hidden=value;document.dispatchEvent(new window.Event('visibilitychange'));},
    resize(){for(const fn of events.get('resize')||[])fn();},
    direct(id='horas'){const host=document.createElement('dialog');document.body.append(host);return ctx.SchoolRecruitScene.create(host,{hero:G.BY_ID[id],reduced});}
  };
}
(async()=>{
  const m=mount(),S=m.ctx.SchoolRecruitScene;
  assert.equal(S.highest([{id:'nari'},{id:'horas'},{id:'hyeokjin'}],id=>G.BY_ID[id]).id,'horas');
  assert.equal(S.highest([{id:'harin'},{id:'taeo'}],id=>G.BY_ID[id]).id,'harin');
  assert(G.HEROES.every(h=>S.available(h.id)));assert(S.DIALOGUE_AT>14.5);
  const scene=m.direct('hyeokjin');await flush();assert.equal(m.requested.length,3,'Load only two shared images plus the chosen atlas');
  m.advance(94);assert.equal(m.$('.recruit-stage').dataset.phase,'sigil');assert.equal(m.$('.recruit-dialogue').hidden,true);
  const t=scene.time;m.hidden(true);assert.equal(m.raf.size,0);m.step(60000);assert.equal(scene.time,t);m.hidden(false);m.step(60000);assert.equal(scene.time,t,'No hidden-time jump');
  m.resize();m.step();assert(scene.time<t+.11);
  m.advance(45);assert.equal(m.$('.recruit-dialogue').hidden,true,'Greeting waits until effects settle');m.advance(25);assert.equal(m.$('.recruit-speaker').textContent,'서혁진');assert(m.$('.recruit-line').textContent.length>0);
  m.advance(70);assert(scene.held);assert.equal(m.raf.size,0,'Hold stops Canvas work');assert.equal(m.$('.recruit-line').textContent,D.heroes.hyeokjin.greeting);
  m.$('.recruit-continue').click();assert.equal((await scene.done).cancelled,undefined);assert.equal(m.timers.size,0);assert.equal(m.events.get('resize').size,0);
  const reduced=mount({reduced:true});const r=reduced.direct('sua');await flush();assert(r.held);assert.equal(reduced.raf.size,0);r.destroy();assert.equal((await r.done).cancelled,true);
  const broken=mount({fail:true});const f=broken.direct();await flush();assert.equal((await f.done).fallback,true);assert.equal(broken.raf.size,0);assert.equal(broken.timers.size,0);
  const slow=mount({delayed:true});const load=slow.direct();slow.$('.recruit-skip').click();assert.equal((await load.done).skipped,true);slow.waiters.forEach(fn=>fn());await flush();assert.equal(slow.raf.size,0);assert.equal(slow.timers.size,0);
  const timeout=mount({delayed:true});const to=timeout.direct();for(const timer of [...timeout.timers.values()])timer.fn();await flush();assert.equal((await to.done).fallback,true);
  const prod=mount({reduced:true}),P=prod.ctx.SchoolPresentation;
  const results=[{id:'taeo',fresh:false,shards:5},{id:'osia',fresh:true,shards:0},{id:'horas',fresh:true,shards:0}],before=JSON.stringify(results);
  const p=P.recruit({results,key:'test-confirmed-result'});assert.strictEqual(P.recruit({results,key:'test-confirmed-result'}),p,'Repeated receipt shares one presentation');await flush();assert.equal(prod.$('.recruit-name').textContent,'호라스');
  assert.equal(prod.$('dialog').dataset.cinematic,'awakening');assert(prod.$('dialog').open);prod.$('.recruit-continue').click();assert.equal((await p).cancelled,false);assert.equal(P.busy,false);assert.equal(JSON.stringify(results),before,'Original order and rewards unchanged');
  assert.strictEqual(P.recruit({results,key:'test-confirmed-result'}),p);assert.equal(P.busy,false,'Same key never replays or recharges');
  const p2=P.recruit({results:[{id:'nari'}],key:'another'});await flush();P.skip();assert.equal((await p2).skipped,true);assert.equal(prod.raf.size,0);
  const p3=P.recruit({results:[{id:'kazua'}],key:'cancelled-account'});await flush();P.cancel();assert.equal((await p3).cancelled,true);assert.equal(prod.raf.size,0);
  const bad=mount({fail:true});const p4=bad.ctx.SchoolPresentation.recruit({results:[{id:'harin'}],key:'failure'});await flush();assert.equal((await p4).fallback,true);assert.equal(bad.ctx.SchoolPresentation.busy,false);
  const html=fs.readFileSync(path.join(base,'school.html'),'utf8');for(const file of ['data.js','cinema.js','scene.js','scene.css'])assert(html.includes('school/recruit/'+file));
  assert(fs.readFileSync(path.join(base,'school/recruit/scene.css'),'utf8').includes('.recruit-stage img,.recruit-stage canvas{image-rendering:auto}'),'Painted art overrides the global pixel-art rendering rule');
  console.log('PASS real Presentation integration: stable highest result, one-time receipt display, greeting after FX, lazy winner-only assets, hidden/resume, resize, reduced motion, skip/cancel, broken/slow assets, cleanup, no reward mutation/network');
})().catch(e=>{console.error(e);process.exitCode=1;});
