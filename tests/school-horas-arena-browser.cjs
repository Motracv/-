// Exercises the real replay renderer with an authoritative seeded match.
// SQLite authentication/persistence is covered by school-horas-server.cjs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),G=require('../school/engine.js');
const ROOT=path.resolve(__dirname,'..');
(async()=>{
 const {simulateArena}=await import('../online/arena.mjs');
 const make=()=>{const s=G.create(1);s.team=['taeo','geonu','doyoon','horas','osia','lava'];for(const id of s.team)s.units[id]={level:50,stars:3,xp:0,shards:0};return s;};
 const match={...simulateArena(G,[make(),make()],['벚꽃단장','별빛단장'],9973),id:'replay-horas',meSide:0,ratingChange:10};
 const pageHTML='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/school/style.css"><link rel="stylesheet" href="/school/social.css"></head><body><dialog id="modal"><div class="modal-top"><h2 id="modal-title"></h2><button id="modal-close">×</button></div><div id="modal-content"></div></dialog><script src="/school/engine.js"></script><script src="/school/art.js"></script><script src="/school/social.js"></script></body></html>';
 const server=http.createServer((req,res)=>{
  try{const url=new URL(req.url,'http://local');if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(pageHTML);return;}
   const file=path.resolve(ROOT,'.'+url.pathname);if(!file.startsWith(ROOT+path.sep))throw Error('outside fixture');
   const types={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
  }catch{res.writeHead(404);res.end();}
 });
 let browser;const errors=[],failed=[];
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'no-preference'});
  page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('favicon.ico'))failed.push(response.url());});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>SchoolArt.assetsReady('horas'));
  await page.evaluate(match=>{
   window.replayFrames=[];window.replayEffects=[];
   const hero=SchoolArt.hero,effects=SchoolArt.horasVisualEffects;
   SchoolArt.hero=function(c,id,x,y,scale,frame){if(id==='horas'){replayFrames.push({flip:frame.flip,pose:frame.horasBasicPose,attack:frame.attack,stacks:frame.horasStacks,castAge:frame.horasCastAge,time:frame.time});if(replayFrames.length>15000)replayFrames.shift();}return hero.apply(this,arguments);};
   SchoolArt.horasVisualEffects=function(c,battle,events,positions,time){replayEffects.push({side:battle.heroes[0].side,cast:!!battle.horasCast,time,events:events.map(event=>event.kind),marked:battle.enemies.some(enemy=>enemy.horasMark&&enemy.horasMark.until>battle.elapsed)});if(replayEffects.length>15000)replayEffects.shift();return effects.apply(this,arguments);};
   const state=SchoolRPG.create(Date.now());
   window.replayUI=SchoolSocial.create({getState:()=>state,isCloud:()=>true,toast:message=>{throw Error(message);},openModal(title,inner){document.querySelector('#modal-title').textContent=title;document.querySelector('#modal-content').innerHTML=inner;if(!document.querySelector('#modal').open)document.querySelector('#modal').showModal();},request:async(path,data)=>data.kind==='arena_match'?{match}:{me:{name:'벚꽃단장',canName:false,rating:1000},friends:[],requests:{incoming:[],outgoing:[]},invites:{incoming:[],outgoing:[]},matches:[{id:match.id,opponent:'별빛단장',result:'win',createdAt:Date.now()}]}});
   replayUI.openArena();
  },match);
  await page.click('[data-social-action="arena_match"]');
  await page.waitForFunction(()=>replayFrames.slice(-4).some(frame=>frame.castAge>.6&&frame.castAge<1.05),{},{timeout:25000});
  await page.screenshot({path:'/tmp/school-horas-arena-cutin.png'});
  await page.waitForFunction(()=>replayEffects.slice(-4).some(frame=>frame.events.includes('horas-impact')));
  await page.screenshot({path:'/tmp/school-horas-arena-impact.png'});
  const observed=await page.evaluate(()=>({frames:replayFrames,effects:replayEffects}));
  for(const flip of[false,true]){
   const frames=observed.frames.filter(frame=>frame.flip===flip);assert(frames.length>20);assert(frames.some(frame=>frame.attack&&frame.pose===1));assert(frames.some(frame=>frame.attack&&frame.pose===2));assert(frames.some(frame=>frame.stacks>0));
  }
  assert(observed.frames.some(frame=>frame.castAge>0));assert(observed.effects.some(frame=>frame.events.includes('horas-impact')));
  await page.setViewportSize({width:755,height:330});await page.screenshot({path:'/tmp/school-horas-arena-mobile.png'});
  await page.click('#arena-skip');assert.equal(await page.locator('#arena-replay-result').isVisible(),true);assert.equal(await page.locator('#arena-progress').getAttribute('value'),String(match.durationMs));
  await page.click('#arena-damage-report');assert.equal(await page.locator('.arena-damage-row').count(),12);
  await page.click('#arena-back');const count=await page.evaluate(()=>replayFrames.length);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>replayFrames.length),count);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log(JSON.stringify({frames:observed.frames.length,side0:observed.frames.filter(frame=>!frame.flip).length,side1:observed.frames.filter(frame=>frame.flip).length,distinctBasicPoses:true,castAndImpact:true,skipAndDamage:true,cleanup:true,errors,failed}));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
