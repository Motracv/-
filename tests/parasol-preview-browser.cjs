'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out='/workspace/outputs/parasol-skills';fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 let stat;try{stat=fs.statSync(file);if(!stat.isFile())throw Error();}catch{res.writeHead(404);return res.end();}
 const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes'};
 const range=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');
 if(range){const start=Number(range[1]),end=Math.min(stat.size-1,range[2]?Number(range[2]):stat.size-1);if(start> end){res.writeHead(416);return res.end();}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1});fs.createReadStream(file,{start,end}).pipe(res);}
 else{res.writeHead(200,{...headers,'Content-Length':stat.size});fs.createReadStream(file).pipe(res);}
});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url=`http://127.0.0.1:${server.address().port}/previews/parasol-skills/`;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(10000);
 await page.goto(url);await page.waitForFunction(()=>window.parasolDemo?.ready&&document.fonts.status==='loaded');
 await page.locator('#reset').click();
 for(let kind=0;kind<3;kind++){
  await page.locator('#reset').click();await page.locator('[data-skill="'+kind+'"]').click();
  await page.waitForFunction(n=>parasolDemo.engine.state.totalHits===n,kind===0?1:3);
  assert.deepEqual(await page.evaluate(()=>parasolDemo.engine.state.targetHits),kind===0?[0,0,1]:[1,1,1]);
 }
 console.log('PASS actual button casts and matching target impacts');
 await page.locator('#reset').click();await page.locator('[data-skill="0"]').click();await page.locator('[data-skill="2"]').click();
 await page.waitForFunction(()=>parasolDemo.engine.state.totalHits===4);
 assert.deepEqual(await page.evaluate(()=>parasolDemo.engine.state.used),[1,0,1]);
 await page.locator('#reset').click();await page.locator('[data-skill="0"]').click();await page.keyboard.press('Space');
 await page.waitForTimeout(1400);assert.equal(await page.evaluate(()=>parasolDemo.engine.state.totalHits),0);
 await page.locator('#reset').click();const from=await page.evaluate(()=>parasolDemo.engine.state.x);await page.keyboard.down('KeyD');await page.waitForTimeout(250);await page.keyboard.up('KeyD');
 assert.ok(await page.evaluate(()=>parasolDemo.engine.state.x)>from);const stopped=await page.evaluate(()=>parasolDemo.engine.state.x);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>parasolDemo.engine.state.x),stopped);
 await page.keyboard.press('Digit2');await page.waitForFunction(()=>parasolDemo.engine.state.used[1]===1);
 await page.locator('#pause').click();const frozen=await page.evaluate(()=>parasolDemo.engine.state.time);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>parasolDemo.engine.state.time),frozen);
 await page.locator('#pause').click();await page.locator('[data-style="blossom"]').click();await page.locator('#speed').selectOption('0.5');
 assert.equal(await page.evaluate(()=>parasolDemo.engine.state.style),'blossom');
 console.log('PASS queued casts, keyboard movement/release, evade cancellation, pause and style/speed controls');
 const reach=async selector=>{const node=page.locator(selector);if(!await node.isVisible())return;assert.ok(await node.evaluate(n=>{const r=n.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&n.contains(document.elementFromPoint(x,y));}),selector+' reachable at '+JSON.stringify(page.viewportSize()));};
 for(const [width,height] of [[360,800],[390,844],[568,320],[844,390],[1280,800],[2560,1440],[3840,2160]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(60);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  for(const selector of ['[data-skill="0"]','[data-skill="1"]','[data-skill="2"]','[data-move="-1"]','[data-move="1"]','#dodge','#auto','#pause','#reset','[data-style="blossom"]'])await reach(selector);
  if(width>height&&height<=600)assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'landscape screen stays within viewport');
 }
 await page.setViewportSize({width:1280,height:800});
 await page.evaluate(()=>{parasolDemo.engine.reset();parasolDemo.engine.cast(2);parasolDemo.engine.advance(740);parasolDemo.engine.state.paused=true;});await page.waitForTimeout(80);
 await page.screenshot({path:out+'/desktop.png',fullPage:true});
 await page.setViewportSize({width:844,height:390});await page.screenshot({path:out+'/landscape.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/portrait.png',fullPage:true});
 console.log('PASS seven viewport sizes, no sideways overflow, accessible controls and compact landscape');
 await page.locator('[data-view="video"]').click();await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
 assert.ok(await page.locator('video').evaluate(v=>v.duration>=18));await page.locator('video').evaluate(v=>v.currentTime=12);
 await page.waitForFunction(()=>document.querySelector('video').currentTime>=12);
 await page.locator('[data-view="play"]').click();assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
 console.log('PASS real MP4 loading, 19-second duration, seek and return to gameplay');
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));
 await phone.goto(url);await phone.waitForFunction(()=>window.parasolDemo?.ready);await phone.locator('#reset').tap();
 for(let kind=0;kind<3;kind++){await phone.locator('#reset').tap();await phone.locator('[data-skill="'+kind+'"]').tap();await phone.waitForFunction(k=>parasolDemo.engine.state.used[k]===1,kind);}
 await phone.locator('#dodge').tap();assert.equal(await phone.evaluate(()=>parasolDemo.engine.state.action.type),'evade');
 await mobile.close();
 const failure=await browser.newPage();await failure.route('**/assets/dummy.png*',route=>route.abort());await failure.goto(url);await failure.locator('#retry').waitFor({state:'visible'});assert.equal(await failure.locator('#play-controls').evaluate(e=>e.disabled),true);
 await failure.unroute('**/assets/dummy.png*');await failure.locator('#retry').click();await failure.waitForFunction(()=>window.parasolDemo?.ready);assert.equal(await failure.locator('#play-controls').evaluate(e=>e.disabled),false);
 assert.deepEqual(errors,[]);await browser.close();server.close();console.log('PASS mobile touch casts, failed-asset retry, no JavaScript errors');
})().catch(e=>{console.error(e);server.close();process.exit(1)});
