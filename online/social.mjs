import { simulateArena } from './arena.mjs';
import { createSeasons, equippedSeasonCosmetic } from './seasons.mjs';

const fail = (condition,message,status=400) => { if(!condition)throw Object.assign(new Error(message),{status}); };
const uid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
export const nameKey = name => name.normalize('NFKC').toLocaleLowerCase('en-US');
const pairKey = (a,b) => [a,b].sort().join(':');

// Legacy custom names are reserved lazily. A collision keeps the old display
// name and permits a free replacement; no currency or progression is removed.
export async function ensureSchoolName(db,accountId,state,game,now) {
  let own=await db.prepare('SELECT name_key, display_name FROM school_names WHERE account_id = ?').bind(accountId).first();
  const normalized=game.normalizeCommanderName(state.commanderName);
  if(!own&&normalized&&normalized!=='새내기 단장'){
    await db.prepare('INSERT OR IGNORE INTO school_names(account_id,name_key,display_name,created_at) SELECT id,?,?,? FROM accounts WHERE id = ?')
      .bind(nameKey(normalized),normalized,now,accountId).run();
    own=await db.prepare('SELECT name_key, display_name FROM school_names WHERE account_id = ?').bind(accountId).first();
  }
  state.nameNeedsClaim=!own;
  if(!own)state.nameChanges=0;
  return own;
}

