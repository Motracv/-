import '../school/raid-engine.js';
const raidRequire=(ok,msg,status=400)=>{if(!ok)throw Object.assign(new Error(msg),{status});};
const raidId=()=>crypto.randomUUID();
export function createRaids(game){
 const R=globalThis.SchoolRaidRules;
 const member=(db,id)=>db.prepare('SELECT * FROM school_guild_members WHERE account_id=?').bind(id).first();
 async function saves(db,members){const out=[];for(const m of members){const row=await db.prepare('SELECT payload FROM school_saves WHERE account_id=?').bind(m.account).first();const save=row?JSON.parse(row.payload):null;raidRequire(save&&game.validate(save),'단원의 계정 기록을 다시 확인해 주세요.',409);out.push({account:m.account,save});}return out;}
 async function persist(db,gid,row,s,before,start,now,actor=''){
  const rev=row.revision+1,condition='EXISTS(SELECT 1 FROM school_raids WHERE guild_id=? AND revision=?)';
  const statements=[db.prepare(`UPDATE school_raids SET payload=?,revision=revision+1,updated_at=? WHERE guild_id=? AND revision=?
   AND (length(?)=0 OR EXISTS(SELECT 1 FROM school_guild_members WHERE account_id=? AND guild_id=?))
   AND (?=0 OR NOT EXISTS(SELECT 1 FROM json_each(school_raids.payload,'$.room.members') m WHERE NOT EXISTS(SELECT 1 FROM school_guild_members gm WHERE gm.account_id=json_extract(m.value,'$.account') AND gm.guild_id=school_raids.guild_id)))`)
   .bind(JSON.stringify(s),now,gid,row.revision,actor,actor,gid,start?1:0)];
  const room=s.room,oldRoom=before.room;
  if(start)for(const m of room.members)statements.push(db.prepare(`INSERT INTO school_raid_days(account_id,day,used) SELECT ?,?,1 WHERE ${condition} ON CONFLICT(account_id,day) DO UPDATE SET used=used+1`).bind(m.account,game.day(now),gid,rev));
  if(room?.battle){for(const t of room.battle.teams){const old=oldRoom?.id===room.id?oldRoom.battle?.teams.find(x=>x.account===t.account)?.damage||0:0,delta=t.damage-old;if(delta>0)statements.push(db.prepare(`INSERT INTO school_raid_scores(guild_id,cycle,account_id,damage) SELECT ?,?,?,? WHERE ${condition} ON CONFLICT(guild_id,cycle,account_id) DO UPDATE SET damage=damage+excluded.damage`).bind(gid,s.cycle,t.account,delta,gid,rev));}
   if(room.status==='finished'&&oldRoom?.status!=='finished')for(const t of room.battle.teams){const reward=R.reward(t.damage);statements.push(db.prepare(`INSERT OR IGNORE INTO school_raid_rewards(account_id,room_id,gold,gems,damage,created_at) SELECT ?,?,?,?,?,? WHERE ${condition}`).bind(t.account,room.id,reward.gold,reward.gems,t.damage,now,gid,rev));}
  }
  const slotsChanged=oldRoom?.id!==room?.id||oldRoom?.status!==room?.status||JSON.stringify(oldRoom?.members.map(m=>m.account))!==JSON.stringify(room?.members.map(m=>m.account));
  if(slotsChanged){statements.push(db.prepare(`DELETE FROM school_raid_slots WHERE guild_id=? AND ${condition}`).bind(gid,gid,rev));
  if(room&&['lobby','fighting'].includes(room.status))for(const m of room.members)statements.push(db.prepare(`INSERT INTO school_raid_slots(account_id,guild_id,room_id) SELECT ?,?,? WHERE ${condition}`).bind(m.account,gid,room.id,gid,rev));
  }
  const result=await db.batch(statements);return result[0].meta.changes>0;
 }
 async function update(db,gid,id,data,now){
  await db.prepare('INSERT OR IGNORE INTO school_raids(guild_id,payload,updated_at) VALUES(?,?,?)').bind(gid,JSON.stringify({hp:R.HP,cycle:1,room:null,receipts:[]}),now).run();
  for(let attempt=0;attempt<6;attempt++){
   const row=await db.prepare('SELECT * FROM school_raids WHERE guild_id=?').bind(gid).first();raidRequire(row,'길드를 찾지 못했어요.',404);
   const s=JSON.parse(row.payload),before=game.clone(s),kind=data.kind,key=id+':'+data.requestId;let room=s.room,start=false;
   if(room?.status==='fighting'){R.advance(game,room.battle,now);s.hp=room.battle.boss.hp;if(room.battle.ended)room.status='finished';}
   if(room?.status==='lobby'){
    const arriving=room.members.find(m=>m.account===id);if(arriving&&now-arriving.seen>=5000)arriving.seen=now;
    const current=[];for(const m of room.members)if(now-m.seen<120000&&(await member(db,m.account))?.guild_id===gid)current.push(m);room.members=current;
    if(!room.members.length||now-room.createdAt>600000){s.room=room=null;}
    else if(!room.members.some(m=>m.account===room.host&&now-m.seen<30000))room.host=(room.members.find(m=>now-m.seen<30000)||room.members[0]).account;
   }
   // First commit time advancement before a command can replace the finished room.
   if(before.room?.status==='fighting'&&room?.status==='finished'){
    if(!await persist(db,gid,row,s,before,false,now))continue;
    continue;
   }
   const duplicate=kind!=='state'&&s.receipts.includes(key);
   if(kind!=='state'&&!duplicate){
    raidRequire((await member(db,id))?.guild_id===gid,'길드 소속이 바뀌었어요.',403);
    if(kind==='create'){
     raidRequire(s.hp>0,'벌룬을 처치했어요. 다음 벌룬을 열어 주세요.',409);raidRequire(!room||room.status==='finished','이미 열린 길드 전투방에 참가해 주세요.',409);
     s.room=room={id:raidId(),host:id,status:'lobby',createdAt:now,members:[{account:id,seen:now,ready:false}],battle:null};
    }else if(kind==='next'){
     raidRequire(s.hp===0&&room?.status!=='fighting','현재 벌룬을 먼저 처치해 주세요.',409);s.hp=R.HP;s.cycle++;s.room=room=null;
    }else{
     raidRequire(room&&data.roomId===room.id,'전투방이 바뀌었어요. 목록을 다시 확인해 주세요.',409);
     const m=room.members.find(m=>m.account===id);
     if(kind==='join'){raidRequire(room.status==='lobby','이미 시작한 전투에는 참가할 수 없어요.',409);if(!m){raidRequire(room.members.length<R.MAX_PLAYERS,'전투방은 5명까지 참가할 수 있어요.',409);room.members.push({account:id,seen:now,ready:false});}}
     else{raidRequire(m,'이 전투방 참가자가 아니에요.',403);
      if(kind==='leave'){raidRequire(room.status==='lobby','진행 중인 전투는 90초까지 자동으로 이어집니다.',409);room.members=room.members.filter(x=>x.account!==id);if(!room.members.length)s.room=room=null;else if(room.host===id)room.host=room.members[0].account;}
      else if(kind==='ready'){raidRequire(room.status==='lobby','대기실에서 준비할 수 있어요.',409);const own=(await saves(db,[m]))[0].save;raidRequire(own.team.some(h=>R.magical(game,h)),'마법 피해를 주는 용병을 한 명 이상 편성해 주세요.');m.ready=!m.ready;}
      else if(kind==='start'){
       raidRequire(room.status==='lobby'&&room.host===id,'방장만 시작할 수 있어요.',403);raidRequire(room.members.every(m=>m.ready&&now-m.seen<30000),'모든 단원이 접속하여 준비를 완료해야 해요.',409);
       for(const m of room.members){const current=await member(db,m.account);raidRequire(current?.guild_id===gid,'길드를 나간 단원이 있어요. 대기실을 다시 열어 주세요.',409);const d=await db.prepare('SELECT used FROM school_raid_days WHERE account_id=? AND day=?').bind(m.account,game.day(now)).first();raidRequire((d?.used||0)<5,'오늘 5회를 사용한 단원이 있어요.',409);}
       const parties=await saves(db,room.members);raidRequire(parties.every(p=>p.save.team.some(h=>R.magical(game,h))),'각 편성에 마법 공격 용병이 필요해요.',409);
       room.battle=R.create(game,parties,now,crypto.getRandomValues(new Uint32Array(1))[0],s.hp);room.status='fighting';start=true;
      }
     }
    }
    s.receipts.push(key);s.receipts=s.receipts.slice(-50);
   }
   const self=room?.members.find(m=>m.account===id);if(self&&now-self.seen>=5000)self.seen=now;
   if(kind==='state'&&JSON.stringify(s)===JSON.stringify(before))return s;
   try{if(await persist(db,gid,row,s,before,start,now,kind==='state'?'':id))return s;}catch(e){if(/CHECK constraint|UNIQUE constraint/.test(e.message))throw Object.assign(new Error('다른 전투가 먼저 처리됐거나 오늘 횟수를 모두 사용했어요. 새로고침해 주세요.'),{status:409});throw e;}
  }throw Object.assign(new Error('다른 단원의 진행을 확인 중이에요. 다시 시도해 주세요.'),{status:409});
 }
 async function view(db,gid,id,s,now){
  const day=await db.prepare('SELECT used FROM school_raid_days WHERE account_id=? AND day=?').bind(id,game.day(now)).first();
  const rewards=(await db.prepare('SELECT room_id AS roomId,gold,gems,damage FROM school_raid_rewards WHERE account_id=? AND claimed=0 ORDER BY created_at DESC LIMIT 30').bind(id).all()).results||[];
  const ranks=(await db.prepare('SELECT n.display_name AS name,r.damage FROM school_raid_scores r LEFT JOIN school_names n ON n.account_id=r.account_id WHERE r.guild_id=? AND r.cycle=? ORDER BY r.damage DESC LIMIT 30').bind(gid,s.cycle).all()).results||[];
  let room=null;if(s.room){room=game.clone(s.room);delete room.createdAt;room.members=await Promise.all(room.members.map(async m=>{const n=await db.prepare("SELECT n.display_name,json_extract(s.payload,'$.team') AS team FROM school_names n JOIN school_saves s ON s.account_id=n.account_id WHERE n.account_id=?").bind(m.account).first();let team;try{team=JSON.parse(n?.team);}catch{}return{account:m.account,name:n?.display_name||'단장',ready:m.ready,online:now-m.seen<15000,isMe:m.account===id,heroes:Array.isArray(team)?team.filter(h=>game.BY_ID[h]).map(h=>({id:h,magic:R.magical(game,h)})):[]};}));
   if(room.battle){delete room.battle.seed;for(const t of room.battle.teams){delete t.synergy;for(const u of t.units)delete u.exclusive;}}
  }
  return{guildId:gid,serverTime:now,hp:s.hp,max:R.HP,cycle:s.cycle,remaining:5-(day?.used||0),resetsAt:(game.day(now)+1)*86400000-9*3600000,room,rewards,ranks};
 }
 return{async request(request,env,data,accounts){
  const now=Date.now(),signed=await accounts.identity(request,env,now);raidRequire(signed,'Google 계정으로 로그인해 주세요.',401);raidRequire(data.catalogVersion===game.CATALOG_VERSION,'게임이 업데이트됐어요. 새로고침해 주세요.',426);
  raidRequire(['state','create','join','ready','start','leave','next'].includes(data.kind),'지원하지 않는 행동이에요.');if(data.kind!=='state')raidRequire(typeof data.requestId==='string'&&/^[\w-]{16,80}$/.test(data.requestId),'요청 번호가 올바르지 않아요.');
  const db=env.DB,m=await member(db,signed.id);raidRequire(m,'길드에 가입한 뒤 도전할 수 있어요.',403);
  const slot=await db.prepare('SELECT guild_id FROM school_raid_slots WHERE account_id=?').bind(signed.id).first();if(slot&&slot.guild_id!==m.guild_id){const old=await update(db,slot.guild_id,signed.id,{kind:'state'},now);raidRequire(old.room?.status!=='fighting','이전 길드의 전투가 진행 중이에요. 종료 후 도전해 주세요.',409);await db.prepare('DELETE FROM school_raid_slots WHERE account_id=? AND guild_id=?').bind(signed.id,slot.guild_id).run();}
  const s=await update(db,m.guild_id,signed.id,data,now);return view(db,m.guild_id,signed.id,s,now);
 }};
}
