// Capture real Canvas draw transforms at 60 Hz. No device FPS claim is made.
const {chromium} = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), http = require('node:http'), path = require('node:path');
(async () => {
  const root = path.resolve(__dirname,'..');
  const server = http.createServer((req,res) => {
    if (req.url === '/motion-fixture.html') {
      res.writeHead(200,{'Content-Type':'text/html'});
      res.end('<!doctype html><script src="school/engine.js"></script><script src="school/art.js"></script>'); return;
    }
    try {
      const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
      if (!file.startsWith(root+path.sep)) throw Error('Outside fixture');
      const body=fs.readFileSync(file);
      res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'application/octet-stream'});res.end(body);
    } catch {res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:755,height:330},deviceScaleFactor:3,isMobile:true,hasTouch:true}), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/motion-fixture.html`);
    await page.evaluate(()=>SchoolArt.ready);
    const result=await page.evaluate(()=>{
      const s=SchoolRPG.create(1000,991);s.best=31;s.team=['taeo','harin','sua','osia','lava','ian'];
      for(const id of s.team)s.units[id]={level:30,xp:0,stars:0,shards:0,nextSkill:1,basicHits:0};
      SchoolRPG.action(s,{kind:'stage',stage:31,mode:'farm'},s.at);
      s.wave=4;const team=s.team;s.team=[];SchoolRPG.action(s,{kind:'team',team},s.at);
      s.battle.elapsed=2000;
      const canvas=document.createElement('canvas');canvas.width=823;canvas.height=480;
      const c=canvas.getContext('2d'),native=c.drawImage,frames=[],images=[];
      let observed=null;
      c.drawImage=function(image,dx,dy,w,h,...rest){
        if(dx===-25&&dy===-49&&w===56&&h===56){
          const matrix=c.getTransform(),x=matrix.e/(canvas.width/480),y=matrix.f/(canvas.height/280);
          if(x>155&&x<171&&y>210&&y<221){
            if(!images.includes(image))images.push(image);
            observed={x:Math.round(x*1000)/1000,pose:images.indexOf(image)};
          }
        }
        return native.call(this,image,dx,dy,w,h,...rest);
      };
      const snapshot=JSON.stringify(s),event={kind:'hit',from:'harin',to:s.battle.enemies[0].id,amount:20,time:10};
      for(let i=-2;i<=36;i++){
        observed=null;SchoolArt.draw(c,s,10+i/60,[event],false);
        if(!observed)throw Error(`Hero draw missing at frame ${i}`);
        frames.push({age:i/60,...observed});
      }
      const steps=frames.slice(1).map((f,i)=>Math.abs(f.x-frames[i].x));
      SchoolArt.draw(c,s,20,[],false);const idle=canvas.toDataURL();
      SchoolArt.draw(c,s,20,[{...event,time:18}],false);const settled=canvas.toDataURL();
      SchoolArt.draw(c,s,10.1,[event],true);const reducedX=observed.x;
      const target=s.battle.heroes.find(h=>h.id==='harin');target.stunUntil=3000;
      SchoolArt.draw(c,s,10.1,[event],false);const stunnedX=observed.x;delete target.stunUntil;
      return {frames,maxJump:Math.max(...steps),changedFrames:steps.filter(d=>d>.001).length,
        idleUnchanged:idle===settled,stateUnchanged:JSON.stringify(s)===snapshot,reducedX,stunnedX};
    });
    assert.deepEqual(errors,[]);
    assert.equal(result.frames[0].x,160);assert.equal(result.frames.at(-1).x,160);
    assert.equal(Math.max(...result.frames.map(f=>f.x)),168,'The existing eight-pixel reach is preserved');
    assert.ok(result.maxJump<=1.001,`One-frame jump is ${result.maxJump}px`);
    assert.ok(result.changedFrames>=14,'The actor must move across intermediate positions');
    const idlePose=result.frames[0].pose,attackPose=result.frames.find(f=>f.age===0).pose;
    assert.notEqual(attackPose,idlePose);
    assert.ok(result.frames.every(f=>f.pose===(f.age>=0&&f.age<.25?attackPose:idlePose)),'The original attack-pose timing stays unchanged');
    assert.equal(result.reducedX,160);assert.equal(result.stunnedX,160);
    assert.equal(result.idleUnchanged,true);assert.equal(result.stateUnchanged,true);
    console.log(JSON.stringify({maxJump:result.maxJump,changedFrames:result.changedFrames,positions:result.frames.map(f=>f.x-160)}));
    console.log('PASS 60Hz attack transforms ease through intermediate pixels, preserve reach/pose timing, return exactly to idle, and leave battle data unchanged');
  } finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