export function createSocial(game) {
  const seasons = createSeasons(game);
  async function saved(db,id){
    const row=await db.prepare('SELECT payload FROM school_saves WHERE account_id = ?').bind(id).first();
    fail(row,'먼저 용병단을 생성해 주세요.',409);
    const value=JSON.parse(row.payload);fail(game.validate(value),'저장 정보를 확인해 주세요.',409);return value;
  }
  async function rating(db,id){
    const row=await db.prepare("SELECT COALESCE(SUM(CASE WHEN CAST(json_extract(payload,'$.winner') AS INTEGER) = -1 THEN 0 WHEN (challenger = ? AND CAST(json_extract(payload,'$.winner') AS INTEGER) = 0) OR (target = ? AND CAST(json_extract(payload,'$.winner') AS INTEGER) = 1) THEN 10 ELSE -5 END),0) AS points FROM school_arena WHERE status = 'done' AND (challenger = ? OR target = ?)").bind(id,id,id,id).first();
    return Math.max(0,1000+(row?.points||0));
  }
  async function state(db,id,now){
    const ownSave=await saved(db,id), name=await ensureSchoolName(db,id,ownSave,game,now);
    const rows=(await db.prepare(`SELECT f.*, n.display_name AS name,
      json_object('team',json_extract(s.payload,'$.team'),'units',json_extract(s.payload,'$.units'),'captain',json_extract(s.payload,'$.captain')) AS save,
      (SELECT MAX(0,1000+COALESCE(SUM(CASE WHEN CAST(json_extract(a.payload,'$.winner') AS INTEGER) = -1 THEN 0 WHEN (a.challenger = n.account_id AND CAST(json_extract(a.payload,'$.winner') AS INTEGER) = 0) OR (a.target = n.account_id AND CAST(json_extract(a.payload,'$.winner') AS INTEGER) = 1) THEN 10 ELSE -5 END),0)) FROM school_arena a WHERE a.status = 'done' AND (a.challenger = n.account_id OR a.target = n.account_id)) AS rating
      FROM school_friends f
      JOIN school_names n ON n.account_id = CASE WHEN f.requester = ? THEN f.target ELSE f.requester END
      JOIN school_saves s ON s.account_id = n.account_id WHERE f.requester = ? OR f.target = ? ORDER BY f.created_at DESC LIMIT 100`).bind(id,id,id).all()).results||[];
    const friends=[],incoming=[],outgoing=[];
    for(const row of rows){
      if(row.status==='accepted'){
        const other=JSON.parse(row.save);friends.push({id:row.id,name:row.name,level:other.captain.level,power:game.power(other),rating:row.rating});
      }else(row.target===id?incoming:outgoing).push({id:row.id,name:row.name,createdAt:row.created_at});
    }
    const arena=(await db.prepare(`SELECT a.id,a.challenger,a.target,a.status,a.created_at,a.expires_at,json_extract(a.payload,'$.winner') AS winner,n.display_name AS name
      FROM school_arena a JOIN school_names n ON n.account_id = CASE WHEN a.challenger = ? THEN a.target ELSE a.challenger END
      WHERE (a.challenger = ? OR a.target = ?) AND (a.status = 'done' OR (a.status = 'pending' AND a.expires_at > ?)) ORDER BY a.created_at DESC LIMIT 30`).bind(id,id,id,now).all()).results||[];
    const invites={incoming:[],outgoing:[]},matches=[];
    for(const row of arena){if(row.status==='pending')(row.target===id?invites.incoming:invites.outgoing).push({id:row.id,name:row.name,expiresAt:row.expires_at});
      else{const side=row.challenger===id?0:1;matches.push({id:row.id,opponent:row.name,result:row.winner===-1?'draw':row.winner===side?'win':'loss',createdAt:row.created_at});}}
    return {me:{name:name?.display_name||ownSave.commanderName,canName:!name,renameCost:name?3000:0,rating:await rating(db,id),cosmetic:await equippedSeasonCosmetic(db,id)},friends,requests:{incoming,outgoing},invites,matches,serverTime:now};
  }
  function matchView(row,id){const match=JSON.parse(row.payload),meSide=row.challenger===id?0:1;return {...match,id:row.id,createdAt:row.created_at,meSide,ratingChange:match.winner===-1?0:match.winner===meSide?10:-5};}
  return {async request(request,env,data,accounts){
    if(typeof data.kind==='string'&&data.kind.startsWith('season_'))return seasons.request(request,env,data,accounts);
    const now=Date.now(),signed=await accounts.identity(request,env,now);fail(signed,'친구와 아레나는 Google 계정으로 로그인해 주세요.',401);
    fail(data.catalogVersion===game.CATALOG_VERSION,'게임이 업데이트되었습니다. 새로고침해 주세요.',426);
    const db=env.DB,id=signed.id,kind=data.kind;
    fail(['state','friend_request','friend_accept','friend_decline','friend_remove','arena_invite','arena_accept','arena_decline','arena_match'].includes(kind),'지원하지 않는 소셜 행동입니다.');
    if(kind==='state')return state(db,id,now);
    if(kind==='arena_match'){
      const row=await db.prepare("SELECT * FROM school_arena WHERE id = ? AND status = 'done' AND (challenger = ? OR target = ?)").bind(data.id||'',id,id).first();
      fail(row,'이 대전 기록을 볼 수 없습니다.',404);return {match:matchView(row,id)};
    }
    const ownSave=await saved(db,id),own=await ensureSchoolName(db,id,ownSave,game,now);fail(own,'먼저 중복되지 않는 단장 이름을 정해 주세요.',409);
    if(kind==='friend_request'){
      const name=game.normalizeCommanderName(data.name);fail(name,'단장 이름을 정확히 입력해 주세요.');
      const target=await db.prepare('SELECT account_id FROM school_names WHERE name_key = ?').bind(nameKey(name)).first();
      fail(target,'이 이름의 단장을 찾지 못했어요.');fail(target.account_id!==id,'자신에게 친구 요청을 보낼 수 없어요.');
      const count=await db.prepare('SELECT COUNT(*) AS n FROM school_friends WHERE requester = ? OR target = ?').bind(id,id).first();fail(count.n<100,'친구와 대기 중인 요청은 합쳐서 100명까지 가능합니다.');
      const targetCount=await db.prepare('SELECT COUNT(*) AS n FROM school_friends WHERE requester = ? OR target = ?').bind(target.account_id,target.account_id).first();fail(targetCount.n<100,'상대방의 친구 목록이 가득 찼어요.');
      await db.prepare("INSERT OR IGNORE INTO school_friends(id,pair_key,requester,target,status,created_at) SELECT ?,?,?,?,'pending',? WHERE (SELECT COUNT(*) FROM school_friends WHERE requester = ? OR target = ?) < 100 AND (SELECT COUNT(*) FROM school_friends WHERE requester = ? OR target = ?) < 100").bind(uid(),pairKey(id,target.account_id),id,target.account_id,now,id,id,target.account_id,target.account_id).run();
    }else if(kind.startsWith('friend_')){
      const row=await db.prepare('SELECT * FROM school_friends WHERE id = ? AND (requester = ? OR target = ?)').bind(data.id||'',id,id).first();fail(row,'친구 요청을 찾지 못했어요.',404);
      if(kind==='friend_accept'){fail(row.target===id,'받은 친구 요청만 수락할 수 있어요.',403);await db.prepare("UPDATE school_friends SET status = 'accepted' WHERE id = ? AND target = ? AND status = 'pending'").bind(row.id,id).run();}
      else if(kind==='friend_decline'){fail(row.status==='pending','대기 중인 요청만 취소할 수 있어요.');await db.prepare("DELETE FROM school_friends WHERE id = ? AND status = 'pending'").bind(row.id).run();}
      else {fail(row.status==='accepted','친구 목록을 확인해 주세요.');await db.batch([db.prepare('DELETE FROM school_friends WHERE id = ?').bind(row.id),db.prepare("UPDATE school_arena SET status = 'declined' WHERE status = 'pending' AND ((challenger = ? AND target = ?) OR (challenger = ? AND target = ?))").bind(row.requester,row.target,row.target,row.requester)]);}
    }else if(kind==='arena_invite'){
      fail(typeof data.requestId==='string'&&/^[A-Za-z0-9_-]{16,80}$/.test(data.requestId),'대전 요청 번호를 확인해 주세요.');
      const repeated=await db.prepare('SELECT id FROM school_arena WHERE request_key = ?').bind(id+':'+data.requestId).first();if(repeated)return state(db,id,now);
      const friend=await db.prepare("SELECT * FROM school_friends WHERE id = ? AND status = 'accepted' AND (requester = ? OR target = ?)").bind(data.id||'',id,id).first();fail(friend,'친구가 된 단장만 초대할 수 있어요.',403);
      const target=friend.requester===id?friend.target:friend.requester;
      const recent=await db.prepare('SELECT COUNT(*) AS n FROM school_arena WHERE challenger = ? AND created_at > ?').bind(id,now-60000).first();fail(recent.n<5,'초대가 많아요. 잠시 후 다시 시도해 주세요.',429);
      const waiting=await db.prepare("SELECT id FROM school_arena WHERE status = 'pending' AND expires_at > ? AND ((challenger = ? AND target = ?) OR (challenger = ? AND target = ?)) LIMIT 1").bind(now,id,target,target,id).first();fail(!waiting,'이미 대기 중인 초대가 있어요.');
      const inserted=await db.prepare("INSERT OR IGNORE INTO school_arena(id,challenger,target,status,request_key,created_at,expires_at) SELECT ?,?,?,'pending',?,?,? WHERE NOT EXISTS (SELECT 1 FROM school_arena WHERE status='pending' AND expires_at > ? AND ((challenger = ? AND target = ?) OR (challenger = ? AND target = ?))) AND (SELECT COUNT(*) FROM school_arena WHERE challenger = ? AND created_at > ?) < 5")
        .bind(uid(),id,target,id+':'+data.requestId,now,now+120000,now,id,target,target,id,id,now-60000).run();
      if(!inserted.meta.changes){const duplicate=await db.prepare('SELECT id FROM school_arena WHERE request_key = ?').bind(id+':'+data.requestId).first();fail(duplicate,'다른 초대가 먼저 처리됐어요. 목록을 새로고침해 주세요.',409);}
    }else{
      let row=await db.prepare('SELECT * FROM school_arena WHERE id = ? AND (challenger = ? OR target = ?)').bind(data.id||'',id,id).first();fail(row,'초대를 찾지 못했어요.',404);
      if(kind==='arena_decline'){fail(row.status==='pending','이미 처리한 초대입니다.');await db.prepare("UPDATE school_arena SET status = 'declined' WHERE id = ? AND status = 'pending'").bind(row.id).run();}
      else{
        fail(row.target===id,'받은 대전 초대만 수락할 수 있어요.',403);
        if(row.status==='done')return {...await state(db,id,now),match:matchView(row,id)};
        fail(row.status==='pending'&&row.expires_at>now,'대전 초대가 만료되었어요.',409);
        const friend=await db.prepare("SELECT id FROM school_friends WHERE pair_key = ? AND status = 'accepted'").bind(pairKey(row.challenger,row.target)).first();fail(friend,'친구 관계가 변경되어 초대가 취소됐어요.',409);
        const saves=await Promise.all([saved(db,row.challenger),saved(db,row.target)]);
        const nameRows=await Promise.all([db.prepare('SELECT display_name FROM school_names WHERE account_id = ?').bind(row.challenger).first(),db.prepare('SELECT display_name FROM school_names WHERE account_id = ?').bind(row.target).first()]);fail(nameRows.every(Boolean),'단장 이름이 변경되었어요. 다시 초대해 주세요.',409);
        const match=simulateArena(game,saves,nameRows.map(n=>n.display_name),crypto.getRandomValues(new Uint32Array(1))[0]);
        await db.prepare("UPDATE school_arena SET status = 'done',payload = ? WHERE id = ? AND status = 'pending' AND expires_at > ? AND EXISTS (SELECT 1 FROM school_friends WHERE pair_key = ? AND status = 'accepted')")
          .bind(JSON.stringify(match),row.id,Date.now(),pairKey(row.challenger,row.target)).run();
        row=await db.prepare('SELECT * FROM school_arena WHERE id = ?').bind(row.id).first();fail(row?.status==='done','초대가 변경되었어요. 다시 확인해 주세요.',409);
        return {...await state(db,id,now),match:matchView(row,id)};
      }
    }
    return state(db,id,now);
  }};
}
