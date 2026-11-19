// Decode the production WebP and exercise real native Canvas transforms and crops.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,Image,loadImage}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),manifest=require('../school/assets/horas-after-school/combat.json');
let canvases=0,decodes=0,events=0,encoding=0;
class LocalImage extends Image {
  set src(value){this.url=value;decodes++;super.src=fs.readFileSync(path.join(root,value.split('?')[0]));}
  get src(){return this.url;}
}
const document={createElement(type){assert.equal(type,'canvas');canvases++;const canvas=createCanvas(1,1),toDataURL=canvas.toDataURL.bind(canvas);canvas.toDataURL=(...args)=>{encoding++;return toDataURL(...args);};return canvas;}};
const window={dispatchEvent(){events++;}};
vm.runInNewContext(fs.readFileSync(path.join(root,'school/horas-skin-art.js'),'utf8'),{window,document,Image:LocalImage,Event,Promise,setTimeout,clearTimeout,console});
const A=window.SchoolHorasSkinArt;
function context(canvas){
  const c=canvas.getContext('2d'),records=[],stack=[];
  const proxy=new Proxy(c,{get(target,key){
    if(key==='records')return records;if(key==='stack')return stack;
    const value=target[key];if(typeof value!=='function')return value;
    return (...args)=>{
      for(const v of args)if(typeof v==='number')assert(Number.isFinite(v),key+' must be finite');
      if(key==='save')stack.push(1);if(key==='restore')assert(stack.pop(),'balanced canvas stack');
      if(key==='drawImage'){
        if(args.length===9){const [im,x,y,w,h]=args;assert(x>=0&&y>=0&&w>0&&h>0);assert(x+w<=im.width+.01&&y+h<=im.height+.01,'source crop inside image');}
        records.push([key,...args]);
      }else records.push([key,...args]);
      return value.apply(target,args);
    };
  },set(target,key,value){target[key]=value;return true;}});
  return proxy;
}
const normalized=t=>[t.a,t.b,t.c,t.d,t.e,t.f].map(v=>Math.round(v*1e9)/1e9);
function checksum(canvas){const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let h=2166136261;for(let i=0;i<data.length;i++){h^=data[i];h=Math.imul(h,16777619);}return h>>>0;}
(async()=>{
  assert.equal(await A.ready,true);assert(A.active(A.ID));assert(!A.active('horas_other'));assert(A.assetsReady());assert.equal(decodes,1);assert.equal(events,1);
  assert.equal(A.frames.length,12);assert.equal(manifest.sourceSize[0],1536);assert.equal(manifest.sourceSize[1],1024);
  for(const f of manifest.frames){assert.deepEqual(Array.from(A.frames[f.index]),[...f.rect,...f.anchor]);assert(f.anchor[1]<=f.rect[3]);}
  assert.deepEqual(JSON.parse(JSON.stringify(A.timing)),{basic:1.18,release:.18,impact:1.5,cast:2.45});
  const image=await loadImage(path.join(root,'school/assets/horas-after-school/combat.webp'));
  const raw=createCanvas(image.width,image.height),rc=raw.getContext('2d');rc.drawImage(image,0,0);
  const rgba=rc.getImageData(0,0,raw.width,raw.height).data;
  for(const f of manifest.frames){
    const [x,y,w,h]=f.rect;let bottom=-1;
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(rgba[((y+yy)*raw.width+x+xx)*4+3]>128)bottom=yy;
    assert.equal(bottom+1,f.anchor[1],'measured foot line preserved by lossless encoding '+f.index);
  }
  console.log('PASS exact approved 12-pose crops, measured feet, source dimensions and canonical timing');
  const canvas=createCanvas(640,400),c=context(canvas);
  const basicTimes=[.1,.26,.55,1.03],castTimes=[.14,.5,1,1.6,2.03,2.36];
  assert.deepEqual(basicTimes.map(attackAge=>A.phase({attackAge}).pose),[1,2,3,0]);
  assert.deepEqual(basicTimes.map(attackAge=>A.phase({attackAge,horasBasicPose:2}).pose),[4,5,6,0]);
  assert.deepEqual(castTimes.map(horasCastAge=>A.phase({horasCastAge}).pose),[7,8,9,10,11,0]);
  assert.equal(A.phase({hit:true}).pose,0,'hurt never uses wink');
  assert.equal(A.phase({horasCastAge:2.45}).mode,'idle');assert.equal(A.phase({attackAge:1.18}).mode,'idle');
  assert.equal(A.phase({horasCastAge:1.4,attackAge:.2}).mode,'cast','cast takes precedence');
  for(const boundary of [.18,.34,.91]){
    const a=A.motion({attackAge:boundary-.00001}),b=A.motion({attackAge:boundary+.00001});
    assert(Math.abs(a.x-b.x)<.01&&Math.abs(a.y-b.y)<.01,'continuous movement across basic pose change');
  }
  for(const boundary of [.28,.82,1.38,1.5,1.565,1.9,2.27]){
    const a=A.motion({horasCastAge:boundary-.00001}),b=A.motion({horasCastAge:boundary+.00001});
    assert(Math.abs(a.x-b.x)<.01&&Math.abs(a.y-b.y)<.01,'continuous cast movement');
  }
  assert(A.phase({attackAge:.19}).blend>0&&A.phase({attackAge:.19}).blend<1,'short authored pose blend');
  for(const attackAge of [.18,.2,.26,.34,.4,.7])for(const horasBasicPose of [1,2]){
    const hand=A.hand({attackAge,horasBasicPose});assert(Number.isFinite(hand.x)&&Number.isFinite(hand.y));assert(hand.y<0&&hand.y>-50,'sweep stays on raised hand');
  }
  const shots=[];
  for(const [mode,t] of [['basicA',.26],['basicB',.26],['cast',1],['cast',2.03],['idle',0]]){
    c.clearRect(0,0,640,400);const frame={skin:A.ID,time:t,horasStacks:0};if(mode==='cast')frame.horasCastAge=t;else if(mode.startsWith('basic')){frame.attackAge=t;frame.horasBasicPose=mode==='basicB'?2:1;}
    const frozen=JSON.stringify(frame);assert(A.hero(c,240,320,4,frame));assert.equal(JSON.stringify(frame),frozen);assert.equal(c.stack.length,0);shots.push(checksum(canvas));
  }
  assert.equal(new Set(shots).size,shots.length,'all authored gestures render distinct native pixels');
  for(const flag of ['dead','frozen','stunned','reduced']){
    const draw=t=>{c.clearRect(0,0,640,400);A.hero(c,240,320,4,{skin:A.ID,time:t,attackAge:t,horasCastAge:t,horasStacks:5,[flag]:true});return checksum(canvas);};
    assert.equal(draw(.5),draw(1.7),flag+' holds stable body and has no stale emote');
    assert.equal(A.phase({horasCastAge:2.03,[flag]:true}).pose,0);
  }
  assert.equal(A.hero(c,1,1,1,{skin:'wrong'}),false);assert.equal(A.hero(c,NaN,1,1,{skin:A.ID}),false);
  console.log('PASS distinct live poses, continuous movement/short blends, wink-only recovery, dead/stun/frozen/reduced cancellation');
  // Every density bucket is pre-warmed once. Cache size must not grow with time,
  // sprite size, input attack IDs, zoom, or repeated portrait/cutin requests.
  const frames=[{time:0},...basicTimes.map(attackAge=>({attackAge})),...basicTimes.map(attackAge=>({attackAge,horasBasicPose:2})),...castTimes.map(horasCastAge=>({horasCastAge}))];
  for(const scale of [1,4])for(const frame of frames)A.hero(c,240,320,scale,{...frame,skin:A.ID});
  const portrait=A.portrait(),cutin=A.cutin();assert(portrait.startsWith('data:image/png;base64,'));assert(cutin.startsWith('data:image/png;base64,'));
  const warm={canvases,decodes,encoding};
  for(let i=0;i<200;i++){
    const frame={...frames[i%frames.length],skin:A.ID,time:i/60,flip:!!(i%2),horasStacks:i%6};
    c.globalAlpha=.63;c.translate(.1,.2);const transform=normalized(c.getTransform()),alpha=c.globalAlpha;
    A.hero(c,240,320,i%2?1:4,frame);
    assert.equal(c.stack.length,0);assert.equal(c.globalAlpha,alpha);assert.deepEqual(normalized(c.getTransform()),transform);
    assert.equal(A.portrait(),portrait);assert.equal(A.cutin(),cutin);assert.strictEqual(A.portraitSource(),A.portraitSource());
  }
  assert.deepEqual({canvases,decodes,encoding},warm,'no ongoing texture extraction/decode/encoding');
  assert(A.cacheInfo().pixels<=A.cacheInfo().maxPixels);assert(A.cacheInfo().poses<=24);
  console.log('PASS bounded frame cache, cached portraits/cutins and restored native Canvas transforms/alpha');
  const options={source:{x:100,y:300},targets:Array.from({length:30},(_,i)=>({x:350+i*4,y:300,aimY:260})),scale:1,viewport:{width:640,height:400}};
  const input=JSON.stringify(options),warmFx={canvases,decodes,encoding};let maximum=0;
  for(let i=0;i<50;i++)for(const kind of ['basic','cast','impact','fusion','emote']){
    c.records.length=0;const before=normalized(c.getTransform()),alpha=c.globalAlpha;
    A.effects(c,{...options,kind,age:i/40,reduced:!!(i%3===0),economy:!!(i%2),flip:!!(i%2),pose:i%2+1});
    maximum=Math.max(maximum,c.records.length);assert.equal(c.stack.length,0);assert.equal(c.globalAlpha,alpha);assert.deepEqual(normalized(c.getTransform()),before);
  }
  assert(maximum<1300,'bounded effects command count: '+maximum);assert.deepEqual({canvases,decodes,encoding},warmFx);assert.equal(JSON.stringify(options),input);
  for(const flag of ['dead','frozen','stunned']){c.records.length=0;assert.equal(A.effects(c,{...options,kind:'cast',age:1,[flag]:true}),false);assert.equal(c.records.length,0);}
  for(const bad of [{source:{x:NaN,y:0}},{age:-1},{age:9},{kind:'other'}]){c.records.length=0;A.effects(c,{...options,kind:'impact',age:.2,...bad});assert.equal(c.records.length,0);}
  c.records.length=0;A.effects(c,{...options,kind:'impact',age:.2,missed:true});const missCommands=c.records.length;
  c.records.length=0;A.effects(c,{...options,kind:'impact',age:.2});assert(missCommands<c.records.length,'misses omit hit bursts and extra target blooms');
  console.log('PASS bounded VFX for 30-target input, distinct sweeps, event expiry, miss/blocked gates and no per-frame allocations ('+maximum+' max commands)');
  if(process.env.HORAS_SKIN_ART_OUTPUT){
    const out=process.env.HORAS_SKIN_ART_OUTPUT;fs.mkdirSync(out,{recursive:true});
    const samples=[['대기',{time:0}],['별빛 가르기',{attackAge:.28}],['꽃별 올려치기',{attackAge:.28,horasBasicPose:2}],['별빛 축적',{horasCastAge:.5}],['성좌 개화',{horasCastAge:1.05}],['궁극기 명중',{horasCastAge:1.65}],['윙크',{horasCastAge:2.08}],['낮은 효과',{horasCastAge:1.65,reduced:true}]];
    const sheet=createCanvas(1280,640),sc=sheet.getContext('2d');
    samples.forEach(([label,frame],i)=>{
      sc.save();sc.translate(i%4*320,Math.floor(i/4)*320);sc.fillStyle='#142138';sc.fillRect(0,0,320,320);sc.strokeStyle='#435d75';sc.lineWidth=1;sc.beginPath();sc.moveTo(0,274);sc.lineTo(320,274);sc.stroke();
      A.hero(sc,100,270,4,{skin:A.ID,horasStacks:3,...frame});
      if(frame.attackAge)A.effects(sc,{source:{x:100,y:270},targets:[{x:267,y:270}],kind:'basic',age:frame.attackAge,pose:frame.horasBasicPose,scale:1,actorScale:4});
      if(frame.horasCastAge)A.effects(sc,{source:{x:100,y:270},targets:[{x:260,y:270}],kind:frame.horasCastAge<1.5?'cast':'impact',age:frame.horasCastAge<1.5?frame.horasCastAge:frame.horasCastAge-1.5,scale:.8,reduced:frame.reduced});
      sc.fillStyle='#f4dcf0';sc.font='17px sans-serif';sc.fillText(label,16,26);sc.restore();
    });
    fs.writeFileSync(path.join(out,'production-contact-sheet.png'),sheet.toBuffer('image/png'));
  }
  console.log('PASS Horas cosmetic art native tests');
})().catch(error=>{console.error(error);process.exitCode=1;});
