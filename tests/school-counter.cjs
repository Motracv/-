const assert=require('node:assert/strict'),G=require('../school/engine.js'),F=require('../school/combat-feedback.js');
const NOW=Date.parse('2026-11-18T08:00:00Z');let passed=0;
const test=(name,run)=>{run();console.log('PASS',name);passed++;};
function durable(seed=123){const s=G.create(NOW,seed);for(const h of s.battle.heroes){h.max=h.hp=100000;h.atk=10;}for(const e of s.battle.enemies){e.max=e.hp=100000;e.atk=10;}return s;}
function opportunity(s=durable()){for(let i=0;i<240;i++){G.advance(s,s.at+500);if(G.counterInfo(s).active)return s;}throw Error('No opportunity in 120 seconds');}
const intent=s=>({kind:'counter',battleId:s.battle.id,opportunityId:s.counter.opportunity.id});
function rejected(s,q,now=s.at){const before=G.clone(s);assert.throws(()=>G.action(s,q,now));assert.deepEqual(s,before);}
test('Old saves migrate without changing balances; counter chances are deterministic under chunked advance',()=>{
 const a=durable(),b=G.clone(a);assert(G.validate(a));G.advance(a,NOW+10000);for(let i=0;i<20;i++)G.advance(b,b.at+500);assert.deepEqual(a,b);assert(G.validate(a));assert.equal(a.gems,1800);assert.equal(a.gold,700);
});
test('Real enemy attacks offer a timed single-use counter; forged damage and target are ignored',()=>{
 const s=opportunity(),q=intent(s),o=s.counter.opportunity,e=s.battle.enemies.find(e=>e.id===o.enemyId),before=e.hp,seed=s.seed,finance=[s.gold,s.gems],r=G.action(s,{...q,amount:1e99,target:'e99',hero:'horas',expiresAt:1e99},s.at);
 assert.equal(r.amount,18);assert.equal(before-e.hp,18);assert.equal(s.seed,seed);assert.deepEqual([s.gold,s.gems],finance);assert.equal(G.damageReport(s).rows.find(row=>row.id===r.hero).damage>=18,true);assert.equal(G.counterInfo(s).active,false);rejected(s,q);assert(G.validate(s));
});
test('Expiry, wrong IDs, dead target, defeat and cinematic cannot counter',()=>{
 const original=opportunity();rejected(G.clone(original),{...intent(original),opportunityId:'forged'});rejected(G.clone(original),{...intent(original),battleId:original.battle.id+1});rejected(G.clone(original),intent(original),original.counter.opportunity.expiresAt);
 for(const mutate of [s=>{s.battle.enemies.find(e=>e.id===s.counter.opportunity.enemyId).hp=0;},s=>{s.battle.heroes.forEach(h=>h.hp=0);},s=>{s.battle.phase='defeat';},s=>{s.battle.cinematic={remaining:500};}]){const s=G.clone(original);mutate(s);assert(!G.counterInfo(s).active);rejected(s,intent(original));}
});
test('Cooldown lasts through waves and uses real time at 1.5x; offline cancels old prompts',()=>{
 const s=opportunity(),until=s.counter.cooldownUntil;G.action(s,intent(s),s.at);G.action(s,{kind:'speed',speed:1.5},s.at);while(s.at+500<until){G.advance(s,s.at+500);assert(!G.counterInfo(s).active);}assert.equal(s.counter.cooldownUntil,until);
 const t=opportunity();G.action(t,{kind:'stage',stage:1,mode:'farm'},t.at);assert(!t.counter.opportunity);assert.equal(t.counter.cooldownUntil>t.at,true);
 const u=opportunity();G.advance(u,u.at+100000);assert(!u.counter.opportunity);assert(G.validate(u));
});
test('Counter killing blow settles campaign or dungeon once and never resurrects allies',()=>{
 for(const dungeon of [false,true]){const s=durable();if(dungeon){G.action(s,{kind:'activity',mode:'daily',tier:1},s.at);for(const h of s.battle.heroes){h.max=h.hp=100000;h.atk=10;}for(const e of s.battle.enemies){e.max=e.hp=100000;e.atk=10;}}
 opportunity(s);const q=intent(s),target=s.counter.opportunity.enemyId;for(const e of s.battle.enemies)e.hp=e.id===target?1:0;s.battle.heroes[2].hp=0;const r=G.action(s,q,s.at);assert.equal(r.amount,1);assert.equal(s.battle.heroes[2].hp,0);assert.equal(s.battle.phase,'victory');if(dungeon)assert(s.activities.lastResult.won);rejected(s,q);assert(G.validate(s));}
});
test('Damage and healing events carry the actual capped HP change, including shield absorption',()=>{
 const s=durable();s.battle.heroes[0].shield=100000;s.battle.heroes[1].hp=s.battle.heroes[1].max-3;s.battle.heroes[2].energy=3;G.advance(s,s.at+1000);
 const healing=s.events.find(e=>e.kind==='heal'&&e.to==='harin');assert(healing);assert.equal(healing.amount,3);assert.equal(healing.hpAfter-healing.hpBefore,healing.amount);
 for(const e of s.events.filter(e=>e.kind==='hit')){assert.equal(e.hpBefore-e.hpAfter,e.amount);assert(e.amount>=0);}
 assert(s.events.some(e=>e.kind==='shield'));assert(!F.numbers([{kind:'hit',to:'a',amount:0,time:1}],1.1).length);
});
test('Simultaneous hits aggregate exact totals while heal/shield use separate number lanes',()=>{
 const effects=[{kind:'hit',amount:8},{kind:'hit',amount:21,critical:true},{kind:'heal',amount:5},{kind:'shield',amount:10}].map(e=>({...e,time:1,to:'a',battleId:9}));const before=JSON.stringify(effects),n=F.numbers(effects,1.2);assert.deepEqual(n.map(g=>g.text),['29','+5','방어 10']);assert.deepEqual(n.map(g=>g.lane),[0,1,2]);assert(n[0].critical);assert.equal(JSON.stringify(effects),before);assert.equal(F.numbers(effects,3).length,0);
});
test('HP bars interpolate monotonically, preserve a damage trail, and reset on death/new battle/time rewind',()=>{
 const h=F.createHealthTracker();h.begin(1,0);assert.equal(h.sample('a',40,100,0).ratio,.4);h.begin(1,.1);h.sample('a',80,100,.1);const middle=h.sample('a',80,100,.3);assert(middle.ratio>.4&&middle.ratio<.8);assert.equal(h.sample('a',80,100,1).ratio,.8);
 h.sample('a',20,100,1.1);const damage=h.sample('a',20,100,1.2);assert(damage.trail>damage.ratio);assert.equal(h.sample('a',0,100,1.3).ratio,0);h.begin(2,2);assert.equal(h.sample('a',100,100,2).ratio,1);h.begin(2,1);assert.equal(h.sample('a',20,100,1).ratio,.2);
});
console.log(`${passed} counter/feedback engine groups passed`);
