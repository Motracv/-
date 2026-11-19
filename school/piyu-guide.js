/* Piyu's introduction. Spending and progress use the confirmed action pipeline. */
window.SchoolPiyuGuide = (() => {
  'use strict';
  const SCENES = [
    {title:'평범했던 방과 후',speaker:'그날, 학교',text:'마지막 수업이 끝날 무렵, 하늘에 유리처럼 금이 갔다. 갈라진 틈에서 낯선 괴물들이 떨어지기 시작했다.',scene:'rift'},
    {title:'학교에 남은 사람',speaker:'당신',text:'교실 창문이 흔들리고 운동장에 비명이 울렸다. 아직 학교 안에는 학생들이 남아 있다. 도망칠 길을 찾기도 전에, 괴물들이 정문을 넘어왔다.',scene:'attack'},
    {title:'작은 정령의 손길',speaker:'삐유',text:'이쪽이야! 나는 삐유, 학교의 정령이야. 무서워도 혼자 싸우지 마. 우리, 함께 학교를 지키자!',scene:'piyu'},
    {title:'갈라진 세계, 이어진 동료',speaker:'삐유',text:'여러 세계의 차원문이 한꺼번에 금이 갔어. 괴물들만 넘어오는 건 아니야. 다른 세계의 학생들도 도와주려고 해. 네가 단장이 되어 모두를 이끌어 줘!',scene:'portal'}
  ];
  function create(ctx) {
    let scope='',step=8,active=false,replay=false,writing=false,story=null,card=null,focusBefore=null,marked=null,pendingAdvance=null;
    const $=id=>document.getElementById(id);
    const mascot='<span class="piyu-sprite" role="img" aria-label="병아리 콩이를 안고 있는 정령 삐유"></span>';
    const illustration='<img class="piyu-illustration" src="school/assets/piyu/illustration.png?v=piyu1" alt="삐유와 콩이">';
    const registered=()=>!ctx.getState().nameNeedsClaim&&ctx.getState().commanderName!=='새내기 단장';
    const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function clearMark(){marked?.classList.remove('piyu-target');marked=null;}
    function cleanup(){clearMark();if(story){story.close();story.remove();story=null;}card?.remove();card=null;}
    function close(){cleanup();active=false;pendingAdvance=null;focusBefore?.focus?.({preventScroll:true});}
    function mark(id){clearMark();marked=$(id);marked?.classList.add('piyu-target');}
    async function move(next) {
      if(writing||ctx.blocked())return;
      if(next>=5&&!registered())next=4;
      const currentScope=scope;writing=true;
      try{
        if(!replay){
          await ctx.dispatch({kind:'onboarding',step:next});
          if(currentScope!==ctx.scope())return;
          if((ctx.getState().onboarding?.step??-1)<next){ctx.toast('안내 진행을 저장하지 못했어요. 연결 후 다시 눌러 주세요.');return;}
        }
        step=next;pendingAdvance=null;if(step>=8)close();else show();
      }finally{writing=false;}
    }
    function openDestination(kind){
      if(ctx.blocked())return;
      ctx.navigate(kind);
      card?.classList.add('is-compact');
      card?.querySelector('[data-guide-toggle]')?.setAttribute('aria-expanded','false');
      if(kind==='recruit')mark('recruit-one');
      else if(kind==='roster')mark('tab-roster');
    }
    function show(){
      cleanup();
      if(step<4){
        const line=SCENES[step];story=document.createElement('dialog');story.className='piyu-story';story.id='piyu-story';story.setAttribute('aria-labelledby','piyu-story-title');
        story.innerHTML=`<div class="piyu-scene ${line.scene}" aria-hidden="true"><i class="piyu-crack"></i><i class="piyu-portal"></i></div><div class="piyu-story-top"><span>학교용병단 · 프롤로그</span><button type="button" data-guide-skip>이야기 건너뛰기</button></div><div class="piyu-dialogue">${step>=2?illustration:''}<div><span class="piyu-speaker">${line.speaker}</span><h2 id="piyu-story-title">${line.title}</h2><p>${line.text}</p><div class="piyu-story-actions"><small>${step+1} / ${SCENES.length}</small><button class="primary" type="button" data-guide-next>${step===3?'삐유에게 대답하기':'다음 이야기'}</button></div></div></div>`;
        story.querySelector('[data-guide-next]').onclick=()=>move(step+1);story.querySelector('[data-guide-skip]').onclick=()=>move(4);
        story.addEventListener('cancel',e=>{e.preventDefault();move(4);});document.body.append(story);story.showModal();story.querySelector('[data-guide-next]').focus();
      }else if(step===4){
        const hasName=registered();story=document.createElement('dialog');story.id='piyu-story';story.className='piyu-story piyu-name-scene';story.setAttribute('aria-labelledby','piyu-story-title');
        story.innerHTML=`<div class="piyu-scene piyu" aria-hidden="true"></div><div class="piyu-story-top"><span>학교용병단 · 단장 등록</span></div><div class="piyu-dialogue">${illustration}<div><span class="piyu-speaker">삐유</span><h2 id="piyu-story-title">${hasName?'다시 만나서 반가워, 단장!':'널 뭐라고 부르면 좋을까?'}</h2><p>${hasName?'우리를 이끌어 줄 네 이름, 이대로 기억할게!':'다른 세계의 친구들에게 알려 줄 단장 이름을 정해 줘. 우리 학교용병단의 첫걸음이야!'}</p><form id="piyu-name-form"><label for="piyu-name">단장 이름 · 2~12글자</label><input id="piyu-name" autocomplete="nickname" maxlength="24" enterkeyhint="done" value="${hasName?esc(ctx.getState().commanderName):''}" ${hasName?'readonly':''} placeholder="단장 이름 입력"><p id="piyu-name-message" role="status">${hasName?'기존 이름을 유지합니다. 보석은 사용하지 않아요.':'첫 등록은 무료예요. 이미 사용 중인 이름은 등록할 수 없어요.'}</p><button type="submit" class="primary" data-guide-name>${hasName?'이 이름으로 계속':'이름 등록하고 계속'}</button></form></div></div>`;
        story.addEventListener('cancel',e=>e.preventDefault());document.body.append(story);story.showModal();
        story.querySelector('#piyu-name-form').onsubmit=async event=>{
          event.preventDefault();if(writing||ctx.blocked())return;
          const input=story.querySelector('#piyu-name'),button=story.querySelector('[data-guide-name]'),message=story.querySelector('#piyu-name-message');
          if(hasName){await move(5);return;}
          const name=window.SchoolRPG.normalizeCommanderName(input.value);
          if(!name||name==='새내기 단장'){message.textContent='이름을 2~12글자로 입력해 주세요. 특수기호는 _ 와 - 를 사용할 수 있어요.';return;}
          button.disabled=true;const ticket=scope;
          try{const result=await ctx.rename(name);if(ticket!==ctx.scope())return;if(result?.kind==='rename'&&registered())await move(5);else message.textContent=result?.error||'이름을 등록하지 못했어요. 연결 상태와 중복 여부를 확인해 주세요.';}finally{button.disabled=false;}
        };
        story.querySelector(hasName?'[data-guide-name]':'#piyu-name').focus();
      }else{
        card=document.createElement('aside');card.id='piyu-guide';card.className='piyu-guide';card.setAttribute('aria-label','삐유의 첫 모험 안내');
        const content=step===5?['다른 세계에 손을 내밀어 봐!','상시뽑기에서 동료를 만날 수 있어. 1회는 보석 100개야. 비용과 확률을 확인하고 모집 버튼을 직접 눌러 줘.','상시뽑기 열기']:step===6?['함께 싸울 친구들을 골라 줘!','학교 용병단에서 캐릭터를 꾹 눌러 빈자리에 놓아 봐. 최대 6명, 앞에는 수호 용병을 두면 든든해!','편성 화면 열기']:['이제, 학교 너머로!','전투와 스킬은 자동으로 진행돼. 동료를 키우고 차원문 너머의 길을 열자. 돌아오면 내가 반겨 줄게!','모험 시작'];
        card.innerHTML=`${mascot}<div class="piyu-guide-copy"><b>삐유 · ${step-4}/3</b><button type="button" class="piyu-guide-toggle" aria-expanded="true" data-guide-toggle>안내 접기 / 펼치기</button><h3>${content[0]}</h3><p>${content[1]}</p><div class="piyu-guide-actions"><button class="primary" type="button" data-guide-go>${content[2]}</button>${step===6?'<button class="secondary" type="button" data-guide-ready>편성 확인했어요</button>':''}<button class="text-button" type="button" data-guide-later>안내 마치기</button></div></div>`;
        card.querySelector('[data-guide-toggle]').onclick=()=>{card.classList.toggle('is-compact');card.querySelector('[data-guide-toggle]').setAttribute('aria-expanded',String(!card.classList.contains('is-compact')));};
        card.querySelector('[data-guide-go]').onclick=async()=>{if(step===7){await move(8);if(!active)ctx.navigate('adventure');}else openDestination(step===5?'recruit':'roster');};
        if(step===6)card.querySelector('[data-guide-ready]').onclick=()=>move(7);
        card.querySelector('[data-guide-later]').onclick=()=>move(8);document.body.append(card);
      }
    }
    function start(manual=false){
      if(ctx.blocked()||ctx.obstructed())return;
      focusBefore=document.activeElement;scope=ctx.scope();replay=manual;step=manual?0:(ctx.getState().onboarding?.step??8);active=step<8;
      if(active)show();
    }
    function tick(){
      if(!ctx.ready())return;
      if(scope!==ctx.scope()){close();scope=ctx.scope();replay=false;step=8;}
      if(!active){if(ctx.getState().onboarding?.step<8&&!ctx.obstructed()&&!ctx.blocked())start();return;}
      // Another tab/device can finish the guide. Never write an older step back.
      const saved=ctx.getState().onboarding?.step;
      if(!replay&&!writing&&saved>step){step=saved;if(step>=8){close();return;}show();}
      const obstructed=ctx.obstructed();if(card)card.hidden=obstructed;
      if(obstructed||writing||ctx.blocked())return;
      if(step===5&&ctx.getState().pulls>0)pendingAdvance=6;
      if(pendingAdvance!==null)move(pendingAdvance);
    }
    function onAction(input,result){if(active&&step===6&&input.kind==='team'&&result?.kind==='team')pendingAdvance=7;}
    return {tick,start,onAction,close,get active(){return active;},get storyOpen(){return !!story?.open;},get namingOpen(){return !!story?.open&&step===4;}};
  }
  return {create,SCENES};
})();
