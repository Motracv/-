/* Generated-art packing only. No creative artwork is drawn or recoloured here.
 * Usage: node tools/build-enemy-remake.cjs [/workspace/generated_images]
 */
const fs = require('node:fs');
const path = require('node:path');
const {createCanvas, loadImage} = require('@napi-rs/canvas');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'school/assets/enemy-remake');
const sourceDir = process.argv[2] || '/workspace/generated_images';
const provenance = JSON.parse(fs.readFileSync(path.join(out, 'provenance.json')));
const CELL = 256, FOOT = [128, 232];
const plans = [
  {key:'regular-a', sheet:'school-a', offset:0, ids:['chalk','clock','book','plant'], ys:[0,300,591,902,1254], xs:[[0,300,539,944,1254],[0,300,540,940,1254],[0,300,537,939,1254],[0,300,540,939,1254]]},
  {key:'regular-b', sheet:'school-a', offset:4, ids:['sport','telescope','frostbell','uniform'], ys:[0,303,618,918,1254], xs:[[0,303,551,936,1254],[0,303,553,936,1254],[0,303,553,936,1254],[0,303,541,936,1254]]},
  {key:'regular-c', sheet:'school-b', offset:0, ids:['flask','umbrella','compass','foxmask'], ys:[0,303,615,909,1254], xs:[[0,303,577,941,1254],[0,303,574,941,1254],[0,303,575,941,1254],[0,303,568,941,1254]]},
  {key:'regular-d', sheet:'school-b', offset:4, ids:['plaster','constellation','clockguard','chalk-warden'], ys:[0,315,611,894,1254], xs:[[0,310,568,950,1254],[0,310,565,950,1254],[0,285,550,950,1254],[0,288,568,950,1254]]},
  {key:'boss-a', sheet:'bosses', offset:0, ids:['armory-lord','library-lord','garden-heart','clock-warden'], ys:[0,291,587,889,1254], xs:[[0,316,570,952,1254],[0,328,570,951,1254],[0,303,544,943,1254],[0,280,555,943,1254]]},
  {key:'boss-b', sheet:'bosses', offset:4, ids:['astral-core','supply-chest','headmaster','abyss-queen'], ys:[0,303,603,943,1254], xs:[[0,303,566,941,1254],[0,313,561,937,1254],[0,309,549,937,1254],[0,304,542,942,1254]]},
];
const TYPES = [
 ['chalk','eraser','pencil'],['clock','locker','mop'],['book','scroll','ink'],
 ['plant','can','rake'],['ball','dumbbell','whistle'],['telescope','globe','crane'],
 ['frostbell','snowman','cone'],['uniform','desk','board'],['flask','scope','magnet'],
 ['bucket','pipe','umbrella'],['windsock','compass','kite'],['shrinebell','talisman','foxmask'],
 ['plaster','mirror','restorer'],['constellation','inverted_scope','chart'],['clockguard','pendulum','tuner'],
];
const regular = plans.slice(0,4).flatMap(x=>x.ids).slice(0,15);
const campaignRegular = regular.concat(['abyss-queen','garden-heart','astral-core','uniform','headmaster']);
const campaignBoss = ['chalk-warden','clock-warden','library-lord','garden-heart','armory-lord','astral-core','frostbell','armory-lord','astral-core','abyss-queen','headmaster','foxmask','chalk-warden','astral-core','clock-warden','abyss-queen','garden-heart','astral-core','headmaster','clock-warden'];
const SOURCE_PARTS = {
 'regular-b:0:2': [[551,0,385,200],[620,200,316,103]],
 'regular-b:1:2': [[553,303,383,187],[600,490,336,128]],
 'regular-b:3:2': [[541,918,395,200],[590,1118,346,136]],
 'boss-a:2:2': [[544,587,399,213],[590,800,353,89]],
 'boss-b:2:2': [[549,603,388,230],[590,833,347,110]],
};
function measure(ctx, rect) {
 const {x,y,w,h}=rect, data=ctx.getImageData(x,y,w,h).data;
 let left=w,top=h,right=-1,bottom=-1,opaque=0;
 for(let v=0;v<h;v++)for(let u=0;u<w;u++)if(data[(v*w+u)*4+3]>128){left=Math.min(left,u);top=Math.min(top,v);right=Math.max(right,u);bottom=Math.max(bottom,v);opaque++;}
 if(opaque<250)throw new Error('Empty generated sprite');
 let footLeft=w,footRight=-1;
 for(let v=Math.max(top,bottom-Math.max(8,Math.round((bottom-top)*.06)));v<=bottom;v++)for(let u=left;u<=right;u++)if(data[(v*w+u)*4+3]>128){footLeft=Math.min(footLeft,u);footRight=Math.max(footRight,u);}
 const footX=(footLeft+footRight)/2;
 return {...rect,left,top,right,bottom,footX,footY:bottom+1,bodyHeight:bottom-top+1,opaque};
}
async function main() {
 const manifest={version:1,cell:CELL,foot:FOOT,poseOrder:['idle','windup','attack','cast'],families:{},sheets:{},mappings:{types:Object.fromEntries(TYPES.flatMap((row,i)=>row.map(type=>[type,regular[i]]))),campaignRegular:campaignRegular.concat(campaignRegular.slice(0,5)),campaignBoss:campaignBoss.concat(campaignBoss.slice(0,5)),tower:{armory:'armory-lord',library:'library-lord',garden:'garden-heart',clock:'clock-warden',astral:'astral-core'},activities:{daily:'supply-chest',weekly:'headmaster'}},notes:['Kinds 20–24 use the corresponding kinds 0–4 artwork.','The three ordinary enemy variants in each base chapter share an illustrated family; combat roles remain independent.','Four different authored poses; cast sprites contain small integrated spell effects.','Use family bodyHeight to scale to drawHeight; every crop has foot [128,232].']};
 const sheets=Object.fromEntries(['school-a','school-b','bosses'].map(id=>[id,createCanvas(CELL*4,CELL*8)]));
 for(const plan of plans){
  const meta=provenance.sources.find(s=>s.key===plan.key),img=await loadImage(path.join(sourceDir,meta.file));
  const source=createCanvas(img.width,img.height),sc=source.getContext('2d');sc.drawImage(img,0,0);
  const ac=sheets[plan.sheet].getContext('2d');ac.imageSmoothingEnabled=false;
  for(let row=0;row<4;row++){
   const cells=[];
   for(let col=0;col<4;col++){
    const x=Math.round(plan.xs[row][col]*img.width/1254),right=Math.round(plan.xs[row][col+1]*img.width/1254),y=Math.round(plan.ys[row]*img.height/1254),bottom=Math.round(plan.ys[row+1]*img.height/1254);
    cells.push(measure(sc,{x,y,w:right-x,h:bottom-y}));
   }
   // Share one scale across a monster's entire animation. Keep extended weapons
   // and spell silhouettes within the destination cell, with clear gutters.
   let scale=176/cells[0].bodyHeight;
   for(const cell of cells)scale=Math.min(scale,118/Math.max(1,cell.footX-cell.left+3),118/Math.max(1,cell.right-cell.footX+3),222/Math.max(1,cell.footY-cell.top+3));
   const family={sheet:plan.sheet,row:plan.offset+row,frames:4,foot:FOOT,bodyHeight:+(cells[0].bodyHeight*scale).toFixed(3),drawHeight:plan.key.startsWith('boss')||plan.ids[row]==='chalk-warden'?116:68,crops:[]};
   cells.forEach((cell,col)=>{
    const left=Math.max(0,cell.left-3),top=Math.max(0,cell.top-3),right=Math.min(cell.w,cell.right+4),bottom=Math.min(cell.h,cell.bottom+4);
    const x=col*CELL,y=family.row*CELL,dx=x+FOOT[0]+(left-cell.footX)*scale,dy=y+FOOT[1]+(top-cell.footY)*scale;
    // Extended attacks pass above the preceding pose's cape or foot. These
    // stepped source rectangles separate the original sprites without
    // repainting, synthesizing, or removing any part of the target monster.
    const sourceParts=SOURCE_PARTS[`${plan.key}:${row}:${col}`]||null;
    ac.save();
    if(sourceParts){ac.beginPath();for(const[sx,sy,sw,sh]of sourceParts)ac.rect(x+FOOT[0]+(sx-cell.x-cell.footX)*scale,y+FOOT[1]+(sy-cell.y-cell.footY)*scale,sw*scale,sh*scale);ac.clip();}
    ac.drawImage(source,cell.x+left,cell.y+top,right-left,bottom-top,dx,dy,(right-left)*scale,(bottom-top)*scale);ac.restore();
    family.crops.push({x,y,w:CELL,h:CELL,foot:FOOT,source:meta.file,sourceBounds:[cell.x+left,cell.y+top,right-left,bottom-top],...(sourceParts?{sourceParts}:{}),sourceFoot:[cell.x+cell.footX,cell.y+cell.footY],scale:+scale.toFixed(6)});
   });
   manifest.families[plan.ids[row]]=family;
  }
 }
 for(const [id,sheet]of Object.entries(sheets)){
  const file=id+'.webp',bytes=sheet.toBuffer('image/webp',96);fs.writeFileSync(path.join(out,file),bytes);
  manifest.sheets[id]={file,width:sheet.width,height:sheet.height,columns:4,rows:8,cell:[CELL,CELL],foot:FOOT};
  console.log(id,sheet.width,sheet.height,Math.round(bytes.length/1024)+' KiB');
 }
 const emblemImage=await loadImage(path.join(sourceDir,provenance.emblem.file)),emblemSource=createCanvas(emblemImage.width,emblemImage.height),es=emblemSource.getContext('2d');es.drawImage(emblemImage,0,0);
 const e=measure(es,{x:0,y:0,w:emblemImage.width,h:emblemImage.height}),emblem=createCanvas(256,256),ec=emblem.getContext('2d'),size=Math.max(e.right-e.left+1,e.bottom-e.top+1),z=232/size;
 ec.imageSmoothingEnabled=false;ec.drawImage(emblemSource,e.left,e.top,e.right-e.left+1,e.bottom-e.top+1,128-(e.right-e.left+1)*z/2,128-(e.bottom-e.top+1)*z/2,(e.right-e.left+1)*z,(e.bottom-e.top+1)*z);
 fs.writeFileSync(path.join(out,'company-emblem.webp'),emblem.toBuffer('image/webp',98));
 manifest.emblem={file:'company-emblem.webp',width:256,height:256,source:provenance.emblem.file};
 fs.writeFileSync(path.join(out,'atlas.json'),JSON.stringify(manifest,null,2)+'\n');
 // Review image only, never a runtime background or generated character.
 const preview=createCanvas(4*192,24*160),p=preview.getContext('2d');p.fillStyle='#242d3e';p.fillRect(0,0,preview.width,preview.height);p.imageSmoothingEnabled=false;
 let line=0;
 for(const[id,f]of Object.entries(manifest.families)){
  p.fillStyle='#fff1d5';p.font='12px sans-serif';p.fillText(id,8,line*160+15);
  for(let col=0;col<4;col++)p.drawImage(sheets[f.sheet],col*CELL,f.row*CELL,CELL,CELL,col*192+24,line*160+18,140,140);
  line++;
 }
 fs.writeFileSync('/tmp/school-enemy-remake-contact.png',preview.toBuffer('image/png'));
 const validation=[];
 for(const[id,f]of Object.entries(manifest.families)){
  const c=sheets[f.sheet].getContext('2d');
  for(const[pose,crop]of f.crops.entries()){
   const d=c.getImageData(crop.x,crop.y,CELL,CELL).data;let opaque=0,edge=0;
   for(let y=0;y<CELL;y++)for(let x=0;x<CELL;x++){const a=d[(y*CELL+x)*4+3];if(a>128){opaque++;if(x<3||y<3||x>=CELL-3||y>=CELL-3)edge++;}}
   if(opaque<200||edge)throw new Error(`Invalid crop ${id}/${pose}: ${opaque} opaque, ${edge} edge pixels`);
   validation.push({family:id,pose:manifest.poseOrder[pose],opaquePixels:opaque,opaqueEdgePixels:edge});
  }
 }
 fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({frames:validation.length,alpha:true,transparentGutters:true,checks:validation},null,2)+'\n');
 console.log('Validated',validation.length,'transparent frames; contact sheet: /tmp/school-enemy-remake-contact.png');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
