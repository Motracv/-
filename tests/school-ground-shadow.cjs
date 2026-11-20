const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const {G,window:W,canvas,allocations}=await require('../tools/roster-render-fixture.cjs')();
 const cv=canvas(3840,2160),c=cv.getContext('2d'),draw=c.drawImage.bind(c);let shadows=[];
 c.drawImage=(image,...args)=>{if(image.width===128&&image.height===32)shadows.push(args);return draw(image,...args);};
 for(const h of G.HEROES){let reference;
  for(const jump of [0,-15,-45,0]){shadows=[];W.SchoolArt.hero(c,h.id,220,300+jump,3,{groundX:220,groundY:300,time:1,casting:true,castAge:.8});assert.equal(shadows.length,1,h.id+' gets exactly one ground shadow');if(reference)assert.deepEqual(shadows[0],reference,h.id+' shadow cannot jump with actor');reference=shadows[0];}
 }
 shadows=[];W.SchoolArt.hero(c,'horas',220,260,3,{groundX:220,groundY:300,skin:'horas_after_school',time:2});assert.equal(shadows.length,1);
 const count=allocations();for(let i=0;i<100;i++)W.SchoolArt.groundShadow(c,220,300,3);assert.equal(allocations(),count,'shadow surface cached across frames');
 console.log('PASS 20 heroes keep one fixed floor shadow through jump samples, cached drawing, 4K canvas');
})().catch(e=>{console.error(e);process.exitCode=1;});
