import '../school/yeti-engine.js';
const yetiRequire=(ok,message,status=400)=>{if(!ok)throw Object.assign(Error(message),{status});};
// Payout and acknowledgement share one transaction. Save revision + a unique
// receipt protect against both simultaneous room polls and ordinary purchases.
export async function collectYetiRewards(db,game,account,now,priorityRoom=''){
 for(let attempt=0;attempt<8;attempt++){
  const rewards=(await db.prepare('SELECT room_id AS roomId,snowflakes,snowmen FROM school_yeti_rewards WHERE account_id=? AND claimed=0 ORDER BY CASE WHEN room_id=? THEN 0 ELSE 1 END,created_at LIMIT 30').bind(account,priorityRoom).all()).results||[];
  if(!rewards.length)return [];
  const row=await db.prepare('SELECT payload,revision FROM school_saves WHERE account_id=?').bind(account).first();
  if(!row)return [];
  const state=JSON.parse(row.payload);yetiRequire(game.validate(state),'저장 정보를 확인할 수 없어 보상 지급을 보류했어요.',500);
  const snowflakes=rewards.reduce((n,r)=>n+r.snowflakes,0),snowmen=rewards.reduce((n,r)=>n+(r.snowmen||0),0);
  for(const [key,n] of Object.entries({snowflakes,earned:snowflakes,snowmen,snowmenEarned:snowmen})){
   const value=(state.winter[key]||0)+n;yetiRequire(Number.isSafeInteger(value)&&value>=0,'보상 수량을 확인 중이에요.',409);state.winter[key]=value;
  }
  const receipt='yeti-auto-'+crypto.randomUUID();
  state.receipts.push({id:receipt,result:{kind:'yeti-auto',snowflakes,snowmen}});state.receipts=state.receipts.slice(-20);
  const ids=rewards.map(r=>r.roomId),places=ids.map(()=>'?').join(',');
  const results=await db.batch([
   db.prepare(`UPDATE school_saves SET payload=?,revision=revision+1,updated_at=? WHERE account_id=? AND revision=? AND (SELECT COUNT(*) FROM school_yeti_rewards WHERE account_id=? AND claimed=0 AND room_id IN (${places}))=?`)
    .bind(JSON.stringify(state),now,account,row.revision,account,...ids,ids.length),
   db.prepare(`UPDATE school_yeti_rewards SET claimed=1 WHERE account_id=? AND claimed=0 AND room_id IN (${places}) AND EXISTS(SELECT 1 FROM school_saves WHERE account_id=? AND revision=? AND json_extract(payload,'$.receipts[#-1].id')=?)`)
    .bind(account,...ids,account,row.revision+1,receipt)
  ]);
  if(results[0].meta.changes===1)return rewards.map(r=>({...r,claimed:1}));
 }
 throw Object.assign(Error('보상을 저장 중이에요. 연결되면 자동으로 다시 확인해요.'),{status:409});
}
export function createYeti(game){
 const Y=globalThis.SchoolYetiRules;
 const uuid=()=>crypto.randomUUID();
 const queryRoom=(db,id)=>db.prepare('SELECT * FROM school_yeti_rooms WHERE id=?').bind(id).first();
 async function current(db,id){
  const slot=await db.prepare('SELECT room_id FROM school_yeti_slots WHERE account_id=?').bind(id).first();
  if(!slot)return null;
  const row=await queryRoom(db,slot.room_id),room=row&&JSON.parse(row.payload);
  if(!room||room.status==='finished'||!room.members.some(m=>m.account===id)){
   await db.prepare('DELETE FROM school_yeti_slots WHERE account_id=? AND room_id=?').bind(id,slot.room_id).run();return null;
  }
  return row;
 }
 async function saved(db,id){const row=await db.prepare('SELECT payload FROM school_saves WHERE account_id=?').bind(id).first();let s;try{s=JSON.parse(row?.payload);}catch{}yetiRequire(s&&game.validate(s),'모험 기록을 먼저 불러와 주세요.',409);return s;}
 async function persist(db,row,s,before,now){
  const commit=uuid();s.commit=commit;
  const guard="EXISTS(SELECT 1 FROM school_yeti_rooms WHERE id=? AND json_extract(payload,'$.commit')=?)";
  const statements=[db.prepare('UPDATE school_yeti_rooms SET payload=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(s),now,s.id,row.revision)];
  if(s.status==='finished'&&before.status!=='finished'&&s.battle?.outcome==='defeated'){
   // One server roll per party member, stored with the victory transaction.
   for(const t of s.battle.teams)if(!t.withdrawn){const amount=20+Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]/4294967296*31);statements.push(db.prepare(`INSERT OR IGNORE INTO school_yeti_rewards(account_id,room_id,snowflakes,snowmen,created_at) SELECT ?,?,?,1,? WHERE ${guard} AND EXISTS(SELECT 1 FROM accounts WHERE id=?)`).bind(t.account,s.id,amount,now,s.id,commit,t.account));}
  }
  const slotsChanged=s.status!==before.status||JSON.stringify(s.members.map(m=>m.account))!==JSON.stringify(before.members.map(m=>m.account));
  if(slotsChanged){
   statements.push(db.prepare(`DELETE FROM school_yeti_slots WHERE room_id=? AND ${guard}`).bind(s.id,s.id,commit));
   if(s.status!=='finished')for(const m of s.members)statements.push(db.prepare(`INSERT INTO school_yeti_slots(account_id,room_id) SELECT ?,? WHERE ${guard}`).bind(m.account,s.id,s.id,commit));
  }
  const result=await db.batch(statements);
  if(result[0].meta.changes===1&&s.status==='finished'&&s.battle?.outcome==='defeated'){
   for(const t of s.battle.teams)if(!t.withdrawn)await collectYetiRewards(db,game,t.account,now,s.id);
  }
  return result[0].meta.changes===1;
 }
 async function update(db,roomId,id,data,now){
  for(let attempt=0;attempt<8;attempt++){
   const row=await queryRoom(db,roomId);if(!row){if(data.kind==='leave')return null;throw Object.assign(Error('전투방이 종료됐어요.'),{status:404});}
   const s=JSON.parse(row.payload),before=game.clone(s),key=id+':'+data.requestId;
   if(s.status==='fighting'){Y.advance(game,s.battle,now);Y.expireRescues(s.battle,now);if(s.battle.ended){s.status='finished';s.outcome=s.battle.outcome;}}
   if(s.status==='lobby'){
    s.members=s.members.filter(m=>now-m.seen<120000);
    const arriving=s.members.find(m=>m.account===id);if(arriving&&now-arriving.seen>=5000)arriving.seen=now;
    if(!s.members.length||now-s.createdAt>=600000){s.status='finished';s.outcome='expired';}
    else if(!s.members.some(m=>m.account===s.host&&now-m.seen<30000))s.host=(s.members.find(m=>now-m.seen<30000)||s.members[0]).account;
   }
   // Settle a victory before a command can fail or discard this room.
   if(before.status!=='finished'&&s.status==='finished'){if(await persist(db,row,s,before,now))continue;else continue;}
   if(data.kind==='leave'&&!s.members.some(m=>m.account===id))return s;
   const duplicate=data.kind!=='state'&&s.receipts.includes(key);
   if(data.kind!=='state'&&!duplicate){
    const me=s.members.find(m=>m.account===id);
    if(data.kind==='join'){
     yetiRequire(s.status==='lobby','이미 시작되었거나 종료된 방이에요.',409);
     if(!me){yetiRequire(s.members.length<2,'예티 전투방은 2명까지예요.',409);await saved(db,id);const slot=await current(db,id);yetiRequire(!slot||slot.id===s.id,'다른 전투방에서 먼저 나와 주세요.',409);s.members.push({account:id,seen:now,ready:false});}
    }else if(data.kind==='leave'){
     if(s.status==='fighting'){Y.withdraw(s.battle,id);s.status='finished';s.outcome='abandoned';}
     s.members=s.members.filter(m=>m.account!==id);
     if(s.status==='lobby'&&!s.members.length){s.status='finished';s.outcome='expired';}
     if(s.host===id)s.host=s.members[0]?.account||null;
    }else{
     yetiRequire(me,'이 전투방의 참가자가 아니에요.',403);
     if(data.kind==='ready'){yetiRequire(s.status==='lobby','대기실에서 준비할 수 있어요.',409);await saved(db,id);me.ready=!me.ready;}
     else if(data.kind==='start'){
      yetiRequire(s.status==='lobby'&&s.host===id,'방장만 전투를 시작할 수 있어요.',403);
      yetiRequire(s.members.length===2&&s.members.every(m=>m.ready&&now-m.seen<30000),'두 단장 모두 접속하여 준비해야 해요.',409);
      const parties=[];for(const m of s.members)parties.push({account:m.account,save:await saved(db,m.account)});
      s.battle=Y.create(game,parties,now,crypto.getRandomValues(new Uint32Array(1))[0]);s.status='fighting';
     }else if(data.kind==='thaw-start'||data.kind==='thaw-submit'){
      yetiRequire(s.status==='fighting','진행 중인 전투에서만 구할 수 있어요.',409);
      try{if(data.kind==='thaw-start'){
       yetiRequire(typeof data.freezeId==='string'&&data.freezeId.length<80,'얼음 상태를 확인해 주세요.');
       const keys=['KeyQ','KeyW','KeyE','KeyR','KeyA','KeyS','KeyD','KeyF'],sequence=Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>keys[n%keys.length]);
       Y.startRescue(s.battle,id,data.freezeId,data.mode,sequence,now);
      }else Y.finishRescue(game,s.battle,id,data.challengeId,data.inputs,now);
      }catch(error){throw Object.assign(error,{status:400});}
     }
    }
    s.receipts.push(key);s.receipts=s.receipts.slice(-80);
   }
   const me=s.members.find(m=>m.account===id);
   if(me&&s.status!=='finished'&&now-me.seen>=5000)me.seen=now;
   if(data.kind==='state'&&JSON.stringify(s)===JSON.stringify(before))return s;
   try{if(await persist(db,row,s,before,now))return s;}catch(error){if(/UNIQUE constraint/.test(error.message))throw Object.assign(Error('다른 방 참가 요청이 먼저 처리됐어요. 새로고침해 주세요.'),{status:409});throw error;}
  }
  throw Object.assign(Error('동료의 요청을 반영 중이에요. 다시 확인해 주세요.'),{status:409});
 }
 async function view(db,id,s,now){
  // Also recover a victory whose response was lost, including the other player
  // when they have already closed the app.
  if(s?.status==='finished'&&s.battle?.outcome==='defeated')for(const t of s.battle.teams)if(!t.withdrawn)await collectYetiRewards(db,game,t.account,now,s.id);
  const recovered=await collectYetiRewards(db,game,id,now,s?.id||'');
  const currentReward=s&&(await db.prepare('SELECT room_id AS roomId,snowflakes,snowmen,claimed FROM school_yeti_rewards WHERE account_id=? AND room_id=? AND claimed=1').bind(id,s.id).first());
  const rewards=currentReward?[currentReward]:recovered;
  let room=null;
  if(s&&s.members.some(m=>m.account===id)){
   const members=[];
   for(const m of s.members){const name=await db.prepare('SELECT display_name FROM school_names WHERE account_id=?').bind(m.account).first();const save=await saved(db,m.account);members.push({name:name?.display_name||'단장',isMe:m.account===id,host:m.account===s.host,ready:m.ready,online:now-m.seen<15000,...game.publicProfile(save),heroes:save.team.slice(0,6)});}
   const battle=s.battle&&game.clone(s.battle);if(battle){delete battle.seed;battle.events=battle.events.filter(e=>e.t>=battle.elapsed-2400).slice(-100);for(const t of battle.teams){t.isMe=t.account===id;if(!t.isMe)delete t.rescue;delete t.account;delete t.synergy;for(const u of t.units)delete u.exclusive;}}
   room={id:s.id,code:s.code,status:s.status,outcome:s.outcome,members,battle};
  }
  const rules=s?.battle?Y.encounterRules(s.battle):Y.RULES;
  return {room,rewards,serverTime:now,rules:{hp:rules.hp,duration:rules.duration,recommendedLevel:Y.RECOMMENDED_LEVEL,difficulty:Y.DIFFICULTY,players:2,rewardMin:20,rewardMax:50,snowmen:1,unlimited:true}};
 }
 return {async request(request,env,data,accounts){
  const now=Date.now(),signed=await accounts.identity(request,env,now);
  yetiRequire(signed,'Google 계정으로 로그인한 뒤 친구와 도전하세요.',401);
  yetiRequire(data.catalogVersion===game.CATALOG_VERSION,'게임을 새로고침해 주세요.',426);
   yetiRequire(['state','create','join','ready','start','leave','thaw-start','thaw-submit'].includes(data.kind),'지원하지 않는 행동이에요.');
  if(data.kind!=='state')yetiRequire(typeof data.requestId==='string'&&/^[\w-]{16,80}$/.test(data.requestId),'요청 번호를 확인하세요.');
  if(!['state','leave'].includes(data.kind))yetiRequire(game.winterInfo(await saved(env.DB,signed.id),now).active,'겨울 이벤트 기간이 아니에요.');
  const db=env.DB;let row=await current(db,signed.id),s;
  if(row&&['create','join'].includes(data.kind)){await update(db,row.id,signed.id,{kind:'state'},now);row=await current(db,signed.id);}
  if(data.kind==='create'){
   const prior=await db.prepare('SELECT payload FROM school_yeti_rooms WHERE creator_id=? AND request_id=?').bind(signed.id,data.requestId).first();if(prior)return view(db,signed.id,JSON.parse(prior.payload),now);
   if(row){const existing=JSON.parse(row.payload);if(existing.receipts.includes(signed.id+':'+data.requestId))return view(db,signed.id,existing,now);throw Object.assign(Error('현재 전투방에서 먼저 나와 주세요.'),{status:409});}
   const code=Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
   s={id:uuid(),code,host:signed.id,status:'lobby',createdAt:now,members:[{account:signed.id,seen:now,ready:false}],battle:null,receipts:[signed.id+':'+data.requestId]};
   try{await db.batch([db.prepare('INSERT INTO school_yeti_rooms(id,code,creator_id,request_id,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(s.id,code,signed.id,data.requestId,JSON.stringify(s),now,now),db.prepare('INSERT INTO school_yeti_slots(account_id,room_id) VALUES(?,?)').bind(signed.id,s.id)]);}catch(error){if(/UNIQUE constraint/.test(error.message)){const won=await db.prepare('SELECT payload FROM school_yeti_rooms WHERE creator_id=? AND request_id=?').bind(signed.id,data.requestId).first();if(won)return view(db,signed.id,JSON.parse(won.payload),now);throw Object.assign(Error('이미 참가한 방이 있어요. 다시 불러와 주세요.'),{status:409});}throw error;}
  }else if(data.kind==='join'){
   yetiRequire(typeof data.code==='string'&&/^[A-Z2-9]{8}$/.test(data.code.trim().toUpperCase()),'8자리 초대 코드를 입력해 주세요.');
   const target=await db.prepare('SELECT id FROM school_yeti_rooms WHERE code=?').bind(data.code.trim().toUpperCase()).first();yetiRequire(target,'초대 코드를 찾지 못했어요.',404);
   yetiRequire(!row||row.id===target.id,'다른 전투방에서 먼저 나와 주세요.',409);s=await update(db,target.id,signed.id,data,now);
  }else{
   const roomId=data.roomId||row?.id;
   if(roomId){const target=await queryRoom(db,roomId);yetiRequire(target||['state','leave'].includes(data.kind),'전투방이 종료됐어요.',404);if(target){const known=JSON.parse(target.payload);yetiRequire(known.members.some(m=>m.account===signed.id)||data.kind==='leave','이 방의 참가자가 아니에요.',403);s=await update(db,roomId,signed.id,data,now);}}
   else yetiRequire(data.kind==='state'||data.kind==='leave','먼저 전투방에 참가해 주세요.',409);
  }
  return view(db,signed.id,s||null,now);
 }};
}
