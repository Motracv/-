const assert=require('node:assert/strict');
// Feed synthetic refresh timestamps to the real client animation closure. This
// checks scheduling on high-refresh displays, not physical display performance.
async function runFrameCadence({pageFor}){
 const p=await pageFor('frame-cadence',844,390);
 try{
  await p.click('#settings-button');await p.uncheck('#setting-motion');await p.click('#modal-close');
  await p.evaluate(()=>{window.frameQA={queue:[],draws:0,realRAF:requestAnimationFrame.bind(window),realDraw:SchoolArt.draw};window.requestAnimationFrame=fn=>fn.name==='animate'?(window.frameQA.queue.push(fn),0):window.frameQA.realRAF(fn);SchoolArt.draw=()=>{window.frameQA.draws++;};});
  await p.waitForTimeout(80);
  const counts=await p.evaluate(()=>{const q=window.frameQA;if(!q.queue.length)throw Error('Client animation callback was not captured');const step=time=>{const fn=q.queue.shift(),before=q.draws;if(!fn)throw Error('Missing animation continuation');fn(time);if(q.draws-before>1)throw Error('More than one draw in one animation callback');};window.frameQAStep=step;const result=[];let base=100000;for(const hz of[60,90,144]){const before=q.draws;for(let i=0;i<hz*10;i++)step(base+i*1000/hz);result.push({hz,frames:q.draws-before,seconds:10});base+=20000;}window.frameQATime=base;const before=q.draws;step(base);step(base+5000);result.push({pauseFrames:q.draws-before});return result;});
  for(const result of counts.filter(x=>x.hz))assert.ok(result.frames>=599&&result.frames<=601,`Actual client cadence at ${result.hz}Hz: ${result.frames}/10 seconds`);assert.equal(counts.at(-1).pauseFrames,2,'A five-second stall draws once on return instead of replaying missed frames');
  await p.click('#settings-button');const hidden=await p.evaluate(()=>{const before=frameQA.draws;for(let i=0;i<60;i++)frameQAStep(frameQATime+6000+i*1000/60);return frameQA.draws-before;});assert.equal(hidden,0,'A covering modal suspends battlefield drawing');await p.check('#setting-motion');await p.click('#modal-close');const reduced=await p.evaluate(()=>{const before=frameQA.draws;for(let i=0;i<600;i++)frameQAStep(frameQATime+8000+i*1000/60);return frameQA.draws-before;});assert.ok(reduced>=83&&reduced<=85,'Reduced motion retains the slower visual cadence');
  await p.click('#settings-button');await p.uncheck('#setting-motion');await p.evaluate(()=>frameQAStep(frameQATime+20000));await p.click('#modal-close');await p.evaluate(()=>{const q=frameQA;window.requestAnimationFrame=q.realRAF;SchoolArt.draw=function(...args){q.realDrawCount=(q.realDrawCount||0)+1;return q.realDraw.apply(this,args);};q.realStart=performance.now();q.realRAF(q.queue.shift());});await p.waitForTimeout(1200);const real=await p.evaluate(()=>({draws:frameQA.realDrawCount,seconds:(performance.now()-frameQA.realStart)/1000}));assert.ok(real.draws>0,'Drawing resumes after the covering modal closes');
  console.log('PASS actual animation closure targets 60 draws/s at synthetic 60/90/144Hz, skips backlog, pauses behind modals and honors reduced motion; resumed local sample '+(real.draws/real.seconds).toFixed(1)+' draws/s');
 }finally{await p.context().close();}
}
module.exports={runFrameCadence};
