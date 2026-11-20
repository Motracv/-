'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const C=require('../school/recruit/cinema.js'),D=require('../school/recruit/data.js'),G=require('../school/engine.js');
const base=path.resolve(__dirname,'..');
(async()=>{
  assert.deepEqual(Object.keys(D.heroes).sort(),G.HEROES.map(h=>h.id).sort());
  const sheet=createCanvas(1600,1200),s=sheet.getContext('2d');s.fillStyle='#14223b';s.fillRect(0,0,1600,1200);
  let i=0;const artist=createCanvas(400,600),a=artist.getContext('2d');
  for(const hero of G.HEROES){
    const data=D.heroes[hero.id],images={};assert(C.THEMES[data.element]);assert(data.greeting.length>=10);assert.equal(data.frames.length,4);
    for(const file of new Set(data.frames.map(f=>f.file)))images[file]=await loadImage(path.join(base,file.split('?')[0]));
    for(const f of data.frames){const img=images[f.file];assert(f.rect.every(Number.isFinite));const [x,y,w,h]=f.rect;assert(w>100&&h>300);assert(x>=0&&y>=0&&x+w<=img.width&&y+h<=img.height);}
    for(const pose of [0,.5,1,1.5,2,2.5,3]){C.actor(a,images,data.frames,400,600,pose,15,false);const pix=a.getImageData(0,0,400,600).data;let solid=0;for(let k=3;k<pix.length;k+=4)if(pix[k]>128)solid++;assert(solid>13000,`${hero.id} visible in pose ${pose}`);assert.equal(a.globalAlpha,1);}
    const p=C.actorPlacement(data.frames[3],400,600,3);assert(p.y>=0&&p.y+p.height<=600);assert(Math.abs(p.height-Math.min(600*.94,400*.96*data.frames[3].rect[3]/data.frames[3].rect[2]))<2,`${hero.id} fits its full-body silhouette without cropping`);
    const x=(i%5)*320,y=Math.floor(i/5)*300;s.fillStyle=i%2?'#19304a':'#18273e';s.fillRect(x+2,y+2,316,296);s.drawImage(artist,x+66,y,188,282);s.fillStyle='#e6f2ff';s.font='15px sans-serif';s.fillText(`${hero.rarity} · ${hero.id}`,x+12,y+286);i++;
  }
  fs.writeFileSync('/tmp/recruit-live-roster.png',sheet.toBuffer('image/png'));
  const fx=createCanvas(960,540),f=fx.getContext('2d');const effectsSheet=createCanvas(1600,960),e=effectsSheet.getContext('2d');i=0;
  for(const element of Object.keys(C.THEMES)){
    for(const time of [0,8.7,9.5,10.6,11.5,12.4,12.7,13.5,15,18.2])for(const front of [false,true]){C.effects(f,960,540,time,element,'UR',front,false);assert.equal(f.globalAlpha,1);assert.equal(f.globalCompositeOperation,'source-over');}
    C.effects(f,960,540,9.6,element,'UR',false,false);e.drawImage(fx,(i%4)*400,Math.floor(i/4)*240,400,225);e.fillStyle='#fff';e.font='14px sans-serif';e.fillText(element,(i%4)*400+12,Math.floor(i/4)*240+22);i++;
  }
  fs.writeFileSync('/tmp/recruit-live-elements.png',effectsSheet.toBuffer('image/png'));
  for(const [w,h] of [[2560,1440],[3840,2160],[390,844],[844,390]]){const r=C.fitResolution(w,h,2);assert(r.width*r.height<=2205000);assert(Math.abs(r.width/r.height-w/h)<.005);}
  const logo=await loadImage(path.join(base,'school/assets/profile/rank-ntr.webp'));assert.equal(logo.width,logo.height);
  console.log(`PASS all ${G.HEROES.length} catalog characters, ${G.HEROES.length*4} source poses, ${G.HEROES.length*7} interpolated renders, ${Object.keys(C.THEMES).length} emblems, QHD/4K/mobile canvas budgets, square reward avatar`);
})().catch(e=>{console.error(e);process.exitCode=1;});
