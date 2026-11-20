/* Twin boss presentation only. No damage, rewards, storage or networking. */
(function(root){'use strict';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);},mix=(a,b,t)=>a+(b-a)*t;
const FRAMES=[
 {rect:[63,97,226,358],foot:[112,356]}, {rect:[378,166,261,286],foot:[130,283]},
 {rect:[709,176,450,275],foot:[154,272]}, {rect:[1149,206,347,246],foot:[127,243]},
 {rect:[52,601,223,358],foot:[125,355]}, {rect:[378,603,261,356],foot:[130,353]},
 {rect:[703,684,450,275],foot:[150,272]}, {rect:[1138,698,363,261],foot:[131,258]}
];
const COMBOS={cross:{name:'교차 협공',duration:5.4,hits:[1.58,1.58]},relay:{name:'추격 연계',duration:5.6,hits:[1.15,1.82]},slam:{name:'협공 · 내려찍기',duration:6,hits:[2.05,2.05]}};
function sample(t,kind='cross',reduced=false){
 const def=COMBOS[kind]||COMBOS.cross;t=clamp(t,0,def.duration);const hits=def.hits;
 const actors=hits.map((hit,i)=>{const home=i?1010:330,contact=i?850:490,charge=hit-(kind==='slam'?.85:.62),p=(t-charge)/(hit-charge);let pose=0,x=home,lift=0,rotation=0;
 if(t>=charge&&t<hit-.12){pose=1;x=home+(i?14:-14)*Math.sin(clamp(p)*Math.PI);}
 else if(t>=hit-.12&&t<hit+.14){pose=2;x=mix(home,contact,smooth((t-hit+.12)/.12));rotation=(i?-1:1)*.025;}
 else if(t>=hit+.14&&t<hit+.55){pose=3;x=contact;}
 else if(t>=hit+.55&&t<hit+1.25){pose=1;x=mix(contact,home,smooth((t-hit-.55)/.7));}
 if(kind==='slam'&&t>charge&&t<hit) {lift=Math.sin(clamp(p)*Math.PI)*105;x=mix(home,contact,smooth(p));}
 const breathing=pose===0&&!reduced?Math.sin(t*2.5+i)*1.4:0;
 if(reduced){x=t>=hit&&t<hit+.55?contact:home;lift=0;rotation=0;}
 return {id:i?'green':'red',frame:i*4+pose,x,y:570,groundX:x,groundY:570,lift:lift+breathing,rotation,facing:i?-1:1};});
 const impact=t-Math.max(...hits),phase=t<Math.min(...hits)-.65?'대치':t<Math.min(...hits)?'공격 예고':t<Math.max(...hits)+.2?'협동 타격':t<Math.max(...hits)+1.25?'회수':'대기';
 return {actors,t,kind,impact,hits,phase,duration:def.duration};
}
async function load(url){
 const img=new Image();img.src=url;await img.decode();const sheet=document.createElement('canvas');sheet.width=img.width;sheet.height=img.height;const c=sheet.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0);const source=c.getImageData(0,0,img.width,img.height),w=img.width,h=img.height,labels=new Int32Array(w*h),stack=new Int32Array(w*h);let index=0;
 // Connected silhouettes avoid neighbouring weapon tips in overlapping atlas rectangles.
 for(let p=0;p<labels.length;p++){if(labels[p]||source.data[p*4+3]<=16)continue;index++;let head=0,tail=0;stack[tail++]=p;labels[p]=index;while(head<tail){const k=stack[head++],x=k%w;for(const n of [x>0?k-1:-1,x<w-1?k+1:-1,k>=w?k-w:-1,k<(h-1)*w?k+w:-1])if(n>=0&&!labels[n]&&source.data[n*4+3]>16){labels[n]=index;stack[tail++]=n;}}}
 return FRAMES.map(f=>{const[x,y,fw,fh]=f.rect,counts=new Map();for(let sy=y;sy<y+fh;sy++)for(let sx=x;sx<x+fw;sx++){const id=labels[sy*w+sx];if(id)counts.set(id,(counts.get(id)||0)+1);}const id=[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0];if(!id)throw Error('도트 프레임을 읽지 못했어요.');const out=document.createElement('canvas');out.width=fw;out.height=fh;const oc=out.getContext('2d'),pixels=oc.createImageData(fw,fh);for(let dy=0;dy<fh;dy++)for(let dx=0;dx<fw;dx++){const p=(y+dy)*w+x+dx;if(labels[p]===id)pixels.data.set(source.data.subarray(p*4,p*4+4),(dy*fw+dx)*4);}oc.putImageData(pixels,0,0);return out;});
}
function shadow(c,a){c.save();c.fillStyle='#02071388';c.beginPath();c.ellipse(a.groundX,a.groundY+4,49,10,0,0,Math.PI*2);c.fill();c.fillStyle='#02071388';c.beginPath();c.ellipse(a.groundX,a.groundY+3,29,5,0,0,Math.PI*2);c.fill();c.restore();}
function sprite(c,frames,a,opacity=1,offset=0){const f=FRAMES[a.frame];c.save();c.globalAlpha=opacity;c.translate(a.x+offset,a.y-a.lift);c.scale(a.facing*.58,.58);c.rotate(a.rotation);c.imageSmoothingEnabled=false;c.drawImage(frames[a.frame],-f.foot[0],-f.foot[1]);c.restore();}
function effects(c,s,reduced){const t=s.t;
 for(let i=0;i<2;i++){const age=t-s.hits[i];if(age<-.55&&age>-.9){c.save();c.globalAlpha=.5;c.strokeStyle=i?'#9cf365':'#ff737b';c.lineWidth=2;c.setLineDash([10,9]);c.beginPath();c.moveTo(i?1010:330,582);c.lineTo(670,582);c.stroke();c.restore();}if(age<0||age>.48)continue;const f=1-age/.48;c.save();c.globalAlpha=f;c.strokeStyle=i?'#fff0ac':'#ffc6ac';c.shadowColor=i?'#ffc054':'#ff5a48';c.shadowBlur=reduced?0:16;c.lineCap='round';c.lineWidth=8*f;c.beginPath();c.moveTo(i?875:470,400);c.quadraticCurveTo(i?720:610,345,670,478);c.stroke();c.lineWidth=2;c.strokeStyle='#fffce6';c.stroke();c.restore();}
 const age=s.impact;if(age<0||age>1)return;c.save();c.globalAlpha=1-age;c.translate(670,478);const count=reduced?8:34;for(let i=0;i<count;i++){const a=i*2.399,dist=18+age*(90+i%7*27),len=(18+i%4*9)*(1-age);c.strokeStyle=i%3?'#ffc36b':'#fff7c4';c.lineWidth=i%3+1;c.beginPath();c.moveTo(Math.cos(a)*dist,Math.sin(a)*dist*.65);c.lineTo(Math.cos(a)*(dist+len),Math.sin(a)*(dist+len)*.65);c.stroke();}c.restore();c.save();c.strokeStyle='#ffe4aa';c.globalAlpha=(1-age)*.5;c.lineWidth=3;c.beginPath();c.ellipse(670,577,30+age*180,8+age*35,0,0,Math.PI*2);c.stroke();c.fillStyle='#b39169';for(let i=0;i<(reduced?4:14);i++){const dx=(i%2?1:-1)*(20+age*(45+i*9)),dy=-Math.sin(age*Math.PI)*(15+i%5*11);c.save();c.translate(670+dx,574+dy);c.rotate(i+age*5);c.fillRect(-4,-2,8+i%3*3,4);c.restore();}c.restore();}
function draw(c,frames,s,{reduced=false}={}){for(const a of s.actors)shadow(c,a);for(const a of s.actors){if(!reduced&&a.frame%4===2)for(let j=3;j>0;j--)sprite(c,frames,a,.07*(4-j),-a.facing*j*23);sprite(c,frames,a);}effects(c,s,reduced);}
const api={FRAMES,COMBOS,sample,load,draw};if(typeof module==='object'&&module.exports)module.exports=api;else root.SchoolTwinsArt=api;
})(globalThis);
