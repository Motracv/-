Twin guild boss presentation preview

Open index.html over HTTP. It loads only the isolated sprite atlas and renderer;
it never writes saves, creates encounters, spends currency or pays rewards.

Deliverables:
- ../../school/assets/twins/atlas.png: RGBA 1536x1024, eight source poses.
- frames.json: source rectangles, local foot anchors, cooperative hit times.
- ../../school/twins-art.js: reusable presentation renderer.
- ../../school/twins-fx.js: dash outlines, speed lines, blade arcs, impact sparks, debris and dust. Load before twins-art.js.

Integration:
  const frames = await SchoolTwinsArt.load(atlasUrl);
  const pose = SchoolTwinsArt.sample(elapsedSeconds, 'cross', reducedMotion);
  SchoolTwinsArt.draw(ctx, frames, pose, {reduced: reducedMotion});
The renderer uses a 1280x720 logical stage. Transform the context to the viewport
before drawing. Sampling is deterministic and does not change battle state.
Cross and slam share one contact timestamp for both attackers. Relay uses two
ordered contact timestamps. Server attack events should supply elapsed time;
never turn render calls into damage callbacks.

The source rectangles overlap where weapons extend, so load() extracts each
connected alpha silhouette once. Do not blindly crop the regular 4x2 cells.
Pixel sizes are preserved across poses, rather than stretching every pose to the
same bounding height. Ground shadows are independent of body lift and rotation.

This standalone preview does not change gameplay. The approved art is also used
by the live guild raid through school/raid-twins-art.js. Server raid-engine.js
handles weekly rotation, physical-only damage and synchronized hit events.

VFX are sampled from absolute encounter time. Afterimages retain their birth positions; scrubbing and pause do not leave old particles behind. Reduced motion disables trails and camera shake. Cached tint/outline textures are built once per atlas.
