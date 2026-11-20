const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('school/entry.js','utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(cached=false){
  const {document,Node}=require('./school-ui-dom.cjs')();
  document.getElementById=id=>document.querySelector('#'+id);
  for(const id of ['school-entry','entry-message','entry-start','entry-google','entry-retry','entry-account','entry-signout','entry-test-form','entry-test-code','entry-test-submit','board-viewport','app','rotate-prompt','entry-art','entry-art-background','entry-art-characters'])document.body.append(new Node('div',`id="${id}"`));
  const $=document.getElementById,window={},decodes=[];
  for(const id of ['entry-art-background','entry-art-characters']){
    const image=$(id);image.complete=cached;image.naturalWidth=cached?1672:0;
    image.decode=()=>new Promise((resolve,reject)=>decodes.push({resolve,reject}));
  }
  vm.runInNewContext(source,{window,document});
  const entry=window.SchoolEntry.create({authenticated:()=>false,profile:()=>null});
  return {$,document,decodes,entry};
}
(async()=>{
  const a=setup(),art=a.$('entry-art');
  assert.notEqual(art.dataset.ready,'true','The original poster stays until both layers decode');
  a.$('entry-art-background').naturalWidth=1672;a.$('entry-art-background').emit('load');
  a.decodes[0].resolve();await flush();assert.notEqual(art.dataset.ready,'true');
  a.$('entry-art-characters').naturalWidth=1672;a.$('entry-art-characters').emit('load');
  a.decodes[1].resolve();await flush();assert.equal(art.dataset.ready,'true');
  a.document.hidden=true;a.document.emit('visibilitychange');assert.equal(art.dataset.paused,'true');
  a.document.hidden=false;a.document.emit('visibilitychange');assert.equal(art.dataset.paused,'false');
  assert(!a.entry.entered);assert(a.$('board-viewport').hidden,'Artwork loading cannot bypass the login gate');
  const b=setup(true);b.decodes[0].resolve();b.decodes[1].resolve();await flush();assert.equal(b.$('entry-art').dataset.ready,'true','Cached images work without another load event');
  const c=setup(true);c.decodes[0].resolve();c.decodes[1].reject(Error('Corrupt image'));await flush();assert.equal(c.$('entry-art').dataset.ready,'false','Decode failure keeps the complete poster');
  const d=setup();d.$('entry-art-characters').emit('error',Error('Offline'));await flush();assert.equal(d.$('entry-art').dataset.ready,'false','Download failure keeps the complete poster');
  console.log('PASS title layers: complete decode, cache hit, corrupt/offline fallback, background pause and intact login gate');
})().catch(e=>{console.error(e);process.exitCode=1;});
