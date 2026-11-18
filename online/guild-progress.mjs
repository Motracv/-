// All progress originates in a successful attendance or raid transaction.
export const GUILD_PROJECTS = Object.freeze([
 {id:'attendance',name:'함께 채우는 출석부',goal:10,gems:50,gold:5000,stars:2,icon:'calendar',desc:'단원들의 출석을 합해 10회 달성'},
 {id:'coop',name:'나란히 벌룬에 도전',goal:5,gems:80,gold:8000,stars:3,icon:'chain',desc:'2명 이상이 피해를 준 협동 전투 5회 완료'},
 {id:'damage',name:'우리 반의 한 방',goal:3000000,gems:120,gold:12000,stars:5,icon:'spark',desc:'벌룬에게 길드 누적 피해 300만 달성'}
]);
export const GUILD_DECOR = Object.freeze({
 themes:[{id:'dawn',name:'햇살 교실'},{id:'moon',name:'달빛 교실'},{id:'winter',name:'겨울 교실'}],
 rugs:[{id:'teal',name:'청록 러그'},{id:'rose',name:'장미 러그'},{id:'night',name:'별빛 러그'}],
 furniture:[{id:'plants',name:'초록 화분',stars:0},{id:'books',name:'마법 서가',stars:0},{id:'trophy',name:'협동의 트로피',stars:5}]
});
export async function guildProjects(db,game,gid,account,now){
 const week=game.week(now);
 const totals=await db.prepare(`SELECT COUNT(CASE WHEN kind='attendance' THEN 1 END) AS attendance,
 COUNT(DISTINCT CASE WHEN kind='raid' AND coop=1 THEN reference END) AS coop,
 COALESCE(SUM(CASE WHEN kind='raid' THEN amount ELSE 0 END),0) AS damage
 FROM school_guild_activity WHERE guild_id=? AND week=?`).bind(gid,week).first();
 const done=(await db.prepare('SELECT quest_id FROM school_guild_projects WHERE guild_id=? AND week=?').bind(gid,week).all()).results||[];
 const claimed=(await db.prepare('SELECT quest_id FROM school_guild_project_claims WHERE account_id=? AND week=?').bind(account,week).all()).results||[];
 const contributor=await db.prepare(`SELECT 1 AS yes FROM school_guild_activity a JOIN school_guild_members m ON m.account_id=a.account_id AND m.guild_id=a.guild_id
 WHERE a.guild_id=? AND a.account_id=? AND a.week=? AND a.created_at>=m.joined_at LIMIT 1`).bind(gid,account,week).first();
 const earned=await db.prepare('SELECT COALESCE(SUM(stars),0) AS stars FROM school_guild_projects WHERE guild_id=?').bind(gid).first();
 const room=await db.prepare('SELECT theme,rug,furniture,revision FROM school_guild_rooms WHERE guild_id=?').bind(gid).first();
 return{week,resetsAt:((week+1)*7-3)*86400000-9*3600000,eligible:!!contributor,stars:earned.stars,
  quests:GUILD_PROJECTS.map(q=>({...q,value:Math.min(q.goal,done.some(d=>d.quest_id===q.id)?q.goal:totals[q.id]||0),complete:done.some(d=>d.quest_id===q.id),claimed:claimed.some(c=>c.quest_id===q.id)})),
  room:room||{theme:'dawn',rug:'teal',furniture:'plants',revision:0},choices:GUILD_DECOR};
}
export function guildActivity(db,{key,gid,account,week,kind,reference,amount=1,coop=0,at,condition,bindings=[]}){
 return db.prepare(`INSERT OR IGNORE INTO school_guild_activity(event_key,guild_id,account_id,week,kind,reference,amount,coop,created_at)
 SELECT ?,?,?,?,?,?,?,?,? WHERE ${condition}`).bind(key,gid,account,week,kind,reference,amount,coop,at,...bindings);
}
export async function guildProjectClaim(db,game,id,action,now){
 const q=GUILD_PROJECTS.find(q=>q.id===action.questId),week=game.week(now);
 const fail=(ok,msg)=>{if(!ok)throw Object.assign(new Error(msg),{status:400});};
 fail(q&&action.week===week,'이번 주 협동 퀘스트를 확인해 주세요.');
 const member=await db.prepare('SELECT guild_id,membership_key FROM school_guild_members WHERE account_id=?').bind(id).first();
 fail(member&&member.guild_id===action.guildId,'현재 길드에서만 받을 수 있어요.');
 const p=await guildProjects(db,game,member.guild_id,id,now),quest=p.quests.find(a=>a.id===q.id);
 fail(quest.complete,'아직 길드 공동 목표를 달성하지 않았어요.');fail(p.eligible,'이번 주 현재 길드에서 출석 또는 보스전에 참여해 주세요.');fail(!quest.claimed,'이번 주 이 퀘스트 보상은 이미 받았어요.');
 return{...q,week,guildId:member.guild_id,memberKey:member.membership_key};
}
