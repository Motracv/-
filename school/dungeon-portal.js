/* Navigation and compositor-only transitions. Never starts/spends a dungeon run. */
window.SchoolDungeonPortal=(()=>{
  'use strict';
  const kinds=['daily','tower','weekly'];
  function create(root,{reduced=()=>false}={}){
    const $=id=>root.querySelector('#'+id);let active=false,screen='hub',chosen='daily',animations=[],flight=null;
    function cancel(){for(const a of animations)a.cancel();animations=[];flight?.remove();flight=null;}
    function animate(node,frames,duration=420){
      if(reduced()||!node?.animate)return null;
      const a=node.animate(frames,{duration,easing:'cubic-bezier(.16,1,.3,1)'});animations.push(a);
      a.finished.then(()=>{animations=animations.filter(x=>x!==a);},()=>{});return a;
    }
    function layout(){
      root.dataset.screen=screen;$('dungeon-hub').hidden=screen!=='hub';$('dungeon-detail').hidden=screen!=='detail';
      $('dungeon-back').setAttribute('aria-label',screen==='detail'?'던전 목록으로 돌아가기':'학교 안뜰로 돌아가기');
      $('dungeon-back-label').textContent=screen==='detail'?'던전 목록':'안뜰';
      $('dungeon-page-title').textContent=screen==='detail'?{daily:'방과 후 보급고',tower:'뫼비우스의 복도',weekly:'봉인된 이사장실'}[chosen]:'던전';
    }
    function open(){cancel();active=true;screen='hub';layout();
      animate($('dungeon-atmosphere'),[{transform:'scale(.92)',opacity:.25},{transform:'scale(1)',opacity:1}],560);
      animate($('dungeon-hub'),[{transform:'perspective(1000px) translateZ(-160px)',opacity:0},{transform:'perspective(1000px) translateZ(0)',opacity:1}],480);
      $('dungeon-back').focus({preventScroll:true});
    }
    function select(kind,button){
      if(!active||!kinds.includes(kind))return false;
      cancel();chosen=kind;const cover=button?.querySelector('img'),box=cover?.getBoundingClientRect(),area=root.getBoundingClientRect();
      const art=$('dungeon-detail-art');art.src=`school/assets/dungeon-${kind}.png?v=school-dungeon-portal1`;art.alt='';
      screen='detail';layout();$('dungeon-detail').scrollTop=0;
      if(!reduced()&&box?.width>0&&box?.height>0&&root.animate){
        flight=document.createElement('img');const node=flight;node.className='dungeon-flight';node.src=art.src;node.alt='';node.setAttribute('aria-hidden','true');
        Object.assign(node.style,{left:`${box.left-area.left}px`,top:`${box.top-area.top}px`,width:`${box.width}px`,height:`${box.height}px`});root.append(node);
        const scale=Math.max(area.width/box.width,area.height/box.height)*1.12,dx=area.width/2-(box.left-area.left+box.width/2),dy=area.height/2-(box.top-area.top+box.height/2);
        const a=animate(node,[{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx}px,${dy}px) scale(${scale})`,opacity:.95,offset:.65},{transform:`translate(${dx}px,${dy}px) scale(${scale*1.04})`,opacity:0}],480);
        if(a)a.finished.then(()=>{node.remove();if(flight===node)flight=null;},()=>node.remove());else{node.remove();flight=null;}
      }
      animate($('dungeon-detail'),[{transform:'translateY(12px) scale(.98)',opacity:0},{transform:'translateY(0) scale(1)',opacity:1}],360);
      $('dungeon-back').focus({preventScroll:true});return true;
    }
    function back(){if(!active||screen!=='detail')return false;cancel();screen='hub';layout();animate($('dungeon-hub'),[{transform:'scale(.97)',opacity:0},{transform:'scale(1)',opacity:1}],240);root.querySelector(`[data-dungeon="${chosen}"]`)?.focus({preventScroll:true});return true;}
    function close(){cancel();active=false;screen='hub';layout();}
    return {open,select,back,close,get screen(){return screen;}};
  }
  return {create};
})();
