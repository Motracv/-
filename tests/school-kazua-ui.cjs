// Actual recruitment controller functions, a small DOM port (no browser layout claims).
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),G=require('../school/engine.js');
const nodes=new Map(),groups=new Map();
class Node {
 constructor(){this.tagName='BUTTON';this.hidden=false;this.attrs={};this.dataset={};this.children=new Map();this.style={};this.classList={add(){}};this.textContent='';}
 setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}
 querySelector(k){if(!this.children.has(k))this.children.set(k,new Node());return this.children.get(k);}
 set innerHTML(value){this.html=value;for(const tag of value.matchAll(/<(?:button|div|img|span|strong|b|i|p)[^>]*>/g)){const n=new Node(),id=tag[0].match(/\bid="([^"]+)"/);if(id)nodes.set(id[1],n);for(const attr of tag[0].matchAll(/data-([\w-]+)="([^"]+)"/g)){const key=attr[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());n.dataset[key]=attr[2];if(!groups.has(attr[1]))groups.set(attr[1],[]);groups.get(attr[1]).push(n);}}}
}
nodes.set('tab-recruit',new Node());const document={querySelectorAll:s=>groups.get(s.match(/data-([^\]]+)/)?.[1])||[]};let modal='';
const source=fs.readFileSync('school/client.js','utf8'),context={G,document,window:{SchoolQoL:{countdown:()=>({text:'기간 안내'})}},$:(id)=>nodes.get(id),icon:()=>'',fmt:String,selectedBanner:'kazua',recruitCategory:'heroes',standardGuarantee:'osia',state:G.create(Date.now()),serverNow:Date.now,setAttr:(n,k,v)=>n.setAttribute(k,v),setText:(n,v)=>{(typeof n==='string'?nodes.get(n):n).textContent=String(v);},setWidth:(n,v)=>n.style.width=v,setHidden:(n,v)=>n.hidden=v,openModal:(_,html)=>modal=html};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function setupRecruitment()'),source.indexOf('  function dungeonCon',source.indexOf('  function setupRecruitment()'))),context);
vm.runInContext(source.slice(source.indexOf('  function ratesModal()'),source.indexOf('\n  function ',source.indexOf('  function ratesModal()')+10)),context);
vm.runInContext('setupRecruitment();renderRecruitment();ratesModal()',context);assert.equal(nodes.get('pickup-name').textContent,'카즈아');assert(modal.includes('카즈아'));assert.equal(nodes.get('recruit-price-ten').textContent,'1000');
const visible=()=>groups.get('banner').filter(n=>!n.hidden).map(n=>n.dataset.banner);assert.deepEqual(visible(),['kazua','standard','ryusion','horas']);
for(const banner of Object.keys(G.BANNERS)){context.selectedBanner=banner;vm.runInContext('renderRecruitment();ratesModal()',context);assert(!modal.includes('undefined'));assert.equal(groups.get('preview').filter(n=>!n.hidden).length,1);}
context.selectedBanner='standard';context.state.banners.standard={pity:79,reserve:79,guarantees:2,guaranteed:true};context.standardGuarantee='lava';vm.runInContext('renderRecruitment();ratesModal()',context);assert(!nodes.get('standard-guarantee').hidden);assert(nodes.get('banner-status').textContent.includes('라바'));assert(modal.includes('확정')&&modal.includes('79'));
context.recruitCategory='weapons';vm.runInContext('renderRecruitment()',context);assert.equal(context.selectedBanner,'osia');assert.deepEqual(visible(),['ryusion','horas','osia','lava']);assert(nodes.get('standard-guarantee').hidden);
context.recruitCategory='heroes';vm.runInContext('renderRecruitment()',context);assert.equal(context.selectedBanner,'standard');assert.deepEqual(visible(),['kazua','standard','ryusion','horas']);
const html=fs.readFileSync('school.html','utf8'),sw=fs.readFileSync('school-sw.js','utf8');assert(html.indexOf('school/kazua-art.js')<html.indexOf('school/art.js'));assert(html.includes('school/kazua.css?v=school-osia-look1'));assert(sw.includes("'kazua-art.js','kazua.css'"));assert(sw.includes("['combat.webp','portrait.webp','pickup.webp']"));for(const file of ['combat','portrait','pickup'])assert(fs.existsSync(`school/assets/kazua/${file}.webp`));
assert(fs.readFileSync('school/farming-worker.js','utf8').includes("engine.js?v=school-osia-look1"));assert(fs.readFileSync('school/qol.js','utf8').includes("farming-worker.js?v=school-osia-look1"));
console.log('PASS actual recruitment rendering/rate panels, standard guarantee selection, separate weapon tabs, merged previews and atomic release assets');
