const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),G=require('../school/engine.js');
const source=fs.readFileSync('school/client.js','utf8');
const start=source.indexOf('  let lastUIRender'),end=source.indexOf('  function renderBattleHUD()',start);
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',open:false});return nodes.get(id);};
let now=0,battlePaints=0,controls=0,results=0;
const s=G.create(1000),before=JSON.stringify(s);
const context={state:s,document:{hidden:false},performance:{now:()=>now},$:node,G,fmt:String,serverNow:()=>s.at,mode:'cloud',modalKind:'',tab:'lobby',renderKey:'',dungeonRenderKey:'',
 questSnapshot:()=>({readyCount:0}),lobby:{render(){}},social:{refresh(){}},setText:(n,v)=>{(typeof n==='string'?node(n):n).textContent=String(v);},setAttr(){},setWidth(){},toggleClass(){},setHidden(){},panelContentKey:()=>context.tab,
 renderBattleHUD:()=>battlePaints++,renderButtons:()=>controls++,maybeShowActivityResult:()=>results++,renderChapters(){},renderRoster(){},renderRecruitment(){},renderSupplies(){},renderDungeons(){},dungeonContentKey:()=>''};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function battleVisible()'),source.indexOf('  function syncBattleOverlay()'))+source.slice(start,end)+';globalThis.paint=render;',context);
for(const tab of ['lobby','recruit','roster','dungeons','supplies']){context.tab=tab;context.paint();for(let i=0;i<4;i++){now+=250;context.paint(true);}}
assert.equal(battlePaints,0,'Hidden campaign HUD is not painted on any menu');
assert.equal(controls,15,'Menu heartbeat paints at 2Hz; explicit navigation is immediate');
assert.equal(node('gold').textContent,String(s.gold),'Currency still updates outside battle');
context.tab='adventure';context.paint();assert.equal(battlePaints,1);
now+=250;context.paint(true);assert.equal(battlePaints,2,'Visible battle HUD stays at 4Hz');
node('modal').open=true;
for(const kind of ['damage','settings','hero','map','captain']){context.modalKind=kind;const prev=battlePaints;now+=250;context.paint(true);assert.equal(battlePaints,prev+1,kind+' keeps the visible battle HUD live at 4Hz');}
for(const kind of ['raid','yeti','social-arena']){context.modalKind=kind;const prev=battlePaints;now+=500;context.paint(true);assert.equal(battlePaints,prev,kind+' owns its own battle scene');}
node('modal').open=false;const previousPaints=battlePaints;context.paint();assert.equal(battlePaints,previousPaints+1,'Closing a dialog renders immediately');
context.document.hidden=true;now+=500;const previous=controls;context.paint();assert.equal(controls,previous,'Hidden tabs do not mutate UI');
context.document.hidden=false;context.paint();assert.equal(battlePaints,previousPaints+2);
// Exercise the real animation skip condition, not a second copy of the policy.
const skip=source.match(/if \((document.hidden \|\| !battleVisible\(\)[^\n]+?)\) \{ nextDrawAt/)[1];
context.resultPresentationBusy=()=>false;node('rotate-prompt').hidden=true;
for(const kind of ['damage','settings','hero','map']){context.modalKind=kind;node('modal').open=true;assert.equal(vm.runInContext(skip,context),false,kind+' must not stop Canvas animation');}
context.modalKind='yeti';assert.equal(vm.runInContext(skip,context),true);node('modal').open=false;context.document.hidden=true;assert.equal(vm.runInContext(skip,context),true);context.document.hidden=false;
assert.equal(JSON.stringify(s),before,'Render gating never changes battle/rewards/save state');assert(results>0);
// Opening, replacing, closing and navigating away all release reserved space.
node('modal').classList={toggle(key,value){this[key]=value;}};context.setAttr=(n,k,v)=>n[k]=v;
vm.runInContext(source.match(/function syncBattleOverlay\(\) \{[\s\S]*?\n  }/)[0],context);
for(const [tab,kind,open,expected] of [['adventure','damage',true,true],['adventure','settings',true,true],['adventure','map',true,false],['adventure','damage',false,false],['lobby','damage',true,false],['adventure','yeti',true,false]]){
 context.tab=tab;context.modalKind=kind;node('modal').open=open;context.syncBattleOverlay();assert.equal(node('modal').classList['battle-side'],expected);assert.equal(node('app')['data-battle-drawer'],String(expected));
}
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
