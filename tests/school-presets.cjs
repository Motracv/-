const assert=require('node:assert/strict');
const G=require('../school/engine.js');
const NOW=Date.parse('2026-11-18T12:00:00+09:00');let passed=0;
const test=(name,run)=>{run();passed++;console.log('PASS',name);};
const make=()=>G.create(NOW,287),act=(s,input)=>G.action(s,input,s.at);
function reject(s,input){const before=G.clone(s);assert.throws(()=>act(s,input));assert.deepEqual(s,before);}
test('Legacy migration adds three empty named presets without copying teams, spending or resetting progress',()=>{
 const s=make();delete s.presets;const before=G.clone(s);assert(G.validate(s));assert.deepEqual(G.presetInfo(s).map(p=>[p.slot,p.name,p.team,p.saved,p.active]),[[0,'모험',[],false,false],[1,'보스',[],false,false],[2,'아레나',[],false,false]]);assert.deepEqual(s,before);G.advance(s,s.at);assert(G.validate(s));const after=G.clone(s);delete after.presets;assert.deepEqual(after,before);
});
test('Save snapshots only the current ordered team; rename and deletion never change the active battle',()=>{
 const s=make(),before=G.clone(s);act(s,{kind:'preset-save',slot:0,team:['horas','horas'],gems:1e9});assert.deepEqual(s.presets[0].team,before.team);assert.notEqual(s.presets[0].team,s.team);assert(G.presetInfo(s)[0].active);
 act(s,{kind:'preset-rename',slot:0,name:'  보스   1  '});assert.equal(s.presets[0].name,'보스 1');act(s,{kind:'preset-delete',slot:0});assert.equal(s.presets[0].name,'보스 1');assert.deepEqual(s.presets[0].team,[]);assert(!G.presetInfo(s)[0].saved);for(const key of ['team','battle','gold','gems','units','banners','captain','quests','winter','at','seed'])assert.deepEqual(s[key],before[key]);reject(s,{kind:'preset-delete',slot:0});
});
test('Applying restores owned heroes and exact order using the existing campaign reset once',()=>{
 const s=make();act(s,{kind:'preset-save',slot:1});const saved=[...s.team];act(s,{kind:'team',team:['sua','harin']});const before=G.clone(s);act(s,{kind:'preset-apply',slot:1});assert.deepEqual(s.team,saved);assert.equal(s.battle.phase,'fight');assert.equal(s.battle.elapsed,0);assert(s.battle.id>before.battle.id);assert.deepEqual(s.battle.heroes.map(h=>h.id),saved);for(const key of ['gold','gems','units','banners','captain','quests','winter','at'])assert.deepEqual(s[key],before[key]);reject(s,{kind:'preset-apply',slot:1});assert(G.validate(G.clone(s)));
 const control=G.clone(before);act(control,{kind:'team',team:saved});assert.deepEqual(s,control);
});
test('Dungeon permits saving and renaming but blocks preset application atomically until the challenge ends',()=>{
 const s=make();act(s,{kind:'preset-save',slot:0});act(s,{kind:'team',team:['harin']});act(s,{kind:'activity',mode:'daily',tier:1});const battle=G.clone(s.battle),activity=G.clone(s.activities);act(s,{kind:'preset-save',slot:1});act(s,{kind:'preset-rename',slot:1,name:'던전'});assert.deepEqual(s.battle,battle);assert.deepEqual(s.activities,activity);reject(s,{kind:'preset-apply',slot:0});act(s,{kind:'preset-delete',slot:1});assert.deepEqual(s.activities,activity);
 act(s,{kind:'activity-exit'});act(s,{kind:'preset-apply',slot:0});assert.equal(s.activities.run,null);assert.deepEqual(s.team,['taeo','harin','sua']);
});
test('Preset inputs, ownership, slot boundaries and one-to-six member limits are validated without mutation',()=>{
 const s=make();for(const slot of [-1,3,.5,'0',null,{},undefined])for(const kind of ['preset-save','preset-rename','preset-apply','preset-delete'])reject(s,{kind,slot,name:'테스트'});
 for(const name of ['',null,{},' ','a'.repeat(13),'<script>','줄\n바꿈','😀'])reject(s,{kind:'preset-rename',slot:0,name});act(s,{kind:'preset-rename',slot:0,name:'가'});reject(s,{kind:'preset-rename',slot:0,name:'가'});act(s,{kind:'preset-rename',slot:0,name:'가'.repeat(12)});
 for(const mutate of [v=>v.presets=null,v=>v.presets=[],v=>v.presets.push({name:'4',team:[]}),v=>v.presets[0].name=' ',v=>v.presets[0].name=null,v=>v.presets[0].team=['horas'],v=>v.presets[0].team=['harin','harin'],v=>v.presets[0].team=['constructor'],v=>v.presets[0].team='harin']){const invalid=G.clone(s);mutate(invalid);assert.equal(G.validate(invalid),false);}
 for(const id of ['geonu','osia','lava'])s.units[id]={level:1,xp:0,stars:0,shards:0};act(s,{kind:'team',team:['lava','osia','geonu','sua','harin','taeo']});act(s,{kind:'preset-save',slot:2});assert.equal(s.presets[2].team.length,6);act(s,{kind:'team',team:['harin']});act(s,{kind:'preset-save',slot:1});assert.equal(s.presets[1].team.length,1);assert(G.validate(s));
});
console.log(`${passed} party preset engine checks passed`);
