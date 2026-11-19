/* Chapter 13–15 scenery and articulated pixel monsters. No simulation writes. */
window.SchoolExpansionArt=(()=>{
 'use strict';
 const atlas=new Image();let revision=0,loaded=false;atlas.onload=()=>{loaded=true;revision++;};atlas.src='school/assets/battlefields/chapters-13-15.webp?v=expansion1';
 const ink='#152137',gold='#e9bd70',paper='#e6dfd3';
 const box=(c,color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);};
 function poly(c,color,points){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
 function ring(c,color,x,y,rx,ry,angle=0){c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.stroke();}
 function eyes(c,y,color='#b9fbff'){box(c,ink,-9,y-2,7,7);box(c,ink,3,y-2,7,7);box(c,color,-7,y,3,3);box(c,color,5,y,3,3);}
 function star(c,x,y,r,color){const points=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,d=i%2?r*.43:r;points.push([Math.round(x+Math.cos(a)*d),Math.round(y+Math.sin(a)*d)]);}poly(c,color,points);}
 function monster(c,type,p){
  if(!['plaster','mirror','restorer','constellation','inverted_scope','chart','clockguard','pendulum','tuner','portrait','orrery','bellwarden'].includes(type))return false;
  const t=p.time||0,a=p.attack||0,swing=p.swing||0;
  c.save();
  if(type==='plaster'){
   box(c,ink,-13,-10,9,12);box(c,ink,6,-10,9,12);box(c,'#92949f',-12,-9,6,10);box(c,'#92949f',7,-9,6,10);
   poly(c,ink,[[-17,-30],[-10,-42],[10,-42],[17,-30],[14,-8],[-15,-8]]);box(c,paper,-11,-40,22,17);box(c,'#b8b5bf',-14,-23,28,14);box(c,'#f5eee1',-8,-39,4,12);eyes(c,-33,'#dab2ff');
   poly(c,'#736b94',[[-21-a*5,-25],[-8-a*5,-27],[-8-a*5,-9],[-16-a*5,-3],[-23-a*5,-10]]);box(c,gold,-20-a*5,-23,2,15);
  }else if(type==='mirror'||type==='portrait'){
   const boss=type==='portrait',w=boss?23:15,h=boss?51:39;box(c,ink,-w-3,-h-3,w*2+6,h+5);box(c,boss?'#aa754e':'#8195bd',-w,-h,w*2,h);box(c,boss?'#492951':'#264675',-w+4,-h+4,w*2-8,h-8);
   for(const x of [-w,w-3])box(c,gold,x,-h,3,h);box(c,'#f6d997',-w,-h,w*2,3);poly(c,boss?'#a76fc0':'#abdef1',[[-w+5,-h+5],[0,-h+5],[-w+5,-12]]);eyes(c,boss?-30:-24,boss?'#ff9edf':'#e0fbff');
   box(c,ink,-w+1,0,7,5);box(c,ink,w-7,0,7,5);box(c,boss?'#bd4ca2':'#82c9ed',-w-7-a*6,-24,8+a*6,5);box(c,gold,w+1,-31+swing,4,28);
   if(boss){box(c,'#ff91d7',w-3,-39+swing,11,10);for(let i=0;i<4;i++)box(c,'#8c55a9',-16+i*10,-6,4,8+i%2*4);}
  }else if(type==='restorer'){
   box(c,ink,-14,-31,28,29);box(c,'#75629c',-12,-29,24,25);box(c,'#c895f3',-9,-25,18,9);box(c,gold,-10,-37,20,7);eyes(c,-20,'#f8dcff');
   c.save();c.translate(-17,-17);c.rotate(-.3-a*.5);box(c,gold,-2,-19,4,31);box(c,'#f4c8dd',-4,-27,8,10);c.restore();for(let i=0;i<3;i++)box(c,['#ec8fcf','#84d8f1','#ddb1ff'][i],-9+i*8,-6+Math.sin(t*3+i)*2,4,6);
  }else if(type==='constellation'){
   star(c,0,-24,23,ink);star(c,0,-24,19,'#376282');star(c,0,-24,12,'#7cbbd6');eyes(c,-27);ring(c,gold,0,-24,27,8,t*.35);box(c,'#dcf7ff',-2,-11,4,10);
  }else if(type==='inverted_scope'){
   box(c,gold,-2,-37,4,34);poly(c,'#9a9db5',[[-18,-42],[18,-42],[7,-32],[-7,-32]]);box(c,ink,-24-a*5,-26,44,17);box(c,'#426882',-21-a*5,-24,39,13);box(c,gold,9,-24,4,13);box(c,'#bcf6ff',-25-a*5,-25,7,15);box(c,'#e4fbff',-24-a*5,-24,2,9);eyes(c,-21);star(c,12,-7,7,'#a1dcfa');
  }else if(type==='chart'){
   poly(c,ink,[[-19,-40],[19,-40],[17,-2],[8,-5],[0,1],[-8,-5],[-18,-1]]);box(c,'#387184',-16,-37,32,31);box(c,gold,-19,-42,38,4);box(c,gold,-19,-6,38,4);ring(c,'#91cbd2',0,-22,12,10);star(c,0,-22,9,'#dbf8ff');for(let i=0;i<3;i++)box(c,'#d2ffff',-11+i*10,-32+i%2*18,2,2);
  }else if(type==='clockguard'||type==='bellwarden'){
   const boss=type==='bellwarden';box(c,ink,-15,-10,10,13);box(c,ink,6,-10,10,13);box(c,'#7e6655',-13,-8,6,9);box(c,'#7e6655',8,-8,6,9);
   if(boss){poly(c,ink,[[-20,-48],[0,-58],[20,-48],[27,-14],[-27,-14]]);poly(c,'#b28148',[[-17,-46],[0,-54],[17,-46],[22,-17],[-22,-17]]);box(c,gold,-27,-17,54,6);}
   ring(c,gold,0,-25,boss?20:17,boss?20:17);box(c,'#263e54',-13,-38,26,26);eyes(c,-31,'#ffd492');box(c,gold,-1,-35,2,13);box(c,gold,0,-25,10,2);for(let i=0;i<8;i++){const r=boss?23:20,angle=i*Math.PI/4;box(c,gold,Math.cos(angle)*r-2,-25+Math.sin(angle)*r-2,4,4);}
   box(c,'#cfa45f',-24-a*6,-20,9+a*6,7);if(boss){ring(c,'#82d9f3',0,-28,32,10,Math.sin(t)*.2);}
  }else if(type==='pendulum'){
   box(c,ink,-12,-39,24,13);box(c,'#b48b58',-10,-37,20,9);eyes(c,-34,'#ffe6ac');const px=Math.sin(t*2.5)*7-a*9;c.strokeStyle=gold;c.lineWidth=3;c.beginPath();c.moveTo(0,-24);c.lineTo(px,-8);c.stroke();poly(c,gold,[[px,-16],[px+9,-7],[px,2],[px-9,-7]]);ring(c,'#e0d4a3',-17,-23,10,16,-.3-a*.3);box(c,'#d7f2ff',-31-a*4,-24,24,2);
  }else if(type==='tuner'){
   poly(c,ink,[[-16,-25],[-10,-39],[10,-39],[16,-25],[21,-9],[-21,-9]]);poly(c,'#ba945c',[[-13,-24],[-8,-36],[8,-36],[13,-24],[17,-12],[-17,-12]]);box(c,gold,-21,-12,42,4);box(c,'#ffe3a1',-4,-8,8,7);eyes(c,-27,'#c8ffce');ring(c,'#a3dfcd',0,-15,25,8,t*.25);
  }else if(type==='orrery'){
   star(c,0,-28,26,'#314b77');star(c,0,-28,18,'#a1efff');eyes(c,-30);for(let i=0;i<3;i++)ring(c,i%2?'#b7f7ff':gold,0,-28,30,10,t*.15+i*Math.PI/3);for(let i=0;i<4;i++){const angle=t*.4+i*Math.PI/2;star(c,Math.cos(angle)*30,-28+Math.sin(angle)*27,4,'#e5fbff');}
  }
  c.restore();return true;
 }
 function background(c,zone,w,h){
  if(zone<12||zone>14)return false;
  if(loaded){const ph=atlas.naturalHeight/3,ratio=Math.max(w/atlas.naturalWidth,h/ph),sw=w/ratio,sh=h/ratio;c.drawImage(atlas,(atlas.naturalWidth-sw)/2,(zone-12)*ph+(ph-sh)/2,sw,sh,0,0,w,h);}
  else{const colors=[['#362846','#8f6493'],['#172b48','#589cae'],['#322c36','#ad8556']][zone-12];box(c,colors[0],0,0,w,h);box(c,colors[1],0,h*.55,w,h*.45);c.strokeStyle='#ffffff26';c.lineWidth=1;for(let i=-5;i<8;i++){c.beginPath();c.moveTo(w*.5,h*.55);c.lineTo(i*w*.16,h);c.stroke();}}
  return true;
 }
 return {monster,background,get revision(){return revision;},get loaded(){return loaded;}};
})();
