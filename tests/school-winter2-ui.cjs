// No browser dependency: exercise the real UI controller with a small DOM port.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const slots=[{label:'보석10000',chance:.001,type:'gems',amount:10000},{label:'보석1000',chance:.01,type:'gems',amount:1000},{label:'보석100',chance:.089,type:'gems',amount:100},{label:'일반장비',chance:.35,type:'equipment'},{label:'코인',chance:.55,type:'gold'}];
let open=false,html='',elements={},rows={},animations=[],calls=0,confirm;
class Element{
 constructor(id='',dataset={}){this.id=id;this.dataset=dataset;this.style={};this.listeners={};this.classList={add(){},remove(){}};this.textContent='';this.hidden=false;this.disabled=false;}
 setAttribute(k,v){this[k]=v;}
 addEventListener(kind,cb){this.listeners[kind]=cb;}
 closest(){return {open};}
 querySelector(s){if(s==='.winter-shop')return {};if(s.startsWith('[data-winter-row='))return rows[s.split('"')[1]];return this.children?.[s]||null;}
 querySelectorAll(s){if(s==='[data-winter-item]')return Object.values(rows).map(r=>r.children['[data-winter-item]']);if(s==='[data-winter-tab]')return elements.tabs;if(s==='[data-winter-panel]')return elements.panels;return [];}
 animate(frames,options){let done;const a={frames,options,finished:new Promise(r=>done=r),cancel(){done();},finish(){done();}};animations.push(a);return a;}
}
const state={units:{},heroShards:{},winter:{snowmen:2,spins:0}};
const info=()=>({name:'겨울축제',day:3,active:true,snowflakes:6000,snowmen:state.winter.snowmen,spins:state.winter.spins,spicaOwned:false,resetsAt:Date.now()+1000,items:[{id:'gold',cost:30,limit:10,gold:1000,bought:0,totalBought:0,remaining:10,canBuy:true},{id:'spica',cost:5000,limit:1,hero:'spica',unlock:true,lifetime:true,bought:0,totalBought:0,remaining:1,canBuy:true}]});
const document={documentElement:{dataset:{motion:'full'}},getElementById:id=>elements[id],querySelector:s=>s.startsWith('#school-social')&&open?elements['school-social']:null};
const window={SchoolRPG:{WINTER_ROULETTE:slots,WINTER_EVENT:{},GEAR_BY_ID:{chalk_star:{name:'별빛 분필',rarity:'R'}},BY_ID:{spica:{name:'스피카'}},winterInfo:info},SchoolArt:{portrait:id=>'portrait-'+id},SchoolPresentation:{play(){}},matchMedia:()=>({matches:false})};
vm.runInNewContext(fs.readFileSync('school/social.js','utf8'),{window,document,console,setTimeout,clearTimeout,crypto,Date});
let ui;const toasts=[];
ui=window.SchoolSocial.create({getState:()=>state,serverNow:Date.now,isBlocked:()=>false,isCloud:()=>true,toast:s=>toasts.push(s),openModal(title,content){open=true;html=content;elements={};for(const m of content.matchAll(/id="([^"]+)"/g))elements[m[1]]=new Element(m[1]);elements['school-social'].dataset.view='winter';elements.tabs=['festival','roulette'].map(t=>new Element('',{winterTab:t}));elements.panels=['festival','roulette'].map(t=>new Element('',{winterPanel:t}));rows={};for(const item of info().items){const row=new Element();row.children={'[data-winter-item]':new Element('',{winterItem:item.id}),'[data-winter-remaining]':new Element(),'[data-winter-price]':new Element()};rows[item.id]=row;}},dispatch:async action=>{calls++;assert.deepEqual(JSON.parse(JSON.stringify(action)),{kind:'winter-spin'});await new Promise(r=>confirm=r);state.winter.snowmen--;state.winter.spins++;await ui.playWinterSpin({index:1,reward:{type:'gems',amount:1000}});}});
(async()=>{
 ui.openWinter();assert.equal((html.match(/class="winter-wheel-label"/g)||[]).length,5);assert.match(html,/5,000/);assert.match(html,/Lv.70/);assert(!elements['winter-spin'].disabled);
 const first=elements['winter-spin'].listeners.click();await elements['winter-spin'].listeners.click();assert.equal(calls,1);assert.equal(animations.length,0);assert.equal(state.winter.snowmen,2);
 confirm();await Promise.resolve();await Promise.resolve();assert.equal(animations.length,1);assert.equal(state.winter.snowmen,1);animations[0].finish();await first;
 assert.equal(elements['winter-spin-result'].textContent,'보석 +1,000');assert.equal((Number(animations[0].frames[1].transform.match(/[\d.]+/)[0])+72)%360,0);
 console.log('PASS one intention per double click; wheel waits for confirmed result and lands on actual prize');
 for(let index=0;index<5;index++){document.documentElement.dataset.motion='reduced';const task=ui.playWinterSpin({index,reward:{type:'gold',amount:2600}}),animation=animations.at(-1);assert.equal(animation.options.duration,120);assert.equal((Number(animation.frames[1].transform.match(/[\d.]+/)[0])+index*72)%360,0);animation.finish();await task;}
 const balance=JSON.stringify(state);const task=ui.playWinterSpin({index:3,reward:{type:'equipment',item:'chalk_star',rarity:'R'}});open=false;ui.cancelPresentation();await task;assert.equal(JSON.stringify(state),balance);assert.equal(calls,1);ui.destroy();await ui.playWinterSpin({index:0,reward:{type:'gems',amount:10000}});assert.equal(toasts.at(-1),'보석 +10,000');
 console.log('PASS all five prize positions, reduced motion, closing/cancelling never changes rewards or sends another spin');
})().catch(e=>{console.error(e);process.exitCode=1;});
