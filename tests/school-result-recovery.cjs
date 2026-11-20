const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),G=require('../school/engine.js');
const src=fs.readFileSync('school/client.js','utf8'),code=src.slice(src.indexOf('  async function sendPending()'),src.indexOf('  function animationTime()'));
const mem=new Map(),modal={open:false};let sends=0,reveals=0,mode='cancel';let readRelease;
const c={console,crypto,Date,Promise,document:{hidden:false},mode:'cloud',busy:false,pending:null,operation:'',profile:{id:'owner'},entry:{entered:true},verifiedToken:'x',token:'x',connected:true,revision:1,lastSync:0,completedActionKey:'',PENDING:'pending',G,storage:{get:k=>mem.get(k),set:(k,v)=>{mem.set(k,v);return true;}},accountScope:()=> 'owner',clearPending(){c.pending=null;},applyCloud(body){c.revision=body.revision;c.connected=true;},render(){},renderButtons(){},saveStatus(){},toast(){},note(){},yieldForPaint:async()=>{},piyuGuide:null,$:()=>modal,esc:x=>x,renderKey:'',partyKey:'',closeModal(){modal.open=false;},openModal(){modal.open=true;reveals++;},reveal(){modal.open=true;reveals++;},revealWeapons(){modal.open=true;reveals++;},Presentation:{recruit:async()=>{if(mode==='reject')throw Error('decode failure');return{cancelled:mode==='cancel'};}},request:async(path,input)=>{if(path.endsWith('/state')){await new Promise(r=>readRelease=r);return{revision:2};}sends++;assert.equal(input.revision,c.revision);return{revision:c.revision+1,result:{kind:'recruit',results:[{id:'yaho',fresh:true}]}};}};
vm.createContext(c);vm.runInContext(code,c);
(async()=>{
 let r=await c.act({kind:'recruit'});assert.equal(r.kind,'recruit');assert.equal(sends,1);assert.equal(reveals,0);assert.equal(c.resultQueue().length,1);c.restoreResult();assert.equal(reveals,1);assert.equal(sends,1);c.acknowledgeResult();assert.equal(c.resultQueue().length,0);modal.open=false;
 mode='reject';await c.act({kind:'recruit'});assert(c.connected);assert.equal(reveals,2);assert.equal(sends,2);c.acknowledgeResult();modal.open=false;
 mode='normal';const sync=c.sync();assert.equal(c.busy,false,'background read never blocks controls');const action=c.act({kind:'recruit'});await Promise.resolve();assert.equal(sends,2,'purchase waits for current server revision');readRelease();await sync;await action;assert.equal(sends,3);assert.equal(c.busy,false);assert(c.connected);
 c.busy=true;assert((await c.act({kind:'winter-exchange'})).error);
 // Background boss polls and loot already handled by the encounter must not
 // repeatedly announce an unrelated zero-gold reward during auto farming.
 c.toast=()=>{throw Error('Unexpected generic reward toast');};c.play=()=>{throw Error('Unexpected generic reward sound');};
 await c.showResult({kind:'santa-tick'});await c.showResult({kind:'santa-spin'});
 // Reconnection must always release controls, including a failed login.
 const loginCode=src.slice(src.indexOf('  async function useCloud()'),src.indexOf('  function accountModal()'));
 const login={busy:false,token:'t',lastSync:0,mode:'cloud',connected:true,pending:null,Date,performance,renderButtons(){},saveStatus(){},toast(){},note(){},$:()=>null,request:async()=>{throw Error('offline');},entry:{refresh(){}}};vm.createContext(login);vm.runInContext(loginCode,login);assert.equal(await login.useCloud(),false);assert.equal(login.busy,false);
 Object.assign(login,{request:async p=>p.endsWith('/me')?{profile:{id:'a'}}:{state:{seq:0}},tokenFingerprint:async()=> 'f',Presentation:null,confirmedScope:'',storage:{set(){},get(){return null;},remove(){}},MODE:'mode',PENDING:'p',clearPending(){},applyCloud(){},closeModal(){},effects:[],sync(){}});assert.equal(await login.useCloud(),true);assert.equal(login.busy,false);
 console.log('PASS committed cancelled results recovered without reroll, animation failures stay connected, slow reads serialize one purchase, busy actions return explicit errors');
})().catch(e=>{console.error(e);process.exitCode=1});
