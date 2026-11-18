import { guildProjects, GUILD_DECOR } from './guild-progress.mjs';
const guildFail=(ok,message,status=400)=>{if(!ok)throw Object.assign(new Error(message),{status});};
const guildUid=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
export function normalizeGuildName(raw){if(typeof raw!=='string'||raw.length>80||/[\p{C}<>]/u.test(raw))return null;const name=raw.normalize('NFKC').trim().replace(/\p{Zs}+/gu,' ');return Array.from(name).length>=3&&Array.from(name).length<=16&&/^[\p{L}\p{N} _-]+$/u.test(name)?name:null;}
export function createGuilds(game){
 const membership=(db,id)=>db.prepare('SELECT * FROM school_guild_members WHERE account_id=?').bind(id).first();
 async function state(db,id,now){
  const own=await membership(db,id),name=await db.prepare('SELECT display_name FROM school_names WHERE account_id=?').bind(id).first();
  const invites=(await db.prepare(`SELECT i.id,i.expires_at,g.name,g.emblem,(SELECT COUNT(*) FROM school_guild_members WHERE guild_id=g.id) AS size FROM school_guild_invites i JOIN school_guilds g ON g.id=i.guild_id WHERE i.target=? AND i.expires_at>? ORDER BY i.created_at DESC LIMIT 20`).bind(id,now).all()).results||[];
  const result={guild:null,invites:invites.map(i=>({id:i.id,name:i.name,emblem:i.emblem,size:i.size,expiresAt:i.expires_at})),canName:!name,limit:30,serverTime:now};
  if(!own)return result;
  const row=await db.prepare('SELECT id,name,emblem,notice,created_at FROM school_guilds WHERE id=?').bind(own.guild_id).first();if(!row)return result;
  const rows=(await db.prepare(`SELECT m.account_id,m.role,m.joined_at,m.membership_key,n.display_name,s.payload FROM school_guild_members m LEFT JOIN school_names n ON n.account_id=m.account_id JOIN school_saves s ON s.account_id=m.account_id WHERE m.guild_id=? ORDER BY m.role='leader' DESC,m.joined_at,m.account_id LIMIT 30`).bind(row.id).all()).results||[];
  const members=rows.map(r=>{let s;try{s=JSON.parse(r.payload);}catch{s={};}const valid=game.validate(s),p=valid?game.profileInfo(s):null;return{id:r.account_id,name:r.display_name||'단장',role:r.role,memberKey:r.membership_key,joinedAt:r.joined_at,isMe:r.account_id===id,level:valid?s.captain.level:1,power:valid?game.power(s):0,avatar:p?.avatar||'leader',hero:valid?s.team[0]:'taeo',title:p&&game.ownsProfileTitle(s,p.title)?p.title:''};});
  const today=game.day(now),claimed=await db.prepare('SELECT 1 AS yes FROM school_guild_attendance WHERE account_id=? AND day=?').bind(id,today).first();
  let outgoing=[];if(own.role==='leader')outgoing=(await db.prepare(`SELECT i.id,i.expires_at,n.display_name AS name FROM school_guild_invites i JOIN school_names n ON n.account_id=i.target WHERE i.guild_id=? AND i.expires_at>? ORDER BY i.created_at DESC LIMIT 60`).bind(row.id,now).all()).results||[];
  result.guild={id:row.id,name:row.name,emblem:row.emblem,notice:row.notice,createdAt:row.created_at,role:own.role,members,outgoing:outgoing.map(i=>({id:i.id,name:i.name,expiresAt:i.expires_at})),attendance:{gems:30,claimed:!!claimed,eligible:game.day(own.joined_at)<today,resetsAt:(today+1)*86400000-9*3600000},projects:await guildProjects(db,game,row.id,id,now)};return result;
 }
 return {async request(request,env,data,accounts){
  const now=Date.now(),signed=await accounts.identity(request,env,now);guildFail(signed,'길드는 Google 계정으로 로그인해 주세요.',401);guildFail(data.catalogVersion===game.CATALOG_VERSION,'게임이 업데이트됐어요. 새로고침해 주세요.',426);
  const db=env.DB,id=signed.id,kind=data.kind;
  guildFail(['state','create','invite','accept','decline','revoke','kick','leave','transfer','disband','decorate','furnish'].includes(kind),'지원하지 않는 길드 행동입니다.');
  if(kind==='state')return state(db,id,now);
  guildFail(typeof data.requestId==='string'&&/^[A-Za-z0-9_-]{16,80}$/.test(data.requestId),'요청 번호를 확인해 주세요.');
  const ownName=await db.prepare('SELECT display_name FROM school_names WHERE account_id=?').bind(id).first();guildFail(ownName,'먼저 프로필에서 단장 이름을 정해 주세요.',409);
  let own=await membership(db,id);
  try{
   if(kind==='create'){
    const key=id+':'+data.requestId,prior=await db.prepare('SELECT id FROM school_guilds WHERE creation_key=?').bind(key).first();if(prior)return state(db,id,now);
    guildFail(!own,'이미 길드에 가입되어 있어요.',409);const name=normalizeGuildName(data.name);guildFail(name,'길드 이름은 문자·숫자·공백·_·-로 3~16글자예요.');guildFail(Number.isInteger(data.emblem)&&data.emblem>=0&&data.emblem<=2,'길드 문장을 선택해 주세요.');
    const gid=guildUid();await db.batch([
     db.prepare(`INSERT INTO school_guilds(id,name_key,name,emblem,creation_key,created_at) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM school_guild_members WHERE account_id=?)`).bind(gid,name.toLocaleLowerCase('en-US'),name,data.emblem,key,now,id),
     db.prepare(`INSERT INTO school_guild_members(account_id,guild_id,role,joined_at,membership_key) SELECT ?,id,'leader',?,? FROM school_guilds WHERE id=? AND NOT EXISTS(SELECT 1 FROM school_guild_members WHERE account_id=?)`).bind(id,now,guildUid(),gid,id),
     db.prepare('DELETE FROM school_guild_invites WHERE target=? AND EXISTS(SELECT 1 FROM school_guild_members WHERE account_id=?)').bind(id,id)
    ]);guildFail(await membership(db,id),'다른 요청이 먼저 처리됐어요. 다시 확인해 주세요.',409);
   }else if(kind==='accept'||kind==='decline'){
    const invite=await db.prepare('SELECT * FROM school_guild_invites WHERE id=? AND target=?').bind(data.inviteId||'',id).first();
    if(!invite&&own)return state(db,id,now);guildFail(invite,'초대를 찾지 못했어요.',404);
    if(kind==='decline')await db.prepare('DELETE FROM school_guild_invites WHERE id=? AND target=?').bind(invite.id,id).run();
    else{guildFail(!own,'한 길드에만 가입할 수 있어요.',409);guildFail(invite.expires_at>now,'초대가 만료됐어요.',409);
     await db.batch([db.prepare(`INSERT INTO school_guild_members(account_id,guild_id,role,joined_at,membership_key) SELECT ?,guild_id,'member',?,? FROM school_guild_invites WHERE id=? AND target=? AND expires_at>? AND NOT EXISTS(SELECT 1 FROM school_guild_members WHERE account_id=?)`).bind(id,now,guildUid(),invite.id,id,now,id),db.prepare('DELETE FROM school_guild_invites WHERE target=? AND EXISTS(SELECT 1 FROM school_guild_members WHERE account_id=?)').bind(id,id)]);
     guildFail(await membership(db,id),'초대가 취소됐어요. 다시 확인해 주세요.',409);
    }
   }else{
    guildFail(own&&own.guild_id===data.guildId,'길드 정보가 바뀌었어요. 새로고침해 주세요.',409);
    if(kind==='leave'){
     const count=await db.prepare('SELECT COUNT(*) AS n FROM school_guild_members WHERE guild_id=?').bind(own.guild_id).first();guildFail(own.role!=='leader'||count.n===1,'길드장을 위임하거나 길드를 해산한 뒤 나갈 수 있어요.',409);
     await db.prepare(`DELETE FROM school_guild_members WHERE account_id=? AND guild_id=? AND (role='member' OR (SELECT COUNT(*) FROM school_guild_members WHERE guild_id=?)=1)`).bind(id,own.guild_id,own.guild_id).run();
    }else{
     guildFail(own.role==='leader','길드장만 할 수 있어요.',403);
     const leader=`EXISTS(SELECT 1 FROM school_guild_members WHERE account_id=? AND guild_id=? AND role='leader')`;
     if(kind==='invite'){
      const name=game.normalizeCommanderName(data.name);guildFail(name,'단장 이름을 정확히 입력해 주세요.');const target=await db.prepare('SELECT account_id FROM school_names WHERE name_key=?').bind(name.normalize('NFKC').toLocaleLowerCase('en-US')).first();guildFail(target,'이 단장을 찾지 못했어요.',404);guildFail(!await membership(db,target.account_id),'이미 길드에 가입한 단장이에요.',409);
      await db.prepare('DELETE FROM school_guild_invites WHERE expires_at<=?').bind(now).run();
      const existing=await db.prepare('SELECT id FROM school_guild_invites WHERE guild_id=? AND target=?').bind(own.guild_id,target.account_id).first();if(existing)return state(db,id,now);
      const inserted=await db.prepare(`INSERT OR IGNORE INTO school_guild_invites(id,guild_id,target,created_at,expires_at) SELECT ?,?,?,?,? WHERE ${leader} AND NOT EXISTS(SELECT 1 FROM school_guild_members WHERE account_id=?) AND (SELECT COUNT(*) FROM school_guild_members WHERE guild_id=?)<30 AND (SELECT COUNT(*) FROM school_guild_invites WHERE guild_id=?)<60 AND (SELECT COUNT(*) FROM school_guild_invites WHERE target=?)<20`).bind(guildUid(),own.guild_id,target.account_id,now,now+3*86400000,id,own.guild_id,target.account_id,own.guild_id,own.guild_id,target.account_id).run();guildFail(inserted.meta.changes,'길드 또는 초대 목록이 가득 찼어요.',409);
     }else if(kind==='revoke')await db.prepare(`DELETE FROM school_guild_invites WHERE id=? AND guild_id=? AND ${leader}`).bind(data.inviteId||'',own.guild_id,id,own.guild_id).run();
     else if(kind==='kick'){
      guildFail(data.memberId!==id,'본인은 강퇴할 수 없어요.');guildFail(typeof data.memberKey==='string','단원 정보를 새로고침해 주세요.');
      await db.prepare(`DELETE FROM school_guild_members WHERE account_id=? AND guild_id=? AND membership_key=? AND role='member' AND ${leader}`).bind(data.memberId||'',own.guild_id,data.memberKey,id,own.guild_id).run();
     }else if(kind==='transfer'){
      guildFail(data.memberId!==id,'다른 단원을 선택해 주세요.');
      const target=await db.prepare("SELECT account_id FROM school_guild_members WHERE account_id=? AND guild_id=? AND role='member' AND membership_key=?").bind(data.memberId||'',own.guild_id,data.memberKey).first();guildFail(target,'단원 정보를 새로고침해 주세요.',409);
      await db.batch([db.prepare(`UPDATE school_guild_members SET role='member' WHERE account_id=? AND guild_id=? AND role='leader' AND EXISTS(SELECT 1 FROM school_guild_members WHERE account_id=? AND guild_id=? AND membership_key=?)`).bind(id,own.guild_id,target.account_id,own.guild_id,data.memberKey),db.prepare(`UPDATE school_guild_members SET role='leader' WHERE account_id=? AND guild_id=? AND membership_key=? AND NOT EXISTS(SELECT 1 FROM school_guild_members WHERE guild_id=? AND role='leader')`).bind(target.account_id,own.guild_id,data.memberKey,own.guild_id)]);
     }else if(kind==='furnish'){
      const d=data.decor;guildFail(d&&GUILD_DECOR.themes.some(x=>x.id===d.theme)&&GUILD_DECOR.rugs.some(x=>x.id===d.rug)&&GUILD_DECOR.furniture.some(x=>x.id===d.furniture),'교실 장식을 다시 선택해 주세요.');
      guildFail(Number.isInteger(data.revision)&&data.revision>=0,'교실 정보를 다시 불러와 주세요.');
      const requestKey=id+':'+data.requestId,old=await db.prepare('SELECT revision,request_key FROM school_guild_rooms WHERE guild_id=?').bind(own.guild_id).first();
      if(old?.request_key===requestKey)return state(db,id,now);
      guildFail((old?.revision||0)===data.revision,'다른 교실 꾸미기가 먼저 저장됐어요. 새로고침해 주세요.',409);
      const cost=GUILD_DECOR.furniture.find(x=>x.id===d.furniture).stars;
      const written=await db.prepare(`INSERT INTO school_guild_rooms(guild_id,theme,rug,furniture,revision,request_key)
       SELECT ?,?,?,?,1,? WHERE ${leader} AND (SELECT COALESCE(SUM(stars),0) FROM school_guild_projects WHERE guild_id=?)>=?
       ON CONFLICT(guild_id) DO UPDATE SET theme=excluded.theme,rug=excluded.rug,furniture=excluded.furniture,revision=school_guild_rooms.revision+1,request_key=excluded.request_key WHERE school_guild_rooms.revision=?`)
       .bind(own.guild_id,d.theme,d.rug,d.furniture,requestKey,id,own.guild_id,own.guild_id,cost,data.revision).run();
      guildFail(written.meta.changes,'협동 별이 부족하거나 교실 정보가 변경됐어요. 새로고침해 주세요.',409);
     }else if(kind==='disband')await db.prepare(`DELETE FROM school_guilds WHERE id=? AND ${leader}`).bind(own.guild_id,id,own.guild_id).run();
     else if(kind==='decorate'){
      guildFail(Number.isInteger(data.emblem)&&data.emblem>=0&&data.emblem<=2,'길드 문장을 선택해 주세요.');guildFail(typeof data.notice==='string'&&Array.from(data.notice).length<=160&&!/[\p{C}]/u.test(data.notice),'공지사항은 한 줄로 160글자까지 입력해 주세요.');
      await db.prepare(`UPDATE school_guilds SET emblem=?,notice=? WHERE id=? AND ${leader}`).bind(data.emblem,data.notice.trim(),own.guild_id,id,own.guild_id).run();
     }
    }
   }
  }catch(error){if(error.status)throw error;if(/guild_full/.test(error.message))throw Object.assign(new Error('길드는 30명까지 가입할 수 있어요.'),{status:409});if(/UNIQUE constraint/.test(error.message))throw Object.assign(new Error('이미 사용 중인 길드 이름이거나 먼저 처리된 요청이에요. 목록을 확인해 주세요.'),{status:409});throw error;}
  return state(db,id,now);
 }};
}
