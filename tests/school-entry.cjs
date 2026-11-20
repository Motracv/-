const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {document,Node}=require('./school-ui-dom.cjs')();document.getElementById=id=>document.querySelector('#'+id);Node.prototype.replaceChildren=function(){this.children=[];};
for(const id of ['school-entry','entry-message','entry-start','entry-google','entry-retry','entry-account','entry-signout','entry-test-form','entry-test-code','entry-test-submit','board-viewport','app','rotate-prompt','entry-server-check','entry-server-status'])document.body.append(new Node('div',`id="${id}"`));
const $=document.getElementById,window={},callbacks=[];let verified=false,entered=0,loginCount=0,token=false,profile=null;
const ctx={authenticated:()=>verified,profile:()=>profile,hasToken:()=>token,enter:()=>entered++,logout:async()=>{verified=token=false;entry.show();},reconnect:async()=>{},sdk:async()=>{window.google={accounts:{id:{initialize:x=>callbacks.push(x.callback),renderButton(){}}}};},request:async path=>path.endsWith('/config')?{enabled:true,clientId:'fake'}:path.endsWith('/challenge')?{nonce:'fake'}:{token:'opaque',profile:{isTest:path.endsWith('test-login')}},login:async result=>{loginCount++;token=verified=true;profile=result.profile;}};
vm.runInNewContext(fs.readFileSync('school/entry.js','utf8'),{window,document});const entry=window.SchoolEntry.create(ctx),flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
 assert(!entry.entered);assert($('board-viewport').hidden);assert($('app').inert);$('entry-start').onclick();assert.equal(entered,0,'no guest entrance');
 await $('entry-server-check').onclick();assert.equal($('entry-server-status').textContent,'서버 응답 확인');assert(!verified,'Checking server does not sign in');
 const request=ctx.request;ctx.request=async()=>{throw Error('offline');};await $('entry-server-check').onclick();assert($('entry-server-status').textContent.includes('연결 확인 필요'));assert.equal($('entry-server-check').disabled,false);ctx.request=request;
 await entry.google();await callbacks.at(-1)({credential:'fake'});assert(verified);assert(!entry.entered,'login stays at title until Start');assert.equal($('entry-start').disabled,false);
 $('entry-start').onclick();assert.equal(entered,1);assert(entry.entered);assert(!$('app').inert);assert(!$('board-viewport').hidden);
 $('entry-start').onclick();assert.equal(entered,1,'Repeated start clicks cannot enter twice');
 await callbacks.at(-1)({credential:'late'});assert.equal(loginCount,1,'late login callback cannot switch an entered account');
 await $('entry-signout').onclick();assert(!entry.entered);assert.equal($('entry-start').hidden,true);
 await entry.google();const stale=callbacks.at(-1);$('entry-test-code').value='not-a-production-secret';await $('entry-test-form').onsubmit({preventDefault(){}});assert.equal($('entry-test-code').value,'');assert($('entry-account').textContent.includes('비공개'));await stale({credential:'late'});assert.equal(loginCount,2);

 // Exercise the actual client action handler against definitive and uncertain errors.
 const source=fs.readFileSync('school/client.js','utf8'),body=source.slice(source.indexOf('  async function act(input)'),source.indexOf('  async function showResult(result)'));
 const world={entry:{entered:true},mode:'cloud',token:'t',verifiedToken:'t',busy:false,pending:null,connected:true,operation:'',completedActionKey:'',revision:1,profile:{id:'A'},PENDING:'pending',crypto:require('node:crypto').webcrypto,storage:{set:()=>true},renderButtons(){},saveStatus(){},toast(){},note(){},couponMessage(){},yieldForPaint:async()=>{},clearPending:()=>{world.pending=null;},expireSession:()=>{world.entry.entered=false;world.token=null;},applyCloud:()=>{world.connected=true;},request:async()=>({}),showResult:async()=>{},piyuGuide:null,lastSync:0,sync:async()=>{},sendPending:async()=>{throw Object.assign(Error('이미 사용 중인 이름'),{status:409});}};
 vm.createContext(world);vm.runInContext(body+'\nthis.act=act;',world);
 let result=await world.act({kind:'rename',name:'중복이름'});assert(result.error.includes('이미'));assert.equal(world.pending,null);assert(world.connected);assert(!world.busy);
 world.sendPending=async()=>{world.pending=null;return {kind:'rename'};};assert.equal((await world.act({kind:'rename',name:'새이름'})).kind,'rename');
 world.sendPending=async()=>{throw Object.assign(Error('server'),{status:503});};await world.act({kind:'train'});assert(world.pending,'uncertain write must remain recoverable');
 world.entry.entered=false;world.pending=null;world.connected=true;let sent=false;world.sendPending=async()=>{sent=true;};await world.act({kind:'train'});assert(!sent,'title gate blocks spending');
 console.log('PASS title/auth controllers: no guest entrance, explicit Start, session/logout, stale callbacks, operator login, duplicate name retry, uncertain write retention, action gate');
})().catch(e=>{console.error(e);process.exitCode=1;});
