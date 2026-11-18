/* Exercise the production season polling functions with a rejected server and a fake clock. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../school/social.js'), 'utf8');
const start = source.indexOf('    function seasonCountdown() {');
const end = source.indexOf('    async function seasonMutate(', start);
assert(start >= 0 && end > start, 'production polling block is present');
function fixture() {
  const timers = new Map(); let next = 0;
  const c = vm.createContext({
    wall: 1000, generation: 1, loadEpoch: 0, busy: false, seasonLoading: false,
    view: 'arena', arenaMode: 'season', cancelReplay: null, poll: null,
    seasonCountdownSecond: -1, seasonRolloverKey: '', visible: true, connected: true,
    document: { hidden: false }, requests: [], messages: {},
    seasonData: { season: { id: 1, endsAt: 1000, phase: 'active' }, dayResetsAt: 1000 },
    $: () => ({}),
    setTimeout(fn, delay) { const id = ++next; timers.set(id, { at: c.wall + delay, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  vm.runInContext(`
    const own = () => visible;
    const seasonNow = () => wall;
    const context = {isCloud:()=>connected,request:async()=>{requests.push(wall);throw Error('offline');}};
    const setSeasonText = (id,value) => {messages[id]=value;};
    const acceptSeason = () => {throw Error('unexpected successful response');};
    const renderSeason = () => {if(visible)seasonCountdown();};
    ${source.slice(start, end)}
  `, c);
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const advance = async wall => {
    c.wall = wall;
    for (const [id,timer] of [...timers]) if (timer.at <= wall) { timers.delete(id);timer.fn();await flush(); }
  };
  return { c, timers, flush, advance };
}
(async () => {
  const t = fixture();
  t.c.seasonCountdown(); await t.flush();
  assert.deepEqual([...t.c.requests], [1000]);
  assert.equal(t.c.seasonLoading, false);
  assert.equal(t.timers.size, 1);
  assert.equal([...t.timers.values()][0].at, 11000);
  for (let wall = 2000; wall <= 10000; wall += 1000) {
    await t.advance(wall); t.c.seasonCountdown(); await t.flush();
  }
  assert.deepEqual([...t.c.requests], [1000], 'the expired countdown cannot create a request each second');
  await t.advance(11000);
  assert.deepEqual([...t.c.requests], [1000,11000]);
  assert.equal([...t.timers.values()][0].at, 21000);
  t.c.document.hidden = true; await t.advance(21000);
  assert.equal(t.c.requests.length, 2, 'hidden page skips the periodic request');
  assert.equal([...t.timers.values()][0].at, 31000);
  t.c.document.hidden = false; t.c.connected = false; await t.advance(31000);
  assert.equal(t.c.requests.length, 2, 'disconnection keeps a timer without issuing a request');
  t.c.connected = true; await t.advance(41000);
  assert.deepEqual([...t.c.requests], [1000,11000,41000], 'visible polling resumes after reconnect');
  t.c.visible = false; await t.advance(51000);
  assert.equal(t.c.requests.length, 3); assert.equal(t.timers.size, 0, 'closed dialog stops polling');
  console.log('PASS production polling: one immediate rejected rollover request,10-second retry, hidden/disconnected pauses, reconnect and close');
})().catch(error => { console.error(error); process.exitCode = 1; });
