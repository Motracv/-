// The new UR uses authored poses, stable feet and bounded cached source art.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
(async()=>{
 const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/fixture.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#203040}canvas{display:block}</style><script src="school/engine.js"></script><script src="school/art.js"></script>');return;}const file=path.resolve(ROOT,'.'+u.pathname);if(!file.startsWith(ROOT+path.sep))throw Error('outside');res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const errors=[];
 const open=async(blocked=false)=>{const context=await browser.newContext({viewport:{width:960,height:560}});if(blocked)await context.route('**/school/assets/horas/*',r=>r.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/fixture.html');await page.evaluate(()=>Promise.all([SchoolArt.ready,SchoolArt.horasReady,SchoolArt.battlefieldsReady]));return{page,context};};
 try{
  const {page,context}=await open();
  const result=await page.evaluate(()=>{
   const Art=SchoolArt,G=SchoolRPG;window.canvas=document.createElement('canvas');canvas.width=960;canvas.height=560;document.body.append(canvas);window.ctx=canvas.getContext('2d');
   window.s=G.create(1000,99);s.team=['taeo','harin','sua','horas','osia','lava'];for(const id of s.team)s.units[id]={level:30,xp:0,stars:1,shards:0,nextSkill:1,basicHits:0};G.action(s,{kind:'stage',stage:1,mode:'farm'},s.at);s.battle.elapsed=10000;s.simTime=10000;s.battle.horas={stacks:5,basicPose:1,lastHitStackAt:0,nextBasicAt:11000,lastCastAt:0};
   const images=[],poses=[];
   const base={time:0,reduced:true};
   for(const pose of [1,2])for(const age of [.1,.4,.75]){ctx.clearRect(0,0,960,560);ctx.fillStyle='#203040';ctx.fillRect(0,0,960,560);Art.hero(ctx,'horas',480,470,8,{...base,reduced:false,horasBasicPose:pose,attackAge:age});images.push(canvas.toDataURL());poses.push(Art.horasPose({horasBasicPose:pose,attackAge:age}));}
   const before=JSON.stringify(s);const enemy=s.battle.enemies[0].id;s.battle.horasCast={id:78,began:10000,simBegan:10000,targetId:enemy,mergeMs:1000,impactDelay:1500,targets:[{id:enemy,amount:100,critical:false,primary:true}],missed:false};
   let depth=0;const save=ctx.save.bind(ctx),restore=ctx.restore.bind(ctx);ctx.save=()=>{depth++;save();};ctx.restore=()=>{depth--;restore();};
   const castState=JSON.stringify(s),sources=[],native=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(img,...args){if(img instanceof HTMLImageElement&&img.src.includes('/horas/combat'))sources.push(img.src);return native.call(this,img,...args);};
   canvas.dataset.layout='panorama';canvas.width=755;canvas.height=330;Art.draw(ctx,s,10.15,[],true);const warmed=sources.length;for(let i=0;i<30;i++)Art.draw(ctx,s,10.15,[],true);const repeated=sources.length;
   const pending=canvas.toDataURL();
   const noMutation=castState===JSON.stringify(s);const presentPortrait=Art.frontPortrait('horas');Art.resetRenderCache();Art.draw(ctx,s,10.15,[],true);const reset=sources.length;CanvasRenderingContext2D.prototype.drawImage=native;
   return {ready:Art.assetsReady('horas')&&Art.assetsReady('horas-portrait')&&Art.assetsReady('horas-cutin'),images,poses,noMutation,depth,warmed,repeated,reset,portrait:presentPortrait,pending};
  });
  assert(result.ready);assert.deepEqual(result.poses,[1,2,3,4,5,6]);assert.equal(await page.evaluate(()=>SchoolArt.horasPose({attackAge:null,horasCastAge:null})),0,'Missing arena timestamps stay idle');assert.equal(new Set(result.images.map(hash)).size,6,'Six actual authored basic poses must differ');assert(result.noMutation);assert.equal(result.depth,0);assert.equal(result.warmed,result.repeated,'Repeated pose uses cached source');assert(result.reset>result.repeated,'Reset lazily rebuilds source');
  console.log('PASS six distinct basic poses; ready sources, balanced canvas stack, saved state unchanged, static source caching/reset');
  const captures=await page.evaluate(()=>{
   const e=s.battle.enemies[0].id,cast={kind:'horas-cast',from:'horas',castId:78,targetId:e,targets:[e],time:10},frames=[];
   for(const [name,age]of[['fusion',.3],['cutin',.8],['ritual',1.3]]){s.battle.elapsed=10000+age*1000;s.simTime=10000+age*1000;SchoolArt.draw(ctx,s,10+age,[cast],false);frames.push([name,canvas.toDataURL()]);}
   delete s.battle.horasCast;
   SchoolArt.draw(ctx,s,11.3,[cast],false);const cancelled=canvas.toDataURL();SchoolArt.draw(ctx,s,11.3,[],false);if(canvas.toDataURL()!==cancelled)throw Error('Cancelled cast must not keep a ritual, pose or cutin');
   s.battle.elapsed=11500;s.simTime=11500;s.battle.enemies[0].horasMark={castId:78,until:17500};
   for(const missed of [false,true]){SchoolArt.draw(ctx,s,11.7,[{kind:'horas-impact',from:'horas',castId:78,targetId:e,targets:s.battle.enemies.map(v=>v.id),missed,time:11.5}],false);frames.push([missed?'miss':'impact',canvas.toDataURL()]);}
   SchoolArt.draw(ctx,s,11.7,[{kind:'horas-refund',from:'horas',to:e,amount:2,time:11.5}],false);frames.push(['refund',canvas.toDataURL()]);
   SchoolArt.draw(ctx,s,11.7,[{kind:'horas-impact',from:'horas',targetId:e,targets:[e],missed:false,time:11.5}],true);frames.push(['reduced',canvas.toDataURL()]);
   return frames;
  });
  fs.mkdirSync('/tmp/school-horas-art',{recursive:true});for(const [name,data]of captures)fs.writeFileSync(`/tmp/school-horas-art/${name}.png`,Buffer.from(data.split(',')[1],'base64'));assert.equal(new Set(captures.map(x=>hash(x[1]))).size,captures.length);
  await page.evaluate(()=>{canvas.width=960;canvas.height=560;delete canvas.dataset.layout;SchoolArt.draw(ctx,s,11.7,[],false);});await page.screenshot({path:'/tmp/school-horas-art/legacy.png'});
  await context.close();
  const blocked=await open(true);const fallback=await blocked.page.evaluate(()=>{const c=document.createElement('canvas');c.width=240;c.height=240;const ctx=c.getContext('2d');SchoolArt.hero(ctx,'horas',120,200,3,{horasStacks:5,time:1});SchoolArt.recruitPortrait(ctx,'horas',1,false);return{loaded:SchoolArt.assetsReady('horas'),alpha:ctx.getImageData(0,0,240,240).data.filter((_,i)=>i%4===3).reduce((a,b)=>a+(b>0),0)};});assert.equal(fallback.loaded,false);assert(fallback.alpha>100);await blocked.context.close();assert.deepEqual(errors,[]);
  console.log('PASS fusion/cutin/ritual/impact/miss/refund/reduced and legacy view; unavailable images keep recognizable fallback; no errors');
 }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
