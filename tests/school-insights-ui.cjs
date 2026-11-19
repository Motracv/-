const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const G=require('../school/engine.js');
const nodes=new Map();let elements=[];
class Node{
 constructor(id='',attrs=''){this.id=id;this.dataset={};this.disabled=/\bdisabled\b/.test(attrs);this.attributes={};for(const m of attrs.matchAll(/data-([\w-]+)="([^"]*)"/g))this.dataset[m[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=m[2];}
 set innerHTML(v){this.html=v;for(const m of v.matchAll(/<(button|div|nav|section|aside)[^>]*>/g)){const attrs=m[0],id=attrs.match(/\bid="([^"]*)"/)?.[1],node=new Node(id,attrs);node.tag=m[1];elements.push(node);if(id)nodes.set(id,node);}}
 get innerHTML(){return this.html||'';}
 querySelectorAll(selector){return select(selector);}
 setAttribute(k,v){this.attributes[k]=v;}
 closest(selector){return select(selector).includes(this)?this:null;}
}
function select(selector){if(selector==='button')return elements.filter(e=>e.tag==='button');const key=selector.match(/^\[data-([\w-]+)\]$/)?.[1]?.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return key?elements.filter(e=>key in e.dataset):[];}
const document={getElementById:id=>nodes.get(id),querySelectorAll:select};const window={SchoolRPG:G,SchoolArt:{portrait:id=>'portrait-'+id}};vm.runInNewContext(fs.readFileSync('school/bond-stories.js','utf8'),{window,document});vm.runInNewContext(fs.readFileSync('school/insights.js','utf8'),{window,document});
let s=G.create(Date.now()),kind='',scope='guest',blocked=false,dispatches=[],toast='',formation=0,retry=null,resolveAction=null;
s.units.osia={level:70,xp:0,stars:2,shards:0};G.action(s,{kind:'team',team:['osia','sua','taeo']},s.at);
const ui=window.SchoolInsights.create({getState:()=>s,scope:()=>scope,now:()=>s.at,modalKind:()=>kind,blocked:()=>blocked,openModal(title,html,k){kind=k;nodes.clear();elements=[];new Node('root').innerHTML=html;},closeModal(){kind='';},toast:m=>toast=m,openFormation:()=>formation++,retry:r=>retry=r,dispatch:async input=>{dispatches.push(input);if(resolveAction)await new Promise(r=>resolveAction=r);G.action(s,input,s.at);}});
(async()=>{
 ui.report('current');assert.equal(kind,'damage');assert(nodes.get('insight-rows').innerHTML.includes('오시아'));let b=select('[data-metric]').find(b=>b.dataset.metric==='healing');nodes.get('insight-tabs').onclick({target:b});assert(nodes.get('insight-rows').innerHTML.includes('초과 치유 제외'));assert.equal(b.attributes['aria-pressed'],'true');nodes.get('insight-formation').onclick();assert.equal(formation,1);nodes.get('insight-retry').onclick();assert.equal(retry.battleId,s.battle.id);
 ui.bond();assert.equal(kind,'bond');assert(select('[data-episode]').find(b=>b.dataset.episode==='2').disabled);select('[data-episode]').find(b=>b.dataset.episode==='1').onclick();assert(nodes.get('bond-content').innerHTML.includes('낯선 교실의 파도'));assert(ui.back());assert.equal(ui.back(),false);
 select('[data-episode]').find(b=>b.dataset.episode==='1').onclick();for(let i=1;i<window.SchoolInsights.STORIES[0].length;i++)await nodes.get('bond-next').onclick();blocked=true;await nodes.get('bond-next').onclick();assert.equal(dispatches.length,0);assert(toast.includes('연결'));blocked=false;await nodes.get('bond-next').onclick();assert.equal(dispatches[0].kind,'bond-read');assert.deepEqual(s.bonds.osia.read,[1]);assert(nodes.get('bond-content').innerHTML.includes('다시 읽기'));
 s.bonds.osia.daily.waves=10;ui.refresh(true);const claim=select('[data-bond-mission]').filter(b=>b.dataset.bondMission==='waves').at(-1);await claim.onclick();assert.equal(dispatches.at(-1).kind,'bond-mission');assert.equal(s.bonds.osia.xp,8);assert(s.bonds.osia.daily.claimed.includes('waves'));
 for(const id of Object.keys(G.BOND_CHARACTERS)){
  s.units[id]={level:70,xp:0,stars:1,shards:0};s.bonds[id]={xp:650,read:[],daily:{day:G.day(s.at),waves:0,bosses:0,dragons:0,earned:0,claimed:[]}};
  ui.bond(id);assert.equal(select('[data-bond-hero]').length,Object.keys(G.BOND_CHARACTERS).length);assert(nodes.get('bond-content').innerHTML.includes(G.BOND_CHARACTERS[id].name));
  select('[data-episode]').find(b=>b.dataset.episode==='1').onclick();const story=id==='osia'?window.SchoolInsights.STORIES:window.SchoolBondStories[id];
  for(let n=1;n<story[0].length;n++)await nodes.get('bond-next').onclick();await nodes.get('bond-next').onclick();
  assert.equal(dispatches.at(-1).hero,id);assert.deepEqual(s.bonds[id].read,[1]);
 }
 scope='different-account';ui.refresh();assert.equal(kind,'');
 const html=fs.readFileSync('school.html','utf8'),sw=fs.readFileSync('school-sw.js','utf8'),client=fs.readFileSync('school/client.js','utf8');for(const name of ['insights.js','insights.css']){assert(html.includes('school/'+name));assert(sw.includes("'"+name+"'"));}assert(sw.includes('school/assets/bonds/osia-memory.webp'));assert(fs.existsSync('school/assets/bonds/osia-memory.webp'));assert(client.includes('osia-bond-entry'));assert(client.includes('result-analysis'));assert(client.includes('if(insights?.back())return'));
 console.log('PASS contribution tabs, report actions, locked episode, story back, blocked save, completion persistence, mission claim, account-scope cleanup and offline asset wiring');
})().catch(e=>{console.error(e);process.exitCode=1;});
