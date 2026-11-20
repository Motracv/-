/* Twin presentation follows the authoritative boss combo clock; no combat writes. */
window.SchoolRaidTwinsArt=(()=>{
 'use strict';let frames=null,loading=null,retryAt=0;
 function load(){if(frames)return Promise.resolve(frames);if(loading)return loading;if(Date.now()<retryAt)return Promise.resolve(null);
  loading=SchoolTwinsArt.load('school/assets/twins/atlas.png?v=twins1').then(value=>{frames=value;SchoolTwinsFx.prepare(frames);return frames;}).catch(()=>{retryAt=Date.now()+5000;return null;}).finally(()=>{loading=null;});return loading;
 }
 function scene({battle,time,target,floor,h,reduced,live}){
  const combo=battle?.boss.combo,kind=combo?.id||'cross',def=SchoolTwinsArt.COMBOS[kind]||SchoolTwinsArt.COMBOS.cross;
  const scale=Math.min(1.05,Math.max(.42,h*.56/208)),origin={x:target.x-670*scale,y:target.y-570*scale};
  const paths=[{home:(760-origin.x)/scale,contact:850,contactY:540,y:(floor-h*.1-origin.y)/scale,facing:-1},{home:(895-origin.x)/scale,contact:870,contactY:600,y:(floor-origin.y)/scale,facing:-1}];
  const active=combo&&time>=combo.began&&time<=combo.hits[1]+1450;
  const hits=combo?[def.hits[0],def.hits[0]+(combo.hits[1]-combo.hits[0])/1000]:def.hits;
  const s=SchoolTwinsArt.sample(active?(time-combo.hits[0])/1000+hits[0]:0,kind,reduced,{paths,hits});
  if(!live||!active){s.t=0;s.impact=-10;s.hits=[10,10];}
  return{s,scale,origin,active:!!active&&live};
 }
 function draw(c,o,layer='body'){
  if(!frames){load();if(layer==='body'){c.save();c.fillStyle='#f6e2af';c.font='16px sans-serif';c.textAlign='center';c.fillText('홍 · 록 준비 중…',820,o.floor-90);c.restore();}return;}
  const {s,scale,origin,active}=scene(o);c.save();c.translate(origin.x,origin.y);c.scale(scale,scale);if(o.battle?.boss.hp===0)c.globalAlpha=.4;
  if(layer==='body'){if(active)SchoolTwinsFx.rear(c,frames,SchoolTwinsArt.FRAMES,s,{reduced:o.reduced});SchoolTwinsArt.draw(c,frames,s,{reduced:o.reduced,effects:false});}
  else if(active)SchoolTwinsFx.front(c,s,{reduced:o.reduced});c.restore();
 }
 return{load,scene,draw};
})();
