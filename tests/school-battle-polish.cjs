const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const G=require('../school/engine.js'),heroes=[];
const window={SchoolRPG:G,SchoolArt:{hero(...args){heroes.push(args.slice(1));}}};
vm.runInNewContext(fs.readFileSync('school/battle-polish.js','utf8'),{window});
const P=window.SchoolBattlePolish;
for(const events of [[],[{kind:'attack',from:'osia',time:1}],[{kind:'kazua-mode',from:'kazua',mode:'reload',time:1}],[{kind:'skill-stage',from:'osia',stage:1,time:1}],[{kind:'skill',from:'monster',time:1}]])assert.equal(P.latest(events,1250),null);
for(const event of [{kind:'horas-cast',from:'horas',time:1},{kind:'kazua-mode',from:'kazua',mode:'red',shown:1000},{kind:'skill',from:'osia',stage:4,t:1000},{kind:'spica-wind',id:'spica',shown:1000},{kind:'shield',from:'geonu',skill:'철벽 수호',t:1000}]){
 assert.equal(P.latest([event],1250).id,event.from||event.id);
 assert.equal(P.latest([event],999),null);assert.equal(P.latest([event],1720),null);
}
const events=[{kind:'horas-cast',from:'horas',time:1},{kind:'kazua-mode',from:'kazua',mode:'red',time:1.1}];
assert.equal(P.latest(events,1250).id,'kazua');
const records=[],stack=[];
const c=new Proxy({globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){assert(stack.length);this.globalAlpha=stack.pop();},measureText(t){return{width:t.length*6};}}, {get(t,k){return k in t?t[k]:(...args)=>{args.forEach(a=>{if(typeof a==='number')assert(Number.isFinite(a));});records.push([k,...args]);};}});
const before=JSON.stringify(events);
assert(P.focus(c,events,1250,480,280));assert.equal(heroes.length,1);assert.equal(heroes[0][0],'kazua');assert.equal(stack.length,0);assert.equal(c.globalAlpha,1);assert.equal(JSON.stringify(events),before);
records.length=0;assert(P.focus(c,events,1250,480,280,true));assert.equal(heroes.length,1,'Reduced motion keeps the name without enlarging the sprite');assert(records.some(r=>r[0]==='fillText'&&r[1].includes('카즈아')));
assert(!P.focus(c,events,1820,480,280));assert.equal(stack.length,0);
const allies=[{hp:100,hasteUntil:16000},{hp:0,hasteUntil:90000}],enemies=[{hp:100,boss:true,slowUntil:15000}];
records.length=0;const states=JSON.stringify([allies,enemies]);assert(P.speedField(c,allies,enemies,11000,960,8));
const label=records.find(r=>r[0]==='fillText')[1];assert(label.includes('+15% · 5초'));assert(label.includes('−7.5% · 4초'));assert.equal(JSON.stringify([allies,enemies]),states);
enemies[0].boss=false;records.length=0;P.speedField(c,allies,enemies,11000,480);assert(records.find(r=>r[0]==='fillText')[1].includes('−15%'));
assert(!P.speedField(c,allies,enemies,16000,960));assert.equal(stack.length,0);
console.log('PASS skill-only closeups in three event formats, expiry/latest-cast, reduced motion, real buff values/expiry, dead-unit exclusion and read-only balanced rendering');
