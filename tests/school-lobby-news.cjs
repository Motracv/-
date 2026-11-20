const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const G=require('../school/engine.js');
(async()=>{
  const {parseHTML}=await import(pathToFileURL((process.env.SCHOOL_DOM_MODULE||'/tmp/overhaul-dom/node_modules/linkedom')+'/esm/index.js'));
  const {window,document}=parseHTML('<html><body><main id="app" data-tab="lobby"><section id="lobby-panel"></section></main></body></html>');
  let now=Date.parse('2026-11-20T08:00:00Z'),state=G.create(now),visible=true,reduced=false,serial=0;
  const timers=new Map(),opens=[];
  const context={window,document,console,setTimeout:(f,ms)=>{timers.set(++serial,{f,ms});return serial;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(fs.readFileSync('school/lobby-news.js','utf8'),context);
  const news=window.SchoolLobbyNews.create({game:G,state:()=>state,now:()=>now,visible:()=>visible,reduced:()=>reduced,open:slide=>opens.push(slide.id)});
  const current=()=>document.querySelector('.lobby-news-card.is-current');
  const fire=(target,type,props={})=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,props);target.dispatchEvent(e);};
  const tick=()=>{assert.equal(timers.size,1);const[id,timer]=[...timers][0];timers.delete(id);timer.f();};
  const original=JSON.stringify(state);
  assert.equal(document.querySelectorAll('.lobby-news-card').length,6);assert.equal(current().dataset.promo,'horas');assert.equal(timers.size,1);
  for(let i=0;i<8;i++)news.refresh();assert.equal(timers.size,1,'Repeated game renders do not reset or multiply rotation timers');tick();assert.equal(current().dataset.promo,'hyeokjin');
  current().click();assert.deepEqual(opens,['hyeokjin']);assert.equal(JSON.stringify(state),original);
  fire(document.getElementById('lobby-news'),'pointerenter',{pointerType:'mouse'});assert.equal(timers.size,0);
  fire(document.getElementById('lobby-news'),'pointerleave');assert.equal(timers.size,1);
  const pause=document.querySelector('.lobby-news-pause');pause.click();assert.equal(timers.size,0);pause.click();assert.equal(timers.size,1);
  fire(document.getElementById('lobby-news'),'focusin');assert.equal(timers.size,0);fire(document.getElementById('lobby-news'),'focusout',{relatedTarget:null});assert.equal(timers.size,1);
  console.log('PASS timed rotation, mouse/focus/pause controls, and navigation without state mutation');

  const frame=document.querySelector('.lobby-news-window');
  fire(frame,'pointerdown',{clientX:200,clientY:40,pointerId:1,button:0});assert.equal(timers.size,0);
  fire(frame,'pointerup',{clientX:80,clientY:44,pointerId:1});assert.equal(current().dataset.promo,'double');current().click();assert.equal(opens.length,1,'Swiping must not open a promotion');
  fire(frame,'pointerdown',{clientX:140,clientY:40,pointerId:2,button:0});fire(frame,'pointerup',{clientX:140,clientY:40,pointerId:2});current().click();assert.equal(opens.at(-1),'double');
  visible=false;news.refresh();assert.equal(timers.size,0);visible=true;news.refresh();assert.equal(timers.size,1);
  reduced=true;news.refresh();assert.equal(timers.size,0);document.querySelectorAll('.lobby-news-page')[4].click();assert.equal(current().dataset.promo,'pass');assert.equal(timers.size,0);
  console.log('PASS swipe/click separation, hidden-screen suspension, and manual controls with reduced motion');

  reduced=false;now=Date.parse('2026-12-04T08:00:00Z');state.redeemedCodes.push('NEWNAME');news.refresh();
  assert(!document.querySelector('[data-promo=horas]'));assert(!document.querySelector('[data-promo=double]'));assert(!document.querySelector('[data-promo=newname]'));assert(document.querySelector('[data-promo=pass]'));
  for(const img of document.querySelectorAll('img'))assert(fs.existsSync(img.getAttribute('src').split('?')[0]));
  fire(window,'pagehide');assert.equal(timers.size,0);fire(window,'pageshow');assert.equal(timers.size,1);
  news.destroy();assert.equal(timers.size,0);assert(!document.getElementById('lobby-news'));assert.equal(document.getElementById('lobby-panel').dataset.newsReady,undefined);
  console.log('PASS expired events and claimed gifts disappear; page lifecycle and destruction clean up timers');
})().catch(error=>{console.error(error);process.exitCode=1;});
