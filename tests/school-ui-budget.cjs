const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),G=require('../school/engine.js');
const source=fs.readFileSync('school/client.js','utf8');
const start=source.indexOf('  let lastUIRender'),end=source.indexOf('  function renderBattleHUD()',start);
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',open:false});return nodes.get(id);};
let now=0,battlePaints=0,controls=0,results=0;
const s=G.create(1000),before=JSON.stringify(s);
const context={state:s,document:{hidden:false},performance:{now:()=>now},$:node,G,fmt:String,serverNow:()=>s.at,mode:'cloud',modalKind:'',tab:'lobby',renderKey:'',dungeonRenderKey:'',
 questSnapshot:()=>({readyCount:0}),lobby:{render(){}},social:{refresh(){}},setText:(n,v)=>{(typeof n==='string'?node(n):n).textContent=String(v);},setAttr(){},setWidth(){},toggleClass(){},setHidden(){},panelContentKey:()=>context.tab,
 renderBattleHUD:()=>battlePaints++,renderButtons:()=>controls++,maybeShowActivityResult:()=>results++,renderChapters(){},renderRoster(){},renderRecruitment(){},renderSupplies(){},renderDungeons(){},dungeonContentKey:()=>''};
vm.createContext(context);vm.runInContext(source.slice(start,end)+';globalThis.paint=render;',context);
for(const tab of ['lobby','recruit','roster','dungeons','supplies']){context.tab=tab;context.paint();for(let i=0;i<4;i++){now+=250;context.paint(true);}}
assert.equal(battlePaints,0,'Hidden campaign HUD is not painted on any menu');
assert.equal(controls,15,'Menu heartbeat paints at 2Hz; explicit navigation is immediate');
assert.equal(node('gold').textContent,String(s.gold),'Currency still updates outside battle');
context.tab='adventure';context.paint();assert.equal(battlePaints,1);
now+=250;context.paint(true);assert.equal(battlePaints,2,'Visible battle HUD stays at 4Hz');
node('modal').open=true;now+=500;context.paint(true);assert.equal(battlePaints,2,'Coop and detail dialogs do not update obscured campaign HUD');
node('modal').open=false;context.paint();assert.equal(battlePaints,3,'Closing a dialog allows immediate rendering');
context.document.hidden=true;now+=500;const previous=controls;context.paint();assert.equal(controls,previous,'Hidden tabs do not mutate UI');
context.document.hidden=false;context.paint();assert.equal(battlePaints,4);
assert.equal(JSON.stringify(s),before,'Render gating never changes battle/rewards/save state');assert(results>0);
// Exercise the exact guest heartbeat condition: no repeat serialization when
// the engine has not reached its next 500ms turn, but failed writes still retry.
const condition=source.match(/if \((mode === 'guest'[^\n]+)\) \{/)[1];
const guest={mode:'guest',Date:{now:()=>1250},lastGuestTick:1000,state:{at:1000},busy:false,guestTickPending:false,guestSaveFailed:false,lastSave:0};
vm.createContext(guest);assert.equal(vm.runInContext(condition,guest),false);guest.Date.now=()=>1500;assert.equal(vm.runInContext(condition,guest),true);
guest.Date.now=()=>3500;guest.state.at=3500;guest.guestSaveFailed=true;assert.equal(vm.runInContext(condition,guest),true,'Failed saves can recover even without a due turn');
console.log('PASS all menu/visible-battle/modal/tab render budgets, immediate user actions, unchanged state and no-op guest save suppression');

async function install(stale=false){
 let task,deleted=false,required=[];const events={};
 const cache={async addAll(requests){required=requests.map(r=>r.url);},async match(url){return {text:async()=>url.endsWith('school.html')?fs.readFileSync('school.html','utf8'):stale?'const CATALOG_VERSION = '+(G.CATALOG_VERSION-1)+';':fs.readFileSync('school/engine.js','utf8')};}};
 const self={location:{href:'https://example.test/-/school-sw.js'},addEventListener:(k,f)=>events[k]=f};
 vm.runInNewContext(fs.readFileSync('school-sw.js','utf8'),{self,URL,Request,caches:{open:async()=>cache,delete:async()=>{deleted=true;}},Set});
 events.install({waitUntil:p=>task=p});
 if(stale){await assert.rejects(task,/release is not ready/);assert(deleted);return;}
 await task;assert(!deleted);
 for(const kind of ['illustration','profile'])assert(required.some(u=>u.includes('bonds/hyeokjin-'+kind+'.webp')));
 for(const url of required){const path=decodeURIComponent(new URL(url).pathname.slice(3));assert(fs.existsSync(path),'Required offline asset exists: '+path);}
}
(async()=>{await install();await install(true);console.log('PASS actual service-worker install with current catalog/new bond assets and atomic stale-catalog rejection');})().catch(e=>{console.error(e);process.exitCode=1;});
