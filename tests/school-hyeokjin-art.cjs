// Render-source contract with decoded real atlases; no browser-layout claims.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{createCanvas,loadImage}=require('@napi-rs/canvas'),G=require('../school/engine.js');
const images=[];
class Image{set src(p){images.push(loadImage(path.resolve(p.split('?')[0])).then(img=>{this.img=img;this.width=this.naturalWidth=img.width;this.height=this.naturalHeight=img.height;this.onload();}));}}
const window={dispatchEvent(){}};const context={window,Image,Event,setTimeout,clearTimeout};vm.createContext(context);vm.runInContext(fs.readFileSync('school/hyeokjin-art.js','utf8'),context);
(async()=>{await Promise.all(images);const A=window.SchoolHyeokjinArt;await A.ready;const cv=createCanvas(500,320),c=cv.getContext('2d'),draw=c.drawImage.bind(c);let draws=0;c.drawImage=(im,...args)=>{if(args.length===8){assert(args[0]+args[2]<=im.width);assert(args[1]+args[3]<=im.height);assert(args.every(Number.isFinite));}draws++;draw(im.img,...args);};
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
for(const file of ['school.html','school-sw.js'])assert(fs.readFileSync(file,'utf8').includes('hyeokjin-art.js'));
console.log('PASS real decoded atlases, all 8 motions × both forms × reduced/normal, bounded crops, stable transforms, death/stun and exact ultimate impact-frame mapping');
})().catch(e=>{console.error(e);process.exitCode=1;});
