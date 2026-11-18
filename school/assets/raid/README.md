# Balloon guild raid artwork

Original pixel-art assets generated with image_gen on 2026-11-18 for 학교용병단, based on the user's Balloon character drawing and blue school-gym battle concept. Original generated files remain in `/workspace/generated_images`.

- `gymnasium.png` — 1536 × 1024 RGB, empty night school gymnasium with broad parquet combat floor. Background generation: `exec-aaa90aa1-0cea-4116-a4a1-e89b5990853e.png`.
- `balloon-poses.png` — 1536 × 1024 RGBA, six left-facing poses in exactly 3 columns × 2 rows. Each source cell is 512 × 512. Cleaned generation: `exec-5baf5c8d-fa80-4537-a0bf-670f3350c2c2.png` (initial generation `exec-8b023282-f9f1-47e6-8283-fd8935916572.png`).

Atlas order is left-to-right, then next row:

| Index | Pose | Source rectangle |
| --- | --- | --- |
| 0 | Idle | 0, 0, 512, 512 |
| 1 | Ground strike | 512, 0, 512, 512 |
| 2 | Upward sweep | 1024, 0, 512, 512 |
| 3 | Chain lash | 0, 512, 512, 512 |
| 4 | Chain guard | 512, 512, 512, 512 |
| 5 | Dash strike | 1024, 512, 512, 512 |

Feet use approximately y=476 within each cell (variation up to 7 source pixels). Draw equal source cells at a common center and floor anchor; crouches retain intentionally lower head height. The idle opaque character body is about 442 source pixels tall; size the full cell about 1.16 times the desired visible boss height. Long chains, sweeping attacks and movement interpolation belong to the game's renderer rather than this static atlas.

Inspection confirmed correct dimensions, all six poses present, left-facing orientation, no cell overlap, and transparent outer corners. The broad diffuse backing and baked-in cyan magic effects were removed with image_gen edits. A Chromium render over a checkerboard confirmed clear gaps without opaque rectangles or visible broad halos; the PNG is the unmodified generated result. Character edge antialias alpha remains. No third-party game sprites are used.
