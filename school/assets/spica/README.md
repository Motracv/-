# Spica winter-event character art

Original game art generated for 학교용병단 on 2026-11-18, using the user's Spica drawing as the character reference. Only image generation created or changed the artwork; delivery conversion/compression did not alter composition or poses.

- `portrait.webp`: 1024×1536 RGBA full-body illustration, 192,070 bytes. Navy-blue bob with icy white lower strands, pale blue eyes, black choker, opaque grey-blue gown, white fur stole and snowflake embroidery. Intended for the event exchange and acquisition presentation. Keep `object-fit: contain` when showing the whole design.
- `combat.png`: 1536×1024 RGBA atlas, 3 columns × 2 rows, 512×512 cells. Six right-facing compact RPG poses: idle, basic palm attack, allied haste, enemy slow, recoil, kneeling defeat. Standing sprite silhouette is approximately 432 source pixels high. It is best rendered at a consistent scale of desired standing height / 432; the kneeling pose should remain shorter.
- `atlas.json`: source-cell coordinates and per-pose ground anchors, to prevent horizontal/vertical jumps when switching poses.

| Index | Pose | Cell | Anchor within cell |
| --- | --- | --- | --- |
| 0 | Idle | 0,0 | 277,485 |
| 1 | Basic | 1,0 | 212,485 |
| 2 | Haste | 2,0 | 209,485 |
| 3 | Slow | 0,1 | 276,484 |
| 4 | Hurt | 1,1 | 244,484 |
| 5 | Defeat | 2,1 | 204,485 |

All meaningful pixels (alpha >127) stay inside their own cell. The widest slow-effect pose ends at local x489. Transparent corners have alpha 0; the generated artwork retains some barely visible edge/halo pixels with alpha 1–16. Do not derive the sprite bounds from alpha >0. The atlas interior is near opaque (alpha up to254), consistent with the generated source.

The permanent recruitment joint illustration is stored separately at `../recruit/osia-lava.webp`: 1672×941, 593,870 bytes. Osia is on the left and Lava on the right, at equal visual weight, with a shared perspective courtyard. Use a centered crop rather than the old single-character right-biased crop. It has no baked text, rarity or price labels.

Generated originals remain in `/workspace/generated_images/`:

- Spica portrait: `exec-4b544292-288d-44c1-96ee-19390135585c.png`
- Initial tall atlas, superseded: `exec-9f607f84-41ef-455c-b61f-658127abf837.png`
- Final compact atlas: `exec-e26ad041-2c35-454e-8a5e-f448a2359527.png`
- Joint banner: `exec-bffe8a3d-034c-471d-b04a-ac18dd95a3f8.png`
