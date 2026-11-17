// A real Chromium document and SQLite Worker with signed test Google identity.
// Delay delivery AFTER the server has computed its response: this reproduces
// both a pending fetch and an old snapshot arriving over a slow connection.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fixture}=require('./account-fixture.cjs');
const G=require('../school/engine.js');
const ROOT=path.resolve(__dirname,'..');

(async()=>{
 const t=await fixture(),errors=[],requests=[],source=fs.readFileSync(path.join(ROOT,'school/client.js'),'utf8');
 console.log('Client source SHA256',crypto.createHash('sha256').update(source).digest('hex'));
 let origin,nextDelay=0,delayed=null;
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,origin);
   if(url.pathname.startsWith('/api/')){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks),parsed=body.length?JSON.parse(body):{};
    const response=await t.worker.fetch(new Request(url,{method:req.method,headers:req.headers,...(['GET','OPTIONS'].includes(req.method)?{}:{body})}),t.env);
    const bytes=Buffer.from(await response.arrayBuffer()),record={path:url.pathname,request:parsed,status:response.status,computedAt:Date.now(),body:JSON.parse(bytes)};requests.push(record);
    if(url.pathname==='/api/school/state'&&nextDelay){const ms=nextDelay;nextDelay=0;delayed=record;record.delay=ms;await new Promise(resolve=>setTimeout(resolve,ms));record.deliveredAt=Date.now();}
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(bytes);return;
   }
   const file=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));
   if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
   let body=fs.readFileSync(file);
   if(file.endsWith('/school/client.js'))body=Buffer.from(source.replace('https://motracv-card-room.densedormouse4.chatgpt.site',origin));
   if(file.endsWith('/school/art.js'))body=Buffer.from(body.toString()+`\n;(()=>{const draw=SchoolArt.draw;window.__battleFrames=[];SchoolArt.draw=function(ctx,state,...rest){const frame={wall:Date.now(),sim:state.simTime,tick:state.battle?.tick,battleId:state.battle?.id,phase:state.battle?.phase,gold:state.gold,gems:state.gems,hudGold:document.getElementById('gold')?.textContent,hudGems:document.getElementById('gems')?.textContent};window.__battleFrames.push(frame);if(window.__battleFrames.length>2400)window.__battleFrames.shift();return draw.call(this,ctx,state,...rest);};})();`);
   const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(body);
  }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;t.env.ALLOWED_ORIGIN=origin;
 const signed=await t.login('cloud-continuity-signed');assert.equal(signed.status,200);
 const who=signed.data,initial=G.create(Date.now(),942);initial.gold=3456;initial.gems=7890;
 for(const enemy of initial.battle.enemies){enemy.hp=enemy.max=100000;enemy.atk=0;}
 t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(who.profile.id,JSON.stringify(initial),Date.now());
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'reduce'});
 await context.addInitScript(({origin,token})=>{localStorage.setItem(`card-account:${origin}`,JSON.stringify({token}));localStorage.setItem('school-save-mode','cloud');sessionStorage.setItem('school-landscape-ack','1');},{origin,token:who.token});
 const p=await context.newPage();p.on('pageerror',error=>errors.push(error.message));
 async function arm(ms=3000){nextDelay=ms;delayed=null;const until=Date.now()+10000;while(!delayed&&Date.now()<until)await p.waitForTimeout(25);assert.ok(delayed,'Automatic state poll should reach the real Worker');return delayed;}
 const frames=()=>p.evaluate(()=>window.__battleFrames);
 const money=()=>p.evaluate(()=>({gold:document.getElementById('gold').textContent,gems:document.getElementById('gems').textContent}));
 const save=()=>JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(who.profile.id).payload);
 try{
  await p.goto(origin+'/school.html');await p.waitForFunction(()=>document.getElementById('account-label').textContent==='계정 저장'&&window.__battleFrames?.length>2);
  assert.ok(requests.some(r=>r.path==='/api/account/me'&&r.status===200));
  const delayedState=await arm(),start=(await frames()).at(-1),confirmedMoney=await money();
  await p.waitForTimeout(2350);const waiting=(await frames()).at(-1),waitingFrames=(await frames()).filter(f=>f.wall>=delayedState.computedAt);
  const evidence={responseStatus:delayedState.status,delayMs:delayedState.delay,samples:waitingFrames.length,simBefore:start.sim,simDuring:waiting.sim,tickBefore:start.tick,tickDuring:waiting.tick,simDelta:waiting.sim-start.sim,delivered:!!delayedState.deliveredAt};
  console.log('Delayed response evidence',JSON.stringify(evidence));
  assert.equal(delayedState.status,200);assert.equal(delayedState.deliveredAt,undefined,'Sample must occur while response is still waiting');
  assert.ok(waitingFrames.length>=8,'Canvas continues painting during pending fetch');
  assert.ok(waiting.sim-start.sim>=1500,'Battle simulation must continue during a delayed cloud state fetch');
  assert.deepEqual(await money(),confirmedMoney,'Unconfirmed combat currency must not become visible during fetch');
  await p.waitForTimeout(1100);
  const throughResponse=(await frames()).filter(f=>f.wall>=start.wall&&f.wall<=delayedState.deliveredAt+800);
  const backwards=throughResponse.slice(1).filter((f,i)=>f.sim<throughResponse[i].sim);
  assert.deepEqual(backwards,[],'A stale delivered snapshot must not rewind the rendered simulation clock');
  console.log('PASS 3-second state response delay keeps mobile battle progressing and reconciles without a backward simulation jump');

  // A verified server-side action still owns the level and price. Delay its
  // response by routing it through the browser, then repeat the exact request
  // id to prove continuity changes have not loosened transaction authority.
  let actionRecord=null;
  await p.route('**/api/school/action',async route=>{const response=await route.fetch();actionRecord={request:route.request().postDataJSON(),response:await response.json(),status:response.status()};await new Promise(resolve=>setTimeout(resolve,1800));await route.fulfill({response});});
  await p.locator('#party [data-hero="harin"]').click();const before=save();await p.locator('#train-hero').focus();await p.keyboard.press('Enter');
  await p.waitForTimeout(450);assert.ok(actionRecord);assert.equal(actionRecord.status,200);assert.equal(await p.locator('#train-hero').isDisabled(),true);
  const committed=save();assert.equal(committed.units.harin.level,before.units.harin.level+1);assert.equal(committed.gold,before.gold-G.trainingCost(before.units.harin));assert.equal(committed.gems,before.gems);
  await p.waitForFunction(()=>!document.getElementById('train-hero').disabled);assert.equal(save().units.harin.level,committed.units.harin.level);
  const retry=await t.call('/api/school/action',actionRecord.request,null,{'X-Account-Session':who.token});assert.equal(retry.status,200);assert.equal(retry.data.repeated,true);assert.equal(save().units.harin.level,committed.units.harin.level);assert.equal(save().gold,committed.gold);
  assert.deepEqual(errors,[]);console.log('PASS delayed training remains server-authoritative, blocks duplicate UI spending, and exact request replay charges once');
 }finally{await context.close();await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));t.sqlite.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
