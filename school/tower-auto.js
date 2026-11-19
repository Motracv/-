/* Opt-in, one confirmed run -> one next-floor request. No combat prediction. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SchoolTowerAuto=api;})(globalThis,()=>{
 function create(){let key='',deadline=0,last='',scope='',inflight='';
  function reset(){key='';deadline=0;}
  function retry(){inflight='';reset();}
  function tick(o){if(scope!==o.scope){scope=o.scope;last='';inflight='';reset();}
   const r=o.result;if(!o.enabled||!r||r.kind!=='tower'||!r.won||r.floor>=o.maxFloor){reset();return {stop:!!o.enabled&&!!r&&r.kind==='tower'&&(!r.won||r.floor>=o.maxFloor)};}
   const nextKey=o.scope+':'+r.runId;if(nextKey===last)return {};
   if(nextKey===inflight)return {waiting:true};
   if(!o.confirmed||o.blocked){return {waiting:true};}
   if(key!==nextKey){key=nextKey;deadline=o.now+3000;}
   if(o.now<deadline)return {remaining:Math.ceil((deadline-o.now)/1000)};
   inflight=nextKey;reset();return {floor:r.floor+1};
  }
  function acknowledge(success){if(success)last=inflight;retry();}
  return {tick,reset,retry,acknowledge};
 }
 return {create};
});
