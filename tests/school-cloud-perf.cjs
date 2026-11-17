// Local signed-account performance probe, not a physical Android certification.
// Client/art sources are snapshotted once; instrumentation only changes HTTP
// responses and never edits product files.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fixture}=require('./account-fixture.cjs'),G=require('../school/engine.js'),ROOT=path.resolve(__dirname,'..');
const output=process.argv[2]||'/tmp/school-cloud-perf.json',duration=Number(process.env.SCHOOL_CLOUD_PERF_MS)||18000;
const scenarios=process.env.SCHOOL_CLOUD_PERF_SCENARIOS?JSON.parse(process.env.SCHOOL_CLOUD_PERF_SCENARIOS):[{cpu:4,motion:'full'},{cpu:8,motion:'full'},{cpu:4,motion:'reduce'}];
const client=fs.readFileSync(path.join(ROOT,'school/client.js'),'utf8'),clientHash=crypto.createHash('sha256').update(client).digest('hex');
const art=fs.readFileSync(path.join(ROOT,'school/art.js')),artHash=crypto.createHash('sha256').update(art).digest('hex');
let instrumentedClient=client,wrappers='';
for(const name of ['applyCloud','advanceCloudPreview','consumeEvents','render','renderButtons']){
 const original='function '+name+'(';assert.equal(instrumentedClient.split(original).length,2,'Instrumentation target '+name);
 instrumentedClient=instrumentedClient.replace(original,'function perfOriginal_'+name+'(');
 wrappers+=`function ${name}(...args){const s=window.cloudPerf;if(!s?.capture)return perfOriginal_${name}(...args);const at=performance.now();try{return perfOriginal_${name}(...args);}finally{s.spans.push({kind:'${name}',at,duration:performance.now()-at});}}\n`;
}
instrumentedClient=instrumentedClient.replace("'use strict';","'use strict';\n"+wrappers);
const percent=(a,q)=>a.length?[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*q))]:0;
const stats=a=>({count:a.length,mean:a.reduce((a,b)=>a+b,0)/Math.max(1,a.length),p95:percent(a,.95),max:a.length?Math.max(...a):0});
function initialState(){
 const s=G.create(Date.now(),991);s.team=['taeo','harin','sua','osia','lava','ian'];s.gold=12345;s.gems=6789;s.best=31;s.speed=1.5;
 for(const id of s.team)s.units[id]={level:60,xp:0,stars:2,shards:0,nextSkill:id==='osia'?4:1};
 G.action(s,{kind:'stage',stage:31,mode:'farm'},s.at);
 for(let i=0;i<100&&s.battle.wave<4;i++){if(s.battle.phase==='fight')s.battle.enemies.forEach(e=>e.hp=0);G.advance(s,s.at+500);}
 assert.equal(s.battle.wave,4);assert.equal(s.battle.boss,true);
 const simDelta=12378500-s.simTime,wallDelta=Date.now()-s.at;s.simTime+=simDelta;s.at+=wallDelta;
 for(const e of s.events){e.simAt+=simDelta;e.at+=wallDelta;}
 return s;
}
(async()=>{
 const t=await fixture(),results=[],requests=[];let origin;
 const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,origin);
  if(url.pathname.startsWith('/api/')){const chunks=[];for await(const c of req)chunks.push(c);const begin=performance.now();const response=await t.worker.fetch(new Request(url,{method:req.method,headers:req.headers,...(['GET','OPTIONS'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),t.env);const bytes=Buffer.from(await response.arrayBuffer());requests.push({path:url.pathname,status:response.status,duration:performance.now()-begin,bytes:bytes.length,at:Date.now()});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(bytes);return;}
  const file=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(ROOT+path.sep))throw Error('outside fixture');
  let body=file.endsWith('/school/client.js')?Buffer.from(instrumentedClient.replace('https://motracv-card-room.densedormouse4.chatgpt.site',origin)):file.endsWith('/school/art.js')?art:fs.readFileSync(file);
  res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream'});res.end(body);
 }catch(error){res.writeHead(500);res.end(error.message);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;t.env.ALLOWED_ORIGIN=origin;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{for(const [index,scenario]of scenarios.entries()){
  const signed=await t.login('mobile-cloud-perf-'+index);assert.equal(signed.status,200);const initial=initialState();
  t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(signed.data.profile.id,JSON.stringify(initial),Date.now());
  const context=await browser.newContext({viewport:{width:755,height:330},deviceScaleFactor:3,isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:scenario.motion==='reduce'?'reduce':'no-preference',userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36'});
  await context.addInitScript(({origin,token,motion})=>{localStorage.setItem(`card-account:${origin}`,JSON.stringify({token}));localStorage.setItem('school-save-mode','cloud');localStorage.setItem('school-settings',JSON.stringify({motion:motion==='reduce'?'reduced':motion,sound:false,theme:'light'}));sessionStorage.setItem('school-landscape-ack','1');Object.defineProperty(navigator,'standalone',{value:true});const match=window.matchMedia.bind(window);window.matchMedia=query=>{const result=match(query);if(query.includes('display-mode: standalone')||query.includes('display-mode: fullscreen'))Object.defineProperty(result,'matches',{value:true});return result;};},{origin,token:signed.data.token,motion:scenario.motion});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const cdp=await context.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:scenario.cpu});
  await p.goto(origin+'/school.html?app=1');await p.waitForFunction(()=>document.getElementById('boot-screen').hidden&&document.getElementById('account-label').textContent==='계정 저장');await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(()=>{
   const s=window.cloudPerf={capture:true,start:performance.now(),draw:[],raf:[],spans:[],long:[],events:[],contextEvents:[]};
   const draw=SchoolArt.draw;let lastSeq=0,lastRaf;SchoolArt.draw=function(...args){const at=performance.now(),state=args[1],result=draw.apply(this,args);s.draw.push({at,duration:performance.now()-at,time:args[2],reduced:args[4],stateAt:state.at,sim:state.simTime,simCredit:state.simCredit,stage:state.stage,wave:state.battle.wave,phase:state.battle.phase,cutin:state.battle.cinematic?.remaining||0,effects:args[3].length});for(const e of state.events)if(e.seq>lastSeq&&['skill-stage','lava-skill','cinematic'].includes(e.kind))s.events.push({kind:e.kind,from:e.from,stage:e.stage});lastSeq=state.seq;return result;};
   const advance=SchoolRPG.advance;SchoolRPG.advance=function(...args){const at=performance.now();try{return advance.apply(this,args);}finally{s.spans.push({kind:'engineAdvance',at,duration:performance.now()-at});}};
   const frame=at=>{if(!s.capture)return;if(lastRaf)s.raf.push(at-lastRaf);lastRaf=at;requestAnimationFrame(frame);};requestAnimationFrame(frame);new PerformanceObserver(list=>s.long.push(...list.getEntries().map(e=>({at:e.startTime,duration:e.duration})))).observe({entryTypes:['longtask']});
   for(const type of ['contextlost','contextrestored'])document.getElementById('battle').addEventListener(type,e=>s.contextEvents.push({type,trusted:e.isTrusted,at:performance.now()}));
  });
  const requestStart=requests.length;await p.waitForTimeout(duration);
  const sample=await p.evaluate(()=>{cloudPerf.capture=false;const c=document.getElementById('battle'),r=c.getBoundingClientRect();return{...cloudPerf,end:performance.now(),rect:{width:r.width,height:r.height},backing:[c.width,c.height],scale:c.dataset.renderScale||'1',mode:document.getElementById('account-label').textContent,dpr:devicePixelRatio};});
  const gaps=sample.draw.slice(1).map((f,i)=>f.at-sample.draw[i].at),clockDeltas=sample.draw.slice(1).map((f,i)=>(f.time-sample.draw[i].time)*1000),plateaus=[];let plateau=null;
  for(let i=1;i<sample.draw.length;i++){const f=sample.draw[i],prev=sample.draw[i-1];if(Math.abs(f.time-prev.time)<.000001&&f.at-prev.at<250){plateau ||= {at:prev.at,frames:1,time:prev.time,cutin:prev.cutin};plateau.frames++;plateau.end=f.at;}else if(plateau){plateau.duration=plateau.end-plateau.at;plateaus.push(plateau);plateau=null;}}
  if(plateau){plateau.duration=plateau.end-plateau.at;plateaus.push(plateau);}
  const result={...scenario,viewport:[755,330],dpr:sample.dpr,rect:sample.rect,backing:sample.backing,scale:sample.scale,seconds:(sample.end-sample.start)/1000,draws:sample.draw.length,drawPerSecond:sample.draw.length/((sample.end-sample.start)/1000),drawMs:stats(sample.draw.map(f=>f.duration)),drawGapMs:stats(gaps),rafGapMs:stats(sample.raf),clockDeltaMs:stats(clockDeltas),clockZeroFrames:clockDeltas.filter(d=>Math.abs(d)<.001).length,clockBackwards:clockDeltas.filter(d=>d<-.001).length,plateauMs:stats(plateaus.map(p=>p.duration)),plateausOver50:plateaus.filter(p=>p.duration>=50),longTasks:stats(sample.long.map(e=>e.duration)),spans:Object.fromEntries([...new Set(sample.spans.map(s=>s.kind))].map(kind=>[kind,stats(sample.spans.filter(s=>s.kind===kind).map(s=>s.duration))])),stages:[...new Set(sample.draw.map(f=>f.stage+':'+f.wave+':'+f.phase))],events:sample.events,requests:requests.slice(requestStart),errors,contextEvents:sample.contextEvents};
  result.renderReduced=[...new Set(sample.draw.map(f=>f.reduced))];results.push(result);fs.writeFileSync(output.replace(/\.json$/,`-${index}-raw.json`),JSON.stringify(sample));await p.screenshot({path:output.replace(/\.json$/,`-${index}.png`)});console.log(JSON.stringify(result));assert.deepEqual(errors,[]);assert.deepEqual(result.renderReduced,[scenario.motion==='reduce']);assert.equal(sample.mode,'계정 저장');assert.ok(result.requests.some(r=>r.path==='/api/school/state'&&r.status===200));await context.close();
 }}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));t.sqlite.close();fs.writeFileSync(output,JSON.stringify({environment:'Headless Chromium with Android UA/mobile DPR3 and standalone APIs emulated; signed local SQLite account; synthetic CPU throttling; no physical-device guarantee',clientHash,artHash,results},null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
