/* Native canvas fixture for the production renderers (not a browser mockup). */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),G=require('../school/engine.js');
module.exports=async function fixture(){
  const pending=[],listeners={};let allocations=0;
  class LocalImage{
    set src(value){this.url=value;pending.push(loadImage(path.resolve(root,value.split('?')[0])).then(image=>{
      this.img=image;this.width=this.naturalWidth=image.width;this.height=this.naturalHeight=image.height;this.complete=true;this.onload?.();
    }));}
    get src(){return this.url;}
  }
  function canvas(w=1,h=1){
    allocations++;const cv=createCanvas(w,h),c=cv.getContext('2d'),draw=c.drawImage.bind(c);cv.dataset={};
    c.drawImage=(image,...args)=>draw(image.img||image,...args);return cv;
  }
  const window={SchoolRPG:G,addEventListener(n,f){(listeners[n]||=[]).push(f)},dispatchEvent(e){for(const f of listeners[e.type]||[])f(e)},requestIdleCallback:f=>queueMicrotask(f)};
  const box={window,document:{createElement:()=>canvas(),fonts:{ready:Promise.resolve(),addEventListener(){}}},SchoolRPG:G,Image:LocalImage,Event,Promise,setTimeout,clearTimeout,performance,console};
  for(const name of ['combat-feedback','expansion-art','ascension-art','ryusion','horas-skin-art','kazua-art','hyeokjin-art','osia-weapon-art','osia-breath-art','roster-art','enemy-manifest','enemy-art','art','battle-polish']){
    vm.runInNewContext(fs.readFileSync(path.join(root,'school',name+'.js'),'utf8'),box,{filename:name+'.js'});Object.assign(box,window);
    if(box.SchoolCombatFeedback)window.SchoolCombatFeedback=box.SchoolCombatFeedback;
  }
  await Promise.all(pending);await Promise.all([window.SchoolArt.ready,window.SchoolArt.horasReady,window.SchoolHorasSkinArt.ready,window.SchoolRosterArt.ready]);
  return {G,window,canvas,allocations:()=>allocations};
};
