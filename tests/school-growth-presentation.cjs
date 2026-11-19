const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),G=require('../school/engine.js');
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');GlobalFonts.registerFromPath('assets/fonts/Galmuri11.woff2','Galmuri');
const root=path.resolve(__dirname,'..');class LocalImage extends Image{set src(v){super.src=v.startsWith('data:')?v:fs.readFileSync(path.join(root,v.split('?')[0]));}}
const window={SchoolRPG:G,SchoolCombatFeedback:require('../school/combat-feedback.js'),addEventListener(){},dispatchEvent(){},requestIdleCallback:f=>queueMicrotask(f)},document={createElement:()=>createCanvas(1,1)};
const sandbox={SchoolRPG:G,window,document,Image:LocalImage,Event,setTimeout,clearTimeout,performance,console,Promise};
for(const file of ['ascension-art.js','expansion-art.js','horas-skin-art.js','art.js','battle-polish.js'])vm.runInNewContext(fs.readFileSync('school/'+file,'utf8'),sandbox);
(async()=>{await Promise.all([window.SchoolArt.ready,window.SchoolArt.battlefieldsReady,window.SchoolAscensionArt.ready,window.SchoolHorasSkinArt.ready]);
 const canvas=createCanvas(960,560),c=canvas.getContext('2d');canvas.dataset={layout:'panorama',renderScale:1};
 const hashes=new Set();for(const stage of [1,61,66,71,76,81,86,91,96,101,106,111,116,121]){
  const s=G.create(1000,125);s.best=stage;s.stage=stage;s.wave=4;G.action(s,{kind:'team',team:['taeo','sua']},s.at);window.SchoolArt.draw(c,s,1,[],true);c.getImageData(0,0,1,1);assert.equal(c.getTransform().a,1);hashes.add(require('node:crypto').createHash('sha256').update(canvas.toBuffer('image/png')).digest('hex'));
  if(stage===96){fs.mkdirSync('/workspace/outputs/growth-update',{recursive:true});fs.writeFileSync('/workspace/outputs/growth-update/chapter20.png',canvas.toBuffer('image/png'));}
  for(const e of s.battle.enemies)window.SchoolArt.monster(c,e,700,420,{hitAge:.05,time:2,stage,wave:4});c.getImageData(0,0,1,1);
 }
 assert.equal(hashes.size,14,'Normal/new/hard backgrounds and bosses are distinct');
 const state=G.create(1000,23);state.units.horas={level:70,stars:3,xp:0,shards:0};state.redeemedCodes.push('HORAS_AFTER_SCHOOL_SKIN');G.action(state,{kind:'skin-equip',hero:'horas',skin:'horas_after_school'},1000);G.action(state,{kind:'team',team:['horas','sua','taeo']},1000);
 window.SchoolBattlePolish.focus(c,[{kind:'horas-cast',from:'horas',t:1000}],1200,960,560,false,()=>"horas_after_school");await new Promise(resolve=>setTimeout(resolve,50));
 window.SchoolArt.draw(c,state,1.2,[{kind:'horas-cast',from:'horas',time:1,battleId:state.battle.id}],false);c.getImageData(0,0,1,1);fs.writeFileSync('/workspace/outputs/growth-update/skin-cutin.png',canvas.toBuffer('image/png'));
 console.log('PASS real campaign compositor: 14 distinct original/new/hard scenes, damage overlays, balanced transforms and equipped illustration cut-in');
})().catch(e=>{console.error(e);process.exitCode=1;});
