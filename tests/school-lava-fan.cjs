// Approved fan poses are rendered as frames, not by rotating the idle PNG.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..'),meta=JSON.parse(fs.readFileSync(path.join(root,'school/assets/lava-fan-basic.json'),'utf8'));
 const server=http.createServer((req,res)=>{
  if(req.url==='/lava-fan-fixture.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><script src="school/engine.js"></script><script src="school/art.js"></script>');return;}
  try{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))throw Error();const body=fs.readFileSync(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:650}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/school/assets/lava-fan-basic.webp*',async route=>{await gate;await route.continue();});
  await page.goto(`http://127.0.0.1:${server.address().port}/lava-fan-fixture.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>SchoolArt.assetsReady('lava'));
  await page.evaluate(()=>{
   const draw=CanvasRenderingContext2D.prototype.drawImage;window.fanSamples=[];
   CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(image instanceof HTMLImageElement&&image.src.includes('/lava-fan-basic.webp'))fanSamples.push({pose:args[1]/320*5+args[0]/288,rect:args.slice(0,4)});return draw.call(this,image,...args);};
   const canvas=document.createElement('canvas');canvas.width=210;canvas.height=280;const c=canvas.getContext('2d');
   window.shot=(frame={})=>{c.clearRect(0,0,canvas.width,canvas.height);SchoolArt.hero(c,'lava',100,230,4,frame);return {png:canvas.toDataURL(),canvas};};
   window.unchangedFrames=[{time:.2},{time:.2,casting:true,motion:SchoolArt.poseForSkill('lava',1,.7)},{time:.2,passive:true,attackAge:.5},{time:.2,attackAge:.5,reduced:true},{time:.2,attackAge:.5,dead:true}];
   window.before=unchangedFrames.map(frame=>shot(frame).png);
   window.beforePortraits=[SchoolArt.portrait('lava'),SchoolArt.frontPortrait('lava')];
   window.fallbackAttack=shot({time:.4,attackAge:.4}).png;
  });
  release();await page.evaluate(()=>SchoolArt.ready);
  const result=await page.evaluate(meta=>{
   const unchanged=unchangedFrames.map((frame,i)=>shot(frame).png===before[i]);
   const portraits=[SchoolArt.portrait('lava'),SchoolArt.frontPortrait('lava')];
   const frames=[],poses=[],feet=[],sourceCounts=[];let elapsed=0;
   for(let i=0;i<meta.originalHoldsMs.length;i++){
    const age=(elapsed+meta.originalHoldsMs[i]/2)/meta.originalDurationMs;
    // Flush pose caches to observe which approved source cell is actually used.
    SchoolArt.resetRenderCache();const start=fanSamples.length;
    const {png,canvas}=shot({time:10+age,basicAttackAt:10,attackAge:age});
    frames.push(png);poses.push(fanSamples[start]?.pose);sourceCounts.push(fanSamples.length-start);
    const data=canvas.getContext('2d').getImageData(110,234,30,14).data;let bottom=-1,right=-1;
    for(let y=0;y<14;y++)for(let x=0;x<30;x++)if(data[(y*30+x)*4+3]>=210){bottom=Math.max(bottom,y);}
    for(let y=Math.max(0,bottom-3);y<=bottom;y++)for(let x=0;x<30;x++)if(data[(y*30+x)*4+3]>=210)right=Math.max(right,x);
    feet.push({right:right+110,bottom:bottom+234});elapsed+=meta.originalHoldsMs[i];
   }
   SchoolArt.resetRenderCache();fanSamples.length=0;
   for(let i=0;i<60;i++)shot({time:20+i/60,basicAttackAt:20,attackAge:i/60});
   const firstCycleSamples=fanSamples.length;
   for(let cycle=1;cycle<=5;cycle++)for(let i=0;i<60;i++)shot({time:20+cycle+i/60,basicAttackAt:20+cycle,attackAge:i/60});
   const laterCycleSamples=fanSamples.length-firstCycleSamples;
   const startPose=shot({time:30,basicAttackAt:30}).png;
   const recovered=shot({time:31,basicAttackAt:30}).png;
   const idle=shot({time:31}).png;
   const next=shot({time:31,basicAttackAt:31}).png;
   const direct=shot({attackAge:.5}).png,atSpeed=shot({time:100+.5,basicAttackAt:100}).png;
   document.body.style='margin:12px;background:#dce1dd;font:14px sans-serif;display:flex;flex-wrap:wrap;gap:4px;';
   for(const [label,png]of [['Idle',before[0]],...frames.map((png,i)=>[`Frame ${i+1}`,png])]){const div=document.createElement('div'),image=new Image();image.src=png;image.style='width:150px;height:200px';div.style='text-align:center';div.append(label,document.createElement('br'),image);document.body.append(div);}
   return {unchanged,portraitsUnchanged:JSON.stringify(portraits)===JSON.stringify(beforePortraits),frames,poses,feet,sourceCounts,
    firstCycleSamples,laterCycleSamples,newAttack:frames[6]!==fallbackAttack,recovered:recovered===idle,restarted:next===startPose,speedUsesSimulationTime:direct===atSpeed};
  },meta);
  assert.ok(result.unchanged.every(Boolean),'Original idle, skill, passive, reduced and dead poses must stay unchanged');
  assert.equal(result.portraitsUnchanged,true);
  assert.deepEqual(result.poses,meta.sequence);assert.ok(result.sourceCounts.every(n=>n===1));
  assert.equal(new Set(result.frames).size,10,'All ten distinct approved source poses must actually be drawn');
  assert.ok(result.feet.every(p=>p.right>=125&&p.right<=128&&p.bottom>=240&&p.bottom<=243),JSON.stringify(result.feet));
  assert.equal(result.firstCycleSamples,10);assert.equal(result.laterCycleSamples,0,'Repeated attacks reuse the bounded pose atlas');
  assert.equal(result.newAttack,true);assert.equal(result.recovered,true);assert.equal(result.restarted,true);assert.equal(result.speedUsesSimulationTime,true);
  assert.deepEqual(errors,[]);await page.screenshot({path:'/tmp/school-lava-fan-poses.png',fullPage:true});
  console.log(JSON.stringify({poses:result.poses,feet:result.feet,firstCycleSamples:result.firstCycleSamples,laterCycleSamples:result.laterCycleSamples}));
  console.log('PASS approved fan frames/time proportions/foot anchors, complete one-second cycles, cache reuse, late loading and original non-attack poses');
 }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
