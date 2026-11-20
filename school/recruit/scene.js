/* A presentation of an already committed draw. No account, payment or RNG APIs. */
(function(root){
  'use strict';
  const C=()=>root.SchoolRecruitCinema, D=()=>root.SchoolRecruitData;
  const HOLD=18.2, DIALOGUE_AT=15;
  const clamp=n=>Math.max(0,Math.min(1,n)), ease=n=>{n=clamp(n);return n*n*(3-2*n);};
  const ramp=(t,a,d)=>ease((t-a)/d);
  const poseAt=t=>t<5?0:t<7.6?.72+.28*ramp(t,5,.45):t<8.7?1+ramp(t,7.6,1.1):t<13?2:2+ramp(t,13,.55);
  function highest(results,info){return results.reduce((a,b)=>!a||({R:0,SR:1,SSR:2,UR:3}[info(b.id)?.rarity]||0)>({R:0,SR:1,SSR:2,UR:3}[info(a.id)?.rarity]||0)?b:a,null);}
  function available(id){return !!(C()&&D()?.heroes[id]?.frames?.length===4);}
  function create(host,{hero,reduced=false,play=()=>{},stopSound=()=>{}}){
    const data=D().heroes[hero.id], cinema=C(), theme=cinema.THEMES[data.element];
    const assets=D().assets, refs={}, decoded=Object.create(null), pending=new Set(), cues=new Set();
    let destroyed=false,loaded=false,time=0,last=null,raf=0,resizeFrame=0,held=false,resolve;
    let reducedMotion=!!reduced,viewWidth=1280,viewHeight=720;
    const done=new Promise(r=>{resolve=r;}), media=root.matchMedia?.('(prefers-reduced-motion: reduce)');
    const el=(tag,key,parent=stage,text)=>{const n=document.createElement(tag);n.className='recruit-'+key;refs[key]=n;if(text!==undefined)n.textContent=text;parent.append(n);return n;};
    const stage=document.createElement('section');stage.className='recruit-stage';stage.dataset.rarity=hero.rarity;stage.dataset.phase='loading';stage.dataset.reduced=String(reducedMotion);stage.style.setProperty('--element-color',theme.color);stage.style.setProperty('--element-rgb',theme.rgb);stage.style.setProperty('--grade-color',({R:'#99d9ff',SR:'#cf9cff',SSR:'#ffe29b',UR:'#ffabe5'})[hero.rarity]);
    stage.setAttribute('aria-busy','true');host.replaceChildren(stage);
    const scene=el('div','scene');scene.setAttribute('aria-hidden','true');el('img','classroom',scene).alt='';el('div','sunlight',scene);
    const ambient=el('div','ambient',scene);for(let i=0;i<18;i++){const mote=document.createElement('i');mote.style.cssText=`left:${(i*37+8)%95}%;top:${(i*19+12)%94}%;--delay:${-i*.47}s`;ambient.append(mote);}
    el('div','aura',scene);const visitor=el('div','visitor',scene);el('canvas','visitor-art',visitor);
    const commander=el('div','commander',scene);el('img','commander-image',commander).alt='';el('span','sleep',commander,'z Z');el('span','unknown',commander,'?');el('div','tap',scene);
    const hint=el('div','hint',scene);el('strong','hint-grade',hint,hero.rarity);el('span','hint-text',hint,'다가오는 기척');
    el('div','shade');el('canvas','fx-back');const reveal=el('div','reveal');reveal.setAttribute('aria-hidden','true');
    const wrap=el('div','actor-wrap',reveal);el('canvas','actor',wrap).setAttribute('aria-label',`${hero.name}가 웃으며 반기는 모습`);
    const copy=el('div','copy',reveal);el('span','eyebrow',copy,'차원을 넘어, 당신에게');el('b','rarity',copy,hero.rarity);el('span','subtitle',copy,hero.title||'새로운 동료');
    const title=el('h2','name',copy,hero.name);title.id='presentation-title';el('span','element',copy,`${theme.label} · ${theme.english}`);el('i','rule',copy);el('small','english',copy,'OUR STORY BEGINS HERE');
    el('canvas','fx-front');const sigil=el('div','sigil');el('span','sigil-overline',sigil,'새로운 인연이 깨어납니다');el('strong','sigil-name',sigil,theme.english);el('span','sigil-caption',sigil,theme.label);
    const dialogue=el('div','dialogue');dialogue.hidden=true;el('b','speaker',dialogue);const line=el('p','line',dialogue);line.id='presentation-description';
    const proceed=el('button','continue',stage,'화면을 눌러 전체 결과 확인');proceed.type='button';proceed.hidden=true;proceed.onclick=()=>complete();
    for(const side of ['top','bottom'])el('div','eyelid-'+side);
    el('div','blackout');el('div','flash');const loading=el('div','loading');el('span','loading-star',loading,'✧');el('p','loading-text',loading,'동료와의 첫 만남을 준비하고 있어요.');el('small','saved',loading,'모집 결과는 이미 안전하게 저장되었어요.');
    const skip=el('button','skip',stage,'결과 바로 보기');skip.type='button';skip.onclick=()=>complete({skipped:true});
    const status=el('span','status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const surfaces=['visitor-art','actor','fx-back','fx-front'].map(key=>({key,canvas:refs[key],context:refs[key].getContext('2d')}));
    function opacity(key,value){refs[key].style.opacity=String(clamp(value));}
    function sound(key){if(cues.has(key))return;cues.add(key);if(!document.hidden)play(key);}
    function text(speaker,content,visible){dialogue.hidden=!visible;if(visible){refs.speaker.textContent=speaker;refs.line.textContent=content;}}
    function resize(){
      if(destroyed)return;
      const box=stage.getBoundingClientRect();viewWidth=box.width||1280;viewHeight=box.height||720;
      for(const s of surfaces){const actor=s.key==='visitor-art'||s.key==='actor',r=s.canvas.getBoundingClientRect();const size=cinema.fitResolution(r.width||viewWidth*(actor?.52:1),r.height||viewHeight*(actor?.96:1),root.devicePixelRatio||1,actor?1600000:2200000);s.canvas.width=size.width;s.canvas.height=size.height;}
      if(loaded)draw(true);
    }
    function queueResize(){if(resizeFrame||destroyed)return;resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;resize();});}
    const observer=typeof root.ResizeObserver==='function'?new root.ResizeObserver(queueResize):null;observer?.observe(stage);root.addEventListener('resize',queueResize);
    function draw(silent=false){
      const t=time,approach=ramp(t,3.3,1.6),dive=ramp(t,10.5,1.9),settle=ramp(t,13,1.5),transition=ramp(t,12.6,1.2);
      const tap=Math.max(0,1-Math.abs(t-5.65)/.3)+Math.max(0,1-Math.abs(t-6.95)/.3),breathing=reducedMotion?0:Math.sin(t*1.9);
      const impact=reducedMotion?0:ramp(t,12.4,.09)*(1-ramp(t,12.55,.7));
      stage.dataset.phase=held?'hold':t<3.3?'sleep':t<5?'approach':t<7.6?'wake':t<8.7?'opening':t<10.5?'sigil':t<12.4?'dive':t<15?'reveal':'greeting';
      opacity('commander',ramp(t,.75,.25)*(1-ramp(t,8.2,.8)));commander.style.transform=`translateY(${-tap*2}px) scaleY(${1+breathing*.0015})`;
      scene.style.transform=reducedMotion?'none':`scale(${1+ramp(t,1,6)*.04+ramp(t,7.6,1.4)*.11+dive*.65}) translateY(${dive*5}%)`;opacity('scene',1-dive*(1-settle));
      opacity('visitor',approach*(1-ramp(t,8.4,1.3)));visitor.style.transform=reducedMotion?'none':`translateX(${(1-approach)*16}%) translateY(${tap*3+breathing*.4}px)`;
      opacity('aura',approach*(.72+Math.sin(t*2)*.1)*(1-ramp(t,8.6,1)));opacity('hint',ramp(t,4,.5)*(1-ramp(t,7.5,.6)));opacity('tap',reducedMotion?0:tap*.65);refs.tap.style.transform=`scale(${1.6-tap*.6})`;
      opacity('blackout',t<1?1:1-ramp(t,1,1.6));
      const blink=t>=7.6&&t<8.7?(t<8?ramp(t,7.6,.4):1-ramp(t,8,.7)):0;
      for(const side of ['top','bottom'])refs['eyelid-'+side].style.transform=`scaleY(${reducedMotion?0:blink})`;
      opacity('reveal',transition);reveal.setAttribute('aria-hidden',String(t<12.6));opacity('copy',ramp(t,13.5,.9));
      wrap.style.transform=reducedMotion?'none':`translate(${Math.sin(t*62)*impact*.22}%,${(1-transition)*5+Math.cos(t*53)*impact*.14}%) scale(${1.5-.5*ramp(t,13.1,1.5)})`;
      opacity('sigil',ramp(t,8.8,.6)*(1-ramp(t,10.5,.6)));refs.sigil.style.transform=`translate(-50%,-50%) scale(${1+dive*.4})`;
      opacity('flash',reducedMotion?0:(t<12.4?ramp(t,12.2,.2):1-ramp(t,12.4,.6))*.82);
      for(const s of surfaces){if(!s.context)continue;const actor=s.key==='visitor-art'||s.key==='actor';if(actor){const visible=s.key==='visitor-art'?t>=3.3&&t<10.5:t>=12.4;if(visible)cinema.actor(s.context,decoded,data.frames,s.canvas.width,s.canvas.height,poseAt(t),t,reducedMotion);else s.context.clearRect(0,0,s.canvas.width,s.canvas.height);}else cinema.effects(s.context,s.canvas.width,s.canvas.height,t,data.element,hero.rarity,s.key==='fx-front',reducedMotion);}
      if(t>=DIALOGUE_AT)text(hero.name,data.greeting.slice(0,reducedMotion||held?data.greeting.length:Math.floor((t-DIALOGUE_AT)*24)),true);
      else if(t>=5.1&&t<7.6)text('???',t<6.2?'단장님…':'단장님, 일어날 시간이에요.',true);else text('','',false);
      if(!silent){if(t>=3.3)sound('approach');if(t>=5.55)sound('tap1');if(t>=6.85)sound('tap2');if(t>=8.7)sound('sigil');if(t>=10.5)sound('dive');if(t>=12.4)sound('reveal');}
    }
    function hold(){held=true;time=HOLD;last=null;cancelAnimationFrame(raf);raf=0;draw(true);proceed.hidden=false;skip.hidden=true;status.textContent=`${hero.rarity} ${hero.name}. ${data.greeting}`;proceed.focus({preventScroll:true});}
    function tick(now){raf=0;if(destroyed||!loaded||held||document.hidden)return;try{if(last!==null)time=Math.min(HOLD,time+Math.max(0,Math.min(.1,(now-last)/1000)));last=now;draw();if(time>=HOLD)hold();else raf=requestAnimationFrame(tick);}catch{complete({fallback:true});}}
    function visibility(){last=null;stage.dataset.paused=String(document.hidden);if(document.hidden){cancelAnimationFrame(raf);raf=0;stopSound();}else if(loaded&&!held&&!destroyed&&!raf)raf=requestAnimationFrame(tick);}
    function motion(event){if(event.matches&&!destroyed){reducedMotion=true;stage.dataset.reduced='true';stopSound();if(loaded)hold();}}
    function pageHide(){complete({cancelled:true});}
    document.addEventListener('visibilitychange',visibility);root.addEventListener('pagehide',pageHide);media?.addEventListener?.('change',motion);
    function load(file){return new Promise((yes,no)=>{
      const img=new Image();let settled=false;
      const job={cancel:()=>finish(new Error('Cancelled'))};pending.add(job);
      const timeout=setTimeout(()=>finish(new Error('Asset timeout')),25000);
      function finish(error){if(settled)return;settled=true;clearTimeout(timeout);img.onload=img.onerror=null;pending.delete(job);if(error){img.src='';no(error);}else{decoded[file]=img;yes(img);}}
      img.onload=async()=>{try{if(!img.naturalWidth)throw Error('Empty image');if(img.decode)await img.decode();finish();}catch(e){finish(e);}};img.onerror=()=>finish(new Error('Asset unavailable'));img.src=file;
    });}
    function destroy(){if(destroyed)return;destroyed=true;cancelAnimationFrame(raf);cancelAnimationFrame(resizeFrame);observer?.disconnect();root.removeEventListener('resize',queueResize);root.removeEventListener('pagehide',pageHide);document.removeEventListener('visibilitychange',visibility);media?.removeEventListener?.('change',motion);stopSound();for(const job of [...pending])job.cancel();for(const key of Object.keys(decoded))delete decoded[key];for(const s of surfaces){s.canvas.width=1;s.canvas.height=1;}refs.classroom.removeAttribute('src');refs['commander-image'].removeAttribute('src');resolve({cancelled:true});}
    function complete(result={}){if(destroyed)return;resolve(result);destroy();}
    stage.addEventListener('click',event=>{if(held&&!event.target.closest('button'))complete();});
    // Only the selected winner's atlas and two common scene images are decoded.
    Promise.all([...new Set([assets.classroom,assets.commander,...data.frames.map(f=>f.file)])].map(load)).then(()=>{
      if(destroyed)return;loaded=true;refs.classroom.src=assets.classroom;refs['commander-image'].src=assets.commander;loading.hidden=true;stage.setAttribute('aria-busy','false');resize();skip.focus({preventScroll:true});if(reducedMotion)hold();else{draw(true);visibility();}
    }).catch(()=>{if(!destroyed)complete({fallback:true});});
    resize();
    return {done,destroy,get time(){return time;},get held(){return held;}};
  }
  root.SchoolRecruitScene=Object.freeze({create,available,highest,poseAt,HOLD,DIALOGUE_AT});
})(typeof globalThis==='object'?globalThis:this);
