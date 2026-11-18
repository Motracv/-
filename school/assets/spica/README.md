# Spica winter-event character art

Original game art generated for 학교용병단 on 2026-11-18 from the user's Spica reference. The second combat sheet follows the requested Horas-like proportions and rendering. Image generation authored the poses; delivery conversion/compression did not alter their composition.

- `portrait.webp`: 1024×1536 RGBA full-body illustration, 192,070 bytes. Navy-blue bob with icy white lower strands, pale blue eyes, black choker, opaque grey-blue gown, white fur stole and snowflake embroidery. Intended for the event exchange and acquisition presentation. Keep `object-fit: contain` when showing the whole design.
- **`combat-horas.webp`**: current 1774×887 RGBA sheet, 379,938 bytes, 4 columns × 2 rows. Eight right-facing poses with a nominal standing height of 413 source pixels. Decode once and cache each pose in at most three resolution tiers.
- `atlas.json`: version 2, explicit source rectangles and foot anchors. Widths alternate between 444 and 443 pixels; do not divide the full width into equal fractional cells.
- `combat.png`: previous compact 1536×1024 six-pose sheet, retained as historical source. The active game and offline cache use `combat-horas.webp`.

| Index | Pose | Source rectangle x,y,w,h | Foot anchor x,y |
| --- | --- | --- | --- |
| 0 | Idle | 0,0,444,444 | 242.04,426 |
| 1 | Basic windup | 444,0,443,444 | 238.99,426 |
| 2 | Basic release | 887,0,443,444 | 221.88,426 |
| 3 | Basic recovery | 1330,0,444,444 | 226.52,426 |
| 4 | Skill windup | 0,444,444,443 | 244.97,427 |
| 5 | Allied haste | 444,444,443,443 | 232.72,428 |
| 6 | Enemy frost | 887,444,443,443 | 215.91,428 |
| 7 | Skill recovery | 1330,444,444,443 | 228.34,428 |

The basic attack uses poses 1→2→3, and the 1.6-second skill uses 4→5→6→7. The renderer anchors the feet while adding small body/cloth motion. The six-second field blizzard is a separate, bounded Canvas effect driven by the authoritative buff deadline; it outlives the character's casting gesture. Reduced motion holds the field snow still.

The permanent recruitment joint illustration is stored separately at `../recruit/osia-lava.webp`: 1672×941, 593,870 bytes. Osia is on the left and Lava on the right, at equal visual weight, with a shared perspective courtyard. Use a centered crop rather than the old single-character right-biased crop. It has no baked text, rarity or price labels.

Generated originals remain in `/workspace/generated_images/`:

- Current eight-pose sheet: `exec-e674512f-3db4-449a-97ec-83b13787305b.png`
- Spica portrait: `exec-4b544292-288d-44c1-96ee-19390135585c.png`
- Initial tall atlas, superseded: `exec-9f607f84-41ef-455c-b61f-658127abf837.png`
- Previous compact atlas: `exec-e26ad041-2c35-454e-8a5e-f448a2359527.png`
- Joint banner: `exec-bffe8a3d-034c-471d-b04a-ac18dd95a3f8.png`
