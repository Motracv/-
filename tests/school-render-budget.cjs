// Real Canvas rasterization, with image loading omitted for a focused text test.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas'),G=require('../school/engine.js');
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','Galmuri');
function harness(source){
 let surfaces=0;
 const document={createElement:()=>{surfaces++;return createCanvas(300,150);},fonts:{ready:Promise.resolve(),addEventListener(){}}};
 const window={SchoolRPG:G,addEventListener(){},dispatchEvent(){},requestIdleCallback(){}};
 vm.runInNewContext(source,{window,document,SchoolRPG:G,Image:class{},Promise,Event,setTimeout:()=>0,clearTimeout(){}});
 return {art:window.SchoolArt,count:()=>surfaces};
}
function measure(source,save){
 const h=harness(source),canvas=createCanvas(1440,810),c=canvas.getContext('2d');
 const paint=t=>{
  c.resetTransform();c.fillStyle='#18253b';c.fillRect(0,0,1440,810);c.scale(1.44,1.44);
  // Two parties can produce dozens of distinct damage/heal labels per poll.
  for(let n=0;n<64;n++){
   const heal=n%3===0,critical=n%3===1;
   h.art.combatNumber(c,(heal?'+':'')+(125000+n*137+t).toLocaleString('en-US'),65+(n%8)*120,50+Math.floor(n/8)*65,critical?29:23,heal?'#a9ffd0':critical?'#ffd274':'#fff6dd',critical);
  }
  c.getImageData(0,0,1,1); // Flush native Canvas recording like a browser paint.
 };
 paint(0);const warm=h.count(),start=performance.now();
 for(let frame=0;frame<30;frame++)paint(Math.floor(frame/15)*50);
 const result={surfacesAfterWarmup:h.count()-warm,ms:Number((performance.now()-start).toFixed(1))};
 if(save)fs.writeFileSync(save,canvas.toBuffer('image/png'));
 return result;
}
const current=fs.readFileSync('school/art.js','utf8'),result=measure(current,process.env.RENDER_BUDGET_IMAGE);
assert(result.surfacesAfterWarmup<=64,'Only the next attack batch may create labels; repeated frames must reuse all 64 visible labels');
// Recovery invalidates graphics once, then resumes steady-state reuse.
const h=harness(current),c=createCanvas(1440,810).getContext('2d');
for(const width of [960,1440,2880]){
 c.canvas.width=width;c.setTransform(width/480,0,0,width/480,0,0);
 for(const value of ['0','1,234','+5,678','-90','12.5','방어 30','회피'])h.art.combatNumber(c,value,100,100,18,'#ffd274',true);
 for(let i=0;i<64;i++)h.art.combatNumber(c,(125000+i).toLocaleString('en-US'),100,100,18,'#ffd274',true);
 const before=h.count();for(let pass=0;pass<3;pass++)for(let i=0;i<64;i++)h.art.combatNumber(c,(125000+i).toLocaleString('en-US'),100,100,18,'#ffd274',true);
 c.getImageData(0,0,1,1);assert.equal(h.count(),before,'Visible amounts do not reallocate at '+width+'px');
}
h.art.resetRenderCache();h.art.combatNumber(c,'1,234',100,100,18,'#ffd274',true);
const reset=h.count();h.art.combatNumber(c,'1,234',100,100,18,'#ffd274',true);assert.equal(h.count(),reset);
console.log('PASS rapid-hit text texture budget, all common resolutions, signs/decimals, nonnumeric labels and graphics recovery',result);
if(process.env.RENDER_BEFORE_SOURCE)console.log('BEFORE',measure(fs.readFileSync(process.env.RENDER_BEFORE_SOURCE,'utf8')),'AFTER',result);
