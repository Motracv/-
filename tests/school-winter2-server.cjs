const assert = require('node:assert/strict');
const G = require('../school/engine.js');
const {fixture} = require('./account-fixture.cjs');

(async () => {
  const t = await fixture(), nativeNow = Date.now;
  let now = Date.parse('2026-11-18T12:00:00+09:00'), sequence = 0;
  Date.now = () => now;
  try {
    if (process.env.SCHOOL_TEST_BUNDLE) {
      const w = (await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default, original = t.call;
      t.call = async (path, data = {}, token, headers = {}) => {
        if (!path.startsWith('/api/school/')) return original(path, data, token, headers);
        const r = await w.fetch(new Request('https://card.example' + path, {method:'POST', headers:{'Content-Type':'application/json', Origin:'https://motracv.github.io', ...headers}, body:JSON.stringify(data)}), t.env);
        return {status:r.status, data:await r.json()};
      };
    }
    const call = (p, path, body = {}) => t.call('/api/school/' + path, {catalogVersion:G.CATALOG_VERSION, ...body}, null, p ? {'X-Account-Session':p.token} : {});
    const row = p => t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(p.profile.id);
    const save = p => JSON.parse(row(p).payload);
    const patch = (p, fn) => { const s = save(p); fn(s); assert(G.validate(s), 'trusted test state must validate'); t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s), p.profile.id); };
    const input = (p, action) => ({revision:row(p).revision, requestId:'winter2-action-' + String(++sequence).padStart(6,'0'), action});
    const act = (p, action) => call(p, 'action', input(p, action));
    const account = async name => {const r=await t.login('winter2-'+name);assert.equal(r.status,200);assert.equal((await call(r.data,'state')).status,200);return r.data;};
    const fundTickets = (p, n) => patch(p,s=>{s.winter.snowmen=n;s.winter.snowmenEarned=n;s.winter.spins=0;});
    const fundFlakes = (p, n) => patch(p,s=>{s.winter.snowflakes=s.winter.earned=n;});
    async function entropy(values, fn) {
      const original=crypto.getRandomValues; let index=0;
      crypto.getRandomValues=array=>{for(let i=0;i<array.length;i++)array[i]=Math.floor((values[Math.min(index++,values.length-1)]||0)*4294967296);return array;};
      try{return await fn();}finally{crypto.getRandomValues=original;}
    }
    async function loseSaveReply(fn) {
      const original=t.db.prepare; let lost=false;
      t.db.prepare=sql=>{const statement=original(sql);if(!sql.startsWith('UPDATE school_saves'))return statement;return {bind(...args){const bound=statement.bind(...args);return {...bound,async run(){const result=await bound.run();if(!lost&&result.meta.changes){lost=true;throw Error('SAVED_RESPONSE_LOST');}return result;}};}};};
      try { const result=await fn();assert(lost);return result; } finally {t.db.prepare=original;}
    }

    const legacy=await account('legacy');
    patch(legacy,s=>{s.winter={id:G.WINTER_EVENT.id,snowflakes:1460,earned:3000,exchanges:{gold:30,gems:15,horas:2}};s.gold=5860;s.gems=290;s.banners={osia:{pity:72,guaranteed:true},lava:{pity:67,guaranteed:true},horas:{pity:31,guaranteed:false},ryusion:{pity:12,guaranteed:false}};});
    const old=save(legacy);let r=await call(legacy,'state',{state:{winter:{snowmen:1e9,snowflakes:1e9}}});assert.equal(r.status,200);
    assert.deepEqual([save(legacy).gold,save(legacy).gems,save(legacy).winter.snowflakes],[old.gold,old.gems,old.winter.snowflakes]);
    assert.equal(save(legacy).winter.snowmen||0,0);assert.deepEqual(save(legacy).banners,old.banners);
    assert.equal((await call(null,'action',{revision:0,requestId:'winter2-no-identity',action:{kind:'winter-spin'}})).status,401);
    const beforeOld=row(legacy).payload;assert.equal((await call(legacy,'action',{...input(legacy,{kind:'winter-spin'}),catalogVersion:24})).status,426);assert.equal(row(legacy).payload,beforeOld);
    assert.equal((await act(legacy,{kind:'winter-spin',snowmen:1e9,free:true})).status,400);
    console.log('PASS old saves keep balances and independent pity; authentication/current catalog and real snowman cost enforced');

    const roulette=await account('roulette');fundTickets(roulette,5);
    for(const [roll,index,type,amount] of [[0,0,'gems',10000],[.005,1,'gems',1000],[.05,2,'gems',100],[.2,3,'equipment',1],[.8,4,'gold',2600]]) {
      const before=save(roulette),q=input(roulette,{kind:'winter-spin',reward:{type:'gems',amount:1e12},index:0,cost:0,snowmen:999,seed:0});
      r=await entropy([roll,0,0],()=>call(roulette,'action',q));assert.equal(r.status,200);assert.equal(r.data.result.index,index);assert.equal(r.data.result.reward.type,type);assert.equal(r.data.result.reward.amount,amount);
      const after=save(roulette);assert.equal(after.winter.snowmen,before.winter.snowmen-1);assert.equal(after.winter.spins,before.winter.spins+1);assert.equal(after.winter.snowmenEarned,5);
      assert.equal(after.gems-before.gems,type==='gems'?amount:0);assert.equal(after.gold-before.gold,type==='gold'?amount:0);
      if(type==='equipment'){const item=r.data.result.reward.item;assert(G.GEAR_BY_ID[item]&&!G.GEAR_BY_ID[item].owner);assert.equal(after.equipment.inventory[item].count-(before.equipment.inventory[item]?.count||0),1);}
    }
    assert.equal((await act(roulette,{kind:'winter-spin',cost:0})).status,400);
    assert.equal(save(roulette).winter.snowmen,0);
    console.log('PASS all five prizes use server entropy, fixed amounts/cost, ordinary gear only and no client-picked result');

    const concurrent=await account('concurrent');fundTickets(concurrent,1);const beforeRace=save(concurrent),q=input(concurrent,{kind:'winter-spin'});
    const duplicates=await entropy([.005],()=>Promise.all([call(concurrent,'action',q),call(concurrent,'action',q),call(concurrent,'action',q)]));assert(duplicates.every(x=>x.status===200));assert(duplicates.every(x=>JSON.stringify(x.data.result)===JSON.stringify(duplicates[0].data.result)));
    assert.equal(save(concurrent).winter.snowmen,0);assert.equal(save(concurrent).winter.spins,1);assert.equal(save(concurrent).gems,beforeRace.gems+1000);
    const distinct=await account('distinct');fundTickets(distinct,1);const requests=[input(distinct,{kind:'winter-spin'}),input(distinct,{kind:'winter-spin'})];
    const races=await entropy([.8,0],()=>Promise.all(requests.map(x=>call(distinct,'action',x))));assert.deepEqual(races.map(x=>x.status).sort(),[200,409]);assert.equal(save(distinct).winter.spins,1);assert.equal(save(distinct).winter.snowmen,0);
    const lost=await account('lost');fundTickets(lost,1);const lostInput=input(lost,{kind:'winter-spin'}),lostBefore=save(lost);
    assert.equal((await entropy([.005],()=>loseSaveReply(()=>call(lost,'action',lostInput)))).status,503);
    const again=(await t.login('winter2-lost')).data;const recovered=await entropy([.8,0],()=>call(again,'action',lostInput));assert.equal(recovered.status,200);assert.equal(recovered.data.repeated,true);assert.equal(recovered.data.result.reward.type,'gems');assert.equal(recovered.data.result.reward.amount,1000);assert.equal(save(again).gems,lostBefore.gems+1000);assert.equal(save(again).winter.spins,1);
    console.log('PASS simultaneous/retried spins spend one ticket; lost responses retain the exact prize through reconnect');

    for(const [name,change] of [['gold',s=>s.gold=Number.MAX_SAFE_INTEGER-100],['gems',s=>s.gems=Number.MAX_SAFE_INTEGER-100],['gear',s=>s.equipment.inventory.chalk_star={count:G.GEAR_MAX_COUNT,stars:0}]]){
      const capped=roulette,baseline=row(capped).payload;fundTickets(capped,1);patch(capped,change);const original=crypto.getRandomValues,before=row(capped).payload;let samples=0;
      crypto.getRandomValues=()=>{samples++;throw Error('A rejected prize-cap action must not sample entropy');};
      try{assert.equal((await act(capped,{kind:'winter-spin',index:0})).status,400);}finally{crypto.getRandomValues=original;}
      assert.equal(samples,0);assert.equal(row(capped).payload,before);t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(baseline,capped.profile.id);
    }
    console.log('PASS wallet and gear caps reject before any random draw, preventing selective no-cost rerolls');

    const a=await account('duo-a'),b=await account('duo-b');
    for(const p of [a,b])patch(p,s=>{s.team=['osia','lava','lumi','ryusion','ian','nari'];for(const id of s.team)s.units[id]={level:100,stars:5,xp:0,shards:0};});
    const yc=(p,kind,more={})=>call(p,'yeti',{kind,requestId:'winter2-yeti-'+String(++sequence).padStart(6,'0'),...more});
    r=await yc(a,'create');assert.equal(r.status,200);const roomId=r.data.room.id;
    assert.equal((await yc(b,'join',{code:r.data.room.code})).status,200);for(const p of [a,b])assert.equal((await yc(p,'ready',{roomId})).status,200);
    assert.equal((await yc(a,'start',{roomId})).status,200);
    // Trusted fixture reduces only the stored boss HP to exercise production settlement quickly.
    t.sqlite.prepare("UPDATE school_yeti_rooms SET payload=json_set(payload,'$.battle.boss.hp',1),revision=revision+1 WHERE id=?").run(roomId);now+=1500;
    assert.equal((await yc(a,'state',{roomId})).status,200);
    const awards=t.sqlite.prepare('SELECT * FROM school_yeti_rewards WHERE room_id=?').all(roomId);assert.equal(awards.length,2);assert(awards.every(x=>x.snowmen===1&&x.snowflakes>=20&&x.snowflakes<=50));
    const claim=input(a,{kind:'yeti-claim',roomId,snowmen:9999,snowflakes:1e12}),aw=awards.find(x=>x.account_id===a.profile.id);
    const claims=await Promise.all([call(a,'action',claim),call(a,'action',claim)]);assert(claims.every(x=>x.status===200));assert.equal(save(a).winter.snowmen,1);assert.equal(save(a).winter.snowmenEarned,1);assert.equal(save(a).winter.snowflakes,aw.snowflakes);assert.equal(save(b).winter.snowmen||0,0);
    const bClaim=input(b,{kind:'yeti-claim',roomId}),originalBatch=t.db.batch;let lostClaim=false;
    t.db.batch=async sql=>{const result=await originalBatch(sql);if(!lostClaim){lostClaim=true;throw Error('CLAIM_RESPONSE_LOST');}return result;};
    try{assert.equal((await call(b,'action',bClaim)).status,503);}finally{t.db.batch=originalBatch;}
    r=await call(b,'action',bClaim);assert.equal(r.status,200);assert.equal(r.data.repeated,true);assert.equal(save(b).winter.snowmen,1);assert.equal(save(b).winter.snowmenEarned,1);assert.equal((await act(a,{kind:'yeti-claim',roomId})).status,400);
    t.sqlite.prepare('INSERT INTO school_yeti_rewards(account_id,room_id,snowflakes,created_at) VALUES(?,?,?,?)').run(a.profile.id,'winter2-old-award',25,now);
    assert.equal((await act(a,{kind:'yeti-claim',roomId:'winter2-old-award',snowmen:99})).status,200);assert.equal(save(a).winter.snowmen,1);assert.equal(save(a).winter.snowmenEarned,1);
    console.log('PASS actual duo victory records one snowman each; claims cannot duplicate, forge or retroactively mint old tickets');

    const spica=await account('spica');fundFlakes(spica,10000);const spicaBefore=save(spica),spicaInput=input(spica,{kind:'winter-exchange',item:'spica',cost:0,level:100,stars:5,count:99});
    const exchanges=await Promise.all([call(spica,'action',spicaInput),call(spica,'action',spicaInput)]);assert(exchanges.every(x=>x.status===200));assert.equal(save(spica).winter.snowflakes,5000);assert.equal(save(spica).units.spica.level,1);assert.equal(save(spica).units.spica.stars,0);assert.equal(exchanges[0].data.result.hero,'spica');assert.equal(exchanges[0].data.result.fresh,true);
    assert.deepEqual([save(spica).gold,save(spica).gems,save(spica).banners,save(spica).pulls],[spicaBefore.gold,spicaBefore.gems,spicaBefore.banners,spicaBefore.pulls]);
    assert.equal((await act(spica,{kind:'winter-exchange',item:'spica'})).status,400);assert.equal((await act(spica,{kind:'recruit',count:1,banner:'spica'})).status,400);assert(!G.STANDARD_SSR.includes('spica'));
    now=Date.parse('2026-11-19T00:00:01+09:00');await call(spica,'state');assert.equal(G.winterInfo(save(spica),now).items.find(x=>x.id==='spica').remaining,0);assert.equal((await act(spica,{kind:'winter-exchange',item:'spica'})).status,400);
    console.log('PASS Spica costs exactly 5000 once, unlocks Lv1 without touching gacha and never refreshes at midnight');

    const banners=await account('permanent');patch(banners,s=>{s.gems=10000;s.banners.osia={pity:79,guaranteed:true};s.banners.lava={pity:79,guaranteed:true};s.banners.horas={pity:31,guaranteed:false};s.weaponBanners.standard.pity=79;s.weaponBanners.limited.pity=31;});
    now=Date.parse('2026-11-22T12:00:00+09:00');r=await entropy([.999,.999],()=>act(banners,{kind:'recruit',banner:'lava',count:1}));assert.equal(r.status,200);assert.equal(r.data.result.results[0].id,'lava');assert.deepEqual(save(banners).banners.osia,{pity:79,guaranteed:true});assert.deepEqual(save(banners).banners.horas,{pity:31,guaranteed:false});
    r=await entropy([.999,.999],()=>act(banners,{kind:'recruit',banner:'osia',count:1}));assert.equal(r.status,200);assert.equal(r.data.result.results[0].id,'osia');assert(G.STANDARD_SSR.includes('lava'));assert(G.STANDARD_SSR.includes('osia'));assert.equal(G.BANNERS.lava.expiresAt,null);
    r=await entropy([.999],()=>act(banners,{kind:'weapon-recruit',banner:'ryusion',count:1}));assert.equal(r.status,200);assert.equal(r.data.result.results[0].item,'earth_shield');assert.equal(save(banners).weaponBanners.standard.pity,0);assert.equal(save(banners).weaponBanners.limited.pity,31);
    console.log('PASS permanent Osia/Lava preserve separate featured guarantees and Ryusion shield uses shared standard weapon pity without off-banner drops');

    now=Date.parse('2026-12-03T00:00:00+09:00')-1;const limited=await account('limited');patch(limited,s=>{s.gems=1000;s.banners.horas={pity:79,guaranteed:false};});
    const limitedInput=input(limited,{kind:'recruit',banner:'horas',count:1});assert.equal((await entropy([.999],()=>loseSaveReply(()=>call(limited,'action',limitedInput)))).status,503);const afterLimited=save(limited);assert(afterLimited.units.horas);assert.equal(afterLimited.gems,840);
    now++;r=await call(limited,'action',limitedInput);assert.equal(r.status,200);assert.equal(r.data.repeated,true);assert.equal(r.data.result.results[0].id,'horas');const expiredBefore=row(limited).payload;assert.equal((await act(limited,{kind:'recruit',banner:'horas',count:1,now:now-10000})).status,400);assert.equal(row(limited).payload,expiredBefore);
    assert.equal(G.BANNERS.horas.expiresAt,now);assert.equal(G.BANNERS.horas.limited,true);
    for(const s of t.sqlite.prepare('SELECT payload FROM school_saves').all())assert(G.validate(JSON.parse(s.payload)));
    console.log('PASS Horas cutoff is exact KST midnight, committed pre-expiry draw replays safely and all resulting saves validate');
  } finally {Date.now=nativeNow;t.sqlite.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
