# In-game roster artwork

Transparent generated artwork packed into WebP atlases. `atlas.json` records
the source rectangles, scale, and foot anchor of every frame. No combat stats,
timers, or saved data belong to this module.

- Students A/B/C: 13 characters, four poses each; 256 × 256 cells.
- Osia: six poses; the existing water-breath choreography stays in its module.
- Ryusion: eight poses; the existing shield and taunt sequence is retained.
- Spica: eight poses; the existing blizzard and buff timing is retained.
- Lava: ten poses; the fan attack cadence is retained and all states use this model.
- Horas, Kazua, and Hyeokjin keep their existing authored atlases and effects.

Run `node tests/school-roster-art.cjs` to decode the actual images and validate
poses, anchors, status interruptions, fallback loading, and allocation limits.
`node tools/render-roster-preview.cjs` produces a roster contact sheet and motion
frames through the production renderer. These are native Canvas checks, not a
browser or physical-device performance test.
