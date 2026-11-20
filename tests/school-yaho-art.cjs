'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),fixture=require('../tools/roster-render-fixture.cjs');
(async()=>{const {window:W,canvas,G}=await fixture(),Y=W.SchoolYahoArt;await Y.ready;assert(Y.assetsReady());
 const sheet=canvas(1200,640),c=sheet.getContext('2d');c.fillStyle='#16263b';c.fillRect(0,0,1200,640);
 const frames=[{},{blink:true},{walking:true,time:0},{walking:true,time:.2},{attack:true,attackAge:.05},{attack:true,attackAge:.3},{casting:true,yahoStage:1,castAge:.2},{casting:true,yahoStage:1,castAge:1},{casting:true,yahoStage:2,castAge:.2},{casting:true,yahoStage:3,castAge:.3},{victory:true},{hit:true}];
 for(let i=0;i<frames.length;i++){const x=150+i%4*300,y=180+Math.floor(i/4)*210;c.strokeStyle='#2d4666';c.beginPath();c.moveTo(x-95,y);c.lineTo(x+95,y);c.stroke();W.SchoolArt.hero(c,'yaho',x,y,3,frames[i]);assert.equal(Y.pose(frames[i]),i);assert.equal(c.globalAlpha,1);assert.equal(c.globalCompositeOperation,'source-over');}
 fs.writeFileSync('/tmp/yaho-poses.png',sheet.toBuffer('image/png'));
 const cv=canvas(960,540),ctx=cv.getContext('2d'),s=G.create(Date.parse('2026-11-20T10:00Z'));s.units.yaho={level:100,stars:5,xp:0,shards:0};s.units.lava={level:100,stars:5,xp:0,shards:0};G.action(s,{kind:'team',team:['taeo','yaho','lava']},s.at);
 for(const u of s.battle.heroes){u.hp=u.max=100000;u.yahoGuardUntil=30000;u.yahoGrace=true;}for(const e of s.battle.enemies){e.hp=e.max=1e7;e.atk=1;}
 G.advance(s,s.at+18500);const before=JSON.stringify(s);W.SchoolArt.draw(ctx,s,18.6,s.events);assert.equal(JSON.stringify(s),before);assert.equal(ctx.globalAlpha,1);Y.status(ctx,s.battle.heroes[1],200,300,18500,2,.3);assert.equal(ctx.globalAlpha,1);fs.writeFileSync('/tmp/yaho-battle.png',cv.toBuffer('image/png'));
 vm.runInNewContext(fs.readFileSync('school/skill-cards.js','utf8'),{window:W});for(const frozen of[false,true]){const status=W.SchoolSkillCards.status(s.battle.heroes[1],{elapsed:18500,frozen});assert(status.label.includes(frozen?'빙결':'산군의 가호'));}
 assert.equal(Y.pose({casting:true,yahoStage:3,frozen:true}),0);assert.equal(Y.pose({casting:true,yahoStage:3,stunned:true}),0);
 console.log('PASS 12 distinct poses, transparent assets, frozen/stunned casting suppression, read-only live scene and guardian skill-card state');
})().catch(e=>{console.error(e);process.exitCode=1;});
