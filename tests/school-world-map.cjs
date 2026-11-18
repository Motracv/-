// Map navigation must remain read-only until a confirmed, unlocked departure.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{try{
  const u=new URL(req.url,'http://localhost');if(u.pathname==='/map-fixture.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html data-theme="light"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="school/style.css"><link rel="stylesheet" href="school/lobby.css"><link rel="stylesheet" href="school/world-map.css"><script src="school/engine.js"></script><script src="school/art.js"></script><script src="school/world-map.js"></script><style>body{background:#1b3038;padding:0;margin:0}dialog{margin:auto}*{box-sizing:border-box}</style><dialog id="modal" class="world-map-modal"><div class="modal-top"><h2>학교 모험 지도</h2><button class="close-button" aria-label="닫기">×</button></div><div id="modal-content"><div id="map"></div></div></dialog>');return;}
  const file=path.resolve(ROOT,'.'+u.pathname);if(!file.startsWith(ROOT+path.sep))throw Error('outside');res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
 }catch{res.writeHead(404);res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720},hasTouch:true});p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${server.address().port}/map-fixture.html`);
  await p.evaluate(()=>{window.mapState=SchoolRPG.create(Date.now(),3);mapState.best=16;mapState.stage=17;window.mapCalls=[];window.holdMap=false;window.mapAPI=SchoolWorldMap.render(document.getElementById('map'),{state:mapState,onSelect:(stage,mode)=>{mapCalls.push({stage,mode});if(holdMap)return new Promise(resolve=>window.releaseMap=resolve);}});document.getElementById('modal').showModal();});
  assert.equal(await p.locator('[data-map-chapter]').count(),12);assert.deepEqual(await p.evaluate(()=>mapCalls),[]);
  await p.click('[data-map-chapter="11"]');assert.equal(await p.locator('#map-start').isDisabled(),true);assert.equal(await p.locator('#map-farm').isDisabled(),true);assert.equal(await p.locator('[data-map-stage="60"]').isDisabled(),true);assert.deepEqual(await p.evaluate(()=>mapCalls),[]);
  await p.click('[data-map-chapter="2"]');await p.click('[data-map-stage="14"]');assert.deepEqual(await p.evaluate(()=>mapCalls),[]);await p.click('#map-farm');assert.deepEqual(await p.evaluate(()=>mapCalls),[{stage:14,mode:'farm'}]);
  await p.click('[data-map-next]');assert.equal(await p.locator('[data-map-stage="17"]').getAttribute('aria-pressed'),'true');assert.equal(await p.evaluate(()=>mapCalls.length),1);await p.evaluate(()=>holdMap=true);await p.click('#map-start');await p.evaluate(()=>document.getElementById('map-start').click());assert.deepEqual(await p.evaluate(()=>mapCalls),[{stage:14,mode:'farm'},{stage:17,mode:'progress'}]);assert.equal(await p.locator('#map-start').isDisabled(),true);await p.evaluate(()=>{releaseMap();holdMap=false;});await p.waitForFunction(()=>!document.getElementById('map-start').disabled);
  console.log('PASS twelve illustrated campaign cards, read-only chapter/stage/next selection, locked departure and single in-flight stage action');
  const stable=await p.evaluate(()=>{const node=document.querySelector('[data-map-stage="17"]'),campus=document.querySelector('.wm-campus');for(let i=0;i<20;i++)mapAPI.update(mapState,false);return{stageSame:node===document.querySelector('[data-map-stage="17"]'),campusSame:campus===document.querySelector('.wm-campus')};});assert.deepEqual(stable,{stageSame:true,campusSame:true});
  await p.evaluate(()=>{mapAPI.update(mapState,'계정 저장 확인 중');});assert.equal(await p.locator('#map-start').isDisabled(),true);assert.match(await p.locator('.wm-block-reason').innerText(),/계정 저장/);
  await p.evaluate(()=>{mapState.activities.run={settled:false};mapAPI.update(mapState,false);});assert.equal(await p.locator('#map-farm').isDisabled(),true);assert.match(await p.locator('.wm-block-reason').innerText(),/던전/);
  await p.evaluate(()=>{mapState.activities.run=null;mapAPI.update(mapState,false);});
  console.log('PASS steady updates reuse DOM and account/activity locks disable departure without mutating the save');
  assert.equal(await p.locator('.wm-boss-ready').count(),12,'Every region uses its existing static campaign boss');
  assert.equal(await p.locator('[data-map-chapter="0"] .wm-chapter-progress').innerText(),'클리어 5 / 5');
  assert.equal(await p.locator('[data-map-chapter="3"] .wm-chapter-progress').innerText(),'클리어 1 / 5');
  assert.equal(await p.locator('[data-map-chapter="11"] .wm-chapter-progress').innerText(),'클리어 0 / 5');
  await p.waitForFunction(()=>[...document.querySelectorAll('.wm-region-image')].some(img=>img.complete&&img.naturalWidth===384));
  await p.locator('[data-map-chapter="11"] .wm-region-image').evaluate(img=>img.src='missing-map-region.webp');
  await p.waitForFunction(()=>document.querySelector('[data-map-chapter="11"]').classList.contains('wm-image-missing'));
  assert.equal(await p.locator('[data-map-chapter="11"] .wm-region-fallback').isVisible(),true,'Missing region art keeps an illustrated fallback');
  await p.setViewportSize({width:755,height:330});await p.waitForTimeout(100);
  await p.locator('.wm-campus').evaluate(el=>el.scrollLeft=0);await p.waitForTimeout(100);
  const rail=await p.locator('.wm-campus').boundingBox(),cdp=await p.context().newCDPSession(p),sx=rail.x+rail.width*.8,sy=rail.y+rail.height*.5;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy}]});
  for(let step=1;step<=6;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx-step*45,y:sy}]});await p.waitForTimeout(20);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await p.waitForFunction(()=>document.querySelector('.wm-campus').scrollLeft>60);await p.waitForTimeout(350);
  const swipe=await p.evaluate(()=>{const el=document.querySelector('.wm-campus'),before=el.scrollLeft;for(let i=0;i<20;i++)mapAPI.update(mapState,false);return{before,after:el.scrollLeft,calls:mapCalls.length,selected:document.querySelector('.wm-chapter.selected').dataset.mapChapter};});
  assert.equal(swipe.after,swipe.before,'State refresh must not snap back after a swipe');assert.equal(swipe.calls,2);assert.equal(swipe.selected,'3');await cdp.detach();
  console.log('PASS real mobile touch swipe, scroll retained through updates, boss previews, clear counts and missing-image fallback');
  for(const [w,h]of[[1280,720],[755,330],[568,280],[390,844]]){
   await p.setViewportSize({width:w,height:h});await p.waitForTimeout(100);const bounds=await p.evaluate(()=>{const a=document.getElementById('map-start'),r=a.getBoundingClientRect(),d=document.querySelector('.wm-detail'),dr=d.getBoundingClientRect(),modal=document.getElementById('modal');return{r:{x:r.x,y:r.y,w:r.width,h:r.height},detail:{bottom:dr.bottom,top:dr.top,scrollHeight:d.scrollHeight,clientHeight:d.clientHeight},overflow:modal.scrollWidth-modal.clientWidth};});
   assert.ok(bounds.r.h>=44,'Departure touch target must be at least 44px');assert.ok(bounds.r.x>=0&&bounds.r.x+bounds.r.w<=w+1,JSON.stringify(bounds));assert.ok(bounds.r.y>=0&&bounds.r.y+bounds.r.h<=h+1,`${w}x${h}: ${JSON.stringify(bounds)}`);assert.ok(bounds.r.y+bounds.r.h<=bounds.detail.bottom+1,'Departure should not be hidden beneath a scrollable detail panel: '+JSON.stringify(bounds));assert.ok(bounds.overflow<=1,'No horizontal dialog overflow: '+JSON.stringify(bounds));
   const visibleCards=await p.locator('.wm-campus').evaluate(el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('.wm-chapter')].filter(card=>{const c=card.getBoundingClientRect();return c.left>=r.left-1&&c.right<=r.right+1;}).length;});assert.ok(visibleCards>=(w>1100?5:w>=500?3:1),'Illustrations should stay readable instead of shrinking all twelve cards to fit');
   await p.screenshot({path:`/tmp/school-world-map-${w}x${h}.png`});console.log('PASS visible departure and no dialog horizontal overflow',w,h,JSON.stringify(bounds.r));
  }
  await p.evaluate(()=>{mapAPI.destroy();document.getElementById('map-farm').click();});assert.equal(await p.evaluate(()=>mapCalls.length),2);assert.deepEqual(errors,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
