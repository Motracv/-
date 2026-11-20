/* Follow the visible browser area, including keyboard and toolbar changes.
   Pinch zoom is owned by the user and must not resize the game underneath it. */
(() => {
  const viewport = window.visualViewport;
  let frame = 0;
  function update() {
    frame = 0;
    if (viewport && Math.abs(viewport.scale - 1) > .02) return;
    const height = Math.round(viewport?.height || innerHeight);
    const top = Math.round(viewport?.offsetTop || 0);
    document.documentElement.style.setProperty('--game-height', height + 'px');
    document.documentElement.style.setProperty('--game-top', top + 'px');
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  window.addEventListener('resize', schedule, {passive:true});
  window.addEventListener('pageshow', schedule, {passive:true});
  viewport?.addEventListener('resize', schedule, {passive:true});
  viewport?.addEventListener('scroll', schedule, {passive:true});
  update();
})();
