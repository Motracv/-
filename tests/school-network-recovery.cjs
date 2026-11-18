// Mobile-shaped Chromium plus real SQLite/auth fixture. These compatibility
// and network fault injections are not evidence of a specific physical phone.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fixture}=require('./account-fixture.cjs');
const G=require('../school/engine.js');
const ROOT=path.resolve(__dirname,'..');
(async()=>{
 const t=await fixture(),source=fs.readFileSync(path.join(ROOT,'school/client.js'),'utf8'),controls=new Map(),contexts=[],failures=[];
 console.log('Client source SHA256',crypto.createHash('sha256').update(source).digest('hex'));
 let origin;
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,origin);
   if(url.pathname.startsWith('/api/')){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks),token=req.headers['x-account-session']||(req.headers.authorization||'').replace(/^Bearer /,'');
    const control=controls.get(token),record={path:url.pathname,at:Date.now()};control?.requests.push(record);
    if(url.pathname==='/api/school/state'&&control?.status){record.status=control.status;res.writeHead(control.status,{'Content-Type':'application/json'});res.end(JSON.stringify({error:control.status===401?'로그인이 만료되었습니다.':control.status===426?'게임이 업데이트되었습니다. 페이지를 새로고침해 주세요.':'검증용 일시 연결 오류'}));return;}
    const response=await t.worker.fetch(new Request(url,{method:req.method,headers:req.headers,...(['GET','OPTIONS'].includes(req.method)?{}:{body})}),t.env),bytes=Buffer.from(await response.arrayBuffer());record.status=response.status;
    if(url.pathname==='/api/school/state'&&control?.delayOnce){const delay=control.delayOnce;control.delayOnce=0;control.delaying=true;await new Promise(resolve=>setTimeout(resolve,delay));control.delaying=false;}
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(bytes);return;
   }
   const file=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
   let body=fs.readFileSync(file);
   if(file.endsWith('/school/client.js'))body=Buffer.from(source.replace('https://motracv-card-room.densedormouse4.chatgpt.site',origin));
   if(file.endsWith('/school/art.js'))body=Buffer.from(body+`\n;(()=>{const draw=SchoolArt.draw;window.__networkFrames=[];SchoolArt.draw=function(ctx,state,...rest){window.__networkFrames.push({at:Date.now(),sim:state.simTime,gold:state.gold,gems:state.gems});if(window.__networkFrames.length>800)window.__networkFrames.shift();return draw.call(this,ctx,state,...rest);};})();`);
   const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(body);
  }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;t.env.ALLOWED_ORIGIN=origin;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 async function scenario(name,fn){if(process.env.SCHOOL_NETWORK_CASE&&process.env.SCHOOL_NETWORK_CASE!==name)return;try{await fn();console.log('PASS',name);}catch(error){failures.push({name,message:error.message});console.log('FAIL',name,error.message);} }
 async function open(person,{missingTimeout=false,fastTimeout=false,cached=true,initialStatus=0}={}){
  const login=await t.login(person);assert.equal(login.status,200);const who=login.data,initial=G.create(Date.now(),642);initial.gold=4567;initial.gems=8901;for(const enemy of initial.battle.enemies){enemy.hp=enemy.max=100000;enemy.atk=0;}
  t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(who.profile.id,JSON.stringify(initial),Date.now());
  const control={requests:[],status:initialStatus,delayOnce:0};controls.set(who.token,control);
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'reduce'});contexts.push(context);
  const cache={profile:who.profile,state:G.view(initial),revision:0,serverTime:Date.now(),sessionFingerprint:crypto.createHash('sha256').update(who.token).digest('hex')};
  await context.addInitScript(({origin,token,cache,cached,missingTimeout,fastTimeout})=>{
   localStorage.setItem(`card-account:${origin}`,JSON.stringify({token}));localStorage.setItem('school-save-mode','cloud');sessionStorage.setItem('school-landscape-ack','1');
   if(cached)sessionStorage.setItem('school-confirmed-cloud-view',JSON.stringify(cache));
   if(missingTimeout)Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});
   if(fastTimeout){const timeout=window.setTimeout;window.setTimeout=function(fn,ms,...args){return timeout.call(this,fn,ms===14000?180:ms,...args);};const abort=AbortSignal.timeout?.bind(AbortSignal);if(abort)AbortSignal.timeout=ms=>abort(ms===14000?180:ms);}
  },{origin,token:who.token,cache,cached,missingTimeout,fastTimeout});
  const p=await context.newPage(),errors=[];p.setDefaultTimeout(12000);p.on('pageerror',error=>errors.push(error.message));await p.goto(origin+'/school.html');await p.waitForFunction(()=>document.getElementById('boot-screen').hidden);await p.click('#lobby-resume');try { await p.waitForFunction(()=>document.getElementById('boot-screen').hidden&&window.__networkFrames?.length>2); } catch (error) { console.log('render wait state', await p.evaluate(()=>({tab:document.getElementById('app').dataset.tab,boot:document.getElementById('boot-screen').hidden,modal:document.getElementById('modal').open,rotate:document.getElementById('rotate-prompt').hidden,frames:window.__networkFrames?.length,canvas:document.getElementById('battle').getBoundingClientRect().toJSON(),connection:document.getElementById('connection').textContent})));throw error; }
  return {p,context,control,who,errors};
 }
 const sim=p=>p.evaluate(()=>window.__networkFrames.at(-1)?.sim);
 const wallet=p=>p.evaluate(()=>({gold:document.getElementById('gold').textContent,gems:document.getElementById('gems').textContent}));
 const ready=p=>p.waitForFunction(()=>document.getElementById('save-status').dataset.state==='saved'&&document.getElementById('connection').hidden,{},{timeout:10000});
 const waiting=p=>p.waitForFunction(()=>!document.getElementById('connection').hidden&&document.getElementById('save-status').dataset.state==='error',{},{timeout:10000});
 try{
  await scenario('missing-timeout-api',async()=>{
   const {p,control,errors}=await open('mobile-missing-timeout',{missingTimeout:true});const before=await sim(p);await p.waitForTimeout(1700);const after=await sim(p);
   await p.click('#battle-settings');const buttonsWork=await p.locator('#modal').evaluate(el=>el.open);await p.click('#modal-close');
   console.log('missing-timeout evidence',JSON.stringify({apiRequests:control.requests.length,state200:control.requests.filter(r=>r.path==='/api/school/state'&&r.status===200).length,simBefore:before,simAfter:after,buttonsWork,banner:await p.locator('#connection').innerText()}));
   assert.ok(control.requests.some(r=>r.path==='/api/school/state'&&r.status===200),'A browser missing AbortSignal.timeout must still perform authenticated state requests');assert.ok(after>before,'Fallback-compatible mobile battle must advance');assert.deepEqual(errors,[]);
  });
  await scenario('disconnect-reconnect',async()=>{
   const {p,context,control,errors}=await open('mobile-disconnect');await ready(p);const money=await wallet(p);await context.setOffline(true);await waiting(p);const before=await sim(p);await p.waitForTimeout(1100);assert.deepEqual(await wallet(p),money);
   await p.click('#party [data-hero="harin"]');assert.equal(await p.locator('#train-hero').isDisabled(),true);await p.click('#modal-close');
   const readBefore=control.requests.filter(r=>r.path==='/api/school/state').length;await context.setOffline(false);await ready(p);await p.waitForTimeout(1200);assert.ok(await sim(p)>before);assert.ok(control.requests.filter(r=>r.path==='/api/school/state').length>readBefore);assert.deepEqual(errors,[]);
   console.log('disconnect recovery evidence',JSON.stringify({simBefore:before,simAfter:await sim(p),stateRetries:control.requests.filter(r=>r.path==='/api/school/state').length-readBefore}));
  });
  await scenario('timeout-reconnect',async()=>{
   const {p,control,errors}=await open('mobile-timeout',{fastTimeout:true});await ready(p);const money=await wallet(p);control.delayOnce=900;await waiting(p);assert.deepEqual(await wallet(p),money);const before=await sim(p);await ready(p);await p.waitForTimeout(900);assert.ok(await sim(p)>before);assert.deepEqual(errors,[]);console.log('timeout recovered after aborted 180ms test deadline; real Worker response had been computed');
  });
  await scenario('expired-session',async()=>{
   const {p,control,errors}=await open('mobile-expired');await ready(p);control.status=401;await waiting(p);assert.equal(await p.evaluate(origin=>localStorage.getItem(`card-account:${origin}`),origin),null);assert.match(await p.locator('#connection').innerText(),/로그인|만료/);const count=control.requests.length;await p.waitForTimeout(3500);assert.equal(control.requests.length,count,'An expired token must not be retried forever');assert.deepEqual(errors,[]);
  });
  await scenario('outdated-catalog',async()=>{
   const {p,control,errors}=await open('mobile-old-catalog');await ready(p);control.status=426;await waiting(p);assert.equal(await p.locator('#connection button').textContent(),'새로고침');assert.ok(await p.evaluate(origin=>localStorage.getItem(`card-account:${origin}`),origin));assert.equal(control.requests.filter(r=>r.path==='/api/school/action').length,0);assert.deepEqual(errors,[]);
  });
  await scenario('outdated-catalog-on-boot',async()=>{
   const {p,control,errors}=await open('mobile-cached-old-catalog',{initialStatus:426});
   console.log('cached catalog evidence',JSON.stringify({me200:control.requests.some(r=>r.path==='/api/account/me'&&r.status===200),state426:control.requests.some(r=>r.path==='/api/school/state'&&r.status===426),banner:await p.locator('#connection').innerText()}));
   assert.equal(await p.locator('#connection button').textContent(),'새로고침','A cached obsolete client must offer an update instead of endlessly retrying the incompatible API');assert.ok(await p.evaluate(origin=>localStorage.getItem(`card-account:${origin}`),origin));assert.deepEqual(errors,[]);
  });
 }finally{for(const context of contexts)await context.close();await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));t.sqlite.close();}
 assert.deepEqual(failures,[],JSON.stringify(failures));
})().catch(error=>{console.error(error);process.exitCode=1;});
