/* One streamed music player. Autoplay failures never block game startup. */
window.SchoolMusic = (() => {
  'use strict';
  const clamp=(value,fallback=.35)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
  const TRACKS={title:'school/assets/audio/title-theme.m4a?v=title-theme1',lobby:'school/assets/audio/winter-evening.mp3?v=main-theme1'};
  function create(options) {
    let player,context,gain,source,unlocked=false,hidden=false,destroyed=false,pending=false,blocked=false,fadeTimer=0,target=-1,currentTrack='',generation=0;
    const listeners=[];
    const on=(node,type,fn)=>{node.addEventListener(type,fn);listeners.push(()=>node.removeEventListener(type,fn));};
    const prefs=()=>options.preferences();
    const wanted=()=>!destroyed&&!hidden&&!document.hidden&&unlocked&&prefs().music&&!prefs().muted&&clamp(prefs().musicVolume)>0&&options.active();
    function selectTrack(){
      const track=options.track?.()==='title'?'title':'lobby';
      if(track===currentTrack)return;
      generation++;currentTrack=track;blocked=false;
      player.pause();volume(0,true);player.src=TRACKS[track];player.load();
    }
    function volume(value,immediate=false){
      if(target===value&&!immediate)return;target=value;
      if(gain){const at=context.currentTime;gain.gain.cancelScheduledValues(at);gain.gain.setTargetAtTime(value,at,immediate ? .001 : .09);}
      else if(player)player.volume=value;
    }
    function stop(immediate=false){
      if(fadeTimer)clearTimeout(fadeTimer);fadeTimer=0;
      volume(0,immediate);
      if(!player||player.paused)return;
      if(immediate||!gain)player.pause();
      else fadeTimer=setTimeout(()=>{fadeTimer=0;if(!wanted())player.pause();},300);
    }
    function update(){
      if(!wanted()){if(!fadeTimer)stop(document.hidden||hidden||!!prefs().muted||!prefs().music);return;}
      if(fadeTimer)clearTimeout(fadeTimer);fadeTimer=0;
      if(!player)return;
      selectTrack();if(blocked)return;
      volume(clamp(prefs().musicVolume));
      if(!player.paused||pending)return;
      pending=true;
      const ticket=generation;
      try{Promise.resolve(player.play()).then(()=>{if(ticket===generation&&!wanted())stop(true);},error=>{if(ticket===generation)blocked=error?.name!=='AbortError';}).finally(()=>{pending=false;if(ticket!==generation&&!destroyed)update();});}
      catch{pending=false;blocked=true;}
    }
    function unlock(event){
      if(event?.type==='keydown'&&(event.repeat||event.ctrlKey||event.metaKey||event.altKey))return;
      if(destroyed)return;unlocked=true;blocked=false;
      if(!player&&prefs().music&&!prefs().muted){
        player=new Audio();player.preload='none';player.loop=true;
        player.volume=clamp(prefs().musicVolume);
        player.addEventListener('error',()=>{blocked=true;});
        try{
          const Context=window.AudioContext||window.webkitAudioContext;
          if(Context){context=new Context();gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);source=context.createMediaElementSource(player);source.connect(gain);player.volume=1;}
        }catch{gain=null;context?.close?.().catch(()=>{});context=null;}
      }
      // Resume within the gesture, including iOS media-volume restrictions.
      if(context?.state==='suspended')context.resume().then(update,()=>{blocked=true;});
      update();
    }
    on(document,'pointerdown',unlock);on(document,'keydown',unlock);
    on(document,'visibilitychange',()=>document.hidden?stop(true):update());
    on(window,'pagehide',()=>{hidden=true;stop(true);});on(window,'pageshow',()=>{hidden=false;update();});
    return {update,unlock,destroy(){destroyed=true;stop(true);listeners.forEach(fn=>fn());if(player){player.removeAttribute('src');player.load();}source?.disconnect();gain?.disconnect();context?.close?.().catch(()=>{});}};
  }
  return {create,clamp};
})();
