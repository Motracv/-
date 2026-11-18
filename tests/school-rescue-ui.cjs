const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let now=0,timeout=null,root=null;const listeners=new Map(),sent=[];
class Node{constructor(){this.style={};this.children=[];}set innerHTML(v){this.html=v;this.children=[];}querySelector(){return this.bar||(this.bar=new Node());}append(n){this.children.push(n);}setAttribute(){}remove(){if(root===this)root=null;}}
const arena={append(n){root=n;}},document={createElement:()=>new Node(),querySelector:()=>arena,addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)};
const sandbox={window:{},document,performance:{now:()=>now},crypto:{getRandomValues:a=>a.fill(0)},matchMedia:()=>({matches:false}),setTimeout:f=>(timeout=f,1),clearTimeout:()=>{timeout=null;},queueMicrotask:f=>f(),Promise};
vm.runInNewContext(fs.readFileSync('school/rescue.js','utf8'),sandbox);
const ui=sandbox.window.SchoolRescue.create((kind,data)=>{sent.push({kind,...data});return true;});
const snapshot=(mode,id='challenge')=>({serverTime:0,room:{id:'room',status:'fighting',battle:{elapsed:0,teams:[{isMe:true,units:[{hp:100}],rescue:{id,freezeId:'ice',mode,sequence:mode==='touch'?[0,1,2,3]:['KeyQ','KeyW','KeyE','KeyR'],outcome:'pending',expiresAt:2600}},{isMe:false,frozen:{id:'ice'},units:[{hp:100}]}]}}});
const press=(code,repeat=false)=>listeners.get('keydown')?.({code,repeat,preventDefault(){},stopImmediatePropagation(){}});
ui.update(snapshot('keyboard'));assert.equal(root.children.length,1);assert(!root.children[0].onpointerdown);press('KeyQ',true);assert.equal(sent.length,0);for(const key of ['KeyQ','KeyW','KeyE','KeyR'])press(key);assert.equal(sent.length,1);assert.equal(sent[0].kind,'thaw-submit');assert.deepEqual(Array.from(sent[0].inputs),['KeyQ','KeyW','KeyE','KeyR']);assert(!listeners.has('keydown'));
ui.destroy();sent.length=0;ui.update(snapshot('keyboard','wrong'));press('KeyF');assert.equal(sent.length,1);assert.equal(sent[0].inputs.length,0);assert(!listeners.has('keydown'));
ui.destroy();sent.length=0;ui.update(snapshot('touch','touch'));assert.equal(root.children.length,4);const first=root.children[0];first.onpointerdown({pointerType:'mouse',preventDefault(){}});assert.equal(sent.length,0);assert.equal(root.children.length,4);
for(let i=0;i<4;i++)root.children[0].onpointerdown({pointerType:'touch',preventDefault(){}});assert.equal(sent.length,1);assert.equal(new Set(sent[0].inputs).size,4);
ui.destroy();sent.length=0;ui.update(snapshot('keyboard','timeout'));press('KeyQ');now=2001;timeout();assert.equal(sent[0].inputs.length,0);ui.destroy();assert(!root);assert(!listeners.has('keydown'));
console.log('PASS PC sequence/no mouse/repeat-key rejection, four touch targets/mouse rejection, incorrect key, 2s expiry and listener cleanup');
