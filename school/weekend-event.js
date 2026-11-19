/* Read-only, time-bound event banner. Rewards are calculated by the engine. */
(()=>{
 'use strict';
 const G=window.SchoolRPG,host=document.getElementById('lobby-panel');
 if(!G?.eventInfo||!host||document.getElementById('weekend-event'))return;
 const box=document.createElement('details');box.setAttribute('id','weekend-event');box.setAttribute('class','weekend-event');box.hidden=true;
 box.innerHTML='<summary><span class="weekend-event-seal" aria-hidden="true">×2</span><span><b>96시간 더블 보상</b><small>눈송이 · 코인 · 용병/단장 경험치</small></span><time></time></summary><div class="weekend-event-detail"><strong>플레이해서 얻는 보상이 2배!</strong><p>모험·던전·예티·길드전과 임무 보상에 적용돼요. 오프라인 보상은 이벤트 시간과 겹친 만큼 적용됩니다.</p><p>상점·교환·쿠폰·룰렛의 정해진 수량과 눈사람은 그대로예요.</p><small class="weekend-event-dates"></small></div>';
 host.append(box);const clock=box.querySelector('time'),dates=box.querySelector('.weekend-event-dates');
 const formatter=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
 let last='',timer=0,suspended=false;
 function stop(){if(timer)clearInterval(timer);timer=0;}
 function update(){
  const info=G.eventInfo(Date.now());box.hidden=!info.active;
  if(!info.active){box.open=false;if(!info.upcoming)stop();return info;}
  const minutes=Math.ceil(info.remainingMs/60000),h=Math.floor(minutes/60),m=minutes%60,text=`${h}시간 ${m}분 남음`;
  if(text!==last){clock.textContent=text;last=text;}
  clock.setAttribute('datetime',new Date(info.endsAt).toISOString());
  dates.textContent=`한국 시간 ${formatter.format(info.startsAt)} ~ ${formatter.format(info.endsAt)}`;
  return info;
 }
 function start(){
  stop();if(suspended)return;
  const info=update();
  if(!document.hidden&&(info.active||info.upcoming))timer=setInterval(update,15000);
 }
 document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
 window.addEventListener('pagehide',()=>{suspended=true;stop();});
 window.addEventListener('pageshow',()=>{suspended=false;start();});
 start();
})();
