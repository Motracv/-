// Real Chromium with the newer Array API removed models older Android WebViews.
// It is a compatibility regression check, not a physical-device FPS guarantee.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    if (req.url === '/art-compat.html') {
      res.writeHead(200, {'Content-Type':'text/html'});
      res.end('<!doctype html><script src="school/engine.js"></script><script src="school/art.js"></script>');
      return;
    }
    try {
      const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
      if (!file.startsWith(root + path.sep)) throw Error('Outside fixture root');
      const body = fs.readFileSync(file);
      res.writeHead(200, {'Content-Type':file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'application/octet-stream'});
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium', headless:true, args:['--no-sandbox']});
  const results = [];
  try {
    for (const legacy of [false, true]) {
      const context = await browser.newContext({viewport:{width:844,height:390}, isMobile:true, hasTouch:true});
      if (legacy) await context.addInitScript(() => { delete Array.prototype.findLast; });
      const page = await context.newPage(), pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/art-compat.html`);
      await page.evaluate(() => SchoolArt.ready);
      const result = await page.evaluate(() => {
        const s = SchoolRPG.create(1000, 991);
        s.team = ['taeo','harin','sua','osia','lava','ian'];
        for (const id of s.team) s.units[id] = {level:10,xp:0,stars:0,shards:0,nextSkill:1,basicHits:0};
        SchoolRPG.action(s, {kind:'stage',stage:1,mode:'farm'}, s.at);
        const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 560;
        document.body.append(canvas);
        const c = canvas.getContext('2d'), save = c.save.bind(c), restore = c.restore.bind(c);
        const cachedCanvases = new Set(), nativeDrawImage = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
          if (image instanceof HTMLCanvasElement && image !== canvas) cachedCanvases.add(image);
          return nativeDrawImage.call(this,image,...args);
        };
        let depth = 0, maxDepth = 0, resets = 0;
        c.save = () => { save(); maxDepth = Math.max(maxDepth, ++depth); };
        c.restore = () => { restore(); depth = Math.max(0, depth - 1); };
        const width = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
        Object.defineProperty(canvas, 'width', {get() {return width.get.call(this);}, set(value) {width.set.call(this,value);depth=0;resets++;}});
        const errors = [], pictures = [], enemy = s.battle.enemies[0].id;
        const capture = (name, effects = [], time = 10.15) => {
          try {
            SchoolArt.draw(c,s,time,effects,false);
            if (depth !== 0) throw Error(`Unbalanced canvas state: ${depth}`);
            pictures.push({name,png:canvas.toDataURL()});
          } catch (error) { errors.push({name,message:error.message,depth}); }
        };
        capture('negative-replay-time', [{kind:'hit',from:'lava',to:enemy,amount:10,time:0}],-1);
        capture('idle');
        capture('basic-critical', [{kind:'hit',from:'lava',to:enemy,critical:true,amount:250,skill:false,time:10}]);
        for (let stage = 1; stage <= 4; stage++) {
          const castId = 100 + stage;
          s.battle.osiaCast = {id:castId,stage};
          capture(`osia-${stage}`, [{kind:'skill-stage',from:'osia',castId,stage,name:SchoolRPG.OSIA_SKILLS[stage-1].name,targets:[enemy],impactDelay:500,time:10}],10.35);
          s.battle.osiaCast = null;
        }
        for (const stage of [1,2]) capture(`lava-${stage}`, [{kind:'lava-skill',from:'lava',stage,targets:s.team,name:SchoolRPG.LAVA_SKILLS[stage-1].name,time:10}],10.4);
        s.battle.cinematic = {from:'osia',castId:140,duration:SchoolRPG.OSIA_CINEMATIC_MS,remaining:500};
        capture('dragon-cutscene', [{kind:'cinematic',from:'osia',castId:140,duration:SchoolRPG.OSIA_CINEMATIC_MS,time:10}],10.35);
        s.battle.cinematic = null;
        s.battle.enemies[0].hp = 0;
        capture('enemy-defeat', [{kind:'hit',from:'osia',to:enemy,amount:250,skill:true,time:10.1}],10.2);
        s.battle.phase = 'victory'; s.battle.wait = 2;
        capture('wave-clear', [],11);
        s.battle.phase = 'fight'; s.battle.enemies[0].hp = s.battle.enemies[0].max;
        // A real mobile loop continues drawing rather than passing only one frame.
        for (let i = 0; i < 90; i++) {
          try { SchoolArt.draw(c,s,12+i/30,[],false); }
          catch (error) { if (i < 3) errors.push({name:`continued-${i}`,message:error.message,depth}); }
        }
        // Simulate GPU loss of cached canvas pixels, while decoded PNGs remain.
        const cacheEffects = [{kind:'hit',from:'lava',to:enemy,critical:true,amount:250,skill:false,time:19.9},
          {kind:'skill-stage',from:'osia',castId:200,stage:4,name:'수룡',targets:[enemy],impactDelay:1500,time:19.3}];
        s.battle.osiaCast = {id:200,stage:4};
        const snapshot = () => { SchoolArt.draw(c,s,20,cacheEffects,false); return canvas.toDataURL(); };
        let cacheRecovery = null, faultRecovery = null;
        if (!errors.length) {
          const portrait = SchoolArt.portrait('lava'), front = SchoolArt.frontPortrait('osia'), before = snapshot();
          const cacheCount = cachedCanvases.size;
          for (const image of cachedCanvases) image.width = image.width;
          const corrupted = snapshot();
          SchoolArt.resetRenderCache();
          const recovered = snapshot();
          cacheRecovery = {cacheCount,corruptionVisible:before!==corrupted,exactRecovery:before===recovered,
            sourcesReady:SchoolArt.assetsReady('lava')&&SchoolArt.assetsReady('osia'),
            portraitsPreserved:portrait===SchoolArt.portrait('lava')&&front===SchoolArt.frontPortrait('osia')};
          // Throw inside a nested hero draw, after at least two save() calls.
          const fault = new Error('Injected nested rendering failure'), drawImage = c.drawImage;
          let propagated = 0, failedFrames = 0;
          c.drawImage = function(...args) { if (depth >= 2) throw fault; return drawImage.apply(this,args); };
          const resetsBefore = resets;
          for (let i=0;i<20;i++) {
            try { SchoolArt.draw(c,s,20,cacheEffects,false); }
            catch (error) { propagated += error===fault; failedFrames++; }
            if (depth !== 0) throw Error(`Failed frame leaked ${depth} canvas saves`);
          }
          c.drawImage = drawImage;
          c.fillStyle = '#a1b2c3';
          for (let i=0;i<10;i++) c.restore();
          const nativeStackEmpty = c.fillStyle === '#a1b2c3';
          const afterFault = snapshot();
          c.setTransform(1.2,0,0,1.3,7,11);c.fillStyle='#123456';
          const originalMatrix=c.getTransform();
          SchoolArt.draw(c,s,20,cacheEffects,false);
          const matrix=c.getTransform();
          faultRecovery = {failedFrames,propagated,resets:resets-resetsBefore,nativeStackEmpty,
            exactRecovery:afterFault===before,
            normalCallerStatePreserved:['a','b','c','d','e','f'].every(key=>matrix[key]===originalMatrix[key])&&c.fillStyle==='#123456'};
        }
        CanvasRenderingContext2D.prototype.drawImage = nativeDrawImage;
        return {missingAPI:typeof Array.prototype.findLast === 'undefined',errors,pictures,depth,maxDepth,resets,cacheRecovery,faultRecovery};
      });
      console.log(JSON.stringify({legacy,missingAPI:result.missingAPI,frames:result.pictures.length,errors:result.errors,depth:result.depth,maxDepth:result.maxDepth}));
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(result.errors, [], 'All battle paths must render without Array.findLast');
      assert.equal(result.depth,0,'Repeated frames must not leak canvas save states');
      assert.equal(result.missingAPI,legacy,'Do not mutate Array.prototype as a compatibility patch');
      assert.ok(result.cacheRecovery.cacheCount>5,'The fixture must exercise real cached canvases');
      for (const key of ['corruptionVisible','exactRecovery','sourcesReady','portraitsPreserved']) assert.equal(result.cacheRecovery[key],true,`Cache recovery: ${key}`);
      assert.deepEqual(result.faultRecovery,{failedFrames:20,propagated:20,resets:20,nativeStackEmpty:true,exactRecovery:true,normalCallerStatePreserved:true});
      results.push(result);
      await context.close();
    }
    assert.deepEqual(results[0].pictures,results[1].pictures,'Legacy and current browser paths must preserve the exact character/effect pixels');
    console.log('PASS mobile battle, both featured heroes, skills, critical impact, dragon cutscene and enemy defeat render identically without Array.findLast');
    console.log('PASS erased canvas caches rebuild pixel-identically; nested rendering failures propagate without save-stack leaks and the following frame recovers');
  } finally {
    await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error);process.exitCode=1;});
