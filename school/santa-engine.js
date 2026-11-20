/* Solo Santa: deterministic battle; account action receipts own all currency changes. */
(function(root){'use strict';
const HP=600000,DURATION=150000,RECOMMENDED_LEVEL=90,TICKET_COST=50,SPECIAL_CHANCE=.03;
const NORMAL=[{label:'골드 10,000',type:'gold',amount:10000,chance:.35},{label:'눈송이 25',type:'snowflakes',amount:25,chance:.25},{label:'공용 SSR 조각 1',type:'shards',amount:1,chance:.15},{label:'보석 50',type:'gems',amount:50,chance:.2},{label:'보석 200',type:'gems',amount:200,chance:.05}];
const SPECIAL=[{label:'보석 100',type:'gems',amount:100,chance:.5},{label:'보석 300',type:'gems',amount:300,chance:.3},{label:'보석 1,000',type:'gems',amount:1000,chance:.15},{label:'보석 3,000',type:'gems',amount:3000,chance:.05}];
const GIFTS=[{id:'frost',name:'꽁꽁 선물',desc:'전열 2명 · 1.5초 빙결'},{id:'slow',name:'끈적 리본',desc:'전원 · 5초 공격 속도 30% 감소'},{id:'weak',name:'무거운 장난감',desc:'전원 · 5초 가하는 피해 30% 감소'},{id:'burn',name:'뜨거운 쿠키',desc:'전열 3명 · 4초 화상'}];
const requireValue=(v,m)=>{if(!v)throw Error(m);},count=n=>Number.isSafeInteger(n)&&n>=0;
function valid(w){return w===undefined||!!(w&&['coins','boxes','tickets','special','wins','spins'].every(k=>count(w[k]))&&(w.lastReward===undefined||typeof w.lastReward==='string'&&w.lastReward.length<150)&&(w.battle===null||w.battle&&w.battle.encounter==='santa'&&typeof w.battle.key==='string'&&w.battle.boss?.id==='santa'&&count(w.battle.boss.hp)&&w.battle.boss.hp<=HP&&w.battle.boss.max===HP&&typeof w.battle.ended==='boolean'&&Array.isArray(w.battle.teams)&&w.battle.teams.length===1&&Number.isFinite(w.battle.startedAt)&&Number.isFinite(w.battle.elapsed)&&w.battle.elapsed>=0&&w.battle.elapsed<=DURATION));}
function state(s){return s.santa||= {coins:0,boxes:0,tickets:0,special:0,wins:0,spins:0,battle:null};}
function bossAct({s,emit,hurt,living}){const b=s.boss;if(b.stunUntil>s.elapsed)return;
 if(b.cast&&s.elapsed>=b.cast.at){const id=b.cast.id;b.cast=null;emit('impact',{pattern:id});s.teams.forEach((t,ti)=>{for(const original of living(t).slice(0,id==='frost'?2:id==='burn'?3:6)){const u=hurt(ti,original,id==='frost'?.8:.55,id);if(!u||u.hp<=0)continue;if(id==='frost')u.stunUntil=s.elapsed+1500;else u['santa'+id]=s.elapsed+(id==='burn'?4000:5000);emit('santa-debuff',{team:ti,id:u.id,pattern:id,until:s.elapsed+(id==='frost'?1500:id==='burn'?4000:5000)});}});}
 if(!b.cast&&s.elapsed>=b.nextAt){const p=GIFTS[b.pattern++%GIFTS.length];b.cast={id:p.id,at:s.elapsed+1500};b.nextAt=s.elapsed+6500;emit('telegraph',{pattern:p.id,impactAt:b.cast.at});}
}
function advance(g,b,now){return root.SchoolRaidRules.advance(g,b,now,{physical:true,duration:DURATION,attack:520,rage:2.5,bossAct,rate:(u,t)=>u.santaslow>t?.7:1,damage:(u,t)=>u.santaweak>t?.7:1,tick:({s,hurt,living})=>{if(s.elapsed%1000===0)s.teams.forEach((team,ti)=>{for(const u of living(team))if(u.santaburn>s.elapsed)hurt(ti,u,.18,'burn-dot');});}});}
function action(g,s,input,now,rng){requireValue(['santa-leave','santa-tick'].includes(input.kind)||g.winterInfo(s,now).active,'겨울 이벤트 기간이 아닙니다.');const w=state(s),roll=()=>{const n=rng();requireValue(Number.isFinite(n)&&n>=0&&n<1,'추첨 값을 확인하세요.');return n;};
 if(['santa-tick','santa-leave'].includes(input.kind)&&w.battle)requireValue(input.battleKey===w.battle.key,'전투가 바뀌었어요. 현재 전투를 확인해 주세요.');
 const add=(obj,key,n)=>{requireValue(count((obj[key]||0)+n),'보유 수량 한도입니다.');obj[key]=(obj[key]||0)+n;};
 if(w.battle&&!w.battle.ended)advance(g,w.battle,now);
 if(w.battle?.ended&&!w.battle.settled){if(w.battle.outcome==='defeated'){add(w,'boxes',1);add(w,'wins',1);}w.battle.settled=true;}
 if(input.kind==='santa-start'){requireValue(!w.battle||w.battle.ended,'이미 산타 토벌이 진행 중입니다.');requireValue(s.team.length>0,'용병을 편성해 주세요.');w.battle=root.SchoolRaidRules.create(g,[{account:'solo',save:s}],now,Math.floor(roll()*4294967295),HP);w.battle.key=now+'-'+w.battle.seed;w.battle.encounter='santa';w.battle.boss.id='santa';w.battle.boss.max=HP;return{kind:input.kind};}
 if(input.kind==='santa-tick')return{kind:input.kind,outcome:w.battle?.outcome};
 if(input.kind==='santa-leave'){if(w.battle&&!w.battle.ended){w.battle.ended=true;w.battle.outcome='withdrawn';w.battle.settled=true;}return{kind:input.kind};}
 if(input.kind==='santa-box'){requireValue(w.boxes>0,'산타 선물상자가 없습니다.');const amount=1+Math.floor(roll()*100);add(w,'coins',amount);w.boxes--;w.lastReward='산타코인 +'+amount;return{kind:input.kind,amount};}
 if(input.kind==='santa-ticket'){requireValue(w.coins>=TICKET_COST,'산타코인 50개가 필요합니다.');add(w,'tickets',1);w.coins-=TICKET_COST;return{kind:input.kind};}
 if(input.kind==='santa-spin'){const special=input.special===true,key=special?'special':'tickets';requireValue(w[key]>0,'룰렛권이 없습니다.');requireValue(count(s.gold+10000)&&count(s.gems+3000)&&count((s.winter?.earned||0)+25)&&(s.shardExchange?.SSR||0)+1<=g.SHARD_LIMIT&&count(w.special+1)&&count(w.spins+1),'보상 보유 한도를 확인하세요.');const table=special?SPECIAL:NORMAL,n=roll();let sum=0,index=table.length-1;for(let i=0;i<table.length;i++){sum+=table[i].chance;if(n<sum){index=i;break;}}const prize=table[index],bonus=!special&&roll()<SPECIAL_CHANCE;
 if(prize.type==='snowflakes'){add(s.winter,'snowflakes',prize.amount);add(s.winter,'earned',prize.amount);}else if(prize.type==='shards'){s.shardExchange||={SR:0,SSR:0};add(s.shardExchange,'SSR',prize.amount);}else add(s,prize.type,prize.amount);w[key]--;w.spins++;if(bonus)w.special++;w.lastReward=prize.label+' 획득'+(bonus?' · 특별 룰렛권 +1':'');return{kind:input.kind,index,prize,special,bonus};}
 throw Error('지원하지 않는 산타 행동입니다.');
}
const api={HP,DURATION,RECOMMENDED_LEVEL,TICKET_COST,SPECIAL_CHANCE,NORMAL,SPECIAL,GIFTS,valid,state,advance,action};root.SchoolSantaRules=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
