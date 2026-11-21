'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../previews/parasol-skills'),E=require(root+'/engine.js');
const meta=JSON.parse(fs.readFileSync(root+'/assets/animations.json','utf8'));
const make=()=>new E.Engine(meta);
for(let skill=0;skill<3;skill++){
  const e=make();e.cast(skill);e.advance(2400);
  assert.deepEqual(e.state.targetHits,skill===0?[0,0,1]:[1,1,1]);
  assert.equal(e.state.action,null);assert.equal(e.state.casts.length,0);
}
console.log('PASS single rear target, three-target piercing/fan, effect expiry');
{
 const e=make();e.cast(0);e.advance(300);e.dodge();e.advance(2400);
 assert.equal(e.state.totalHits,0,'interrupted preparation cannot hit');
 const fired=make();fired.cast(0);fired.advance(640);fired.dodge();fired.advance(2400);
 assert.equal(fired.state.totalHits,1,'already released shot survives dodge');
}
console.log('PASS evade before and after projectile release');
{
 const e=make();e.cast(0);e.cast(1);e.cast(2);e.advance(2600);
 assert.deepEqual(e.state.used,[1,0,1]);assert.deepEqual(e.state.targetHits,[1,1,2]);
 const p=make();p.cast(2);p.advance(300);p.state.paused=true;
 const frozen=JSON.stringify(p.state);p.advance(9000);assert.equal(JSON.stringify(p.state),frozen);
 p.state.paused=false;p.advance(2200);assert.equal(p.state.totalHits,3);
}
console.log('PASS last-input queue, one action per request, pause/resume');
{
 const e=make();e.setAuto(true);e.advance(10000);assert.ok(e.state.used.every(n=>n>0));
 e.cast(2);assert.equal(e.state.auto,false);e.advance(3000);
 e.setInput(-1);e.advance(3000);assert.equal(e.state.x,115);e.setInput(1);e.advance(3000);assert.equal(e.state.x,270);
 e.setInput(-1);e.dodge();e.advance(1000);assert.equal(e.state.x,180);
 e.reset();assert.equal(e.state.x,195);assert.equal(e.state.totalHits,0);assert.equal(e.state.queue,null);
}
console.log('PASS repeated showcase, manual takeover, movement bounds and reset');
{
 const a=make(),b=make();a.cast(2);b.cast(2);a.advance(1800);for(let i=0;i<180;i++)b.advance(10);
 assert.equal(a.state.totalHits,b.state.totalHits);assert.deepEqual(a.state.targetHits,b.state.targetHits);
 for(const m of meta.motions)for(const f of m.frames)assert.ok(f.w>0&&f.h>0&&f.x>=0&&f.y>=0&&f.x+f.w<=meta.width&&f.y+f.h<=meta.height);
}
console.log('PASS time-step independence and 48 valid source rectangles');
