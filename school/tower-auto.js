/* Opt-in, one confirmed run -> one next-floor request. No combat prediction. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SchoolTowerAuto=api;})(globalThis,()=>{
 function create(){let key='',deadline=0,last='',scope='';
  function reset(){key='';deadline=0;}
  function tick(o){if(scope!==o.scope){scope=o.scope;last='';reset();}
   const r=o.result;if(!o.enabled||!r||r.kind!=='tower'||!r.won||r.floor>=o.maxFloor){reset();return {stop:!!o.enabled&&!!r&&r.kind==='tower'&&(!r.won||r.floor>=o.maxFloor)};}
   const nextKey=o.scope+':'+r.runId;if(nextKey===last)return {};
   if(!o.confirmed||o.blocked){reset();return {};}
   if(key!==nextKey){key=nextKey;deadline=o.now+3000;}
   if(o.now<deadline)return {remaining:Math.ceil((deadline-o.now)/1000)};
   last=nextKey;reset();return {floor:r.floor+1};
  }
  return {tick,reset};
 }
 return {create};
});
