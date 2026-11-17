// Browser API checks; these cannot verify physical Android system bars.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..'),G=require('../school/engine.js');
 const server=http.createServer((req,res)=>{
  try {const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))throw Error();const body=fs.readFileSync(file);const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(body);}
  catch {res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
  const context=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'}),p=await context.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  const s=G.create(Date.now(),77);s.gold=12345;for(const u of [...s.battle.heroes,...s.battle.enemies])u.hp=u.max=1e9;
  await context.addInitScript(s=>{s.at=Date.now();localStorage.setItem('school-mercenaries-v8',JSON.stringify(s));sessionStorage.setItem('school-landscape-ack','1');},s);
  await p.goto(`http://127.0.0.1:${server.address().port}/school.html`);await p.waitForFunction(()=>document.getElementById('boot-screen').hidden);
  await p.evaluate(()=>{window.realFullscreen=document.documentElement.requestFullscreen.bind(document.documentElement);document.documentElement.requestFullscreen=function(options){window.fullscreenOptions=options;return window.realFullscreen(options);};screen.orientation.lock=async()=>{throw new DOMException('Unsupported orientation lock','NotSupportedError');};});
  await p.click('#fullscreen-button');await p.waitForFunction(()=>document.fullscreenElement===document.documentElement);
  assert.deepEqual(await p.evaluate(()=>window.fullscreenOptions),{navigationUI:'hide'});
  assert.equal(await p.locator('#fullscreen-button').getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('#fullscreen-button').getAttribute('aria-label'),'전체 화면 종료');
  await p.click('#fullscreen-button');await p.waitForFunction(()=>!document.fullscreenElement);
  assert.equal(await p.locator('#fullscreen-button').getAttribute('aria-pressed'),'false');
  await p.click('#settings-button');assert.match(await p.locator('#settings-rotate').innerText(),/상태바/);await p.click('#settings-rotate');
  await p.waitForFunction(()=>!!document.fullscreenElement);assert.equal(await p.locator('#modal').evaluate(el=>el.open),false);
  await p.evaluate(()=>document.exitFullscreen());await p.waitForFunction(()=>document.getElementById('fullscreen-button').getAttribute('aria-pressed')==='false');
  console.log('PASS real fullscreen entry/exit, hide-navigation option, orientation-lock failure independence, settings entry and fullscreenchange state');
  await p.evaluate(()=>{document.documentElement.requestFullscreen=async()=>{throw new DOMException('Blocked','NotAllowedError');};});
  await p.click('#fullscreen-button');await p.waitForFunction(()=>document.getElementById('toast').textContent.includes('차단'));
  assert.equal(await p.evaluate(()=>!!document.fullscreenElement),false);
  await p.evaluate(()=>{document.documentElement.requestFullscreen=undefined;});
  await p.click('#fullscreen-button');await p.waitForFunction(()=>document.getElementById('toast').textContent.includes('지원하지'));
  assert.equal(await p.evaluate(()=>document.getElementById('app').inert),false);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('school-mercenaries-v8')).gold),12345);
  for(const width of [568,844]){const height=width===568?280:390;await p.setViewportSize({width,height});const box=await p.locator('#fullscreen-button').boundingBox();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);}
  await p.evaluate(()=>document.fonts.ready);assert.ok(await p.evaluate(()=>document.fonts.check('14px Pretendard')));
  assert.deepEqual(errors,[]);
  console.log('PASS rejected/unavailable fullscreen feedback, game/save preserved, visible mobile button and loaded Pretendard; Android OS bars remain device-only verification');
 } finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
