const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),G=require('../school/engine.js');
const nodes=new Map();let all=[];
class Node{constructor(id='',attrs=''){this.id=id;this.dataset={};this.disabled=/\sdisabled(?:\s|>)/.test(attrs);this.attributes={};this.hidden=false;for(const m of attrs.matchAll(/data-([\w-]+)="([^"]*)"/g))this.dataset[m[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=m[2];}
 set innerHTML(html){this.html=html;for(const m of html.matchAll(/<(button|div|article|small|span|b|progress)[^>]*>/g)){const a=m[0],id=a.match(/\bid="([^"]*)"/)?.[1],n=new Node(id,a);all.push(n);if(id)nodes.set(id,n);}}
 get innerHTML(){return this.html||'';}setAttribute(k,v){this.attributes[k]=v;}querySelectorAll(s){return select(s);}closest(s){return s.split(',').some(k=>select(k).includes(this))?this:null;}}
const select=s=>{const key=s.match(/^\[data-([\w-]+)\]$/)?.[1]?.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return key?all.filter(n=>key in n.dataset):[];};
const panel=new Node('panel'),document={getElementById:id=>nodes.get(id),querySelector:()=>panel},window={SchoolRPG:G};vm.runInNewContext(fs.readFileSync('school/battle-pass.js','utf8'),{window,document});
let state=G.create(Date.now(),723),scope='A',kind='',blocked=false,requests=0;
const ui=window.SchoolBattlePass.create({getState:()=>state,scope:()=>scope,now:()=>state.at,modalKind:()=>kind,blocked:()=>blocked,openModal(title,html,k){kind=k;all=[];nodes.clear();panel.innerHTML=html;},closeModal:()=>kind='',dispatch:async input=>{requests++;return G.action(state,input,state.at);}});
(async()=>{ui.open();assert.equal(kind,'battle-pass');assert.equal(select('[data-pass-level]').length,50);assert.equal(select('[data-pass-quest]').length,13);assert(nodes.get('pass-rewards').innerHTML.includes('수호자의 예복')||nodes.get('pass-rewards').innerHTML.includes('여명석 브로치'));assert(nodes.get('pass-level').textContent.includes('Lv.1'));const gems=state.gems;
 const click=b=>panel.onclick({target:b});let level=select('[data-pass-level]').find(n=>n.dataset.passLevel==='1');click(level);await new Promise(r=>setImmediate(r));assert.equal(requests,1);assert.deepEqual(state.battlePass.rewards,[1]);assert.equal(state.gems,gems);
 const login=select('[data-pass-quest]').filter(n=>n.dataset.passQuest==='login').at(-1);click(login);await new Promise(r=>setImmediate(r));assert.equal(state.battlePass.xp,40);
 blocked=true;ui.refresh();click(select('[data-pass-quest]').at(-1));assert.equal(requests,2);blocked=false;
 const tabs=select('[data-pass-tab]');click(tabs.find(n=>n.dataset.passTab==='quests'));assert.equal(nodes.get('pass-quests').hidden,false);assert.equal(nodes.get('pass-rewards').hidden,true);
 scope='B';ui.refresh();assert.equal(kind,'');console.log('PASS actual pass UI: 50 rewards/13 quests, claim handlers, no gems, blocked input, tab changes and account cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});
