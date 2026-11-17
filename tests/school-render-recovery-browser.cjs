// Isolated Chromium renderer recovery. GPU loss/restoration and fullscreen are
// real browser events; background visibility below is explicitly simulated.
// This is not a physical Android/iOS or native-installed-app certification.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),G=require('../school/engine.js');
(async()=>{
 const server=http.createServer((req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))throw Error('outside fixture');const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const errors=[];
 try{
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block',reducedMotion:'no-preference'});
  const state=G.create(Date.now(),71);state.gold=12345;state.speed=1.5;state.team=['taeo','harin','sua','osia','lava','ian'];for(const id of state.team)state.units[id]={level:10,xp:0,stars:0,shards:0,nextSkill:1};G.action(state,{kind:'stage',stage:1,mode:'farm'},Date.now());for(const hero of state.battle.heroes)hero.hp=hero.max=1e6;for(const enemy of state.battle.enemies){enemy.hp=enemy.max=1e7;enemy.atk=1;}
  await context.addInitScript(state=>{state.at=Date.now();localStorage.setItem('school-mercenaries-v8',JSON.stringify(state));localStorage.setItem('school-settings',JSON.stringify({sound:false,motion:'full',theme:'light'}));sessionStorage.setItem('school-landscape-ack','1');},state);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/school.html`);await page.waitForFunction(()=>document.querySelector('#boot-screen').hidden);await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>{
   window.renderRecovery={draws:0,events:[]};const draw=SchoolArt.draw;
   SchoolArt.draw=function(...args){const result=draw.apply(this,args);renderRecovery.draws++;renderRecovery.sim=args[1].simTime;return result;};
   for(const type of ['contextlost','contextrestored'])document.querySelector('#battle').addEventListener(type,event=>renderRecovery.events.push({type,trusted:event.isTrusted,time:performance.now()}));
   window.renderPixel=()=>Array.from(document.querySelector('#battle').getContext('2d').getImageData(2,2,1,1).data);
  });
  await page.waitForFunction(()=>renderRecovery.draws>=5);
  const before=await page.evaluate(()=>({draws:renderRecovery.draws,sim:renderRecovery.sim,pixel:renderPixel()}));assert.notDeepEqual(before.pixel,[0,0,0,255]);
  // Restart only this test browser's GPU process. This produces trusted native
  // Canvas 2D contextlost/contextrestored, without fabricating either event.
  const browserCDP=await browser.newBrowserCDPSession();await browserCDP.send('Browser.crashGpuProcess');
  await page.waitForFunction(()=>renderRecovery.events.some(e=>e.type==='contextlost'&&e.trusted),null,{timeout:15000});
  await page.waitForFunction(()=>renderRecovery.events.some(e=>e.type==='contextrestored'&&e.trusted),null,{timeout:15000});
  await page.waitForFunction(pixel=>JSON.stringify(renderPixel())===JSON.stringify(pixel),before.pixel,{timeout:10000});
  assert.equal(await page.evaluate(()=>document.querySelector('#battle').getContext('2d').isContextLost()),false);
  assert(await page.evaluate(draws=>renderRecovery.draws>draws,before.draws));
  console.log('PASS trusted native 2D context loss/restoration repaints cached scenery without resize or reload');

  await page.evaluate(()=>{document.querySelector('#battle').style.display='none';});await page.waitForTimeout(250);
  const hidden=await page.evaluate(()=>({draws:renderRecovery.draws,rect:document.querySelector('#battle').getBoundingClientRect().toJSON(),sim:JSON.parse(localStorage.getItem('school-mercenaries-v8')).simTime}));
  assert.equal(hidden.rect.width,0);assert.equal(hidden.rect.height,0);await page.waitForTimeout(550);
  assert.equal(await page.evaluate(()=>renderRecovery.draws),hidden.draws);
  await page.evaluate(()=>document.querySelector('#battle').style.removeProperty('display'));
  await page.waitForFunction(draws=>renderRecovery.draws>=draws+5,hidden.draws);
  assert(await page.evaluate(sim=>JSON.parse(localStorage.getItem('school-mercenaries-v8')).simTime>=sim,hidden.sim));
  console.log('PASS zero-sized battlefield resumes drawing after its real ResizeObserver size returns');

  await page.click('#settings-button');const modalDraws=await page.evaluate(()=>renderRecovery.draws);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>renderRecovery.draws),modalDraws);
  await page.click('#modal-close');await page.waitForFunction(draws=>renderRecovery.draws>=draws+5,modalDraws);
  for(const viewport of [{width:390,height:844},{width:568,height:280},{width:844,height:390}]){
   const count=await page.evaluate(()=>renderRecovery.draws);await page.setViewportSize(viewport);await page.waitForFunction(draws=>renderRecovery.draws>=draws+5,count);
   assert(await page.evaluate(()=>{const c=document.querySelector('#battle'),r=c.getBoundingClientRect();return r.width>0&&r.height>0&&c.width>0&&c.height>0;}));
  }
  await page.click('#fullscreen-button');await page.waitForFunction(()=>!!document.fullscreenElement);const fullscreenCount=await page.evaluate(()=>renderRecovery.draws);await page.waitForFunction(draws=>renderRecovery.draws>=draws+5,fullscreenCount);await page.click('#fullscreen-button');await page.waitForFunction(()=>!document.fullscreenElement);
  console.log('PASS settings close, portrait/short-landscape resize and real fullscreen entry/exit keep painting');

  // Headless tabs are not a physical phone background lifecycle. Override only
  // the visibility getter and dispatch the real handlers' events deliberately.
  await page.evaluate(()=>{window.recoveryHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.recoveryHidden});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(100);const paused=await page.evaluate(()=>renderRecovery.draws);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>renderRecovery.draws),paused);
  await page.evaluate(()=>{window.recoveryHidden=false;document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));delete document.hidden;});
  await page.waitForFunction(draws=>renderRecovery.draws>=draws+5,paused);
  const after=await page.evaluate(()=>({sim:JSON.parse(localStorage.getItem('school-mercenaries-v8')).simTime,gold:JSON.parse(localStorage.getItem('school-mercenaries-v8')).gold,inert:document.querySelector('#app').inert,events:renderRecovery.events}));
  assert(after.sim>before.sim);assert.equal(after.gold,12345);assert.equal(after.inert,false);assert.deepEqual(errors,[]);
  await page.screenshot({path:'/tmp/school-render-recovery.png'});fs.writeFileSync('/tmp/school-render-recovery.json',JSON.stringify({environment:'Headless Chromium mobile emulation; native isolated GPU/fullscreen events; simulated visibility lifecycle',before,after,errors},null,2));
  console.log('PASS simulated background/pageshow resumes painting and preserves the saved game; no JavaScript errors');
 }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
