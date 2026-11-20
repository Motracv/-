window.SchoolCampus=(()=>{
 'use strict';
 function enhanceHero(root){
  const growth=root.querySelector('.hero-growth');if(!growth||growth.querySelector('.hero-pane-tabs'))return;
  const children=[...growth.children],panes=[0,1,2].map(i=>{const p=document.createElement('section');p.className='hero-pane';p.dataset.heroPane=i;p.hidden=i!==0;return p;});let index=0;
  for(const child of children){if(child.matches('.hero-skills')){index=1;child.open=true;}else if(child.matches('.stage-title,.slot-buttons,.remove-hero-action,#formation-status'))index=2;panes[index].append(child);}
  const nav=document.createElement('nav');nav.className='hero-pane-tabs';nav.setAttribute('aria-label','용병 관리');['육성','스킬','편성'].forEach((label,i)=>{if(!panes[i].children.length)return;const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(i===0));b.onclick=()=>{panes.forEach((p,j)=>p.hidden=j!==i);[...nav.children].forEach(n=>n.setAttribute('aria-pressed',String(n===b)));};nav.append(b);});growth.append(nav,...panes);
 }
 function screenScale(width,height){return width>=2400&&height>=1200?Math.min(2,width/1920,height/1080):1;}
 function fitScreen(){const scale=screenScale(window.innerWidth,window.innerHeight);document.documentElement.style.setProperty('--game-ui-scale',String(scale));document.documentElement.dataset.largeScreen=String(scale>1);}
 function create(ctx){
  fitScreen();window.addEventListener('resize',fitScreen);
  const panel=document.getElementById('lobby-panel'),hotspots=document.getElementById('campus-hotspots'),school=document.getElementById('guild-button'),board=document.getElementById('community-button');let accessKey='',accessEpoch=0;
  for(const b of document.querySelectorAll('.lobby-nav button')){const name=b.querySelector('.lobby-menu-label')?.textContent;if(name){b.title=name;if(!b.hasAttribute('aria-label'))b.setAttribute('aria-label',name);}}
  function layout(){if(!panel||!hotspots)return;const w=panel.clientWidth,h=panel.clientHeight;if(!w||!h)return;const scale=Math.max(w/1821,h/864),ox=(w-1821*scale)/2,oy=(h-864*scale)/2;
   [[school,430,8,970,310],[board,225,248,170,182]].forEach(([node,x,y,bw,bh])=>{const left=ox+x*scale,top=oy+y*scale,width=bw*scale,height=bh*scale,fallback=left+width<70||left>w-70||w<650;node.classList.toggle('campus-compact',fallback);if(fallback){node.style.cssText='';return;}Object.assign(node.style,{left:Math.round(left)+'px',top:Math.round(top)+'px',width:Math.round(width)+'px',height:Math.round(height)+'px'});});
   // Integral image dimensions avoid repeated scaling of a low-resolution thumbnail.
   panel.style.setProperty('--unit-h',Math.round(Math.max(80,Math.min(240,h*.235)))+'px');
  }
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(layout):null;observer?.observe(panel);window.addEventListener('resize',layout);layout();
  function render(state){const scope=ctx.scope(),level=state?.captain?.level||1,key=scope+':'+level+':'+ctx.isCloud();if(key===accessKey)return;accessKey=key;const label=document.getElementById('guild-lock-label'),ticket=++accessEpoch;
   const show=(locked)=>{if(ticket!==accessEpoch)return;school.classList.toggle('locked',locked);label.hidden=!locked;label.textContent=`Lv.10 · 현재 ${level}`;school.setAttribute('aria-label',locked?'길드 교실 · 단장 Lv.10에 열림':'길드 교실 열기');};show(level<10);
   if(level<10&&ctx.isCloud())ctx.request('/api/school/guild',{kind:'state'}).then(data=>show(!!data.locked)).catch(()=>{});
  }
  // Only the game surface intercepts accidental browser zoom. Forms and the
  // browser's own menus retain their standard accessibility controls.
  document.addEventListener('wheel',e=>{if((e.ctrlKey||e.metaKey)&&e.target.closest?.('.board-viewport')&&!e.target.closest('input,textarea,[contenteditable=true]'))e.preventDefault();},{passive:false});
  return {render,layout};
 }
 return {create,enhanceHero,screenScale};
})();
