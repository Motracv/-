/* Asset packing only: generated RGBA artwork is not repainted or recoloured.
   Usage: node tools/build-roster-art.cjs [generated_images directory] */
const fs=require('node:fs'),path=require('node:path'),{createCanvas,loadImage}=require('@napi-rs/canvas');
const sourceDir=process.argv[2]||'/workspace/generated_images',out=path.resolve('school/assets/roster-remake');
const sources=[
 {key:'students-a',file:'exec-23233854-9bb1-4a43-ab12-fe557411e59d.png',cols:4,rows:4,heroes:['geonu','nari','harin','seoyun']},
 {key:'students-b',file:'exec-b58f2887-65a6-41b9-ab91-1c0df453af42.png',cols:4,rows:4,heroes:['taeo','yuna','minjae','sua']},
 {key:'students-c',file:'exec-5ed24104-e7af-4d13-b50a-7970a92d224d.png',cols:4,rows:5,heroes:['jiho','siu','doyoon','ian','lumi']},
 {key:'osia',file:'exec-452ea3eb-dd45-4e8d-a10f-db136dbd0471.png',cols:3,rows:2,size:[512,512],foot:[256,488],height:460},
 {key:'ryusion',file:'exec-eab86f9e-cd1a-48ab-8c9d-9ccad8522573.png',cols:4,rows:2,size:[384,512],foot:[192,440],height:352},
 {key:'spica',file:'exec-2eb35f89-3c62-4d0b-b31e-3b6d31e74e53.png',cols:4,rows:2,size:[384,384],foot:[192,356],height:340},
 {key:'lava',file:'exec-351f8397-1127-43b6-a999-9077bda05b2d.png',cols:5,rows:2,size:[384,384],foot:[192,356],height:340}
];
// Individual source rectangles preserve weapons extending across a nominal
// grid line without copying the following character into the previous cell.
const rectOverrides={
 'students-a':{10:{right:990},11:{x:990,bottom:920},15:{y:920}},
 'students-b':{7:{bottom:600},11:{y:600}},
 'students-c':{11:{bottom:822},15:{y:822,bottom:1100},19:{y:1100}}
};
function measure(ctx,x,y,w,h){
 const p=ctx.getImageData(x,y,w,h).data;let left=w,right=-1,top=h,bottom=-1,count=0;
 for(let v=0;v<h;v++)for(let u=0;u<w;u++)if(p[(v*w+u)*4+3]>128){left=Math.min(left,u);right=Math.max(right,u);top=Math.min(top,v);bottom=Math.max(bottom,v);count++;}
 if(count<100)throw Error('Missing sprite');
 let a=w,b=-1;for(let v=Math.max(top,bottom-8);v<=bottom;v++)for(let u=left;u<=right;u++)if(p[(v*w+u)*4+3]>128){a=Math.min(a,u);b=Math.max(b,u);}
 return {x,y,w,h,left,right,top,bottom,footX:(a+b)/2,footY:bottom+1,bodyHeight:bottom-top+1};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const manifest={version:1,cell:256,foot:[128,232],bodyHeight:176,heroes:{},sheets:{}};
 for(const item of sources){
  const img=await loadImage(path.join(sourceDir,item.file)),source=createCanvas(img.width,img.height),sc=source.getContext('2d');sc.drawImage(img,0,0);
  const [cw,ch]=item.size||[256,256],[fx,fy]=item.foot||[128,232],body=item.height||176;
  const atlas=createCanvas(cw*item.cols,ch*item.rows),ac=atlas.getContext('2d');ac.imageSmoothingEnabled=false;
  const cells=[];for(let row=0;row<item.rows;row++)for(let col=0;col<item.cols;col++){
   const override=rectOverrides[item.key]?.[row*item.cols+col]||{};
   const x=override.x??Math.round(col*img.width/item.cols),y=override.y??Math.round(row*img.height/item.rows),w=(override.right??Math.round((col+1)*img.width/item.cols))-x,h=(override.bottom??Math.round((row+1)*img.height/item.rows))-y;
   cells.push(measure(sc,x,y,w,h));
  }
  const frames=[];
  cells.forEach((cell,i)=>{
   const row=Math.floor(i/item.cols),col=i%item.cols,base=cells[item.heroes?row*item.cols:0],scale=body/base.bodyHeight;
   const dx=col*cw+fx-cell.footX*scale,dy=row*ch+fy-cell.footY*scale;
   ac.save();ac.beginPath();ac.rect(col*cw,row*ch,cw,ch);ac.clip();
   const left=Math.max(0,cell.left-2),top=Math.max(0,cell.top-2),right=Math.min(cell.w,cell.right+3),bottom=Math.min(cell.h,cell.bottom+3);
   ac.drawImage(source,cell.x+left,cell.y+top,right-left,bottom-top,dx+left*scale,dy+top*scale,(right-left)*scale,(bottom-top)*scale);ac.restore();
   frames.push({source:cell,scale,destination:[dx-col*cw,dy-row*ch,cell.w*scale,cell.h*scale]});
  });
  const bytes=atlas.toBuffer('image/webp',96);fs.writeFileSync(path.join(out,item.key+'.webp'),bytes);
  manifest.sheets[item.key]={file:item.key+'.webp',width:atlas.width,height:atlas.height,columns:item.cols,rows:item.rows,cell:[cw,ch],foot:[fx,fy],bodyHeight:body,source:item.file,frames};
  if(item.heroes)item.heroes.forEach((id,row)=>manifest.heroes[id]={sheet:item.key,row,frames:4});
  console.log(item.key,atlas.width,atlas.height,Math.round(bytes.length/1024)+' KiB');
 }
 fs.writeFileSync(path.join(out,'atlas.json'),JSON.stringify(manifest,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
