const assert=require('node:assert/strict'),G=require('../school/engine.js'),{fixture}=require('./account-fixture.cjs');
(async()=>{
 const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),migrationDb=new DatabaseSync(':memory:'),dir=path.join(__dirname,'../online/migrations');
 migrationDb.exec('PRAGMA foreign_keys=ON');
 for(const name of fs.readdirSync(dir).filter(name=>/^\d+.*\.sql$/.test(name)&&name<'0015').sort())migrationDb.exec(fs.readFileSync(path.join(dir,name),'utf8'));
 migrationDb.prepare('INSERT INTO accounts(id,google_key,created_at) VALUES(?,?,?)').run('migrate','migration-account',1);
 migrationDb.prepare('INSERT INTO school_yeti_rewards(account_id,room_id,snowflakes,claimed,created_at,snowmen) VALUES(?,?,?,?,?,?)').run('migrate','old-victory',35,1,1,0);
 const original=migrationDb.prepare('SELECT * FROM school_yeti_rewards').get();migrationDb.exec(fs.readFileSync(path.join(dir,'0015_school_weekend_rewards.sql'),'utf8'));
 assert.deepEqual(migrationDb.prepare('SELECT * FROM school_yeti_rewards').get(),original);
 migrationDb.prepare('INSERT INTO school_yeti_rewards(account_id,room_id,snowflakes,snowmen,created_at) VALUES(?,?,?,?,?)').run('migrate','double-victory',100,1,2);
 migrationDb.prepare('DELETE FROM accounts WHERE id=?').run('migrate');assert.equal(migrationDb.prepare('SELECT COUNT(*) AS n FROM school_yeti_rewards').get().n,0);migrationDb.close();
 console.log('PASS reward schema migration preserves historical receipts and account cascade while allowing 100 snowflakes');
 const t=await fixture(),native=Date.now,{startsAt:start,endsAt:end}=G.DOUBLE_REWARD_EVENT;let now=start-10000;Date.now=()=>now;
 try{
  const call=(p,path,data={})=>t.call('/api/school/'+path,{catalogVersion:G.CATALOG_VERSION,...data},null,{'X-Account-Session':p.token});
  const command=(p,path,kind,extra={})=>call(p,path,{kind,requestId:crypto.randomUUID(),...extra});
  const row=p=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(p.profile.id),saved=p=>JSON.parse(row(p).payload);
  const players=[];for(let i=0;i<2;i++){
   const p=(await t.login('weekend-duo-'+i)).data,s=G.create(now,1);s.commanderName='주말협동단장'+i;s.team=['horas','osia','lava','ryusion','lumi','ian'];for(const id of s.team)s.units[id]={level:100,stars:5,xp:0,shards:0};
   if(i===0){s.equipment.inventory={osia_scepter:{count:1,stars:0},lava_fan:{count:1,stars:0}};s.equipment.equipped={osia:{weapon:'osia_scepter'},lava:{weapon:'lava_fan'}};}
   t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(p.profile.id,JSON.stringify(s),now);await command(p,'social','state');players.push(p);
  }
  const [a,b]=players;
  async function defeatYeti(at,pollAt,multiplier){
   now=at;const made=await command(a,'yeti','create');assert.equal(made.status,200);const id=made.data.room.id;
   assert.equal((await command(b,'yeti','join',{code:made.data.room.code})).status,200);
   for(const p of players)assert.equal((await command(p,'yeti','ready',{roomId:id})).status,200);
   const begun=await command(a,'yeti','start',{roomId:id});assert.equal(begun.status,200);
   const units=begun.data.room.battle.teams.find(t=>t.isMe).units;assert.deepEqual(units.find(u=>u.id==='osia').exclusive,{id:'osia_scepter',owner:'osia'});assert.equal(units.find(u=>u.id==='lava').exclusive,undefined);
   // Arrange a legitimate next-hit victory; the server still simulates and commits it.
   t.sqlite.prepare("UPDATE school_yeti_rooms SET payload=json_set(payload,'$.battle.boss.hp',1) WHERE id=?").run(id);
   const old=players.map(saved);now=pollAt;
   const results=await Promise.all(players.map(p=>command(p,'yeti','state',{roomId:id})));assert(results.every(r=>r.status===200));
   const awards=t.sqlite.prepare('SELECT * FROM school_yeti_rewards WHERE room_id=? ORDER BY account_id').all(id);assert.equal(awards.length,2);
   for(let i=0;i<2;i++){
    const award=awards.find(r=>r.account_id===players[i].profile.id);assert(award.snowflakes>=20*multiplier&&award.snowflakes<=50*multiplier);assert.equal(award.snowflakes%multiplier,0);assert.equal(award.snowmen,1);assert.equal(award.claimed,1);assert.equal(award.created_at,at+250);
    assert.equal(saved(players[i]).winter.snowflakes-old[i].winter.snowflakes,award.snowflakes);assert.equal(saved(players[i]).winter.snowmen-(old[i].winter.snowmen||0),1);assert(G.validate(saved(players[i])));
   }
   const balances=players.map(p=>saved(p).winter.snowflakes);
   await Promise.all(Array.from({length:4},(_,i)=>command(players[i%2],'yeti','state',{roomId:id})));assert.deepEqual(players.map(p=>saved(p).winter.snowflakes),balances);
   return awards;
  }
  await defeatYeti(start-1000,start+2000,1);
  assert.equal((await command(a,'yeti','state')).data.rules.rewardMin,40);assert.equal((await command(a,'yeti','state')).data.rules.rewardMax,100);
  await defeatYeti(start+10000,start+11000,2);
  console.log('PASS both duo players get doubled snowflakes exactly once; pre-event kill collected during event remains normal');

  const made=await command(a,'guild','create',{name:'주말보상검증반',emblem:0});assert.equal(made.status,200);const gid=made.data.guild.id;
  assert.equal((await command(a,'guild','invite',{guildId:gid,name:'주말협동단장1'})).status,200);const inv=(await command(b,'guild','state')).data.invites[0];assert.equal((await command(b,'guild','accept',{inviteId:inv.id})).status,200);
  const raid=await command(a,'raid','create'),rid=raid.data.room.id;assert.equal(raid.status,200);assert.equal((await command(b,'raid','join',{roomId:rid})).status,200);
  for(const p of players)assert.equal((await command(p,'raid','ready',{roomId:rid})).status,200);assert.equal((await command(a,'raid','start',{roomId:rid})).status,200);
  now+=91000;const ended=await command(a,'raid','state');assert.equal(ended.status,200);assert.equal(ended.data.room.status,'finished');
  assert.deepEqual(ended.data.room.battle.teams.find(t=>t.account===a.profile.id).units.find(u=>u.id==='osia').exclusive,{id:'osia_scepter',owner:'osia'});
  const R=require('../school/raid-engine.js'),rewards=t.sqlite.prepare('SELECT * FROM school_raid_rewards WHERE room_id=?').all(rid);assert.equal(rewards.length,2);
  for(const reward of rewards){const base=R.reward(reward.damage);assert.equal(reward.gold,base.gold*2);assert.equal(reward.gems,base.gems);}
  // Cross the end boundary before claiming. Persisted rewards must retain their original amount.
  await defeatYeti(end-1000,end+1000,2);await defeatYeti(end+2000,end+3000,1);
  const state=await call(a,'state'),reward=rewards.find(r=>r.account_id===a.profile.id),body={revision:state.data.revision,requestId:crypto.randomUUID(),action:{kind:'raid-claim',roomId:rid}};
  const claimed=await Promise.all(Array.from({length:3},()=>call(a,'action',body)));assert(claimed.every(r=>r.status===200));assert.equal(saved(a).gold-state.data.state.gold,reward.gold);assert.equal(saved(a).gems-state.data.state.gems,reward.gems);
  console.log('PASS actual defeat time determines boundary bonuses; raid gold stored at completion survives late claim and retries');
  const s=await call(b,'state'),couponBody={revision:s.data.revision,requestId:crypto.randomUUID(),action:{kind:'redeem',code:'HYUKJIN_PLEASE_STOP_ASKING'}};
  const coupons=await Promise.all(Array.from({length:3},()=>call(b,'action',couponBody)));assert(coupons.every(r=>r.status===200));assert.equal(saved(b).gems-s.data.state.gems,500);assert.equal(saved(b).winter.snowflakes-s.data.state.winter.snowflakes,50);
  console.log('PASS coupon retries award advertised 500 gems and 50 snowflakes once');
 }finally{Date.now=native;t.sqlite.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
