// The production event controller runs against the same lightweight DOM port as
// the invitation tests. No browser, reward mutations, or production accounts.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),G=require('../school/engine.js');
const {document,Node}=require('./school-ui-dom.cjs')();
document.getElementById=id=>document.querySelector('#'+id);
const host=new Node('section','id="lobby-panel"');document.body.append(host);
const window=new Node();window.SchoolRPG={eventInfo:at=>G.eventInfo(at)};
const {startsAt,endsAt}=G.DOUBLE_REWARD_EVENT;let now=startsAt-60000,serial=0;
class Clock extends Date{static now(){return now;}}
const timers=new Map(),context=vm.createContext({window,document,Date:Clock,Intl,setInterval:fn=>{timers.set(++serial,fn);return serial;},clearInterval:id=>timers.delete(id)});
const code=fs.readFileSync('school/weekend-event.js','utf8');
const tick=()=>{for(const fn of [...timers.values()])fn();};
vm.runInContext(code,context);
const banner=document.getElementById('weekend-event'),countdown=banner.querySelector('time');
assert(banner.hidden,'the banner remains hidden before the configured event starts');assert.equal(timers.size,1);
now=startsAt;tick();assert(!banner.hidden);assert.equal(countdown.textContent,'96시간 0분 남음');assert.equal(countdown.attrs.datetime,new Date(endsAt).toISOString());
now+=60000;tick();assert.equal(countdown.textContent,'95시간 59분 남음');banner.open=true;
document.hidden=true;document.emit('visibilitychange');assert.equal(timers.size,0,'background pages do not keep polling the countdown');
now+=60000;document.hidden=false;document.emit('visibilitychange');assert.equal(timers.size,1);assert.equal(countdown.textContent,'95시간 58분 남음');
window.emit('pagehide',{persisted:true});assert.equal(timers.size,0);
now+=60000;document.emit('visibilitychange');assert.equal(timers.size,0,'pagehide stays suspended until pageshow');
window.emit('pageshow',{persisted:true});assert.equal(timers.size,1);assert.equal(countdown.textContent,'95시간 57분 남음');
window.emit('pageshow',{persisted:true});assert.equal(timers.size,1,'repeated restores never duplicate the timer');
vm.runInContext(code,context);assert.equal(host.querySelectorAll('#weekend-event').length,1);assert.equal(timers.size,1,'duplicate script evaluation does not install another banner');
window.emit('pagehide',{persisted:true});assert.equal(timers.size,0);window.emit('pageshow',{persisted:true});assert.equal(timers.size,1,'pagehide works again after the first restore');
now=endsAt;tick();assert(banner.hidden);assert.equal(banner.open,false);assert.equal(timers.size,0,'expired event closes details and releases its timer');
window.emit('pageshow',{persisted:true});assert(banner.hidden);assert.equal(timers.size,0,'an expired event does not restart its timer');
console.log('PASS event banner uses engine boundaries, KST end metadata, live countdown, hidden-page suspension, repeated bfcache restores, duplicate-script guard and expiry cleanup');
