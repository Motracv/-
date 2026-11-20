/* A title/auth gate. No guest progress is read, imported, advanced or overwritten. */
window.SchoolEntry = (()=>{
  function create(ctx){
    const $=id=>document.getElementById(id);let entered=false,generation=0,authBusy=false;
    const root=$('school-entry');
    function message(value){$('entry-message').textContent=value;}
    function serverStatus(value){if($('entry-server-status'))$('entry-server-status').textContent=value;}
    if($('entry-server-check'))$('entry-server-check').onclick=async()=>{
      const button=$('entry-server-check');if(button.disabled)return;button.disabled=true;serverStatus('연결 확인 중…');
      try{const info=await ctx.request('/api/account/config');serverStatus(info.enabled?'서버 응답 확인':'로그인 준비 중');}
      catch{serverStatus('연결 확인 필요 · 다시 시도해 주세요');}finally{button.disabled=false;}
    };
    function refresh(){
      const ready=ctx.authenticated();$('entry-start').hidden=!ready;$('entry-google').hidden=ready;$('entry-retry').hidden=ready;
      $('entry-account').textContent=ready?(ctx.profile()?.isTest?'운영 테스트 · 비공개':'Google 계정 연결 완료'):'Google 계정으로 모험을 시작해 주세요';
      $('entry-signout').hidden=!ready;$('entry-start').disabled=!ready||authBusy;
      $('entry-retry').disabled=authBusy;$('entry-test-submit').disabled=authBusy;
      $('entry-signout').disabled=authBusy;
      root.dataset.connected=String(ready);
    }
    function show(){generation++;authBusy=false;entered=false;root.hidden=false;$('board-viewport').hidden=true;$('app').inert=true;$('rotate-prompt').hidden=true;refresh();ctx.changed?.();}
    async function google(){
      const ticket=++generation;message('Google 로그인 버튼을 준비하고 있어요.');$('entry-google').replaceChildren();
      try{
        const config=await ctx.request('/api/account/config');serverStatus(config.enabled?'서버 응답 확인':'로그인 준비 중');if(!config.enabled)throw Error('Google 로그인을 준비 중입니다. 잠시 후 다시 시도해 주세요.');
        const [,challenge]=await Promise.all([ctx.sdk(),ctx.request('/api/account/challenge')]);if(ticket!==generation||entered)return;
        window.google.accounts.id.initialize({client_id:config.clientId,nonce:challenge.nonce,auto_select:false,callback:async response=>{
          if(ticket!==generation||authBusy||entered)return;authBusy=true;refresh();message('계정을 확인하고 있어요.');
          try{const result=await ctx.request('/api/account/google',{credential:response.credential,nonce:challenge.nonce});await ctx.login(result);refresh();message(ctx.authenticated()?'준비됐어요. 게임 시작을 눌러 주세요.':'저장을 불러오지 못했어요. 다시 연결해 주세요.');}
          catch(e){message(e.message);}finally{authBusy=false;refresh();}
        }});
        window.google.accounts.id.renderButton($('entry-google'),{type:'standard',theme:'outline',size:'large',text:'signin_with',locale:'ko',width:Math.max(200,Math.min(280,$('entry-google').clientWidth||280))});message('계정에 모험 기록이 저장됩니다.');
      }catch(e){message(e.message);}
    }
    $('entry-start').onclick=()=>{if(entered||!ctx.authenticated()||authBusy)return;generation++;entered=true;root.hidden=true;$('board-viewport').hidden=false;$('app').inert=false;ctx.enter();ctx.changed?.();};
    $('entry-retry').onclick=async()=>{if(ctx.hasToken()){message('기록을 다시 확인하고 있어요.');await ctx.reconnect();refresh();}if(!ctx.authenticated())google();};
    $('entry-signout').onclick=()=>ctx.logout();
    $('entry-test-form').onsubmit=async e=>{
      e.preventDefault();const code=$('entry-test-code');if(authBusy||entered)return;generation++;authBusy=true;refresh();message('접속을 확인하고 있어요.');
      try{const result=await ctx.request('/api/account/test-login',{code:code.value});code.value='';await ctx.login(result);refresh();message(ctx.authenticated()?'비공개 테스트 환경 준비 완료':'다시 연결해 주세요.');}
      catch(error){message(error.message);}finally{authBusy=false;refresh();}
    };
    show();return {show,refresh,google,message,get entered(){return entered;}};
  }
  return {create};
})();
