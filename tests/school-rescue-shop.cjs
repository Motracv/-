const assert=require('node:assert/strict'),G=require('../school/engine.js');require('../school/raid-engine.js');const Y=require('../school/yeti-engine.js');
const now=Date.parse('2026-11-18T03:00Z');
function party(){const s=G.create(now,1);s.team=['ryusion','osia','lava','spica','horas','nari'];for(const id of s.team)s.units[id]={level:100,stars:5,xp:0,shards:0};return s;}
function battle(){const b=Y.create(G,[{account:'a',save:party()},{account:'b',save:party()}],now,2);b.teams[1].frozen={id:'ice-test',at:0};return b;}
const keys=['KeyQ','KeyW','KeyQ','KeyF'];
let b=battle();Y.startRescue(b,'a','ice-test','keyboard',keys,now);let q=b.teams[0].rescue;assert.throws(()=>Y.startRescue(b,'b','ice-test','keyboard',keys,now));Y.finishRescue(G,b,'a',q.id,keys,now+1500);assert.equal(b.teams[1].frozen,null);assert.equal(b.teams[0].thaws,1);Y.finishRescue(G,b,'a',q.id,keys,now+1600);assert.equal(b.teams[0].thaws,1);
b=battle();Y.startRescue(b,'a','ice-test','touch',keys,now);q=b.teams[0].rescue;Y.finishRescue(G,b,'a',q.id,[3,1,0,2],now+1800);assert.equal(b.teams[1].frozen,null);
b=battle();Y.startRescue(b,'a','ice-test','touch',keys,now);q=b.teams[0].rescue;Y.finishRescue(G,b,'a',q.id,[1,1,2,3],now);assert.equal(q.outcome,'failed');assert(b.teams[0].units.every(u=>u.stunUntil===15000));assert(b.teams[1].units.every(u=>u.stunUntil===0));assert(b.teams[1].frozen);assert.throws(()=>Y.startRescue(b,'a','ice-test','keyboard',keys,now));
const fine=battle(),coarse=G.clone(fine);Y.startRescue(fine,'a','ice-test','keyboard',keys,now);Y.startRescue(coarse,'a','ice-test','keyboard',keys,now);for(let t=250;t<=10000;t+=250)Y.advance(G,fine,now+t);Y.advance(G,coarse,now+10000);assert.deepEqual(fine,coarse);assert.equal(fine.teams[0].rescue.outcome,'failed');assert.equal(fine.teams[0].rescueLockUntil,22750);assert(fine.boss.hp<Y.HP);
b=battle();Y.startRescue(b,'a','ice-test','keyboard',keys,now);q=b.teams[0].rescue;Y.finishRescue(G,b,'a',q.id,keys,now+6900);assert.equal(b.teams[1].frozen,null);
console.log('PASS keyboard order, touch uniqueness, single thaw, wrong-input own-team 15s lock, expiry and reconnect determinism');
const s=G.create(now,1);s.gems=10000;s.best=60;const before=G.clone(s),info=G.shopInfo(s,now);assert.deepEqual(s,before);assert.equal(info.find(x=>x.id==='coins').gold,65000);
G.action(s,{kind:'shop-buy',item:'daily-coins',price:0,gold:1e9},now);assert.equal(s.gems,9940);assert.equal(s.gold,before.gold+65000);const after=G.clone(s);assert.throws(()=>G.action(s,{kind:'shop-buy',item:'daily-coins'},now));assert.deepEqual(s,after);
assert.throws(()=>G.action(s,{kind:'shop-buy',item:'daily-key'},now));s.activities.daily.used=1;G.action(s,{kind:'shop-buy',item:'daily-key'},now);assert.equal(s.activities.daily.used,0);assert(G.validate(s));
const midnight=Date.parse('2026-11-18T15:00Z');G.action(s,{kind:'shop-buy',item:'daily-coins'},midnight);assert.equal(s.shop.counts['daily-coins'],1);
assert.throws(()=>G.action(s,{kind:'shop-buy',item:'winter-pack'},Date.parse('2026-12-02T15:00Z')));assert(!G.validate({...s,shop:{day:1,counts:{'daily-coins':2}}}));
console.log('PASS trusted prices, region scaling, one daily deal, full-key rejection, safe refill, KST reset, offer expiry and save validation');
