const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),F=require('../school/combat-feedback.js'),G=require('../school/engine.js');
for(const mode of ['fire','red']){
 const event={seq:1,battleId:'a',kind:'hit',from:'kazua',to:'enemy',side:'enemy',amount:103,kazuaMode:mode,time:10},snapshot=JSON.stringify(event),all=new Map();
 for(let t=10;t<11.5;t+=.01)for(const n of F.numbers([event],t))all.set(n.time,n);
 assert.equal(all.size,mode==='red'?25:10);assert.equal([...all.values()].reduce((sum,n)=>sum+n.amount,0),103);assert([...all.values()].every(n=>Number.isInteger(n.amount)&&n.amount>0));assert.equal(JSON.stringify(event),snapshot);
 const coop=[{seq:1,kind:'hit',id:'kazua',team:1,shown:10000,amount:103},{seq:2,kind:'kazua-shot',id:'kazua',team:1,shown:10000,mode}];assert.equal(F.numbers(coop,10.5,{format:'coop'}).length,mode==='red'?25:10);
}
const simultaneous=[{seq:1,time:1,kind:'hit',from:'a',to:'b',amount:11},{seq:2,time:1,kind:'hit',from:'c',to:'b',amount:17},{seq:3,time:1,kind:'heal',from:'nari',to:'a',amount:22}];
const ns=F.numbers(simultaneous,1.1);assert.equal(ns.length,3);assert.equal(ns.find(n=>n.type==='heal').to,'a');assert.equal(ns.find(n=>n.amount===11).lane,F.numbers(simultaneous.slice(0,1),1.2)[0].lane);
assert.equal(F.numbers([{kind:'hit',from:'kazua',to:'b',amount:0,time:1,kazuaMode:'red'}],1.2).length,0);
const barrage=Array.from({length:240},(_,i)=>({seq:i,time:1,kind:'hit',from:'a',to:'b',amount:i+1})),bounded=F.numbers(barrage,1.1,{limit:64});assert(bounded.length<=64);assert.equal(bounded.reduce((sum,n)=>sum+n.amount,0),240*241/2);
assert.equal(F.numbers([{kind:'skill',from:'osia',toSide:1,target:'kazua',side:0,t:1000,amount:700}],1.1,{format:'arena'})[0].to,'1:kazua');
console.log('PASS exact Kazua burst totals/cadence, nonmerged casters, fixed recipient lanes, immune zeroes, bounded coalescing and arena recipients');
const window={SchoolRPG:G};vm.runInNewContext(fs.readFileSync('school/skill-cards.js','utf8'),{window});const status=window.SchoolSkillCards.status,u={id:'osia',hp:100,energy:G.BY_ID.osia.cooldown/2};
assert.equal(status(u).charge,50);assert.equal(status(u,{frozen:true,casting:true}).state,'frozen');assert.equal(status({...u,hp:0},{casting:true}).state,'fallen');assert.equal(status({...u,stunUntil:2000},{elapsed:1000}).state,'stunned');assert.equal(status(u,{casting:true}).charge,100);assert.equal(status({...u,id:'horas'},{stacks:3}).charge,60);
console.log('PASS charge fill, cast flash, freeze/stun/death precedence and Horas stacks without changing combat state');
