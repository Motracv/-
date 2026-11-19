/* Cosmetic wardrobe: one bounded preview loop; all equips use saved actions. */
window.SchoolSkins=(()=>{
 'use strict';
 const G=window.SchoolRPG,ID='horas_after_school';
 function create(ctx){
  let root=null,raf=0,epoch=0,selection=null,pose='idle',started=0,sending=false,scope='',signature='';
  const blocked=()=>sending||ctx.blocked();
  function destroy(){epoch++;cancelAnimationFrame(raf);raf=0;root=null;signature='';}
  function refresh(){
   if(!root)return;if(scope!==ctx.scope()){destroy();return;}
   const s=ctx.getState(),owned=G.ownsSkin(s,ID),equipped=G.equippedSkin(s,'horas'),key=[owned,equipped,selection,blocked()].join('|');if(key===signature)return;signature=key;
   root.querySelectorAll('[data-skin]').forEach(b=>{const skin=b.dataset.skin||null;b.setAttribute('aria-pressed',String(selection===skin));b.querySelector('small').textContent=skin===equipped?'사용 중':!skin?'기본 의상':owned?'보유 중':'미보유 · 미리보기';});
   root.querySelector('[data-skin-name]').textContent=selection?G.SKINS[ID].name:'벚꽃의 호라스';
   root.querySelector('[data-skin-caption]').textContent=selection?'별빛 구슬 · 고양이 표정 · 분홍빛 성좌 의식':'기본 의상과 벚꽃 의식';
   const button=root.querySelector('[data-skin-equip]');button.disabled=blocked()||!s.units.horas||equipped===selection||!!selection&&!owned;
   button.textContent=sending?'저장 중…':equipped===selection?'현재 사용 중':selection&&!owned?'스킨 획득 후 사용':'이 모습으로 사용';
   root.querySelector('[data-skin-status]').textContent=!s.units.horas?'호라스를 영입하면 사용할 수 있어요.':selection&&!owned?'스킨을 획득한 계정에서 사용할 수 있어요.':'능력치 변화 없음 · 협동전은 다음 입장부터 적용';
  }
  function open(hero='horas'){
   if(hero!=='horas')return;destroy();const s=ctx.getState();selection=G.equippedSkin(s,hero);pose='idle';scope=ctx.scope();
   ctx.openModal('호라스 · 스킨',`<section class="wardrobe"><div class="wardrobe-stage"><span class="wardrobe-tag">HORAS · COSTUME</span><canvas width="480" height="420" aria-label="호라스 의상과 동작 미리보기"></canvas><h3 data-skin-name></h3><p data-skin-caption></p><div class="wardrobe-motions" role="group" aria-label="동작 선택"><button data-pose="idle" aria-pressed="true">대기</button><button data-pose="basic1">평타 1</button><button data-pose="basic2">평타 2</button><button data-pose="skill">스킬</button></div></div><div class="wardrobe-panel"><p class="wardrobe-kicker">의상 선택</p><div class="wardrobe-choices"><button data-skin="" aria-pressed="false"><span class="wardrobe-thumb"><img src="${window.SchoolArt.rosterPortrait('horas')}" alt="기본 의상의 호라스"></span><b>벚꽃의 호라스</b><small></small></button><button data-skin="${ID}" aria-pressed="false"><span class="wardrobe-thumb"><img src="${window.SchoolArt.rosterPortrait('horas',ID)}" alt="방과 후의 성좌 의상"></span><b>방과 후의 성좌</b><small></small></button></div><p class="wardrobe-note">의상과 동작, 스킬 연출이 달라져요.<br>공격력 · 체력 · 스킬 성능은 그대로예요.</p><p data-skin-status role="status"></p><button class="primary full" data-skin-equip></button><button class="secondary full" data-skin-back>용병 육성으로</button></div></section>`,'skin');
   root=document.querySelector('.wardrobe');if(!root)return;started=performance.now();const generation=epoch;
   root.querySelectorAll('[data-skin]').forEach(b=>b.onclick=()=>{selection=b.dataset.skin||null;started=performance.now();refresh();});
   root.querySelectorAll('[data-pose]').forEach(b=>b.onclick=()=>{pose=b.dataset.pose;started=performance.now();root.querySelectorAll('[data-pose]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
   root.querySelector('[data-skin-back]').onclick=()=>ctx.openHero('horas');
   root.querySelector('[data-skin-equip]').onclick=async()=>{if(blocked()||!root)return;sending=true;refresh();try{await ctx.dispatch({kind:'skin-equip',hero:'horas',skin:selection});}finally{sending=false;refresh();}};
   const canvas=root.querySelector('canvas'),c=canvas.getContext('2d');
   function draw(now){
    if(generation!==epoch||!root||!root.isConnected)return;raf=requestAnimationFrame(draw);if(document.hidden)return;
    const time=(now-started)/1000,reduced=ctx.reduced(),age=pose==='skill'?time%4.5:time%2.5,basic=pose.startsWith('basic')&&age<1.18,cast=pose==='skill'&&age<2.45;
    c.clearRect(0,0,480,420);const bg=c.createLinearGradient(0,0,0,420);bg.addColorStop(0,'#17233c');bg.addColorStop(1,'#343047');c.fillStyle=bg;c.fillRect(0,0,480,420);
    c.strokeStyle='#8cdce524';c.lineWidth=1;for(let i=0;i<7;i++){c.beginPath();c.moveTo(240,228);c.lineTo(i*100-60,420);c.stroke();}for(const y of [279,309,351,410]){c.beginPath();c.moveTo(0,y);c.lineTo(480,y);c.stroke();}
    c.fillStyle='#94daf422';c.beginPath();c.ellipse(200,338,95,17,0,0,Math.PI*2);c.fill();
    const source={x:185,y:330},target={x:384,y:330,aimY:275},frame={skin:selection,time:now/1000,reduced,attackAge:basic?age:undefined,horasBasicPose:pose==='basic2'?2:1,horasCastAge:cast?age:-1,horasStacks:cast?5:3};
    window.SchoolArt.hero(c,'horas',source.x,source.y,4.8,frame);
    if(window.SchoolHorasSkinArt?.active(selection)){
     const fx={source,targets:[target],time:now/1000,age,actorScale:4.8,scale:1.15,reduced,economy:false,viewport:{width:480,height:420},pose:frame.horasBasicPose};
     if(basic)window.SchoolHorasSkinArt.effects(c,{...fx,kind:'basic'});
     if(cast&&age<1.5)window.SchoolHorasSkinArt.effects(c,{...fx,kind:'cast'});
     if(pose==='skill'&&age>=1.5&&age<3)window.SchoolHorasSkinArt.effects(c,{...fx,kind:'impact',age:age-1.5});
    }else if((cast||basic)&&!selection){
     const effects=basic?[{kind:'horas-basic',pose:frame.horasBasicPose,to:'dummy',time:now/1000-age}]:age>=1.5?[{kind:'horas-impact',targetId:'dummy',targets:['dummy'],time:now/1000-age+1.5}]:[];
     window.SchoolArt.horasVisualEffects(c,{heroes:[{id:'horas',hp:1}],elapsed:age*1000,horasEffectScale:1.15,...(cast&&age<1.5?{horasCast:{began:0,targetId:'dummy',targets:['dummy']}}:{})},effects,{horas:source,dummy:target},now/1000,reduced,false,0,true);
    }
   }
   refresh();raf=requestAnimationFrame(draw);
   window.SchoolHorasSkinArt?.ready.then(()=>{if(generation!==epoch||!root)return;root.querySelector(`[data-skin="${ID}"] img`).src=window.SchoolArt.rosterPortrait('horas',ID);});
  }
  return {open,refresh,destroy};
 }
 return {create};
})();
