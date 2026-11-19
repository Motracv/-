/* Invitations route through the existing authoritative join/ready/start APIs.
   Inviting and accepting never start combat or spend a daily entry. */
export function createCoop(game,yeti,raids){
 const requireCoop=(ok,message,status=400)=>{if(!ok)throw Object.assign(Error(message),{status});};
 const guild=(db,id)=>db.prepare('SELECT guild_id FROM school_guild_members WHERE account_id=?').bind(id).first();
 async function related(db,a,b,mode,gid){
  if(a===b)return false;
  const ga=await guild(db,a),gb=await guild(db,b),same=ga&&ga.guild_id===gb?.guild_id;
  if(mode==='raid')return !!same&&ga.guild_id===gid;
  if(same)return true;
  return !!await db.prepare("SELECT 1 FROM school_friends WHERE status='accepted' AND ((requester=? AND target=?) OR (requester=? AND target=?))").bind(a,b,b,a).first();
 }
 async function room(db,mode,id,gid){
  if(mode==='yeti'){const row=await db.prepare('SELECT payload FROM school_yeti_rooms WHERE id=?').bind(id).first();return row?JSON.parse(row.payload):null;}
  const row=await db.prepare('SELECT payload FROM school_raids WHERE guild_id=?').bind(gid||'').first(),value=row&&JSON.parse(row.payload).room;return value?.id===id?value:null;
 }
 const live=(r,now)=>r?.status==='lobby'&&now-r.createdAt<600000&&r.members.some(m=>now-m.seen<120000);
 async function available(db,id,mode,rid){
  const y=await db.prepare('SELECT r.payload FROM school_yeti_slots s JOIN school_yeti_rooms r ON r.id=s.room_id WHERE s.account_id=?').bind(id).first();
  const g=await db.prepare('SELECT r.payload FROM school_raid_slots s JOIN school_raids r ON r.guild_id=s.guild_id WHERE s.account_id=?').bind(id).first();
  for(const [type,raw] of [['yeti',y],['raid',g]])if(raw){const value=JSON.parse(raw.payload),r=type==='raid'?value.room:value;if(r&&['lobby','fighting'].includes(r.status)&&r.members.some(m=>m.account===id)&&(type!==mode||r.id!==rid))return false;}
  return true;
 }
 async function valid(db,invite,now){
  if(invite.expires_at<=now||!await related(db,invite.sender,invite.target,invite.mode,invite.guild_id))return false;
  const r=await room(db,invite.mode,invite.room_id,invite.guild_id);
  return live(r,now)&&r.members.some(m=>m.account===invite.sender&&now-m.seen<120000)&&r.members.length<(invite.mode==='yeti'?2:5)&&!r.members.some(m=>m.account===invite.target);
 }
 async function presence(db,id,now,clientId,online=true){
  if(!clientId){if(online)await db.prepare('INSERT INTO school_coop_presence(account_id,seen_at) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET seen_at=excluded.seen_at WHERE seen_at<?').bind(id,now,now-10000).run();return;}
  requireCoop(typeof clientId==='string'&&/^[\w-]{16,80}$/.test(clientId),'접속 정보를 다시 확인해 주세요.');
  if(!online){await db.prepare('DELETE FROM school_coop_sessions WHERE account_id=? AND client_id=?').bind(id,clientId).run();return;}
  await db.prepare('DELETE FROM school_coop_sessions WHERE account_id=? AND seen_at<?').bind(id,now-60000).run();
  await db.prepare('INSERT INTO school_coop_sessions(account_id,client_id,seen_at) VALUES(?,?,?) ON CONFLICT(account_id,client_id) DO UPDATE SET seen_at=excluded.seen_at WHERE seen_at<?').bind(id,clientId,now,now-4000).run();
 }
 async function inbox(db,id,now,clientId){
  await presence(db,id,now,clientId);
  const rows=(await db.prepare("SELECT i.*,n.display_name AS name,s.payload FROM school_coop_invites i JOIN school_names n ON n.account_id=i.sender JOIN school_saves s ON s.account_id=i.sender WHERE i.target=? AND i.status='pending' AND i.expires_at>? ORDER BY i.created_at DESC LIMIT 5").bind(id,now).all()).results||[];
  const incoming=[];
  for(const i of rows)if(await valid(db,i,now))incoming.push({id:i.id,mode:i.mode,name:i.name,expiresAt:i.expires_at,...game.publicProfile(JSON.parse(i.payload))});
  return {incoming,serverTime:now};
 }
 async function source(db,id,data,now){
  requireCoop(['yeti','raid'].includes(data.mode),'초대할 전투를 확인해 주세요.');
  const gid=data.mode==='raid'?(await guild(db,id))?.guild_id:null;
  const r=await room(db,data.mode,String(data.roomId||''),gid);
  requireCoop(live(r,now)&&r.members.some(m=>m.account===id&&now-m.seen<120000),'참가 중인 대기실에서만 초대할 수 있어요.',409);
  requireCoop(r.members.length<(data.mode==='yeti'?2:5),'전투방이 가득 찼어요.',409);
  return {r,gid};
 }
 return {async request(request,env,data,accounts){
  const now=Date.now(),signed=await accounts.identity(request,env,now);requireCoop(signed,'계정에 로그인한 뒤 초대할 수 있어요.',401);
  requireCoop(data.catalogVersion===game.CATALOG_VERSION,'게임을 새로고침해 주세요.',426);
  const db=env.DB,id=signed.id;
  requireCoop(['state','presence','candidates','invite','accept','decline'].includes(data.kind),'지원하지 않는 초대 요청이에요.');
  if(data.kind==='presence'){requireCoop(!!data.clientId&&data.online===false,'접속 정보를 확인해 주세요.');await presence(db,id,now,data.clientId,false);return {serverTime:now};}
  if(data.kind==='state')return inbox(db,id,now,data.clientId);
  if(data.kind==='candidates'||data.kind==='invite'){
   const {r,gid}=await source(db,id,data,now);
   if(data.kind==='candidates'){
    const rows=(await db.prepare(`SELECT n.account_id AS id,n.display_name AS name,s.payload,
     CASE WHEN COALESCE(p.seen_at,0)>? OR EXISTS(SELECT 1 FROM school_coop_sessions c WHERE c.account_id=n.account_id AND c.seen_at>?) THEN 1 ELSE 0 END AS online,
     CASE WHEN EXISTS(SELECT 1 FROM school_guild_members a JOIN school_guild_members b ON b.guild_id=a.guild_id WHERE a.account_id=? AND b.account_id=n.account_id) THEN 1 ELSE 0 END AS guildmate
     FROM school_names n JOIN school_saves s ON s.account_id=n.account_id LEFT JOIN school_coop_presence p ON p.account_id=n.account_id
     WHERE n.account_id<>? AND (
       EXISTS(SELECT 1 FROM school_guild_members a JOIN school_guild_members b ON b.guild_id=a.guild_id WHERE a.account_id=? AND b.account_id=n.account_id)
       OR (?='yeti' AND EXISTS(SELECT 1 FROM school_friends f WHERE f.status='accepted' AND ((f.requester=? AND f.target=n.account_id) OR (f.target=? AND f.requester=n.account_id))))
     ) ORDER BY online DESC,n.display_name LIMIT 100`).bind(now-30000,now-15000,id,id,id,data.mode,id,id).all()).results||[];
    const sent=(await db.prepare("SELECT target,expires_at FROM school_coop_invites WHERE sender=? AND mode=? AND room_id=? AND status='pending' AND expires_at>?").bind(id,data.mode,r.id,now).all()).results||[];
    return {candidates:rows.filter(n=>!r.members.some(m=>m.account===n.id)).map(n=>({id:n.id,name:n.name,online:!!n.online,guildmate:!!n.guildmate,invitedUntil:sent.find(i=>i.target===n.id)?.expires_at||0,...game.publicProfile(JSON.parse(n.payload))})),serverTime:now};
   }
   requireCoop(typeof data.requestId==='string'&&/^[\w-]{16,80}$/.test(data.requestId),'요청 번호를 확인해 주세요.');
   const previous=await db.prepare('SELECT id,expires_at FROM school_coop_invites WHERE sender=? AND request_id=?').bind(id,data.requestId).first();if(previous)return {sent:true,id:previous.id,expiresAt:previous.expires_at,repeated:true};
   const target=String(data.targetId||'');requireCoop(await related(db,id,target,data.mode,gid),'예티는 친구·길드원, 벌룬은 같은 길드원만 초대할 수 있어요.',403);
   requireCoop(!r.members.some(m=>m.account===target),'이미 전투방에 참가한 단장이에요.',409);
   const named=await db.prepare('SELECT 1 FROM school_names WHERE account_id=?').bind(id).first();requireCoop(named,'단장 이름을 먼저 정해 주세요.',409);
   await db.prepare("UPDATE school_coop_invites SET status='expired' WHERE sender=? AND target=? AND status='pending' AND expires_at<=?").bind(id,target,now).run();
   const active=await db.prepare("SELECT id,expires_at FROM school_coop_invites WHERE sender=? AND target=? AND mode=? AND room_id=? AND status='pending'").bind(id,target,data.mode,r.id).first();if(active)return {sent:true,id:active.id,expiresAt:active.expires_at,repeated:true};
   const recent=await db.prepare('SELECT created_at FROM school_coop_invites WHERE sender=? AND target=? ORDER BY created_at DESC LIMIT 1').bind(id,target).first();requireCoop(!recent||now-recent.created_at>=15000,'잠시 뒤 다시 초대해 주세요.',429);
   const inviteId=crypto.randomUUID();
   await db.prepare(`INSERT OR IGNORE INTO school_coop_invites(id,sender,target,mode,room_id,guild_id,request_id,created_at,expires_at)
    SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM school_coop_invites WHERE sender=? AND status='pending' AND expires_at>?)<10 AND (SELECT COUNT(*) FROM school_coop_invites WHERE target=? AND status='pending' AND expires_at>?)<5`)
    .bind(inviteId,id,target,data.mode,r.id,gid,data.requestId,now,now+120000,id,now,target,now).run();
   const result=await db.prepare("SELECT id,expires_at FROM school_coop_invites WHERE sender=? AND target=? AND mode=? AND room_id=? AND status='pending'").bind(id,target,data.mode,r.id).first();requireCoop(result,'대기 중인 초대가 많아요. 잠시 뒤 다시 시도해 주세요.',429);
   return {sent:true,id:result.id,expiresAt:result.expires_at};
  }
  const invite=await db.prepare('SELECT * FROM school_coop_invites WHERE id=? AND target=?').bind(String(data.inviteId||''),id).first();requireCoop(invite,'받은 초대를 찾지 못했어요.',404);
  if(data.kind==='decline'){const result=await db.prepare("UPDATE school_coop_invites SET status='declined' WHERE id=? AND target=? AND status='pending' AND NOT EXISTS(SELECT 1 FROM school_coop_accepts WHERE account_id=? AND expires_at>?)").bind(invite.id,id,id,now).run();requireCoop(result.meta.changes===1||invite.status!=='pending','초대를 수락하고 있어요. 잠시 기다려 주세요.',409);return inbox(db,id,now,data.clientId);}
  const r=await room(db,invite.mode,invite.room_id,invite.guild_id);
  if(invite.status==='accepted'){requireCoop(r&&['lobby','fighting'].includes(r.status)&&r.members.some(m=>m.account===id),'이미 종료되었거나 나간 전투방이에요.',409);return {joined:true,mode:invite.mode,roomId:invite.room_id,repeated:true};}
  const alreadyJoined=r&&['lobby','fighting'].includes(r.status)&&r.members.some(m=>m.account===id)&&await related(db,invite.sender,id,invite.mode,invite.guild_id);
  requireCoop(invite.status==='pending'&&(alreadyJoined||await valid(db,invite,now)),'초대가 만료되었거나 방이 시작·종료·만석 상태예요.',409);
  const lease=await db.prepare('INSERT INTO school_coop_accepts(account_id,invite_id,expires_at) VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET invite_id=excluded.invite_id,expires_at=excluded.expires_at WHERE school_coop_accepts.expires_at<=? OR school_coop_accepts.invite_id=excluded.invite_id').bind(id,invite.id,now+30000,now).run();
  requireCoop(lease.meta.changes===1,'다른 초대에 입장 중이에요. 잠시 기다려 주세요.',409);
  try{
   const status=await db.prepare('SELECT status FROM school_coop_invites WHERE id=?').bind(invite.id).first();requireCoop(status&&['pending','accepted'].includes(status.status),'이미 취소된 초대예요.',409);
   requireCoop(await available(db,id,invite.mode,invite.room_id),'참가 중인 다른 전투방에서 먼저 나와 주세요.',409);
   // A retry after a lost join response can acknowledge membership without joining twice.
   const fresh=await room(db,invite.mode,invite.room_id,invite.guild_id);
   if(!fresh?.members.some(m=>m.account===id)){
    requireCoop(await valid(db,invite,Date.now()),'이 전투방에는 더 이상 참가할 수 없어요.',409);
    const join={catalogVersion:game.CATALOG_VERSION,kind:'join',requestId:'coop_'+invite.id,roomId:invite.room_id,code:fresh.code};
    await (invite.mode==='yeti'?yeti:raids).request(request,env,join,accounts);
   }
   await db.prepare("UPDATE school_coop_invites SET status='accepted' WHERE id=? AND target=? AND status='pending'").bind(invite.id,id).run();
   return {joined:true,mode:invite.mode,roomId:invite.room_id};
  }finally{await db.prepare('DELETE FROM school_coop_accepts WHERE account_id=? AND invite_id=?').bind(id,invite.id).run();}
 }};
}
