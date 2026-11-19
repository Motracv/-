const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),G=require('../school/engine.js'),Auto=require('../school/tower-auto.js');
const now=Date.now(),fresh=()=>G.create(now,761);
const s=fresh();assert.deepEqual(s.onboarding,{version:1,step:0});assert(G.validate(s));
const money=[s.gold,s.gems,s.pulls];G.action(s,{kind:'onboarding',step:4,gems:999999,hero:'horas'},s.at);assert.deepEqual([s.gold,s.gems,s.pulls],money);G.action(s,{kind:'onboarding',step:2},s.at);assert.equal(s.onboarding.step,4);
for(const step of [-1,9,1.5,'4',null,Infinity]){const snapshot=G.clone(s);assert.throws(()=>G.action(s,{kind:'onboarding',step},s.at));assert.deepEqual(s,snapshot);}
assert.throws(()=>G.action(s,{kind:'onboarding',step:8},s.at));G.action(s,{kind:'rename',name:'단장삐유'},s.at);G.action(s,{kind:'onboarding',step:8},s.at);assert.equal(G.view(s).onboarding.step,8);const old=G.clone(s);delete old.onboarding;assert(G.validate(old));G.advance(old,old.at+500);assert.equal(old.onboarding,undefined);
for(const onboarding of [{version:1,step:9},{version:0,step:0},{version:1,step:'0'}])assert(!G.validate({...s,onboarding}));

// The actual client functions must suppress the result dialog while sync is busy.
const {document,Node}=require('./school-ui-dom.cjs')();document.getElementById=id=>document.querySelector('#'+id);
Node.prototype.appendChild=Node.prototype.append;
for(const id of ['modal','boot-screen','rotate-prompt']){const el=new Node('div',`id="${id}"`);el.hidden=true;el.open=false;document.body.append(el);}
const source=fs.readFileSync('school/client.js','utf8'),slice=source.slice(source.indexOf('  const towerAuto='),source.indexOf('  function dungeonHelp()'));
let stamp=0,showCount=0,requests=[],resolve,store=new Map([['school-tower-auto:A','on']]);
const result={runId:'r1',kind:'tower',won:true,floor:1};
const context={window:{SchoolTowerAuto:Auto},document,$:document.getElementById,storage:{get:k=>store.get(k),set:(k,v)=>store.set(k,v)},accountScope:()=>context.scope,
  scope:'A',state:{activities:{run:{id:'r1',settled:true}}},confirmedActivityResult:result,activityAwaitingConfirmation:()=>false,
  performance:{now:()=>stamp},G,busy:true,pending:null,mode:'cloud',connected:true,verifiedToken:'t',token:'t',piyuGuide:null,afk:null,entry:{entered:true},dismissedActivityResult:null,dungeonRenderKey:'',modalKind:'',resultPresentationBusy:()=>false,
  activityResultKey:r=>context.scope+':'+r.runId,pendingResultNotice:()=>{},showActivityResult:()=>showCount++,
  act:input=>{requests.push(input);return new Promise(r=>resolve=r);}
};vm.createContext(context);vm.runInContext(slice+'\nthis.check=maybeShowActivityResult;',context);
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
 context.check();assert.equal(showCount,0);assert.equal(requests.length,0);context.busy=false;context.check();
 stamp=2900;context.busy=true;context.check();assert.equal(showCount,0);
 stamp=3100;context.busy=false;context.check();assert.equal(requests.length,1);assert.equal(requests[0].floor,2);
 context.check();assert.equal(requests.length,1);resolve(undefined);await flush();
 stamp=3200;context.check();stamp=6300;context.check();assert.equal(requests.length,2,'failed dispatch can retry after delay');
 context.state.activities.run={id:'r2',settled:false};resolve({kind:'activity'});await flush();context.check();assert.equal(requests.length,2);
 context.confirmedActivityResult={...result,runId:'r2',floor:2};context.state.activities.run.settled=true;context.afk={active:true};stamp=6500;context.check();stamp=9600;context.check();assert.equal(requests.at(-1).floor,3,'screen lock does not block progression');resolve({kind:'activity'});await flush();
 context.confirmedActivityResult={...result,runId:'r3',floor:3,won:false};context.state.activities.run={id:'r3',settled:true};context.check();assert.equal(store.get('school-tower-auto:A'),'off');assert.equal(showCount,0,'defeat must not unlock AFK');context.afk=null;context.check();assert.equal(showCount,1);
 const a=Auto.create(),o={scope:'one',enabled:true,result,confirmed:false,blocked:false,now:0,maxFloor:10};assert.equal(a.tick(o).waiting,true);assert.equal(a.tick({...o,now:9000,confirmed:true}).remaining,3);assert.equal(a.tick({...o,now:12000,confirmed:true}).floor,2);a.acknowledge(true);assert.deepEqual(a.tick({...o,now:13000,confirmed:true}),{});assert.equal(a.tick({...o,scope:'two',now:13000,confirmed:true}).remaining,3);assert.equal(a.tick({...o,result:{...result,floor:10},maxFloor:10}).stop,true);
 console.log('PASS onboarding persistence/no rewards/legacy compatibility, actual client busy-result regression, retry, single dispatch, account isolation, AFK tower progression and defeat');
})().catch(e=>{console.error(e);process.exitCode=1;});
