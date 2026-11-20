'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const fixture=require('../tools/roster-render-fixture.cjs'),C=require('../school/recruit/cinema.js'),D=require('../school/recruit/data.js');
(async()=>{
 const {window:W,canvas}=await fixture(),Y=W.SchoolYahoArt;await Y.ready;
 const cv=canvas(400,320),c=cv.getContext('2d');
 const render=frame=>{c.clearRect(0,0,400,320);Y.draw(c,'yaho',150,255,4,frame);assert.equal(c.getTransform().a,1);assert.equal(c.globalAlpha,1);return crypto.createHash('sha256').update(cv.toBuffer('image/png')).digest('hex');};
 render({reduced:true});let top=320,bottom=0;const pix=c.getImageData(0,0,400,320).data;for(let y=0;y<320;y++)for(let x=0;x<400;x++)if(pix[(y*400+x)*4+3]>128){top=Math.min(top,y);bottom=Math.max(bottom,y);}
 assert(bottom<=256&&bottom>=251,'feet stay on the same baseline');assert(bottom-top>=135&&bottom-top<=152,'child silhouette is 24% shorter than former 192px body');
 const frames=new Set();for(const age of [.04,.12,.22,.35,.55])frames.add(render({attack:true,attackAge:age}));assert.equal(frames.size,5,'wind-up, sweep and recovery remain continuous between atlas poses');
 for(const stage of[1,2,3]){const frames=new Set();for(const age of[.1,.3,.6,1,1.5])frames.add(render({casting:true,yahoStage:stage,castAge:age}));assert.equal(frames.size,5,'separate skill phases '+stage);}
 for(const state of['dead','stunned','frozen'])assert.deepEqual(JSON.stringify(Y.motion({[state]:true,attack:true,attackAge:.2})),JSON.stringify(Y.motion({reduced:true})));
 for(const frame of D.heroes.yaho.frames)for(const [width,height]of[[400,600],[800,1600],[320,600]]){const smaller=C.actorPlacement(frame,width,height,3),normal=C.actorPlacement({...frame,displayScale:1},width,height,3);assert(Math.abs(smaller.height/normal.height-.76)<1e-8);assert(Math.abs(smaller.y+smaller.height-normal.y-normal.height)<1e-8);assert(smaller.x>=0&&smaller.y>=0);}
 const sheet=canvas(960,450),sc=sheet.getContext('2d');sc.fillStyle='#172638';sc.fillRect(0,0,960,450);for(let i=0;i<8;i++){const x=100+(i%4)*240,y=195+Math.floor(i/4)*220;W.SchoolArt.hero(sc,'yaho',x,y,3.2,i<4?{attack:true,attackAge:[.04,.16,.3,.6][i]}:{casting:true,yahoStage:[1,2,3,3][i-4],castAge:[.4,.5,.4,1][i-4]});}fs.writeFileSync('/tmp/yaho-polished.png',sheet.toBuffer('image/png'));
 console.log('PASS smaller anchored child stature, continuous fan choreography, distinct roar/protection/summon phases, interrupted motion and matching recruitment scale');
})().catch(e=>{console.error(e);process.exitCode=1;});
