const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
  const document=new EventTarget(),window=new EventTarget(),timers=new Map(),players=[],contexts=[];
  let serial=0,active=true,track='title',settings={music:true,musicVolume:.35,muted:false},reject=false,late=null;
  class Audio extends EventTarget{
    constructor(){super();this.paused=true;this.currentTime=42;this.calls=0;players.push(this);}
    play(){this.calls++;if(reject)return Promise.reject(Object.assign(Error('gesture'),{name:'NotAllowedError'}));this.paused=false;return late||Promise.resolve();}
    pause(){this.paused=true;}
    removeAttribute(){}load(){this.paused=true;}
  }
  class Context{
    constructor(){this.state='running';this.currentTime=0;contexts.push(this);}
    createGain(){return this.node={gain:{value:0,cancelScheduledValues(){},setTargetAtTime(v){this.value=v;}},connect(){},disconnect(){}};}
    createMediaElementSource(){return{connect(){},disconnect(){}};}
    resume(){this.state='running';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
  }
  window.AudioContext=Context;document.hidden=false;
  vm.runInNewContext(fs.readFileSync('school/music.js','utf8'),{window,document,Audio,console,setTimeout:(f)=>{timers.set(++serial,f);return serial;},clearTimeout:id=>timers.delete(id)});
  const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
  const fire=(node,event)=>node.dispatchEvent(new Event(event));
  const music=window.SchoolMusic.create({preferences:()=>settings,active:()=>active,track:()=>track});
  music.update();assert.equal(players.length,0,'No download or audio before a gesture');
  fire(document,'pointerdown');await flush();assert.equal(players.length,1);assert(players[0].loop);assert.equal(contexts[0].node.gain.value,.35);
  assert(players[0].src.includes('title-theme.m4a'));
  for(let i=0;i<40;i++)music.update();assert.equal(players[0].calls,1,'Rendering never duplicates playback');
  settings.musicVolume=.12;music.update();assert.equal(contexts[0].node.gain.value,.12);assert.equal(players[0].currentTime,42);
  settings.muted=true;music.update();assert(players[0].paused);assert.equal(settings.musicVolume,.12);
  settings.muted=false;music.update();await flush();assert(!players[0].paused);assert.equal(contexts[0].node.gain.value,.12);
  active=false;music.update();assert.equal(contexts[0].node.gain.value,0);for(const[id,f]of timers){timers.delete(id);f();}assert(players[0].paused);
  active=true;music.update();await flush();assert(!players[0].paused);assert.equal(players[0].currentTime,42);
  document.hidden=true;fire(document,'visibilitychange');assert(players[0].paused);document.hidden=false;fire(document,'visibilitychange');await flush();assert(!players[0].paused);
  fire(window,'pagehide');assert(players[0].paused);fire(window,'pageshow');await flush();assert(!players[0].paused);
  track='lobby';music.update();await flush();assert(players[0].src.includes('winter-evening.mp3'));assert.equal(players.length,1,'Track changes reuse one media player and one audio graph');
  track='title';music.update();await flush();assert(players[0].src.includes('title-theme.m4a'));
  console.log('PASS gesture unlock, one looping player, live WebAudio volume, mute preservation, scene fade, background/BFCache pause and resume');
  settings.music=false;music.update();reject=true;settings.music=true;music.unlock();await flush();const attempts=players[0].calls;
  for(let i=0;i<40;i++)music.update();assert.equal(players[0].calls,attempts,'Autoplay denial does not retry every render');
  reject=false;music.unlock();await flush();assert(!players[0].paused);assert.equal(players.length,1);
  // A rejected play promise from the old track must not block its replacement.
  settings.music=false;music.update();let rejectOld;late=new Promise((_,r)=>rejectOld=r);settings.music=true;music.unlock();
  track='lobby';music.update();late=null;rejectOld(Object.assign(Error('old track denied'),{name:'NotAllowedError'}));await flush();
  assert(!players[0].paused);assert(players[0].src.includes('winter-evening.mp3'));
  console.log('PASS title/lobby selection, logout return and stale-track promise isolation');
  settings.music=false;music.update();let resolve;late=new Promise(r=>resolve=r);settings.music=true;music.unlock();document.hidden=true;music.update();resolve();await flush();assert(players[0].paused,'Late play completion cannot resume hidden audio');
  music.destroy();assert.equal(timers.size,0);assert.equal(contexts[0].state,'closed');fire(document,'pointerdown');assert.equal(players.length,1);
  console.log('PASS permission rejection/retry, stale play completion and complete cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});
