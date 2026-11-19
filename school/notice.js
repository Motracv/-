/* Public, read-only operations notice. Disabled by default; no game-save writes. */
window.SchoolNotice=(()=>{
 'use strict';
 function active(config,now){
  if(config?.enabled!==true||typeof config.message!=='string'||!config.message.trim()||config.message.length>180)return '';
  const start=config.startsAt?Date.parse(config.startsAt):0,end=Date.parse(config.endsAt);
  return Number.isFinite(start)&&Number.isFinite(end)&&now>=start&&now<end?config.message.trim():'';
 }
 function create(ctx={}){
  const clock=ctx.now||Date.now,fetcher=ctx.fetch||window.fetch.bind(window);
  let timer=0,expiry=0,request=null,disposed=false,config=null,node=null,message='',fetched=0;
  function hide(){if(node){try{node.hidePopover?.();}catch{}node.remove();node=null;}message='';}
  function render(){
   const now=clock(),next=!document.hidden&&now-fetched<120000?active(config,now):'';
   if(!next){hide();return;}
   if(!node){node=document.createElement('aside');node.id='school-notice';node.setAttribute('popover','manual');node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.innerHTML='<b>공지</b><div class="notice-window"><span class="notice-track"></span></div>';document.body.append(node);}
   node.dataset.reduced=String(!!ctx.reduced?.());
   if(message!==next){node.querySelector('.notice-track').textContent=next;message=next;}
   const host=[...document.querySelectorAll('dialog[open]')].at(-1)||document.body;
   if(node.parentNode!==host){try{node.hidePopover?.();}catch{}host.append(node);}
   if(node.showPopover){try{if(!node.matches(':popover-open'))node.showPopover();}catch{}}
  }
  function schedule(){clearTimeout(timer);if(!disposed)timer=setTimeout(poll,15000);}
  async function poll(){
   if(disposed)return;if(document.hidden||request){schedule();return;}
   const control=new AbortController();request=control;const deadline=setTimeout(()=>control.abort(),8000);
   try{
    const response=await fetcher('school/notice.json?t='+Math.floor(clock()/15000),{cache:'no-store',signal:control.signal});
    if(!response.ok)throw Error('Notice unavailable');const next=await response.json();if(disposed)return;
    config=next;fetched=clock();clearTimeout(expiry);
    const end=Date.parse(config?.endsAt);if(Number.isFinite(end)&&end>clock())expiry=setTimeout(render,Math.min(2147483647,end-clock()+1));
   }catch{ /* Keep a recently confirmed notice briefly; never persist it offline. */ }
   finally{clearTimeout(deadline);request=null;if(!disposed){render();schedule();}}
  }
  const visibility=()=>{render();if(!document.hidden){clearTimeout(timer);poll();}};
  document.addEventListener('visibilitychange',visibility);poll();
  return {refresh:render,destroy(){disposed=true;request?.abort();clearTimeout(timer);clearTimeout(expiry);document.removeEventListener('visibilitychange',visibility);hide();}};
 }
 return {create,active};
})();
