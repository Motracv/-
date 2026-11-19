/* Screen lock only. Combat, account sync and dungeon settlement stay in client.js. */
window.SchoolAFK = (() => {
  'use strict';
  function create(ctx){
    const G=window.SchoolRPG,Art=window.SchoolArt;
    let dialog=null,canvas=null,paint=null,frame=0,lastDraw=0,scope='',started=0,gold=0,partyKey='',actors=[],wake=null,wakePending=false,hold=null,holdTimer=null,focusBefore=null,uiSecond=-1;
    const fmt=n=>Math.floor(n).toLocaleString('ko-KR');
    const text=(key,value)=>{const el=dialog?.querySelector(`[data-afk-${key}]`);if(el&&el.textContent!==String(value))el.textContent=String(value);};
    async function acquireWake(){
      if(!dialog||document.hidden||wake||wakePending||!navigator.wakeLock)return;
      wakePending=true;
      try{const token=await navigator.wakeLock.request('screen');if(!dialog||document.hidden)await token.release();else{wake=token;token.addEventListener('release',()=>{if(wake===token)wake=null;});}}
      catch{}finally{wakePending=false;}
    }
    function cancelHold(){hold=null;clearTimeout(holdTimer);holdTimer=null;const b=dialog?.querySelector('[data-afk-unlock]');b?.classList.remove('is-holding');}
    function close(){
      cancelHold();cancelAnimationFrame(frame);frame=0;
      if(!dialog)return;
      const old=dialog;dialog=null;old.close();old.remove();document.documentElement.classList.remove('afk-active');
      wake?.release().catch(()=>{});wake=null;actors=[];partyKey='';ctx.onClose();focusBefore?.focus?.({preventScroll:true});
    }
    function beginHold(source){
      if(hold||!dialog)return;hold=source;dialog.querySelector('[data-afk-unlock]').classList.add('is-holding');
      holdTimer=setTimeout(()=>{if(hold===source)close();},1200);
    }
    function rebuild(){
      const s=ctx.getState(),key=s.team.map(id=>id+':'+G.equippedSkin(s,id)).join('|');if(key===partyKey)return;partyKey=key;
      actors=s.team.map(id=>{
        const sheet=document.createElement('canvas');sheet.width=sheet.height=112;
        const c=sheet.getContext('2d');c.imageSmoothingEnabled=false;
        Art.hero(c,id,50,96,2,{time:0,reduced:true,skin:G.equippedSkin(s,id)});
        return {id,sheet};
      });
    }
    function draw(now){
      frame=requestAnimationFrame(draw);if(!dialog||document.hidden||now-lastDraw<1000/12)return;lastDraw=now;
      if(ctx.reduced()&&dialog.dataset.painted==='true')return;
      rebuild();const c=paint,w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;
      const t=ctx.reduced()?0:now/1000;
      c.fillStyle='#16232d';c.fillRect(0,h-29,w,2);
      for(let i=0;i<12;i++){c.fillStyle='#27343d';c.fillRect(((i*71-t*45)%w+w)%w,h-18+(i%2)*6,16,2);}
      const gap=Math.min(108,(w-30)/Math.max(1,actors.length)),begin=(w-gap*actors.length)/2;
      actors.forEach(({id,sheet},i)=>{
        const phase=t*11-i*.9,stride=ctx.reduced()?0:Math.sin(phase)*5,bob=ctx.reduced()?0:Math.abs(Math.cos(phase))*3;
        c.save();c.translate(begin+i*gap+gap/2-50,9-bob);c.drawImage(sheet,0,0,112,82,0,0,112,82);
        // Alternate the lower leg sections while the torso stays readable.
        c.drawImage(sheet,0,82,54,30,-stride,82,54,30);c.drawImage(sheet,54,82,58,30,54+stride,82,58,30);c.restore();
        c.font='12px sans-serif';c.textAlign='center';c.fillStyle='#92a6b2';c.fillText(G.BY_ID[id].name,begin+i*gap+gap/2,h-3);
      });dialog.dataset.painted='true';
    }
    function tick(){
      if(!dialog)return;if(scope!==ctx.scope()){close();return;}
      const second=Math.floor((performance.now()-started)/1000);if(second===uiSecond)return;uiSecond=second;
      const s=ctx.getState(),a=s.activities?.run;
      text('time',`${String(Math.floor(second/3600)).padStart(2,'0')}:${String(Math.floor(second%3600/60)).padStart(2,'0')}:${String(second%60).padStart(2,'0')}`);
      text('gold',fmt(ctx.balance().gold));text('gain',`+${fmt(Math.max(0,ctx.balance().gold-gold))}`);
      text('stage',a&&!a.settled?(a.kind==='tower'?`뫼비우스 ${fmt(a.floor)}층`:'던전 도전 중'):a?.settled?(a.won?'도전 완료 · 보상 저장 확인 중':'도전 종료'):G.stageName(s.stage)+' · 모험');
      const auto=document.getElementById('tower-auto-notice');text('status',!ctx.connected()?'연결 확인 중 · 화면을 열어 저장 상태를 확인해 주세요.':auto?.textContent||'전투와 보상 저장이 계속 진행되고 있어요.');
      if(!ctx.reduced())delete dialog.dataset.painted;
    }
    function open(){
      if(dialog)return;
      if(!ctx.canOpen())return ctx.toast('진행 중인 안내·협동 전투·모집 연출을 마친 뒤 잠수모드를 켜 주세요.');
      focusBefore=document.activeElement;scope=ctx.scope();started=performance.now();gold=ctx.balance().gold;uiSecond=-1;
      dialog=document.createElement('dialog');dialog.id='school-afk';dialog.className='school-afk';dialog.setAttribute('aria-labelledby','afk-heading');ctx.prepare();
      dialog.innerHTML='<div class="afk-content"><span class="afk-moon" aria-hidden="true">☾</span><h2 id="afk-heading">잠수모드</h2><p class="afk-caption">잠깐 쉬어도, 모험은 계속</p><b class="afk-clock" data-afk-time>00:00:00</b><div class="afk-road"><span class="piyu-sprite piyu-walk" role="img" aria-label="콩이를 안고 걷는 삐유"></span><canvas width="700" height="136" aria-label="출전 용병들의 달리기 애니메이션"></canvas></div><div class="afk-summary"><span>현재 지역<b data-afk-stage></b></span><span>보유 골드<b data-afk-gold></b></span><span>잠수 중 획득<b data-afk-gain></b></span></div><p class="afk-status" data-afk-status role="status"></p><button type="button" class="afk-unlock" data-afk-unlock><span>길게 눌러 잠금 해제</span><small>1.2초 · 키보드는 Enter 또는 Space 길게</small></button><p class="afk-note">화면을 켜 둔 상태에서 사용해 주세요.<br>다른 앱으로 이동하거나 기기를 잠그면 기존 방치 보상 규칙이 적용돼요.</p></div>';
      document.body.append(dialog);dialog.showModal();document.documentElement.classList.add('afk-active');canvas=dialog.querySelector('canvas');paint=canvas.getContext('2d');
      const button=dialog.querySelector('[data-afk-unlock]');button.focus();
      button.addEventListener('pointerdown',e=>{if(e.button!==0||e.isPrimary===false)return;e.preventDefault();button.setPointerCapture?.(e.pointerId);beginHold('pointer');});
      for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,cancelHold);
      button.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();if(!e.repeat)beginHold('key:'+e.key);}});
      button.addEventListener('keyup',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();cancelHold();}});
      button.addEventListener('blur',cancelHold);dialog.addEventListener('cancel',e=>{e.preventDefault();cancelHold();});
      dialog.addEventListener('keydown',e=>e.stopPropagation());acquireWake();tick();frame=requestAnimationFrame(draw);
    }
    document.addEventListener('visibilitychange',()=>{cancelHold();if(document.hidden){wake?.release().catch(()=>{});wake=null;}else acquireWake();});
    window.addEventListener('blur',cancelHold);window.addEventListener('pagehide',close);
    return {open,close,tick,get active(){return !!dialog;}};
  }
  return {create};
})();
