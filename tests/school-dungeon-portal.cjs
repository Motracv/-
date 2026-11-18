const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Execute the actual UI controller with a minimal DOM/animation port. No game state.
let focused=null,created=0;
class Element{
 constructor(id){this.id=id;this.dataset={};this.style={};this.hidden=false;this.attributes={};this.children=[];this.motions=[];}
 querySelector(key){return nodes.get(key)||null;}
 setAttribute(k,v){this.attributes[k]=v;}
 focus(){focused=this;}
 append(el){el.parent=this;this.children.push(el);created++;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.removed=true;}
 getBoundingClientRect(){return this.id==='root'?{left:0,top:0,width:844,height:390}:{left:30,top:80,width:200,height:170};}
 animate(frames,options){let resolve,reject;const finished=new Promise((a,b)=>{resolve=a;reject=b;});const animation={frames,options,finished,complete:resolve,cancel(){this.cancelled=true;reject(Error('cancelled'));}};this.motions.push(animation);return animation;}
}
const nodes=new Map();for(const id of ['dungeon-hub','dungeon-detail','dungeon-back','dungeon-back-label','dungeon-page-title','dungeon-atmosphere','dungeon-detail-art'])nodes.set('#'+id,new Element(id));
const root=new Element('root'),image=new Element('cover');for(const kind of ['daily','tower','weekly']){const button=new Element(kind);button.querySelector=()=>image;nodes.set(`[data-dungeon="${kind}"]`,button);}
const window={},document={createElement:()=>new Element('flight')};vm.runInNewContext(fs.readFileSync('school/dungeon-portal.js','utf8'),{window,document});
(async()=>{
 let reduced=false;const ui=window.SchoolDungeonPortal.create(root,{reduced:()=>reduced});
 ui.open();assert.equal(ui.screen,'hub');assert.equal(nodes.get('#dungeon-detail').hidden,true);assert.equal(focused.id,'dungeon-back');assert.equal(ui.back(),false);
 assert.equal(ui.select('tower',nodes.get('[data-dungeon="tower"]')),true);assert.equal(ui.screen,'detail');assert.equal(nodes.get('#dungeon-hub').hidden,true);assert.equal(nodes.get('#dungeon-page-title').textContent,'뫼비우스의 복도');assert.equal(root.children.length,1);
 const firstFlight=root.children[0];ui.select('weekly',nodes.get('[data-dungeon="weekly"]'));assert(firstFlight.removed);assert.equal(root.children.length,1);assert.equal(nodes.get('#dungeon-page-title').textContent,'봉인된 이사장실');
 assert(ui.back());assert.equal(root.children.length,0);assert.equal(ui.screen,'hub');assert.equal(focused.id,'weekly');assert.equal(ui.back(),false);
 ui.select('daily',nodes.get('[data-dungeon="daily"]'));ui.close();await Promise.resolve();assert.equal(root.children.length,0);assert.equal(ui.select('tower'),false);
 ui.open();ui.select('tower',nodes.get('[data-dungeon="tower"]'));const completed=root.children[0];completed.motions[0].complete();await Promise.resolve();assert(completed.removed);assert.equal(root.children.length,0);assert.equal(ui.screen,'detail');
 ui.close();reduced=true;const count=created;ui.open();ui.select('daily',nodes.get('[data-dungeon="daily"]'));assert.equal(created,count);assert.equal(ui.screen,'detail');assert.equal(ui.select('__proto__'),false);assert.equal(ui.screen,'detail');ui.back();ui.close();
 root.animate=undefined;reduced=false;ui.open();ui.select('tower',nodes.get('[data-dungeon="tower"]'));assert.equal(root.children.length,0);assert.equal(ui.screen,'detail');ui.close();
 console.log('PASS card navigation, two-level back, focus restore, rapid selection/cancellation, animation cleanup, reduced motion, unsupported animation fallback and invalid destinations');
})().catch(e=>{console.error(e);process.exitCode=1;});
