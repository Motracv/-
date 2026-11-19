// Public campus conversations. Text is never interpreted as HTML.
const communityCheck=(ok,message,status=400)=>{if(!ok)throw Object.assign(new Error(message),{status});};
const communityText=(value,max,multiline=false)=>{
 communityCheck(typeof value==='string'&&value.length<=max*4,'입력 내용을 확인해 주세요.');
 const text=value.normalize('NFC').trim();
 communityCheck(text.length>0&&Array.from(text).length<=max&&!(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))&&(multiline||!/[\r\n]/.test(text)),`${max}글자 이내로 입력해 주세요.`);return text;
};
export function createCommunity(game){
 const select=`SELECT e.id,e.kind,e.parent_id AS parentId,e.title,e.body,e.created_at AS createdAt,e.account_id AS author,n.display_name AS name FROM school_community_entries e JOIN school_names n ON n.account_id=e.account_id`;
 const view=(row,id)=>({...row,mine:row.author===id});
 return {async request(request,env,data,accounts){
  const now=Date.now(),signed=await accounts.identity(request,env,now);
  communityCheck(signed,'Google 계정으로 로그인해 주세요.',401);
  communityCheck(!signed.isTest,'운영 테스트 계정은 공개 커뮤니티에 참여하지 않습니다.',403);
  communityCheck(data.catalogVersion===game.CATALOG_VERSION,'게임이 업데이트됐어요. 새로고침해 주세요.',426);
  const db=env.DB,id=signed.id,kind=data.kind;
  communityCheck(['chat','posts','post','publish','delete','report'].includes(kind),'지원하지 않는 게시판 요청입니다.');
  if(kind==='chat'){
   const rows=(await db.prepare(`${select} WHERE e.kind='chat' AND e.deleted=0 ORDER BY e.id DESC LIMIT 50`).all()).results||[];
   return {entries:rows.reverse().map(r=>view(r,id)),serverTime:now};
  }
  if(kind==='posts'){
   const before=Number.isSafeInteger(data.before)&&data.before>0?data.before:Number.MAX_SAFE_INTEGER;
   const rows=(await db.prepare(`${select} WHERE e.kind='post' AND e.deleted=0 AND e.id<? ORDER BY e.id DESC LIMIT 13`).bind(before).all()).results||[];
   const more=rows.length>12,entries=rows.slice(0,12);
   return {entries:entries.map(r=>view(r,id)),next:more?entries.at(-1).id:null};
  }
  if(kind==='post'){
   communityCheck(Number.isSafeInteger(data.id)&&data.id>0,'글 번호를 확인해 주세요.');
   const post=await db.prepare(`${select} WHERE e.id=? AND e.kind='post' AND e.deleted=0`).bind(data.id).first();communityCheck(post,'삭제되었거나 찾을 수 없는 글이에요.',404);
   const after=Number.isSafeInteger(data.after)&&data.after>=0?data.after:0;
   const rows=(await db.prepare(`${select} WHERE e.parent_id=? AND e.kind='comment' AND e.deleted=0 AND e.id>? ORDER BY e.id LIMIT 51`).bind(data.id,after).all()).results||[];
   return {post:view(post,id),comments:rows.slice(0,50).map(r=>view(r,id)),next:rows.length>50?rows[49].id:null};
  }
  communityCheck(typeof data.requestId==='string'&&/^[A-Za-z0-9_-]{16,80}$/.test(data.requestId),'요청 번호를 확인해 주세요.');
  const name=await db.prepare('SELECT display_name FROM school_names WHERE account_id=?').bind(id).first();communityCheck(name,'스토리에서 단장 이름을 먼저 정해 주세요.',409);
  if(kind==='publish'){
   const type=data.type;communityCheck(['chat','post','comment'].includes(type),'글 종류를 확인해 주세요.');
   const key=id+':'+data.requestId,prior=await db.prepare('SELECT id,kind,parent_id FROM school_community_entries WHERE request_key=?').bind(key).first();
   if(prior)return {entryId:prior.id,parentId:prior.parent_id,type:prior.kind};
   const body=communityText(data.body,type==='post'?2000:type==='comment'?400:200,type!=='chat'),title=type==='post'?communityText(data.title,60):'';
   const parent=type==='comment'?data.parentId:null;
   if(type==='comment'){communityCheck(Number.isSafeInteger(parent)&&parent>0,'댓글을 남길 글을 선택해 주세요.');communityCheck(await db.prepare("SELECT id FROM school_community_entries WHERE id=? AND kind='post' AND deleted=0").bind(parent).first(),'삭제되었거나 찾을 수 없는 글이에요.',404);}
   const gap=type==='post'?30000:type==='chat'?1500:3000;
   await db.prepare(`INSERT OR IGNORE INTO school_community_entries(kind,parent_id,account_id,request_key,title,body,created_at,deleted) SELECT ?,?,?,?,?,?,?,0 WHERE NOT EXISTS(SELECT 1 FROM school_community_entries WHERE account_id=? AND kind=? AND created_at>?) AND (? IS NULL OR EXISTS(SELECT 1 FROM school_community_entries WHERE id=? AND kind='post' AND deleted=0))`).bind(type,parent,id,key,title,body,now,id,type,now-gap,parent,parent).run();
   const row=await db.prepare('SELECT id FROM school_community_entries WHERE request_key=?').bind(key).first();
   communityCheck(row,`잠시 뒤 다시 작성해 주세요. ${type==='post'?'글은 30초':'대화·댓글은 잠깐'} 간격을 두고 보낼 수 있어요.`,429);
   return {entryId:row.id,parentId:parent,type};
  }
  communityCheck(Number.isSafeInteger(data.id)&&data.id>0,'글 번호를 확인해 주세요.');
  const target=await db.prepare('SELECT id,account_id,deleted FROM school_community_entries WHERE id=?').bind(data.id).first();communityCheck(target,'글을 찾을 수 없어요.',404);
  if(kind==='delete'){
   communityCheck(target.account_id===id,'직접 작성한 글만 지울 수 있어요.',403);
   await db.prepare("UPDATE school_community_entries SET deleted=1,body='',title='' WHERE id=? AND account_id=?").bind(data.id,id).run();return {deleted:true};
  }
  communityCheck(target.account_id!==id&&!target.deleted,'신고할 수 없는 글이에요.');
  const reason=communityText(data.reason,200);
  const existing=await db.prepare('SELECT 1 AS yes FROM school_community_reports WHERE entry_id=? AND account_id=?').bind(data.id,id).first();if(existing)return {reported:true};
  const count=await db.prepare('SELECT COUNT(*) AS n FROM school_community_reports WHERE account_id=? AND created_at>?').bind(id,now-86400000).first();communityCheck(count.n<20,'오늘 신고 가능한 횟수를 모두 사용했어요.',429);
  const report=await db.prepare('INSERT OR IGNORE INTO school_community_reports(entry_id,account_id,reason,created_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM school_community_reports WHERE account_id=? AND created_at>?)<20').bind(data.id,id,reason,now,id,now-86400000).run();communityCheck(report.meta.changes||await db.prepare('SELECT 1 AS yes FROM school_community_reports WHERE entry_id=? AND account_id=?').bind(data.id,id).first(),'오늘 신고 가능한 횟수를 모두 사용했어요.',429);return {reported:true};
 }};
}
