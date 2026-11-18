const assert=require('node:assert/strict');
const G=require('../school/engine.js');
const NOW=Date.parse('2026-11-18T12:00:00+09:00'),MIDNIGHT=Date.parse('2026-11-19T00:00:00+09:00');
let passed=0;const test=(name,run)=>{run();passed++;console.log('PASS',name);};
const make=(now=NOW)=>{const s=G.create(now);s.winter.snowflakes=s.winter.earned=10000;return s;};
const buy=(s,item,now=s.at)=>G.action(s,{kind:'winter-exchange',item,cost:0,gold:1e12,gems:1e12,day:0,remaining:10},now);
const info=(s,now=s.at)=>G.winterInfo(s,now);
function rejects(s,action,now=s.at){const before=G.clone(s);assert.throws(()=>G.action(s,action,now));assert.deepEqual(s,before);}
test('Four winter items retain ten daily gold/gem purchases, two shard purchases and one lifetime Spica unlock',()=>{
 const s=make(),before=[s.gold,s.gems];assert.equal(G.CATALOG_VERSION,25);assert.deepEqual(info(s).items.map(i=>[i.id,i.cost,i.limit,i.remaining]),[['gold',30,10,10],['gems',60,10,10],['horas',1000,2,2],['spica',5000,1,1]]);assert.equal(info(s).items.find(i=>i.id==='spica').lifetime,true);
 for(let n=0;n<10;n++){assert.equal(buy(s,'gold').cost,30);assert.equal(buy(s,'gems').cost,60);}
 assert.deepEqual([s.gold,s.gems],[before[0]+10000,before[1]+1000]);assert.equal(s.winter.snowflakes,9100);assert.deepEqual(s.winter.exchanges,{gold:10,gems:10});assert.deepEqual(s.winter.daily.exchanges,{gold:10,gems:10});assert(info(s).items.filter(i=>!i.hero).every(i=>!i.canBuy&&i.bought===10&&i.remaining===0));
 for(const item of ['gold','gems'])rejects(s,{kind:'winter-exchange',item});assert(G.validate(G.clone(s)));
});
test('Korean midnight resets both daily allowances, not accumulated currency or historical purchases',()=>{
 const s=make(MIDNIGHT-1);for(let i=0;i<10;i++)buy(s,'gold');const before=G.clone(s),fresh=info(s,MIDNIGHT);assert.deepEqual(s,before);assert.equal(fresh.day,G.day(MIDNIGHT));assert.equal(fresh.resetsAt,MIDNIGHT+86400000);assert.equal(fresh.items[0].remaining,10);assert.equal(fresh.items[0].totalBought,10);
 const r=buy(s,'gold',MIDNIGHT);assert.equal(r.remaining,9);assert.equal(s.winter.snowflakes,before.winter.snowflakes-30);assert.equal(s.winter.exchanges.gold,11);assert.equal(s.winter.daily.exchanges.gold,1);assert.equal(s.winter.daily.exchanges.gems,0);
 const loaded=G.clone(s);for(let i=1;i<10;i++)buy(loaded,'gold',MIDNIGHT);rejects(loaded,{kind:'winter-exchange',item:'gold'},MIDNIGHT-1);assert.equal(info(loaded,MIDNIGHT-1).items[0].remaining,0);assert.equal(loaded.winter.exchanges.gold,20);assert(G.validate(loaded));
});
test('Legacy lifetime purchases and balances survive migration; the new daily counter initializes once',()=>{
 const s=make();delete s.winter.daily;s.winter.exchanges={gold:30,gems:15};const before=G.clone(s);assert(G.validate(s));assert(info(s).items.filter(i=>!i.hero).every(i=>i.remaining===10));assert.deepEqual(s,before);
 G.advance(s,s.at);for(const key of ['gold','gems','units','banners','redeemedCodes'])assert.deepEqual(s[key],before[key]);assert.equal(s.winter.snowflakes,before.winter.snowflakes);assert.equal(s.winter.earned,before.winter.earned);assert.deepEqual(s.winter.exchanges,before.winter.exchanges);assert.deepEqual(s.winter.daily,{day:G.day(NOW),exchanges:{gold:0,gems:0}});
 buy(s,'gems');const loaded=G.clone(s);G.advance(loaded,loaded.at);assert.equal(info(loaded).items[1].remaining,9);assert.equal(loaded.winter.exchanges.gems,16);assert.equal(loaded.winter.daily.exchanges.gems,1);
 const absent=make();delete absent.winter;const old=G.clone(absent);assert.equal(info(absent).snowflakes,0);assert.deepEqual(absent,old);G.advance(absent,absent.at);assert.equal(absent.winter.snowflakes,0);assert.equal(absent.gold,old.gold);
});
test('Negative, fractional, overflowing and malformed daily counters are rejected while long-term totals can exceed ten',()=>{
 for(const mutate of [s=>s.winter.daily=null,s=>s.winter.daily.day=-1,s=>s.winter.daily.day=.5,s=>s.winter.daily.exchanges.gold=11,s=>s.winter.daily.exchanges.gold=-1,s=>s.winter.daily.exchanges.gems=.5,s=>s.winter.daily.exchanges.gems=Infinity,s=>s.winter.exchanges.gold=Number.MAX_SAFE_INTEGER+1,s=>s.winter.exchanges.gold=-1]){const s=make();mutate(s);assert.equal(G.validate(s),false);}
 const s=make();s.winter.exchanges={gold:100000,gems:100000};assert(G.validate(s));assert(info(s).items.filter(i=>!i.hero).every(i=>i.remaining===10));
 for(const now of [NaN,Infinity,-1])rejects(s,{kind:'winter-exchange',item:'gold'},now);
});
test('Insufficient flakes, overflow and invalid items fail atomically without resetting an old-day record',()=>{
 for(const item of ['gold','gems']){const s=make(MIDNIGHT-1);s.winter.snowflakes=G.WINTER_EVENT.shop[item].cost-1;const before=G.clone(s);rejects(s,{kind:'winter-exchange',item},MIDNIGHT);assert.deepEqual(s,before);s.winter.snowflakes++;buy(s,item,MIDNIGHT);assert.equal(s.winter.snowflakes,0);assert.equal(s.winter.daily.day,G.day(MIDNIGHT));}
 const s=make();for(const item of ['constructor','__proto__',{},null])rejects(s,{kind:'winter-exchange',item});s.gold=Number.MAX_SAFE_INTEGER;rejects(s,{kind:'winter-exchange',item:'gold'});s.gold=700;s.winter.exchanges.gold=Number.MAX_SAFE_INTEGER;rejects(s,{kind:'winter-exchange',item:'gold'});
});
console.log(`${passed} winter daily allowance engine checks passed`);
