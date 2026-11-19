const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const {createCanvas,Image}=require('@napi-rs/canvas'),G=require('../school/engine.js');
let draws=0;const root=path.resolve(__dirname,'..'),listeners={};
class LocalImage extends Image{set src(v){this.url=v;super.src=v.startsWith('data:')?v:fs.readFileSync(path.join(root,v.split('?')[0]));}get src(){return this.url;}}
const document={createElement:()=>createCanvas(1,1)},window={SchoolRPG:G,addEventListener(n,f){(listeners[n]||=[]).push(f);},dispatchEvent(e){for(const f of listeners[e.type]||[])f(e);},requestIdleCallback:f=>queueMicrotask(f)};
const sandbox={window,document,Image:LocalImage,SchoolRPG:G,Event,Promise,console,setTimeout,clearTimeout,performance};
for(const file of ['horas-skin-art.js','art.js','battle-polish.js'])vm.runInNewContext(fs.readFileSync(path.join(root,'school',file),'utf8'),sandbox);
(async()=>{
 await Promise.all([window.SchoolArt.ready,window.SchoolHorasSkinArt.ready]);const A=window.SchoolArt,S=window.SchoolHorasSkinArt,ID=S.ID,canvas=createCanvas(960,560),c=canvas.getContext('2d');
 const original=S.hero;window.SchoolHorasSkinArt={...S,hero(...args){draws++;return original(...args);}};
 for(const frame of [{},{attackAge:.24},{horasCastAge:1.42},{horasCastAge:2.1},{dead:true},{frozen:true},{stunned:true},{reduced:true,horasCastAge:.6}]){c.clearRect(0,0,960,560);A.hero(c,'horas',150,400,3,{skin:ID,time:2,...frame});c.getImageData(0,0,1,1);assert.equal(c.globalAlpha,1);assert.equal(c.getTransform().a,1);}
 assert.equal(draws,8);A.hero(c,'horas',150,400,3,{});assert.equal(draws,8,'Base appearance remains independent');
 assert.equal(A.portrait('horas',ID),S.portrait());assert.equal(A.rosterPortrait('horas',ID),S.portrait());assert.notEqual(A.portrait('horas'),S.portrait());
 const calls=[];window.SchoolHorasSkinArt={...S,effects(ctx,opt){calls.push(opt);return S.effects(ctx,opt);}};
 const positions={horas:{x:140,y:280},enemy:{x:390,y:280}},battle={elapsed:1000,heroes:[{id:'horas',hp:20,skin:ID}],horasCast:{began:0,targetId:'enemy'},horasActorScale:2.3};A.horasVisualEffects(c,battle,[],positions,1);assert.equal(calls.at(-1).kind,'cast');assert.equal(calls.at(-1).actorScale,2.3);
 delete battle.horasCast;A.horasVisualEffects(c,battle,[{kind:'horas-impact',time:1,targetId:'enemy',targets:['enemy']}],positions,1.2);assert.equal(calls.at(-1).kind,'impact');
 const count=calls.length;battle.heroes[0].hp=0;A.horasVisualEffects(c,battle,[{kind:'horas-impact',time:1,targetId:'enemy'}],positions,1.2);assert.equal(calls.length,count);
 const events=[{id:'horas',kind:'cast',shown:0},{id:'horas',kind:'hit',skill:'벚꽃의식',shown:1500}];A.horasCoopEffects(c,{unit:{id:'horas',skin:ID,hp:10},events,now:1800,time:1800,source:positions.horas,targets:[positions.enemy]});assert.equal(calls.at(-1).kind,'impact');const after=calls.length;A.horasCoopEffects(c,{unit:{id:'horas',skin:ID,hp:10},events,now:1800,time:1800,frozen:true,source:positions.horas,targets:[positions.enemy]});assert.equal(calls.length,after);
 window.SchoolHorasSkinArt={...S,hero(...args){calls.push(args[4]);return S.hero(...args);}};const images=[];const drawImage=c.drawImage.bind(c);c.drawImage=(img,...args)=>{images.push(img.url||'');return drawImage(img,...args);};window.SchoolBattlePolish.focus(c,[{kind:'horas-cast',from:'horas',side:1,t:1000}],1200,960,560,false,shot=>shot.side===1?ID:null);assert(images.some(src=>src.includes('horas-after-school/profile.webp')),'Equipped skin uses the approved face illustration');assert.equal(c.globalAlpha,1);assert.equal(c.getTransform().a,1);
 const coop=window.SchoolBattlePolish.latest([{kind:'cast',id:'horas',team:1,shown:1000}],1200);assert.equal(coop.id,'horas');assert.equal(coop.team,1);
 console.log('PASS native production compositor: skin/base dispatch, bounded frozen/dead frames, portraits, cast/impact replacement, cooperative freeze and scoped skill cut-in');
})().catch(e=>{console.error(e);process.exitCode=1;});
