(function(){
  'use strict';const G=window.SchoolRPG,P=window.SchoolPresentation,select=document.getElementById('hero'),button=document.getElementById('play'),result=document.getElementById('result');
  for(const h of G.HEROES){const option=document.createElement('option');option.value=h.id;option.textContent=`${h.rarity} · ${h.name}`;select.append(option);}
  const requested=new URLSearchParams(location.search).get('hero');select.value=G.BY_ID[requested]?requested:'horas';
  P.configure({heroInfo:id=>G.BY_ID[id],soundEnabled:()=>false});
  button.onclick=async()=>{if(P.busy)return;button.disabled=true;select.disabled=true;result.textContent='';const hero=G.BY_ID[select.value];try{await P.recruit({results:[{id:hero.id,fresh:true,shards:0}],key:crypto.randomUUID()});result.textContent=`${hero.rarity} ${hero.name} · 첫 만남을 감상했어요.`;}finally{button.disabled=false;select.disabled=false;button.focus();}};
})();
