// Restore the approved sprite in every renderer, including after a late load.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  if(req.url==='/art-fixture.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><script src="school/engine.js"></script><script src="school/art.js"></script>');return;}
  try{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))throw Error();const body=fs.readFileSync(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:600}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let release;const imageGate=new Promise(r=>release=r);
  await page.route('**/school/assets/lava.png*',async route=>{await imageGate;await route.continue();});
  await page.goto(`http://127.0.0.1:${server.address().port}/art-fixture.html`,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
   window.shot=(frame={reduced:true})=>{const c=document.createElement('canvas');c.width=200;c.height=260;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;SchoolArt.hero(ctx,'lava',100,225,4,frame);return c.toDataURL();};
   window.fallbackBattle=shot();window.fallbackFront=SchoolArt.frontPortrait('lava');window.fallbackParty=SchoolArt.portrait('lava');
   const draw=CanvasRenderingContext2D.prototype.drawImage;window.sourceDraws=0;
   CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(image instanceof HTMLImageElement&&image.src.includes('/lava.png'))sourceDraws++;return draw.call(this,image,...args);};
  });
  release();await page.waitForFunction(()=>SchoolArt.assetsReady('lava'));
  const result=await page.evaluate(()=>{
   const battle=shot(),front=SchoolArt.frontPortrait('lava'),party=SchoolArt.portrait('lava');
   const frames=[battle,shot({attackAge:.35}),shot({casting:true,motion:SchoolArt.poseForSkill('lava',1,.75)}),shot({passive:true,attackAge:.55})];
   const recruits=[0,.7].map(t=>{const c=document.createElement('canvas');c.width=248;c.height=344;SchoolArt.recruitPortrait(c.getContext('2d'),'lava',t,false);return c.toDataURL();});
   const still=[0,.7].map(t=>{const c=document.createElement('canvas');c.width=248;c.height=344;SchoolArt.recruitPortrait(c.getContext('2d'),'lava',t,true);return c.toDataURL();});
   document.body.style='margin:0;background:#dce1dd;font:16px sans-serif;display:flex;flex-wrap:wrap;align-items:end;gap:10px;';
   for(const [label,url]of [['Before',fallbackBattle],['Restored',battle],['Attack',frames[1]],['Skill',frames[2]],['Passive',frames[3]],['Recruit',front]]){const box=document.createElement('div');box.style='text-align:center';const im=new Image();im.src=url;im.style='max-height:250px';box.append(label,document.createElement('br'),im);document.body.append(box);}
   return {sourceDraws,restored:[battle!==fallbackBattle,front!==fallbackFront,party!==fallbackParty],frames,recruits,still};
  });
  assert.ok(result.sourceDraws>0,'The approved PNG must actually be drawn, not merely loaded');
  assert.ok(result.restored.every(Boolean),'Late image loading must invalidate battle, front and party fallback caches');
  assert.equal(new Set(result.frames).size,4,'Attack, skill and passive retain distinct gentle motion');
  assert.notEqual(...result.recruits);assert.equal(...result.still);
  await page.screenshot({path:'/tmp/school-lava-restored.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS original Lava PNG is rendered; late-load battle/party/recruit caches refresh; attack/skill/passive motion and reduced-motion portrait verified');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
