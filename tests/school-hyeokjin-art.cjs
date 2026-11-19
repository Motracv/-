// Render-source contract with decoded real atlases; no browser-layout claims.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{createCanvas,loadImage}=require('@napi-rs/canvas'),G=require('../school/engine.js');
const images=[];
class Image{set src(p){images.push(loadImage(path.resolve(p.split('?')[0])).then(img=>{this.img=img;this.width=this.naturalWidth=img.width;this.height=this.naturalHeight=img.height;this.onload();}));}}
function canvas(){const cv=createCanvas(1,1),c=cv.getContext('2d'),draw=c.drawImage.bind(c);c.drawImage=(im,...args)=>draw(im.img||im,...args);return cv;}
const document={createElement:canvas};const window={dispatchEvent(){}};const context={window,document,Image,Event,setTimeout,clearTimeout};vm.createContext(context);vm.runInContext(fs.readFileSync('school/hyeokjin-art.js','utf8'),context);
(async()=>{await Promise.all(images);const A=window.SchoolHyeokjinArt;await A.ready;const cv=createCanvas(500,320),c=cv.getContext('2d'),draw=c.drawImage.bind(c);let draws=0;c.drawImage=(im,...args)=>{if(args.length===8){assert(args[0]+args[2]<=im.width);assert(args[1]+args[3]<=im.height);assert(args.every(Number.isFinite));}draws++;draw(im.img||im,...args);};
for(const awake of [false,true])for(const mode of ['idle','walk',...Object.keys(G.HYEOKJIN_MOVES)])for(const reduced of [false,true]){
 for(let age=0;age<2800;age+=100){c.clearRect(0,0,500,320);const f={hyeokMode:mode,hyeokAwake:awake,hyeokAge:age,hyeokDuration:2300,hyeokHit:1300,time:age/1000,reduced,flip:awake};A.hero(c,250,250,3,f);assert.equal(c.getTransform().a,1);assert.equal(c.getTransform().e,0);assert(draws>0);const p=A.pose(f);assert(p.rect.pivot.y>0);}
}
for(const mode of Object.keys(G.HYEOKJIN_MOVES)){
 const u={id:'hyeokjin',hp:100,stunUntil:0,hyeokjin:{mode,began:1000,modeUntil:3300,used:true,until:9000,cast:{at:2300}}};
 for(const t of [1000,1300,2299,2300,2500,3000])A.effects(c,{unit:u,time:t,source:{x:80,y:250},targets:[{x:300,y:230}],scale:2,reduced:false});
 assert.equal(c.globalAlpha,1);assert.equal(c.globalCompositeOperation,'source-over');
 u.stunUntil=9999;assert.equal(A.frame(u,2200).hyeokMode,'idle');u.stunUntil=0;u.hp=0;assert.equal(A.frame(u,2200).hyeokMode,'idle');
}
const u={id:'hyeokjin',hp:10,hyeokjin:{mode:'ultimate',began:2000,modeUntil:4300,used:true,until:9000,cast:{at:3300}}};
const f=A.frame(u,3300),p=A.pose(f),clip=A.DATA.skills.ultimate;assert.equal(p.rect,A.DATA.sheets[clip.sheet].frames[clip.frames[clip.hitIndex]]);
const start=A.phase(u,2000),hit=A.phase(u,3300);assert.equal(start.flight,0);assert(Math.abs(hit.flight-1)<1e-8);assert.equal(hit.after,0);
const launchAt=2000+start.launch*1000;assert(A.phase(u,launchAt+100).flight>0);assert(A.phase(u,3299).flight<1);
for(const reduced of [false,true]){A.field(c,[u,u],3300,500,320,reduced);assert.equal(c.globalAlpha,1);assert.equal(c.globalCompositeOperation,'source-over');const shake=A.shake(u,3350,reduced);assert(Math.abs(shake.x)<=2.4&&Math.abs(shake.y)<=1.2);if(reduced)assert.equal(shake.x+shake.y,0);}
u.stunUntil=9999;assert.equal(A.phase(u,3300),null);u.stunUntil=0;u.hp=0;assert.equal(A.phase(u,3300),null);
// All modes, reversed arena facing, wide raid and tall mobile fields stay finite.
for(const mode of Object.keys(G.HYEOKJIN_MOVES))for(const [w,h] of [[480,280],[1000,560],[320,480]])for(const reversed of [false,true]){
 const def=G.HYEOKJIN_MOVES[mode],unit={id:'hyeokjin',hp:10,hyeokjin:{mode,began:0,modeUntil:def.duration+1000,used:true,until:9000,cast:{at:def.hit,targets:['one']}}};
 for(let t=0;t<def.duration;t+=125){A.effects(c,{unit,time:t,source:{x:reversed?w-60:60,y:h*.75},targets:[{id:'one',x:reversed?60:w-60,y:h*.75}],scale:1.8,viewport:{width:w,height:h},reduced:false});assert.equal(c.globalAlpha,1);assert.equal(c.getTransform().a,1);}
}
for(const file of ['school.html','school-sw.js'])assert(fs.readFileSync(file,'utf8').includes('hyeokjin-art.js'));
console.log('PASS real decoded atlases, all 8 motions × both forms × reduced/normal, bounded crops, stable transforms, death/stun and exact ultimate impact-frame mapping');
})().catch(e=>{console.error(e);process.exitCode=1;});
