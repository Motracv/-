// Panoramic scenery never changes combat state or the legacy/arena renderer.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const baseline=cp.execFileSync('git',['show','94ae855:school/art.js'],{cwd:ROOT});
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
(async()=>{
 const server=http.createServer((req,res)=>{try{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/baseline-art.js'){res.setHeader('Content-Type','text/javascript');res.end(baseline);return;}
  if(u.pathname.endsWith('fixture.html')){res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#142630}canvas{display:block}</style><script src="school/engine.js"></script><script src="${u.pathname.startsWith('/baseline')?'baseline-art.js':'school/art.js'}"></script>`);return;}
  const file=path.resolve(ROOT,'.'+u.pathname);if(!file.startsWith(ROOT+path.sep))throw Error('outside fixture');
  res.setHeader('Content-Type',({'.js':'text/javascript','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
 }catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
 const open=async(which='candidate',options={})=>{const context=await browser.newContext({viewport:{width:755,height:330}});if(options.route)await context.route('**/school/assets/battlefields/*',options.route);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(`${origin}/${which}-fixture.html`, {waitUntil:'domcontentloaded'});await page.evaluate(()=>SchoolArt.ready);return{page,context};};
 async function init(page){await page.evaluate(()=>{
  window.state=SchoolRPG.create(1000,991);state.team=['taeo','harin','sua','osia','lava','ian'];for(const id of state.team)state.units[id]={level:40,xp:0,stars:2,shards:0,nextSkill:1,basicHits:0};SchoolRPG.action(state,{kind:'stage',stage:1,mode:'farm'},state.at);
  window.canvas=document.createElement('canvas');canvas.width=960;canvas.height=560;document.body.append(canvas);window.ctx=canvas.getContext('2d');
 });}
 async function legacyPictures(page){return page.evaluate(()=>{
  const images=[],capture=(name,effects=[],time=10.15)=>{const before=JSON.stringify(state);SchoolArt.draw(ctx,state,time,effects,false);if(before!==JSON.stringify(state))throw Error('Renderer mutated the save');images.push({name,png:canvas.toDataURL()});};
  for(const stage of [1,16,31,51]){SchoolRPG.action(state,{kind:'stage',stage,mode:'farm'},state.at);capture(`stage-${stage}`);}
  const enemy=state.battle.enemies[0].id;
  capture('critical',[{kind:'hit',from:'lava',to:enemy,amount:123,critical:true,time:10}]);
  for(let stage=1;stage<=4;stage++){state.battle.osiaCast={id:100+stage,stage};capture(`water-${stage}`,[{kind:'skill-stage',from:'osia',castId:100+stage,stage,targets:[enemy],impactDelay:500,time:10}],10.35);state.battle.osiaCast=null;}
  for(const stage of [1,2])capture(`wind-${stage}`,[{kind:'lava-skill',from:'lava',stage,targets:state.team,time:10}],10.4);
  state.battle.cinematic={from:'osia',castId:140,duration:1000,remaining:500};capture('dragon-cutin',[{kind:'cinematic',from:'osia',castId:140,duration:1000,time:10}],10.35);state.battle.cinematic=null;
  return images;
 });}
 try{
  const old=await open('baseline');await init(old.page);await old.page.evaluate(()=>state.best=60);const before=await legacyPictures(old.page);await old.context.close();
  const current=await open();await init(current.page);await current.page.evaluate(()=>state.best=60);const after=await legacyPictures(current.page);
  assert.deepEqual(after.map(x=>[x.name,digest(x.png)]),before.map(x=>[x.name,digest(x.png)]),'Legacy stage/skill/cutin PNGs must remain byte identical');
  console.log('PASS twelve legacy scenery/critical/water/wind/cutin snapshots remain identical and do not mutate the save');
  await current.page.evaluate(()=>SchoolArt.battlefieldsReady);
  const metrics=await current.page.evaluate(()=>{
   canvas.dataset.layout='panorama';canvas.width=755;canvas.height=330;SchoolRPG.action(state,{kind:'stage',stage:1,mode:'farm'},state.at);
   const native=CanvasRenderingContext2D.prototype.drawImage,records=[],sources=[];
   CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(this===ctx){const t=this.getTransform();records.push({a:t.a,b:t.b,c:t.c,d:t.d,source:image instanceof HTMLImageElement?image.src:'canvas'});}if(image instanceof HTMLImageElement&&image.src.includes('/battlefields/'))sources.push(image.src);return native.call(this,image,...args);};
   let depth=0;const save=ctx.save.bind(ctx),restore=ctx.restore.bind(ctx);ctx.save=()=>{depth++;save();};ctx.restore=()=>{depth--;restore();};
   const before=JSON.stringify(state);SchoolArt.draw(ctx,state,10,[],true);const initialSources=sources.length,first=canvas.toDataURL();for(let i=0;i<20;i++)SchoolArt.draw(ctx,state,10,[],true);
   const repeatSources=sources.length,repeat=canvas.toDataURL(),pixels=[[1,1],[753,1],[1,328],[753,328]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data));
   const sceneSaveUnchanged=before===JSON.stringify(state);canvas.width=900;SchoolArt.draw(ctx,state,10,[],true);const resizedSources=sources.length;SchoolArt.resetRenderCache();SchoolArt.draw(ctx,state,10,[],true);const recoveredSources=sources.length;
   canvas.width=755;SchoolArt.draw(ctx,state,10,[],true);const plain=Array.from(ctx.getImageData(2,2,1,1).data);state.battle.cinematic={from:'osia',castId:150,duration:1000,remaining:500};SchoolArt.draw(ctx,state,10.35,[{kind:'cinematic',from:'osia',castId:150,duration:1000,time:10}],true);const shaded=Array.from(ctx.getImageData(2,2,1,1).data);state.battle.cinematic=null;
   CanvasRenderingContext2D.prototype.drawImage=native;
   return {loaded:['classroom','garden','snow'].every(n=>SchoolArt.assetsReady('battlefield-'+n)),records:records.slice(0,30),initialSources,repeatSources,resizedSources,recoveredSources,pixels,sameRepeat:first===repeat,sceneSaveUnchanged,depth,plain,shaded};
  });
  assert(metrics.loaded);assert.equal(metrics.depth,0);assert(metrics.sceneSaveUnchanged);assert(metrics.sameRepeat);
  assert.equal(metrics.initialSources,1);assert.equal(metrics.repeatSources,1);assert.equal(metrics.resizedSources,2);assert.equal(metrics.recoveredSources,3);
  for(const t of metrics.records)assert(Math.abs(Math.hypot(t.a,t.b)-Math.hypot(t.c,t.d))<1e-6,JSON.stringify(t));
  for(const p of metrics.pixels){assert.equal(p[3],255);assert(p.slice(0,3).reduce((a,b)=>a+b,0)>10);}
  assert(metrics.shaded.slice(0,3).reduce((a,b)=>a+b,0)<metrics.plain.slice(0,3).reduce((a,b)=>a+b,0),'Cutin must shade the outer panorama as well as the center');
  console.log('PASS uniform actor scale, four filled corners, one cached scenery sample across twenty frames, resize/context rebuild, full-width cutin shading');
  for(const [width,height]of[[755,330],[568,280],[1280,549],[1024,768]]){
   await current.page.setViewportSize({width,height});await current.page.evaluate(({width,height})=>{canvas.width=width;canvas.height=height;SchoolArt.draw(ctx,state,10,[],true);},{width,height});await current.page.screenshot({path:`/tmp/school-panorama-${width}x${height}.png`});
  }
  await current.context.close();
  const fallback=await open('candidate',{route:r=>r.abort()});await init(fallback.page);await fallback.page.evaluate(()=>SchoolArt.battlefieldsReady);const recovered=await fallback.page.evaluate(()=>{canvas.dataset.layout='panorama';canvas.width=755;canvas.height=330;SchoolArt.draw(ctx,state,10,[],true);return{loaded:SchoolArt.assetsReady('battlefield-classroom'),alpha:ctx.getImageData(1,1,1,1).data[3]};});assert.equal(recovered.loaded,false);assert.equal(recovered.alpha,255);await fallback.context.close();
  let release;const waiting=new Promise(resolve=>release=resolve);const late=await open('candidate',{route:async r=>{await waiting;await r.continue();}});await init(late.page);
  const first=await late.page.evaluate(()=>{canvas.dataset.layout='panorama';canvas.width=755;canvas.height=330;SchoolArt.draw(ctx,state,10,[],true);return canvas.toDataURL();});release();await late.page.evaluate(()=>SchoolArt.battlefieldsReady);const second=await late.page.evaluate(()=>{SchoolArt.draw(ctx,state,10,[],true);return canvas.toDataURL();});assert.notEqual(digest(first),digest(second),'Late background load replaces the cached procedural fallback');await late.context.close();
  assert.deepEqual(errors,[]);console.log('PASS unavailable assets keep procedural scenery, late image completion invalidates cache; no browser errors');
 }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
